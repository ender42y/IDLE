// Facility definitions for I.D.L.E.

import { ResourceId } from './resource.model';

export type FacilityTier = 1 | 2 | 3 | 4 | 5;
export type SlotType = 'surface' | 'orbital' | 'stellar';

export enum EconomyType {
  Agriculture = 'agriculture',
  Mining = 'mining',
  Industry = 'industry',
  Tech = 'tech',
  Military = 'military',
  Finance = 'finance',
  Tourism = 'tourism',
  Medical = 'medical',
  Communications = 'communications',
  XenoSciences = 'xeno_sciences',
  Trade = 'trade'
}

export enum FacilityId {
  // Tier 1: Extraction
  Mine = 'mine',
  HeavyMetalMine = 'heavy_metal_mine',
  RareEarthExcavator = 'rare_earth_excavator',
  SilicateQuarry = 'silicate_quarry',
  IceHarvester = 'ice_harvester',
  GasCollector = 'gas_collector',
  ExoticGasCollector = 'exotic_gas_collector',
  HydrocarbonExtractor = 'hydrocarbon_extractor',
  Farm = 'farm',
  Ranch = 'ranch',

  // Tier 2: Refining
  Smelter = 'smelter',
  HeavyMetalRefinery = 'heavy_metal_refinery',
  RareEarthProcessor = 'rare_earth_processor',
  GlassWorks = 'glass_works',
  WaterPurifier = 'water_purifier',
  FuelRefinery = 'fuel_refinery',
  ExoticCompoundLab = 'exotic_compound_lab',
  ChemicalPlant = 'chemical_plant',
  FoodProcessor = 'food_processor',
  MeatPackingPlant = 'meat_packing_plant',

  // Tier 3: Processing
  ConstructionYard = 'construction_yard',
  AlloyFoundry = 'alloy_foundry',
  PolymerPlant = 'polymer_plant',
  FoodKitchen = 'food_kitchen',
  QualityFoodsFacility = 'quality_foods_facility',
  GourmetKitchen = 'gourmet_kitchen',
  ConsumerFactory = 'consumer_factory',
  MedicalLab = 'medical_lab',

  // Tier 4: Advanced
  ComponentFactory = 'component_factory',
  ElectronicsFab = 'electronics_fab',
  Shipyard = 'shipyard',
  ArmsManufacturer = 'arms_manufacturer',
  ComfortGoodsFactory = 'comfort_goods_factory',
  PharmaceuticalPlant = 'pharmaceutical_plant',
  AiLaboratory = 'ai_laboratory',

  // Tier 5: High-Tech
  LuxuryGoodsAtelier = 'luxury_goods_atelier',
  QuantumLab = 'quantum_lab',
  SyntheticMindForge = 'synthetic_mind_forge',

  // Support Facilities
  TradeOutpost = 'trade_outpost',
  TradeStation = 'trade_station',
  TradeHub = 'trade_hub',
  ResearchCenter = 'research_center',
  SecurityStation = 'security_station',
  CommsOutpost = 'comms_outpost',
  CommsStation = 'comms_station',
  CommsHub = 'comms_hub',
  FinancialCenter = 'financial_center',
  TourismCenter = 'tourism_center'
}

export interface FacilityProduction {
  output: ResourceId;
  baseRate: number; // t/h
}

export interface FacilityConversion {
  inputs: { resourceId: ResourceId; amount: number }[];
  output: ResourceId;
  throughput: number; // t/h capacity
  efficiency: number; // 0-1
}

export interface FacilityDefinition {
  id: FacilityId;
  name: string;
  tier: FacilityTier;
  slotType: SlotType;
  economy: EconomyType;
  description: string;

  // Base construction cost (scaled by distance and facility count)
  baseCost: {
    credits: number;
    resources: { resourceId: ResourceId; amount: number }[];
  };

  // Either produces raw resources or converts inputs
  production?: FacilityProduction;
  conversion?: FacilityConversion;

  // Support facility bonuses
  bonuses?: {
    tradeCapacity?: number;
    techLevel?: number;
    securityLevel?: number;
    commsRange?: number;
    commsReliability?: number;
    creditBonus?: number;
    solBonus?: number; // Standard of Living
  };

  // Population floor contribution
  populationFloor: number;
}

export interface Facility {
  id: string; // unique instance id
  definitionId: FacilityId;
  bodyId: string;
  level: number;
  condition: number; // 0-100%
  operational: boolean;
  constructionProgress?: number; // 0-100 during building
}

