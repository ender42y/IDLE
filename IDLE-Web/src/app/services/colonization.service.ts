import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import { ConstructionService } from './construction.service';
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
import { FacilityId } from '../models/facility.model';

export interface ColonizationMission {
  id: string;
  shipId: string;
  originSystemId: string;
  destinationSystemId: string;
  starportBodyId?: string;

  // Total mission cargo tracking
  totalCargo: { resourceId: ResourceId; amount: number }[];
  deliveredCargo: { resourceId: ResourceId; amount: number }[];

  // Current trip tracking
  currentTripCargo?: { resourceId: ResourceId; amount: number }[];
  currentTripDepartureTime?: number;
  currentTripArrivalTime?: number;

  // Mission state
  status: 'active' | 'waiting_fuel' | 'completed';
  tripsCompleted: number;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class ColonizationService {
  private gameState = inject(GameStateService);
  private constructionService = inject(ConstructionService);

  /**
   * Send a freighter to colonize a new system
   */
  sendColonizationMission(
    shipId: string,
    destinationSystemId: string,
    cargo: { resourceId: ResourceId; amount: number }[],
    starportBodyId?: string
  ): boolean {
    const state = this.gameState.getState();
    const ship = state.ships[shipId];
    const destination = state.systems[destinationSystemId];

    console.log('[Colonization] sendColonizationMission called', { shipId, destinationSystemId, cargo });

    if (!ship || ship.type !== ShipType.Freighter) {
      console.log('[Colonization] invalid ship or wrong type', ship);
      this.gameState.addNotification({
        type: 'warning',
        title: 'Invalid Ship',
        message: 'Only freighter ships can transport colonization supplies.'
      });
      return false;
    }

    if (ship.status !== ShipStatus.Idle) {
      console.log('[Colonization] ship busy', ship.status);
      this.gameState.addNotification({
        type: 'warning',
        title: 'Ship Busy',
        message: `${ship.name} is not available.`
      });
      return false;
    }

    if (!destination || !destination.discovered) {
      console.log('[Colonization] invalid destination or not discovered', destination);
      this.gameState.addNotification({
        type: 'warning',
        title: 'Invalid Destination',
        message: 'System must be discovered first.'
      });
      return false;
    }

    const origin = state.systems[ship.currentSystemId];
    if (!origin) return false;

    // Check and reserve ALL cargo from origin system immediately
    const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];
    const totalCargoAmount = cargo.reduce((sum, c) => sum + c.amount, 0);

    console.log('[Colonization] Total cargo needed:', totalCargoAmount, 'Ship capacity:', sizeDefinition.cargoCapacity);

    // Validate all resources are available at origin
    for (const item of cargo) {
      const available = this.gameState.getSystemResource(origin.id, item.resourceId);
      if (available < item.amount) {
        console.log('[Colonization] insufficient resource at origin', { resourceId: item.resourceId, available, needed: item.amount });
        const name = RESOURCE_DEFINITIONS[item.resourceId]?.name ?? item.resourceId;
        this.gameState.addNotification({
          type: 'warning',
          title: 'Insufficient Resources',
          message: `Not enough ${name}. Have ${available.toFixed(0)}, need ${item.amount}.`
        });
        return false;
      }
    }

    // Deduct ALL cargo from origin immediately to reserve it
    for (const item of cargo) {
      this.gameState.removeResourceFromSystem(origin.id, item.resourceId, item.amount);
    }

    // Calculate how much cargo to load for first trip
    const firstTripCargo: { resourceId: ResourceId; amount: number }[] = [];
    const remainingCargo: { resourceId: ResourceId; amount: number }[] = [];
    let cargoLoadedThisTrip = 0;

    for (const item of cargo) {
      const spaceLeft = sizeDefinition.cargoCapacity - cargoLoadedThisTrip;
      const amountToLoad = Math.min(item.amount, spaceLeft);

      if (amountToLoad > 0) {
        firstTripCargo.push({ resourceId: item.resourceId, amount: amountToLoad });
        cargoLoadedThisTrip += amountToLoad;
      }

      const amountRemaining = item.amount - amountToLoad;
      if (amountRemaining > 0) {
        remainingCargo.push({ resourceId: item.resourceId, amount: amountRemaining });
      }

      if (cargoLoadedThisTrip >= sizeDefinition.cargoCapacity) break;
    }

    console.log('[Colonization] First trip cargo:', firstTripCargo, 'Remaining:', remainingCargo);

    // Calculate fuel cost for first trip
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const firstTripCargoWeight = firstTripCargo.reduce((sum, c) => sum + c.amount, 0);
    const fuelNeeded = calculateFuelCost(distance, firstTripCargoWeight, ship);
    const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);

