/**
 * Transport mission definitions for I.D.L.E.
 * GDD v6 Section 15: Supply Transport & Logistics
 *
 * Defines three mission types for moving resources between systems:
 * 1. One-Way: Ship delivers cargo and stays at destination (cargo reserved upfront)
 * 2. Round-Trip: Ship delivers outbound cargo, picks up return cargo, returns (all reserved upfront)
 * 3. Recurring Route: Ship loops between systems with JIT cargo loading (no reservation)
 */

import { ResourceId } from './resource.model';

/**
 * Type of transport mission determining reservation and completion behavior.
 */
export enum TransportMissionType {
  /** Ship delivers cargo and becomes Idle at destination. Cargo reserved upfront. */
  OneWay = 'one_way',
  /** Ship delivers, optionally loads return cargo, returns to origin. All reserved upfront. */
  RoundTrip = 'round_trip',
  /** Ship loops between systems indefinitely with JIT cargo loading. */
  RecurringRoute = 'recurring_route'
}

/**
 * Overall status of a transport mission.
 */
export enum TransportMissionStatus {
  /** Mission active and ship is processing it */
  Active = 'active',
  /** Mission paused - ship waiting for cargo or fuel */
  Waiting = 'waiting',
  /** Mission cancelled - ship completing current leg then becoming Idle */
  Cancelling = 'cancelling',
  /** Mission finished - ship is Idle */
  Completed = 'completed'
}

/**
 * Current phase of a transport mission (what the ship is doing right now).
 */
export enum TransportMissionPhase {
  /** Ship is at origin, preparing to load outbound cargo */
  AtOriginPreparingOutbound = 'at_origin_preparing_outbound',
  /** Ship is traveling to destination */
  InTransitToDestination = 'in_transit_to_destination',
  /** Ship is at destination, unloading and preparing return cargo */
  AtDestinationUnloadingAndPreparing = 'at_destination_unloading_and_preparing',
  /** Ship is traveling back to origin */
  InTransitToOrigin = 'in_transit_to_origin',
  /** Ship is at origin, unloading return cargo (for round-trip/recurring) */
  AtOriginUnloading = 'at_origin_unloading'
}

/**
 * Reason why a mission is waiting.
 */
export enum TransportWaitReason {
  /** Waiting for cargo to become available at current location */
  WaitingForCargo = 'waiting_for_cargo',
  /** Waiting for fuel to become available at current location */
  WaitingForFuel = 'waiting_for_fuel',
  /** Waiting for storage space at destination to unload cargo */
  WaitingForStorageSpace = 'waiting_for_storage_space'
}

/**
 * Cargo configuration for a single resource in a mission.
 */
export interface TransportCargoItem {
  resourceId: ResourceId;
  /** Requested amount per trip (for recurring) or total (for one-time) */
  requestedAmount: number;
  /** Actually loaded amount (may be less due to partial loading) */
  loadedAmount: number;
}

/**
 * Runtime instance of a transport mission.
 */
export interface TransportMission {
  id: string;
  shipId: string;
  missionType: TransportMissionType;

  /** Origin system (where mission starts, where ship returns for recurring) */
  originSystemId: string;
  /** Destination system */
  destinationSystemId: string;

  /** Configured outbound cargo (origin -> destination) */
  outboundCargo: TransportCargoItem[];
  /** Configured return cargo (destination -> origin). Empty for one-way. */
  returnCargo: TransportCargoItem[];

  /** Current mission status */
  status: TransportMissionStatus;
  /** Current mission phase */
  phase: TransportMissionPhase;

  /** If waiting, why */
  waitReason?: TransportWaitReason;
  /** Resource we're waiting for (if waiting for cargo or storage) */
  waitingForResource?: ResourceId;

  /** Timestamp when ship departed for current leg */
  departureTime?: number;
  /** Timestamp when ship will arrive at current destination */
  arrivalTime?: number;

  /** Cargo currently on the ship */
  currentCargo: TransportCargoItem[];

  /** Number of completed round trips (for recurring routes) */
  tripsCompleted: number;

  /** Total fuel consumed over mission lifetime */
  totalFuelConsumed: number;

  /** Mission creation timestamp */
  createdAt: number;
}

/**
 * Validation result for mission setup.
 */
export interface TransportMissionValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Calculated fuel cost for first leg (one-way) or full trip (round-trip) */
  fuelCost: number;
  /** Calculated travel time in hours for one leg */
  travelTimeHours: number;
}

/**
 * Create an empty transport cargo item.
 */
export function createEmptyCargoItem(resourceId: ResourceId, requestedAmount: number): TransportCargoItem {
  return {
    resourceId,
    requestedAmount,
    loadedAmount: 0
  };
}

/**
 * Get total weight of cargo items.
 */
export function getCargoWeight(cargo: TransportCargoItem[]): number {
  return cargo.reduce((sum, item) => sum + item.loadedAmount, 0);
}

/**
 * Get total requested weight of cargo items.
 */
export function getCargoRequestedWeight(cargo: TransportCargoItem[]): number {
  return cargo.reduce((sum, item) => sum + item.requestedAmount, 0);
}
