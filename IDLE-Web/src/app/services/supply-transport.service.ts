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
import {
  TransportMission,
  TransportMissionType,
  TransportMissionStatus,
  TransportMissionPhase,
  TransportWaitReason,
  TransportCargoItem,
  TransportMissionValidation,
  createEmptyCargoItem,
  getCargoWeight
} from '../models/transport-mission.model';
import { debugLog } from '../config/testing.config';

/**
 * GDD v6 Section 15: Supply Transport & Logistics Service
 *
 * Manages resource movement between star systems via three mission types:
 *
 * 1. One-Way Missions (Section 15.4.1):
 *    - Cargo reserved upfront from origin
 *    - Fuel consumed from origin at departure
 *    - Ship becomes Idle at destination after delivery
 *
 * 2. Round-Trip Missions (Section 15.4.2):
 *    - Outbound cargo reserved from origin
 *    - Return cargo reserved from destination
 *    - ALL fuel reserved from origin (both legs)
 *    - Ship returns to origin after delivery
 *
 * 3. Recurring Routes (Section 15.5):
 *    - JIT cargo loading (no upfront reservation)
 *    - Fuel consumed per-leg from departure system
 *    - Partial loading: depart with partial cargo if some available, wait if zero
 *    - Full storage: ship waits with cargo if destination is full
 *    - Route cancellation: complete current leg, then Idle
 *    - Loops indefinitely until cancelled or stranded
 *
 * Storage Model (Section 15.2):
 *    - System-level shared storage pools
 *    - Storage capacity = sum of all trade facility capacities
 *    - Ships dock at any appropriate-tier station
 *
 * Fuel Formula (Section 15.6):
 *    fuel_cost = distance x cargo_weight x ship_fuel_efficiency / ship_efficiency_modifier
 *    - One-way: fuel from origin for loaded cargo
 *    - Round-trip: ALL fuel from origin (heaviest leg x 2 direction approach)
 *    - Recurring: fuel from departure system per leg
 *
 * @see TransportMission for the mission state model
 * @see TransportMissionType for mission type details
 */
@Injectable({
  providedIn: 'root'
})
export class SupplyTransportService {
  private gameState = inject(GameStateService);

  // ========================================
  // Mission Creation
  // ========================================

  /**
   * Create and launch a one-way transport mission.
   * Ship delivers cargo to destination and becomes Idle there.
   * All cargo and fuel reserved upfront from origin.
   *
   * GDD Section 15.4.1
   */
  createOneWayMission(
    shipId: string,
    destinationSystemId: string,
    cargo: { resourceId: ResourceId; amount: number }[]
  ): boolean {
    const validation = this.validateMission(
      shipId, destinationSystemId, cargo, [], TransportMissionType.OneWay
    );
    if (!validation.valid) {
      for (const error of validation.errors) {
        this.gameState.addNotification({
          type: 'warning',
          title: 'Mission Failed',
          message: error
        });
      }
      return false;
    }

    // Show warnings but proceed
    for (const warning of validation.warnings) {
      this.gameState.addNotification({
        type: 'info',
        title: 'Mission Warning',
        message: warning
      });
    }

    const state = this.gameState.getState();
    const ship = state.ships[shipId];
    const origin = state.systems[ship.currentSystemId];
    const destination = state.systems[destinationSystemId];

    // Reserve cargo from origin
    for (const item of cargo) {
      this.gameState.removeResourceFromSystem(origin.id, item.resourceId, item.amount);
    }

    // Calculate and consume fuel
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const cargoWeight = cargo.reduce((sum, c) => sum + c.amount, 0);
    const fuelCost = calculateFuelCost(distance, cargoWeight, ship);
    this.gameState.removeResourceFromSystem(origin.id, ResourceId.Fuel, fuelCost);

    // Calculate travel time
    const travelTimeHours = calculateTravelTime(distance, ship);
    const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
    const now = Date.now();

    // Build cargo items for mission
    const missionCargo: TransportCargoItem[] = cargo.map(c => ({
      resourceId: c.resourceId,
      requestedAmount: c.amount,
      loadedAmount: c.amount
    }));

    // Create mission
    const mission: TransportMission = {
      id: this.gameState.generateId(),
      shipId,
      missionType: TransportMissionType.OneWay,
      originSystemId: origin.id,
      destinationSystemId: destination.id,
      outboundCargo: missionCargo,
      returnCargo: [],
      status: TransportMissionStatus.Active,
      phase: TransportMissionPhase.InTransitToDestination,
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      currentCargo: [...missionCargo],
      tripsCompleted: 0,
      totalFuelConsumed: fuelCost,
      createdAt: now
    };

    // Save mission
    this.gameState.addTransportMission(mission);

    // Update ship
    this.gameState.updateShip(shipId, {
      status: ShipStatus.InTransit,
      destinationSystemId: destination.id,
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      currentCargo: cargo.map(c => ({ resourceId: c.resourceId, amount: c.amount })),
      missionId: mission.id
    });

    debugLog('SupplyTransport', 'One-way mission created', {
      missionId: mission.id,
      ship: ship.name,
      origin: origin.name,
      destination: destination.name,
      cargo,
      fuelCost
    });

    this.gameState.addNotification({
      type: 'info',
      title: 'Mission Launched',
      message: `${ship.name} departing for ${destination.name} with cargo. ETA: ${this.formatHours(travelTimeHours)}`
    });

    return true;
  }

