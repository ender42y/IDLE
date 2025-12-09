// Resource definitions for I.D.L.E.
// All materials measured in tonnes (t), rates in tonnes/hour (t/h)

export type ResourceTier = 1 | 2 | 3 | 4 | 5;

export enum ResourceId {
  // Tier 1: Raw Resources
  IronOre = 'iron_ore',
  HeavyMetalOre = 'heavy_metal_ore',
  RareEarthOre = 'rare_earth_ore',
  Silicates = 'silicates',
  Ice = 'ice',
  AtmosphericGases = 'atmospheric_gases',
  ExoticGases = 'exotic_gases',
  Hydrocarbons = 'hydrocarbons',
  Organics = 'organics',
  Livestock = 'livestock',

  // Tier 2: Refined Resources
  Steel = 'steel',
  HeavyMetals = 'heavy_metals',
  RareEarths = 'rare_earths',
  GlassCeramics = 'glass_ceramics',
  PurifiedWater = 'purified_water',
  Fuel = 'fuel',
  ExoticCompounds = 'exotic_compounds',
  IndustrialChemicals = 'industrial_chemicals',
  GrainProduce = 'grain_produce',
  MeatAnimalProducts = 'meat_animal_products',

  // Tier 3: Processed Resources
  StructuralMaterials = 'structural_materials',
  Alloys = 'alloys',
  Polymers = 'polymers',
  PreparedFoods = 'prepared_foods',
  QualityFoods = 'quality_foods',
  GourmetFoods = 'gourmet_foods',
  BasicGoods = 'basic_goods',
  MedicalSupplies = 'medical_supplies',

  // Tier 4: Advanced Resources
  Components = 'components',
  Electronics = 'electronics',
  ShipParts = 'ship_parts',
  Weapons = 'weapons',
  ComfortGoods = 'comfort_goods',
  Pharmaceuticals = 'pharmaceuticals',
  AiCores = 'ai_cores',

  // Tier 5: High-Tech Resources
  LuxuryGoods = 'luxury_goods',
  QuantumMaterials = 'quantum_materials',
  XenoCompounds = 'xeno_compounds',
  SyntheticMinds = 'synthetic_minds',

  // Special: Credits (not a physical resource)
  Credits = 'credits'
}

export interface ResourceDefinition {
  id: ResourceId;
  name: string;
  tier: ResourceTier;
  description: string;
  basePrice: number; // credits per tonne
  isConsumable?: boolean; // consumed by population
}

export interface ResourceRecipe {
  inputs: { resourceId: ResourceId; amount: number }[];
  output: ResourceId;
  efficiency: number; // 0-1, percentage converted
  throughput: number; // t/h capacity
}

export interface ResourceStock {
  resourceId: ResourceId;
  amount: number;
  capacity: number;
}

