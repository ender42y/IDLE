import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import { ResourceId, RESOURCE_DEFINITIONS } from '../models/resource.model';
import {
  Ship,
  ShipStatus,
  TradeRoute,
  TradeTrip,
  TradeRouteLeg,
  SHIP_SIZE_DEFINITIONS,
  calculateFuelCost,
  calculateTravelTime
} from '../models/ship.model';
import { getRouteDist } from '../models/star-system.model';

@Injectable({
  providedIn: 'root'
})
export class TradeService {
  private gameState = inject(GameStateService);

  /**
   * Process active trade trips
   */
  processTick(deltaMs: number): void {
    const state = this.gameState.getState();
    const now = Date.now();

    // Check for completed trips
    for (const trip of Object.values(state.activeTrips)) {
      if (now >= trip.arrivalTime) {
        this.completeTrip(trip);
      }
    }

    // Start new trips for idle ships on routes
    for (const route of Object.values(state.tradeRoutes)) {
      if (!route.active) continue;

      for (const shipId of route.assignedShipIds) {
        const ship = state.ships[shipId];
        if (ship && ship.status === ShipStatus.Idle) {
          this.startTrip(route, ship);
        }
      }
    }
  }

  /**
   * Process trips that completed while offline
   */
  processOfflineTrips(offlineMs: number): void {
    const state = this.gameState.getState();
    const now = Date.now();

    for (const trip of Object.values(state.activeTrips)) {
      if (now >= trip.arrivalTime) {
        this.completeTrip(trip);
      }
    }
  }

  /**
   * Create a new trade route
   */
  createTradeRoute(
    name: string,
    originSystemId: string,
    destinationSystemId: string,
    outboundCargo: TradeRouteLeg[],
    returnCargo: TradeRouteLeg[]
  ): TradeRoute | null {
    const state = this.gameState.getState();
    const origin = state.systems[originSystemId];
    const destination = state.systems[destinationSystemId];

    if (!origin || !destination) {
      this.gameState.addNotification({
        type: 'danger',
        title: 'Route Failed',
        message: 'Invalid origin or destination system.'
      });
      return null;
    }

    // Both systems need trade stations
    if (!origin.hasTradeStation || !destination.hasTradeStation) {
      this.gameState.addNotification({
        type: 'danger',
        title: 'Route Failed',
        message: 'Both systems require trade stations.'
      });
      return null;
    }

    const route: TradeRoute = {
      id: this.gameState.generateId(),
      name,
      originSystemId,
      destinationSystemId,
      outboundCargo,
      returnCargo,
      assignedShipIds: [],
      active: true
    };

    this.gameState.addTradeRoute(route);

    this.gameState.addNotification({
      type: 'success',
      title: 'Route Created',
      message: `Trade route "${name}" established.`
    });

    return route;
  }