  /**
   * Create and launch a round-trip transport mission.
   * Ship delivers outbound cargo, loads return cargo, returns to origin.
   * ALL cargo and fuel reserved upfront.
   *
   * GDD Section 15.4.2
   */
  createRoundTripMission(
    shipId: string,
    destinationSystemId: string,
    outboundCargo: { resourceId: ResourceId; amount: number }[],
    returnCargo: { resourceId: ResourceId; amount: number }[]
  ): boolean {
    const validation = this.validateMission(
      shipId, destinationSystemId, outboundCargo, returnCargo, TransportMissionType.RoundTrip
    );
    if (!validation.valid) {
      for (const error of validation.errors) {
        this.gameState.addNotification({
          type: 'warning',
          title: 'Mission Failed',
          message: error
        });
      }
      return false;
    }

    for (const warning of validation.warnings) {
      this.gameState.addNotification({
        type: 'info',
        title: 'Mission Warning',
        message: warning
      });
    }

    const state = this.gameState.getState();
    const ship = state.ships[shipId];
    const origin = state.systems[ship.currentSystemId];
    const destination = state.systems[destinationSystemId];

    // Reserve outbound cargo from origin
    for (const item of outboundCargo) {
      this.gameState.removeResourceFromSystem(origin.id, item.resourceId, item.amount);
    }

    // Reserve return cargo from destination
    for (const item of returnCargo) {
      this.gameState.removeResourceFromSystem(destination.id, item.resourceId, item.amount);
    }

    // Calculate fuel for ENTIRE round trip from origin
    // GDD 15.6.2: Round-trip fuel = both legs, calculated for heaviest leg
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const outboundWeight = outboundCargo.reduce((sum, c) => sum + c.amount, 0);
    const returnWeight = returnCargo.reduce((sum, c) => sum + c.amount, 0);
    const outboundFuel = calculateFuelCost(distance, outboundWeight, ship);
    const returnFuel = calculateFuelCost(distance, returnWeight, ship);
    const totalFuel = outboundFuel + returnFuel;
    this.gameState.removeResourceFromSystem(origin.id, ResourceId.Fuel, totalFuel);

    // Calculate travel time for one leg
    const travelTimeHours = calculateTravelTime(distance, ship);
    const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
    const now = Date.now();

    // Build cargo items
    const outboundCargoItems: TransportCargoItem[] = outboundCargo.map(c => ({
      resourceId: c.resourceId,
      requestedAmount: c.amount,
      loadedAmount: c.amount
    }));
    const returnCargoItems: TransportCargoItem[] = returnCargo.map(c => ({
      resourceId: c.resourceId,
      requestedAmount: c.amount,
      loadedAmount: c.amount
    }));

    // Create mission
    const mission: TransportMission = {
      id: this.gameState.generateId(),
      shipId,
      missionType: TransportMissionType.RoundTrip,
      originSystemId: origin.id,
      destinationSystemId: destination.id,
      outboundCargo: outboundCargoItems,
      returnCargo: returnCargoItems,
      status: TransportMissionStatus.Active,
      phase: TransportMissionPhase.InTransitToDestination,
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      currentCargo: [...outboundCargoItems],
      tripsCompleted: 0,
      totalFuelConsumed: totalFuel,
      createdAt: now
    };

    this.gameState.addTransportMission(mission);

    this.gameState.updateShip(shipId, {
      status: ShipStatus.InTransit,
      destinationSystemId: destination.id,
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      currentCargo: outboundCargo.map(c => ({ resourceId: c.resourceId, amount: c.amount })),
      missionId: mission.id
    });

    debugLog('SupplyTransport', 'Round-trip mission created', {
      missionId: mission.id,
      ship: ship.name,
      origin: origin.name,
      destination: destination.name,
      outboundCargo,
      returnCargo,
      totalFuel
    });

    const roundTripTime = travelTimeHours * 2;
    this.gameState.addNotification({
      type: 'info',
      title: 'Round Trip Launched',
      message: `${ship.name} departing for ${destination.name}. Round trip ETA: ${this.formatHours(roundTripTime)}`
    });

    return true;
  }

  /**
   * Create and activate a recurring trade route for a ship.
   * JIT cargo loading -- no resources reserved upfront.
   * Ship begins first cycle immediately by loading at origin.
   *
   * GDD Section 15.5
   */
  createRecurringRoute(
    shipId: string,
    destinationSystemId: string,
    outboundCargo: { resourceId: ResourceId; amount: number }[],
    returnCargo: { resourceId: ResourceId; amount: number }[]
  ): boolean {
    const validation = this.validateMission(
      shipId, destinationSystemId, outboundCargo, returnCargo, TransportMissionType.RecurringRoute
    );
    if (!validation.valid) {
      for (const error of validation.errors) {
        this.gameState.addNotification({
          type: 'warning',
          title: 'Route Failed',
          message: error
        });
      }
      return false;
    }

    for (const warning of validation.warnings) {
      this.gameState.addNotification({
        type: 'info',
        title: 'Route Warning',
        message: warning
      });
    }

    const state = this.gameState.getState();
    const ship = state.ships[shipId];
    const origin = state.systems[ship.currentSystemId];
    const destination = state.systems[destinationSystemId];

    const now = Date.now();

    // Build cargo configurations (requested amounts, loadedAmount starts at 0 until JIT)
    const outboundCargoItems: TransportCargoItem[] = outboundCargo.map(c =>
      createEmptyCargoItem(c.resourceId, c.amount)
    );
    const returnCargoItems: TransportCargoItem[] = returnCargo.map(c =>
      createEmptyCargoItem(c.resourceId, c.amount)
    );

    // Create mission in preparing phase -- processTick will handle JIT loading
    const mission: TransportMission = {
      id: this.gameState.generateId(),
      shipId,
      missionType: TransportMissionType.RecurringRoute,
      originSystemId: origin.id,
      destinationSystemId: destination.id,
      outboundCargo: outboundCargoItems,
      returnCargo: returnCargoItems,
      status: TransportMissionStatus.Active,
      phase: TransportMissionPhase.AtOriginPreparingOutbound,
      currentCargo: [],
      tripsCompleted: 0,
      totalFuelConsumed: 0,
      createdAt: now
    };

    this.gameState.addTransportMission(mission);

    // Link ship to mission (ship stays Idle until JIT loading completes in processTick)
    this.gameState.updateShip(shipId, {
      missionId: mission.id
    });

    debugLog('SupplyTransport', 'Recurring route created', {
      missionId: mission.id,
      ship: ship.name,
      origin: origin.name,
      destination: destination.name,
      outboundCargo,
      returnCargo
    });

    this.gameState.addNotification({
      type: 'success',
      title: 'Trade Route Activated',
      message: `${ship.name} assigned to route: ${origin.name} <-> ${destination.name}`
    });

    return true;
  }

