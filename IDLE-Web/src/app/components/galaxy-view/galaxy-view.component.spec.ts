import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { GalaxyViewComponent } from './galaxy-view.component';
import { GameStateService } from '../../services/game-state.service';
import { ExplorationService } from '../../services/exploration.service';
import { signal } from '@angular/core';
import { StarSystem, SystemRarity, SystemState } from '../../models/star-system.model';
import { CelestialBody, BodyType, BodyFeature } from '../../models/celestial-body.model';
import { Ship, ShipType, ShipSize, ShipTier, ShipStatus, ScoutMission } from '../../models/ship.model';
import { ResourceId } from '../../models/resource.model';

describe('GalaxyViewComponent', () => {
  let component: GalaxyViewComponent;
  let fixture: ComponentFixture<GalaxyViewComponent>;
  let gameState: jasmine.SpyObj<GameStateService>;
  let explorationService: jasmine.SpyObj<ExplorationService>;

  let testSystems: Record<string, StarSystem>;
  let testBodies: Record<string, CelestialBody>;
  let testShips: Record<string, Ship>;
  let testMissions: Record<string, ScoutMission>;
  let mockCanvas: HTMLCanvasElement;
  let mockContext: jasmine.SpyObj<CanvasRenderingContext2D>;

  beforeEach(async () => {
    const gameStateSpy = jasmine.createSpyObj('GameStateService', [
      'selectSystem'
    ], {
      systems: signal<Record<string, StarSystem>>({}),
      selectedSystem: signal<StarSystem | null>(null),
      ships: signal<Record<string, Ship>>({}),
      scoutMissions: signal<Record<string, ScoutMission>>({}),
      bodies: signal<Record<string, CelestialBody>>({})
    });

    const explorationSpy = jasmine.createSpyObj('ExplorationService', [
      'launchScoutMission',
      'cancelScoutMission'
    ]);

    await TestBed.configureTestingModule({
      declarations: [GalaxyViewComponent],
      providers: [
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: ExplorationService, useValue: explorationSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GalaxyViewComponent);
    component = fixture.componentInstance;
    gameState = TestBed.inject(GameStateService) as jasmine.SpyObj<GameStateService>;
    explorationService = TestBed.inject(ExplorationService) as jasmine.SpyObj<ExplorationService>;

    // Setup test data
    testSystems = {
      'sol': {
        id: 'sol',
        name: 'Sol',
        coordinates: { x: 0, y: 0 },
        rarity: SystemRarity.Common,
        discovered: true,
        discoveredAt: Date.now(),
        surveyed: true,
        bodyIds: ['sol-1', 'sol-2'],
        stellarSlots: 2,
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
      },
      'alpha': {
        id: 'alpha',
        name: 'Alpha Centauri',
        coordinates: { x: 4.37, y: 0 },
        rarity: SystemRarity.Rare,
        discovered: true,
        discoveredAt: Date.now() - 1000000,
        surveyed: false,
        bodyIds: ['alpha-1'],
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
        colonized: false,
        anomalous: false,
        hasXenoDiscovery: false
      },
      'legendary': {
        id: 'legendary',
        name: 'Pristine',
        coordinates: { x: -10, y: 20 },
        rarity: SystemRarity.Legendary,
        discovered: true,
        discoveredAt: Date.now() - 500000,
        surveyed: true,
        bodyIds: [],
        stellarSlots: 2,
        state: SystemState.Stable,
        totalPopulation: 0,
        techLevel: 0,
        securityLevel: 0,
        standardOfLiving: 0,
        resources: [],
        storageCapacity: 0,
        hasTradeStation: false,
        tradeStationTier: 0,
        colonized: false,
        anomalous: true,
        hasXenoDiscovery: true
      },
      'undiscovered': {
        id: 'undiscovered',
        name: 'Unknown',
        coordinates: { x: 100, y: 100 },
        rarity: SystemRarity.Common,
        discovered: false,
        surveyed: false,
        bodyIds: [],
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
        colonized: false,
        anomalous: false,
        hasXenoDiscovery: false
      }
    };

    testBodies = {
      'sol-1': {
        id: 'sol-1',
        systemId: 'sol',
        name: 'Sol 1',
        type: BodyType.Star,
        orbitalSlots: 2,
        surfaceSlots: 0,
        usedOrbitalSlots: 0,
        usedSurfaceSlots: 0,
        features: [],
        surveyed: true,
        facilityIds: [],
        population: 0,
        populationCeiling: 100,
        populationFloor: 0
      },
      'sol-2': {
        id: 'sol-2',
        systemId: 'sol',
        name: 'Earth',
        type: BodyType.EarthLikePlanet,
        orbitalSlots: 3,
        surfaceSlots: 6,
        usedOrbitalSlots: 0,
        usedSurfaceSlots: 2,
        features: [BodyFeature.Habitable, BodyFeature.FertileSoil],
        surveyed: true,
        facilityIds: [],
        population: 1000,
        populationCeiling: 5000,
        populationFloor: 500
      },
      'sol-3': {
        id: 'sol-3',
        systemId: 'sol',
        name: 'Luna',
        type: BodyType.Moon,
        parentBodyId: 'sol-2',
        orbitalSlots: 1,
        surfaceSlots: 2,
        usedOrbitalSlots: 0,
        usedSurfaceSlots: 1,
        features: [],
        surveyed: true,
        facilityIds: [],
        population: 50,
        populationCeiling: 200,
        populationFloor: 0
      }
    };

    testShips = {
      'scout-1': {
        id: 'scout-1',
        name: 'Explorer',
        type: ShipType.Scout,
        size: ShipSize.Light,
        tier: ShipTier.Basic,
        condition: 100,
        status: ShipStatus.Idle,
        currentSystemId: 'sol',
        scoutRange: 10,
        scoutSpeed: 2,
        sensorQuality: 1,
        speedModifier: 1,
        rangeModifier: 1,
        efficiencyModifier: 1
      },
      'scout-2': {
        id: 'scout-2',
        name: 'Pathfinder',
        type: ShipType.Scout,
        size: ShipSize.Light,
        tier: ShipTier.Standard,
        condition: 85,
        status: ShipStatus.Scouting,
        currentSystemId: 'sol',
        scoutRange: 12,
        scoutSpeed: 2.5,
        sensorQuality: 1.2,
        speedModifier: 1,
        rangeModifier: 1,
        efficiencyModifier: 1
      },
      'freighter-1': {
        id: 'freighter-1',
        name: 'Hauler',
        type: ShipType.Freighter,
        size: ShipSize.Medium,
        tier: ShipTier.Basic,
        condition: 90,
        status: ShipStatus.Idle,
        currentSystemId: 'sol',
        cargoCapacity: 500,
        currentCargo: [],
        speedModifier: 1,
        rangeModifier: 1,
        efficiencyModifier: 1
      }
    };

    testMissions = {
      'mission-1': {
        id: 'mission-1',
        shipId: 'scout-2',
        originSystemId: 'sol',
        targetCoordinates: { x: 10, y: 10 },
        startTime: Date.now() - 3600000,
        estimatedArrival: Date.now() + 3600000,
        returnTime: Date.now() + 7200000,
        status: 'outbound',
        surveyComplete: false
      },
      'mission-2': {
        id: 'mission-2',
        shipId: 'scout-3',
        originSystemId: 'sol',
        startTime: Date.now() - 10000000,
        estimatedArrival: Date.now() - 5000000,
        explorationComplete: Date.now() - 4000000,
        returnTime: Date.now() + 1000000,
        status: 'returning',
        discoveredSystemId: 'alpha',
        surveyComplete: true
      }
    };

    // Setup mock canvas and context
    mockContext = jasmine.createSpyObj('CanvasRenderingContext2D', [
      'fillRect',
      'beginPath',
      'arc',
      'fill',
      'stroke',
      'moveTo',
      'lineTo',
      'fillText',
      'createRadialGradient'
    ]);

    const mockGradient = jasmine.createSpyObj('CanvasGradient', ['addColorStop']);
    mockContext.createRadialGradient.and.returnValue(mockGradient);

    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;
    spyOn(mockCanvas, 'getContext').and.returnValue(mockContext);

    // Setup canvas ViewChild
    component.canvasRef = new ElementRef(mockCanvas);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should initialize with default viewOffset', () => {
      expect(component.viewOffset).toEqual({ x: 0, y: 0 });
    });

    it('should initialize with default viewScale', () => {
      expect(component.viewScale).toBe(20);
    });

    it('should reference injected services', () => {
      expect(component.systems).toBeDefined();
      expect(component.selectedSystem).toBeDefined();
      expect(component.ships).toBeDefined();
      expect(component.scoutMissions).toBeDefined();
      expect(component.bodies).toBeDefined();
    });
  });

  describe('ngAfterViewInit', () => {
    it('should center on home system', () => {
      spyOn(component, 'centerOnHome');
      spyOn(component, 'render');

      component.ngAfterViewInit();

      expect(component.centerOnHome).toHaveBeenCalled();
    });

    it('should render the canvas', () => {
      spyOn(component, 'centerOnHome');
      spyOn(component, 'render');

      component.ngAfterViewInit();

      expect(component.render).toHaveBeenCalled();
    });
  });

  describe('systemsList computed', () => {
    it('should return only discovered systems', () => {
      (gameState.systems as any).set(testSystems);

      const systems = component.systemsList();

      expect(systems.length).toBe(3);
      expect(systems.every(s => s.discovered)).toBe(true);
    });

    it('should filter out undiscovered systems', () => {
      (gameState.systems as any).set(testSystems);

      const systems = component.systemsList();

      expect(systems.find(s => s.id === 'undiscovered')).toBeUndefined();
    });

    it('should return empty array when no systems exist', () => {
      (gameState.systems as any).set({});

      const systems = component.systemsList();

      expect(systems).toEqual([]);
    });

    it('should include Sol system', () => {
      (gameState.systems as any).set(testSystems);

      const systems = component.systemsList();

      expect(systems.find(s => s.id === 'sol')).toBeDefined();
    });
  });

  describe('idleScouts computed', () => {
    it('should return only idle scout ships', () => {
      (gameState.ships as any).set(testShips);

      const scouts = component.idleScouts();

      expect(scouts.length).toBe(1);
      expect(scouts[0].id).toBe('scout-1');
      expect(scouts[0].status).toBe(ShipStatus.Idle);
    });

    it('should filter out scouts that are scouting', () => {
      (gameState.ships as any).set(testShips);

      const scouts = component.idleScouts();

      expect(scouts.find(s => s.id === 'scout-2')).toBeUndefined();
    });

    it('should filter out freighter ships', () => {
      (gameState.ships as any).set(testShips);

      const scouts = component.idleScouts();

      expect(scouts.find(s => s.type === ShipType.Freighter)).toBeUndefined();
    });

    it('should return empty array when no idle scouts exist', () => {
      (gameState.ships as any).set({
        'scout-2': testShips['scout-2'],
        'freighter-1': testShips['freighter-1']
      });

      const scouts = component.idleScouts();

      expect(scouts).toEqual([]);
    });

    it('should return empty array when no ships exist', () => {
      (gameState.ships as any).set({});

      const scouts = component.idleScouts();

      expect(scouts).toEqual([]);
    });
  });

  describe('activeMissions computed', () => {
    it('should return missions that are not completed', () => {
      (gameState.scoutMissions as any).set(testMissions);

      const missions = component.activeMissions();

      expect(missions.length).toBe(2);
      expect(missions.every(m => m.status !== 'completed')).toBe(true);
    });

    it('should filter out completed missions', () => {
      const completedMission: ScoutMission = {
        ...testMissions['mission-1'],
        id: 'completed',
        status: 'completed'
      };

      (gameState.scoutMissions as any).set({
        ...testMissions,
        'completed': completedMission
      });

      const missions = component.activeMissions();

      expect(missions.find(m => m.id === 'completed')).toBeUndefined();
    });

    it('should return empty array when no missions exist', () => {
      (gameState.scoutMissions as any).set({});

      const missions = component.activeMissions();

      expect(missions).toEqual([]);
    });

    it('should include outbound missions', () => {
      (gameState.scoutMissions as any).set(testMissions);

      const missions = component.activeMissions();

      expect(missions.find(m => m.status === 'outbound')).toBeDefined();
    });

    it('should include returning missions', () => {
      (gameState.scoutMissions as any).set(testMissions);

      const missions = component.activeMissions();

      expect(missions.find(m => m.status === 'returning')).toBeDefined();
    });
  });

  describe('systemBodies computed', () => {
    beforeEach(() => {
      (gameState.selectedSystem as any).set(testSystems['sol']);
      testSystems['sol'].bodyIds = ['sol-1', 'sol-2', 'sol-3'];
      (gameState.bodies as any).set(testBodies);
    });

    it('should return bodies for selected system', () => {
      const bodies = component.systemBodies();

      expect(bodies.length).toBe(3);
    });

    it('should place star first', () => {
      const bodies = component.systemBodies();

      expect(bodies[0].type).toBe(BodyType.Star);
    });

    it('should place moons after their parent body', () => {
      const bodies = component.systemBodies();

      const earthIndex = bodies.findIndex(b => b.id === 'sol-2');
      const lunaIndex = bodies.findIndex(b => b.id === 'sol-3');

      expect(lunaIndex).toBeGreaterThan(earthIndex);
    });

    it('should sort primary bodies by name after star', () => {
      const planet1: CelestialBody = {
        ...testBodies['sol-2'],
        id: 'planet-1',
        name: 'Zeus',
        type: BodyType.TerrestrialPlanet,
        parentBodyId: undefined
      };

      const planet2: CelestialBody = {
        ...testBodies['sol-2'],
        id: 'planet-2',
        name: 'Apollo',
        type: BodyType.TerrestrialPlanet,
        parentBodyId: undefined
      };

      (gameState.bodies as any).set({
        'sol-1': testBodies['sol-1'],
        'planet-1': planet1,
        'planet-2': planet2
      });

      (gameState.selectedSystem as any).set({
        ...testSystems['sol'],
        bodyIds: ['sol-1', 'planet-1', 'planet-2']
      });

      const bodies = component.systemBodies();

      expect(bodies[1].name).toBe('Apollo');
      expect(bodies[2].name).toBe('Zeus');
    });

    it('should sort moons by name', () => {
      const moon1: CelestialBody = {
        ...testBodies['sol-3'],
        id: 'moon-1',
        name: 'Zeta',
        parentBodyId: 'sol-2'
      };

      const moon2: CelestialBody = {
        ...testBodies['sol-3'],
        id: 'moon-2',
        name: 'Alpha',
        parentBodyId: 'sol-2'
      };

      (gameState.bodies as any).set({
        'sol-1': testBodies['sol-1'],
        'sol-2': testBodies['sol-2'],
        'moon-1': moon1,
        'moon-2': moon2
      });

      (gameState.selectedSystem as any).set({
        ...testSystems['sol'],
        bodyIds: ['sol-1', 'sol-2', 'moon-1', 'moon-2']
      });

      const bodies = component.systemBodies();
      const earthIndex = bodies.findIndex(b => b.id === 'sol-2');

      expect(bodies[earthIndex + 1].name).toBe('Alpha');
      expect(bodies[earthIndex + 2].name).toBe('Zeta');
    });

    it('should return empty array when no system selected', () => {
      (gameState.selectedSystem as any).set(null);

      const bodies = component.systemBodies();

      expect(bodies).toEqual([]);
    });

    it('should filter out undefined bodies', () => {
      (gameState.selectedSystem as any).set({
        ...testSystems['sol'],
        bodyIds: ['sol-1', 'missing-body', 'sol-2']
      });

      (gameState.bodies as any).set({
        'sol-1': testBodies['sol-1'],
        'sol-2': testBodies['sol-2']
      });

      const bodies = component.systemBodies();

      expect(bodies.length).toBe(2);
      expect(bodies.every(b => b !== undefined)).toBe(true);
    });
  });

  describe('centerOnHome', () => {
    it('should center view on canvas center', () => {
      component.centerOnHome();

      expect(component.viewOffset.x).toBe(400);
      expect(component.viewOffset.y).toBe(300);
    });

    it('should handle missing canvas gracefully', () => {
      component.canvasRef = undefined as any;

      expect(() => component.centerOnHome()).not.toThrow();
    });

    it('should update viewOffset when canvas dimensions change', () => {
      mockCanvas.width = 1000;
      mockCanvas.height = 800;

      component.centerOnHome();

      expect(component.viewOffset.x).toBe(500);
      expect(component.viewOffset.y).toBe(400);
    });
  });

  describe('render', () => {
    beforeEach(() => {
      (gameState.systems as any).set(testSystems);
    });

    it('should clear canvas with background color', () => {
      component.render();

      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });

    it('should handle missing canvas gracefully', () => {
      component.canvasRef = undefined as any;

      expect(() => component.render()).not.toThrow();
    });

    it('should handle missing context gracefully', () => {
      (mockCanvas.getContext as jasmine.Spy).and.returnValue(null);

      expect(() => component.render()).not.toThrow();
    });

    it('should draw grid', () => {
      component.render();

      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalled();
      expect(mockContext.lineTo).toHaveBeenCalled();
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    it('should draw all discovered systems', () => {
      component.render();

      expect(mockContext.arc).toHaveBeenCalled();
      expect(mockContext.fillText).toHaveBeenCalled();
    });
  });

  describe('getSystemColor', () => {
    it('should return orange for legendary systems', () => {
      const color = (component as any).getSystemColor(testSystems['legendary']);

      expect(color).toBe('#ff9800');
    });

    it('should return purple for exceptional systems', () => {
      const exceptional: StarSystem = {
        ...testSystems['sol'],
        rarity: SystemRarity.Exceptional
      };

      const color = (component as any).getSystemColor(exceptional);

      expect(color).toBe('#9c27b0');
    });

    it('should return blue for rare systems', () => {
      const color = (component as any).getSystemColor(testSystems['alpha']);

      expect(color).toBe('#2196f3');
    });

    it('should return green for uncommon systems', () => {
      const uncommon: StarSystem = {
        ...testSystems['sol'],
        rarity: SystemRarity.Uncommon
      };

      const color = (component as any).getSystemColor(uncommon);

      expect(color).toBe('#4caf50');
    });

    it('should return gray for common systems', () => {
      const color = (component as any).getSystemColor(testSystems['sol']);

      expect(color).toBe('#9e9e9e');
    });
  });

  describe('selectSystem', () => {
    it('should call gameState.selectSystem with system id', () => {
      component.selectSystem(testSystems['alpha']);

      expect(gameState.selectSystem).toHaveBeenCalledWith('alpha');
    });

    it('should select home system', () => {
      component.selectSystem(testSystems['sol']);

      expect(gameState.selectSystem).toHaveBeenCalledWith('sol');
    });

    it('should select legendary system', () => {
      component.selectSystem(testSystems['legendary']);

      expect(gameState.selectSystem).toHaveBeenCalledWith('legendary');
    });
  });

  describe('onCanvasClick', () => {
    beforeEach(() => {
      (gameState.systems as any).set(testSystems);
      component.viewOffset = { x: 400, y: 300 };
      component.viewScale = 20;
    });

    it('should select system when clicking near it', () => {
      spyOn(component, 'selectSystem');

      const mockEvent = {
        clientX: 400,
        clientY: 300
      } as MouseEvent;

      spyOn(mockCanvas, 'getBoundingClientRect').and.returnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({})
      });

      component.onCanvasClick(mockEvent);

      expect(component.selectSystem).toHaveBeenCalledWith(testSystems['sol']);
    });

    it('should not select system when clicking far from any system', () => {
      spyOn(component, 'selectSystem');

      const mockEvent = {
        clientX: 50,
        clientY: 50
      } as MouseEvent;

      spyOn(mockCanvas, 'getBoundingClientRect').and.returnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({})
      });

      component.onCanvasClick(mockEvent);

      expect(component.selectSystem).not.toHaveBeenCalled();
    });

    it('should select closest system within click radius', () => {
      spyOn(component, 'selectSystem');

      const mockEvent = {
        clientX: 487,
        clientY: 300
      } as MouseEvent;

      spyOn(mockCanvas, 'getBoundingClientRect').and.returnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({})
      });

      component.onCanvasClick(mockEvent);

      expect(component.selectSystem).toHaveBeenCalledWith(testSystems['alpha']);
    });
  });

  describe('launchScout', () => {
    it('should launch scout mission with first idle scout', () => {
      (gameState.ships as any).set(testShips);

      component.launchScout();

      expect(explorationService.launchScoutMission).toHaveBeenCalledWith('scout-1');
    });

    it('should not launch scout when no idle scouts available', () => {
      (gameState.ships as any).set({
        'scout-2': testShips['scout-2']
      });

      component.launchScout();

      expect(explorationService.launchScoutMission).not.toHaveBeenCalled();
    });

    it('should not launch scout when ships object is empty', () => {
      (gameState.ships as any).set({});

      component.launchScout();

      expect(explorationService.launchScoutMission).not.toHaveBeenCalled();
    });
  });

  describe('cancelMission', () => {
    it('should cancel mission by id', () => {
      component.cancelMission('mission-1');

      expect(explorationService.cancelScoutMission).toHaveBeenCalledWith('mission-1');
    });

    it('should cancel multiple different missions', () => {
      component.cancelMission('mission-1');
      component.cancelMission('mission-2');

      expect(explorationService.cancelScoutMission).toHaveBeenCalledWith('mission-1');
      expect(explorationService.cancelScoutMission).toHaveBeenCalledWith('mission-2');
    });
  });

  describe('getDistance', () => {
    it('should return distance from home for Sol', () => {
      const distance = component.getDistance(testSystems['sol']);

      expect(distance).toBe('0.0');
    });

    it('should return distance from home for Alpha Centauri', () => {
      const distance = component.getDistance(testSystems['alpha']);

      expect(distance).toBe('4.4');
    });

    it('should return distance from home for distant system', () => {
      const distance = component.getDistance(testSystems['legendary']);

      expect(parseFloat(distance)).toBeCloseTo(22.4, 0);
    });

    it('should format distance to 1 decimal place', () => {
      const distance = component.getDistance(testSystems['alpha']);

      expect(distance.split('.')[1]?.length).toBe(1);
    });
  });

  describe('formatRemaining', () => {
    it('should return 0s for negative time', () => {
      expect(component.formatRemaining(-1000)).toBe('0s');
    });

    it('should return 0s for zero time', () => {
      expect(component.formatRemaining(0)).toBe('0s');
    });

    it('should format seconds only', () => {
      expect(component.formatRemaining(45000)).toBe('45s');
    });

    it('should format minutes and seconds', () => {
      expect(component.formatRemaining(125000)).toBe('2m 5s');
    });

    it('should format hours and minutes', () => {
      expect(component.formatRemaining(3720000)).toBe('1h 2m');
    });

    it('should format multiple hours', () => {
      expect(component.formatRemaining(7200000)).toBe('2h 0m');
    });

    it('should round up partial seconds', () => {
      expect(component.formatRemaining(45500)).toBe('46s');
    });

    it('should handle exactly 1 hour', () => {
      expect(component.formatRemaining(3600000)).toBe('1h 0m');
    });

    it('should handle exactly 1 minute', () => {
      expect(component.formatRemaining(60000)).toBe('1m 0s');
    });
  });

  describe('getBodyTypeName', () => {
    it('should return name for star', () => {
      const name = component.getBodyTypeName(testBodies['sol-1']);

      expect(name).toBe('Star');
    });

    it('should return name for earth-like planet', () => {
      const name = component.getBodyTypeName(testBodies['sol-2']);

      expect(name).toBe('Earth-like Planet');
    });

    it('should return name for moon', () => {
      const name = component.getBodyTypeName(testBodies['sol-3']);

      expect(name).toBe('Moon');
    });

    it('should return body type string for undefined type', () => {
      const unknownBody: CelestialBody = {
        ...testBodies['sol-2'],
        type: 'unknown_type' as BodyType
      };

      const name = component.getBodyTypeName(unknownBody);

      expect(name).toBe('unknown_type');
    });
  });

  describe('getFeatureName', () => {
    it('should return name for Habitable feature', () => {
      const name = component.getFeatureName(BodyFeature.Habitable);

      expect(name).toBe('Habitable');
    });

    it('should return name for FertileSoil feature', () => {
      const name = component.getFeatureName(BodyFeature.FertileSoil);

      expect(name).toBe('Fertile Soil');
    });

    it('should return name for HighMetalContent feature', () => {
      const name = component.getFeatureName(BodyFeature.HighMetalContent);

      expect(name).toBe('High Metal Content');
    });

    it('should return feature string for undefined feature', () => {
      const name = component.getFeatureName('unknown_feature');

      expect(name).toBe('unknown_feature');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty systems object', () => {
      (gameState.systems as any).set({});

      expect(component.systemsList()).toEqual([]);
      expect(() => component.render()).not.toThrow();
    });

    it('should handle system with no bodies', () => {
      (gameState.selectedSystem as any).set({
        ...testSystems['sol'],
        bodyIds: []
      });

      const bodies = component.systemBodies();

      expect(bodies).toEqual([]);
    });

    it('should handle multiple stars in system', () => {
      const star2: CelestialBody = {
        ...testBodies['sol-1'],
        id: 'star-2',
        name: 'Binary Star'
      };

      (gameState.bodies as any).set({
        'sol-1': testBodies['sol-1'],
        'star-2': star2
      });

      (gameState.selectedSystem as any).set({
        ...testSystems['sol'],
        bodyIds: ['sol-1', 'star-2']
      });

      const bodies = component.systemBodies();

      expect(bodies.length).toBe(2);
      expect(bodies[0].type).toBe(BodyType.Star);
      expect(bodies[1].type).toBe(BodyType.Star);
    });

    it('should filter out orphaned moon (parent not in bodyIds)', () => {
      (gameState.bodies as any).set({
        'sol-1': testBodies['sol-1'],
        'sol-3': testBodies['sol-3']
      });

      (gameState.selectedSystem as any).set({
        ...testSystems['sol'],
        bodyIds: ['sol-1', 'sol-3']
      });

      const bodies = component.systemBodies();

      expect(bodies.length).toBe(1);
      expect(bodies.find(b => b.id === 'sol-3')).toBeUndefined();
      expect(bodies[0].id).toBe('sol-1');
    });
  });
});
