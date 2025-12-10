// Celestial body definitions for I.D.L.E.

export enum BodyType {
  Star = 'star',
  TerrestrialPlanet = 'terrestrial_planet',
  TerraformablePlanet = 'terraformable_planet',
  GasGiant = 'gas_giant',
  Moon = 'moon',
  IcyMoon = 'icy_moon'
}

export enum BodyFeature {
  HighMetalContent = 'high_metal_content',
  FertileSoil = 'fertile_soil',
  RareElementDeposits = 'rare_element_deposits',
  ExoticAtmosphere = 'exotic_atmosphere',
  IceDeposits = 'ice_deposits',
  ScenicVistas = 'scenic_vistas',
  Habitable = 'habitable'
}

export interface BodyTypeDefinition {
  type: BodyType;
  name: string;
  orbitalSlots: number;
  surfaceSlots: { min: number; max: number };
  description: string;
  canHavePopulation: boolean;
  populationMultiplier: number;
}

export const BODY_TYPE_DEFINITIONS: Record<BodyType, BodyTypeDefinition> = {
  [BodyType.Star]: {
    type: BodyType.Star,
    name: 'Star',
    orbitalSlots: 2, // 1 if ≤5 bodies, 2 if >5
    surfaceSlots: { min: 0, max: 0 },
    description: 'Central stellar body',
    canHavePopulation: false,
    populationMultiplier: 0
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
    description: 'Planet that can support large populations',
    canHavePopulation: true,
    populationMultiplier: 3 // Major multiplier to population ceiling
  },
  [BodyType.GasGiant]: {
    type: BodyType.GasGiant,
    name: 'Gas Giant',
    orbitalSlots: 3,
    surfaceSlots: { min: 0, max: 0 },
    description: 'Large gas planet for orbital gas harvesting',
    canHavePopulation: false,
    populationMultiplier: 0
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
  };
  validBodyTypes: BodyType[];
  rarity: number; // 0-1, chance to appear
}

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
    validBodyTypes: [BodyType.TerraformablePlanet],
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
    validBodyTypes: [BodyType.TerrestrialPlanet, BodyType.TerraformablePlanet, BodyType.Moon],
    rarity: 0.1
  },
  [BodyFeature.Habitable]: {
    feature: BodyFeature.Habitable,
    name: 'Habitable',
    description: 'Can support large populations without domes',
    bonus: { populationBonus: 0.5 },
    validBodyTypes: [BodyType.TerraformablePlanet],
    rarity: 0.7
  }
};

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

export function generateBodyName(systemName: string, index: number, isMoon: boolean, moonLetter?: string): string {
  if (isMoon && moonLetter) {
    // Find parent planet index from context
    return `${systemName} ${index}-${moonLetter}`;
  }
  return `${systemName} ${index}`;
}
