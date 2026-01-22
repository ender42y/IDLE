import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import {
  StarSystem,
  SystemRarity,
  SystemState
} from '../models/star-system.model';
import {
  CelestialBody,
  BodyType,
  BodyFeature
} from '../models/celestial-body.model';
import {
  Facility,
  FacilityId
} from '../models/facility.model';
import {
  Ship,
  ShipType,
  ShipSize,
  ShipTier,
  ShipStatus
} from '../models/ship.model';
import { ResourceId, ResourceStock } from '../models/resource.model';
import { TESTING_CONFIG } from '../config/testing.config';

@Injectable({
  providedIn: 'root'
})
export class HomeSystemService {
  private gameState = inject(GameStateService);

  /**
   * Initialize the Sol home system with all starting facilities and resources
   * as defined in the GDD
   */
  initializeHomeSystem(): void {
    const systemId = 'sol';

    // Create Sol system
    const sol: StarSystem = {
      id: systemId,
      name: 'Sol',
      coordinates: { x: 0, y: 0 },
      rarity: SystemRarity.Uncommon,
      discovered: true,
      discoveredAt: Date.now(),
      surveyed: true,
      surveyedAt: Date.now(),
      bodyIds: [],
      stellarSlots: 2, // 7 bodies
      state: SystemState.Stable,
      totalPopulation: 2000, // GDD v6: Starting population
      techLevel: 1,
      securityLevel: 1,
      standardOfLiving: 50,
      resources: this.createStartingResources(),
      storageCapacity: 50000,
      hasTradeStation: true,
      tradeStationTier: 2,
      colonized: true
    };

    this.gameState.addSystem(sol);

    // Create all bodies and their starting facilities
    this.createSolBodies(systemId);

    // Create starting ships
    this.createStartingShips(systemId);

    // Update system with body IDs
    const state = this.gameState.getState();
    const bodyIds = Object.values(state.bodies)
      .filter(b => b.systemId === systemId)
      .map(b => b.id);

    this.gameState.updateSystem(systemId, { bodyIds });

    // Select home system by default
    this.gameState.selectSystem(systemId);
  }

  private createStartingResources(): ResourceStock[] {
    // GDD v6 Section 2.5: Starting Resources
    // Base values multiplied by TESTING_CONFIG.startingResourcesMultiplier for faster iteration
    const mult = TESTING_CONFIG.startingResourcesMultiplier;
    return [
      { resourceId: ResourceId.Credits, amount: 10000 * mult, capacity: 1000000 },
      { resourceId: ResourceId.Steel, amount: 500 * mult, capacity: 10000 },
      { resourceId: ResourceId.GlassCeramics, amount: 200 * mult, capacity: 10000 },
      { resourceId: ResourceId.PurifiedWater, amount: 300 * mult, capacity: 10000 },
      { resourceId: ResourceId.Fuel, amount: 200 * mult, capacity: 100000 },
      { resourceId: ResourceId.PreparedFoods, amount: 200 * mult, capacity: 10000 },
      { resourceId: ResourceId.BasicGoods, amount: 100 * mult, capacity: 10000 },
      { resourceId: ResourceId.Components, amount: 50 * mult, capacity: 10000 }
    ];
  }

