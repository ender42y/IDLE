import { TestBed } from '@angular/core/testing';
import { TradeService } from './trade.service';
import { GameStateService } from './game-state.service';
import { StarSystem, SystemRarity, SystemState } from '../models/star-system.model';
import { Ship, ShipType, ShipSize, ShipTier, ShipStatus, TradeMissionType } from '../models/ship.model';
import { ResourceId } from '../models/resource.model';

describe('TradeService', () => {
  let service: TradeService;
  let gameState: jasmine.SpyObj<GameStateService>;

  let system1: StarSystem;
  let system2: StarSystem;
  let testShip: Ship;

  beforeEach(() => {
    const gameStateSpy = jasmine.createSpyObj('GameStateService', [
      'getState',
      'getSystem',
      'getSystemResource',
      'removeResourceFromSystem',
      'addResourceToSystem',
      'updateShip',
      'addTradeRoute',
      'updateTradeRoute',
      'removeTradeRoute',
      'addTradeMission',
      'updateTradeMission',
      'removeTradeMission',
      'addNotification',
      'generateId',
      'addCredits',
      'spendCredits'
    ]);

    TestBed.configureTestingModule({
      providers: [
        TradeService,
        { provide: GameStateService, useValue: gameStateSpy }
      ]
    });

    service = TestBed.inject(TradeService);
    gameState = TestBed.inject(GameStateService) as jasmine.SpyObj<GameStateService>;

    system1 = {
      id: 'system-1',
      name: 'System 1',
      coordinates: { x: 0, y: 0 },
      rarity: SystemRarity.Common,
      discovered: true,
      discoveredAt: Date.now(),
      surveyed: true,
      bodyIds: [],
      stellarSlots: 1,
      state: SystemState.Stable,
      totalPopulation: 1000,
      techLevel: 1,
      securityLevel: 1,
      standardOfLiving: 50,
      resources: [
        { resourceId: ResourceId.Fuel, amount: 1000, capacity: 10000 },
        { resourceId: ResourceId.Steel, amount: 500, capacity: 10000 }
      ],
      storageCapacity: 10000,
      hasTradeStation: true,
      tradeStationTier: 2,
      colonized: true,
      anomalous: false,
      hasXenoDiscovery: false
    };

    system2 = {
      id: 'system-2',
      name: 'System 2',
      coordinates: { x: 10, y: 10 },
      rarity: SystemRarity.Common,
      discovered: true,
      discoveredAt: Date.now(),
      surveyed: true,
      bodyIds: [],
      stellarSlots: 1,
      state: SystemState.Stable,
      totalPopulation: 500,
      techLevel: 1,
      securityLevel: 1,
      standardOfLiving: 50,
      resources: [
        { resourceId: ResourceId.Fuel, amount: 500, capacity: 10000 }
      ],
      storageCapacity: 10000,
      hasTradeStation: true,
      tradeStationTier: 2,
      colonized: true,
      anomalous: false,
      hasXenoDiscovery: false
    };

    testShip = {
      id: 'test-ship',
      name: 'Test Freighter',
      type: ShipType.Freighter,
      size: ShipSize.Light,
      tier: ShipTier.Basic,
      condition: 100,
      status: ShipStatus.Idle,
      currentSystemId: system1.id,
      cargoCapacity: 100,
      currentCargo: [],
      speedModifier: 1,
      rangeModifier: 1,
      efficiencyModifier: 1
    };

    gameState.generateId.and.returnValue('generated-id');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createTradeRoute', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        systems: { [system1.id]: system1, [system2.id]: system2 }
      } as any);
    });

    it('should create a trade route successfully', () => {
      const route = service.createTradeRoute(
        'Test Route',
        system1.id,
        system2.id,
        [{ resourceId: ResourceId.Steel, amount: 100 }],
        []
      );

      expect(route).toBeTruthy();
      expect(route?.name).toBe('Test Route');
      expect(gameState.addTradeRoute).toHaveBeenCalled();
    });

    it('should fail with invalid origin system', () => {
      const route = service.createTradeRoute(
        'Test Route',
        'non-existent',
        system2.id,
        [],
        []
      );

      expect(route).toBeNull();
      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ type: 'danger' })
      );
    });

    it('should fail with invalid destination system', () => {
      const route = service.createTradeRoute(
        'Test Route',
        system1.id,
        'non-existent',
        [],
        []
      );

      expect(route).toBeNull();
    });

    it('should fail without trade stations', () => {
      system1.hasTradeStation = false;

      const route = service.createTradeRoute(
        'Test Route',
        system1.id,
        system2.id,
        [],
        []
      );

      expect(route).toBeNull();
      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ message: jasmine.stringContaining('trade stations') })
      );
    });
  });

  describe('assignShipToRoute', () => {
    let testRoute: any;

    beforeEach(() => {
      testRoute = {
        id: 'route-1',
        name: 'Test Route',
        originSystemId: system1.id,
        destinationSystemId: system2.id,
        outboundCargo: [],
        returnCargo: [],
        assignedShipIds: [],
        active: true
      };

      gameState.getState.and.returnValue({
        systems: { [system1.id]: system1, [system2.id]: system2 },
        ships: { [testShip.id]: testShip },
        tradeRoutes: { [testRoute.id]: testRoute }
      } as any);
    });

    it('should assign ship to route successfully', () => {
      const result = service.assignShipToRoute(testShip.id, testRoute.id);

      expect(result).toBe(true);
      expect(gameState.updateTradeRoute).toHaveBeenCalled();
    });

    it('should fail with busy ship', () => {
      testShip.status = ShipStatus.InTransit;

      const result = service.assignShipToRoute(testShip.id, testRoute.id);

      expect(result).toBe(false);
      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ title: 'Ship Busy' })
      );
    });

    it('should fail with ship too large for trade stations', () => {
      testShip.size = ShipSize.Bulk;

      const result = service.assignShipToRoute(testShip.id, testRoute.id);

      expect(result).toBe(false);
      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ title: 'Ship Too Large' })
      );
    });
  });

  describe('sellToMarket', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        systems: { [system1.id]: system1 },
        marketPrices: {
          [ResourceId.Steel]: { buy: 100, sell: 80 }
        }
      } as any);

      gameState.getSystemResource.and.returnValue(500);
    });

    it('should sell resources successfully', () => {
      const result = service.sellToMarket(system1.id, ResourceId.Steel, 100);

      expect(result).toBe(true);
      expect(gameState.removeResourceFromSystem).toHaveBeenCalledWith(
        system1.id,
        ResourceId.Steel,
        100
      );
      expect(gameState.addCredits).toHaveBeenCalledWith(8000); // 100 * 80
    });

    it('should fail with insufficient resources', () => {
      gameState.getSystemResource.and.returnValue(50);

      const result = service.sellToMarket(system1.id, ResourceId.Steel, 100);

      expect(result).toBe(false);
      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ title: 'Insufficient Resources' })
      );
    });
  });

  describe('buyFromMarket', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        systems: { [system1.id]: system1 },
        credits: 10000,
        marketPrices: {
          [ResourceId.Steel]: { buy: 100, sell: 80 }
        }
      } as any);
    });

    it('should buy resources successfully', () => {
      const result = service.buyFromMarket(system1.id, ResourceId.Steel, 50);

      expect(result).toBe(true);
      expect(gameState.spendCredits).toHaveBeenCalledWith(5000); // 50 * 100
      expect(gameState.addResourceToSystem).toHaveBeenCalledWith(
        system1.id,
        ResourceId.Steel,
        50
      );
    });

    it('should fail with insufficient credits', () => {
      gameState.getState.and.returnValue({
        systems: { [system1.id]: system1 },
        credits: 1000,
        marketPrices: {
          [ResourceId.Steel]: { buy: 100, sell: 80 }
        }
      } as any);

      const result = service.buyFromMarket(system1.id, ResourceId.Steel, 50);

      expect(result).toBe(false);
      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ title: 'Insufficient Credits' })
      );
    });
  });

  describe('sendOneWayMission', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        ships: { [testShip.id]: testShip },
        systems: { [system1.id]: system1, [system2.id]: system2 }
      } as any);

      gameState.getSystemResource.and.returnValue(1000);
    });

    it('should launch one-way mission successfully', () => {
      const mission = service.sendOneWayMission(
        testShip.id,
        system2.id,
        [{ resourceId: ResourceId.Steel, amount: 50 }]
      );

      expect(mission).toBeTruthy();
      expect(mission?.missionType).toBe(TradeMissionType.OneWay);
      expect(gameState.addTradeMission).toHaveBeenCalled();
      expect(gameState.updateShip).toHaveBeenCalledWith(
        testShip.id,
        jasmine.objectContaining({ status: ShipStatus.InTransit })
      );
    });

    it('should fail with non-freighter ship', () => {
      testShip.type = ShipType.Scout;

      const mission = service.sendOneWayMission(
        testShip.id,
        system2.id,
        [{ resourceId: ResourceId.Steel, amount: 50 }]
      );

      expect(mission).toBeNull();
      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ title: 'Invalid Ship' })
      );
    });

    it('should fail with busy ship', () => {
      testShip.status = ShipStatus.InTransit;

      const mission = service.sendOneWayMission(
        testShip.id,
        system2.id,
        [{ resourceId: ResourceId.Steel, amount: 50 }]
      );

      expect(mission).toBeNull();
    });

    it('should fail with cargo exceeding capacity', () => {
      const mission = service.sendOneWayMission(
        testShip.id,
        system2.id,
        [{ resourceId: ResourceId.Steel, amount: 500 }] // Exceeds 100t capacity
      );

      expect(mission).toBeNull();
      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ title: 'Cargo Too Heavy' })
      );
    });

    it('should fail with insufficient resources', () => {
      gameState.getSystemResource.and.returnValue(10); // Low resources

      const mission = service.sendOneWayMission(
        testShip.id,
        system2.id,
        [{ resourceId: ResourceId.Steel, amount: 50 }]
      );

      expect(mission).toBeNull();
      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ title: 'Insufficient Resources' })
      );
    });

    it('should fail with insufficient fuel', () => {
      gameState.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        if (resourceId === ResourceId.Fuel) return 1; // Very low fuel
        return 1000;
      });

      const mission = service.sendOneWayMission(
        testShip.id,
        system2.id,
        [{ resourceId: ResourceId.Steel, amount: 50 }]
      );

      expect(mission).toBeNull();
      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ title: 'Insufficient Fuel' })
      );
    });
  });

  describe('sendRoundTripMission', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        ships: { [testShip.id]: testShip },
        systems: { [system1.id]: system1, [system2.id]: system2 }
      } as any);

      gameState.getSystemResource.and.returnValue(1000);
    });

    it('should launch round trip mission successfully', () => {
      const mission = service.sendRoundTripMission(
        testShip.id,
        system2.id,
        [{ resourceId: ResourceId.Steel, amount: 50 }],
        []
      );

      expect(mission).toBeTruthy();
      expect(mission?.missionType).toBe(TradeMissionType.RoundTrip);
      expect(gameState.addTradeMission).toHaveBeenCalled();
    });

    it('should calculate fuel for round trip', () => {
      service.sendRoundTripMission(
        testShip.id,
        system2.id,
        [{ resourceId: ResourceId.Steel, amount: 50 }],
        [{ resourceId: ResourceId.Fuel, amount: 30 }]
      );

      // Should consume fuel for both outbound and return
      expect(gameState.removeResourceFromSystem).toHaveBeenCalledWith(
        system1.id,
        ResourceId.Fuel,
        jasmine.any(Number)
      );
    });

    it('should fail with insufficient fuel for round trip', () => {
      gameState.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        if (resourceId === ResourceId.Fuel) return 5; // Very low fuel
        return 1000;
      });

      const mission = service.sendRoundTripMission(
        testShip.id,
        system2.id,
        [{ resourceId: ResourceId.Steel, amount: 50 }],
        []
      );

      expect(mission).toBeNull();
      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ title: 'Insufficient Fuel' })
      );
    });
  });

  describe('processTradeMissions', () => {
    it('should update trade missions', () => {
      const now = Date.now();
      const completedMission = {
        id: 'mission-1',
        shipId: testShip.id,
        missionType: TradeMissionType.OneWay,
        originSystemId: system1.id,
        destinationSystemId: system2.id,
        outboundCargo: [{ resourceId: ResourceId.Steel, amount: 50 }],
        status: 'outbound',
        departureTime: now - 20000,
        arrivalTime: now - 1000,
        fuelConsumed: 10,
        fuelReserved: 10
      };

      gameState.getState.and.returnValue({
        ships: { [testShip.id]: testShip },
        systems: { [system1.id]: system1, [system2.id]: system2 },
        tradeMissions: { [completedMission.id]: completedMission }
      } as any);

      service.processTradeMissions(1000);

      // Should deliver cargo and complete mission
      expect(gameState.addResourceToSystem).toHaveBeenCalled();
      expect(gameState.updateTradeMission).toHaveBeenCalledWith(
        completedMission.id,
        jasmine.objectContaining({ status: 'completed' })
      );
    });

    it('should handle missing ship in mission', () => {
      const mission = {
        id: 'mission-1',
        shipId: 'non-existent-ship',
        missionType: TradeMissionType.OneWay,
        originSystemId: system1.id,
        destinationSystemId: system2.id,
        outboundCargo: [],
        status: 'outbound',
        departureTime: Date.now(),
        arrivalTime: Date.now() + 10000,
        fuelConsumed: 10,
        fuelReserved: 10
      };

      gameState.getState.and.returnValue({
        ships: {},
        systems: { [system1.id]: system1, [system2.id]: system2 },
        tradeMissions: { [mission.id]: mission }
      } as any);

      service.processTradeMissions(1000);

      // Should mark mission as completed
      expect(gameState.updateTradeMission).toHaveBeenCalledWith(
        mission.id,
        { status: 'completed' }
      );
    });
  });

  describe('getEstimatedTripDuration', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        ships: { [testShip.id]: testShip },
        systems: { [system1.id]: system1, [system2.id]: system2 }
      } as any);
    });

    it('should calculate trip duration', () => {
      const duration = service.getEstimatedTripDuration(system1.id, system2.id, testShip.id);

      expect(duration).toBeGreaterThan(0);
    });

    it('should return 0 for invalid systems', () => {
      const duration = service.getEstimatedTripDuration('non-existent', system2.id, testShip.id);

      expect(duration).toBe(0);
    });

    it('should return 0 for invalid ship', () => {
      const duration = service.getEstimatedTripDuration(system1.id, system2.id, 'non-existent');

      expect(duration).toBe(0);
    });
  });
});
