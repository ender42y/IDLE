/**
 * Star system definitions for I.D.L.E.
 * Defines system rarity tiers, states (economic/political conditions),
 * and helper functions for distance and construction cost calculations.
 */

import { ResourceStock } from './resource.model';

/**
 * System rarity determines body count, resource multipliers, and spawn probability.
 */
export enum SystemRarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
  Exceptional = 'exceptional',
  Legendary = 'legendary'
}

/**
 * System state represents current economic and political conditions.
 * States provide modifiers to production, population growth, and security.
 */
export enum SystemState {
  // Positive states
  Stable = 'stable',
  Prosperous = 'prosperous',
  Boom = 'boom',
  GoldRush = 'gold_rush',
  GoldenAge = 'golden_age',

  // Negative states
  DisasterRecovery = 'disaster_recovery',
  Famine = 'famine',
  Outbreak = 'outbreak',
  Rioting = 'rioting',
  Insurgency = 'insurgency'
}

/**
 * Definition of system rarity characteristics.
 * Determines spawn chance, body counts, and resource availability.
 */
export interface SystemRarityDefinition {
  rarity: SystemRarity;
  chance: number;
  bodiesMin: number;
  bodiesMax: number;
  description: string;
  resourceMultiplier: number;
}

/**
 * Lookup record for system rarity definitions.
 * Legendary systems are extremely rare (1%) but have up to 15 bodies and 2× resources.
 */
export const SYSTEM_RARITY_DEFINITIONS: Record<SystemRarity, SystemRarityDefinition> = {
  [SystemRarity.Common]: {
    rarity: SystemRarity.Common,
    chance: 0.5,
    bodiesMin: 1,
    bodiesMax: 3,
    description: 'Low resources, basic minerals only',
    resourceMultiplier: 0.8
  },
  [SystemRarity.Uncommon]: {
    rarity: SystemRarity.Uncommon,
    chance: 0.3,
    bodiesMin: 3,
    bodiesMax: 5,
    description: 'Moderate resources, some rare minerals',
    resourceMultiplier: 1.0
  },
  [SystemRarity.Rare]: {
    rarity: SystemRarity.Rare,
    chance: 0.15,
    bodiesMin: 5,
    bodiesMax: 8,
    description: 'Rich resources, exotic materials possible',
    resourceMultiplier: 1.3
  },
  [SystemRarity.Exceptional]: {
    rarity: SystemRarity.Exceptional,
    chance: 0.04,
    bodiesMin: 8,
    bodiesMax: 12,
    description: 'Abundant resources, unique features',
    resourceMultiplier: 1.6
  },
  [SystemRarity.Legendary]: {
    rarity: SystemRarity.Legendary,
    chance: 0.01,
    bodiesMin: 10,
    bodiesMax: 15,
    description: 'Pristine, rare phenomena',
    resourceMultiplier: 2.0
  }
};

/**
 * Definition of system state effects and conditions.
 * Positive states boost production/growth, negative states penalize them.
 */
export interface SystemStateDefinition {
  state: SystemState;
  name: string;
  description: string;
  isPositive: boolean;
  effects: {
    productionModifier?: number;
    populationGrowth?: number;
    securityModifier?: number;
    creditModifier?: number;
  };
}

/**
 * Lookup record for system state definitions.
 * States can be triggered by player actions (low food → Famine) or events.
 */
