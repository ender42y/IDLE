// Star system definitions for I.D.L.E.

import { ResourceStock } from './resource.model';

export enum SystemRarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
  Exceptional = 'exceptional',
  Legendary = 'legendary'
}

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

export interface SystemRarityDefinition {
  rarity: SystemRarity;
  chance: number;
  bodiesMin: number;
  bodiesMax: number;
  description: string;
  resourceMultiplier: number;
}

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

export interface Coordinates {
  x: number;
  y: number;
}

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
}

// Helper functions
export function getDistanceFromHome(coords: Coordinates): number {
  return Math.sqrt(coords.x * coords.x + coords.y * coords.y);
}

export function getRouteDist(from: Coordinates, to: Coordinates): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function calculateConstructionCostMultiplier(
  distanceLy: number,
  facilityCount: number
): number {
  // cost = base_price × (1.03 ^ distance_ly) × (1.06 ^ facility_count)
  return Math.pow(1.03, distanceLy) * Math.pow(1.06, facilityCount);
}
