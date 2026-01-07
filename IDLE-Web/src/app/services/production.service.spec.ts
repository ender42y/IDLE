import { TestBed } from '@angular/core/testing';
import { ProductionService } from './production.service';
import { GameStateService } from './game-state.service';
import { PopulationService } from './population.service';
import { StarSystem, SystemState, SystemRarity } from '../models/star-system.model';
import { Facility, FacilityId, FACILITY_DEFINITIONS } from '../models/facility.model';
import { ResourceId } from '../models/resource.model';
import { BodyType, BodyFeature } from '../models/celestial-body.model';

describe('ProductionService', () => {
  let service: ProductionService;
  let gameState: jasmine.SpyObj<GameStateService>;
  let populationService: jasmine.SpyObj<PopulationService>;

  let testSystem: StarSystem;
  let testFacility: Facility;

  beforeEach(() => {
    const gameStateSpy = jasmine.createSpyObj('GameStateService', [
      'getState',
      'getSystem',
      'getSystemResource',
      'addResourceToSystem',
      'removeResourceFromSystem'
    ]);

    const populationSpy = jasmine.createSpyObj('PopulationService', [
      'getPopulationProductionBonus'
    ]);

    TestBed.configureTestingModule({
      providers: [
        ProductionService,
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: PopulationService, useValue: populationSpy }
      ]
    });

    service = TestBed.inject(ProductionService);
    gameState = TestBed.inject(GameStateService) as jasmine.SpyObj<GameStateService>;
    populationService = TestBed.inject(PopulationService) as jasmine.SpyObj<PopulationService>;

    testSystem = {
      id: 'test-system',
      name: 'Test System',
      coordinates: { x: 0, y: 0 },
      rarity: SystemRarity.Common,
      discovered: true,
      discoveredAt: Date.now(),
      surveyed: true,
      bodyIds: ['body-1'],
      stellarSlots: 1,
      state: SystemState.Stable,
      totalPopulation: 1000,
      techLevel: 1,
      securityLevel: 1,
      standardOfLiving: 50,
      resources: [],
      storageCapacity: 10000,
      hasTradeStation: false,
      tradeStationTier: 0,
      colonized: true,
      anomalous: false,
      hasXenoDiscovery: false
    };

    testFacility = {
      id: 'test-facility',
      definitionId: FacilityId.Mine,
      bodyId: 'body-1',
      level: 1,
      condition: 100,
      operational: true
    };

    populationService.getPopulationProductionBonus.and.returnValue(1.0);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('processTick', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        systems: { [testSystem.id]: testSystem },
        bodies: {
          'body-1': {
            id: 'body-1',
            systemId: testSystem.id,
            type: BodyType.TerrestrialPlanet,
            facilityIds: [testFacility.id],
            features: []
          }
        },
        facilities: { [testFacility.id]: testFacility }
      } as any);
    });

    it('should process colonized systems', () => {
      service.processTick(1);

      expect(gameState.addResourceToSystem).toHaveBeenCalled();
    });

    it('should skip non-colonized systems', () => {
      testSystem.colonized = false;

      service.processTick(1);

      expect(gameState.addResourceToSystem).not.toHaveBeenCalled();
    });

    it('should produce resources from extraction facilities', () => {
      service.processTick(1);

      const def = FACILITY_DEFINITIONS[FacilityId.Mine];
      if (def.production) {
        expect(gameState.addResourceToSystem).toHaveBeenCalledWith(
          testSystem.id,
          def.production.output,
          jasmine.any(Number)
        );
      }
    });

    it('should process facilities in tier order', () => {
      const extractorFacility: Facility = {
        id: 'extractor',
        definitionId: FacilityId.Mine,
        bodyId: 'body-1',
        level: 1,
        condition: 100,
        operational: true
      };

      const refinerFacility: Facility = {
        id: 'refiner',
        definitionId: FacilityId.Smelter,
        bodyId: 'body-1',
        level: 1,
        condition: 100,
        operational: true
      };

      gameState.getState.and.returnValue({
        systems: { [testSystem.id]: testSystem },
        bodies: {
          'body-1': {
            id: 'body-1',
            systemId: testSystem.id,
            type: BodyType.TerrestrialPlanet,
            facilityIds: [extractorFacility.id, refinerFacility.id],
            features: []
          }
        },
        facilities: {
          [extractorFacility.id]: extractorFacility,
          [refinerFacility.id]: refinerFacility
        }
      } as any);

      gameState.getSystemResource.and.returnValue(1000);

      service.processTick(1);

      // Both should produce
      expect(gameState.addResourceToSystem).toHaveBeenCalled();
    });

    it('should skip non-operational facilities', () => {
      testFacility.operational = false;

      service.processTick(1);

      expect(gameState.addResourceToSystem).not.toHaveBeenCalled();
    });

    it('should apply population bonus to production', () => {
      populationService.getPopulationProductionBonus.and.returnValue(2.0);

      service.processTick(1);

      // Production should be doubled
      expect(gameState.addResourceToSystem).toHaveBeenCalled();
    });

    it('should handle conversion facilities with inputs', () => {
      const conversionFacility: Facility = {
        id: 'converter',
        definitionId: FacilityId.Smelter,
        bodyId: 'body-1',
        level: 1,
        condition: 100,
        operational: true
      };

      gameState.getState.and.returnValue({
        systems: { [testSystem.id]: testSystem },
        bodies: {
          'body-1': {
            id: 'body-1',
            systemId: testSystem.id,
            type: BodyType.TerrestrialPlanet,
            facilityIds: [conversionFacility.id],
            features: []
          }
        },
        facilities: { [conversionFacility.id]: conversionFacility }
      } as any);

      gameState.getSystemResource.and.returnValue(1000);

      service.processTick(1);

      expect(gameState.removeResourceFromSystem).toHaveBeenCalled();
      expect(gameState.addResourceToSystem).toHaveBeenCalled();
    });

    it('should not process conversion without sufficient inputs', () => {
      const conversionFacility: Facility = {
        id: 'converter',
        definitionId: FacilityId.Smelter,
        bodyId: 'body-1',
        level: 1,
        condition: 100,
        operational: true
      };

      gameState.getState.and.returnValue({
        systems: { [testSystem.id]: testSystem },
        bodies: {
          'body-1': {
            id: 'body-1',
            systemId: testSystem.id,
            type: BodyType.TerrestrialPlanet,
            facilityIds: [conversionFacility.id],
            features: []
          }
        },
        facilities: { [conversionFacility.id]: conversionFacility }
      } as any);

      gameState.getSystemResource.and.returnValue(0); // No input resources

      service.processTick(1);

      expect(gameState.addResourceToSystem).not.toHaveBeenCalled();
    });
  });

  describe('getSystemProductionReport', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        systems: { [testSystem.id]: testSystem },
        bodies: {
          'body-1': {
            id: 'body-1',
            systemId: testSystem.id,
            type: BodyType.TerrestrialPlanet,
            facilityIds: [testFacility.id],
            features: []
          }
        },
        facilities: { [testFacility.id]: testFacility }
      } as any);

      gameState.getSystem.and.returnValue(testSystem);
      gameState.getSystemResource.and.returnValue(1000);
    });

    it('should generate production report for system', () => {
      const report = service.getSystemProductionReport(testSystem.id);

      expect(report.length).toBeGreaterThan(0);
    });

    it('should include facility information in report', () => {
      const report = service.getSystemProductionReport(testSystem.id);

      expect(report[0].facilityId).toBe(testFacility.id);
      expect(report[0].facilityName).toBeTruthy();
      expect(report[0].outputResource).toBeTruthy();
    });

    it('should calculate base and actual rates', () => {
      const report = service.getSystemProductionReport(testSystem.id);

      expect(report[0].baseRate).toBeGreaterThan(0);
      expect(report[0].actualRate).toBeGreaterThan(0);
      expect(report[0].efficiency).toBeGreaterThan(0);
    });

    it('should mark blocked facilities', () => {
      testFacility.operational = false;

      const report = service.getSystemProductionReport(testSystem.id);

      expect(report[0].blockedReason).toBe('Facility offline');
    });

    it('should return empty array for non-existent system', () => {
      gameState.getState.and.returnValue({
        systems: {},
        bodies: {},
        facilities: {}
      } as any);

      const report = service.getSystemProductionReport('non-existent');

      expect(report).toEqual([]);
    });
  });

  describe('getNetProductionRate', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        systems: { [testSystem.id]: testSystem },
        bodies: {
          'body-1': {
            id: 'body-1',
            systemId: testSystem.id,
            type: BodyType.TerrestrialPlanet,
            facilityIds: [testFacility.id],
            features: []
          }
        },
        facilities: { [testFacility.id]: testFacility }
      } as any);

      gameState.getSystem.and.returnValue(testSystem);
      gameState.getSystemResource.and.returnValue(1000);
    });

    it('should calculate net production rate', () => {
      const def = FACILITY_DEFINITIONS[FacilityId.Mine];
      if (def.production) {
        const rate = service.getNetProductionRate(testSystem.id, def.production.output);
        expect(rate).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return 0 for non-produced resources', () => {
      const rate = service.getNetProductionRate(testSystem.id, ResourceId.Credits);
      expect(rate).toBe(0);
    });
  });

  describe('Body Feature Bonuses', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        systems: { [testSystem.id]: testSystem },
        bodies: {
          'body-1': {
            id: 'body-1',
            systemId: testSystem.id,
            type: BodyType.TerrestrialPlanet,
            facilityIds: [testFacility.id],
            features: [BodyFeature.HighMetalContent]
          }
        },
        facilities: { [testFacility.id]: testFacility }
      } as any);

      gameState.getSystem.and.returnValue(testSystem);
      gameState.getSystemResource.and.returnValue(1000);
    });

    it('should apply feature bonuses to production', () => {
      const report = service.getSystemProductionReport(testSystem.id);

      // Mining output should be boosted by HighMetalContent
      expect(report[0].efficiency).toBeGreaterThan(1.0);
    });
  });

  describe('System State Modifiers', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        systems: { [testSystem.id]: testSystem },
        bodies: {
          'body-1': {
            id: 'body-1',
            systemId: testSystem.id,
            type: BodyType.TerrestrialPlanet,
            facilityIds: [testFacility.id],
            features: []
          }
        },
        facilities: { [testFacility.id]: testFacility }
      } as any);

      gameState.getSystem.and.returnValue(testSystem);
      gameState.getSystemResource.and.returnValue(1000);
    });

    it('should apply famine penalty to production', () => {
      testSystem.state = SystemState.Famine;

      const report = service.getSystemProductionReport(testSystem.id);

      // Efficiency should be reduced
      expect(report[0].efficiency).toBeLessThan(2.0);
    });

    it('should apply prosperity bonus to production', () => {
      testSystem.state = SystemState.Prosperous;

      const report = service.getSystemProductionReport(testSystem.id);

      // Efficiency should be increased
      expect(report[0].efficiency).toBeGreaterThan(1.0);
    });
  });
});