export const SYSTEM_STATE_DEFINITIONS: Record<SystemState, SystemStateDefinition> = {
  // Positive states
  [SystemState.Stable]: {
    state: SystemState.Stable,
    name: 'Stable',
    description: 'Normal operations, no modifiers',
    isPositive: true,
    effects: {}
  },
  [SystemState.Prosperous]: {
    state: SystemState.Prosperous,
    name: 'Prosperous',
    description: 'High SoL sustained - production bonus, population growth',
    isPositive: true,
    effects: {
      productionModifier: 0.1,
      populationGrowth: 0.1
    }
  },
  [SystemState.Boom]: {
    state: SystemState.Boom,
    name: 'Boom',
    description: 'Temporary major bonus from milestones/events',
    isPositive: true,
    effects: {
      productionModifier: 0.25,
      creditModifier: 0.2
    }
  },
  [SystemState.GoldRush]: {
    state: SystemState.GoldRush,
    name: 'Gold Rush',
    description: 'Rare discovery - temporary bonus, piracy risk',
    isPositive: true,
    effects: {
      productionModifier: 0.3,
      creditModifier: 0.3,
      securityModifier: -0.2
    }
  },
  [SystemState.GoldenAge]: {
    state: SystemState.GoldenAge,
    name: 'Golden Age',
    description: 'Prolonged prosperity - major bonuses all metrics',
    isPositive: true,
    effects: {
      productionModifier: 0.2,
      populationGrowth: 0.2,
      creditModifier: 0.15
    }
  },

  // Negative states
  [SystemState.DisasterRecovery]: {
    state: SystemState.DisasterRecovery,
    name: 'Disaster Recovery',
    description: 'Random event - facilities offline, production penalty',
    isPositive: false,
    effects: {
      productionModifier: -0.3
    }
  },
  [SystemState.Famine]: {
    state: SystemState.Famine,
    name: 'Famine',
    description: 'Food shortage - population decline, unrest risk',
    isPositive: false,
    effects: {
      populationGrowth: -0.2,
      securityModifier: -0.1
    }
  },
  [SystemState.Outbreak]: {
    state: SystemState.Outbreak,
    name: 'Outbreak',
    description: 'Disease - population decline, may spread',
    isPositive: false,
    effects: {
      populationGrowth: -0.3
    }
  },
  [SystemState.Rioting]: {
    state: SystemState.Rioting,
    name: 'Rioting',
    description: 'Low security + SoL - production penalty, damage risk',
    isPositive: false,
    effects: {
      productionModifier: -0.2,
      securityModifier: -0.2
    }
  },
  [SystemState.Insurgency]: {
    state: SystemState.Insurgency,
    name: 'Insurgency',
    description: 'Prolonged rioting - severe penalties',
    isPositive: false,
    effects: {
      productionModifier: -0.4,
      securityModifier: -0.4
    }
  }
};

/**
 * 2D galactic coordinates for star systems.
 * Origin (0,0) is the Sol home system.
 */
export interface Coordinates {
  x: number;
  y: number;
}

/**
 * Runtime instance of a star system in the game state.
 * Contains bodies, facilities, resources, population, and economic metrics.
 */
export interface StarSystem {
  id: string;
  name: string;
  coordinates: Coordinates;
  rarity: SystemRarity;

  // Discovery/survey state
  discovered: boolean;
  discoveredAt?: number; // timestamp
  surveyed: boolean;
  surveyedAt?: number;
  surveyProgress?: number; // 0-100

  // Bodies and facilities
  bodyIds: string[];
  stellarSlots: number; // 1 if ≤5 bodies, 2 if >5

  // System state
  state: SystemState;
  stateExpiresAt?: number;

  // System-wide stats
  totalPopulation: number;
  techLevel: number;
  securityLevel: number;
  standardOfLiving: number; // 0-100

  // Resources in system storage
  resources: ResourceStock[];
  storageCapacity: number;

  // Trade
  hasTradeStation: boolean;
  tradeStationTier: number; // 0 = none, 1-3 for outpost/station/hub

  // Colonization progress
  colonized: boolean;
  colonizationProgress?: number; // 0-100

  // GDD v6 Section 23: Xeno-Science
  anomalous?: boolean; // Rare systems with unique xeno-science properties
  hasXenoDiscovery?: boolean; // Has xeno-compounds or alien artifacts
}

/**
 * Calculate Euclidean distance from Sol (0,0) to given coordinates.
 * Used for xeno-science gating and construction cost scaling.
 *
 * @param coords - Target coordinates
 * @returns Distance in light-years
 */
export function getDistanceFromHome(coords: Coordinates): number {
  return Math.sqrt(coords.x * coords.x + coords.y * coords.y);
}

/**
 * Calculate Euclidean distance between two coordinate points.
 * Used for trade route planning and fuel calculations.
 *
 * @param from - Origin coordinates
 * @param to - Destination coordinates
 * @returns Distance in light-years
 */
export function getRouteDist(from: Coordinates, to: Coordinates): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate construction cost multiplier based on distance and existing facilities.
 * Formula: base_cost × (1.03 ^ distance) × (1.06 ^ facility_count)
 * Encourages building near home; penalizes spam in single system.
 *
 * @param distanceLy - Distance from Sol in light-years
 * @param facilityCount - Number of facilities already in system
 * @returns Cost multiplier to apply to base construction cost
 */
export function calculateConstructionCostMultiplier(
  distanceLy: number,
  facilityCount: number
): number {
  return Math.pow(1.03, distanceLy) * Math.pow(1.06, facilityCount);
}