    // Check if we have enough fuel for the first trip
    if (fuelAvailable < fuelNeeded) {
      console.log('[Colonization] insufficient fuel for first trip, entering wait state', { fuelAvailable, fuelNeeded });

      // Put cargo back and set ship to waiting state
      for (const item of cargo) {
        this.gameState.addResourceToSystem(origin.id, item.resourceId, item.amount);
      }

      this.gameState.updateShip(shipId, {
        status: ShipStatus.Idle,
        colonizationMission: {
          originSystemId: origin.id,
          destinationSystemId: destination.id,
          starportBodyId,
          remainingCargo: cargo,
          deliveredCargo: [],
          tripsCompleted: 0,
          waitingForFuel: true
        }
      });

      this.gameState.addNotification({
        type: 'info',
        title: 'Waiting for Fuel',
        message: `${ship.name} is waiting for ${fuelNeeded.toFixed(1)} fuel to begin colonization mission to ${destination.name}.`
      });

      return true; // Mission created, but waiting
    }

    // Deduct fuel for first trip
    this.gameState.removeResourceFromSystem(origin.id, ResourceId.Fuel, fuelNeeded);

    // Calculate travel time
    const travelTimeHours = calculateTravelTime(distance, ship);
    const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
    const now = Date.now();
    const arrivalTime = now + travelTimeMs;

    // Update ship with colonization mission tracking
    this.gameState.updateShip(shipId, {
      status: ShipStatus.InTransit,
      destinationSystemId: destination.id,
      departureTime: now,
      arrivalTime: arrivalTime,
      currentCargo: firstTripCargo,
      colonizationTargetBodyId: starportBodyId,
      colonizationMission: {
        originSystemId: origin.id,
        destinationSystemId: destination.id,
        starportBodyId,
        remainingCargo,
        deliveredCargo: [],
        tripsCompleted: 0,
        waitingForFuel: false
      }
    });

    const tripsNeeded = Math.ceil(totalCargoAmount / sizeDefinition.cargoCapacity);
    console.log('[Colonization] mission launched', {
      shipId,
      destinationId: destination.id,
      arrivalTime,
      firstTripCargo,
      remainingCargo,
      tripsNeeded
    });

    const tripsMessage = tripsNeeded > 1 ? ` (${tripsNeeded} trips required)` : '';
    this.gameState.addNotification({
      type: 'info',
      title: 'Colonization Mission Launched',
      message: `${ship.name} departing for ${destination.name} with colonization supplies${tripsMessage}. First trip ETA: ${this.formatHours(travelTimeHours)}`
    });