  // ========================================
  // Mission Tick Processing
  // ========================================

  /**
   * Process all active transport missions (called each game tick).
   * Handles arrivals, JIT loading, waiting-state checks, and departures.
   */
  processTick(deltaMs: number): void {
    const state = this.gameState.getState();
    const now = Date.now();

    for (const mission of Object.values(state.transportMissions)) {
      if (mission.status === TransportMissionStatus.Completed) continue;

      const ship = state.ships[mission.shipId];
      if (!ship) {
        // Ship no longer exists, clean up mission
        this.gameState.updateTransportMission(mission.id, {
          status: TransportMissionStatus.Completed
        });
        continue;
      }

      switch (mission.phase) {
        case TransportMissionPhase.InTransitToDestination:
          this.processInTransitToDestination(mission, ship, now);
          break;

        case TransportMissionPhase.AtDestinationUnloadingAndPreparing:
          this.processAtDestination(mission, ship, now);
          break;

        case TransportMissionPhase.InTransitToOrigin:
          this.processInTransitToOrigin(mission, ship, now);
          break;

        case TransportMissionPhase.AtOriginUnloading:
          this.processAtOriginUnloading(mission, ship, now);
          break;

        case TransportMissionPhase.AtOriginPreparingOutbound:
          this.processAtOriginPreparing(mission, ship, now);
          break;
      }
    }
  }

  // ========================================
  // Phase Processing: In Transit to Destination
  // ========================================

  /**
   * Check if ship has arrived at destination.
   */
  private processInTransitToDestination(
    mission: TransportMission, ship: Ship, now: number
  ): void {
    if (!mission.arrivalTime || now < mission.arrivalTime) return;

    debugLog('SupplyTransport', 'Ship arrived at destination', {
      mission: mission.id,
      ship: ship.name
    });

    // Ship arrived -- begin unloading
    this.gameState.updateShip(ship.id, {
      status: ShipStatus.Idle,
      currentSystemId: mission.destinationSystemId,
      destinationSystemId: undefined,
      departureTime: undefined,
      arrivalTime: undefined
    });

    this.gameState.updateTransportMission(mission.id, {
      phase: TransportMissionPhase.AtDestinationUnloadingAndPreparing,
      departureTime: undefined,
      arrivalTime: undefined
    });
  }

  // ========================================
  // Phase Processing: At Destination
  // ========================================

