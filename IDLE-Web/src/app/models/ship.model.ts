/**
 * Ship and fleet definitions for I.D.L.E.
 * Defines ship types, sizes, tiers, missions, and travel calculations.
 * Includes both recurring trade routes and one-time trade missions.
 */

import { ResourceId } from './resource.model';

/**
 * High-level ship classification determining available missions.
 */
export enum ShipType {
  Scout = 'scout',
  Freighter = 'freighter'
}

/**
 * Ship size determines cargo capacity, speed, and trade station requirements.
 */
export enum ShipSize {
  Light = 'light',
  Medium = 'medium',
  Heavy = 'heavy',
  Bulk = 'bulk'
}

/**
 * Ship tier represents quality/tech level.
 * Higher tiers have better reliability, lower condition decay, and upgrade bonuses.
 */
export enum ShipTier {
  Basic = 1,
  Standard = 2,
  Advanced = 3,
  Elite = 4
}

/**
 * Definition of ship size characteristics.
 * Larger ships carry more but move slower and require higher-tier trade stations.
 */
export interface ShipSizeDefinition {
  size: ShipSize;
  name: string;
  cargoCapacity: number; // tonnes
  speed: number; // ly/hour
  fuelEfficiency: number; // fuel per ly per tonne
  requiredTradeLevel: number; // minimum trade station tier
}

/**
 * Lookup record for ship size definitions.
 * Balance: Light is fast but small, Bulk is slow but massive with best fuel efficiency.
 */
export const SHIP_SIZE_DEFINITIONS: Record<ShipSize, ShipSizeDefinition> = {
  [ShipSize.Light]: {
    size: ShipSize.Light,
    name: 'Light',
    cargoCapacity: 100,
    speed: 2.0,
    fuelEfficiency: 0.5,
    requiredTradeLevel: 1 // Trade Outpost
  },
  [ShipSize.Medium]: {
    size: ShipSize.Medium,
    name: 'Medium',
    cargoCapacity: 500,
    speed: 1.5,
    fuelEfficiency: 0.4,
    requiredTradeLevel: 2 // Trade Station
  },
  [ShipSize.Heavy]: {
    size: ShipSize.Heavy,
    name: 'Heavy',
    cargoCapacity: 2000,
    speed: 1.0,
    fuelEfficiency: 0.3,
    requiredTradeLevel: 3 // Trade Hub
  },
  [ShipSize.Bulk]: {
    size: ShipSize.Bulk,
    name: 'Bulk',
    cargoCapacity: 10000,
    speed: 0.5,
    fuelEfficiency: 0.2, // Best fuel per tonne
    requiredTradeLevel: 3 // Trade Hub
  }
};

/**
 * Definition of ship tier characteristics.
 * Higher tiers are more reliable and decay slower.
 */
export interface ShipTierDefinition {
  tier: ShipTier;
  name: string;
  conditionDecayRate: number; // % per trip
  upgradeMultiplier: number;
  reliability: number; // 0-1, chance of successful trip
}

/**
 * Lookup record for ship tier definitions.
 * Elite ships have 0.99 reliability and only 0.5% decay per trip.
 */
export const SHIP_TIER_DEFINITIONS: Record<ShipTier, ShipTierDefinition> = {
  [ShipTier.Basic]: {
    tier: ShipTier.Basic,
    name: 'Basic',
    conditionDecayRate: 2,
    upgradeMultiplier: 1,
    reliability: 0.9
  },
  [ShipTier.Standard]: {
    tier: ShipTier.Standard,
    name: 'Standard',
    conditionDecayRate: 1.5,
    upgradeMultiplier: 1.2,
    reliability: 0.95
  },
  [ShipTier.Advanced]: {
    tier: ShipTier.Advanced,
    name: 'Advanced',
    conditionDecayRate: 1,
    upgradeMultiplier: 1.5,
    reliability: 0.98
  },
  [ShipTier.Elite]: {
    tier: ShipTier.Elite,
    name: 'Elite',
    conditionDecayRate: 0.5,
    upgradeMultiplier: 2,
    reliability: 0.99
  }
};

/**
 * Types of ship failures that can occur when condition is low.
 * Severity increases with lower condition thresholds.
 */
export enum ShipFailure {
  MinorMechanical = 'minor_mechanical',
  EngineFailure = 'engine_failure',
  NavFailure = 'nav_failure',
  CoreBreach = 'core_breach'
}

/**
 * Breakdown risk levels based on ship condition.
 * Below 75%: minor issues, Below 25%: risk of total loss.
 */
export interface BreakdownChances {
  minCondition: number;
  possibleFailures: ShipFailure[];
  worstOutcome: string;
}