  private createSolBodies(systemId: string): void {
    // Sol (Star)
    const star = this.createBody({
      systemId,
      name: 'Sol',
      type: BodyType.Star,
      orbitalSlots: 2,
      surfaceSlots: 0,
      features: []
    });
    this.gameState.addBody(star);

    // Sol 1 - Rocky Planet
    // GDD v6: Silicate Quarry + Glass Works (Silicates → Glass/Ceramics chain)
    const sol1 = this.createBody({
      systemId,
      name: 'Sol 1',
      type: BodyType.TerrestrialPlanet,
      orbitalSlots: 2,
      surfaceSlots: 3,
      features: []
    });
    this.gameState.addBody(sol1);
    this.createFacility(sol1.id, FacilityId.SilicateQuarry);
    this.createFacility(sol1.id, FacilityId.GlassWorks, true); // Orbital

    // Sol 2 - Metal-Rich Planet
    // GDD v6: Mine + Smelter (Iron Ore → Steel chain)
    const sol2 = this.createBody({
      systemId,
      name: 'Sol 2',
      type: BodyType.TerrestrialPlanet,
      orbitalSlots: 2,
      surfaceSlots: 4,
      features: [BodyFeature.HighMetalContent]
    });
    this.gameState.addBody(sol2);
    this.createFacility(sol2.id, FacilityId.Mine);
    this.createFacility(sol2.id, FacilityId.Smelter, true); // Orbital

    // Sol 3 - Earth-like Planet (main hub)
    // GDD v6: Farm + Food Processor + Food Kitchen (Organics → Grain → Prepared Foods chain)
    const sol3 = this.createBody({
      systemId,
      name: 'Sol 3',
      type: BodyType.EarthLikePlanet, // GDD v6: Changed from Terraformable to Earth-like
      orbitalSlots: 3,
      surfaceSlots: 5,
      features: [BodyFeature.FertileSoil, BodyFeature.Habitable],
      population: 1500, // Main population center
      populationCeiling: 20000 // Higher ceiling for Earth-like
    });
    this.gameState.addBody(sol3);
    this.createFacility(sol3.id, FacilityId.Farm);
    this.createFacility(sol3.id, FacilityId.FoodProcessor);
    this.createFacility(sol3.id, FacilityId.FoodKitchen);
    // Trade Station orbiting Sol 3
    this.createFacility(sol3.id, FacilityId.TradeStation, true);

    // Sol 3-a - Rocky Moon
    const sol3a = this.createBody({
      systemId,
      name: 'Sol 3-a',
      type: BodyType.Moon,
      parentBodyId: sol3.id,
      orbitalSlots: 1,
      surfaceSlots: 2,
      features: []
    });
    this.gameState.addBody(sol3a);
    // No starting facility - player's first expansion choice

    // Sol 4 - Gas Giant
    // GDD v6: Gas Collector + Hydrocarbon Extractor + Fuel Refinery (Atmo Gases + Hydrocarbons → Fuel chain)
    const sol4 = this.createBody({
      systemId,
      name: 'Sol 4',
      type: BodyType.GasGiant,
      orbitalSlots: 3,
      surfaceSlots: 0,
      features: []
    });
    this.gameState.addBody(sol4);
    this.createFacility(sol4.id, FacilityId.GasCollector, true);
    this.createFacility(sol4.id, FacilityId.HydrocarbonExtractor, true);
    this.createFacility(sol4.id, FacilityId.FuelRefinery, true);

    // Sol 4-a - Icy Moon
    // GDD v6: Ice Harvester + Water Purifier (Ice → Purified Water chain)
    const sol4a = this.createBody({
      systemId,
      name: 'Sol 4-a',
      type: BodyType.IcyMoon,
      parentBodyId: sol4.id,
      orbitalSlots: 1,
      surfaceSlots: 2,
      features: [BodyFeature.IceDeposits]
    });
    this.gameState.addBody(sol4a);
    this.createFacility(sol4a.id, FacilityId.IceHarvester);
    this.createFacility(sol4a.id, FacilityId.WaterPurifier, true); // Orbital

    // Sol 4-b - Icy Moon (backup)
    const sol4b = this.createBody({
      systemId,
      name: 'Sol 4-b',
      type: BodyType.IcyMoon,
      parentBodyId: sol4.id,
      orbitalSlots: 1,
      surfaceSlots: 1,
      features: [BodyFeature.IceDeposits]
    });
    this.gameState.addBody(sol4b);
    // No starting facility - backup ice source
  }

  private createBody(config: {
    systemId: string;
    name: string;
    type: BodyType;
    parentBodyId?: string;
    orbitalSlots: number;
    surfaceSlots: number;
    features: BodyFeature[];
    population?: number;
    populationCeiling?: number;
  }): CelestialBody {
    const id = this.gameState.generateId();
    return {
      id,
      systemId: config.systemId,
      name: config.name,
      type: config.type,
      parentBodyId: config.parentBodyId,
      orbitalSlots: config.orbitalSlots,
      surfaceSlots: config.surfaceSlots,
      usedOrbitalSlots: 0,
      usedSurfaceSlots: 0,
      features: config.features,
      surveyed: true,
      facilityIds: [],
      population: config.population ?? 0,
      populationCeiling: config.populationCeiling ?? 1000,
      populationFloor: 0
    };
  }

  private createFacility(bodyId: string, definitionId: FacilityId, isOrbital: boolean = false): void {
    const body = this.gameState.getBody(bodyId);
    if (!body) return;

    const facilityId = this.gameState.generateId();
    const facility: Facility = {
      id: facilityId,
      definitionId,
      bodyId,
      level: 1,
      condition: 100,
      operational: true
    };

    this.gameState.addFacility(facility);

    // Update body slot usage
    if (isOrbital) {
      this.gameState.updateBody(bodyId, {
        usedOrbitalSlots: body.usedOrbitalSlots + 1,
        facilityIds: [...body.facilityIds, facilityId]
      });
    } else {
      this.gameState.updateBody(bodyId, {
        usedSurfaceSlots: body.usedSurfaceSlots + 1,
        facilityIds: [...body.facilityIds, facilityId]
      });
    }
  }

  private createStartingShips(systemId: string): void {
    // 1 Scout Ship (Tier 1, basic)
    const scout: Ship = {
      id: this.gameState.generateId(),
      name: 'ISS Pioneer',
      type: ShipType.Scout,
      size: ShipSize.Light,
      tier: ShipTier.Basic,
      condition: 100,
      status: ShipStatus.Idle,
      currentSystemId: systemId,
      scoutRange: 10,
      scoutSpeed: 300,
      sensorQuality: 1,
      speedModifier: 1,
      rangeModifier: 1,
      efficiencyModifier: 1
    };
    this.gameState.addShip(scout);

    // 1 Light Freighter (Tier 1, basic)
    const freighter: Ship = {
      id: this.gameState.generateId(),
      name: 'ISS Merchant',
      type: ShipType.Freighter,
      size: ShipSize.Light,
      tier: ShipTier.Basic,
      condition: 100,
      status: ShipStatus.Idle,
      currentSystemId: systemId,
      cargoCapacity: 100,
      currentCargo: [],
      speedModifier: 1,
      rangeModifier: 1,
      efficiencyModifier: 1
    };
    this.gameState.addShip(freighter);
  }
}
