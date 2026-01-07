/**
 * Celestial body definitions for I.D.L.E.
 * Defines the types of celestial bodies, their features, and characteristics
 * that determine facility placement, population capacity, and resource bonuses.
 */

/**
 * Enum representing different types of celestial bodies in the game.
 * Each type has unique properties defined in BODY_TYPE_DEFINITIONS.
 */
export enum BodyType {
  Star = 'star',
  TerrestrialPlanet = 'terrestrial_planet',
  TerraformablePlanet = 'terraformable_planet',
  EarthLikePlanet = 'earth_like_planet',
  GasGiant = 'gas_giant',
  Moon = 'moon',
  IcyMoon = 'icy_moon'
}

/**
 * Enum representing special features that celestial bodies can possess.
 * Features provide production bonuses, resource access, and population benefits.
 */
export enum BodyFeature {
  HighMetalContent = 'high_metal_content',
  FertileSoil = 'fertile_soil',
  RareElementDeposits = 'rare_element_deposits',
  ExoticAtmosphere = 'exotic_atmosphere',
  IceDeposits = 'ice_deposits',
  ScenicVistas = 'scenic_vistas',
  Habitable = 'habitable',
  // GDD v6 Section 23: Xeno-Science features
  XenoDeposits = 'xeno_deposits',
  AlienArtifact = 'alien_artifact'
}

/**
 * Definition interface for celestial body types.
 * Contains all static properties that define a body type's characteristics.
 */
export interface BodyTypeDefinition {
  type: BodyType;
  name: string;
  orbitalSlots: number;
  surfaceSlots: { min: number; max: number };
  description: string;
  canHavePopulation: boolean;
  populationMultiplier: number;
}

/**
 * Lookup record for all body type definitions.
 * Provides O(1) access to body type properties by enum key.
 */
export const BODY_TYPE_DEFINITIONS: Record<BodyType, BodyTypeDefinition> = {
  [BodyType.Star]: {
    type: BodyType.Star,
    name: 'Star',
    orbitalSlots: 2, // 1 if ≤5 bodies, 2 if >5
    surfaceSlots: { min: 0, max: 0 },
    description: 'Central stellar body',
    canHavePopulation: true, // GDD v6: Orbital facilities can have population
    populationMultiplier: 0.5 // GDD v6: Hot, dangerous, minimal comfort
  },
  [BodyType.TerrestrialPlanet]: {
    type: BodyType.TerrestrialPlanet,
    name: 'Terrestrial Planet',
    orbitalSlots: 2,
    surfaceSlots: { min: 1, max: 5 },
    description: 'Rocky planet suitable for surface facilities',
    canHavePopulation: true,
    populationMultiplier: 1
  },
  [BodyType.TerraformablePlanet]: {
    type: BodyType.TerraformablePlanet,
    name: 'Terraformable Planet',
    orbitalSlots: 3,
    surfaceSlots: { min: 3, max: 6 },
    description: 'Planet that can become habitable with good population ceiling',
    canHavePopulation: true,
    populationMultiplier: 1.5 // GDD v6: Good conditions once developed
  },
  [BodyType.EarthLikePlanet]: {
    type: BodyType.EarthLikePlanet,
    name: 'Earth-like Planet',
    orbitalSlots: 3,
    surfaceSlots: { min: 4, max: 6 },
    description: 'Ideal conditions for large populations - the best in the galaxy',
    canHavePopulation: true,
    populationMultiplier: 2.0 // GDD v6: Perfect conditions, everyone wants to live here
  },
  [BodyType.GasGiant]: {
    type: BodyType.GasGiant,
    name: 'Gas Giant',
    orbitalSlots: 3,
    surfaceSlots: { min: 0, max: 0 },
    description: 'Large gas planet for orbital gas harvesting',
    canHavePopulation: true, // GDD v6: Orbital habitats only
    populationMultiplier: 0.6 // GDD v6: Orbital habitats only, less desirable
  },
  [BodyType.Moon]: {
    type: BodyType.Moon,
    name: 'Moon',
    orbitalSlots: 1,
    surfaceSlots: { min: 0, max: 3 },
    description: 'Small rocky satellite',
    canHavePopulation: true,
    populationMultiplier: 0.5
  },
  [BodyType.IcyMoon]: {
    type: BodyType.IcyMoon,
    name: 'Icy Moon',
    orbitalSlots: 1,
    surfaceSlots: { min: 1, max: 2 },
    description: 'Frozen satellite with ice deposits',
    canHavePopulation: true,
    populationMultiplier: 0.3
  }
};

/**
 * Definition interface for body features.
 * Specifies the bonuses, valid body types, and spawn rarity for each feature.
 */
export interface FeatureDefinition {
  feature: BodyFeature;
  name: string;
  description: string;
  bonus: {
    miningOutput?: number;
    agricultureOutput?: number;
    tourismOutput?: number;
    rareElementAccess?: boolean;
    exoticGasAccess?: boolean;
    iceAccess?: boolean;
    populationBonus?: number;
    xenoAccess?: boolean; // GDD v6: Access to xeno-compounds
  };
  validBodyTypes: BodyType[];
  rarity: number; // 0-1, chance to appear
}

