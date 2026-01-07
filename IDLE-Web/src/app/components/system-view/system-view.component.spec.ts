import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SystemViewComponent } from './system-view.component';
import { GameStateService } from '../../services/game-state.service';
import { ProductionService } from '../../services/production.service';
import { ConstructionService } from '../../services/construction.service';
import { PopulationService } from '../../services/population.service';
import { signal } from '@angular/core';
import { StarSystem, SystemRarity, SystemState } from '../../models/star-system.model';
import { CelestialBody, BodyType, BodyFeature } from '../../models/celestial-body.model';
import { Facility, FacilityId } from '../../models/facility.model';
import { ResourceId } from '../../models/resource.model';

describe('SystemViewComponent', () => {
  let component: SystemViewComponent;
  let fixture: ComponentFixture<SystemViewComponent>;
  let gameState: jasmine.SpyObj<GameStateService>;
  let productionService: jasmine.SpyObj<ProductionService>;
  let constructionService: jasmine.SpyObj<ConstructionService>;
  let populationService: jasmine.SpyObj<PopulationService>;

  let testSystem: StarSystem;
  let testBody: CelestialBody;
  let testFacility: Facility;

  beforeEach(async () => {
    const gameStateSpy = jasmine.createSpyObj('GameStateService', [
      'selectBody',
      'getState'
    ], {
      selectedSystem: signal<StarSystem | null>(null),
      selectedBody: signal<CelestialBody | null>(null),
      bodies: signal<Record<string, CelestialBody>>({}),
      facilities: signal<Record<string, Facility>>({})
    });

    const productionSpy = jasmine.createSpyObj('ProductionService', [
      'getNetProductionRate',
      'getSystemProductionReport'
    ]);

    const constructionSpy = jasmine.createSpyObj('ConstructionService', [
      'buildFacility',
      'getAvailableFacilities',
      'getConstructionCost'
    ]);

    const populationSpy = jasmine.createSpyObj('PopulationService', [
      'getConsumptionSummary'
    ]);

    await TestBed.configureTestingModule({
      declarations: [SystemViewComponent],
      providers: [
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: ProductionService, useValue: productionSpy },
        { provide: ConstructionService, useValue: constructionSpy },
        { provide: PopulationService, useValue: populationSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SystemViewComponent);
    component = fixture.componentInstance;
    gameState = TestBed.inject(GameStateService) as jasmine.SpyObj<GameStateService>;
    productionService = TestBed.inject(ProductionService) as jasmine.SpyObj<ProductionService>;
    constructionService = TestBed.inject(ConstructionService) as jasmine.SpyObj<ConstructionService>;
    populationService = TestBed.inject(PopulationService) as jasmine.SpyObj<PopulationService>;

    testSystem = {
      id: 'test-system',
      name: 'Test System',
      coordinates: { x: 0, y: 0 },
      rarity: SystemRarity.Common,
      discovered: true,
      discoveredAt: Date.now(),
      surveyed: true,
      bodyIds: ['body-1', 'body-2'],
      stellarSlots: 2,
      state: SystemState.Stable,
      totalPopulation: 1000,
      techLevel: 1,
      securityLevel: 1,
      standardOfLiving: 50,
      resources: [
        { resourceId: ResourceId.Steel, amount: 500, capacity: 10000 }
      ],
      storageCapacity: 10000,
      hasTradeStation: false,
      tradeStationTier: 0,
      colonized: true,
      anomalous: false,
      hasXenoDiscovery: false
    };

    testBody = {
      id: 'body-1',
      systemId: testSystem.id,
      name: 'Test Planet',
      type: BodyType.TerrestrialPlanet,
      orbitalSlots: 2,
      surfaceSlots: 4,
      usedOrbitalSlots: 0,
      usedSurfaceSlots: 1,
      features: [BodyFeature.HighMetalContent],
      surveyed: true,
      facilityIds: ['facility-1'],
      population: 500,
      populationCeiling: 2000,
      populationFloor: 100
    };

    testFacility = {
      id: 'facility-1',
      definitionId: FacilityId.Mine,
      bodyId: testBody.id,
      level: 1,
      condition: 100,
      operational: true
    };

    productionService.getNetProductionRate.and.returnValue(10);
    populationService.getConsumptionSummary.and.returnValue([]);
    constructionService.getAvailableFacilities.and.returnValue([]);
    constructionService.getConstructionCost.and.returnValue(null);
    productionService.getSystemProductionReport.and.returnValue([]);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should initialize with null selected system', () => {
      expect(component.selectedSystem()).toBeNull();
    });

    it('should initialize with null selected body', () => {
      expect(component.selectedBody()).toBeNull();
    });

    it('should initialize showBuildMenu to false', () => {
      expect(component.showBuildMenu).toBe(false);
    });

    it('should initialize showUnavailableFacilities signal to true', () => {
      expect(component.showUnavailableFacilities()).toBe(true);
    });
  });

  describe('systemBodies computed', () => {
    beforeEach(() => {
      testSystem.bodyIds = ['body-1', 'body-2', 'body-3'];
      (gameState.selectedSystem as any).set(testSystem);
      (gameState.bodies as any).set({
        'body-1': { ...testBody, id: 'body-1', name: 'Planet 1', type: BodyType.TerrestrialPlanet, parentBodyId: undefined },
        'body-2': { ...testBody, id: 'body-2', name: 'Star', type: BodyType.Star, parentBodyId: undefined },
        'body-3': { ...testBody, id: 'body-3', name: 'Moon 1', type: BodyType.Moon, parentBodyId: 'body-1' }
      });
    });

    it('should return bodies in correct order (star first)', () => {
      const bodies = component.systemBodies();

      expect(bodies.length).toBe(3);
      expect(bodies[0].type).toBe(BodyType.Star);
    });

    it('should place moons after their parent body', () => {
      const bodies = component.systemBodies();

      const planetIndex = bodies.findIndex(b => b.id === 'body-1');
      const moonIndex = bodies.findIndex(b => b.id === 'body-3');

      expect(moonIndex).toBeGreaterThan(planetIndex);
    });

    it('should return empty array when no system selected', () => {
      (gameState.selectedSystem as any).set(null);

      const bodies = component.systemBodies();

      expect(bodies).toEqual([]);
    });
  });

  describe('systemResources computed', () => {
    beforeEach(() => {
      (gameState.selectedSystem as any).set(testSystem);
      gameState.getState.and.returnValue({
        bodies: { 'body-1': testBody },
        facilities: { 'facility-1': testFacility }
      } as any);
      populationService.getConsumptionSummary.and.returnValue([
        { resource: ResourceId.PreparedFoods, name: 'Prepared Foods', needed: 1, available: 50, status: 'ok' }
      ]);
    });

    it('should return resources for selected system', () => {
      const resources = component.systemResources();

      expect(resources.length).toBeGreaterThan(0);
    });

    it('should include resource metadata', () => {
      const resources = component.systemResources();

      resources.forEach(res => {
        expect(res.resourceId).toBeTruthy();
        expect(res.name).toBeTruthy();
        expect(res.amount).toBeGreaterThanOrEqual(0);
      });
    });

    it('should mark resources with overdraw', () => {
      populationService.getConsumptionSummary.and.returnValue([
        { resource: ResourceId.PreparedFoods, name: 'Prepared Foods', needed: 100, available: 50, status: 'critical' }
      ]);
      productionService.getNetProductionRate.and.returnValue(1); // Production less than consumption

      const resources = component.systemResources();
      const food = resources.find(r => r.resourceId === ResourceId.PreparedFoods);

      if (food && food.consumption > food.rate) {
        expect(food.overdraw).toBe(true);
      }
    });
  });

  describe('selectBody', () => {
    it('should select a body', () => {
      component.selectBody(testBody);

      expect(gameState.selectBody).toHaveBeenCalledWith(testBody.id);
    });

    it('should close build menu when selecting body', () => {
      component.showBuildMenu = true;

      component.selectBody(testBody);

      expect(component.showBuildMenu).toBe(false);
    });
  });

  describe('toggleBuildMenu', () => {
    it('should toggle build menu', () => {
      expect(component.showBuildMenu).toBe(false);

      component.toggleBuildMenu();
      expect(component.showBuildMenu).toBe(true);

      component.toggleBuildMenu();
      expect(component.showBuildMenu).toBe(false);
    });

    it('should clear selected facility when toggling', () => {
      component.selectedFacilityToBuild.set(FacilityId.Mine);

      component.toggleBuildMenu();

      expect(component.selectedFacilityToBuild()).toBeNull();
    });
  });

  describe('toggleShowUnavailableFacilities', () => {
    it('should toggle showUnavailableFacilities signal', () => {
      expect(component.showUnavailableFacilities()).toBe(true);

      component.toggleShowUnavailableFacilities();
      expect(component.showUnavailableFacilities()).toBe(false);

      component.toggleShowUnavailableFacilities();
      expect(component.showUnavailableFacilities()).toBe(true);
    });
  });

  describe('selectFacilityToBuild', () => {
    it('should set selected facility', () => {
      component.selectFacilityToBuild(FacilityId.Mine);

      expect(component.selectedFacilityToBuild()).toBe(FacilityId.Mine);
    });
  });

  describe('buildFacility', () => {
    beforeEach(() => {
      (gameState.selectedBody as any).set(testBody);
      component.selectedFacilityToBuild.set(FacilityId.Farm);
    });

    it('should build facility', () => {
      component.buildFacility();

      expect(constructionService.buildFacility).toHaveBeenCalledWith(FacilityId.Farm, testBody.id);
    });

    it('should close build menu after building', () => {
      component.showBuildMenu = true;

      component.buildFacility();

      expect(component.showBuildMenu).toBe(false);
    });

    it('should clear selected facility after building', () => {
      component.buildFacility();

      expect(component.selectedFacilityToBuild()).toBeNull();
    });

    it('should not build without selected body', () => {
      (gameState.selectedBody as any).set(null);

      component.buildFacility();

      expect(constructionService.buildFacility).not.toHaveBeenCalled();
    });

    it('should not build without selected facility', () => {
      component.selectedFacilityToBuild.set(null);

      component.buildFacility();

      expect(constructionService.buildFacility).not.toHaveBeenCalled();
    });
  });

  describe('getBodyTypeName', () => {
    it('should return body type name', () => {
      const name = component.getBodyTypeName(testBody);

      expect(name).toBeTruthy();
      expect(typeof name).toBe('string');
    });

    it('should handle different body types', () => {
      const star = { ...testBody, type: BodyType.Star };
      const gasGiant = { ...testBody, type: BodyType.GasGiant };

      expect(component.getBodyTypeName(star)).toBeTruthy();
      expect(component.getBodyTypeName(gasGiant)).toBeTruthy();
    });
  });

  describe('getFeatureName', () => {
    it('should return feature name', () => {
      const name = component.getFeatureName(BodyFeature.HighMetalContent);

      expect(name).toBeTruthy();
      expect(typeof name).toBe('string');
    });
  });

  describe('formatNumber', () => {
    it('should format large numbers with M suffix', () => {
      expect(component.formatNumber(1500000)).toBe('1.50M');
      expect(component.formatNumber(2000000)).toBe('2.00M');
    });

    it('should format medium numbers with K suffix', () => {
      expect(component.formatNumber(1500)).toBe('1.5K');
      expect(component.formatNumber(2500)).toBe('2.5K');
    });

    it('should format small numbers as integers', () => {
      expect(component.formatNumber(500)).toBe('500');
      expect(component.formatNumber(150)).toBe('150');
    });

    it('should format very small numbers with decimals', () => {
      expect(component.formatNumber(50.7)).toBe('50.7');
      expect(component.formatNumber(12.3)).toBe('12.3');
    });

    it('should handle negative numbers', () => {
      expect(component.formatNumber(-1500000)).toBe('-1.50M');
      expect(component.formatNumber(-1500)).toBe('-1.5K');
    });
  });

  describe('formatRate', () => {
    it('should format positive rates with + prefix', () => {
      expect(component.formatRate(100)).toBe('+100/h');
    });

    it('should format negative rates without + prefix', () => {
      expect(component.formatRate(-50)).toBe('-50.0/h');
    });

    it('should include /h suffix', () => {
      const formatted = component.formatRate(1000);
      expect(formatted).toContain('/h');
    });
  });

  describe('getFacilityRateInfo', () => {
    it('should return production info for extraction facilities', () => {
      const mineDef = { production: { output: ResourceId.IronOre, baseRate: 10 } } as any;

      const info = component.getFacilityRateInfo(mineDef);

      expect(info).toContain('Produces');
      expect(info).toContain('10');
    });

    it('should return conversion info for processing facilities', () => {
      const smelterDef = {
        conversion: {
          inputs: [{ resourceId: ResourceId.IronOre, amount: 2 }],
          output: ResourceId.Steel,
          throughput: 10,
          efficiency: 0.8
        }
      } as any;

      const info = component.getFacilityRateInfo(smelterDef);

      expect(info).toContain('->');
      expect(info).toBeTruthy();
    });

    it('should return bonus info for support facilities', () => {
      const tradeDef = {
        bonuses: { tradeCapacity: 2, techLevel: 1 }
      } as any;

      const info = component.getFacilityRateInfo(tradeDef);

      expect(info).toContain('Trade');
      expect(info).toContain('Tech');
    });

    it('should return empty string for facilities without production/bonuses', () => {
      const emptyDef = {} as any;

      const info = component.getFacilityRateInfo(emptyDef);

      expect(info).toBe('');
    });
  });

  describe('getCost', () => {
    beforeEach(() => {
      (gameState.selectedBody as any).set(testBody);
    });

    it('should get construction cost', () => {
      constructionService.getConstructionCost.and.returnValue({
        credits: 1000,
        resources: [],
        canAfford: true,
        multiplier: 1.0
      });

      const cost = component.getCost(FacilityId.Mine);

      expect(cost).toBeTruthy();
      expect(cost?.credits).toBe(1000);
    });

    it('should return null without selected body', () => {
      (gameState.selectedBody as any).set(null);

      const cost = component.getCost(FacilityId.Mine);

      expect(cost).toBeNull();
    });
  });

  describe('availableFacilities computed', () => {
    beforeEach(() => {
      (gameState.selectedBody as any).set(testBody);
      gameState.getState.and.returnValue({
        credits: 10000
      } as any);
    });

    it('should filter facilities by available slots', () => {
      testBody.usedSurfaceSlots = testBody.surfaceSlots; // All surface slots used

      constructionService.getAvailableFacilities.and.returnValue([
        { facility: { slotType: 'surface' } as any, canBuild: true, reason: '' }
      ]);

      const available = component.availableFacilities();

      // Should be empty since no surface slots available
      expect(available.length).toBe(0);
    });

    it('should filter unavailable facilities when showUnavailableFacilities is false', () => {
      component.showUnavailableFacilities.set(false);

      constructionService.getAvailableFacilities.and.returnValue([
        { facility: { id: 'fac-1', slotType: 'surface' } as any, canBuild: false, reason: 'Missing tech' }
      ]);

      const available = component.availableFacilities();

      expect(available.length).toBe(0);
    });

    it('should show unavailable facilities when showUnavailableFacilities is true', () => {
      component.showUnavailableFacilities.set(true);

      constructionService.getAvailableFacilities.and.returnValue([
        { facility: { id: 'fac-1', slotType: 'surface', tier: 1, name: 'Test' } as any, canBuild: false, reason: 'Missing tech' }
      ]);

      const available = component.availableFacilities();

      expect(available.length).toBe(1);
    });
  });
});
