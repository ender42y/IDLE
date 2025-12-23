import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import { ResourceId, RESOURCE_DEFINITIONS } from '../models/resource.model';
import {
  Ship,
  ShipType,
  ShipStatus,
  SHIP_SIZE_DEFINITIONS,
  calculateFuelCost,
  calculateTravelTime
} from '../models/ship.model';
import { getRouteDist } from '../models/star-system.model';

export interface ColonizationMission {
  id: string;
  shipId: string;
  originSystemId: string;
  destinationSystemId: string;
  cargo: { resourceId: ResourceId; amount: number }[];
  departureTime: number;
  arrivalTime: number;
  fuelConsumed: number;
}

@Injectable({
  providedIn: 'root'
})
export class ColonizationService {
  private gameState = inject(GameStateService);

  /**
   * Send a freighter to colonize a new system
   */
  sendColonizationMission(
    shipId: string,
    destinationSystemId: string,
    cargo: { resourceId: ResourceId; amount: number }[]
  ): boolean {
    const state = this.gameState.getState();
    const ship = state.ships[shipId];
    const destination = state.systems[destinationSystemId];

    console.debug('[Colonization] sendColonizationMission called', { shipId, destinationSystemId, cargo });

    if (!ship || ship.type !== ShipType.Freighter) {
      console.debug('[Colonization] invalid ship or wrong type', ship);
      this.gameState.addNotification({
        type: 'warning',
        title: 'Invalid Ship',
        message: 'Only freighter ships can transport colonization supplies.'
      });
      return false;
    }

    if (ship.status !== ShipStatus.Idle) {
      console.debug('[Colonization] ship busy', ship.status);
      this.gameState.addNotification({
        type: 'warning',
        title: 'Ship Busy',
        message: `${ship.name} is not available.`
      });
      return false;
    }

    if (!destination || !destination.discovered) {
      console.debug('[Colonization] invalid destination or not discovered', destination);
      this.gameState.addNotification({
        type: 'warning',
        title: 'Invalid Destination',
        message: 'System must be discovered first.'
      });
      return false;
    }

    const origin = state.systems[ship.currentSystemId];
    if (!origin) return false;

    // Check cargo capacity
    const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];
    const totalCargo = cargo.reduce((sum, c) => sum + c.amount, 0);

    if (totalCargo > sizeDefinition.cargoCapacity) {
      console.debug('[Colonization] cargo too large', { totalCargo, capacity: sizeDefinition.cargoCapacity });
      this.gameState.addNotification({
        type: 'warning',
        title: 'Cargo Too Large',
        message: `${ship.name} can only carry ${sizeDefinition.cargoCapacity} tonnes.`
      });
      return false;
    }

    // Check and load cargo from origin system
    const loadedCargo: { resourceId: ResourceId; amount: number }[] = [];
    for (const item of cargo) {
      const available = this.gameState.getSystemResource(origin.id, item.resourceId);
      if (available < item.amount) {
        console.debug('[Colonization] insufficient resource at origin', { resourceId: item.resourceId, available, needed: item.amount });
        const name = RESOURCE_DEFINITIONS[item.resourceId]?.name ?? item.resourceId;
        this.gameState.addNotification({
          type: 'warning',
          title: 'Insufficient Resources',
          message: `Not enough ${name}. Have ${available.toFixed(0)}, need ${item.amount}.`
        });
        return false;
      }
    }

