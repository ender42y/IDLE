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
import { FacilityId, Facility, FACILITY_DEFINITIONS } from '../models/facility.model';
import { BODY_TYPE_DEFINITIONS } from '../models/celestial-body.model';
import { debugLog, debugWarn } from '../config/testing.config';

/**
 * Tracks multi-trip colonization mission state.
 * Used internally by ships with colonizationMission data.
 * Not stored in main game state - lives on the ship object.
 */
export interface ColonizationMission {
  id: string;
  shipId: string;
  originSystemId: string;
  destinationSystemId: string;
  starportBodyId?: string;  // Where to build the initial Trade Outpost

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

/**
 * Manages colonization missions that establish new systems as player territory.
 * Handles multi-trip cargo delivery, fuel management, and initial facility construction.
 *
 * Colonization Flow:
 * 1. User sends freighter with colonization cargo (minimum: Steel, Glass Ceramics, Food, Water)
 * 2. ALL cargo is reserved from origin immediately (prevents double-spending)
 * 3. Ship makes multiple round trips if cargo exceeds capacity
 * 4. On first arrival, Colony Ship facility is created to hold supplies
 * 5. When all cargo delivered, Colony Ship converts to Trade Outpost
 * 6. System marked as colonized with initial population (100 colonists)
 *
 * Multi-Trip Behavior:
 * - If cargo > ship capacity, mission splits into multiple trips
 * - Ship loads max capacity, delivers, returns to origin for more
 * - Fuel needed for EACH round trip (checked before each departure)
 * - If fuel insufficient, ship waits at current location until fuel available
 * - Mission tracks remainingCargo and deliveredCargo separately
 *
 * Fuel Management:
 * - Each trip requires fuel for: loaded outbound + empty return
 * - Fuel checked at origin before departure
 * - Fuel also needed at destination for return trip
 * - If stranded (no fuel at destination), ship waits for fuel delivery
 *
 * Colony Ship Facility:
 * - Temporary orbital facility created on first delivery
 * - Holds colonization supplies until mission complete
 * - Automatically converted to Trade Outpost when all cargo delivered
 * - Ensures resources aren't lost if system isn't fully colonized yet
 *
 * Requirements:
 * - Minimum cargo: 100 Steel, 50 Glass Ceramics, 100 Prepared Foods, 50 Purified Water
 * - Destination must be discovered and surveyed
 * - Origin must have all required resources
 * - Origin must have sufficient fuel for first trip
 *
 * @see sendColonizationMission for mission initialization
 * @see getColonizationRequirements for minimum resource needs
 * @see processTick for mission progression and trip management
 */
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
    cargo: { resourceId: ResourceId; amount: number }[],
    starportBodyId?: string
  ): boolean {
    const state = this.gameState.getState();
    const ship = state.ships[shipId];
    const destination = state.systems[destinationSystemId];

    debugLog('Colonization', 'sendColonizationMission called', { shipId, destinationSystemId, cargo });

    if (!ship || ship.type !== ShipType.Freighter) {
      debugLog('Colonization', 'invalid ship or wrong type', ship);
      this.gameState.addNotification({
        type: 'warning',
        title: 'Invalid Ship',
        message: 'Only freighter ships can transport colonization supplies.'
      });
      return false;
    }

    if (ship.status !== ShipStatus.Idle) {
      debugLog('Colonization', 'ship busy', ship.status);
      this.gameState.addNotification({
        type: 'warning',
        title: 'Ship Busy',
        message: `${ship.name} is not available.`
      });
      return false;
    }

    if (!destination || !destination.discovered) {
      debugLog('Colonization', 'invalid destination or not discovered', destination);
      this.gameState.addNotification({
        type: 'warning',
        title: 'Invalid Destination',
        message: 'System must be discovered first.'
      });
      return false;
    }

    const origin = state.systems[ship.currentSystemId];
    if (!origin) return false;

    // Check if cargo meets minimum colonization requirements
    if (!this.meetsColonizationRequirements(cargo)) {
      const requirements = this.getColonizationRequirements();
      const missing: string[] = [];
      for (const req of requirements) {
        const supplied = cargo.find(c => c.resourceId === req.resourceId)?.amount ?? 0;
        if (supplied < req.amount) {
          const resourceName = RESOURCE_DEFINITIONS[req.resourceId]?.name ?? req.resourceId;
          missing.push(`${resourceName}: ${supplied}/${req.amount}`);
        }
      }

      this.gameState.addNotification({
        type: 'warning',
        title: 'Insufficient Colonization Cargo',
        message: `Warning: Cargo does not meet minimum requirements. Missing: ${missing.join(', ')}. The system will not be colonized upon delivery.`,
        systemId: destinationSystemId
      });

      // Still allow the mission, but warn the user
      debugWarn('Colonization', 'Cargo below minimum requirements:', missing);
    }

    // Check and reserve ALL cargo from origin system immediately
    const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];
    const totalCargoAmount = cargo.reduce((sum, c) => sum + c.amount, 0);

    debugLog('Colonization', 'Total cargo needed:', totalCargoAmount);

    // Validate all resources are available at origin
    for (const item of cargo) {
      const available = this.gameState.getSystemResource(origin.id, item.resourceId);
      if (available < item.amount) {
        debugLog('Colonization', 'insufficient resource at origin', { resourceId: item.resourceId, available, needed: item.amount });
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

      // Continue processing all cargo items even if ship is full
      // to ensure everything goes into remainingCargo
    }

    debugLog('Colonization', 'First trip cargo:', firstTripCargo);

    // Calculate fuel cost for first trip
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const firstTripCargoWeight = firstTripCargo.reduce((sum, c) => sum + c.amount, 0);
    const fuelNeeded = calculateFuelCost(distance, firstTripCargoWeight, ship);
    const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);

    // Check if we have enough fuel for the first trip
    if (fuelAvailable < fuelNeeded) {
      debugLog('Colonization', 'insufficient fuel for first trip, entering wait state', { fuelAvailable, fuelNeeded });

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
    debugLog('Colonization', 'mission launched', {
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

      // Check for ships waiting for fuel at origin or destination
      if (ship.status === ShipStatus.Idle && ship.colonizationMission?.waitingForFuel) {
        const mission = ship.colonizationMission;
        const origin = state.systems[mission.originSystemId];
        const destination = state.systems[mission.destinationSystemId];
        if (!origin || !destination) continue;

        const distance = getRouteDist(origin.coordinates, destination.coordinates);

        // Handle ships waiting at origin (need to depart for destination with cargo)
        if (ship.currentSystemId === mission.originSystemId) {
          // Calculate fuel needed for next trip
          const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];

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
          const fuelNeeded = calculateFuelCost(distance, nextTripWeight, ship); // Outbound only
          const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);

          if (fuelAvailable >= fuelNeeded) {
            // Enough fuel now - launch next trip!
            debugLog('Colonization', 'Fuel available, resuming mission from origin', { ship: ship.name, fuelAvailable, fuelNeeded });

            // Deduct fuel for outbound trip only (return fuel handled at destination)
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

        // Handle ships waiting at destination (need to return to origin empty)
        else if (ship.currentSystemId === mission.destinationSystemId) {
          const returnFuelNeeded = calculateFuelCost(distance, 0, ship);
          const fuelAvailable = this.gameState.getSystemResource(destination.id, ResourceId.Fuel);

          if (fuelAvailable >= returnFuelNeeded) {
            // Enough fuel now - return to origin!
            debugLog('Colonization', 'Fuel available, returning to origin from destination', { ship: ship.name, fuelAvailable, fuelNeeded: returnFuelNeeded });

            // Deduct fuel
            this.gameState.removeResourceFromSystem(destination.id, ResourceId.Fuel, returnFuelNeeded);

            const travelTimeHours = calculateTravelTime(distance, ship);
            const travelTimeMs = travelTimeHours * 60 * 60 * 1000;

            mission.waitingForFuel = false;

            this.gameState.updateShip(ship.id, {
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
              title: 'Returning for Supplies',
              message: `${ship.name} has refueled and is returning to ${origin.name} for additional supplies.`
            });
          }
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
    const origin = state.systems[mission.originSystemId];
    debugLog('Colonization', 'completing trip', {
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

    // On first delivery, create Colony Ship to hold supplies
    if (mission.tripsCompleted === 0) {
      const starportBodyId = mission.starportBodyId || ship.colonizationTargetBodyId;
      if (starportBodyId) {
        const targetBody = state.bodies[starportBodyId];
        if (targetBody && targetBody.systemId === destination.id) {
          // Create Colony Ship facility directly (bypassing construction costs)
          const colonyShipId = this.gameState.generateId();
          const colonyShip: Facility = {
            id: colonyShipId,
            definitionId: FacilityId.ColonyShip,
            bodyId: starportBodyId,
            level: 1,
            condition: 100,
            operational: true
          };

          this.gameState.addFacility(colonyShip);

          // Update body slot usage
          this.gameState.updateBody(starportBodyId, {
            usedOrbitalSlots: targetBody.usedOrbitalSlots + 1,
            facilityIds: [...targetBody.facilityIds, colonyShipId]
          });

          debugLog('Colonization', 'Colony Ship established on', targetBody.name);

          this.gameState.addNotification({
            type: 'info',
            title: 'Colony Ship Established',
            message: `Colony Ship is now holding supplies in orbit around ${targetBody.name}.`,
            systemId: destination.id
          });
        }
      }
    }

    mission.tripsCompleted++;

    // Check if there's more cargo to deliver
    const hasMoreCargo = mission.remainingCargo.some(c => c.amount > 0);

    if (hasMoreCargo) {
      // More trips needed - return to origin to pick up more
      debugLog('Colonization', 'More cargo to deliver, returning to origin');

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
        debugLog('Colonization', 'Ship stranded at destination, waiting for fuel', { fuelAvailable, fuelNeeded: returnFuelNeeded });

        mission.waitingForFuel = true;

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
      // All cargo delivered - check if requirements are met before colonizing
      debugLog('Colonization', 'All cargo delivered, checking requirements');

      // Validate that delivered cargo meets minimum colonization requirements
      if (!this.meetsColonizationRequirements(mission.deliveredCargo)) {
        debugWarn('Colonization', 'Delivered cargo does not meet minimum requirements', mission.deliveredCargo);

        // Determine what's missing
        const requirements = this.getColonizationRequirements();
        const missingNeeded: { resourceId: ResourceId; amountNeeded: number }[] = [];
        for (const req of requirements) {
          const delivered = mission.deliveredCargo.find(c => c.resourceId === req.resourceId)?.amount ?? 0;
          if (delivered < req.amount) {
            missingNeeded.push({ resourceId: req.resourceId, amountNeeded: req.amount - delivered });
          }
        }

        // Try to source missing resources from the origin system automatically
        let anySourced = false;
        if (origin) {
          for (const m of missingNeeded) {
            const availableAtOrigin = this.gameState.getSystemResource(origin.id, m.resourceId);
            const amountToTake = Math.min(availableAtOrigin, m.amountNeeded);
            if (amountToTake > 0) {
              // Reserve from origin storage
              this.gameState.removeResourceFromSystem(origin.id, m.resourceId, amountToTake);

              // Add to remainingCargo so subsequent trips will pick it up
              const existing = mission.remainingCargo.find(r => r.resourceId === m.resourceId);
              if (existing) {
                existing.amount += amountToTake;
              } else {
                mission.remainingCargo.push({ resourceId: m.resourceId, amount: amountToTake } as any);
              }

              anySourced = true;
            }
          }
        }

        if (anySourced && origin) {
          // We have additional supplies at origin — send the ship back to pick them up.
          const distance = getRouteDist(origin.coordinates, destination.coordinates);
          const returnFuelNeeded = calculateFuelCost(distance, 0, ship);
          const fuelAvailableAtDest = this.gameState.getSystemResource(destination.id, ResourceId.Fuel);

          if (fuelAvailableAtDest < returnFuelNeeded) {
            // Can't return immediately due to lack of fuel at destination — mark idle and keep mission
            mission.waitingForFuel = true;
            this.gameState.updateShip(shipId, {
              status: ShipStatus.Idle,
              currentSystemId: destination.id,
              destinationSystemId: undefined,
              departureTime: undefined,
              arrivalTime: undefined,
              currentCargo: [],
              colonizationMission: mission
            });

            // Informational only — no blocking warning to the player
            this.gameState.addNotification({
              type: 'info',
              title: 'Awaiting Fuel to Return',
              message: `${ship.name} needs ${returnFuelNeeded.toFixed(1)} fuel at ${destination.name} to return to ${origin.name} for remaining supplies.`
            });

            return;
          }

          // Deduct fuel at destination and send ship back empty to origin to load new supplies
          this.gameState.removeResourceFromSystem(destination.id, ResourceId.Fuel, returnFuelNeeded);

          const travelTimeHours = calculateTravelTime(distance, ship);
          const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
          const now = Date.now();

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
            title: 'Returning for Additional Supplies',
            message: `${ship.name} is returning to ${origin.name} to pick up missing colonization supplies.`
          });

          return;
        }

        // Nothing to source (origin doesn't have more) — fall back to previous behavior: inform and end mission
        const missingList = missingNeeded.map(m => `${RESOURCE_DEFINITIONS[m.resourceId]?.name ?? m.resourceId}: ${m.amountNeeded}`).join(', ');

        this.gameState.addNotification({
          type: 'warning',
          title: 'Insufficient Colonization Supplies',
          message: `${ship.name} delivered all reserved cargo, but the system cannot be colonized. Missing requirements: ${missingList}`,
          systemId: destination.id
        });

        // Mission complete but system not colonized - ship returns to idle
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

        return;
      }

      debugLog('Colonization', 'Requirements met, colonizing system');

      // Mark system as colonized if not already
      if (!destination.colonized) {
        // Get the Trade Outpost's population floor - this is the initial population per GDD 10.10
        const tradeOutpostDef = FACILITY_DEFINITIONS[FacilityId.TradeOutpost];
        const initialPopulation = tradeOutpostDef.populationFloor;

        this.gameState.updateSystem(destination.id, {
          colonized: true,
          totalPopulation: initialPopulation
        });

        // Consume colonization resources from system storage (per GDD 14.8 - Trade Outpost starts empty)
        const requirements = this.getColonizationRequirements();
        for (const req of requirements) {
          this.gameState.removeResourceFromSystem(destination.id, req.resourceId, req.amount);
        }
        debugLog('Colonization', 'Consumed colonization resources from destination storage');

        // Build initial starport by converting Colony Ship
        const starportBodyId = mission.starportBodyId || ship.colonizationTargetBodyId;

        // Initialize body population to the initial population (will be distributed properly on next tick)
        if (starportBodyId) {
          this.gameState.updateBody(starportBodyId, { population: initialPopulation });
        }
        if (starportBodyId) {
          // IMPORTANT: Re-fetch fresh body state to find Colony Ship created earlier in this function
          // (the original 'state' variable is stale if Colony Ship was just created)
          const currentBody = this.gameState.getBody(starportBodyId);
          if (currentBody && currentBody.systemId === destination.id) {
            // Find the Colony Ship to replace using fresh state
            const freshState = this.gameState.getState();
            const colonyShipFacility = currentBody.facilityIds
              .map(id => freshState.facilities[id])
              .find(f => f && f.definitionId === FacilityId.ColonyShip);

            // Create Trade Outpost directly (colonization resources consumed above)
            const tradeOutpostId = this.gameState.generateId();
            const tradeOutpost: Facility = {
              id: tradeOutpostId,
              definitionId: FacilityId.TradeOutpost,
              bodyId: starportBodyId,
              level: 1,
              condition: 100,
              operational: true
            };

            this.gameState.addFacility(tradeOutpost);

            if (colonyShipFacility) {
              // Replace Colony Ship with Trade Outpost
              // Colony Ship uses 1 orbital slot, Trade Outpost uses 1 orbital slot = net zero slot change
              this.gameState.removeFacility(colonyShipFacility.id);
              this.gameState.updateBody(starportBodyId, {
                facilityIds: [...currentBody.facilityIds.filter(id => id !== colonyShipFacility.id), tradeOutpostId]
              });
              debugLog('Colonization', 'Colony Ship replaced with Trade Outpost on', currentBody.name);
            } else {
              // No Colony Ship found - just add Trade Outpost (increment slot count)
              this.gameState.updateBody(starportBodyId, {
                usedOrbitalSlots: currentBody.usedOrbitalSlots + 1,
                facilityIds: [...currentBody.facilityIds, tradeOutpostId]
              });
              debugLog('Colonization', 'Trade Outpost established on', currentBody.name);
            }

            // Update body's population floor/ceiling based on its facilities
            this.updateBodyPopulationLimits(starportBodyId);

            // Update system trade station status
            this.gameState.updateSystem(destination.id, {
              hasTradeStation: true,
              tradeStationTier: 1
            });

            // Increase resource capacity on the system
            // IMPORTANT: Re-fetch the current destination state to get updated resource amounts
            // (we consumed resources above, so the original `destination` variable is stale)
            const currentDestination = this.gameState.getSystem(destination.id);
            if (currentDestination?.resources && currentDestination.resources.length > 0) {
              const extra = 5000; // Trade Outpost tier 1 capacity
              const newResources = currentDestination.resources.map(r => ({
                ...r,
                capacity: (r.capacity ?? 0) + extra
              }));
              this.gameState.updateSystem(destination.id, { resources: newResources });
            }
          } else {
            debugWarn('Colonization', 'Invalid colonization target body', starportBodyId);
          }
        } else {
          // Fallback: build on first available body with orbital slots
          debugWarn('Colonization', 'No target body specified, using fallback');
          // Re-fetch fresh state to get current body data
          const freshState = this.gameState.getState();
          const bodiesWithOrbitalSlots = destination.bodyIds
            .map(id => freshState.bodies[id])
            .filter(b => b && b.orbitalSlots > 0);
          if (bodiesWithOrbitalSlots.length > 0) {
            const fallbackBody = bodiesWithOrbitalSlots[0];

            // Find the Colony Ship to replace using fresh state
            const colonyShipFacility = fallbackBody.facilityIds
              .map(id => freshState.facilities[id])
              .find(f => f && f.definitionId === FacilityId.ColonyShip);

            // Create Trade Outpost directly
            const tradeOutpostId = this.gameState.generateId();
            const tradeOutpost: Facility = {
              id: tradeOutpostId,
              definitionId: FacilityId.TradeOutpost,
              bodyId: fallbackBody.id,
              level: 1,
              condition: 100,
              operational: true
            };

            this.gameState.addFacility(tradeOutpost);

            if (colonyShipFacility) {
              // Replace Colony Ship with Trade Outpost (net zero slot change)
              this.gameState.removeFacility(colonyShipFacility.id);
              this.gameState.updateBody(fallbackBody.id, {
                facilityIds: [...fallbackBody.facilityIds.filter(id => id !== colonyShipFacility.id), tradeOutpostId]
              });
              debugLog('Colonization', 'Colony Ship replaced with fallback Trade Outpost on', fallbackBody.name);
            } else {
              // No Colony Ship found - just add Trade Outpost (increment slot count)
              this.gameState.updateBody(fallbackBody.id, {
                usedOrbitalSlots: fallbackBody.usedOrbitalSlots + 1,
                facilityIds: [...fallbackBody.facilityIds, tradeOutpostId]
              });
              debugLog('Colonization', 'Built fallback Trade Outpost on', fallbackBody.name);
            }

            // Update body's population floor/ceiling based on its facilities
            this.updateBodyPopulationLimits(fallbackBody.id);

            this.gameState.updateSystem(destination.id, {
              hasTradeStation: true,
              tradeStationTier: 1
            });
          }
        }

        // Enforce population floor now that facilities are built
        // This ensures population meets the minimum workforce requirements
        this.enforcePopulationFloor(destination.id);

        // Re-fetch system to get the updated population for the notification
        const finalSystem = this.gameState.getSystem(destination.id);
        const finalPopulation = finalSystem?.totalPopulation ?? initialPopulation;

        this.gameState.addNotification({
          type: 'success',
          title: 'System Colonized!',
          message: `${destination.name} is now colonized with ${finalPopulation} colonists and an initial Trade Outpost has been established! (${mission.tripsCompleted} trips completed)`,
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

    debugLog('Colonization', 'Ship arrived at origin, loading next batch', {
      shipId,
      remainingCargo: mission.remainingCargo
    });

    // Check if there's still cargo to deliver
    const hasMoreCargo = mission.remainingCargo.some(c => c.amount > 0);
    if (!hasMoreCargo) {
      // This shouldn't happen, but handle it gracefully
      debugWarn('Colonization', 'Ship arrived at origin but no cargo remaining');
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

    // Create new remainingCargo array with updated amounts (immutable update)
    const updatedRemainingCargo = mission.remainingCargo.map(item => {
      const loaded = nextTripCargo.find(c => c.resourceId === item.resourceId);
      if (loaded) {
        const newAmount = item.amount - loaded.amount;
        return { resourceId: item.resourceId, amount: Math.max(0, newAmount) };
      }
      return { ...item };
    });

    // Update mission with new remaining cargo
    mission.remainingCargo = updatedRemainingCargo;

    // Calculate fuel for outbound trip only (return fuel handled at destination)
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const nextTripWeight = nextTripCargo.reduce((sum, c) => sum + c.amount, 0);
    const fuelNeeded = calculateFuelCost(distance, nextTripWeight, ship); // Outbound only
    const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);

    if (fuelAvailable < fuelNeeded) {
      // Not enough fuel - wait at origin
      debugLog('Colonization', 'Waiting for fuel at origin', { fuelAvailable, fuelNeeded });

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

    // Have fuel - deduct it for outbound trip and launch next trip
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

  /**
   * Calculate the population floor for a system based on all its facilities.
   * Floor = sum of all facility populationFloor values.
   * Per GDD v6 Section 10.2, population cannot fall below this value.
   */
  private calculateSystemPopulationFloor(systemId: string): number {
    const state = this.gameState.getState();
    const system = state.systems[systemId];
    if (!system) return 0;

    let floor = 0;
    for (const bodyId of system.bodyIds) {
      const body = state.bodies[bodyId];
      if (!body) continue;

      for (const facilityId of body.facilityIds) {
        const facility = state.facilities[facilityId];
        if (!facility || !facility.operational) continue;

        const def = FACILITY_DEFINITIONS[facility.definitionId];
        if (def) {
          floor += def.populationFloor;
        }
      }
    }

    return floor;
  }

  /**
   * Enforce the population floor for a newly colonized system.
   * If current population is below the floor, bump it up.
   * Called after building facilities to ensure minimum workforce is present.
   */
  private enforcePopulationFloor(systemId: string): void {
    const floor = this.calculateSystemPopulationFloor(systemId);
    const system = this.gameState.getSystem(systemId);

    if (system && system.totalPopulation < floor) {
      debugLog('Colonization', 'Enforcing population floor', {
        systemId,
        currentPop: system.totalPopulation,
        floor
      });
      this.gameState.updateSystem(systemId, { totalPopulation: floor });
    }
  }

  /**
   * Update a body's population floor and ceiling based on its facilities.
   * Called after building facilities to ensure the body's population limits are current.
   * Per GDD v6 Section 10.2-10.5:
   * - Floor = sum of all facility populationFloor values
   * - Ceiling = sum of (facility populationCeiling * body type multiplier)
   */
  private updateBodyPopulationLimits(bodyId: string): void {
    const state = this.gameState.getState();
    const body = state.bodies[bodyId];
    if (!body) return;

    const bodyTypeDef = BODY_TYPE_DEFINITIONS[body.type];
    const bodyMultiplier = bodyTypeDef?.populationMultiplier ?? 1;

    let floor = 0;
    let ceiling = 0;

    for (const facilityId of body.facilityIds) {
      const facility = state.facilities[facilityId];
      if (!facility || !facility.operational) continue;

      const def = FACILITY_DEFINITIONS[facility.definitionId];
      if (def) {
        floor += def.populationFloor;
        ceiling += def.populationCeiling * bodyMultiplier;
      }
    }

    this.gameState.updateBody(bodyId, {
      populationFloor: floor,
      populationCeiling: Math.round(ceiling)
    });

    debugLog('Colonization', 'Updated body population limits', {
      bodyId,
      bodyName: body.name,
      floor,
      ceiling: Math.round(ceiling)
    });
  }
}