  /**
   * Handle unloading outbound cargo, loading return cargo, and departing.
   * GDD 15.5.2 Phase 2/3 and 15.4.3 storage overflow.
   */
  private processAtDestination(
    mission: TransportMission, ship: Ship, now: number
  ): void {
    const state = this.gameState.getState();
    const destination = state.systems[mission.destinationSystemId];
    const origin = state.systems[mission.originSystemId];
    if (!destination || !origin) return;

    // Step 1: Try to unload cargo
    if (mission.currentCargo.length > 0) {
      const unloadResult = this.tryUnloadCargo(mission, destination.id);
      if (!unloadResult.allUnloaded) {
        // Still have cargo on ship -- waiting for storage space
        if (mission.status !== TransportMissionStatus.Waiting ||
            mission.waitReason !== TransportWaitReason.WaitingForStorageSpace) {
          this.gameState.updateTransportMission(mission.id, {
            status: TransportMissionStatus.Waiting,
            waitReason: TransportWaitReason.WaitingForStorageSpace,
            currentCargo: unloadResult.remainingCargo
          });
          this.gameState.addNotification({
            type: 'warning',
            title: 'Storage Full',
            message: `Storage full at ${destination.name}--${ship.name} waiting to unload.`,
            systemId: destination.id
          });
        }
        // If cancelling and waiting to unload, just idle with cargo
        if (mission.status === TransportMissionStatus.Cancelling) {
          this.completeMission(mission, ship);
        }
        return;
      }
      // Update mission -- cargo fully unloaded
      this.gameState.updateTransportMission(mission.id, {
        currentCargo: [],
        status: TransportMissionStatus.Active,
        waitReason: undefined,
        waitingForResource: undefined
      });
    }

    // Handle cancellation: cargo delivered, now idle at destination
    if (mission.status === TransportMissionStatus.Cancelling) {
      this.completeMission(mission, ship);
      return;
    }

    // Step 2: Determine next action based on mission type
    if (mission.missionType === TransportMissionType.OneWay) {
      // One-way complete -- ship idle at destination
      this.completeMission(mission, ship);
      this.gameState.addNotification({
        type: 'success',
        title: 'Delivery Complete',
        message: `${ship.name} has delivered cargo to ${destination.name}.`
      });
      return;
    }

    // Round-trip or Recurring: load return cargo and depart for origin
    const loadResult = this.loadCargo(
      mission, destination.id, mission.returnCargo, ship
    );

    if (loadResult.waiting) {
      // Waiting for return cargo
      if (mission.status !== TransportMissionStatus.Waiting ||
          mission.waitReason !== TransportWaitReason.WaitingForCargo) {
        this.gameState.updateTransportMission(mission.id, {
          status: TransportMissionStatus.Waiting,
          waitReason: TransportWaitReason.WaitingForCargo,
          waitingForResource: loadResult.waitingForResource
        });
        this.gameState.addNotification({
          type: 'info',
          title: 'Waiting for Cargo',
          message: `${ship.name} waiting for return cargo at ${destination.name}.`,
          systemId: destination.id
        });
      }
      return;
    }

    // Check fuel for return leg (consumed from destination for recurring, already consumed for round-trip)
    if (mission.missionType === TransportMissionType.RecurringRoute) {
      const distance = getRouteDist(destination.coordinates, origin.coordinates);
      const returnWeight = getCargoWeight(loadResult.loadedCargo);
      const fuelCost = calculateFuelCost(distance, returnWeight, ship);
      const fuelAvailable = this.gameState.getSystemResource(destination.id, ResourceId.Fuel);

      if (fuelAvailable < fuelCost) {
        if (mission.status !== TransportMissionStatus.Waiting ||
            mission.waitReason !== TransportWaitReason.WaitingForFuel) {
          this.gameState.updateTransportMission(mission.id, {
            status: TransportMissionStatus.Waiting,
            waitReason: TransportWaitReason.WaitingForFuel,
            currentCargo: loadResult.loadedCargo
          });
          this.gameState.addNotification({
            type: 'info',
            title: 'Waiting for Fuel',
            message: `${ship.name} waiting for ${fuelCost.toFixed(1)} fuel at ${destination.name}.`,
            systemId: destination.id
          });
        }
        return;
      }

      // Consume fuel from destination
      this.gameState.removeResourceFromSystem(destination.id, ResourceId.Fuel, fuelCost);
      this.gameState.updateTransportMission(mission.id, {
        totalFuelConsumed: mission.totalFuelConsumed + fuelCost
      });
    }
    // Round-trip: fuel already consumed from origin at mission start

    // Depart for origin
    this.departForOrigin(mission, ship, loadResult.loadedCargo, now);
  }

  // ========================================
  // Phase Processing: In Transit to Origin
  // ========================================

  /**
   * Check if ship has arrived back at origin.
   */
  private processInTransitToOrigin(
    mission: TransportMission, ship: Ship, now: number
  ): void {
    if (!mission.arrivalTime || now < mission.arrivalTime) return;

    debugLog('SupplyTransport', 'Ship arrived at origin', {
      mission: mission.id,
      ship: ship.name
    });

    this.gameState.updateShip(ship.id, {
      status: ShipStatus.Idle,
      currentSystemId: mission.originSystemId,
      destinationSystemId: undefined,
      departureTime: undefined,
      arrivalTime: undefined
    });

    if (mission.missionType === TransportMissionType.RoundTrip) {
      // Round-trip: unload return cargo at origin then complete
      this.gameState.updateTransportMission(mission.id, {
        phase: TransportMissionPhase.AtOriginUnloading,
        departureTime: undefined,
        arrivalTime: undefined
      });
    } else {
      // Recurring route: unload then start next cycle
      this.gameState.updateTransportMission(mission.id, {
        phase: TransportMissionPhase.AtOriginUnloading,
        departureTime: undefined,
        arrivalTime: undefined
      });
    }
  }

  // ========================================
  // Phase Processing: At Origin Unloading
  // ========================================

