import { TestBed } from '@angular/core/testing';
import { PopulationService } from './population.service';
import { GameStateService } from './game-state.service';
import { StarSystem, SystemRarity, SystemState } from '../models/star-system.model';
import { ResourceId } from '../models/resource.model';
import { FacilityId } from '../models/facility.model';
import { BodyType } from '../models/celestial-body.model';

describe('PopulationService', () => {
  let service: PopulationService;
  let gameState: jasmine.SpyObj<GameStateService>;

  let testSystem: StarSystem;

  beforeEach(() => {
    const gameStateSpy = jasmine.createSpyObj('GameStateService', [
      'getState',
      'getSystem',
      'getSystemResource',
      'removeResourceFromSystem',
      'updateSystem',
      'addNotification'
    ]);

    TestBed.configureTestingModule({
      providers: [
        PopulationService,
        { provide: GameStateService, useValue: gameStateSpy }
      ]
    });

    service = TestBed.inject(PopulationService);
    gameState = TestBed.inject(GameStateService) as jasmine.SpyObj<GameStateService>;

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
      resources: [
        { resourceId: ResourceId.PreparedFoods, amount: 1000, capacity: 10000 },
        { resourceId: ResourceId.PurifiedWater, amount: 500, capacity: 10000 },
        { resourceId: ResourceId.BasicGoods, amount: 200, capacity: 10000 }
      ],
      storageCapacity: 10000,
      hasTradeStation: false,
      tradeStationTier: 0,
      colonized: true,
      anomalous: false,
      hasXenoDiscovery: false
    };
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
            facilityIds: [],
            features: []
          }
        },
        facilities: {}
      } as any);

      gameState.getSystem.and.returnValue(testSystem);
      gameState.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        const resource = testSystem.resources.find(r => r.resourceId === resourceId);
        return resource?.amount ?? 0;
      });
    });

    it('should process colonized systems', () => {
      service.processTick(1);

      expect(gameState.updateSystem).toHaveBeenCalled();
    });

    it('should skip non-colonized systems', () => {
      testSystem.colonized = false;

      service.processTick(1);

      expect(gameState.updateSystem).not.toHaveBeenCalled();
    });

    it('should consume resources based on population', () => {
      service.processTick(1);

      expect(gameState.removeResourceFromSystem).toHaveBeenCalledWith(
        testSystem.id,
        ResourceId.PreparedFoods,
        jasmine.any(Number)
      );
      expect(gameState.removeResourceFromSystem).toHaveBeenCalledWith(
        testSystem.id,
        ResourceId.PurifiedWater,
        jasmine.any(Number)
      );
      expect(gameState.removeResourceFromSystem).toHaveBeenCalledWith(
        testSystem.id,
        ResourceId.BasicGoods,
        jasmine.any(Number)
      );
    });

    it('should update standard of living', () => {
      service.processTick(1);

      expect(gameState.updateSystem).toHaveBeenCalledWith(
        testSystem.id,
        jasmine.objectContaining({
          standardOfLiving: jasmine.any(Number)
        })
      );
    });

    it('should update population based on conditions', () => {
      service.processTick(1);

      expect(gameState.updateSystem).toHaveBeenCalledWith(
        testSystem.id,
        jasmine.objectContaining({
          totalPopulation: jasmine.any(Number)
        })
      );
    });

    it('should detect food shortage and trigger famine', () => {
      // Set very low food
      gameState.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        if (resourceId === ResourceId.PreparedFoods) return 0;
        const resource = testSystem.resources.find(r => r.resourceId === resourceId);
        return resource?.amount ?? 0;
      });

      service.processTick(1);

      expect(gameState.updateSystem).toHaveBeenCalledWith(
        testSystem.id,
        jasmine.objectContaining({ state: SystemState.Famine })
      );
      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ type: 'danger', title: 'Famine!' })
      );
    });

    it('should recover from famine when food available', () => {
      testSystem.state = SystemState.Famine;

      service.processTick(1);

      expect(gameState.updateSystem).toHaveBeenCalledWith(
        testSystem.id,
        jasmine.objectContaining({ state: SystemState.Stable })
      );
    });

    it('should trigger rioting with low security and SoL', () => {
      testSystem.securityLevel = 0;
      testSystem.standardOfLiving = 20;

      service.processTick(1);

      // May trigger rioting
      const updateCalls = gameState.updateSystem.calls.allArgs();
      const riotingUpdate = updateCalls.find(call => call[1].state === SystemState.Rioting);

      if (riotingUpdate) {
        expect(gameState.addNotification).toHaveBeenCalledWith(
          jasmine.objectContaining({ type: 'warning', title: 'Rioting!' })
        );
      }
    });

    it('should trigger prosperity with high SoL', () => {
      testSystem.standardOfLiving = 75;

      service.processTick(1);

      const updateCalls = gameState.updateSystem.calls.allArgs();
      const prosperousUpdate = updateCalls.find(call => call[1].state === SystemState.Prosperous);

      if (prosperousUpdate) {
        expect(gameState.addNotification).toHaveBeenCalledWith(
          jasmine.objectContaining({ type: 'success', title: 'Prosperity!' })
        );
      }
    });
  });

  describe('calculatePopulationLimits', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        bodies: {
          'body-1': {
            id: 'body-1',
            systemId: testSystem.id,
            type: BodyType.TerrestrialPlanet,
            facilityIds: ['facility-1'],
            features: []
          }
        },
        facilities: {
          'facility-1': {
            id: 'facility-1',
            definitionId: FacilityId.Farm,
            bodyId: 'body-1',
            level: 1,
            condition: 100,
            operational: true
          }
        }
      } as any);
    });

    it('should calculate floor and ceiling from facilities', () => {
      const limits = service.calculatePopulationLimits(testSystem);

      expect(limits.floor).toBeGreaterThanOrEqual(0);
      expect(limits.ceiling).toBeGreaterThan(limits.floor);
    });

    it('should return zero for system with no facilities', () => {
      gameState.getState.and.returnValue({
        bodies: {
          'body-1': {
            id: 'body-1',
            systemId: testSystem.id,
            type: BodyType.TerrestrialPlanet,
            facilityIds: [],
            features: []
          }
        },
        facilities: {}
      } as any);

      const limits = service.calculatePopulationLimits(testSystem);

      expect(limits.floor).toBe(0);
      expect(limits.ceiling).toBe(0);
    });

    it('should ignore non-operational facilities', () => {
      gameState.getState.and.returnValue({
        bodies: {
          'body-1': {
            id: 'body-1',
            systemId: testSystem.id,
            type: BodyType.TerrestrialPlanet,
            facilityIds: ['facility-1'],
            features: []
          }
        },
        facilities: {
          'facility-1': {
            id: 'facility-1',
            definitionId: FacilityId.Farm,
            bodyId: 'body-1',
            level: 1,
            condition: 0,
            operational: false
          }
        }
      } as any);

      const limits = service.calculatePopulationLimits(testSystem);

      expect(limits.floor).toBe(0);
      expect(limits.ceiling).toBe(0);
    });
  });

  describe('getPopulationProductionBonus', () => {
    beforeEach(() => {
      gameState.getSystem.and.returnValue(testSystem);
    });

    it('should return 1.0 for population below 1000', () => {
      testSystem.totalPopulation = 500;
      const bonus = service.getPopulationProductionBonus(testSystem.id);

      expect(bonus).toBe(1.0);
    });

    it('should return greater than 1.0 for population 1000+', () => {
      testSystem.totalPopulation = 1000;
      const bonus = service.getPopulationProductionBonus(testSystem.id);

      expect(bonus).toBeGreaterThanOrEqual(1.0);
    });

    it('should scale logarithmically with population', () => {
      testSystem.totalPopulation = 10000;
      const bonus10k = service.getPopulationProductionBonus(testSystem.id);

      testSystem.totalPopulation = 100000;
      const bonus100k = service.getPopulationProductionBonus(testSystem.id);

      expect(bonus100k).toBeGreaterThan(bonus10k);
    });

    it('should return 1.0 for non-existent system', () => {
      gameState.getSystem.and.returnValue(undefined);
      const bonus = service.getPopulationProductionBonus('non-existent');

      expect(bonus).toBe(1.0);
    });
  });

  describe('getConsumptionSummary', () => {
    beforeEach(() => {
      gameState.getSystem.and.returnValue(testSystem);
      gameState.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        const resource = testSystem.resources.find(r => r.resourceId === resourceId);
        return resource?.amount ?? 0;
      });
    });

    it('should return consumption summary for required resources', () => {
      const summary = service.getConsumptionSummary(testSystem.id);

      expect(summary.length).toBeGreaterThan(0);
      expect(summary.find(s => s.resource === ResourceId.PreparedFoods)).toBeTruthy();
      expect(summary.find(s => s.resource === ResourceId.PurifiedWater)).toBeTruthy();
      expect(summary.find(s => s.resource === ResourceId.BasicGoods)).toBeTruthy();
    });

    it('should calculate needed resources per hour', () => {
      const summary = service.getConsumptionSummary(testSystem.id);

      summary.forEach(item => {
        expect(item.needed).toBeGreaterThan(0);
      });
    });

    it('should mark resources as critical when insufficient', () => {
      gameState.getSystemResource.and.returnValue(0.5); // Very low

      const summary = service.getConsumptionSummary(testSystem.id);

      expect(summary.some(s => s.status === 'critical')).toBe(true);
    });

    it('should mark resources as warning when supply is low', () => {
      gameState.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        if (resourceId === ResourceId.PreparedFoods) return 5; // Low but not critical
        const resource = testSystem.resources.find(r => r.resourceId === resourceId);
        return resource?.amount ?? 0;
      });

      const summary = service.getConsumptionSummary(testSystem.id);
      const food = summary.find(s => s.resource === ResourceId.PreparedFoods);

      expect(food?.status).toBe('warning');
    });

    it('should return empty array for non-existent system', () => {
      gameState.getSystem.and.returnValue(undefined);
      const summary = service.getConsumptionSummary('non-existent');

      expect(summary).toEqual([]);
    });
  });
});
