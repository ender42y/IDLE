import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FleetViewComponent } from './fleet-view.component';
import { GameStateService } from '../../services/game-state.service';
import { ExplorationService } from '../../services/exploration.service';
import { ColonizationService } from '../../services/colonization.service';
import { signal } from '@angular/core';
import { Ship, ShipType, ShipSize, ShipTier, ShipStatus, ScoutMission, TradeRoute } from '../../models/ship.model';
import { StarSystem, SystemRarity, SystemState } from '../../models/star-system.model';
import { CelestialBody, BodyType } from '../../models/celestial-body.model';
import { ResourceId } from '../../models/resource.model';

describe('FleetViewComponent', () => {
  let component: FleetViewComponent;
  let fixture: ComponentFixture<FleetViewComponent>;
  let gameState: jasmine.SpyObj<GameStateService>;
  let explorationService: jasmine.SpyObj<ExplorationService>;
  let colonizationService: jasmine.SpyObj<ColonizationService>;

  let testScout: Ship;
  let testFreighter: Ship;
  let testSystem: StarSystem;
  let testTargetSystem: StarSystem;
  let testBody: CelestialBody;
  let testMission: ScoutMission;
  let testRoute: TradeRoute;

  beforeEach(async () => {
    const gameStateSpy = jasmine.createSpyObj('GameStateService', [
      'getState',
      'getSystemResource'
    ], {
      ships: signal<Record<string, Ship>>({}),
      tradeRoutes: signal<Record<string, TradeRoute>>({}),
      scoutMissions: signal<Record<string, ScoutMission>>({}),
      systems: signal<Record<string, StarSystem>>({})
    });

    const explorationSpy = jasmine.createSpyObj('ExplorationService', [
      'launchScoutMission',
      'cancelScoutMission'
    ]);

    const colonizationSpy = jasmine.createSpyObj('ColonizationService', [
      'getColonizationRequirements',
      'sendColonizationMission'
    ]);

    // Setup colonization service to return requirements before component creation
    colonizationSpy.getColonizationRequirements.and.returnValue([
      { resourceId: ResourceId.Steel, amount: 100 },
      { resourceId: ResourceId.Electronics, amount: 50 }
    ]);

    await TestBed.configureTestingModule({
      declarations: [FleetViewComponent],
      providers: [
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: ExplorationService, useValue: explorationSpy },
        { provide: ColonizationService, useValue: colonizationSpy }
      ]
    }).compileComponents();

    gameState = TestBed.inject(GameStateService) as jasmine.SpyObj<GameStateService>;
    explorationService = TestBed.inject(ExplorationService) as jasmine.SpyObj<ExplorationService>;
    colonizationService = TestBed.inject(ColonizationService) as jasmine.SpyObj<ColonizationService>;

    // Create component after setting up mocks
    fixture = TestBed.createComponent(FleetViewComponent);
    component = fixture.componentInstance;

    testScout = {
      id: 'scout-1',
      name: 'Explorer',
      type: ShipType.Scout,
      size: ShipSize.Light,
      tier: ShipTier.Standard,
      condition: 100,
      status: ShipStatus.Idle,
      currentSystemId: 'system-1',
      scoutRange: 50,
      scoutSpeed: 2.0,
      sensorQuality: 1.0,
      speedModifier: 1.0,
      rangeModifier: 1.0,
      efficiencyModifier: 1.0
    };

    testFreighter = {
      id: 'freighter-1',
      name: 'Hauler',
      type: ShipType.Freighter,
      size: ShipSize.Medium,
      tier: ShipTier.Standard,
      condition: 100,
      status: ShipStatus.Idle,
      currentSystemId: 'system-1',
      cargoCapacity: 500,
      currentCargo: [],
      speedModifier: 1.0,
      rangeModifier: 1.0,
      efficiencyModifier: 1.0
    };

    testSystem = {
      id: 'system-1',
      name: 'Origin System',
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
      colonized: true
    };

    testTargetSystem = {
      id: 'system-2',
      name: 'Target System',
      coordinates: { x: 10, y: 10 },
      rarity: SystemRarity.Uncommon,
      discovered: true,
      discoveredAt: Date.now(),
      surveyed: true,
      bodyIds: ['body-2'],
      stellarSlots: 1,
      state: SystemState.Stable,
      totalPopulation: 0,
      techLevel: 0,
      securityLevel: 0,
      standardOfLiving: 0,
      resources: [],
      storageCapacity: 0,
      hasTradeStation: false,
      tradeStationTier: 0,
      colonized: false
    };

    testBody = {
      id: 'body-2',
      systemId: 'system-2',
      name: 'Target Planet',
      type: BodyType.TerrestrialPlanet,
      orbitalSlots: 2,
      surfaceSlots: 4,
      usedOrbitalSlots: 0,
      usedSurfaceSlots: 0,
      features: [],
      surveyed: true,
      facilityIds: [],
      population: 0,
      populationCeiling: 1000,
      populationFloor: 0
    };

    testMission = {
      id: 'mission-1',
      shipId: 'scout-1',
      originSystemId: 'system-1',
      startTime: Date.now(),
      estimatedArrival: Date.now() + 3600000,
      returnTime: Date.now() + 7200000,
      status: 'outbound',
      surveyComplete: false
    };

    testRoute = {
      id: 'route-1',
      name: 'Trade Route 1',
      originSystemId: 'system-1',
      destinationSystemId: 'system-2',
      outboundCargo: [],
      returnCargo: [],
      assignedShipIds: [],
      active: true
    };

    gameState.getSystemResource.and.returnValue(0);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should initialize with showColonizationPanel as false', () => {
      expect(component.showColonizationPanel()).toBe(false);
    });

    it('should initialize with null selectedFreighterId', () => {
      expect(component.selectedFreighterId()).toBeNull();
    });

    it('should initialize with null selectedTargetSystemId', () => {
      expect(component.selectedTargetSystemId()).toBeNull();
    });

    it('should initialize with null selectedPortBodyId', () => {
      expect(component.selectedPortBodyId()).toBeNull();
    });

    it('should get colonization requirements on init', () => {
      expect(colonizationService.getColonizationRequirements).toHaveBeenCalled();
    });
  });

  describe('shipsList computed', () => {
    it('should convert ships record to array', () => {
      (gameState.ships as any).set({
        'scout-1': testScout,
        'freighter-1': testFreighter
      });

      const ships = component.shipsList();

      expect(ships.length).toBe(2);
      expect(ships).toContain(testScout);
      expect(ships).toContain(testFreighter);
    });

    it('should return empty array when no ships', () => {
      (gameState.ships as any).set({});

      const ships = component.shipsList();

      expect(ships).toEqual([]);
    });
  });

  describe('routesList computed', () => {
    it('should convert trade routes record to array', () => {
      (gameState.tradeRoutes as any).set({
        'route-1': testRoute
      });

      const routes = component.routesList();

      expect(routes.length).toBe(1);
      expect(routes[0]).toEqual(testRoute);
    });

    it('should return empty array when no routes', () => {
      (gameState.tradeRoutes as any).set({});

      const routes = component.routesList();

      expect(routes).toEqual([]);
    });
  });

  describe('missionsList computed', () => {
    it('should convert scout missions record to array', () => {
      (gameState.scoutMissions as any).set({
        'mission-1': testMission
      });

      const missions = component.missionsList();

      expect(missions.length).toBe(1);
      expect(missions[0]).toEqual(testMission);
    });

    it('should return empty array when no missions', () => {
      (gameState.scoutMissions as any).set({});

      const missions = component.missionsList();

      expect(missions).toEqual([]);
    });
  });

  describe('idleScouts computed', () => {
    it('should filter idle scout ships', () => {
      (gameState.ships as any).set({
        'scout-1': testScout,
        'scout-2': { ...testScout, id: 'scout-2', status: ShipStatus.Scouting },
        'freighter-1': testFreighter
      });

      const idleScouts = component.idleScouts();

      expect(idleScouts.length).toBe(1);
      expect(idleScouts[0].id).toBe('scout-1');
    });

    it('should return empty array when no idle scouts', () => {
      (gameState.ships as any).set({
        'scout-1': { ...testScout, status: ShipStatus.Scouting }
      });

      const idleScouts = component.idleScouts();

      expect(idleScouts).toEqual([]);
    });
  });

  describe('idleFreighters computed', () => {
    it('should filter idle freighter ships', () => {
      (gameState.ships as any).set({
        'freighter-1': testFreighter,
        'freighter-2': { ...testFreighter, id: 'freighter-2', status: ShipStatus.InTransit },
        'scout-1': testScout
      });

      const idleFreighters = component.idleFreighters();

      expect(idleFreighters.length).toBe(1);
      expect(idleFreighters[0].id).toBe('freighter-1');
    });

    it('should return empty array when no idle freighters', () => {
      (gameState.ships as any).set({
        'freighter-1': { ...testFreighter, status: ShipStatus.InTransit }
      });

      const idleFreighters = component.idleFreighters();

      expect(idleFreighters).toEqual([]);
    });
  });

  describe('uncolonizedSystems computed', () => {
    it('should filter discovered but uncolonized systems', () => {
      (gameState.systems as any).set({
        'system-1': testSystem,
        'system-2': testTargetSystem,
        'system-3': { ...testTargetSystem, id: 'system-3', discovered: false }
      });

      const uncolonized = component.uncolonizedSystems();

      expect(uncolonized.length).toBe(1);
      expect(uncolonized[0].id).toBe('system-2');
    });

    it('should exclude undiscovered systems', () => {
      (gameState.systems as any).set({
        'system-2': { ...testTargetSystem, discovered: false }
      });

      const uncolonized = component.uncolonizedSystems();

      expect(uncolonized).toEqual([]);
    });

    it('should exclude colonized systems', () => {
      (gameState.systems as any).set({
        'system-1': testSystem
      });

      const uncolonized = component.uncolonizedSystems();

      expect(uncolonized).toEqual([]);
    });
  });

  describe('activeMissions computed', () => {
    it('should filter non-completed missions', () => {
      (gameState.scoutMissions as any).set({
        'mission-1': testMission,
        'mission-2': { ...testMission, id: 'mission-2', status: 'returning' },
        'mission-3': { ...testMission, id: 'mission-3', status: 'completed' }
      });

      const active = component.activeMissions();

      expect(active.length).toBe(2);
      expect(active.find(m => m.id === 'mission-3')).toBeUndefined();
    });

    it('should return empty array when no active missions', () => {
      (gameState.scoutMissions as any).set({
        'mission-1': { ...testMission, status: 'completed' }
      });

      const active = component.activeMissions();

      expect(active).toEqual([]);
    });
  });

  describe('targetSystemBodies computed', () => {
    beforeEach(() => {
      (gameState.systems as any).set({
        'system-2': testTargetSystem
      });
      gameState.getState.and.returnValue({
        bodies: {
          'body-2': testBody,
          'body-3': { ...testBody, id: 'body-3', orbitalSlots: 0 }
        }
      } as any);
    });

    it('should return bodies from selected target system', () => {
      component.selectedTargetSystemId.set('system-2');

      const bodies = component.targetSystemBodies();

      expect(bodies.length).toBe(1);
      expect(bodies[0].id).toBe('body-2');
    });

    it('should filter out bodies with no orbital slots', () => {
      testTargetSystem.bodyIds = ['body-2', 'body-3'];
      component.selectedTargetSystemId.set('system-2');

      const bodies = component.targetSystemBodies();

      expect(bodies.length).toBe(1);
      expect(bodies[0].orbitalSlots).toBeGreaterThan(0);
    });

    it('should return empty array when no target system selected', () => {
      component.selectedTargetSystemId.set(null);

      const bodies = component.targetSystemBodies();

      expect(bodies).toEqual([]);
    });

    it('should return empty array when target system not found', () => {
      component.selectedTargetSystemId.set('invalid-system');

      const bodies = component.targetSystemBodies();

      expect(bodies).toEqual([]);
    });
  });

  describe('canSendColonization computed', () => {
    beforeEach(() => {
      (gameState.ships as any).set({
        'freighter-1': testFreighter
      });
      (gameState.systems as any).set({
        'system-1': testSystem,
        'system-2': testTargetSystem
      });
      gameState.getState.and.returnValue({
        bodies: { 'body-2': testBody }
      } as any);
      gameState.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        if (resourceId === ResourceId.Fuel) return 1000;
        if (resourceId === ResourceId.Steel) return 200;
        if (resourceId === ResourceId.Electronics) return 100;
        return 0;
      });
    });

    it('should return true when all conditions met', () => {
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const canSend = component.canSendColonization();

      expect(canSend).toBe(true);
    });

    it('should return false when no freighter selected', () => {
      component.selectedFreighterId.set(null);
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const canSend = component.canSendColonization();

      expect(canSend).toBe(false);
    });

    it('should return false when no target system selected', () => {
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set(null);
      component.selectedPortBodyId.set('body-2');

      const canSend = component.canSendColonization();

      expect(canSend).toBe(false);
    });

    it('should return false when no port body selected', () => {
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set(null);

      const canSend = component.canSendColonization();

      expect(canSend).toBe(false);
    });

    it('should return false when freighter not found', () => {
      component.selectedFreighterId.set('invalid-freighter');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const canSend = component.canSendColonization();

      expect(canSend).toBe(false);
    });

    it('should return false when freighter not idle', () => {
      (gameState.ships as any).set({
        'freighter-1': { ...testFreighter, status: ShipStatus.InTransit }
      });
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const canSend = component.canSendColonization();

      expect(canSend).toBe(false);
    });

    it('should return false when target system already colonized', () => {
      (gameState.systems as any).set({
        'system-1': testSystem,
        'system-2': { ...testTargetSystem, colonized: true }
      });
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const canSend = component.canSendColonization();

      expect(canSend).toBe(false);
    });

    it('should return false when insufficient resources', () => {
      gameState.getSystemResource.and.returnValue(10);
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const canSend = component.canSendColonization();

      expect(canSend).toBe(false);
    });

    it('should return false when insufficient fuel', () => {
      gameState.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        if (resourceId === ResourceId.Fuel) return 0;
        return 1000;
      });
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const canSend = component.canSendColonization();

      expect(canSend).toBe(false);
    });
  });

  describe('getShipSizeName', () => {
    it('should return ship size name', () => {
      const name = component.getShipSizeName(testScout);

      expect(name).toBe('Light');
    });

    it('should handle different ship sizes', () => {
      const heavy = { ...testFreighter, size: ShipSize.Heavy };
      const name = component.getShipSizeName(heavy);

      expect(name).toBe('Heavy');
    });

    it('should return size string when definition not found', () => {
      const unknownShip = { ...testScout, size: 'unknown' as ShipSize };
      const name = component.getShipSizeName(unknownShip);

      expect(name).toBe('unknown');
    });
  });

  describe('getShipTierName', () => {
    it('should return ship tier name', () => {
      const name = component.getShipTierName(testScout);

      expect(name).toBe('Standard');
    });

    it('should handle different ship tiers', () => {
      const elite = { ...testScout, tier: ShipTier.Elite };
      const name = component.getShipTierName(elite);

      expect(name).toBe('Elite');
    });

    it('should return tier number when definition not found', () => {
      const unknownShip = { ...testScout, tier: 99 as ShipTier };
      const name = component.getShipTierName(unknownShip);

      expect(name).toBe('Tier 99');
    });
  });

  describe('getSystemName', () => {
    beforeEach(() => {
      (gameState.systems as any).set({
        'system-1': testSystem
      });
    });

    it('should return system name', () => {
      const name = component.getSystemName('system-1');

      expect(name).toBe('Origin System');
    });

    it('should return Unknown for invalid system', () => {
      const name = component.getSystemName('invalid');

      expect(name).toBe('Unknown');
    });
  });

  describe('getMissionShipName', () => {
    beforeEach(() => {
      (gameState.ships as any).set({
        'scout-1': testScout
      });
    });

    it('should return ship name from mission', () => {
      const name = component.getMissionShipName(testMission);

      expect(name).toBe('Explorer');
    });

    it('should return Unknown when ship not found', () => {
      const name = component.getMissionShipName({ shipId: 'invalid' });

      expect(name).toBe('Unknown');
    });

    it('should return Unknown when mission has no shipId', () => {
      const name = component.getMissionShipName({});

      expect(name).toBe('Unknown');
    });
  });

  describe('getStatusClass', () => {
    it('should return status-idle for idle status', () => {
      expect(component.getStatusClass('idle')).toBe('status-idle');
    });

    it('should return status-transit for in_transit status', () => {
      expect(component.getStatusClass('in_transit')).toBe('status-transit');
    });

    it('should return status-scouting for scouting status', () => {
      expect(component.getStatusClass('scouting')).toBe('status-scouting');
    });

    it('should return status-surveying for surveying status', () => {
      expect(component.getStatusClass('surveying')).toBe('status-surveying');
    });

    it('should return empty string for unknown status', () => {
      expect(component.getStatusClass('unknown')).toBe('');
    });
  });

  describe('formatTime', () => {
    beforeEach(() => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(1000000000));
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('should return Arriving... for past timestamps', () => {
      const pastTime = Date.now() - 1000;

      expect(component.formatTime(pastTime)).toBe('Arriving...');
    });

    it('should format hours, minutes, and seconds', () => {
      const futureTime = Date.now() + (2 * 3600 + 30 * 60 + 45) * 1000;

      expect(component.formatTime(futureTime)).toBe('2h 30m 45s');
    });

    it('should format minutes and seconds when less than 1 hour', () => {
      const futureTime = Date.now() + (15 * 60 + 30) * 1000;

      expect(component.formatTime(futureTime)).toBe('15m 30s');
    });

    it('should format seconds only when less than 1 minute', () => {
      const futureTime = Date.now() + 45 * 1000;

      expect(component.formatTime(futureTime)).toBe('45s');
    });
  });

  describe('launchScout', () => {
    beforeEach(() => {
      (gameState.ships as any).set({
        'scout-1': testScout
      });
    });

    it('should launch scout mission with first idle scout', () => {
      component.launchScout();

      expect(explorationService.launchScoutMission).toHaveBeenCalledWith('scout-1');
    });

    it('should not launch when no idle scouts', () => {
      (gameState.ships as any).set({
        'scout-1': { ...testScout, status: ShipStatus.Scouting }
      });

      component.launchScout();

      expect(explorationService.launchScoutMission).not.toHaveBeenCalled();
    });
  });

  describe('recallMission', () => {
    it('should cancel scout mission', () => {
      component.recallMission('mission-1');

      expect(explorationService.cancelScoutMission).toHaveBeenCalledWith('mission-1');
    });
  });

  describe('toggleColonizationPanel', () => {
    it('should toggle showColonizationPanel', () => {
      expect(component.showColonizationPanel()).toBe(false);

      component.toggleColonizationPanel();
      expect(component.showColonizationPanel()).toBe(true);

      component.toggleColonizationPanel();
      expect(component.showColonizationPanel()).toBe(false);
    });

    it('should reset selections when closing panel', () => {
      component.showColonizationPanel.set(true);
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      component.toggleColonizationPanel();

      expect(component.selectedFreighterId()).toBeNull();
      expect(component.selectedTargetSystemId()).toBeNull();
      expect(component.selectedPortBodyId()).toBeNull();
    });

    it('should not reset selections when opening panel', () => {
      component.showColonizationPanel.set(false);
      component.selectedFreighterId.set('freighter-1');

      component.toggleColonizationPanel();

      expect(component.selectedFreighterId()).toBe('freighter-1');
    });
  });

  describe('selectFreighter', () => {
    it('should set selected freighter ID', () => {
      component.selectFreighter('freighter-1');

      expect(component.selectedFreighterId()).toBe('freighter-1');
    });

    it('should log selection to console', () => {
      spyOn(console, 'log');

      component.selectFreighter('freighter-1');

      expect(console.log).toHaveBeenCalledWith('[FleetView] selectFreighter', 'freighter-1');
    });
  });

  describe('selectTargetSystem', () => {
    it('should set selected target system ID', () => {
      component.selectTargetSystem('system-2');

      expect(component.selectedTargetSystemId()).toBe('system-2');
    });

    it('should reset port body selection', () => {
      component.selectedPortBodyId.set('body-2');

      component.selectTargetSystem('system-2');

      expect(component.selectedPortBodyId()).toBeNull();
    });

    it('should log selection to console', () => {
      spyOn(console, 'log');

      component.selectTargetSystem('system-2');

      expect(console.log).toHaveBeenCalledWith('[FleetView] selectTargetSystem', 'system-2');
    });
  });

  describe('selectPortBody', () => {
    it('should set selected port body ID', () => {
      component.selectPortBody('body-2');

      expect(component.selectedPortBodyId()).toBe('body-2');
    });

    it('should log selection to console', () => {
      spyOn(console, 'log');

      component.selectPortBody('body-2');

      expect(console.log).toHaveBeenCalledWith('[FleetView] selectPortBody', 'body-2');
    });
  });

  describe('getResourceName', () => {
    it('should return resource name from definitions', () => {
      const name = component.getResourceName(ResourceId.Steel);

      expect(name).toBe('Steel');
    });

    it('should return resource ID when definition not found', () => {
      const name = component.getResourceName('unknown' as ResourceId);

      expect(name).toBe('unknown');
    });
  });

  describe('getBodyTypeName', () => {
    it('should convert body type to readable name', () => {
      const body = { type: 'terrestrial_planet' };
      const name = component.getBodyTypeName(body);

      expect(name).toBe('Terrestrial Planet');
    });

    it('should handle underscores and capitalize words', () => {
      const body = { type: 'gas_giant' };
      const name = component.getBodyTypeName(body);

      expect(name).toBe('Gas Giant');
    });

    it('should handle single word types', () => {
      const body = { type: 'moon' };
      const name = component.getBodyTypeName(body);

      expect(name).toBe('Moon');
    });
  });

  describe('getResourceAvailable', () => {
    beforeEach(() => {
      (gameState.ships as any).set({
        'freighter-1': testFreighter
      });
      gameState.getSystemResource.and.returnValue(500);
    });

    it('should return resource amount at freighter origin system', () => {
      component.selectedFreighterId.set('freighter-1');

      const amount = component.getResourceAvailable(ResourceId.Steel);

      expect(amount).toBe(500);
      expect(gameState.getSystemResource).toHaveBeenCalledWith('system-1', ResourceId.Steel);
    });

    it('should return 0 when no freighter selected', () => {
      component.selectedFreighterId.set(null);

      const amount = component.getResourceAvailable(ResourceId.Steel);

      expect(amount).toBe(0);
    });

    it('should return 0 when freighter not found', () => {
      component.selectedFreighterId.set('invalid-freighter');

      const amount = component.getResourceAvailable(ResourceId.Steel);

      expect(amount).toBe(0);
    });
  });

  describe('sendColonizationMission', () => {
    beforeEach(() => {
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');
      component.showColonizationPanel.set(true);
    });

    it('should call colonization service with correct parameters', () => {
      colonizationService.sendColonizationMission.and.returnValue(true);

      component.sendColonizationMission();

      expect(colonizationService.sendColonizationMission).toHaveBeenCalledWith(
        'freighter-1',
        'system-2',
        component.colonizationRequirements,
        'body-2'
      );
    });

    it('should close panel and reset selections on success', () => {
      colonizationService.sendColonizationMission.and.returnValue(true);

      component.sendColonizationMission();

      expect(component.showColonizationPanel()).toBe(false);
      expect(component.selectedFreighterId()).toBeNull();
      expect(component.selectedTargetSystemId()).toBeNull();
      expect(component.selectedPortBodyId()).toBeNull();
    });

    it('should not close panel on failure', () => {
      colonizationService.sendColonizationMission.and.returnValue(false);

      component.sendColonizationMission();

      expect(component.showColonizationPanel()).toBe(true);
      expect(component.selectedFreighterId()).toBe('freighter-1');
    });

    it('should not send when no freighter selected', () => {
      component.selectedFreighterId.set(null);

      component.sendColonizationMission();

      expect(colonizationService.sendColonizationMission).not.toHaveBeenCalled();
    });

    it('should not send when no target system selected', () => {
      component.selectedTargetSystemId.set(null);

      component.sendColonizationMission();

      expect(colonizationService.sendColonizationMission).not.toHaveBeenCalled();
    });

    it('should not send when no port body selected', () => {
      component.selectedPortBodyId.set(null);

      component.sendColonizationMission();

      expect(colonizationService.sendColonizationMission).not.toHaveBeenCalled();
    });

    it('should log mission send attempt', () => {
      spyOn(console, 'log');
      colonizationService.sendColonizationMission.and.returnValue(true);

      component.sendColonizationMission();

      expect(console.log).toHaveBeenCalledWith(
        '[FleetView] sendColonizationMission called',
        { freighterId: 'freighter-1', targetId: 'system-2', portBodyId: 'body-2' }
      );
    });

    it('should log abort when selections missing', () => {
      spyOn(console, 'log');
      component.selectedFreighterId.set(null);

      component.sendColonizationMission();

      expect(console.log).toHaveBeenCalledWith(
        '[FleetView] sendColonizationMission aborted - missing selection'
      );
    });
  });

  describe('getColonizationDisabledReason', () => {
    beforeEach(() => {
      (gameState.ships as any).set({
        'freighter-1': testFreighter
      });
      (gameState.systems as any).set({
        'system-1': testSystem,
        'system-2': testTargetSystem
      });
      gameState.getState.and.returnValue({
        bodies: { 'body-2': testBody }
      } as any);
      gameState.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        if (resourceId === ResourceId.Fuel) return 1000;
        if (resourceId === ResourceId.Steel) return 200;
        if (resourceId === ResourceId.Electronics) return 100;
        return 0;
      });
    });

    it('should return null when all conditions met', () => {
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const reason = component.getColonizationDisabledReason();

      expect(reason).toBeNull();
    });

    it('should return message when no freighter selected', () => {
      component.selectedFreighterId.set(null);
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const reason = component.getColonizationDisabledReason();

      expect(reason).toBe('Select a freighter to send.');
    });

    it('should return message when no target system selected', () => {
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set(null);
      component.selectedPortBodyId.set('body-2');

      const reason = component.getColonizationDisabledReason();

      expect(reason).toBe('Select a target system.');
    });

    it('should return message when no port body selected', () => {
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set(null);

      const reason = component.getColonizationDisabledReason();

      expect(reason).toBe('Select a body for the initial starport.');
    });

    it('should return message when freighter not found', () => {
      component.selectedFreighterId.set('invalid-freighter');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const reason = component.getColonizationDisabledReason();

      expect(reason).toBe('Selected freighter not found.');
    });

    it('should return message when freighter not idle', () => {
      (gameState.ships as any).set({
        'freighter-1': { ...testFreighter, status: ShipStatus.InTransit }
      });
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const reason = component.getColonizationDisabledReason();

      expect(reason).toBe('Hauler is not available.');
    });

    it('should return message when origin system not found', () => {
      (gameState.systems as any).set({
        'system-2': testTargetSystem
      });
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const reason = component.getColonizationDisabledReason();

      expect(reason).toBe('Invalid origin or destination.');
    });

    it('should return message when target system already colonized', () => {
      (gameState.systems as any).set({
        'system-1': testSystem,
        'system-2': { ...testTargetSystem, colonized: true }
      });
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const reason = component.getColonizationDisabledReason();

      expect(reason).toBe('Target system is already colonized.');
    });

    it('should return message when insufficient resources', () => {
      gameState.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        if (resourceId === ResourceId.Steel) return 50;
        return 1000;
      });
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const reason = component.getColonizationDisabledReason();

      expect(reason).toContain('Insufficient');
      expect(reason).toContain('steel');
    });

    it('should return message when insufficient fuel', () => {
      gameState.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        if (resourceId === ResourceId.Fuel) return 10;
        return 1000;
      });
      component.selectedFreighterId.set('freighter-1');
      component.selectedTargetSystemId.set('system-2');
      component.selectedPortBodyId.set('body-2');

      const reason = component.getColonizationDisabledReason();

      expect(reason).toContain('Insufficient fuel');
      expect(reason).toContain('10');
    });
  });
});