  /**
   * Unload return cargo at origin, then either complete (round-trip) or
   * start next cycle (recurring).
   */
  private processAtOriginUnloading(
    mission: TransportMission, ship: Ship, now: number
  ): void {
    const state = this.gameState.getState();
    const origin = state.systems[mission.originSystemId];
    if (!origin) return;

    // Try to unload return cargo
    if (mission.currentCargo.length > 0) {
      const unloadResult = this.tryUnloadCargo(mission, origin.id);
      if (!unloadResult.allUnloaded) {
        if (mission.status !== TransportMissionStatus.Waiting ||
            mission.waitReason !== TransportWaitReason.WaitingForStorageSpace) {
          this.gameState.updateTransportMission(mission.id, {
            status: TransportMissionStatus.Waiting,
            waitReason: TransportWaitReason.WaitingForStorageSpace,
            currentCargo: unloadResult.remainingCargo
          });
          this.gameState.addNotification({
            type: 'warning',
            title: 'Storage Full',
            message: `Storage full at ${origin.name}--${ship.name} waiting to unload.`,
            systemId: origin.id
          });
        }
        // If cancelling, become idle with cargo
        if (mission.status === TransportMissionStatus.Cancelling) {
          this.completeMission(mission, ship);
        }
        return;
      }
      this.gameState.updateTransportMission(mission.id, {
        currentCargo: [],
        status: TransportMissionStatus.Active,
        waitReason: undefined,
        waitingForResource: undefined
      });
    }

    // Handle cancellation: cargo unloaded, now idle
    if (mission.status === TransportMissionStatus.Cancelling) {
      this.completeMission(mission, ship);
      return;
    }

    // Increment trips completed
    const newTripsCompleted = mission.tripsCompleted + 1;

    if (mission.missionType === TransportMissionType.RoundTrip) {
      // Round-trip complete
      this.gameState.updateTransportMission(mission.id, {
        tripsCompleted: newTripsCompleted,
        status: TransportMissionStatus.Completed,
        phase: TransportMissionPhase.AtOriginUnloading
      });

      this.gameState.updateShip(ship.id, {
        status: ShipStatus.Idle,
        missionId: undefined,
        currentCargo: []
      });

      this.gameState.addNotification({
        type: 'success',
        title: 'Round Trip Complete',
        message: `${ship.name} has returned to ${origin.name}.`
      });

    } else if (mission.missionType === TransportMissionType.RecurringRoute) {
      // Start next cycle
      debugLog('SupplyTransport', 'Starting next cycle', {
        mission: mission.id,
        tripsCompleted: newTripsCompleted
      });

      this.gameState.updateTransportMission(mission.id, {
        tripsCompleted: newTripsCompleted,
        phase: TransportMissionPhase.AtOriginPreparingOutbound,
        status: TransportMissionStatus.Active,
        waitReason: undefined,
        waitingForResource: undefined
      });
    }
  }

  // ========================================
  // Phase Processing: At Origin Preparing Outbound
  // ========================================

  /**
   * JIT loading of outbound cargo and fuel check for recurring routes.
   * GDD 15.5.2 Phase 1.
   */
  private processAtOriginPreparing(
    mission: TransportMission, ship: Ship, now: number
  ): void {
    // Only recurring routes use this phase
    if (mission.missionType !== TransportMissionType.RecurringRoute) return;

    // Handle cancellation: ship is idle at origin, just complete
    if (mission.status === TransportMissionStatus.Cancelling) {
      this.completeMission(mission, ship);
      return;
    }

    const state = this.gameState.getState();
    const origin = state.systems[mission.originSystemId];
    const destination = state.systems[mission.destinationSystemId];
    if (!origin || !destination) return;

    // JIT load outbound cargo
    const loadResult = this.loadCargo(
      mission, origin.id, mission.outboundCargo, ship
    );

    if (loadResult.waiting) {
      // No cargo available -- wait
      if (mission.status !== TransportMissionStatus.Waiting ||
          mission.waitReason !== TransportWaitReason.WaitingForCargo) {
        this.gameState.updateTransportMission(mission.id, {
          status: TransportMissionStatus.Waiting,
          waitReason: TransportWaitReason.WaitingForCargo,
          waitingForResource: loadResult.waitingForResource
        });
        this.gameState.addNotification({
          type: 'info',
          title: 'Waiting for Cargo',
          message: `${ship.name} waiting for cargo at ${origin.name}.`,
          systemId: origin.id
        });
      }
      return;
    }

    // Calculate fuel cost based on ACTUAL loaded cargo weight
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const outboundWeight = getCargoWeight(loadResult.loadedCargo);
    const fuelCost = calculateFuelCost(distance, outboundWeight, ship);
    const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);

    if (fuelAvailable < fuelCost) {
      // Waiting for fuel -- return loaded cargo to storage
      for (const item of loadResult.loadedCargo) {
        if (item.loadedAmount > 0) {
          this.gameState.addResourceToSystem(origin.id, item.resourceId, item.loadedAmount);
        }
      }

      if (mission.status !== TransportMissionStatus.Waiting ||
          mission.waitReason !== TransportWaitReason.WaitingForFuel) {
        this.gameState.updateTransportMission(mission.id, {
          status: TransportMissionStatus.Waiting,
          waitReason: TransportWaitReason.WaitingForFuel,
          currentCargo: []
        });
        this.gameState.addNotification({
          type: 'info',
          title: 'Waiting for Fuel',
          message: `${ship.name} waiting for ${fuelCost.toFixed(1)} fuel at ${origin.name}.`,
          systemId: origin.id
        });
      }
      return;
    }

    // Consume fuel from origin
    this.gameState.removeResourceFromSystem(origin.id, ResourceId.Fuel, fuelCost);