// Resource definitions
export const RESOURCE_DEFINITIONS: Record<ResourceId, ResourceDefinition> = {
  // Tier 1: Raw Resources
  [ResourceId.IronOre]: {
    id: ResourceId.IronOre,
    name: 'Iron Ore',
    tier: 1,
    description: 'Common mineral used for steel production',
    basePrice: 5
  },
  [ResourceId.HeavyMetalOre]: {
    id: ResourceId.HeavyMetalOre,
    name: 'Heavy Metal Ore',
    tier: 1,
    description: 'Dense metallic ore for alloy production',
    basePrice: 15
  },
  [ResourceId.RareEarthOre]: {
    id: ResourceId.RareEarthOre,
    name: 'Rare Earth Ore',
    tier: 1,
    description: 'Valuable minerals for electronics',
    basePrice: 50
  },
  [ResourceId.Silicates]: {
    id: ResourceId.Silicates,
    name: 'Silicates',
    tier: 1,
    description: 'Silicon-based minerals for glass and ceramics',
    basePrice: 3
  },
  [ResourceId.Ice]: {
    id: ResourceId.Ice,
    name: 'Ice',
    tier: 1,
    description: 'Frozen water for purification',
    basePrice: 2
  },
  [ResourceId.AtmosphericGases]: {
    id: ResourceId.AtmosphericGases,
    name: 'Atmospheric Gases',
    tier: 1,
    description: 'Gases harvested from planetary atmospheres',
    basePrice: 8
  },
  [ResourceId.ExoticGases]: {
    id: ResourceId.ExoticGases,
    name: 'Exotic Gases',
    tier: 1,
    description: 'Rare atmospheric compounds',
    basePrice: 100
  },
  [ResourceId.Hydrocarbons]: {
    id: ResourceId.Hydrocarbons,
    name: 'Hydrocarbons',
    tier: 1,
    description: 'Organic compounds for fuel and chemicals',
    basePrice: 10
  },
  [ResourceId.Organics]: {
    id: ResourceId.Organics,
    name: 'Organics',
    tier: 1,
    description: 'Raw biological matter for food production',
    basePrice: 6
  },
  [ResourceId.Livestock]: {
    id: ResourceId.Livestock,
    name: 'Livestock',
    tier: 1,
    description: 'Animals raised for food production',
    basePrice: 20
  },

  // Tier 2: Refined Resources
  [ResourceId.Steel]: {
    id: ResourceId.Steel,
    name: 'Steel',
    tier: 2,
    description: 'Basic construction metal',
    basePrice: 12
  },
  [ResourceId.HeavyMetals]: {
    id: ResourceId.HeavyMetals,
    name: 'Heavy Metals',
    tier: 2,
    description: 'Refined dense metals for alloys',
    basePrice: 40
  },
  [ResourceId.RareEarths]: {
    id: ResourceId.RareEarths,
    name: 'Rare Earths',
    tier: 2,
    description: 'Refined rare minerals for electronics',
    basePrice: 180
  },
  [ResourceId.GlassCeramics]: {
    id: ResourceId.GlassCeramics,
    name: 'Glass/Ceramics',
    tier: 2,
    description: 'Processed silicates for construction',
    basePrice: 8
  },
  [ResourceId.PurifiedWater]: {
    id: ResourceId.PurifiedWater,
    name: 'Purified Water',
    tier: 2,
    description: 'Clean water for life support',
    basePrice: 4,
    isConsumable: true
  },
  [ResourceId.Fuel]: {
    id: ResourceId.Fuel,
    name: 'Fuel',
    tier: 2,
    description: 'Processed fuel for ships',
    basePrice: 25
  },
  [ResourceId.ExoticCompounds]: {
    id: ResourceId.ExoticCompounds,
    name: 'Exotic Compounds',
    tier: 2,
    description: 'Rare chemical compounds',
    basePrice: 300
  },
  [ResourceId.IndustrialChemicals]: {
    id: ResourceId.IndustrialChemicals,
    name: 'Industrial Chemicals',
    tier: 2,
    description: 'Chemical compounds for manufacturing',
    basePrice: 18
  },
  [ResourceId.GrainProduce]: {
    id: ResourceId.GrainProduce,
    name: 'Grain/Produce',
    tier: 2,
    description: 'Raw food crops',
    basePrice: 10
  },
  [ResourceId.MeatAnimalProducts]: {
    id: ResourceId.MeatAnimalProducts,
    name: 'Meat/Animal Products',
    tier: 2,
    description: 'Processed animal products',
    basePrice: 45
  },

  // Tier 3: Processed Resources
  [ResourceId.StructuralMaterials]: {
    id: ResourceId.StructuralMaterials,
    name: 'Structural Materials',
    tier: 3,
    description: 'Pre-fabricated building materials',
    basePrice: 25
  },
  [ResourceId.Alloys]: {
    id: ResourceId.Alloys,
    name: 'Alloys',
    tier: 3,
    description: 'Strong composite metals',
    basePrice: 60
  },
  [ResourceId.Polymers]: {
    id: ResourceId.Polymers,
    name: 'Polymers',
    tier: 3,
    description: 'Synthetic materials',
    basePrice: 30
  },
  [ResourceId.PreparedFoods]: {
    id: ResourceId.PreparedFoods,
    name: 'Prepared Foods',
    tier: 3,
    description: 'Basic processed food',
    basePrice: 15,
    isConsumable: true
  },
  [ResourceId.QualityFoods]: {
    id: ResourceId.QualityFoods,
    name: 'Quality Foods',
    tier: 3,
    description: 'Higher quality meals',
    basePrice: 70,
    isConsumable: true
  },
  [ResourceId.GourmetFoods]: {
    id: ResourceId.GourmetFoods,
    name: 'Gourmet Foods',
    tier: 3,
    description: 'Luxury cuisine',
    basePrice: 400,
    isConsumable: true
  },
  [ResourceId.BasicGoods]: {
    id: ResourceId.BasicGoods,
    name: 'Basic Goods',
    tier: 3,
    description: 'Consumer products tier 1',
    basePrice: 35,
    isConsumable: true
  },
  [ResourceId.MedicalSupplies]: {
    id: ResourceId.MedicalSupplies,
    name: 'Medical Supplies',
    tier: 3,
    description: 'Healthcare materials',
    basePrice: 50
  },

  // Tier 4: Advanced Resources
  [ResourceId.Components]: {
    id: ResourceId.Components,
    name: 'Components',
    tier: 4,
    description: 'Mechanical parts',
    basePrice: 100
  },
  [ResourceId.Electronics]: {
    id: ResourceId.Electronics,
    name: 'Electronics',
    tier: 4,
    description: 'Circuit boards and chips',
    basePrice: 250
  },
  [ResourceId.ShipParts]: {
    id: ResourceId.ShipParts,
    name: 'Ship Parts',
    tier: 4,
    description: 'Spacecraft components',
    basePrice: 200
  },
  [ResourceId.Weapons]: {
    id: ResourceId.Weapons,
    name: 'Weapons',
    tier: 4,
    description: 'Military equipment',
    basePrice: 300
  },
  [ResourceId.ComfortGoods]: {
    id: ResourceId.ComfortGoods,
    name: 'Comfort Goods',
    tier: 4,
    description: 'Consumer products tier 2',
    basePrice: 150,
    isConsumable: true
  },
  [ResourceId.Pharmaceuticals]: {
    id: ResourceId.Pharmaceuticals,
    name: 'Pharmaceuticals',
    tier: 4,
    description: 'Advanced medicines',
    basePrice: 180
  },
  [ResourceId.AiCores]: {
    id: ResourceId.AiCores,
    name: 'AI Cores',
    tier: 4,
    description: 'Artificial intelligence processors',
    basePrice: 800
  },

  // Tier 5: High-Tech Resources
  [ResourceId.LuxuryGoods]: {
    id: ResourceId.LuxuryGoods,
    name: 'Luxury Goods',
    tier: 5,
    description: 'Consumer products tier 3',
    basePrice: 500,
    isConsumable: true
  },
  [ResourceId.QuantumMaterials]: {
    id: ResourceId.QuantumMaterials,
    name: 'Quantum Materials',
    tier: 5,
    description: 'Advanced quantum-state materials',
    basePrice: 3000
  },
  [ResourceId.XenoCompounds]: {
    id: ResourceId.XenoCompounds,
    name: 'Xeno-Compounds',
    tier: 5,
    description: 'Alien-derived materials',
    basePrice: 5000
  },
  [ResourceId.SyntheticMinds]: {
    id: ResourceId.SyntheticMinds,
    name: 'Synthetic Minds',
    tier: 5,
    description: 'True artificial consciousness',
    basePrice: 15000
  },

  // Special
  [ResourceId.Credits]: {
    id: ResourceId.Credits,
    name: 'Credits',
    tier: 1,
    description: 'Universal currency',
    basePrice: 1
  }
};
