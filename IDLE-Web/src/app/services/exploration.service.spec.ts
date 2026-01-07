import { TestBed } from '@angular/core/testing';
import { ExplorationService } from './exploration.service';
import { GameStateService } from './game-state.service';
import { GalaxyGeneratorService } from './galaxy-generator.service';
import { StarSystem, SystemRarity, SystemState } from '../models/star-system.model';
import { Ship, ShipType, ShipSize, ShipTier, ShipStatus } from '../models/ship.model';
import { ResourceId } from '../models/resource.model';

describe('ExplorationService', () => {
  let service: ExplorationService;
  let gameState: jasmine.SpyObj<GameStateService>;
  let galaxyGenerator: jasmine.SpyObj<GalaxyGeneratorService>;

  let testSystem: StarSystem;
  let testShip: Ship;

  beforeEach(() => {
    const gameStateSpy = jasmine.createSpyObj('GameStateService', [
      'getState',
      'getSystem',
      'updateSystem',
      'addSystem',
      'updateBody',
      'getSystemResource',
      'removeResourceFromSystem',
      'addScoutMission',
      'updateScoutMission',
      'removeScoutMission',
      'updateShip',
      'addNotification',
      'incrementStat',
      'generateId',
      'discoveredSystems'
    ]);

    const galaxyGeneratorSpy = jasmine.createSpyObj('GalaxyGeneratorService', [
      'generateSystem'
    ]);

    TestBed.configureTestingModule({
      providers: [
        ExplorationService,
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: GalaxyGeneratorService, useValue: galaxyGeneratorSpy }
      ]
    });

    service = TestBed.inject(ExplorationService);
    gameState = TestBed.inject(GameStateService) as jasmine.SpyObj<GameStateService>;
    galaxyGenerator = TestBed.inject(GalaxyGeneratorService) as jasmine.SpyObj<GalaxyGeneratorService>;

    // Setup test data
    testSystem = {
      id: 'test-system',
      name: 'Test System',
      coordinates: { x: 0, y: 0 },
      rarity: SystemRarity.Common,
      discovered: true,
      discoveredAt: Date.now(),
      surveyed: false,
      bodyIds: [],
      stellarSlots: 1,
      state: SystemState.Stable,
      totalPopulation: 0,
      techLevel: 0,
      securityLevel: 0,
      standardOfLiving: 50,
      resources: [{ resourceId: ResourceId.Fuel, amount: 1000, capacity: 10000 }],
      storageCapacity: 10000,
      hasTradeStation: false,
      tradeStationTier: 0,
      colonized: false,
      anomalous: false,
      hasXenoDiscovery: false
    };

    testShip = {
      id: 'test-scout',
      name: 'Test Scout',
      type: ShipType.Scout,
      size: ShipSize.Light,
      tier: ShipTier.Basic,
      condition: 100,
      status: ShipStatus.Idle,
      currentSystemId: testSystem.id,
      scoutRange: 10,
      scoutSpeed: 300,
      sensorQuality: 1,
      speedModifier: 1,
      rangeModifier: 1,
      efficiencyModifier: 1
    };
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('launchScoutMission', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        ships: { [testShip.id]: testShip },
        systems: { [testSystem.id]: testSystem },
        scoutMissions: {},
        tradeMissions: {}
      } as any);

      gameState.getSystemResource.and.returnValue(1000);
      gameState.generateId.and.returnValue('mission-1');
    });

    it('should launch a scout mission successfully', () => {
      const result = service.launchScoutMission(testShip.id);

      expect(result).toBe(true);
      expect(gameState.addScoutMission).toHaveBeenCalled();
      expect(gameState.updateShip).toHaveBeenCalledWith(testShip.id, jasmine.objectContaining({
        status: ShipStatus.Scouting
      }));
    });

    it('should fail with non-scout ship', () => {
      const freighter = { ...testShip, type: ShipType.Freighter };
      gameState.getState.and.returnValue({
        ships: { [testShip.id]: freighter },
        systems: { [testSystem.id]: testSystem },
        scoutMissions: {},
        tradeMissions: {}
      } as any);

      const result = service.launchScoutMission(testShip.id);

      expect(result).toBe(false);
      expect(gameState.addNotification).toHaveBeenCalledWith(jasmine.objectContaining({
        type: 'warning',
        title: 'Invalid Ship'
      }));
    });

    it('should fail with busy ship', () => {
      const busyShip = { ...testShip, status: ShipStatus.Scouting };
      gameState.getState.and.returnValue({
        ships: { [testShip.id]: busyShip },
        systems: { [testSystem.id]: testSystem },
        scoutMissions: {},
        tradeMissions: {}
      } as any);

      const result = service.launchScoutMission(testShip.id);

      expect(result).toBe(false);
      expect(gameState.addNotification).toHaveBeenCalledWith(jasmine.objectContaining({
        type: 'warning',
        title: 'Ship Busy'
      }));
    });

    it('should fail with insufficient fuel', () => {
      gameState.getSystemResource.and.returnValue(1); // Very low fuel

      const result = service.launchScoutMission(testShip.id);

      expect(result).toBe(false);
      expect(gameState.addNotification).toHaveBeenCalledWith(jasmine.objectContaining({
        type: 'warning',
        title: 'Insufficient Fuel'
      }));
    });

    it('should consume fuel when launching', () => {
      service.launchScoutMission(testShip.id);

      expect(gameState.removeResourceFromSystem).toHaveBeenCalledWith(
        testSystem.id,
        ResourceId.Fuel,
        jasmine.any(Number)
      );
    });

    it('should use provided direction', () => {
      const direction = { x: 1, y: 0 };
      const result = service.launchScoutMission(testShip.id, direction);

      expect(result).toBe(true);

      const missionCall = gameState.addScoutMission.calls.mostRecent();
      const mission = missionCall.args[0];

      // Target should be in the direction of the provided vector
      expect(mission.targetCoordinates).toBeDefined();
      expect(mission.targetCoordinates!.x).toBeGreaterThan(testSystem.coordinates.x);
    });

    it('should create mission with correct timing', () => {
      service.launchScoutMission(testShip.id);

      const missionCall = gameState.addScoutMission.calls.mostRecent();
      const mission = missionCall.args[0];

      expect(mission.startTime).toBeLessThanOrEqual(Date.now());
      expect(mission.estimatedArrival).toBeGreaterThan(mission.startTime);
      expect(mission.explorationComplete).toBeDefined();
      expect(mission.explorationComplete!).toBeGreaterThan(mission.estimatedArrival);
      expect(mission.returnTime).toBeGreaterThan(mission.explorationComplete!);
    });

    it('should initialize surveyComplete to false', () => {
      service.launchScoutMission(testShip.id);

      const missionCall = gameState.addScoutMission.calls.mostRecent();
      const mission = missionCall.args[0];

      expect(mission.surveyComplete).toBe(false);
    });
  });

  describe('cancelScoutMission', () => {
    let testMission: any;

    beforeEach(() => {
      const now = Date.now();
      testMission = {
        id: 'mission-1',
        shipId: testShip.id,
        originSystemId: testSystem.id,
        targetCoordinates: { x: 10, y: 10 },
        startTime: now - 5000,
        estimatedArrival: now + 5000,
        explorationComplete: now + 6000,
        returnTime: now + 10000,
        status: 'outbound'
      };

      gameState.getState.and.returnValue({
        ships: { [testShip.id]: testShip },
        systems: { [testSystem.id]: testSystem },
        scoutMissions: { [testMission.id]: testMission },
        tradeMissions: {}
      } as any);
    });

    it('should cancel an outbound mission', () => {
      const result = service.cancelScoutMission(testMission.id);

      expect(result).toBe(true);
      expect(gameState.updateScoutMission).toHaveBeenCalledWith(
        testMission.id,
        jasmine.objectContaining({ status: 'returning' })
      );
    });

    it('should cancel an exploring mission', () => {
      testMission.status = 'exploring';
      const result = service.cancelScoutMission(testMission.id);

      expect(result).toBe(true);
      expect(gameState.updateScoutMission).toHaveBeenCalledWith(
        testMission.id,
        jasmine.objectContaining({ status: 'returning' })
      );
    });

    it('should not cancel a returning mission', () => {
      testMission.status = 'returning';
      const result = service.cancelScoutMission(testMission.id);

      expect(result).toBe(false);
    });

    it('should not cancel a completed mission', () => {
      testMission.status = 'completed';
      const result = service.cancelScoutMission(testMission.id);

      expect(result).toBe(false);
    });

    it('should fail with non-existent mission', () => {
      gameState.getState.and.returnValue({
        ships: {},
        systems: {},
        scoutMissions: {},
        tradeMissions: {}
      } as any);

      const result = service.cancelScoutMission('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('processTick', () => {
    it('should update missions when processing tick', () => {
      const now = Date.now();
      const completedMission = {
        id: 'mission-1',
        shipId: testShip.id,
        originSystemId: testSystem.id,
        targetCoordinates: { x: 10, y: 10 },
        startTime: now - 20000,
        estimatedArrival: now - 10000,
        explorationComplete: now - 5000,
        returnTime: now - 1000,
        status: 'returning',
        surveyComplete: true
      };

      gameState.getState.and.returnValue({
        ships: { [testShip.id]: testShip },
        systems: { [testSystem.id]: testSystem },
        scoutMissions: { [completedMission.id]: completedMission },
        tradeMissions: {},
        bodies: {}
      } as any);

      service.processTick(1000);

      // Should have updated ship to idle
      expect(gameState.updateShip).toHaveBeenCalledWith(
        testShip.id,
        jasmine.objectContaining({ status: ShipStatus.Idle })
      );
    });

    it('should generate system when exploration completes', () => {
      const now = Date.now();
      const exploringMission = {
        id: 'mission-1',
        shipId: testShip.id,
        originSystemId: testSystem.id,
        targetCoordinates: { x: 10, y: 10 },
        startTime: now - 10000,
        estimatedArrival: now - 5000,
        explorationComplete: now - 1000,
        returnTime: now + 10000,
        status: 'exploring',
        surveyComplete: false
      };

      const generatedSystem: StarSystem = {
        id: 'new-system',
        name: 'New System',
        coordinates: { x: 10, y: 10 },
        rarity: SystemRarity.Common,
        discovered: true,
        discoveredAt: Date.now(),
        surveyed: false,
        bodyIds: ['body-1'],
        stellarSlots: 1,
        state: SystemState.Stable,
        totalPopulation: 0,
        techLevel: 0,
        securityLevel: 0,
        standardOfLiving: 50,
        resources: [],
        storageCapacity: 10000,
        hasTradeStation: false,
        tradeStationTier: 0,
        colonized: false,
        anomalous: false,
        hasXenoDiscovery: false
      };

      gameState.getState.and.returnValue({
        ships: { [testShip.id]: testShip },
        systems: { [testSystem.id]: testSystem },
        scoutMissions: { [exploringMission.id]: exploringMission },
        tradeMissions: {},
        bodies: {}
      } as any);

      gameState.discoveredSystems.and.returnValue([testSystem]);
      galaxyGenerator.generateSystem.and.returnValue(generatedSystem);

      service.processTick(1000);

      expect(galaxyGenerator.generateSystem).toHaveBeenCalled();
      expect(gameState.addSystem).toHaveBeenCalledWith(generatedSystem);
      expect(gameState.updateScoutMission).toHaveBeenCalledWith(
        exploringMission.id,
        jasmine.objectContaining({
          status: 'returning',
          discoveredSystemId: generatedSystem.id,
          surveyComplete: true
        })
      );
    });

    it('should progress outbound mission to exploring', () => {
      const now = Date.now();
      const outboundMission = {
        id: 'mission-1',
        shipId: testShip.id,
        originSystemId: testSystem.id,
        targetCoordinates: { x: 10, y: 10 },
        startTime: now - 10000,
        estimatedArrival: now - 1000,
        explorationComplete: now + 5000,
        returnTime: now + 10000,
        status: 'outbound',
        surveyComplete: false
      };

      gameState.getState.and.returnValue({
        ships: { [testShip.id]: testShip },
        systems: { [testSystem.id]: testSystem },
        scoutMissions: { [outboundMission.id]: outboundMission },
        tradeMissions: {},
        bodies: {}
      } as any);

      service.processTick(1000);

      expect(gameState.updateScoutMission).toHaveBeenCalledWith(
        outboundMission.id,
        { status: 'exploring' }
      );
    });

    it('should remove mission with missing ship', () => {
      const mission = {
        id: 'mission-1',
        shipId: 'non-existent-ship',
        originSystemId: testSystem.id,
        targetCoordinates: { x: 10, y: 10 },
        startTime: Date.now(),
        estimatedArrival: Date.now() + 10000,
        explorationComplete: Date.now() + 15000,
        returnTime: Date.now() + 20000,
        status: 'outbound',
        surveyComplete: false
      };

      gameState.getState.and.returnValue({
        ships: {},
        systems: { [testSystem.id]: testSystem },
        scoutMissions: { [mission.id]: mission },
        tradeMissions: {},
        bodies: {}
      } as any);

      service.processTick(1000);

      expect(gameState.removeScoutMission).toHaveBeenCalledWith(mission.id);
    });
  });

  describe('processOfflineMissions', () => {
    it('should complete missions that finished offline', () => {
      const now = Date.now();
      const completedMission = {
        id: 'mission-1',
        shipId: testShip.id,
        originSystemId: testSystem.id,
        targetCoordinates: { x: 10, y: 10 },
        startTime: now - 50000,
        estimatedArrival: now - 40000,
        explorationComplete: now - 30000,
        returnTime: now - 10000,
        status: 'returning',
        discoveredSystemId: 'new-system',
        surveyComplete: true
      };

      const discoveredSystem: StarSystem = {
        id: 'new-system',
        name: 'New System',
        coordinates: { x: 10, y: 10 },
        rarity: SystemRarity.Common,
        discovered: true,
        discoveredAt: Date.now(),
        surveyed: false,
        bodyIds: [],
        stellarSlots: 1,
        state: SystemState.Stable,
        totalPopulation: 0,
        techLevel: 0,
        securityLevel: 0,
        standardOfLiving: 50,
        resources: [],
        storageCapacity: 10000,
        hasTradeStation: false,
        tradeStationTier: 0,
        colonized: false,
        anomalous: false,
        hasXenoDiscovery: false
      };

      gameState.getState.and.returnValue({
        ships: { [testShip.id]: testShip },
        systems: {
          [testSystem.id]: testSystem,
          [discoveredSystem.id]: discoveredSystem
        },
        scoutMissions: { [completedMission.id]: completedMission },
        tradeMissions: {},
        bodies: {}
      } as any);

      service.processOfflineMissions(60000);

      expect(gameState.updateShip).toHaveBeenCalledWith(
        testShip.id,
        jasmine.objectContaining({ status: ShipStatus.Idle })
      );
      expect(gameState.updateScoutMission).toHaveBeenCalledWith(
        completedMission.id,
        { status: 'completed' }
      );
    });
  });

  describe('getExplorationDirections', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        ships: {},
        systems: { [testSystem.id]: testSystem },
        scoutMissions: {},
        tradeMissions: {},
        nextDiscoveryDistance: 10
      } as any);
    });

    it('should return 8 cardinal directions', () => {
      const directions = service.getExplorationDirections(testSystem.id);

      expect(directions.length).toBe(8);
      expect(directions.map(d => d.name)).toContain('Rimward');
      expect(directions.map(d => d.name)).toContain('Spinward');
      expect(directions.map(d => d.name)).toContain('Coreward');
      expect(directions.map(d => d.name)).toContain('Trailing');
    });

    it('should include distance for each direction', () => {
      const directions = service.getExplorationDirections(testSystem.id);

      directions.forEach(d => {
        expect(d.distance).toBe(10);
      });
    });

    it('should return empty array for non-existent system', () => {
      gameState.getState.and.returnValue({
        ships: {},
        systems: {},
        scoutMissions: {},
        tradeMissions: {}
      } as any);

      const directions = service.getExplorationDirections('non-existent');

      expect(directions.length).toBe(0);
    });
  });
});