    return true;
  }

  /**
   * Process colonization missions (called each tick)
   */
  processTick(deltaMs: number): void {
    const state = this.gameState.getState();
    const now = Date.now();

    // Find ships in transit with colonization missions
    for (const ship of Object.values(state.ships)) {
      // Check for arriving ships
      if (ship.status === ShipStatus.InTransit && ship.colonizationMission) {
        if (!ship.destinationSystemId || !ship.arrivalTime) continue;
        if (now < ship.arrivalTime) continue;

        const destination = state.systems[ship.destinationSystemId];
        if (!destination) continue;

        const mission = ship.colonizationMission;

        // Check if ship is arriving at the colonization target or returning to origin
        if (ship.destinationSystemId === mission.destinationSystemId) {
          // Arriving at colonization target - unload cargo
          this.handleArrivalAtDestination(ship.id);
        } else if (ship.destinationSystemId === mission.originSystemId) {
          // Arriving back at origin - load next batch and depart
          this.handleArrivalAtOrigin(ship.id);
        }
      }

      // Check for ships waiting for fuel at origin
      if (ship.status === ShipStatus.Idle && ship.colonizationMission?.waitingForFuel) {
        const mission = ship.colonizationMission;
        const origin = state.systems[mission.originSystemId];
        if (!origin) continue;

        // Ship must be at origin to load fuel and cargo
        if (ship.currentSystemId !== mission.originSystemId) continue;

        // Calculate fuel needed for next trip
        const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];
        const destination = state.systems[mission.destinationSystemId];
        if (!destination) continue;

        const distance = getRouteDist(origin.coordinates, destination.coordinates);

        // Calculate next trip cargo to determine fuel needs
        const nextTripCargo: { resourceId: ResourceId; amount: number }[] = [];
        let cargoLoaded = 0;

        for (const item of mission.remainingCargo) {
          const spaceLeft = sizeDefinition.cargoCapacity - cargoLoaded;
          const amountToLoad = Math.min(item.amount, spaceLeft);
          if (amountToLoad > 0) {
            nextTripCargo.push({ resourceId: item.resourceId, amount: amountToLoad });
            cargoLoaded += amountToLoad;
          }
          if (cargoLoaded >= sizeDefinition.cargoCapacity) break;
        }

        const nextTripWeight = nextTripCargo.reduce((sum, c) => sum + c.amount, 0);
        const fuelNeeded = calculateFuelCost(distance, nextTripWeight, ship) * 2; // Round trip
        const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);

        if (fuelAvailable >= fuelNeeded) {
          // Enough fuel now - launch next trip!
          console.log('[Colonization] Fuel available, resuming mission', { ship: ship.name, fuelAvailable, fuelNeeded });

          // Deduct fuel
          this.gameState.removeResourceFromSystem(origin.id, ResourceId.Fuel, fuelNeeded);

          const travelTimeHours = calculateTravelTime(distance, ship);
          const travelTimeMs = travelTimeHours * 60 * 60 * 1000;

          mission.waitingForFuel = false;

          this.gameState.updateShip(ship.id, {
            status: ShipStatus.InTransit,
            destinationSystemId: destination.id,
            departureTime: now,
            arrivalTime: now + travelTimeMs,
            currentCargo: nextTripCargo,
            colonizationMission: mission
          });

          this.gameState.addNotification({
            type: 'info',
            title: 'Colonization Resumed',
            message: `${ship.name} has refueled and is departing for ${destination.name}. Trip ${mission.tripsCompleted + 1}.`
          });
        }
      }
    }
  }

  /**
   * Handle ship arrival at colonization destination - unload cargo and return to origin if more trips needed
   */
  private handleArrivalAtDestination(shipId: string): void {
    const state = this.gameState.getState();
    const ship = state.ships[shipId];
    if (!ship || !ship.destinationSystemId || !ship.colonizationMission) return;

    const destination = state.systems[ship.destinationSystemId];
    if (!destination) return;

    const mission = ship.colonizationMission;
    console.log('[Colonization] completing trip', {
      shipId,
      destinationId: destination.id,
      currentCargo: ship.currentCargo,
      tripsCompleted: mission.tripsCompleted,
      remainingCargo: mission.remainingCargo
    });

    // Deliver current cargo
    const deliveredThisTrip = ship.currentCargo ?? [];
    for (const cargo of deliveredThisTrip) {
      this.gameState.addResourceToSystem(destination.id, cargo.resourceId, cargo.amount);
      // Update delivered cargo tracking
      const existingDelivered = mission.deliveredCargo.find(d => d.resourceId === cargo.resourceId);
      if (existingDelivered) {
        existingDelivered.amount += cargo.amount;
      } else {
        mission.deliveredCargo.push({ ...cargo });
      }
    }

    mission.tripsCompleted++;

    // Check if there's more cargo to deliver
    const hasMoreCargo = mission.remainingCargo.some(c => c.amount > 0);

    if (hasMoreCargo) {
      // More trips needed - return to origin to pick up more
      console.log('[Colonization] More cargo to deliver, returning to origin');

      const origin = state.systems[mission.originSystemId];
      if (!origin) {
        console.error('[Colonization] Origin system not found!');
        this.cancelColonizationMission(ship);
        return;
      }

      const distance = getRouteDist(origin.coordinates, destination.coordinates);

      // Calculate fuel needed for empty return trip
      const returnFuelNeeded = calculateFuelCost(distance, 0, ship);
      const fuelAvailable = this.gameState.getSystemResource(destination.id, ResourceId.Fuel);

      // Check if we have fuel at destination for return trip
      if (fuelAvailable < returnFuelNeeded) {
        // Not enough fuel at destination - mark as stranded and wait
        console.log('[Colonization] Ship stranded at destination, waiting for fuel', { fuelAvailable, fuelNeeded: returnFuelNeeded });

        this.gameState.updateShip(shipId, {
          status: ShipStatus.Idle,
          currentSystemId: destination.id,
          destinationSystemId: undefined,
          departureTime: undefined,
          arrivalTime: undefined,
          currentCargo: [],
          colonizationMission: mission
        });

        this.gameState.addNotification({
          type: 'warning',
          title: 'Ship Stranded',
          message: `${ship.name} is stranded at ${destination.name} and needs ${returnFuelNeeded.toFixed(1)} fuel to return to ${origin.name} for more supplies.`
        });

        return;
      }

      // Deduct fuel for return trip
      this.gameState.removeResourceFromSystem(destination.id, ResourceId.Fuel, returnFuelNeeded);

      const travelTimeHours = calculateTravelTime(distance, ship);
      const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
      const now = Date.now();

      // Send ship back to origin (empty)
      this.gameState.updateShip(shipId, {
        status: ShipStatus.InTransit,
        currentSystemId: destination.id,
        destinationSystemId: origin.id,
        departureTime: now,
        arrivalTime: now + travelTimeMs,
        currentCargo: [],
        colonizationMission: mission
      });

      this.gameState.addNotification({
        type: 'info',
        title: 'Returning for More Supplies',
        message: `${ship.name} returning to ${origin.name} to pick up more colonization supplies.`
      });

    } else {
      // All cargo delivered - colonization complete!
      console.log('[Colonization] All cargo delivered, mission complete');

      // Mark system as colonized if not already
      if (!destination.colonized) {
        const initialPopulation = 100;

        this.gameState.updateSystem(destination.id, {
          colonized: true,
          totalPopulation: initialPopulation
        });

        // Build initial starport
        const starportBodyId = mission.starportBodyId || ship.colonizationTargetBodyId;
        if (starportBodyId) {
          const targetBody = state.bodies[starportBodyId];
          if (targetBody && targetBody.systemId === destination.id) {
            const built = this.constructionService.buildFacility(FacilityId.TradeOutpost, starportBodyId);
            if (built) {
              console.log('[Colonization] Initial starport built on', targetBody.name);
            } else {
              console.warn('[Colonization] Failed to build initial starport on', targetBody.name);
            }
          } else {
            console.warn('[Colonization] Invalid colonization target body', starportBodyId);
          }
        } else {
          // Fallback: build on first available body with orbital slots
          console.warn('[Colonization] No target body specified, using fallback');
          const bodiesWithOrbitalSlots = destination.bodyIds
            .map(id => state.bodies[id])
            .filter(b => b && b.orbitalSlots > 0);
          if (bodiesWithOrbitalSlots.length > 0) {
            const fallbackBody = bodiesWithOrbitalSlots[0];
            this.constructionService.buildFacility(FacilityId.TradeOutpost, fallbackBody.id);
            console.log('[Colonization] Built fallback starport on', fallbackBody.name);
          }
        }

        this.gameState.addNotification({
          type: 'success',
          title: 'System Colonized!',
          message: `${destination.name} is now colonized with ${initialPopulation} colonists and an initial Trade Outpost has been established! (${mission.tripsCompleted} trips completed)`,
          systemId: destination.id
        });
      } else {
        this.gameState.addNotification({
          type: 'success',
          title: 'Supplies Delivered',
          message: `${ship.name} has delivered all supplies to ${destination.name}. (${mission.tripsCompleted} trips)`,
          systemId: destination.id
        });
      }

      // Mission complete - clear colonization tracking
      this.gameState.updateShip(shipId, {
        status: ShipStatus.Idle,
        currentSystemId: destination.id,
        destinationSystemId: undefined,
        departureTime: undefined,
        arrivalTime: undefined,
        currentCargo: [],
        colonizationTargetBodyId: undefined,
        colonizationMission: undefined
      });
    }
  }

  /**
   * Handle ship arrival at origin - load next cargo batch and depart for destination
   */
  private handleArrivalAtOrigin(shipId: string): void {
    const state = this.gameState.getState();
    const ship = state.ships[shipId];
    if (!ship || !ship.colonizationMission) return;

    const mission = ship.colonizationMission;
    const origin = state.systems[mission.originSystemId];
    const destination = state.systems[mission.destinationSystemId];

    if (!origin || !destination) {
      console.error('[Colonization] Origin or destination system not found!');
      this.cancelColonizationMission(ship);
      return;
    }

    console.log('[Colonization] Ship arrived at origin, loading next batch', {
      shipId,
      remainingCargo: mission.remainingCargo
    });

    // Check if there's still cargo to deliver
    const hasMoreCargo = mission.remainingCargo.some(c => c.amount > 0);
    if (!hasMoreCargo) {
      // This shouldn't happen, but handle it gracefully
      console.warn('[Colonization] Ship arrived at origin but no cargo remaining');
      this.gameState.updateShip(shipId, {
        status: ShipStatus.Idle,
        currentSystemId: origin.id,
        destinationSystemId: undefined,
        departureTime: undefined,
        arrivalTime: undefined,
        currentCargo: [],
        colonizationMission: undefined
      });
      return;
    }

    // Calculate next trip cargo
    const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];
    const nextTripCargo: { resourceId: ResourceId; amount: number }[] = [];
    let cargoLoaded = 0;

    for (const item of mission.remainingCargo) {
      const spaceLeft = sizeDefinition.cargoCapacity - cargoLoaded;
      const amountToLoad = Math.min(item.amount, spaceLeft);

      if (amountToLoad > 0) {
        nextTripCargo.push({ resourceId: item.resourceId, amount: amountToLoad });
        cargoLoaded += amountToLoad;
      }

      if (cargoLoaded >= sizeDefinition.cargoCapacity) break;
    }

    // Calculate fuel for round trip
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const nextTripWeight = nextTripCargo.reduce((sum, c) => sum + c.amount, 0);
    const fuelNeeded = calculateFuelCost(distance, nextTripWeight, ship) * 2; // Round trip
    const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);

    if (fuelAvailable < fuelNeeded) {
      // Not enough fuel - wait at origin
      console.log('[Colonization] Waiting for fuel at origin', { fuelAvailable, fuelNeeded });

      mission.waitingForFuel = true;

      this.gameState.updateShip(shipId, {
        status: ShipStatus.Idle,
        currentSystemId: origin.id,
        destinationSystemId: undefined,
        departureTime: undefined,
        arrivalTime: undefined,
        currentCargo: [],
        colonizationMission: mission
      });

      this.gameState.addNotification({
        type: 'info',
        title: 'Waiting for Fuel',
        message: `${ship.name} arrived at ${origin.name} but needs ${fuelNeeded.toFixed(1)} fuel for next trip to ${destination.name}.`
      });

      return;
    }

    // Have fuel - deduct it and launch next trip
    this.gameState.removeResourceFromSystem(origin.id, ResourceId.Fuel, fuelNeeded);

    const travelTimeHours = calculateTravelTime(distance, ship);
    const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
    const now = Date.now();

    mission.waitingForFuel = false;

    this.gameState.updateShip(shipId, {
      status: ShipStatus.InTransit,
      currentSystemId: origin.id,
      destinationSystemId: destination.id,
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      currentCargo: nextTripCargo,
      colonizationMission: mission
    });

    this.gameState.addNotification({
      type: 'info',
      title: 'Next Colonization Trip',
      message: `${ship.name} departing with more supplies for ${destination.name}. Trip ${mission.tripsCompleted + 1}.`
    });
  }

  /**
   * Cancel a colonization mission and return cargo
   */
  private cancelColonizationMission(ship: Ship): void {
    if (!ship.colonizationMission) return;

    const mission = ship.colonizationMission;
    const origin = this.gameState.getState().systems[mission.originSystemId];

    if (origin) {
      // Return any remaining cargo that wasn't delivered
      for (const cargo of mission.remainingCargo) {
        this.gameState.addResourceToSystem(origin.id, cargo.resourceId, cargo.amount);
      }
    }

    this.gameState.updateShip(ship.id, {
      status: ShipStatus.Idle,
      colonizationMission: undefined,
      destinationSystemId: undefined,
      currentCargo: []
    });

    this.gameState.addNotification({
      type: 'warning',
      title: 'Mission Cancelled',
      message: `${ship.name}'s colonization mission was cancelled.`
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