    // Calculate fuel cost
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const fuelNeeded = calculateFuelCost(distance, totalCargo, ship);
    const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);

    if (fuelAvailable < fuelNeeded) {
      console.debug('[Colonization] insufficient fuel', { fuelAvailable, fuelNeeded });
      this.gameState.addNotification({
        type: 'warning',
        title: 'Insufficient Fuel',
        message: `Need ${fuelNeeded.toFixed(1)} fuel for this mission.`
      });
      return false;
    }

    // Deduct resources and fuel
    for (const item of cargo) {
      this.gameState.removeResourceFromSystem(origin.id, item.resourceId, item.amount);
      loadedCargo.push({ resourceId: item.resourceId, amount: item.amount });
    }
    this.gameState.removeResourceFromSystem(origin.id, ResourceId.Fuel, fuelNeeded);

    // Calculate travel time
    const travelTimeHours = calculateTravelTime(distance, ship);
    const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
    const now = Date.now();
    const arrivalTime = now + travelTimeMs;

    // Update ship
    this.gameState.updateShip(shipId, {
      status: ShipStatus.InTransit,
      destinationSystemId: destination.id,
      departureTime: now,
      arrivalTime: arrivalTime,
      currentCargo: loadedCargo
    });

    console.debug('[Colonization] mission launched', { shipId, destinationId: destination.id, arrivalTime, loadedCargo });

    this.gameState.addNotification({
      type: 'info',
      title: 'Colonization Mission Launched',
      message: `${ship.name} departing for ${destination.name} with colonization supplies. ETA: ${this.formatHours(travelTimeHours)}`
    });

    return true;
  }

  /**
   * Process colonization missions (called each tick)
   */
  processTick(deltaMs: number): void {
    const state = this.gameState.getState();
    const now = Date.now();

    // Find ships in transit with cargo going to non-colonized systems
    for (const ship of Object.values(state.ships)) {
      if (ship.status !== ShipStatus.InTransit) continue;
      if (!ship.destinationSystemId || !ship.arrivalTime) continue;
      if (now < ship.arrivalTime) continue;

      const destination = state.systems[ship.destinationSystemId];
      if (!destination) continue;

      // Ship has arrived
      this.completeColonizationMission(ship.id);
    }
  }

  /**
   * Complete a colonization mission
   */
  private completeColonizationMission(shipId: string): void {
    const state = this.gameState.getState();
    const ship = state.ships[shipId];
    if (!ship || !ship.destinationSystemId) return;

    const destination = state.systems[ship.destinationSystemId];
    if (!destination) return;

    console.debug('[Colonization] completing mission', { shipId, destinationId: destination.id, currentCargo: ship.currentCargo });

    // Deliver cargo
    const deliveredCargo = ship.currentCargo ?? [];
    for (const cargo of deliveredCargo) {
      this.gameState.addResourceToSystem(destination.id, cargo.resourceId, cargo.amount);
    }

    // Mark system as colonized if it wasn't already
    if (!destination.colonized) {
      // Set initial population - colonization supplies support a small initial colony
      const initialPopulation = 100;

      this.gameState.updateSystem(destination.id, {
        colonized: true,
        totalPopulation: initialPopulation
      });

      this.gameState.addNotification({
        type: 'success',
        title: 'System Colonized!',
        message: `${destination.name} is now colonized with ${initialPopulation} colonists and ready for development.`,
        systemId: destination.id
      });
    } else {
      this.gameState.addNotification({
        type: 'success',
        title: 'Supplies Delivered',
        message: `${ship.name} has delivered supplies to ${destination.name}.`,
        systemId: destination.id
      });
    }

    // Update ship - now idle at destination
    this.gameState.updateShip(shipId, {
      status: ShipStatus.Idle,
      currentSystemId: destination.id,
      destinationSystemId: undefined,
      departureTime: undefined,
      arrivalTime: undefined,
      currentCargo: []
    });
  }

  /**
   * Get minimum resources needed to colonize a system
   */
  getColonizationRequirements(): { resourceId: ResourceId; amount: number }[] {
    return [
      { resourceId: ResourceId.Steel, amount: 100 },
      { resourceId: ResourceId.GlassCeramics, amount: 50 },
      { resourceId: ResourceId.PreparedFoods, amount: 100 },
      { resourceId: ResourceId.PurifiedWater, amount: 50 }
    ];
  }

  /**
   * Check if a cargo meets colonization requirements
   */
  meetsColonizationRequirements(cargo: { resourceId: ResourceId; amount: number }[]): boolean {
    const requirements = this.getColonizationRequirements();
    for (const req of requirements) {
      const supplied = cargo.find(c => c.resourceId === req.resourceId)?.amount ?? 0;
      if (supplied < req.amount) return false;
    }
    return true;
  }

  private formatHours(hours: number): string {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours.toFixed(0)}h`;
  }
}