  /**
   * Assign a ship to a trade route
   */
  assignShipToRoute(shipId: string, routeId: string): boolean {
    const state = this.gameState.getState();
    const ship = state.ships[shipId];
    const route = state.tradeRoutes[routeId];

    if (!ship || !route) return false;

    // Check if ship is available
    if (ship.status !== ShipStatus.Idle) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Ship Busy',
        message: `${ship.name} is not available for assignment.`
      });
      return false;
    }

    // Check ship size vs trade station tier
    const origin = state.systems[route.originSystemId];
    const destination = state.systems[route.destinationSystemId];
    const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];

    if (origin.tradeStationTier < sizeDefinition.requiredTradeLevel ||
        destination.tradeStationTier < sizeDefinition.requiredTradeLevel) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Ship Too Large',
        message: `${ship.name} requires higher tier trade stations.`
      });
      return false;
    }

    // Add ship to route
    this.gameState.updateTradeRoute(routeId, {
      assignedShipIds: [...route.assignedShipIds, shipId]
    });

    return true;
  }

  /**
   * Remove a ship from a trade route
   */
  removeShipFromRoute(shipId: string, routeId: string): void {
    const route = this.gameState.getState().tradeRoutes[routeId];
    if (!route) return;

    this.gameState.updateTradeRoute(routeId, {
      assignedShipIds: route.assignedShipIds.filter(id => id !== shipId)
    });
  }

  /**
   * Start a trade trip
   */
  private startTrip(route: TradeRoute, ship: Ship): void {
    const state = this.gameState.getState();
    const origin = state.systems[route.originSystemId];
    const destination = state.systems[route.destinationSystemId];

    if (!origin || !destination) return;

    // Determine cargo (outbound from origin)
    const cargo: { resourceId: ResourceId; amount: number }[] = [];
    const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];
    let remainingCapacity = sizeDefinition.cargoCapacity;

    for (const leg of route.outboundCargo) {
      if (!leg.resourceId || leg.amount <= 0) continue;

      const available = this.gameState.getSystemResource(origin.id, leg.resourceId);
      const toLoad = Math.min(leg.amount, available, remainingCapacity);

      if (toLoad > 0) {
        this.gameState.removeResourceFromSystem(origin.id, leg.resourceId, toLoad);
        cargo.push({ resourceId: leg.resourceId, amount: toLoad });
        remainingCapacity -= toLoad;
      }
    }

    // Calculate fuel cost
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const cargoWeight = cargo.reduce((sum, c) => sum + c.amount, 0);
    const fuelNeeded = calculateFuelCost(distance, cargoWeight, ship);

    // Check fuel
    const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);
    if (fuelAvailable < fuelNeeded) {
      // Return cargo, can't launch
      for (const c of cargo) {
        this.gameState.addResourceToSystem(origin.id, c.resourceId, c.amount);
      }
      return;
    }

    // Consume fuel
    this.gameState.removeResourceFromSystem(origin.id, ResourceId.Fuel, fuelNeeded);

    // Calculate travel time
    const travelTimeHours = calculateTravelTime(distance, ship);
    const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
    const now = Date.now();

    // Create trip
    const trip: TradeTrip = {
      id: this.gameState.generateId(),
      routeId: route.id,
      shipId: ship.id,
      isOutbound: true,
      cargo,
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      fuelConsumed: fuelNeeded
    };

    // Update state
    this.gameState.updateShip(ship.id, {
      status: ShipStatus.InTransit,
      destinationSystemId: destination.id,
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      currentCargo: cargo
    });

    // Store active trip
    const gameState = this.gameState.getState();
    this.gameState['_gameState'].update(state => ({
      ...state,
      activeTrips: { ...state.activeTrips, [trip.id]: trip }
    }));
  }

  /**
   * Complete a trade trip
   */
  private completeTrip(trip: TradeTrip): void {
    const state = this.gameState.getState();
    const route = state.tradeRoutes[trip.routeId];
    const ship = state.ships[trip.shipId];

    if (!route || !ship) {
      // Clean up orphaned trip
      this.removeActiveTrip(trip.id);
      return;
    }

    // Determine destination
    const destinationId = trip.isOutbound ? route.destinationSystemId : route.originSystemId;

    // Deliver cargo
    for (const cargo of trip.cargo) {
      this.gameState.addResourceToSystem(destinationId, cargo.resourceId, cargo.amount);
    }

    // Update ship condition (wear from trip)
    const conditionLoss = 2; // Base condition loss per trip
    const newCondition = Math.max(0, ship.condition - conditionLoss);

    // Remove active trip
    this.removeActiveTrip(trip.id);

    // If round trip, start return leg
    if (trip.isOutbound) {
      // Load return cargo and start return trip
      const destination = state.systems[destinationId];
      const origin = state.systems[route.originSystemId];

      if (destination && origin) {
        const returnCargo: { resourceId: ResourceId; amount: number }[] = [];
        const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];
        let remainingCapacity = sizeDefinition.cargoCapacity;

        for (const leg of route.returnCargo) {
          if (!leg.resourceId || leg.amount <= 0) continue;

          const available = this.gameState.getSystemResource(destination.id, leg.resourceId);
          const toLoad = Math.min(leg.amount, available, remainingCapacity);

          if (toLoad > 0) {
            this.gameState.removeResourceFromSystem(destination.id, leg.resourceId, toLoad);
            returnCargo.push({ resourceId: leg.resourceId, amount: toLoad });
            remainingCapacity -= toLoad;
          }
        }

        // Calculate return trip
        const distance = getRouteDist(destination.coordinates, origin.coordinates);
        const cargoWeight = returnCargo.reduce((sum, c) => sum + c.amount, 0);
        const fuelNeeded = calculateFuelCost(distance, cargoWeight, ship);

        const fuelAvailable = this.gameState.getSystemResource(destination.id, ResourceId.Fuel);
        if (fuelAvailable >= fuelNeeded) {
          this.gameState.removeResourceFromSystem(destination.id, ResourceId.Fuel, fuelNeeded);

          const travelTimeHours = calculateTravelTime(distance, ship);
          const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
          const now = Date.now();

          const returnTrip: TradeTrip = {
            id: this.gameState.generateId(),
            routeId: route.id,
            shipId: ship.id,
            isOutbound: false,
            cargo: returnCargo,
            departureTime: now,
            arrivalTime: now + travelTimeMs,
            fuelConsumed: fuelNeeded
          };

          this.gameState.updateShip(ship.id, {
            status: ShipStatus.InTransit,
            condition: newCondition,
            currentSystemId: destination.id,
            destinationSystemId: origin.id,
            departureTime: now,
            arrivalTime: now + travelTimeMs,
            currentCargo: returnCargo
          });

          this.gameState['_gameState'].update(state => ({
            ...state,
            activeTrips: { ...state.activeTrips, [returnTrip.id]: returnTrip }
          }));

          return;
        }
      }
    }

    // Ship is now idle at destination
    this.gameState.updateShip(ship.id, {
      status: ShipStatus.Idle,
      condition: newCondition,
      currentSystemId: destinationId,
      destinationSystemId: undefined,
      departureTime: undefined,
      arrivalTime: undefined,
      currentCargo: []
    });
  }

  private removeActiveTrip(tripId: string): void {
    this.gameState['_gameState'].update(state => {
      const { [tripId]: removed, ...remaining } = state.activeTrips;
      return { ...state, activeTrips: remaining };
    });
  }

  /**
   * Sell resources to galactic market
   */
  sellToMarket(systemId: string, resourceId: ResourceId, amount: number): boolean {
    const state = this.gameState.getState();
    const available = this.gameState.getSystemResource(systemId, resourceId);

    if (available < amount) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Insufficient Resources',
        message: `Not enough ${RESOURCE_DEFINITIONS[resourceId].name} to sell.`
      });
      return false;
    }

    const price = state.marketPrices[resourceId]?.sell ?? 0;
    const credits = amount * price;

    this.gameState.removeResourceFromSystem(systemId, resourceId, amount);
    this.gameState.addCredits(credits);

    return true;
  }

  /**
   * Buy resources from galactic market
   */
  buyFromMarket(systemId: string, resourceId: ResourceId, amount: number): boolean {
    const state = this.gameState.getState();
    const price = state.marketPrices[resourceId]?.buy ?? 0;
    const cost = amount * price;

    if (state.credits < cost) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Insufficient Credits',
        message: `Need ${cost} credits to purchase.`
      });
      return false;
    }

    this.gameState.spendCredits(cost);
    this.gameState.addResourceToSystem(systemId, resourceId, amount);

    return true;
  }

  /**
   * Get estimated trip duration
   */
  getEstimatedTripDuration(originId: string, destinationId: string, shipId: string): number {
    const state = this.gameState.getState();
    const origin = state.systems[originId];
    const destination = state.systems[destinationId];
    const ship = state.ships[shipId];

    if (!origin || !destination || !ship) return 0;

    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    return calculateTravelTime(distance, ship);
  }
}
