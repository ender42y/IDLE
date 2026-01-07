import { TestBed } from '@angular/core/testing';
import { HomeSystemService } from './home-system.service';
import { GameStateService } from './game-state.service';
import { SystemRarity } from '../models/star-system.model';
import { BodyType, BodyFeature } from '../models/celestial-body.model';
import { ResourceId } from '../models/resource.model';
import { ShipType } from '../models/ship.model';
import { FacilityId } from '../models/facility.model';

describe('HomeSystemService', () => {
  let service: HomeSystemService;
  let gameState: jasmine.SpyObj<GameStateService>;
  let idCounter: number;

  beforeEach(() => {
    idCounter = 0;

    const gameStateSpy = jasmine.createSpyObj('GameStateService', [
      'addSystem',
      'updateSystem',
      'addBody',
      'updateBody',
      'addFacility',
      'addShip',
      'generateId',
      'getState',
      'getBody',
      'selectSystem'
    ]);

    gameStateSpy.generateId.and.callFake(() => `id-${idCounter++}`);
    gameStateSpy.getBody.and.callFake((id: string) => ({
      id,
      usedOrbitalSlots: 0,
      usedSurfaceSlots: 0,
      facilityIds: []
    } as any));

    TestBed.configureTestingModule({
      providers: [
        HomeSystemService,
        { provide: GameStateService, useValue: gameStateSpy }
      ]
    });

    service = TestBed.inject(HomeSystemService);
    gameState = TestBed.inject(GameStateService) as jasmine.SpyObj<GameStateService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initializeHomeSystem', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        bodies: {},
        facilities: {}
      } as any);
    });

    it('should create Sol system', () => {
      service.initializeHomeSystem();

      expect(gameState.addSystem).toHaveBeenCalledWith(jasmine.objectContaining({
        id: 'sol',
        name: 'Sol',
        coordinates: { x: 0, y: 0 },
        discovered: true,
        surveyed: true,
        colonized: true
      }));
    });

    it('should initialize Sol with correct attributes', () => {
      service.initializeHomeSystem();

      const systemCall = gameState.addSystem.calls.first();
      const sol = systemCall.args[0];

      expect(sol.rarity).toBe(SystemRarity.Uncommon);
      expect(sol.totalPopulation).toBe(2000);
      expect(sol.hasTradeStation).toBe(true);
      expect(sol.tradeStationTier).toBe(2);
    });

    it('should create starting resources', () => {
      service.initializeHomeSystem();

      const systemCall = gameState.addSystem.calls.first();
      const sol = systemCall.args[0];

      expect(sol.resources.length).toBeGreaterThan(0);
      expect(sol.resources.find((r: any) => r.resourceId === ResourceId.Steel)).toBeTruthy();
      expect(sol.resources.find((r: any) => r.resourceId === ResourceId.Fuel)).toBeTruthy();
    });

    it('should create 7 bodies in Sol', () => {
      service.initializeHomeSystem();

      // Should create: Sol (star), Sol 1, Sol 2, Sol 3, Sol 3-a, Sol 4, Sol 4-a, Sol 4-b
      expect(gameState.addBody).toHaveBeenCalledTimes(8);
    });

    it('should create Sol star as first body', () => {
      service.initializeHomeSystem();

      const firstBodyCall = gameState.addBody.calls.first();
      const star = firstBodyCall.args[0];

      expect(star.name).toBe('Sol');
      expect(star.type).toBe(BodyType.Star);
      expect(star.orbitalSlots).toBe(2);
      expect(star.surfaceSlots).toBe(0);
    });

    it('should create Sol 3 as Earth-like planet', () => {
      service.initializeHomeSystem();

      const bodyCalls = gameState.addBody.calls.allArgs();
      const sol3 = bodyCalls.find(call => call[0].name === 'Sol 3');

      expect(sol3).toBeTruthy();
      expect(sol3![0].type).toBe(BodyType.EarthLikePlanet);
      expect(sol3![0].features).toContain(BodyFeature.Habitable);
      expect(sol3![0].population).toBe(1500);
    });

    it('should create Sol 4 as Gas Giant', () => {
      service.initializeHomeSystem();

      const bodyCalls = gameState.addBody.calls.allArgs();
      const sol4 = bodyCalls.find(call => call[0].name === 'Sol 4');

      expect(sol4).toBeTruthy();
      expect(sol4![0].type).toBe(BodyType.GasGiant);
      expect(sol4![0].surfaceSlots).toBe(0);
    });

    it('should create moons for Sol 3 and Sol 4', () => {
      service.initializeHomeSystem();

      const bodyCalls = gameState.addBody.calls.allArgs();
      const moons = bodyCalls.filter(call =>
        call[0].name === 'Sol 3-a' ||
        call[0].name === 'Sol 4-a' ||
        call[0].name === 'Sol 4-b'
      );

      expect(moons.length).toBe(3);
    });

    it('should create starting facilities', () => {
      service.initializeHomeSystem();

      // Should create multiple starting facilities
      expect(gameState.addFacility).toHaveBeenCalled();
      expect(gameState.addFacility.calls.count()).toBeGreaterThan(10);
    });

    it('should create complete production chains', () => {
      service.initializeHomeSystem();

      const facilityCalls = gameState.addFacility.calls.allArgs();
      const facilityIds = facilityCalls.map(call => call[0].definitionId);

      // Steel chain: Mine + Smelter
      expect(facilityIds).toContain(FacilityId.Mine);
      expect(facilityIds).toContain(FacilityId.Smelter);

      // Water chain: Ice Harvester + Water Purifier
      expect(facilityIds).toContain(FacilityId.IceHarvester);
      expect(facilityIds).toContain(FacilityId.WaterPurifier);

      // Food chain: Farm + Food Processor + Food Kitchen
      expect(facilityIds).toContain(FacilityId.Farm);
      expect(facilityIds).toContain(FacilityId.FoodProcessor);
      expect(facilityIds).toContain(FacilityId.FoodKitchen);

      // Fuel chain: Gas Collector + Hydrocarbon Extractor + Fuel Refinery
      expect(facilityIds).toContain(FacilityId.GasCollector);
      expect(facilityIds).toContain(FacilityId.HydrocarbonExtractor);
      expect(facilityIds).toContain(FacilityId.FuelRefinery);
    });

    it('should create Trade Station', () => {
      service.initializeHomeSystem();

      const facilityCalls = gameState.addFacility.calls.allArgs();
      const facilityIds = facilityCalls.map(call => call[0].definitionId);

      expect(facilityIds).toContain(FacilityId.TradeStation);
    });

    it('should create starting ships', () => {
      service.initializeHomeSystem();

      expect(gameState.addShip).toHaveBeenCalledTimes(2);
    });

    it('should create one scout ship', () => {
      service.initializeHomeSystem();

      const shipCalls = gameState.addShip.calls.allArgs();
      const scout = shipCalls.find(call => call[0].type === ShipType.Scout);

      expect(scout).toBeTruthy();
      expect(scout![0].name).toBe('ISS Pioneer');
      expect(scout![0].currentSystemId).toBe('sol');
    });

    it('should create one freighter ship', () => {
      service.initializeHomeSystem();

      const shipCalls = gameState.addShip.calls.allArgs();
      const freighter = shipCalls.find(call => call[0].type === ShipType.Freighter);

      expect(freighter).toBeTruthy();
      expect(freighter![0].name).toBe('ISS Merchant');
      expect(freighter![0].currentSystemId).toBe('sol');
    });

    it('should select Sol system by default', () => {
      service.initializeHomeSystem();

      expect(gameState.selectSystem).toHaveBeenCalledWith('sol');
    });

    it('should update system with body IDs', () => {
      gameState.getState.and.returnValue({
        bodies: {
          'body-1': { id: 'body-1', systemId: 'sol' },
          'body-2': { id: 'body-2', systemId: 'sol' },
          'body-3': { id: 'body-3', systemId: 'other' }
        },
        facilities: {}
      } as any);

      service.initializeHomeSystem();

      expect(gameState.updateSystem).toHaveBeenCalledWith(
        'sol',
        jasmine.objectContaining({
          bodyIds: jasmine.arrayContaining(['body-1', 'body-2'])
        })
      );
    });

    it('should mark all bodies as surveyed', () => {
      service.initializeHomeSystem();

      const bodyCalls = gameState.addBody.calls.allArgs();

      bodyCalls.forEach(call => {
        expect(call[0].surveyed).toBe(true);
      });
    });

    it('should place facilities on correct bodies', () => {
      service.initializeHomeSystem();

      // Sol 1 should have Silicate Quarry and Glass Works
      // Sol 2 should have Mine and Smelter
      // etc.

      // Verify at least that orbital facilities are marked correctly
      const updateBodyCalls = gameState.updateBody.calls.allArgs();

      // Some bodies should have used orbital slots
      const hasOrbitalFacilities = updateBodyCalls.some(
        call => call[1].usedOrbitalSlots && call[1].usedOrbitalSlots > 0
      );
      expect(hasOrbitalFacilities).toBe(true);

      // Some bodies should have used surface slots
      const hasSurfaceFacilities = updateBodyCalls.some(
        call => call[1].usedSurfaceSlots && call[1].usedSurfaceSlots > 0
      );
      expect(hasSurfaceFacilities).toBe(true);
    });
  });
});