/**
 * Array of breakdown thresholds in ascending severity order.
 * Used to determine failure risks based on ship condition percentage.
 */
export const BREAKDOWN_THRESHOLDS: BreakdownChances[] = [
  {
    minCondition: 75,
    possibleFailures: [ShipFailure.MinorMechanical],
    worstOutcome: 'Reduced speed, limps home'
  },
  {
    minCondition: 50,
    possibleFailures: [ShipFailure.MinorMechanical, ShipFailure.EngineFailure],
    worstOutcome: 'Stranded, needs rescue'
  },
  {
    minCondition: 25,
    possibleFailures: [ShipFailure.MinorMechanical, ShipFailure.EngineFailure, ShipFailure.NavFailure],
    worstOutcome: 'Ship & cargo lost'
  },
  {
    minCondition: 0,
    possibleFailures: [ShipFailure.MinorMechanical, ShipFailure.EngineFailure, ShipFailure.NavFailure, ShipFailure.CoreBreach],
    worstOutcome: 'Total loss'
  }
];

/**
 * Current operational status of a ship.
 * Determines which actions are available and how the ship is processed.
 */
export enum ShipStatus {
  Idle = 'idle',
  InTransit = 'in_transit',
  Loading = 'loading',
  Unloading = 'unloading',
  Scouting = 'scouting',
  // GDD v6: Surveying status removed - scouts now auto-survey upon discovery
  Repairing = 'repairing',
  Stranded = 'stranded',
  Lost = 'lost'
}

/**
 * Runtime instance of a ship in the game state.
 * Contains both static properties (type, size, tier) and dynamic state (condition, status, cargo).
 */
export interface Ship {
  id: string;
  name: string;
  type: ShipType;
  size: ShipSize;
  tier: ShipTier;
  condition: number; // 0-100%
  status: ShipStatus;
  currentSystemId: string;

  // Scout-specific
  scoutRange?: number;
  scoutSpeed?: number;
  sensorQuality?: number;

  // Freighter-specific
  cargoCapacity?: number;
  currentCargo?: { resourceId: ResourceId; amount: number }[];

  // Mission tracking
  missionId?: string;
  destinationSystemId?: string;
  departureTime?: number;
  arrivalTime?: number;
  colonizationTargetBodyId?: string; // Body ID where initial starport should be built
  colonizationMission?: {
    originSystemId: string;
    destinationSystemId: string;
    starportBodyId?: string;
    remainingCargo: { resourceId: ResourceId; amount: number }[];
    deliveredCargo: { resourceId: ResourceId; amount: number }[];
    tripsCompleted: number;
    waitingForFuel: boolean;
  };

  // Upgrades
  speedModifier: number; // multiplier
  rangeModifier: number; // multiplier
  efficiencyModifier: number; // multiplier
}

/**
 * Scout mission to discover and survey a new star system.
 * GDD v6: Scouts automatically survey all bodies upon discovery.
 */
export interface ScoutMission {
  id: string;
  shipId: string;
  originSystemId: string;
  targetCoordinates?: { x: number; y: number };
  startTime: number;
  estimatedArrival: number;
  explorationComplete?: number;
  returnTime: number;
  status: 'outbound' | 'exploring' | 'returning' | 'completed';
  discoveredSystemId?: string;
  // GDD v6: Scouts now auto-survey all bodies upon discovery
  surveyComplete: boolean;
}

/**
 * One leg of a recurring trade route (outbound or return).
 * Null resourceId represents empty cargo space.
 */
export interface TradeRouteLeg {
  resourceId: ResourceId | null; // null = empty
  amount: number;
}

/**
 * Recurring trade route between two systems.
 * Ships assigned to a route will automatically make round trips.
 */
export interface TradeRoute {
  id: string;
  name: string;
  originSystemId: string;
  destinationSystemId: string;
  outboundCargo: TradeRouteLeg[];
  returnCargo: TradeRouteLeg[];
  assignedShipIds: string[];
  active: boolean;
}

/**
 * Active trip instance for a ship on a recurring trade route.
 * Tracks current direction, cargo, and arrival time.
 */
export interface TradeTrip {
  id: string;
  routeId: string;
  shipId: string;
  isOutbound: boolean;
  cargo: { resourceId: ResourceId; amount: number }[];
  departureTime: number;
  arrivalTime: number;
  fuelConsumed: number;
}

/**
 * Type of one-time trade mission.
 * One-way: Ship delivers and stays at destination.
 * Round-trip: Ship delivers, optionally loads return cargo, and returns to origin.
 */
