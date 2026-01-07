import { TestBed } from '@angular/core/testing';
import { GameStateService } from './game-state.service';
import { GameState, GAME_VERSION } from '../models/game-state.model';
import { StarSystem, SystemRarity, SystemState } from '../models/star-system.model';
import { CelestialBody, BodyType } from '../models/celestial-body.model';
import { Facility, FacilityId } from '../models/facility.model';
import { Ship, ShipType, ShipSize, ShipTier, ShipStatus, TradeRoute, ScoutMission, TradeMission, TradeMissionType } from '../models/ship.model';
import { ResourceId } from '../models/resource.model';

describe('GameStateService', () => {
  let service: GameStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GameStateService]
    });
    service = TestBed.inject(GameStateService);

    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with default state', () => {
      const state = service.getState();
      expect(state.version).toBe(GAME_VERSION);
      expect(state.credits).toBe(10000);
      expect(Object.keys(state.systems).length).toBe(0);
      expect(Object.keys(state.bodies).length).toBe(0);
      expect(Object.keys(state.facilities).length).toBe(0);
      expect(Object.keys(state.ships).length).toBe(0);
    });

    it('should have computed signals for state parts', () => {
      expect(service.credits()).toBe(10000);
      expect(service.systems()).toEqual({});
      expect(service.bodies()).toEqual({});
      expect(service.facilities()).toEqual({});
      expect(service.ships()).toEqual({});
    });
  });

  describe('System Operations', () => {
    let testSystem: StarSystem;

    beforeEach(() => {
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
        resources: [],
        storageCapacity: 10000,
        hasTradeStation: false,
        tradeStationTier: 0,
        colonized: false,
        anomalous: false,
        hasXenoDiscovery: false
      };
    });

    it('should add a system', () => {
      service.addSystem(testSystem);
      const systems = service.systems();
      expect(systems[testSystem.id]).toEqual(testSystem);
    });

    it('should get a system by id', () => {
      service.addSystem(testSystem);
      const retrieved = service.getSystem(testSystem.id);
      expect(retrieved).toEqual(testSystem);
    });

    it('should return undefined for non-existent system', () => {
      const retrieved = service.getSystem('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should update a system', () => {
      service.addSystem(testSystem);
      service.updateSystem(testSystem.id, { colonized: true, totalPopulation: 1000 });

      const updated = service.getSystem(testSystem.id);
      expect(updated?.colonized).toBe(true);
      expect(updated?.totalPopulation).toBe(1000);
    });

    it('should track discovered systems', () => {
      const system1 = { ...testSystem, id: 'sys1', discovered: true };
      const system2 = { ...testSystem, id: 'sys2', discovered: false };

      service.addSystem(system1);
      service.addSystem(system2);

      const discovered = service.discoveredSystems();
      expect(discovered.length).toBe(1);
      expect(discovered[0].id).toBe('sys1');
    });

    it('should track colonized systems', () => {
      const system1 = { ...testSystem, id: 'sys1', colonized: true };
      const system2 = { ...testSystem, id: 'sys2', colonized: false };

      service.addSystem(system1);
      service.addSystem(system2);

      const colonized = service.colonizedSystems();
      expect(colonized.length).toBe(1);
      expect(colonized[0].id).toBe('sys1');
    });
  });

  describe('Body Operations', () => {
    let testBody: CelestialBody;

    beforeEach(() => {
      testBody = {
        id: 'test-body',
        systemId: 'test-system',
        name: 'Test Planet',
        type: BodyType.TerrestrialPlanet,
        orbitalSlots: 2,
        surfaceSlots: 4,
        usedOrbitalSlots: 0,
        usedSurfaceSlots: 0,
        features: [],
        surveyed: false,
        facilityIds: [],
        population: 0,
        populationCeiling: 1000,
        populationFloor: 0
      };
    });

    it('should add a body', () => {
      service.addBody(testBody);
      const bodies = service.bodies();
      expect(bodies[testBody.id]).toEqual(testBody);
    });

    it('should get a body by id', () => {
      service.addBody(testBody);
      const retrieved = service.getBody(testBody.id);
      expect(retrieved).toEqual(testBody);
    });

    it('should update a body', () => {
      service.addBody(testBody);
      service.updateBody(testBody.id, { surveyed: true, population: 500 });

      const updated = service.getBody(testBody.id);
      expect(updated?.surveyed).toBe(true);
      expect(updated?.population).toBe(500);
    });
  });

  describe('Facility Operations', () => {
    let testFacility: Facility;

    beforeEach(() => {
      testFacility = {
        id: 'test-facility',
        definitionId: FacilityId.Mine,
        bodyId: 'test-body',
        level: 1,
        condition: 100,
        operational: true
      };
    });

    it('should add a facility', () => {
      service.addFacility(testFacility);
      const facilities = service.facilities();
      expect(facilities[testFacility.id]).toEqual(testFacility);
    });

    it('should get a facility by id', () => {
      service.addFacility(testFacility);
      const retrieved = service.getFacility(testFacility.id);
      expect(retrieved).toEqual(testFacility);
    });

    it('should update a facility', () => {
      service.addFacility(testFacility);
      service.updateFacility(testFacility.id, { level: 2, condition: 80 });

      const updated = service.getFacility(testFacility.id);
      expect(updated?.level).toBe(2);
      expect(updated?.condition).toBe(80);
    });

    it('should remove a facility', () => {
      service.addFacility(testFacility);
      service.removeFacility(testFacility.id);

      const facilities = service.facilities();
      expect(facilities[testFacility.id]).toBeUndefined();
    });
  });

  describe('Ship Operations', () => {
    let testShip: Ship;

    beforeEach(() => {
      testShip = {
        id: 'test-ship',
        name: 'Test Scout',
        type: ShipType.Scout,
        size: ShipSize.Light,
        tier: ShipTier.Basic,
        condition: 100,
        status: ShipStatus.Idle,
        currentSystemId: 'test-system',
        scoutRange: 10,
        scoutSpeed: 300,
        sensorQuality: 1,
        speedModifier: 1,
        rangeModifier: 1,
        efficiencyModifier: 1
      };
    });

    it('should add a ship', () => {
      service.addShip(testShip);
      const ships = service.ships();
      expect(ships[testShip.id]).toEqual(testShip);
    });

    it('should get a ship by id', () => {
      service.addShip(testShip);
      const retrieved = service.getShip(testShip.id);
      expect(retrieved).toEqual(testShip);
    });

    it('should update a ship', () => {
      service.addShip(testShip);
      service.updateShip(testShip.id, { status: ShipStatus.Scouting, condition: 90 });

      const updated = service.getShip(testShip.id);
      expect(updated?.status).toBe(ShipStatus.Scouting);
      expect(updated?.condition).toBe(90);
    });

    it('should remove a ship', () => {
      service.addShip(testShip);
      service.removeShip(testShip.id);

      const ships = service.ships();
      expect(ships[testShip.id]).toBeUndefined();
    });

    it('should track idle ships', () => {
      const ship1 = { ...testShip, id: 'ship1', status: ShipStatus.Idle };
      const ship2 = { ...testShip, id: 'ship2', status: ShipStatus.Scouting };

      service.addShip(ship1);
      service.addShip(ship2);

      const idle = service.idleShips();
      expect(idle.length).toBe(1);
      expect(idle[0].id).toBe('ship1');
    });
  });

  describe('Credits Operations', () => {
    it('should add credits', () => {
      const initialCredits = service.credits();
      service.addCredits(1000);
      expect(service.credits()).toBe(initialCredits + 1000);
    });

    it('should track total credits earned', () => {
      service.addCredits(1000);
      const stats = service.stats();
      expect(stats.totalCreditsEarned).toBe(1000);
    });

    it('should not add negative credits to stats', () => {
      service.addCredits(-500);
      const stats = service.stats();
      expect(stats.totalCreditsEarned).toBe(0);
    });

    it('should spend credits successfully', () => {
      service.addCredits(1000);
      const result = service.spendCredits(500);

      expect(result).toBe(true);
      expect(service.credits()).toBe(10500);
    });

    it('should fail to spend insufficient credits', () => {
      const result = service.spendCredits(20000);

      expect(result).toBe(false);
      expect(service.credits()).toBe(10000);
    });
  });

  describe('Resource Operations', () => {
    let testSystem: StarSystem;

    beforeEach(() => {
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
        resources: [],
        storageCapacity: 10000,
        hasTradeStation: false,
        tradeStationTier: 0,
        colonized: false,
        anomalous: false,
        hasXenoDiscovery: false
      };
      service.addSystem(testSystem);
    });

    it('should add resource to system', () => {
      service.addResourceToSystem(testSystem.id, ResourceId.IronOre, 100);
      const amount = service.getSystemResource(testSystem.id, ResourceId.IronOre);
      expect(amount).toBe(100);
    });

    it('should add to existing resource', () => {
      service.addResourceToSystem(testSystem.id, ResourceId.IronOre, 100);
      service.addResourceToSystem(testSystem.id, ResourceId.IronOre, 50);

      const amount = service.getSystemResource(testSystem.id, ResourceId.IronOre);
      expect(amount).toBe(150);
    });

    it('should respect capacity when adding resources', () => {
      service.addResourceToSystem(testSystem.id, ResourceId.IronOre, 100);
      // Capacity is 10000 by default
      service.addResourceToSystem(testSystem.id, ResourceId.IronOre, 50000);

      const amount = service.getSystemResource(testSystem.id, ResourceId.IronOre);
      expect(amount).toBe(10000);
    });

    it('should remove resource from system', () => {
      service.addResourceToSystem(testSystem.id, ResourceId.IronOre, 100);
      const result = service.removeResourceFromSystem(testSystem.id, ResourceId.IronOre, 50);

      expect(result).toBe(true);
      const amount = service.getSystemResource(testSystem.id, ResourceId.IronOre);
      expect(amount).toBe(50);
    });

    it('should fail to remove insufficient resources', () => {
      service.addResourceToSystem(testSystem.id, ResourceId.IronOre, 100);
      const result = service.removeResourceFromSystem(testSystem.id, ResourceId.IronOre, 200);

      expect(result).toBe(false);
      const amount = service.getSystemResource(testSystem.id, ResourceId.IronOre);
      expect(amount).toBe(100);
    });

    it('should return 0 for non-existent resource', () => {
      const amount = service.getSystemResource(testSystem.id, ResourceId.IronOre);
      expect(amount).toBe(0);
    });

    it('should return 0 for non-existent system', () => {
      const amount = service.getSystemResource('non-existent', ResourceId.IronOre);
      expect(amount).toBe(0);
    });
  });

  describe('Selection Operations', () => {
    it('should select a system', () => {
      service.selectSystem('test-system');
      expect(service.selectedSystemId()).toBe('test-system');
    });

    it('should clear body selection when selecting system', () => {
      service.selectBody('test-body');
      service.selectSystem('test-system');

      expect(service.selectedSystemId()).toBe('test-system');
      expect(service.selectedBodyId()).toBeNull();
    });

    it('should select a body', () => {
      service.selectBody('test-body');
      expect(service.selectedBodyId()).toBe('test-body');
    });

    it('should clear selection', () => {
      service.selectSystem('test-system');
      service.selectSystem(null);

      expect(service.selectedSystemId()).toBeNull();
    });

    it('should provide selected system computed', () => {
      const testSystem: StarSystem = {
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
        resources: [],
        storageCapacity: 10000,
        hasTradeStation: false,
        tradeStationTier: 0,
        colonized: false,
        anomalous: false,
        hasXenoDiscovery: false
      };

      service.addSystem(testSystem);
      service.selectSystem(testSystem.id);

      expect(service.selectedSystem()).toEqual(testSystem);
    });
  });

  describe('Notification Operations', () => {
    it('should add a notification', () => {
      service.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message'
      });

      const notifications = service.notifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].title).toBe('Test');
      expect(notifications[0].read).toBe(false);
    });

    it('should track unread notifications', () => {
      service.addNotification({ type: 'info', title: 'Test 1', message: 'Message 1' });
      service.addNotification({ type: 'info', title: 'Test 2', message: 'Message 2' });

      const unread = service.unreadNotifications();
      expect(unread.length).toBe(2);
    });

    it('should mark notification as read', () => {
      service.addNotification({ type: 'info', title: 'Test', message: 'Message' });
      const notification = service.notifications()[0];

      service.markNotificationRead(notification.id);

      const notifications = service.notifications();
      expect(notifications[0].read).toBe(true);
      expect(service.unreadNotifications().length).toBe(0);
    });

    it('should mark all notifications as read', () => {
      service.addNotification({ type: 'info', title: 'Test 1', message: 'Message 1' });
      service.addNotification({ type: 'info', title: 'Test 2', message: 'Message 2' });

      service.markAllNotificationsRead();

      const notifications = service.notifications();
      expect(notifications.every(n => n.read)).toBe(true);
      expect(service.unreadNotifications().length).toBe(0);
    });

    it('should limit notifications to 100', () => {
      for (let i = 0; i < 150; i++) {
        service.addNotification({ type: 'info', title: `Test ${i}`, message: `Message ${i}` });
      }

      const notifications = service.notifications();
      expect(notifications.length).toBe(100);
    });
  });

  describe('Trade Route Operations', () => {
    let testRoute: TradeRoute;

    beforeEach(() => {
      testRoute = {
        id: 'test-route',
        name: 'Test Route',
        originSystemId: 'system-1',
        destinationSystemId: 'system-2',
        outboundCargo: [],
        returnCargo: [],
        assignedShipIds: [],
        active: true
      };
    });

    it('should add a trade route', () => {
      service.addTradeRoute(testRoute);
      const routes = service.tradeRoutes();
      expect(routes[testRoute.id]).toEqual(testRoute);
    });

    it('should update a trade route', () => {
      service.addTradeRoute(testRoute);
      service.updateTradeRoute(testRoute.id, { active: false });

      const state = service.getState();
      expect(state.tradeRoutes[testRoute.id].active).toBe(false);
    });

    it('should remove a trade route', () => {
      service.addTradeRoute(testRoute);
      service.removeTradeRoute(testRoute.id);

      const routes = service.tradeRoutes();
      expect(routes[testRoute.id]).toBeUndefined();
    });
  });

  describe('Scout Mission Operations', () => {
    let testMission: ScoutMission;

    beforeEach(() => {
      testMission = {
        id: 'test-mission',
        shipId: 'test-ship',
        originSystemId: 'test-system',
        targetCoordinates: { x: 10, y: 10 },
        startTime: Date.now(),
        estimatedArrival: Date.now() + 10000,
        explorationComplete: Date.now() + 15000,
        returnTime: Date.now() + 20000,
        status: 'outbound',
        surveyComplete: false
      };
    });

    it('should add a scout mission', () => {
      service.addScoutMission(testMission);
      const missions = service.scoutMissions();
      expect(missions[testMission.id]).toEqual(testMission);
    });

    it('should update a scout mission', () => {
      service.addScoutMission(testMission);
      service.updateScoutMission(testMission.id, { status: 'exploring' });

      const missions = service.scoutMissions();
      expect(missions[testMission.id].status).toBe('exploring');
    });

    it('should remove a scout mission', () => {
      service.addScoutMission(testMission);
      service.removeScoutMission(testMission.id);

      const missions = service.scoutMissions();
      expect(missions[testMission.id]).toBeUndefined();
    });
  });

  describe('Trade Mission Operations', () => {
    let testMission: TradeMission;

    beforeEach(() => {
      testMission = {
        id: 'test-mission',
        shipId: 'test-ship',
        missionType: TradeMissionType.OneWay,
        originSystemId: 'system-1',
        destinationSystemId: 'system-2',
        outboundCargo: [{ resourceId: ResourceId.Steel, amount: 100 }],
        status: 'outbound',
        departureTime: Date.now(),
        arrivalTime: Date.now() + 10000,
        fuelConsumed: 10,
        fuelReserved: 10
      };
    });

    it('should add a trade mission', () => {
      service.addTradeMission(testMission);
      const state = service.getState();
      expect(state.tradeMissions[testMission.id]).toEqual(testMission);
    });

    it('should update a trade mission', () => {
      service.addTradeMission(testMission);
      service.updateTradeMission(testMission.id, { status: 'returning' });

      const state = service.getState();
      expect(state.tradeMissions[testMission.id].status).toBe('returning');
    });

    it('should remove a trade mission', () => {
      service.addTradeMission(testMission);
      service.removeTradeMission(testMission.id);

      const state = service.getState();
      expect(state.tradeMissions[testMission.id]).toBeUndefined();
    });
  });

  describe('Settings Operations', () => {
    it('should update settings', () => {
      service.updateSettings({ tickRate: 500, soundEnabled: false });

      const settings = service.settings();
      expect(settings.tickRate).toBe(500);
      expect(settings.soundEnabled).toBe(false);
    });

    it('should save settings to localStorage', () => {
      service.updateSettings({ tickRate: 500 });
      service.saveSettings();

      const saved = localStorage.getItem('idle_game_settings');
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved!);
      expect(parsed.tickRate).toBe(500);
    });

    it('should load settings from localStorage', () => {
      const testSettings = { tickRate: 500, soundEnabled: false };
      localStorage.setItem('idle_game_settings', JSON.stringify(testSettings));

      service.loadSettings();

      const settings = service.settings();
      expect(settings.tickRate).toBe(500);
      expect(settings.soundEnabled).toBe(false);
    });
  });

  describe('Stats Operations', () => {
    it('should increment stats', () => {
      service.incrementStat('systemsDiscovered', 5);

      const stats = service.stats();
      expect(stats.systemsDiscovered).toBe(6); // Initial is 1
    });

    it('should increment stat by 1 by default', () => {
      service.incrementStat('facilitiesBuilt');

      const stats = service.stats();
      expect(stats.facilitiesBuilt).toBe(1);
    });
  });

  describe('Market Prices', () => {
    it('should initialize market prices', () => {
      const prices = service.marketPrices();
      expect(Object.keys(prices).length).toBeGreaterThan(0);
      expect(prices[ResourceId.IronOre]).toBeDefined();
      expect(prices[ResourceId.IronOre].buy).toBeGreaterThan(0);
      expect(prices[ResourceId.IronOre].sell).toBeGreaterThan(0);
    });

    it('should update market prices', () => {
      const oldPrices = { ...service.marketPrices() };
      service.updateMarketPrices();
      const newPrices = service.marketPrices();

      // Prices should fluctuate
      const hasChanged = Object.keys(oldPrices).some(
        key => oldPrices[key as ResourceId].sell !== newPrices[key as ResourceId].sell
      );
      expect(hasChanged).toBe(true);
    });

    it('should keep sell price below buy price', () => {
      service.updateMarketPrices();
      const prices = service.marketPrices();

      for (const resourceId of Object.keys(prices) as ResourceId[]) {
        expect(prices[resourceId].sell).toBeLessThan(prices[resourceId].buy);
      }
    });
  });

  describe('Persistence', () => {
    it('should save game to localStorage', () => {
      service.saveGame();

      const saved = localStorage.getItem('idle_game_state');
      expect(saved).toBeTruthy();
    });

    it('should load game from localStorage', () => {
      // Add some data
      service.addCredits(5000);
      const testSystem: StarSystem = {
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
        resources: [],
        storageCapacity: 10000,
        hasTradeStation: false,
        tradeStationTier: 0,
        colonized: false,
        anomalous: false,
        hasXenoDiscovery: false
      };
      service.addSystem(testSystem);

      // Save
      service.saveGame();

      // Create new service instance
      const newService = TestBed.inject(GameStateService);
      const loaded = newService.loadGame();

      expect(loaded).toBe(true);
      expect(newService.credits()).toBe(15000);
      expect(newService.getSystem(testSystem.id)).toBeTruthy();
    });

    it('should return false when no save exists', () => {
      const loaded = service.loadGame();
      expect(loaded).toBe(false);
    });

    it('should migrate old save versions', () => {
      const oldSave: Partial<GameState> = {
        version: '0.1.0',
        credits: 50000,
        systems: {},
        bodies: {},
        facilities: {},
        ships: {},
        tradeRoutes: {},
        scoutMissions: {}
      };

      localStorage.setItem('idle_game_state', JSON.stringify(oldSave));

      const loaded = service.loadGame();
      expect(loaded).toBe(true);

      const state = service.getState();
      expect(state.version).toBe(GAME_VERSION);
      expect(state.tradeMissions).toBeDefined();
      expect(state.prestige).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    it('should generate unique IDs', () => {
      const id1 = service.generateId();
      const id2 = service.generateId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with timestamp and random component', () => {
      const id = service.generateId();
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  describe('Prestige Operations', () => {
    it('should set prestige state', () => {
      const prestigeState = {
        totalTokens: 10,
        prestigeCount: 2,
        highestScore: 50000,
        lastPrestigeAt: Date.now()
      };

      service.setPrestigeState(prestigeState);

      const state = service.getState();
      expect(state.prestige).toEqual(prestigeState);
    });
  });
});
