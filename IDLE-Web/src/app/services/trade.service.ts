import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import { ResourceId, RESOURCE_DEFINITIONS } from '../models/resource.model';
import {
  Ship,
  ShipStatus,
  ShipType,
  TradeRoute,
  TradeTrip,
  TradeRouteLeg,
  TradeMission,
  TradeMissionType,
  SHIP_SIZE_DEFINITIONS,
  calculateFuelCost,
  calculateTravelTime
} from '../models/ship.model';
import { getRouteDist } from '../models/star-system.model';
import { FACILITY_DEFINITIONS, EconomyType } from '../models/facility.model';

/**
 * GDD v6 Section 15.7: Communications bonus structure
 * Applied when BOTH origin and destination have communications facilities.
 */
export interface CommsBonuses {
  travelTimeReduction: number;  // 0-1, percentage reduction in travel time
  fuelReduction: number;        // 0-1, percentage reduction in fuel cost
  reliabilityBonus: number;     // 0-1, percentage increase in reliability
}

/**
 * Manages trade operations including recurring routes, one-time missions,
 * and galactic market trading. Handles cargo loading, fuel consumption,
 * travel time calculation, and communications bonuses.
 *
 * Two Trade Types:
 * 1. Recurring Routes: Ships automatically make round trips, loading cargo at each end
 * 2. One-Time Missions (GDD v6): Single delivery or round-trip, ship released after
 *
 * Recurring Trade Routes:
 * - User configures outbound and return cargo manifests
 * - Ships assigned to route automatically execute round trips
 * - Cargo loaded up to ship capacity from configured amounts
 * - If insufficient cargo or fuel, ship waits until available
 * - Route can be paused/resumed by setting active flag
 * - Ship condition degrades 2% per trip
 *
 * One-Time Trade Missions (GDD v6 Section 16.3):
 * - One-way: Ship delivers and stays at destination
 * - Round-trip: Ship delivers, optionally loads return cargo, returns to origin
 * - Fuel reserved upfront for entire mission
 * - Ship released (Idle) when mission completes
 * - Used for colonization supply runs and special deliveries
 *
 * Trade Station Requirements:
 * - Both systems must have trade stations to create routes
 * - Ship size must match trade station tier:
 *   - Light ships: Tier 1+ (Trade Outpost)
 *   - Medium ships: Tier 2+ (Trade Station)
 *   - Heavy/Bulk ships: Tier 3 (Trade Hub)
 *
 * Cargo Loading:
 * - Cargo loaded from system storage up to ship capacity
 * - Partial loads allowed if insufficient resources
 * - Empty cargo legs allowed (deadhead runs)
 * - Cargo delivered to destination system storage on arrival
 *
 * Fuel Costs:
 * - Formula: distance × cargo_weight × ship_fuel_efficiency / efficiency_modifier
 * - Larger ships more fuel-efficient per tonne (economy of scale)
 * - Fuel consumed at departure, checked before loading cargo
 * - If no fuel, trip delayed until fuel available
 *
 * Communications Bonuses (GDD v6 Section 15.7):
 * - Applied when BOTH endpoints have comms facilities
 * - Uses MINIMUM tier between the two systems
 * - Tier 1 (Outpost): -5% travel, -5% fuel, +5% reliability
 * - Tier 2 (Station): -10% travel, -10% fuel, +10% reliability
 * - Tier 3 (Hub): -15% travel, -15% fuel, +15% reliability
 *
 * Galactic Market:
 * - Buy/sell resources for credits
 * - Prices fluctuate: sell = 75-90% of base, buy = 100% of base
 * - Instant transactions (no shipping time)
 * - Used for emergency resource acquisition or dumping surplus
 *
 * @see createTradeRoute for recurring route setup
 * @see sendOneWayMission for one-time deliveries
 * @see sendRoundTripMission for one-time round trips
 * @see getCommsBonuses for communications benefit calculation
 */
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
    this.gameState.addActiveTrip(trip);
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

          this.gameState.addActiveTrip(returnTrip);

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
    this.gameState.removeActiveTrip(tripId);
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

  // ========================================
  // GDD v6: One-Time Trade Missions
  // ========================================

  /**
   * Send a one-way trade mission (ship stays at destination)
   * GDD v6 Section 16.3
   */
  sendOneWayMission(
    shipId: string,
    destinationSystemId: string,
    cargo: { resourceId: ResourceId; amount: number }[]
  ): TradeMission | null {
    const state = this.gameState.getState();
    const ship = state.ships[shipId];
    const destination = state.systems[destinationSystemId];

    if (!ship || ship.type !== ShipType.Freighter) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Invalid Ship',
        message: 'Only freighter ships can transport cargo.'
      });
      return null;
    }

    if (ship.status !== ShipStatus.Idle) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Ship Busy',
        message: `${ship.name} is not available.`
      });
      return null;
    }

    const origin = state.systems[ship.currentSystemId];
    if (!origin || !destination) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Invalid Route',
        message: 'Invalid origin or destination system.'
      });
      return null;
    }

    // Validate cargo
    const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];
    const totalCargoWeight = cargo.reduce((sum, c) => sum + c.amount, 0);

    if (totalCargoWeight > sizeDefinition.cargoCapacity) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Cargo Too Heavy',
        message: `Cargo exceeds ship capacity of ${sizeDefinition.cargoCapacity}t.`
      });
      return null;
    }

    // Check cargo availability
    for (const item of cargo) {
      const available = this.gameState.getSystemResource(origin.id, item.resourceId);
      if (available < item.amount) {
        const name = RESOURCE_DEFINITIONS[item.resourceId]?.name ?? item.resourceId;
        this.gameState.addNotification({
          type: 'warning',
          title: 'Insufficient Resources',
          message: `Not enough ${name}. Have ${available.toFixed(0)}, need ${item.amount}.`
        });
        return null;
      }
    }

    // Calculate fuel (one-way only)
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const fuelNeeded = calculateFuelCost(distance, totalCargoWeight, ship);
    const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);

    if (fuelAvailable < fuelNeeded) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Insufficient Fuel',
        message: `Need ${fuelNeeded.toFixed(1)} fuel for this mission.`
      });
      return null;
    }

    // Deduct resources and fuel
    for (const item of cargo) {
      this.gameState.removeResourceFromSystem(origin.id, item.resourceId, item.amount);
    }
    this.gameState.removeResourceFromSystem(origin.id, ResourceId.Fuel, fuelNeeded);

    // Calculate travel time
    const travelTimeHours = calculateTravelTime(distance, ship);
    const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
    const now = Date.now();

    // Create mission
    const mission: TradeMission = {
      id: this.gameState.generateId(),
      shipId,
      missionType: TradeMissionType.OneWay,
      originSystemId: origin.id,
      destinationSystemId: destination.id,
      outboundCargo: [...cargo],
      status: 'outbound',
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      fuelConsumed: fuelNeeded,
      fuelReserved: fuelNeeded
    };

    // Store mission and update ship
    this.gameState.addTradeMission(mission);
    this.gameState.updateShip(shipId, {
      status: ShipStatus.InTransit,
      destinationSystemId: destination.id,
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      currentCargo: cargo,
      missionId: mission.id
    });

    this.gameState.addNotification({
      type: 'info',
      title: 'Mission Launched',
      message: `${ship.name} departing for ${destination.name}. ETA: ${this.formatHours(travelTimeHours)}`
    });

    return mission;
  }

  /**
   * Send a round-trip trade mission (ship returns to origin)
   * GDD v6 Section 16.3
   */
  sendRoundTripMission(
    shipId: string,
    destinationSystemId: string,
    outboundCargo: { resourceId: ResourceId; amount: number }[],
    returnCargo?: { resourceId: ResourceId; amount: number }[]
  ): TradeMission | null {
    const state = this.gameState.getState();
    const ship = state.ships[shipId];
    const destination = state.systems[destinationSystemId];

    if (!ship || ship.type !== ShipType.Freighter) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Invalid Ship',
        message: 'Only freighter ships can transport cargo.'
      });
      return null;
    }

    if (ship.status !== ShipStatus.Idle) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Ship Busy',
        message: `${ship.name} is not available.`
      });
      return null;
    }

    const origin = state.systems[ship.currentSystemId];
    if (!origin || !destination) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Invalid Route',
        message: 'Invalid origin or destination system.'
      });
      return null;
    }

    // Validate outbound cargo
    const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];
    const outboundWeight = outboundCargo.reduce((sum, c) => sum + c.amount, 0);

    if (outboundWeight > sizeDefinition.cargoCapacity) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Cargo Too Heavy',
        message: `Outbound cargo exceeds ship capacity of ${sizeDefinition.cargoCapacity}t.`
      });
      return null;
    }

    // Check outbound cargo availability
    for (const item of outboundCargo) {
      const available = this.gameState.getSystemResource(origin.id, item.resourceId);
      if (available < item.amount) {
        const name = RESOURCE_DEFINITIONS[item.resourceId]?.name ?? item.resourceId;
        this.gameState.addNotification({
          type: 'warning',
          title: 'Insufficient Resources',
          message: `Not enough ${name}. Have ${available.toFixed(0)}, need ${item.amount}.`
        });
        return null;
      }
    }

    // Calculate fuel for round trip
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const returnWeight = returnCargo?.reduce((sum, c) => sum + c.amount, 0) ?? 0;
    const outboundFuel = calculateFuelCost(distance, outboundWeight, ship);
    const returnFuel = calculateFuelCost(distance, returnWeight, ship);
    const totalFuelNeeded = outboundFuel + returnFuel;
    const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);

    if (fuelAvailable < totalFuelNeeded) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Insufficient Fuel',
        message: `Need ${totalFuelNeeded.toFixed(1)} fuel for round trip.`
      });
      return null;
    }

    // Deduct resources and fuel
    for (const item of outboundCargo) {
      this.gameState.removeResourceFromSystem(origin.id, item.resourceId, item.amount);
    }
    this.gameState.removeResourceFromSystem(origin.id, ResourceId.Fuel, totalFuelNeeded);

    // Calculate travel time
    const travelTimeHours = calculateTravelTime(distance, ship);
    const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
    const now = Date.now();

    // Create mission
    const mission: TradeMission = {
      id: this.gameState.generateId(),
      shipId,
      missionType: TradeMissionType.RoundTrip,
      originSystemId: origin.id,
      destinationSystemId: destination.id,
      outboundCargo: [...outboundCargo],
      returnCargo: returnCargo ? [...returnCargo] : undefined,
      status: 'outbound',
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      fuelConsumed: outboundFuel,
      fuelReserved: totalFuelNeeded
    };

    // Store mission and update ship
    this.gameState.addTradeMission(mission);
    this.gameState.updateShip(shipId, {
      status: ShipStatus.InTransit,
      destinationSystemId: destination.id,
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      currentCargo: outboundCargo,
      missionId: mission.id
    });

    const roundTripTime = travelTimeHours * 2;
    this.gameState.addNotification({
      type: 'info',
      title: 'Round Trip Launched',
      message: `${ship.name} departing for ${destination.name}. Round trip ETA: ${this.formatHours(roundTripTime)}`
    });

    return mission;
  }

  /**
   * Process one-time trade missions (called each tick)
   */
  processTradeMissions(deltaMs: number): void {
    const state = this.gameState.getState();
    const now = Date.now();

    for (const mission of Object.values(state.tradeMissions ?? {})) {
      if (mission.status === 'completed') continue;

      const ship = state.ships[mission.shipId];
      if (!ship) {
        // Ship no longer exists, cancel mission
        this.gameState.updateTradeMission(mission.id, { status: 'completed' });
        continue;
      }

      this.updateTradeMission(mission, ship, now);
    }
  }

  /**
   * Update a one-time trade mission
   */
  private updateTradeMission(mission: TradeMission, ship: Ship, now: number): void {
    const state = this.gameState.getState();

    switch (mission.status) {
      case 'outbound':
        if (mission.arrivalTime && now >= mission.arrivalTime) {
          // Arrived at destination - deliver cargo
          const destination = state.systems[mission.destinationSystemId];
          if (destination) {
            for (const cargo of mission.outboundCargo) {
              this.gameState.addResourceToSystem(destination.id, cargo.resourceId, cargo.amount);
            }
          }

          if (mission.missionType === TradeMissionType.OneWay) {
            // One-way complete - ship stays at destination
            this.gameState.updateTradeMission(mission.id, { status: 'completed' });
            this.gameState.updateShip(ship.id, {
              status: ShipStatus.Idle,
              currentSystemId: mission.destinationSystemId,
              destinationSystemId: undefined,
              departureTime: undefined,
              arrivalTime: undefined,
              currentCargo: [],
              missionId: undefined
            });

            this.gameState.addNotification({
              type: 'success',
              title: 'Delivery Complete',
              message: `${ship.name} has delivered cargo to ${destination?.name ?? 'destination'}.`
            });
          } else {
            // Round-trip - load return cargo and head back
            const returnCargo = mission.returnCargo ?? [];

            // Load return cargo from destination
            const actualReturnCargo: { resourceId: ResourceId; amount: number }[] = [];
            for (const item of returnCargo) {
              const available = this.gameState.getSystemResource(mission.destinationSystemId, item.resourceId);
              const toLoad = Math.min(item.amount, available);
              if (toLoad > 0) {
                this.gameState.removeResourceFromSystem(mission.destinationSystemId, item.resourceId, toLoad);
                actualReturnCargo.push({ resourceId: item.resourceId, amount: toLoad });
              }
            }

            const origin = state.systems[mission.originSystemId];
            const destination = state.systems[mission.destinationSystemId];
            if (!origin || !destination) return;

            const distance = getRouteDist(destination.coordinates, origin.coordinates);
            const travelTimeHours = calculateTravelTime(distance, ship);
            const travelTimeMs = travelTimeHours * 60 * 60 * 1000;

            this.gameState.updateTradeMission(mission.id, {
              status: 'returning',
              returnCargo: actualReturnCargo,
              returnDepartureTime: now,
              returnArrivalTime: now + travelTimeMs
            });

            this.gameState.updateShip(ship.id, {
              currentSystemId: mission.destinationSystemId,
              destinationSystemId: mission.originSystemId,
              departureTime: now,
              arrivalTime: now + travelTimeMs,
              currentCargo: actualReturnCargo
            });
          }
        }
        break;

      case 'returning':
        if (mission.returnArrivalTime && now >= mission.returnArrivalTime) {
          // Arrived back at origin - deliver return cargo
          const origin = state.systems[mission.originSystemId];
          if (origin && mission.returnCargo) {
            for (const cargo of mission.returnCargo) {
              this.gameState.addResourceToSystem(origin.id, cargo.resourceId, cargo.amount);
            }
          }

          // Mission complete
          this.gameState.updateTradeMission(mission.id, { status: 'completed' });
          this.gameState.updateShip(ship.id, {
            status: ShipStatus.Idle,
            currentSystemId: mission.originSystemId,
            destinationSystemId: undefined,
            departureTime: undefined,
            arrivalTime: undefined,
            currentCargo: [],
            missionId: undefined
          });

          this.gameState.addNotification({
            type: 'success',
            title: 'Round Trip Complete',
            message: `${ship.name} has returned to ${origin?.name ?? 'origin'}.`
          });
        }
        break;
    }
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

  // ========================================
  // GDD v6 Section 15.7: Communications Bonuses
  // ========================================

  /**
   * Get communications bonuses between two systems.
   * Bonuses only apply when BOTH endpoints have communications facilities.
   * Uses the MINIMUM tier between the two systems.
   */
  getCommsBonuses(originSystemId: string, destinationSystemId: string): CommsBonuses {
    const originComms = this.getSystemCommsTier(originSystemId);
    const destComms = this.getSystemCommsTier(destinationSystemId);

    // Both systems need comms for bonus to apply
    if (originComms === 0 || destComms === 0) {
      return { travelTimeReduction: 0, fuelReduction: 0, reliabilityBonus: 0 };
    }

    // Use minimum tier between the two systems
    const effectiveTier = Math.min(originComms, destComms);

    // Get bonuses from the corresponding comms facility
    const commsFacilities = [
      { tier: 1, bonuses: FACILITY_DEFINITIONS['comms_outpost']?.bonuses },
      { tier: 2, bonuses: FACILITY_DEFINITIONS['comms_station']?.bonuses },
      { tier: 3, bonuses: FACILITY_DEFINITIONS['comms_hub']?.bonuses }
    ];

    const facilityBonuses = commsFacilities.find(f => f.tier === effectiveTier)?.bonuses;

    return {
      travelTimeReduction: facilityBonuses?.commsTravelTimeReduction ?? 0,
      fuelReduction: facilityBonuses?.commsFuelReduction ?? 0,
      reliabilityBonus: facilityBonuses?.commsReliabilityBonus ?? 0
    };
  }

  /**
   * Get the highest communications tier available in a system
   * Returns 0 if no comms, 1-3 for tier level
   */
  private getSystemCommsTier(systemId: string): number {
    const state = this.gameState.getState();
    const system = state.systems[systemId];
    if (!system) return 0;

    let highestTier = 0;

    for (const bodyId of system.bodyIds) {
      const body = state.bodies[bodyId];
      if (!body) continue;

      for (const facilityId of body.facilityIds) {
        const facility = state.facilities[facilityId];
        if (!facility || !facility.operational) continue;

        const def = FACILITY_DEFINITIONS[facility.definitionId];
        if (def?.economy === EconomyType.Communications) {
          highestTier = Math.max(highestTier, def.tier);
        }
      }
    }

    return highestTier;
  }

  /**
   * Calculate travel time with communications bonus applied
   */
  calculateTravelTimeWithComms(originId: string, destinationId: string, ship: Ship): number {
    const baseTime = this.getEstimatedTripDuration(originId, destinationId, ship.id);
    const commsBonus = this.getCommsBonuses(originId, destinationId);
    return baseTime * (1 - commsBonus.travelTimeReduction);
  }

  /**
   * Calculate fuel cost with communications bonus applied
   */
  calculateFuelCostWithComms(
    originId: string,
    destinationId: string,
    cargoWeight: number,
    ship: Ship
  ): number {
    const state = this.gameState.getState();
    const origin = state.systems[originId];
    const destination = state.systems[destinationId];
    if (!origin || !destination) return 0;

    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const baseFuel = calculateFuelCost(distance, cargoWeight, ship);
    const commsBonus = this.getCommsBonuses(originId, destinationId);
    return baseFuel * (1 - commsBonus.fuelReduction);
  }
}