    // Depart for destination
    this.departForDestination(mission, ship, loadResult.loadedCargo, fuelCost, now);
  }

  // ========================================
  // Route Cancellation
  // ========================================

  /**
   * Cancel a transport mission/route.
   * GDD Section 15.5.7:
   * - InTransit: complete current leg, then Idle
   * - Idle (waiting): immediately Idle, route cleared
   * - Carrying cargo: deliver before Idle (no waste)
   * - Waiting to unload (full storage): Idle with cargo still aboard
   */
  cancelMission(missionId: string): boolean {
    const mission = this.gameState.getTransportMission(missionId);
    if (!mission) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Cancel Failed',
        message: 'Mission not found.'
      });
      return false;
    }

    if (mission.status === TransportMissionStatus.Completed) {
      return false;
    }

    const state = this.gameState.getState();
    const ship = state.ships[mission.shipId];
    if (!ship) {
      this.gameState.updateTransportMission(missionId, {
        status: TransportMissionStatus.Completed
      });
      return true;
    }

    debugLog('SupplyTransport', 'Cancelling mission', {
      missionId,
      phase: mission.phase,
      status: mission.status,
      shipName: ship.name
    });

    // If ship is InTransit, mark as cancelling -- will complete current leg first
    if (mission.phase === TransportMissionPhase.InTransitToDestination ||
        mission.phase === TransportMissionPhase.InTransitToOrigin) {
      this.gameState.updateTransportMission(missionId, {
        status: TransportMissionStatus.Cancelling
      });
      this.gameState.addNotification({
        type: 'info',
        title: 'Route Cancelling',
        message: `${ship.name} will complete current leg before stopping.`
      });
      return true;
    }

    // If waiting for storage with cargo on board, idle with cargo
    if (mission.waitReason === TransportWaitReason.WaitingForStorageSpace &&
        mission.currentCargo.length > 0) {
      this.completeMission(mission, ship);
      return true;
    }

    // If idle/waiting (no transit), complete immediately
    this.completeMission(mission, ship);

    this.gameState.addNotification({
      type: 'info',
      title: 'Route Cancelled',
      message: `${ship.name} is now idle at ${this.getSystemName(ship.currentSystemId)}.`
    });

    return true;
  }

  // ========================================
  // Cargo Loading and Unloading
  // ========================================

  /**
   * JIT load cargo from a system's storage.
   * GDD 15.5.3/15.5.4: Load what's available, wait if all zero.
   *
   * @returns loadedCargo items and whether ship should wait
   */
  private loadCargo(
    mission: TransportMission,
    systemId: string,
    cargoConfig: TransportCargoItem[],
    ship: Ship
  ): {
    loadedCargo: TransportCargoItem[];
    waiting: boolean;
    waitingForResource?: ResourceId;
  } {
    // If no cargo configured, proceed immediately with empty load
    if (cargoConfig.length === 0 || cargoConfig.every(c => c.requestedAmount === 0)) {
      return { loadedCargo: [], waiting: false };
    }

    const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];
    let remainingCapacity = sizeDefinition.cargoCapacity;
    const loadedCargo: TransportCargoItem[] = [];
    let anyLoaded = false;
    let firstZeroResource: ResourceId | undefined;

    for (const config of cargoConfig) {
      if (config.requestedAmount <= 0) continue;

      const available = this.gameState.getSystemResource(systemId, config.resourceId);
      const toLoad = Math.min(config.requestedAmount, available, remainingCapacity);

      if (toLoad > 0) {
        this.gameState.removeResourceFromSystem(systemId, config.resourceId, toLoad);
        loadedCargo.push({
          resourceId: config.resourceId,
          requestedAmount: config.requestedAmount,
          loadedAmount: toLoad
        });
        remainingCapacity -= toLoad;
        anyLoaded = true;
      } else if (!firstZeroResource) {
        firstZeroResource = config.resourceId;
      }
    }

    // GDD 15.5.4: If 0t available for ALL resources, ship waits
    // Partial loading is fine -- depart with what we have
    if (!anyLoaded) {
      return {
        loadedCargo: [],
        waiting: true,
        waitingForResource: firstZeroResource
      };
    }

    return { loadedCargo, waiting: false };
  }

  /**
   * Try to unload cargo from ship to system storage.
   * GDD 15.4.3/15.5.6: If storage full, cargo remains on ship.
   */
  private tryUnloadCargo(
    mission: TransportMission,
    systemId: string
  ): {
    allUnloaded: boolean;
    remainingCargo: TransportCargoItem[];
  } {
    const remainingCargo: TransportCargoItem[] = [];
    let allUnloaded = true;

    for (const item of mission.currentCargo) {
      if (item.loadedAmount <= 0) continue;

      // Check available storage capacity for this resource
      const availableSpace = this.getAvailableStorageSpace(systemId, item.resourceId);

      if (availableSpace <= 0) {
        // No space at all -- keep on ship
        remainingCargo.push({ ...item });
        allUnloaded = false;
        continue;
      }

      const toUnload = Math.min(item.loadedAmount, availableSpace);
      this.gameState.addResourceToSystem(systemId, item.resourceId, toUnload);

      const leftOnShip = item.loadedAmount - toUnload;
      if (leftOnShip > 0) {
        remainingCargo.push({
          ...item,
          loadedAmount: leftOnShip
        });
        allUnloaded = false;
      }
    }

    return { allUnloaded, remainingCargo };
  }

  /**
   * Get available storage space for a resource in a system.
   */
  private getAvailableStorageSpace(systemId: string, resourceId: ResourceId): number {
    const system = this.gameState.getSystem(systemId);
    if (!system) return 0;

    const resource = system.resources.find(r => r.resourceId === resourceId);
    if (!resource) {
      // Resource doesn't exist yet in system -- use default capacity
      return 10000;
    }

    return Math.max(0, resource.capacity - resource.amount);
  }

  // ========================================
  // Departure Helpers
  // ========================================

  /**
   * Launch ship toward destination with loaded cargo.
   */
  private departForDestination(
    mission: TransportMission,
    ship: Ship,
    loadedCargo: TransportCargoItem[],
    fuelCost: number,
    now: number
  ): void {
    const state = this.gameState.getState();
    const origin = state.systems[mission.originSystemId];
    const destination = state.systems[mission.destinationSystemId];
    if (!origin || !destination) return;

    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const travelTimeHours = calculateTravelTime(distance, ship);
    const travelTimeMs = travelTimeHours * 60 * 60 * 1000;

    this.gameState.updateTransportMission(mission.id, {
      phase: TransportMissionPhase.InTransitToDestination,
      status: TransportMissionStatus.Active,
      waitReason: undefined,
      waitingForResource: undefined,
      currentCargo: loadedCargo,
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      totalFuelConsumed: mission.totalFuelConsumed + fuelCost
    });

    this.gameState.updateShip(ship.id, {
      status: ShipStatus.InTransit,
      destinationSystemId: destination.id,
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      currentCargo: loadedCargo.map(c => ({
        resourceId: c.resourceId,
        amount: c.loadedAmount
      }))
    });

    debugLog('SupplyTransport', 'Ship departing for destination', {
      mission: mission.id,
      ship: ship.name,
      cargo: loadedCargo,
      fuelCost,
      travelTimeHours
    });
  }

  /**
   * Launch ship toward origin with return cargo.
   */
  private departForOrigin(
    mission: TransportMission,
    ship: Ship,
    loadedCargo: TransportCargoItem[],
    now: number
  ): void {
    const state = this.gameState.getState();
    const origin = state.systems[mission.originSystemId];
    const destination = state.systems[mission.destinationSystemId];
    if (!origin || !destination) return;

    const distance = getRouteDist(destination.coordinates, origin.coordinates);
    const travelTimeHours = calculateTravelTime(distance, ship);
    const travelTimeMs = travelTimeHours * 60 * 60 * 1000;

    this.gameState.updateTransportMission(mission.id, {
      phase: TransportMissionPhase.InTransitToOrigin,
      status: mission.status === TransportMissionStatus.Cancelling
        ? TransportMissionStatus.Cancelling
        : TransportMissionStatus.Active,
      waitReason: undefined,
      waitingForResource: undefined,
      currentCargo: loadedCargo,
      departureTime: now,
      arrivalTime: now + travelTimeMs
    });

    this.gameState.updateShip(ship.id, {
      status: ShipStatus.InTransit,
      currentSystemId: mission.destinationSystemId,
      destinationSystemId: origin.id,
      departureTime: now,
      arrivalTime: now + travelTimeMs,
      currentCargo: loadedCargo.map(c => ({
        resourceId: c.resourceId,
        amount: c.loadedAmount
      }))
    });

    debugLog('SupplyTransport', 'Ship departing for origin', {
      mission: mission.id,
      ship: ship.name,
      cargo: loadedCargo,
      travelTimeHours
    });
  }

  // ========================================
  // Mission Completion
  // ========================================

  /**
   * Complete a mission and release the ship.
   */
  private completeMission(mission: TransportMission, ship: Ship): void {
    // Convert remaining mission cargo to ship cargo format for the ship
    const remainingShipCargo = mission.currentCargo
      .filter(c => c.loadedAmount > 0)
      .map(c => ({ resourceId: c.resourceId, amount: c.loadedAmount }));

    this.gameState.updateTransportMission(mission.id, {
      status: TransportMissionStatus.Completed
    });

    this.gameState.updateShip(ship.id, {
      status: ShipStatus.Idle,
      missionId: undefined,
      destinationSystemId: undefined,
      departureTime: undefined,
      arrivalTime: undefined,
      currentCargo: remainingShipCargo
    });

    debugLog('SupplyTransport', 'Mission completed', {
      missionId: mission.id,
      shipName: ship.name,
      tripsCompleted: mission.tripsCompleted,
      remainingCargo: remainingShipCargo
    });
  }

  // ========================================
  // Validation
  // ========================================

  /**
   * Validate a mission setup before creation.
   * Checks ship availability, trade station tiers, cargo capacity,
   * resource availability, and fuel availability.
   */
  validateMission(
    shipId: string,
    destinationSystemId: string,
    outboundCargo: { resourceId: ResourceId; amount: number }[],
    returnCargo: { resourceId: ResourceId; amount: number }[],
    missionType: TransportMissionType
  ): TransportMissionValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    let fuelCost = 0;
    let travelTimeHours = 0;

    const state = this.gameState.getState();
    const ship = state.ships[shipId];

    // Ship validation
    if (!ship) {
      errors.push('Ship not found.');
      return { valid: false, errors, warnings, fuelCost, travelTimeHours };
    }

    if (ship.type !== ShipType.Freighter) {
      errors.push('Only freighter ships can transport cargo.');
      return { valid: false, errors, warnings, fuelCost, travelTimeHours };
    }

    if (ship.status !== ShipStatus.Idle) {
      errors.push(`${ship.name} is not available.`);
      return { valid: false, errors, warnings, fuelCost, travelTimeHours };
    }

    // Ship should not have cargo already on board
    if (ship.currentCargo && ship.currentCargo.length > 0) {
      const existingCargoWeight = ship.currentCargo.reduce((sum, c) => sum + c.amount, 0);
      if (existingCargoWeight > 0) {
        errors.push(`${ship.name} still has undelivered cargo aboard.`);
        return { valid: false, errors, warnings, fuelCost, travelTimeHours };
      }
    }

    const origin = state.systems[ship.currentSystemId];
    const destination = state.systems[destinationSystemId];

    if (!origin) {
      errors.push('Ship origin system not found.');
      return { valid: false, errors, warnings, fuelCost, travelTimeHours };
    }

    if (!destination) {
      errors.push('Destination system not found.');
      return { valid: false, errors, warnings, fuelCost, travelTimeHours };
    }

    // Trade station tier validation (GDD 15.3)
    const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];

    if (!origin.hasTradeStation) {
      errors.push(`${origin.name} has no trade station.`);
    } else if (origin.tradeStationTier < sizeDefinition.requiredTradeLevel) {
      errors.push(`${origin.name} trade station tier too low for ${sizeDefinition.name} ship.`);
    }

    if (!destination.hasTradeStation) {
      errors.push(`${destination.name} has no trade station.`);
    } else if (destination.tradeStationTier < sizeDefinition.requiredTradeLevel) {
      errors.push(`${destination.name} trade station tier too low for ${sizeDefinition.name} ship.`);
    }

    // Cargo capacity validation
    const outboundWeight = outboundCargo.reduce((sum, c) => sum + c.amount, 0);
    const returnWeight = returnCargo.reduce((sum, c) => sum + c.amount, 0);

    if (outboundWeight > sizeDefinition.cargoCapacity) {
      errors.push(`Outbound cargo (${outboundWeight}t) exceeds ship capacity (${sizeDefinition.cargoCapacity}t).`);
    }

    if (returnWeight > sizeDefinition.cargoCapacity) {
      errors.push(`Return cargo (${returnWeight}t) exceeds ship capacity (${sizeDefinition.cargoCapacity}t).`);
    }

    // Resource availability validation (only for upfront-reserved types)
    if (missionType !== TransportMissionType.RecurringRoute) {
      // One-way and round-trip: check origin has outbound cargo
      for (const item of outboundCargo) {
        const available = this.gameState.getSystemResource(origin.id, item.resourceId);
        if (available < item.amount) {
          const name = RESOURCE_DEFINITIONS[item.resourceId]?.name ?? item.resourceId;
          errors.push(`Insufficient ${name} at ${origin.name}. Have ${available.toFixed(0)}, need ${item.amount}.`);
        }
      }

      // Round-trip: check destination has return cargo
      if (missionType === TransportMissionType.RoundTrip) {
        for (const item of returnCargo) {
          const available = this.gameState.getSystemResource(destination.id, item.resourceId);
          if (available < item.amount) {
            const name = RESOURCE_DEFINITIONS[item.resourceId]?.name ?? item.resourceId;
            errors.push(`Insufficient ${name} at ${destination.name}. Have ${available.toFixed(0)}, need ${item.amount}.`);
          }
        }
      }
    }

    // Fuel calculation
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    travelTimeHours = calculateTravelTime(distance, ship);

    if (missionType === TransportMissionType.OneWay) {
      fuelCost = calculateFuelCost(distance, outboundWeight, ship);
    } else if (missionType === TransportMissionType.RoundTrip) {
      // GDD 15.6.2: ALL fuel from origin for both legs
      const outboundFuel = calculateFuelCost(distance, outboundWeight, ship);
      const returnFuel = calculateFuelCost(distance, returnWeight, ship);
      fuelCost = outboundFuel + returnFuel;
    } else {
      // Recurring: just estimate outbound fuel for validation display
      fuelCost = calculateFuelCost(distance, outboundWeight, ship);
    }

    // Fuel availability check (for upfront types)
    if (missionType !== TransportMissionType.RecurringRoute) {
      const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);
      if (fuelAvailable < fuelCost) {
        errors.push(`Insufficient fuel at ${origin.name}. Have ${fuelAvailable.toFixed(1)}, need ${fuelCost.toFixed(1)}.`);
      }
    }

    // Warnings
    if (outboundWeight === 0 && returnWeight === 0) {
      warnings.push('Warning: Empty trade route--ship will burn fuel without delivering value. Useful for repositioning only.');
    } else if (outboundWeight === 0) {
      warnings.push('Warning: Empty outbound cargo--ship will burn fuel on outbound leg without delivering value.');
    } else if (returnWeight === 0 && missionType !== TransportMissionType.OneWay) {
      warnings.push('Warning: Empty return cargo--ship will burn fuel on return leg without delivering value.');
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings, fuelCost, travelTimeHours };
    }

    return { valid: true, errors, warnings, fuelCost, travelTimeHours };
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Get a human-readable summary of a mission's current state.
   */
  getMissionPhaseName(mission: TransportMission): string {
    if (mission.status === TransportMissionStatus.Completed) return 'Completed';
    if (mission.status === TransportMissionStatus.Cancelling) return 'Cancelling...';

    if (mission.status === TransportMissionStatus.Waiting) {
      switch (mission.waitReason) {
        case TransportWaitReason.WaitingForCargo:
          return `Waiting for cargo`;
        case TransportWaitReason.WaitingForFuel:
          return `Waiting for fuel`;
        case TransportWaitReason.WaitingForStorageSpace:
          return `Waiting to unload (storage full)`;
        default:
          return 'Waiting';
      }
    }

    switch (mission.phase) {
      case TransportMissionPhase.AtOriginPreparingOutbound:
        return 'At origin, loading';
      case TransportMissionPhase.InTransitToDestination:
        return 'Outbound';
      case TransportMissionPhase.AtDestinationUnloadingAndPreparing:
        return 'At destination';
      case TransportMissionPhase.InTransitToOrigin:
        return 'Returning';
      case TransportMissionPhase.AtOriginUnloading:
        return 'At origin, unloading';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get system name or fallback to ID.
   */
  private getSystemName(systemId: string): string {
    const system = this.gameState.getSystem(systemId);
    return system?.name ?? systemId;
  }

  /**
   * Format hours as human-readable string.
   */
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