export enum TradeMissionType {
  OneWay = 'one_way',
  RoundTrip = 'round_trip'
}

/**
 * One-time trade mission (GDD v6 Section 16.3).
 * Unlike recurring routes, these are single-use missions for colonization or special deliveries.
 */
export interface TradeMission {
  id: string;
  shipId: string;
  missionType: TradeMissionType;
  originSystemId: string;
  destinationSystemId: string;

  // Cargo configuration
  outboundCargo: { resourceId: ResourceId; amount: number }[];
  returnCargo?: { resourceId: ResourceId; amount: number }[]; // Only for round-trip

  // Mission progress
  status: 'loading' | 'outbound' | 'unloading' | 'loading_return' | 'returning' | 'completed';
  departureTime: number;
  arrivalTime?: number;
  returnDepartureTime?: number; // For round-trip
  returnArrivalTime?: number;   // For round-trip

  // Fuel tracking
  fuelConsumed: number;
  fuelReserved: number;

  // For round-trip: what to buy at destination
  purchaseOrders?: { resourceId: ResourceId; maxAmount: number; maxPrice?: number }[];
}

/**
 * Thematic name lists for procedural ship naming.
 * Randomly selected unless player specifies a theme.
 */
export const SHIP_NAME_THEMES = {
  nautical: [
    'Endeavour', 'Discovery', 'Horizon', 'Navigator', 'Voyager', 'Pioneer',
    'Mariner', 'Seafarer', 'Pathfinder', 'Trailblazer', 'Wanderer', 'Drifter'
  ],
  mythology: [
    'Phoenix', 'Pegasus', 'Artemis', 'Apollo', 'Hermes', 'Atlas',
    'Prometheus', 'Icarus', 'Odyssey', 'Titan', 'Valkyrie', 'Odin'
  ],
  corporate: [
    'Enterprise', 'Venture', 'Commerce', 'Prosperity', 'Fortune', 'Capital',
    'Trade Wind', 'Merchant', 'Profit Margin', 'Market Force'
  ],
  optimistic: [
    'Hope', 'Unity', 'Harmony', 'Progress', 'Future', 'Dream',
    'Aspiration', 'Vision', 'Promise', 'Dawn', 'New Horizon'
  ],
  humorous: [
    'Budget Cuts', 'Barely Working', 'Good Enough', 'Plan B', 'Last Resort',
    'Flying Brick', 'Insurance Claim', 'Duct Tape Special'
  ],
  frontier: [
    'Frontier', 'Outpost', 'Rustbucket', 'Workhorse', 'Old Reliable',
    'Roughneck', 'Hauler', 'Mudskipper', 'Junker', 'Salvage Queen'
  ]
};

/**
 * Generate a random ship name from the specified theme or a random theme.
 *
 * @param theme - Optional theme to draw from
 * @returns Random ship name string
 */
export function generateShipName(theme?: keyof typeof SHIP_NAME_THEMES): string {
  const themes = Object.keys(SHIP_NAME_THEMES) as (keyof typeof SHIP_NAME_THEMES)[];
  const selectedTheme = theme || themes[Math.floor(Math.random() * themes.length)];
  const names = SHIP_NAME_THEMES[selectedTheme];
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Calculate fuel cost for a trip based on distance, cargo weight, and ship efficiency.
 * Formula: distance × cargo × ship_efficiency / efficiency_modifier
 *
 * @param distance - Travel distance in light-years
 * @param cargoTonnes - Total weight of cargo being transported
 * @param ship - Ship making the journey
 * @returns Fuel cost in tonnes
 */
export function calculateFuelCost(
  distance: number,
  cargoTonnes: number,
  ship: Ship
): number {
  const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];
  const baseFuel = distance * cargoTonnes * sizeDefinition.fuelEfficiency;
  return baseFuel / ship.efficiencyModifier;
}

/**
 * Calculate travel time for a trip based on distance and ship speed.
 * TESTING: Currently multiplied by 100x for faster QA testing.
 * Formula: distance / (ship_speed × speed_modifier) = hours
 *
 * @param distance - Travel distance in light-years
 * @param ship - Ship making the journey
 * @returns Travel time in hours
 */
export function calculateTravelTime(
  distance: number,
  ship: Ship
): number {
  const sizeDefinition = SHIP_SIZE_DEFINITIONS[ship.size];
  let effectiveSpeed = sizeDefinition.speed * ship.speedModifier;

  // TESTING: speed up freighters 10x to accelerate QA iteration
  effectiveSpeed *= 100;
  console.log("travel times sped up for testing");

  return distance / effectiveSpeed; // hours
}