// Facility definitions
export const FACILITY_DEFINITIONS: Record<FacilityId, FacilityDefinition> = {
  // === TIER 1: EXTRACTION FACILITIES ===
  [FacilityId.Mine]: {
    id: FacilityId.Mine,
    name: 'Mine',
    tier: 1,
    slotType: 'surface',
    economy: EconomyType.Mining,
    description: 'Extracts iron ore from rocky bodies',
    baseCost: {
      credits: 1000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 50 },
        { resourceId: ResourceId.GlassCeramics, amount: 20 }
      ]
    },
    production: {
      output: ResourceId.IronOre,
      baseRate: 100
    },
    populationFloor: 50
  },

  [FacilityId.HeavyMetalMine]: {
    id: FacilityId.HeavyMetalMine,
    name: 'Heavy Metal Mine',
    tier: 1,
    slotType: 'surface',
    economy: EconomyType.Mining,
    description: 'Extracts dense metal ores',
    baseCost: {
      credits: 2000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 80 },
        { resourceId: ResourceId.GlassCeramics, amount: 30 }
      ]
    },
    production: {
      output: ResourceId.HeavyMetalOre,
      baseRate: 100
    },
    populationFloor: 60
  },

  [FacilityId.RareEarthExcavator]: {
    id: FacilityId.RareEarthExcavator,
    name: 'Rare Earth Excavator',
    tier: 1,
    slotType: 'surface',
    economy: EconomyType.Mining,
    description: 'Extracts valuable rare earth minerals',
    baseCost: {
      credits: 5000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 100 },
        { resourceId: ResourceId.GlassCeramics, amount: 50 },
        { resourceId: ResourceId.Components, amount: 10 }
      ]
    },
    production: {
      output: ResourceId.RareEarthOre,
      baseRate: 100
    },
    populationFloor: 40
  },

  [FacilityId.SilicateQuarry]: {
    id: FacilityId.SilicateQuarry,
    name: 'Silicate Quarry',
    tier: 1,
    slotType: 'surface',
    economy: EconomyType.Mining,
    description: 'Harvests silicate minerals for glass production',
    baseCost: {
      credits: 800,
      resources: [
        { resourceId: ResourceId.Steel, amount: 40 }
      ]
    },
    production: {
      output: ResourceId.Silicates,
      baseRate: 100
    },
    populationFloor: 30
  },

  [FacilityId.IceHarvester]: {
    id: FacilityId.IceHarvester,
    name: 'Ice Harvester',
    tier: 1,
    slotType: 'surface',
    economy: EconomyType.Mining,
    description: 'Collects ice deposits for water purification',
    baseCost: {
      credits: 600,
      resources: [
        { resourceId: ResourceId.Steel, amount: 30 },
        { resourceId: ResourceId.GlassCeramics, amount: 15 }
      ]
    },
    production: {
      output: ResourceId.Ice,
      baseRate: 100
    },
    populationFloor: 25
  },

  [FacilityId.GasCollector]: {
    id: FacilityId.GasCollector,
    name: 'Gas Collector',
    tier: 1,
    slotType: 'orbital',
    economy: EconomyType.Mining,
    description: 'Harvests atmospheric gases from gas giants',
    baseCost: {
      credits: 1500,
      resources: [
        { resourceId: ResourceId.Steel, amount: 60 },
        { resourceId: ResourceId.GlassCeramics, amount: 40 }
      ]
    },
    production: {
      output: ResourceId.AtmosphericGases,
      baseRate: 100
    },
    populationFloor: 35
  },

  [FacilityId.ExoticGasCollector]: {
    id: FacilityId.ExoticGasCollector,
    name: 'Exotic Gas Collector',
    tier: 1,
    slotType: 'orbital',
    economy: EconomyType.Mining,
    description: 'Harvests rare exotic gases',
    baseCost: {
      credits: 8000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 100 },
        { resourceId: ResourceId.GlassCeramics, amount: 60 },
        { resourceId: ResourceId.Components, amount: 20 }
      ]
    },
    production: {
      output: ResourceId.ExoticGases,
      baseRate: 100
    },
    populationFloor: 30
  },

  [FacilityId.HydrocarbonExtractor]: {
    id: FacilityId.HydrocarbonExtractor,
    name: 'Hydrocarbon Extractor',
    tier: 1,
    slotType: 'surface',
    economy: EconomyType.Mining,
    description: 'Extracts hydrocarbon compounds',
    baseCost: {
      credits: 1200,
      resources: [
        { resourceId: ResourceId.Steel, amount: 50 },
        { resourceId: ResourceId.GlassCeramics, amount: 25 }
      ]
    },
    production: {
      output: ResourceId.Hydrocarbons,
      baseRate: 100
    },
    populationFloor: 40
  },

  [FacilityId.Farm]: {
    id: FacilityId.Farm,
    name: 'Farm',
    tier: 1,
    slotType: 'surface',
    economy: EconomyType.Agriculture,
    description: 'Grows organic crops',
    baseCost: {
      credits: 500,
      resources: [
        { resourceId: ResourceId.Steel, amount: 20 },
        { resourceId: ResourceId.GlassCeramics, amount: 30 }
      ]
    },
    production: {
      output: ResourceId.Organics,
      baseRate: 100
    },
    populationFloor: 100
  },

  [FacilityId.Ranch]: {
    id: FacilityId.Ranch,
    name: 'Ranch',
    tier: 1,
    slotType: 'surface',
    economy: EconomyType.Agriculture,
    description: 'Raises livestock for meat production',
    baseCost: {
      credits: 800,
      resources: [
        { resourceId: ResourceId.Steel, amount: 30 },
        { resourceId: ResourceId.GlassCeramics, amount: 20 }
      ]
    },
    production: {
      output: ResourceId.Livestock,
      baseRate: 80
    },
    populationFloor: 80
  },

  // === TIER 2: REFINING FACILITIES ===
  [FacilityId.Smelter]: {
    id: FacilityId.Smelter,
    name: 'Smelter',
    tier: 2,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Converts iron ore to steel',
    baseCost: {
      credits: 2000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 80 },
        { resourceId: ResourceId.GlassCeramics, amount: 40 }
      ]
    },
    conversion: {
      inputs: [{ resourceId: ResourceId.IronOre, amount: 1 }],
      output: ResourceId.Steel,
      throughput: 200,
      efficiency: 0.5
    },
    populationFloor: 75
  },

  [FacilityId.HeavyMetalRefinery]: {
    id: FacilityId.HeavyMetalRefinery,
    name: 'Heavy Metal Refinery',
    tier: 2,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Refines heavy metal ores',
    baseCost: {
      credits: 3000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 100 },
        { resourceId: ResourceId.GlassCeramics, amount: 50 }
      ]
    },
    conversion: {
      inputs: [{ resourceId: ResourceId.HeavyMetalOre, amount: 1 }],
      output: ResourceId.HeavyMetals,
      throughput: 200,
      efficiency: 0.4
    },
    populationFloor: 60
  },

  [FacilityId.RareEarthProcessor]: {
    id: FacilityId.RareEarthProcessor,
    name: 'Rare Earth Processor',
    tier: 2,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Processes rare earth minerals',
    baseCost: {
      credits: 6000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 120 },
        { resourceId: ResourceId.GlassCeramics, amount: 80 },
        { resourceId: ResourceId.Components, amount: 15 }
      ]
    },
    conversion: {
      inputs: [{ resourceId: ResourceId.RareEarthOre, amount: 1 }],
      output: ResourceId.RareEarths,
      throughput: 200,
      efficiency: 0.3
    },
    populationFloor: 50
  },

  [FacilityId.GlassWorks]: {
    id: FacilityId.GlassWorks,
    name: 'Glass Works',
    tier: 2,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Produces glass and ceramics',
    baseCost: {
      credits: 1500,
      resources: [
        { resourceId: ResourceId.Steel, amount: 60 }
      ]
    },
    conversion: {
      inputs: [{ resourceId: ResourceId.Silicates, amount: 1 }],
      output: ResourceId.GlassCeramics,
      throughput: 200,
      efficiency: 0.7
    },
    populationFloor: 50
  },

  [FacilityId.WaterPurifier]: {
    id: FacilityId.WaterPurifier,
    name: 'Water Purifier',
    tier: 2,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Purifies ice into drinking water',
    baseCost: {
      credits: 1000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 40 },
        { resourceId: ResourceId.GlassCeramics, amount: 30 }
      ]
    },
    conversion: {
      inputs: [{ resourceId: ResourceId.Ice, amount: 1 }],
      output: ResourceId.PurifiedWater,
      throughput: 200,
      efficiency: 0.85
    },
    populationFloor: 40
  },

  [FacilityId.FuelRefinery]: {
    id: FacilityId.FuelRefinery,
    name: 'Fuel Refinery',
    tier: 2,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Produces ship fuel from gases and hydrocarbons',
    baseCost: {
      credits: 2500,
      resources: [
        { resourceId: ResourceId.Steel, amount: 100 },
        { resourceId: ResourceId.GlassCeramics, amount: 50 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.AtmosphericGases, amount: 0.5 },
        { resourceId: ResourceId.Hydrocarbons, amount: 0.5 }
      ],
      output: ResourceId.Fuel,
      throughput: 200,
      efficiency: 0.6
    },
    populationFloor: 60
  },

  [FacilityId.ExoticCompoundLab]: {
    id: FacilityId.ExoticCompoundLab,
    name: 'Exotic Compound Lab',
    tier: 2,
    slotType: 'orbital',
    economy: EconomyType.Tech,
    description: 'Synthesizes exotic compounds',
    baseCost: {
      credits: 10000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 80 },
        { resourceId: ResourceId.GlassCeramics, amount: 100 },
        { resourceId: ResourceId.Components, amount: 30 }
      ]
    },
    conversion: {
      inputs: [{ resourceId: ResourceId.ExoticGases, amount: 1 }],
      output: ResourceId.ExoticCompounds,
      throughput: 200,
      efficiency: 0.35
    },
    populationFloor: 30
  },

  [FacilityId.ChemicalPlant]: {
    id: FacilityId.ChemicalPlant,
    name: 'Chemical Plant',
    tier: 2,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Produces industrial chemicals',
    baseCost: {
      credits: 2000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 70 },
        { resourceId: ResourceId.GlassCeramics, amount: 50 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.Hydrocarbons, amount: 0.7 },
        { resourceId: ResourceId.PurifiedWater, amount: 0.3 }
      ],
      output: ResourceId.IndustrialChemicals,
      throughput: 200,
      efficiency: 0.65
    },
    populationFloor: 55
  },

  [FacilityId.FoodProcessor]: {
    id: FacilityId.FoodProcessor,
    name: 'Food Processor',
    tier: 2,
    slotType: 'surface',
    economy: EconomyType.Agriculture,
    description: 'Processes raw organics into grain and produce',
    baseCost: {
      credits: 1200,
      resources: [
        { resourceId: ResourceId.Steel, amount: 50 },
        { resourceId: ResourceId.GlassCeramics, amount: 40 }
      ]
    },
    conversion: {
      inputs: [{ resourceId: ResourceId.Organics, amount: 1 }],
      output: ResourceId.GrainProduce,
      throughput: 200,
      efficiency: 0.7
    },
    populationFloor: 60
  },

  [FacilityId.MeatPackingPlant]: {
    id: FacilityId.MeatPackingPlant,
    name: 'Meat Packing Plant',
    tier: 2,
    slotType: 'surface',
    economy: EconomyType.Agriculture,
    description: 'Processes livestock into meat products',
    baseCost: {
      credits: 1500,
      resources: [
        { resourceId: ResourceId.Steel, amount: 60 },
        { resourceId: ResourceId.GlassCeramics, amount: 30 }
      ]
    },
    conversion: {
      inputs: [{ resourceId: ResourceId.Livestock, amount: 1 }],
      output: ResourceId.MeatAnimalProducts,
      throughput: 200,
      efficiency: 0.5
    },
    populationFloor: 50
  },

  // === TIER 3: PROCESSING FACILITIES ===
  [FacilityId.ConstructionYard]: {
    id: FacilityId.ConstructionYard,
    name: 'Construction Yard',
    tier: 3,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Produces structural materials',
    baseCost: {
      credits: 3000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 150 },
        { resourceId: ResourceId.GlassCeramics, amount: 100 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.Steel, amount: 0.6 },
        { resourceId: ResourceId.GlassCeramics, amount: 0.4 }
      ],
      output: ResourceId.StructuralMaterials,
      throughput: 160,
      efficiency: 0.8
    },
    populationFloor: 80
  },

  [FacilityId.AlloyFoundry]: {
    id: FacilityId.AlloyFoundry,
    name: 'Alloy Foundry',
    tier: 3,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Creates advanced alloys',
    baseCost: {
      credits: 4000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 120 },
        { resourceId: ResourceId.GlassCeramics, amount: 80 },
        { resourceId: ResourceId.Components, amount: 10 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.Steel, amount: 0.5 },
        { resourceId: ResourceId.HeavyMetals, amount: 0.5 }
      ],
      output: ResourceId.Alloys,
      throughput: 160,
      efficiency: 0.75
    },
    populationFloor: 70
  },

  [FacilityId.PolymerPlant]: {
    id: FacilityId.PolymerPlant,
    name: 'Polymer Plant',
    tier: 3,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Produces synthetic polymers',
    baseCost: {
      credits: 2500,
      resources: [
        { resourceId: ResourceId.Steel, amount: 80 },
        { resourceId: ResourceId.GlassCeramics, amount: 60 }
      ]
    },
    conversion: {
      inputs: [{ resourceId: ResourceId.IndustrialChemicals, amount: 1 }],
      output: ResourceId.Polymers,
      throughput: 160,
      efficiency: 0.7
    },
    populationFloor: 55
  },

  [FacilityId.FoodKitchen]: {
    id: FacilityId.FoodKitchen,
    name: 'Food Kitchen',
    tier: 3,
    slotType: 'surface',
    economy: EconomyType.Agriculture,
    description: 'Prepares basic food from grain',
    baseCost: {
      credits: 1800,
      resources: [
        { resourceId: ResourceId.Steel, amount: 60 },
        { resourceId: ResourceId.GlassCeramics, amount: 50 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.GrainProduce, amount: 0.8 },
        { resourceId: ResourceId.PurifiedWater, amount: 0.2 }
      ],
      output: ResourceId.PreparedFoods,
      throughput: 160,
      efficiency: 0.85
    },
    populationFloor: 70
  },

  [FacilityId.QualityFoodsFacility]: {
    id: FacilityId.QualityFoodsFacility,
    name: 'Quality Foods Facility',
    tier: 3,
    slotType: 'surface',
    economy: EconomyType.Agriculture,
    description: 'Produces quality meals',
    baseCost: {
      credits: 3000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 80 },
        { resourceId: ResourceId.GlassCeramics, amount: 70 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.PreparedFoods, amount: 0.6 },
        { resourceId: ResourceId.MeatAnimalProducts, amount: 0.4 }
      ],
      output: ResourceId.QualityFoods,
      throughput: 160,
      efficiency: 0.75
    },
    populationFloor: 60
  },

  [FacilityId.GourmetKitchen]: {
    id: FacilityId.GourmetKitchen,
    name: 'Gourmet Kitchen',
    tier: 3,
    slotType: 'surface',
    economy: EconomyType.Agriculture,
    description: 'Creates luxury cuisine',
    baseCost: {
      credits: 8000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 60 },
        { resourceId: ResourceId.GlassCeramics, amount: 100 },
        { resourceId: ResourceId.Components, amount: 20 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.QualityFoods, amount: 0.7 },
        { resourceId: ResourceId.ExoticCompounds, amount: 0.3 }
      ],
      output: ResourceId.GourmetFoods,
      throughput: 160,
      efficiency: 0.4
    },
    populationFloor: 40
  },

  [FacilityId.ConsumerFactory]: {
    id: FacilityId.ConsumerFactory,
    name: 'Consumer Factory',
    tier: 3,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Produces basic consumer goods',
    baseCost: {
      credits: 2200,
      resources: [
        { resourceId: ResourceId.Steel, amount: 90 },
        { resourceId: ResourceId.GlassCeramics, amount: 60 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.Polymers, amount: 0.6 },
        { resourceId: ResourceId.Steel, amount: 0.4 }
      ],
      output: ResourceId.BasicGoods,
      throughput: 160,
      efficiency: 0.8
    },
    populationFloor: 80
  },

  [FacilityId.MedicalLab]: {
    id: FacilityId.MedicalLab,
    name: 'Medical Lab',
    tier: 3,
    slotType: 'surface',
    economy: EconomyType.Medical,
    description: 'Produces medical supplies',
    baseCost: {
      credits: 3500,
      resources: [
        { resourceId: ResourceId.Steel, amount: 70 },
        { resourceId: ResourceId.GlassCeramics, amount: 90 },
        { resourceId: ResourceId.Components, amount: 15 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.IndustrialChemicals, amount: 0.6 },
        { resourceId: ResourceId.Organics, amount: 0.4 }
      ],
      output: ResourceId.MedicalSupplies,
      throughput: 160,
      efficiency: 0.6
    },
    populationFloor: 45
  },

  // === TIER 4: ADVANCED FACILITIES ===
  [FacilityId.ComponentFactory]: {
    id: FacilityId.ComponentFactory,
    name: 'Component Factory',
    tier: 4,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Manufactures mechanical components',
    baseCost: {
      credits: 5000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 150 },
        { resourceId: ResourceId.GlassCeramics, amount: 100 },
        { resourceId: ResourceId.Alloys, amount: 30 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.Alloys, amount: 0.6 },
        { resourceId: ResourceId.Polymers, amount: 0.4 }
      ],
      output: ResourceId.Components,
      throughput: 80,
      efficiency: 0.7
    },
    populationFloor: 90
  },

  [FacilityId.ElectronicsFab]: {
    id: FacilityId.ElectronicsFab,
    name: 'Electronics Fab',
    tier: 4,
    slotType: 'surface',
    economy: EconomyType.Tech,
    description: 'Fabricates electronic circuits',
    baseCost: {
      credits: 8000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 100 },
        { resourceId: ResourceId.GlassCeramics, amount: 150 },
        { resourceId: ResourceId.Components, amount: 50 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.Components, amount: 0.4 },
        { resourceId: ResourceId.RareEarths, amount: 0.3 },
        { resourceId: ResourceId.GlassCeramics, amount: 0.3 }
      ],
      output: ResourceId.Electronics,
      throughput: 80,
      efficiency: 0.5
    },
    populationFloor: 60
  },

  [FacilityId.Shipyard]: {
    id: FacilityId.Shipyard,
    name: 'Shipyard',
    tier: 4,
    slotType: 'orbital',
    economy: EconomyType.Industry,
    description: 'Builds ship parts',
    baseCost: {
      credits: 10000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 200 },
        { resourceId: ResourceId.GlassCeramics, amount: 100 },
        { resourceId: ResourceId.Alloys, amount: 50 },
        { resourceId: ResourceId.Components, amount: 30 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.Components, amount: 0.4 },
        { resourceId: ResourceId.Alloys, amount: 0.4 },
        { resourceId: ResourceId.Polymers, amount: 0.2 }
      ],
      output: ResourceId.ShipParts,
      throughput: 80,
      efficiency: 0.6
    },
    populationFloor: 100
  },

  [FacilityId.ArmsManufacturer]: {
    id: FacilityId.ArmsManufacturer,
    name: 'Arms Manufacturer',
    tier: 4,
    slotType: 'surface',
    economy: EconomyType.Military,
    description: 'Produces weapons',
    baseCost: {
      credits: 7000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 120 },
        { resourceId: ResourceId.GlassCeramics, amount: 80 },
        { resourceId: ResourceId.Components, amount: 40 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.Components, amount: 0.4 },
        { resourceId: ResourceId.Electronics, amount: 0.3 },
        { resourceId: ResourceId.HeavyMetals, amount: 0.3 }
      ],
      output: ResourceId.Weapons,
      throughput: 80,
      efficiency: 0.55
    },
    populationFloor: 70
  },

  [FacilityId.ComfortGoodsFactory]: {
    id: FacilityId.ComfortGoodsFactory,
    name: 'Comfort Goods Factory',
    tier: 4,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Produces consumer electronics and comfort items',
    baseCost: {
      credits: 5500,
      resources: [
        { resourceId: ResourceId.Steel, amount: 100 },
        { resourceId: ResourceId.GlassCeramics, amount: 90 },
        { resourceId: ResourceId.Components, amount: 35 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.BasicGoods, amount: 0.6 },
        { resourceId: ResourceId.Electronics, amount: 0.4 }
      ],
      output: ResourceId.ComfortGoods,
      throughput: 80,
      efficiency: 0.65
    },
    populationFloor: 75
  },

  [FacilityId.PharmaceuticalPlant]: {
    id: FacilityId.PharmaceuticalPlant,
    name: 'Pharmaceutical Plant',
    tier: 4,
    slotType: 'surface',
    economy: EconomyType.Medical,
    description: 'Produces advanced medicines',
    baseCost: {
      credits: 6000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 80 },
        { resourceId: ResourceId.GlassCeramics, amount: 120 },
        { resourceId: ResourceId.Components, amount: 40 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.MedicalSupplies, amount: 0.6 },
        { resourceId: ResourceId.Electronics, amount: 0.4 }
      ],
      output: ResourceId.Pharmaceuticals,
      throughput: 80,
      efficiency: 0.5
    },
    populationFloor: 50
  },

  [FacilityId.AiLaboratory]: {
    id: FacilityId.AiLaboratory,
    name: 'AI Laboratory',
    tier: 4,
    slotType: 'surface',
    economy: EconomyType.Tech,
    description: 'Develops AI cores',
    baseCost: {
      credits: 15000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 80 },
        { resourceId: ResourceId.GlassCeramics, amount: 150 },
        { resourceId: ResourceId.Components, amount: 60 },
        { resourceId: ResourceId.Electronics, amount: 30 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.Electronics, amount: 0.7 },
        { resourceId: ResourceId.RareEarths, amount: 0.3 }
      ],
      output: ResourceId.AiCores,
      throughput: 80,
      efficiency: 0.35
    },
    populationFloor: 40
  },

  // === TIER 5: HIGH-TECH FACILITIES ===
  [FacilityId.LuxuryGoodsAtelier]: {
    id: FacilityId.LuxuryGoodsAtelier,
    name: 'Luxury Goods Atelier',
    tier: 5,
    slotType: 'surface',
    economy: EconomyType.Industry,
    description: 'Creates luxury consumer products',
    baseCost: {
      credits: 20000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 100 },
        { resourceId: ResourceId.GlassCeramics, amount: 150 },
        { resourceId: ResourceId.Components, amount: 50 },
        { resourceId: ResourceId.Electronics, amount: 40 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.ComfortGoods, amount: 0.5 },
        { resourceId: ResourceId.RareEarths, amount: 0.3 },
        { resourceId: ResourceId.ExoticCompounds, amount: 0.2 }
      ],
      output: ResourceId.LuxuryGoods,
      throughput: 20,
      efficiency: 0.4
    },
    populationFloor: 30
  },

  [FacilityId.QuantumLab]: {
    id: FacilityId.QuantumLab,
    name: 'Quantum Lab',
    tier: 5,
    slotType: 'orbital',
    economy: EconomyType.XenoSciences,
    description: 'Produces quantum materials',
    baseCost: {
      credits: 50000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 100 },
        { resourceId: ResourceId.GlassCeramics, amount: 200 },
        { resourceId: ResourceId.Components, amount: 80 },
        { resourceId: ResourceId.Electronics, amount: 60 },
        { resourceId: ResourceId.AiCores, amount: 10 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.AiCores, amount: 0.6 },
        { resourceId: ResourceId.ExoticCompounds, amount: 0.4 }
      ],
      output: ResourceId.QuantumMaterials,
      throughput: 20,
      efficiency: 0.25
    },
    populationFloor: 25
  },

  [FacilityId.SyntheticMindForge]: {
    id: FacilityId.SyntheticMindForge,
    name: 'Synthetic Mind Forge',
    tier: 5,
    slotType: 'orbital',
    economy: EconomyType.XenoSciences,
    description: 'Creates synthetic consciousness',
    baseCost: {
      credits: 100000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 150 },
        { resourceId: ResourceId.GlassCeramics, amount: 250 },
        { resourceId: ResourceId.Components, amount: 100 },
        { resourceId: ResourceId.Electronics, amount: 80 },
        { resourceId: ResourceId.AiCores, amount: 20 },
        { resourceId: ResourceId.QuantumMaterials, amount: 5 }
      ]
    },
    conversion: {
      inputs: [
        { resourceId: ResourceId.AiCores, amount: 0.6 },
        { resourceId: ResourceId.QuantumMaterials, amount: 0.4 }
      ],
      output: ResourceId.SyntheticMinds,
      throughput: 20,
      efficiency: 0.2
    },
    populationFloor: 20
  },

  // === SUPPORT FACILITIES ===
  [FacilityId.TradeOutpost]: {
    id: FacilityId.TradeOutpost,
    name: 'Trade Outpost',
    tier: 1,
    slotType: 'orbital',
    economy: EconomyType.Trade,
    description: 'Basic trade facility for light ships',
    baseCost: {
      credits: 2000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 100 },
        { resourceId: ResourceId.GlassCeramics, amount: 50 }
      ]
    },
    bonuses: {
      tradeCapacity: 1
    },
    populationFloor: 50
  },

  [FacilityId.TradeStation]: {
    id: FacilityId.TradeStation,
    name: 'Trade Station',
    tier: 2,
    slotType: 'orbital',
    economy: EconomyType.Trade,
    description: 'Medium trade facility for light and medium ships',
    baseCost: {
      credits: 5000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 200 },
        { resourceId: ResourceId.GlassCeramics, amount: 100 },
        { resourceId: ResourceId.Components, amount: 20 }
      ]
    },
    bonuses: {
      tradeCapacity: 2
    },
    populationFloor: 100
  },

  [FacilityId.TradeHub]: {
    id: FacilityId.TradeHub,
    name: 'Trade Hub',
    tier: 3,
    slotType: 'orbital',
    economy: EconomyType.Trade,
    description: 'Large trade facility for all ship sizes',
    baseCost: {
      credits: 15000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 400 },
        { resourceId: ResourceId.GlassCeramics, amount: 200 },
        { resourceId: ResourceId.Components, amount: 50 },
        { resourceId: ResourceId.Electronics, amount: 20 }
      ]
    },
    bonuses: {
      tradeCapacity: 3
    },
    populationFloor: 200
  },

  [FacilityId.ResearchCenter]: {
    id: FacilityId.ResearchCenter,
    name: 'Research Center',
    tier: 2,
    slotType: 'surface',
    economy: EconomyType.Tech,
    description: 'Raises system tech level',
    baseCost: {
      credits: 8000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 100 },
        { resourceId: ResourceId.GlassCeramics, amount: 150 },
        { resourceId: ResourceId.Components, amount: 30 }
      ]
    },
    bonuses: {
      techLevel: 1
    },
    populationFloor: 80
  },

  [FacilityId.SecurityStation]: {
    id: FacilityId.SecurityStation,
    name: 'Security Station',
    tier: 2,
    slotType: 'orbital',
    economy: EconomyType.Military,
    description: 'Raises system security level',
    baseCost: {
      credits: 4000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 120 },
        { resourceId: ResourceId.GlassCeramics, amount: 60 },
        { resourceId: ResourceId.Components, amount: 15 }
      ]
    },
    bonuses: {
      securityLevel: 1
    },
    populationFloor: 60
  },

  [FacilityId.CommsOutpost]: {
    id: FacilityId.CommsOutpost,
    name: 'Comms Outpost',
    tier: 1,
    slotType: 'orbital',
    economy: EconomyType.Communications,
    description: 'Basic communications relay',
    baseCost: {
      credits: 1500,
      resources: [
        { resourceId: ResourceId.Steel, amount: 50 },
        { resourceId: ResourceId.GlassCeramics, amount: 40 }
      ]
    },
    bonuses: {
      commsRange: 10,
      commsReliability: 0.05
    },
    populationFloor: 20
  },

  [FacilityId.CommsStation]: {
    id: FacilityId.CommsStation,
    name: 'Comms Station',
    tier: 2,
    slotType: 'orbital',
    economy: EconomyType.Communications,
    description: 'Medium communications relay',
    baseCost: {
      credits: 4000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 80 },
        { resourceId: ResourceId.GlassCeramics, amount: 80 },
        { resourceId: ResourceId.Components, amount: 20 }
      ]
    },
    bonuses: {
      commsRange: 20,
      commsReliability: 0.1
    },
    populationFloor: 40
  },

  [FacilityId.CommsHub]: {
    id: FacilityId.CommsHub,
    name: 'Comms Hub',
    tier: 3,
    slotType: 'orbital',
    economy: EconomyType.Communications,
    description: 'Advanced communications hub',
    baseCost: {
      credits: 10000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 120 },
        { resourceId: ResourceId.GlassCeramics, amount: 150 },
        { resourceId: ResourceId.Components, amount: 50 },
        { resourceId: ResourceId.Electronics, amount: 30 }
      ]
    },
    bonuses: {
      commsRange: 30,
      commsReliability: 0.15
    },
    populationFloor: 60
  },

  [FacilityId.FinancialCenter]: {
    id: FacilityId.FinancialCenter,
    name: 'Financial Center',
    tier: 3,
    slotType: 'orbital',
    economy: EconomyType.Finance,
    description: 'Improves trade exchange rates',
    baseCost: {
      credits: 12000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 100 },
        { resourceId: ResourceId.GlassCeramics, amount: 120 },
        { resourceId: ResourceId.Components, amount: 40 },
        { resourceId: ResourceId.Electronics, amount: 25 }
      ]
    },
    bonuses: {
      creditBonus: 0.05
    },
    populationFloor: 100
  },

  [FacilityId.TourismCenter]: {
    id: FacilityId.TourismCenter,
    name: 'Tourism Center',
    tier: 2,
    slotType: 'surface',
    economy: EconomyType.Tourism,
    description: 'Generates credits and boosts standard of living',
    baseCost: {
      credits: 6000,
      resources: [
        { resourceId: ResourceId.Steel, amount: 80 },
        { resourceId: ResourceId.GlassCeramics, amount: 100 }
      ]
    },
    bonuses: {
      creditBonus: 0.02,
      solBonus: 0.1
    },
    populationFloor: 120
  }
};