/**
 * Lookup record for all feature definitions.
 * Provides O(1) access to feature properties and bonuses.
 */
export const FEATURE_DEFINITIONS: Record<BodyFeature, FeatureDefinition> = {
  [BodyFeature.HighMetalContent]: {
    feature: BodyFeature.HighMetalContent,
    name: 'High Metal Content',
    description: '+25% mining output',
    bonus: { miningOutput: 0.25 },
    validBodyTypes: [BodyType.TerrestrialPlanet, BodyType.Moon],
    rarity: 0.2
  },
  [BodyFeature.FertileSoil]: {
    feature: BodyFeature.FertileSoil,
    name: 'Fertile Soil',
    description: '+25% agriculture output',
    bonus: { agricultureOutput: 0.25 },
    validBodyTypes: [BodyType.TerraformablePlanet, BodyType.EarthLikePlanet],
    rarity: 0.5
  },
  [BodyFeature.RareElementDeposits]: {
    feature: BodyFeature.RareElementDeposits,
    name: 'Rare Element Deposits',
    description: 'Access to rare earth ore',
    bonus: { rareElementAccess: true },
    validBodyTypes: [BodyType.TerrestrialPlanet, BodyType.Moon, BodyType.IcyMoon],
    rarity: 0.1
  },
  [BodyFeature.ExoticAtmosphere]: {
    feature: BodyFeature.ExoticAtmosphere,
    name: 'Exotic Atmosphere',
    description: 'Access to exotic gases',
    bonus: { exoticGasAccess: true },
    validBodyTypes: [BodyType.GasGiant],
    rarity: 0.15
  },
  [BodyFeature.IceDeposits]: {
    feature: BodyFeature.IceDeposits,
    name: 'Ice Deposits',
    description: 'Access to ice for water production',
    bonus: { iceAccess: true },
    validBodyTypes: [BodyType.IcyMoon],
    rarity: 0.9
  },
  [BodyFeature.ScenicVistas]: {
    feature: BodyFeature.ScenicVistas,
    name: 'Scenic Vistas',
    description: '+25% tourism output',
    bonus: { tourismOutput: 0.25 },
    validBodyTypes: [BodyType.TerrestrialPlanet, BodyType.TerraformablePlanet, BodyType.EarthLikePlanet, BodyType.Moon],
    rarity: 0.1
  },
  [BodyFeature.Habitable]: {
    feature: BodyFeature.Habitable,
    name: 'Habitable',
    description: 'Can support large populations without domes',
    bonus: { populationBonus: 0.5 },
    validBodyTypes: [BodyType.TerraformablePlanet, BodyType.EarthLikePlanet],
    rarity: 0.7
  },
  // GDD v6 Section 23: Xeno-Science features (distance-gated, handled separately)
  [BodyFeature.XenoDeposits]: {
    feature: BodyFeature.XenoDeposits,
    name: 'Xeno-Deposits',
    description: 'Contains alien compounds that can be processed for exotic materials',
    bonus: { xenoAccess: true },
    validBodyTypes: [BodyType.TerrestrialPlanet, BodyType.Moon, BodyType.IcyMoon, BodyType.GasGiant],
    rarity: 0 // Handled by distance-based xeno-science gating
  },
  [BodyFeature.AlienArtifact]: {
    feature: BodyFeature.AlienArtifact,
    name: 'Alien Artifact',
    description: 'One-time discovery that unlocks research options',
    bonus: { xenoAccess: true },
    validBodyTypes: [BodyType.TerrestrialPlanet, BodyType.Moon],
    rarity: 0 // Handled by distance-based xeno-science gating
  }
};

/**
 * Runtime instance of a celestial body in the game state.
 * Represents an actual star, planet, or moon with current state including
 * population, facilities, and slot usage.
 */
export interface CelestialBody {
  id: string;
  systemId: string;
  name: string;
  type: BodyType;
  parentBodyId?: string; // for moons
  orbitalSlots: number;
  surfaceSlots: number;
  usedOrbitalSlots: number;
  usedSurfaceSlots: number;
  features: BodyFeature[];
  surveyed: boolean;
  facilityIds: string[];
  population: number;
  populationCeiling: number;
  populationFloor: number;
}

/**
 * Generate a standardized name for a celestial body.
 * Format: SystemName Index (e.g., "Sol 3") or SystemName Index-Letter for moons (e.g., "Sol 3-a")
 *
 * @param systemName - Name of the parent star system
 * @param index - Orbital position index (1-based)
 * @param isMoon - Whether this body is a moon
 * @param moonLetter - Letter designation for moons (a, b, c, etc.)
 * @returns Formatted body name
 */
export function generateBodyName(systemName: string, index: number, isMoon: boolean, moonLetter?: string): string {
  if (isMoon && moonLetter) {
    // Find parent planet index from context
    return `${systemName} ${index}-${moonLetter}`;
  }
  return `${systemName} ${index}`;
}
