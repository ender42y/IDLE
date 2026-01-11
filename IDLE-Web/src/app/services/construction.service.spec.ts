import { TestBed } from '@angular/core/testing';
import { ConstructionService } from './construction.service';
import { GameStateService } from './game-state.service';
import { FacilityId, FACILITY_DEFINITIONS } from '../models/facility.model';
import { ResourceId } from '../models/resource.model';
import { BodyType, BodyFeature } from '../models/celestial-body.model';
import { GameState } from '../models/game-state.model';

describe('ConstructionService', () => {
  let service: ConstructionService;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;

  const mockGameState: GameState = {
    version: '0.2.0',
    createdAt: Date.now(),
    lastSavedAt: Date.now(),
    lastPlayedAt: Date.now(),
    settings: {
      tickRate: 200,
      autoSaveInterval: 60000,
      soundEnabled: true,
      notificationsEnabled: true,
      theme: 'dark'
    },
    credits: 100000,
    systems: {
      'system-1': {
        id: 'system-1',
        name: 'Test System',
        coordinates: { x: 10, y: 10 },
        rarity: 'uncommon' as any,
        discovered: true,
        surveyed: true,
        bodyIds: ['body-1'],
        stellarSlots: 2,
        state: 'stable' as any,
        totalPopulation: 0,
        techLevel: 1,
        securityLevel: 1,
        standardOfLiving: 50,
        resources: [
          { resourceId: ResourceId.Steel, amount: 1000, capacity: 5000 },
          { resourceId: ResourceId.GlassCeramics, amount: 500, capacity: 5000 }
        ],
        storageCapacity: 10000,
        hasTradeStation: false,
        tradeStationTier: 0,
        colonized: true
      }
    },
    bodies: {
      'body-1': {
        id: 'body-1',
        systemId: 'system-1',
        name: 'Test Planet',
        type: BodyType.TerrestrialPlanet,
        orbitalSlots: 2,
        surfaceSlots: 5,
        usedOrbitalSlots: 0,
        usedSurfaceSlots: 0,
        features: [],
        surveyed: true,
        facilityIds: [],
        population: 0,
        populationCeiling: 10000,
        populationFloor: 0
      }
    },
    facilities: {},
    ships: {},
    tradeRoutes: {},
    scoutMissions: {},
    activeTrips: {},
    tradeMissions: {},
    explorationFrontier: [],
    nextDiscoveryDistance: 10,
    selectedSystemId: null,
    selectedBodyId: null,
    notifications: [],
    unreadNotificationCount: 0,
    stats: {
      totalPlayTime: 0,
      systemsDiscovered: 1,
      systemsColonized: 1,
      facilitiesBuilt: 0,
      totalResourcesProduced: {} as Record<ResourceId, number>,
      totalCreditsEarned: 0,
      shipsLost: 0,
      maxPopulation: 0
    },
    marketPrices: {} as Record<ResourceId, { buy: number; sell: number }>,
    prestige: {
      totalTokens: 0,
      prestigeCount: 0,
      highestScore: 0
    }
  };

  beforeEach(() => {
    const spy = jasmine.createSpyObj('GameStateService', [
      'getState',
      'addNotification',
      'spendCredits',
      'addCredits',
      'getSystemResource',
      'removeResourceFromSystem',
      'addResourceToSystem',
      'addFacility',
      'removeFacility',
      'updateBody',
      'updateSystem',
      'incrementStat',
      'generateId'
    ]);

    TestBed.configureTestingModule({
      providers: [
        ConstructionService,
        { provide: GameStateService, useValue: spy }
      ]
    });

    service = TestBed.inject(ConstructionService);
    gameStateSpy = TestBed.inject(GameStateService) as jasmine.SpyObj<GameStateService>;
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('getConstructionCost', () => {
    beforeEach(() => {
      gameStateSpy.getState.and.returnValue(mockGameState);
      gameStateSpy.getSystemResource.and.returnValue(1000);
    });

    it('should return null when body not found', () => {
      const result = service.getConstructionCost(FacilityId.Mine, 'invalid-body');
      expect(result).toBeNull();
    });

    it('should return null when system not found', () => {
      const invalidState = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], systemId: 'invalid-system' }
        }
      };
      gameStateSpy.getState.and.returnValue(invalidState);

      const result = service.getConstructionCost(FacilityId.Mine, 'body-1');
      expect(result).toBeNull();
    });

    it('should return null when facility definition not found', () => {
      const result = service.getConstructionCost('invalid-facility' as FacilityId, 'body-1');
      expect(result).toBeNull();
    });

    it('should calculate base cost correctly', () => {
      const result = service.getConstructionCost(FacilityId.Mine, 'body-1');

      expect(result).not.toBeNull();
      expect(result!.credits).toBeGreaterThan(0);
      expect(result!.resources.length).toBe(2);
      expect(result!.multiplier).toBeGreaterThan(1);
    });

    it('should apply distance multiplier', () => {
      const nearState = {
        ...mockGameState,
        systems: {
          'system-1': { ...mockGameState.systems['system-1'], coordinates: { x: 1, y: 1 } }
        }
      };
      gameStateSpy.getState.and.returnValue(nearState);
      const nearCost = service.getConstructionCost(FacilityId.Mine, 'body-1');

      const farState = {
        ...mockGameState,
        systems: {
          'system-1': { ...mockGameState.systems['system-1'], coordinates: { x: 50, y: 50 } }
        }
      };
      gameStateSpy.getState.and.returnValue(farState);
      const farCost = service.getConstructionCost(FacilityId.Mine, 'body-1');

      expect(farCost!.multiplier).toBeGreaterThan(nearCost!.multiplier);
      expect(farCost!.credits).toBeGreaterThan(nearCost!.credits);
    });

    it('should apply facility count multiplier', () => {
      const statWithFacilities = {
        ...mockGameState,
        facilities: {
          'fac-1': { id: 'fac-1', definitionId: FacilityId.Mine, bodyId: 'body-1', level: 1, condition: 100, operational: true }
        },
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], facilityIds: ['fac-1'] }
        }
      };
      gameStateSpy.getState.and.returnValue(statWithFacilities);
      const costWithFacilities = service.getConstructionCost(FacilityId.Mine, 'body-1');

      gameStateSpy.getState.and.returnValue(mockGameState);
      const costWithoutFacilities = service.getConstructionCost(FacilityId.Mine, 'body-1');

      expect(costWithFacilities!.multiplier).toBeGreaterThan(costWithoutFacilities!.multiplier);
    });

    it('should check resource affordability correctly', () => {
      gameStateSpy.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        if (resourceId === ResourceId.Steel) return 1000;
        if (resourceId === ResourceId.GlassCeramics) return 500;
        return 0;
      });

      const result = service.getConstructionCost(FacilityId.Mine, 'body-1');

      expect(result!.canAfford).toBe(true);
    });

    it('should check credit affordability correctly', () => {
      const poorState = { ...mockGameState, credits: 10 };
      gameStateSpy.getState.and.returnValue(poorState);

      const result = service.getConstructionCost(FacilityId.Mine, 'body-1');

      expect(result!.canAfford).toBe(false);
    });

    it('should mark unaffordable when resources insufficient', () => {
      gameStateSpy.getSystemResource.and.returnValue(0);

      const result = service.getConstructionCost(FacilityId.Mine, 'body-1');

      expect(result!.canAfford).toBe(false);
    });

    it('should include resource names in cost breakdown', () => {
      const result = service.getConstructionCost(FacilityId.Mine, 'body-1');

      expect(result!.resources[0].name).toBe('Steel');
      expect(result!.resources[1].name).toBe('Glass/Ceramics');
    });

    it('should round costs up to nearest integer', () => {
      const result = service.getConstructionCost(FacilityId.Mine, 'body-1');

      expect(Number.isInteger(result!.credits)).toBe(true);
      result!.resources.forEach(r => {
        expect(Number.isInteger(r.amount)).toBe(true);
      });
    });
  });

  describe('canBuildFacility', () => {
    beforeEach(() => {
      gameStateSpy.getState.and.returnValue(mockGameState);
    });

    it('should return false when body not found', () => {
      const result = service.canBuildFacility(FacilityId.Mine, 'invalid-body');

      expect(result.canBuild).toBe(false);
      expect(result.reason).toBe('Invalid body or facility');
    });

    it('should return false when facility definition not found', () => {
      const result = service.canBuildFacility('invalid-facility' as FacilityId, 'body-1');

      expect(result.canBuild).toBe(false);
      expect(result.reason).toBe('Invalid body or facility');
    });

    it('should return false when body not surveyed', () => {
      const unsurveyed = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], surveyed: false }
        }
      };
      gameStateSpy.getState.and.returnValue(unsurveyed);

      const result = service.canBuildFacility(FacilityId.Mine, 'body-1');

      expect(result.canBuild).toBe(false);
      expect(result.reason).toBe('Body must be surveyed first');
    });

    it('should return false when no surface slots available for surface facility', () => {
      const noSlots = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], surfaceSlots: 0 }
        }
      };
      gameStateSpy.getState.and.returnValue(noSlots);

      const result = service.canBuildFacility(FacilityId.Mine, 'body-1');

      expect(result.canBuild).toBe(false);
      expect(result.reason).toBe('Wrong slot type');
    });

    it('should return false when no orbital slots available for orbital facility', () => {
      const noSlots = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], orbitalSlots: 0 }
        }
      };
      gameStateSpy.getState.and.returnValue(noSlots);

      const result = service.canBuildFacility(FacilityId.GasCollector, 'body-1');

      expect(result.canBuild).toBe(false);
      expect(result.reason).toBe('Wrong slot type');
    });

    it('should return false when all surface slots used', () => {
      const fullSlots = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], surfaceSlots: 2, usedSurfaceSlots: 2 }
        }
      };
      gameStateSpy.getState.and.returnValue(fullSlots);

      const result = service.canBuildFacility(FacilityId.Mine, 'body-1');

      expect(result.canBuild).toBe(false);
      expect(result.reason).toBe('No surface slots available');
    });

    it('should return false when all orbital slots used', () => {
      const fullSlots = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], orbitalSlots: 2, usedOrbitalSlots: 2 }
        }
      };
      gameStateSpy.getState.and.returnValue(fullSlots);

      const result = service.canBuildFacility(FacilityId.GasCollector, 'body-1');

      expect(result.canBuild).toBe(false);
      expect(result.reason).toBe('No orbital slots available');
    });

    it('should require Rare Element Deposits for RareEarthExcavator', () => {
      const result = service.canBuildFacility(FacilityId.RareEarthExcavator, 'body-1');

      expect(result.canBuild).toBe(false);
      expect(result.reason).toBe('Requires Rare Element Deposits');
    });

    it('should allow RareEarthExcavator when body has Rare Element Deposits', () => {
      const withFeature = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], features: [BodyFeature.RareElementDeposits] }
        }
      };
      gameStateSpy.getState.and.returnValue(withFeature);

      const result = service.canBuildFacility(FacilityId.RareEarthExcavator, 'body-1');

      expect(result.canBuild).toBe(true);
    });

    it('should require Exotic Atmosphere for ExoticGasCollector', () => {
      const result = service.canBuildFacility(FacilityId.ExoticGasCollector, 'body-1');

      expect(result.canBuild).toBe(false);
      expect(result.reason).toBe('Requires Exotic Atmosphere');
    });

    it('should allow ExoticGasCollector when body has Exotic Atmosphere', () => {
      const withFeature = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], features: [BodyFeature.ExoticAtmosphere] }
        }
      };
      gameStateSpy.getState.and.returnValue(withFeature);

      const result = service.canBuildFacility(FacilityId.ExoticGasCollector, 'body-1');

      expect(result.canBuild).toBe(true);
    });

    it('should require Ice Deposits or IcyMoon for IceHarvester', () => {
      const result = service.canBuildFacility(FacilityId.IceHarvester, 'body-1');

      expect(result.canBuild).toBe(false);
      expect(result.reason).toBe('Requires Ice Deposits');
    });

    it('should allow IceHarvester on IcyMoon', () => {
      const icyMoon = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], type: BodyType.IcyMoon }
        }
      };
      gameStateSpy.getState.and.returnValue(icyMoon);

      const result = service.canBuildFacility(FacilityId.IceHarvester, 'body-1');

      expect(result.canBuild).toBe(true);
    });

    it('should allow IceHarvester when body has Ice Deposits', () => {
      const withFeature = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], features: [BodyFeature.IceDeposits] }
        }
      };
      gameStateSpy.getState.and.returnValue(withFeature);

      const result = service.canBuildFacility(FacilityId.IceHarvester, 'body-1');

      expect(result.canBuild).toBe(true);
    });

    it('should require Gas Giant for GasCollector', () => {
      const result = service.canBuildFacility(FacilityId.GasCollector, 'body-1');

      expect(result.canBuild).toBe(false);
      expect(result.reason).toBe('Requires Gas Giant');
    });

    it('should allow GasCollector on Gas Giant', () => {
      const gasGiant = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], type: BodyType.GasGiant, orbitalSlots: 3 }
        }
      };
      gameStateSpy.getState.and.returnValue(gasGiant);

      const result = service.canBuildFacility(FacilityId.GasCollector, 'body-1');

      expect(result.canBuild).toBe(true);
    });

    it('should require Terraformable Planet for Farm', () => {
      const result = service.canBuildFacility(FacilityId.Farm, 'body-1');

      expect(result.canBuild).toBe(false);
      expect(result.reason).toBe('Requires Terraformable Planet');
    });

    it('should allow Farm on Terraformable Planet', () => {
      const terraformable = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], type: BodyType.TerraformablePlanet }
        }
      };
      gameStateSpy.getState.and.returnValue(terraformable);

      const result = service.canBuildFacility(FacilityId.Farm, 'body-1');

      expect(result.canBuild).toBe(true);
    });

    it('should require Terraformable Planet for Ranch', () => {
      const result = service.canBuildFacility(FacilityId.Ranch, 'body-1');

      expect(result.canBuild).toBe(false);
      expect(result.reason).toBe('Requires Terraformable Planet');
    });

    it('should allow basic facility on surveyed terrestrial planet', () => {
      const result = service.canBuildFacility(FacilityId.Mine, 'body-1');

      expect(result.canBuild).toBe(true);
    });
  });

  describe('getAvailableFacilities', () => {
    beforeEach(() => {
      gameStateSpy.getState.and.returnValue(mockGameState);
    });

    it('should return empty array when body not found', () => {
      const result = service.getAvailableFacilities('invalid-body');

      expect(result).toEqual([]);
    });

    it('should return all facilities with build status', () => {
      const result = service.getAvailableFacilities('body-1');

      expect(result.length).toBeGreaterThan(0);
      result.forEach(item => {
        expect(item.facility).toBeDefined();
        expect(typeof item.canBuild).toBe('boolean');
      });
    });

    it('should filter out facilities with wrong slot type', () => {
      const result = service.getAvailableFacilities('body-1');

      const wrongSlotType = result.find(f => f.reason === 'Wrong slot type');
      expect(wrongSlotType).toBeUndefined();
    });

    it('should include facilities that can be built', () => {
      const result = service.getAvailableFacilities('body-1');

      const buildable = result.filter(f => f.canBuild);
      expect(buildable.length).toBeGreaterThan(0);
    });

    it('should include facilities that cannot be built with reasons', () => {
      const result = service.getAvailableFacilities('body-1');

      const unbuildable = result.filter(f => !f.canBuild);
      expect(unbuildable.length).toBeGreaterThan(0);
      unbuildable.forEach(item => {
        expect(item.reason).toBeDefined();
        expect(item.reason).not.toBe('');
      });
    });
  });

  describe('buildFacility', () => {
    beforeEach(() => {
      gameStateSpy.getState.and.returnValue(mockGameState);
      gameStateSpy.getSystemResource.and.returnValue(1000);
      gameStateSpy.spendCredits.and.returnValue(true);
      gameStateSpy.removeResourceFromSystem.and.returnValue(true);
      gameStateSpy.generateId.and.returnValue('facility-new-1');
    });

    it('should return false when body not found', () => {
      const result = service.buildFacility(FacilityId.Mine, 'invalid-body');

      expect(result).toBe(false);
    });

    it('should return false when system not found', () => {
      const invalidState = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], systemId: 'invalid-system' }
        }
      };
      gameStateSpy.getState.and.returnValue(invalidState);

      const result = service.buildFacility(FacilityId.Mine, 'body-1');

      expect(result).toBe(false);
    });

    it('should return false when facility definition not found', () => {
      const result = service.buildFacility('invalid-facility' as FacilityId, 'body-1');

      expect(result).toBe(false);
    });

    it('should return false and notify when cannot build', () => {
      const unsurveyed = {
        ...mockGameState,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], surveyed: false }
        }
      };
      gameStateSpy.getState.and.returnValue(unsurveyed);

      const result = service.buildFacility(FacilityId.Mine, 'body-1');

      expect(result).toBe(false);
      expect(gameStateSpy.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ type: 'warning', title: 'Cannot Build' })
      );
    });

    it('should return false and notify when cannot afford', () => {
      gameStateSpy.getSystemResource.and.returnValue(0);

      const result = service.buildFacility(FacilityId.Mine, 'body-1');

      expect(result).toBe(false);
      expect(gameStateSpy.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ type: 'warning', title: 'Insufficient Resources' })
      );
    });

    it('should return false when credit spending fails', () => {
      gameStateSpy.spendCredits.and.returnValue(false);

      const result = service.buildFacility(FacilityId.Mine, 'body-1');

      expect(result).toBe(false);
      expect(gameStateSpy.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ type: 'warning', title: 'Insufficient Credits' })
      );
    });

    it('should rollback credits when resource removal fails', () => {
      gameStateSpy.removeResourceFromSystem.and.returnValue(false);

      const result = service.buildFacility(FacilityId.Mine, 'body-1');

      expect(result).toBe(false);
      expect(gameStateSpy.addCredits).toHaveBeenCalled();
      expect(gameStateSpy.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({ type: 'warning', message: jasmine.stringContaining('rolled back') })
      );
    });

    it('should rollback resources when later resource removal fails', () => {
      let callCount = 0;
      gameStateSpy.removeResourceFromSystem.and.callFake(() => {
        callCount++;
        return callCount === 1;
      });

      const result = service.buildFacility(FacilityId.Mine, 'body-1');

      expect(result).toBe(false);
      expect(gameStateSpy.addResourceToSystem).toHaveBeenCalled();
      expect(gameStateSpy.addCredits).toHaveBeenCalled();
    });

    it('should create facility with correct properties', () => {
      const result = service.buildFacility(FacilityId.Mine, 'body-1');

      expect(result).toBe(true);
      expect(gameStateSpy.addFacility).toHaveBeenCalledWith(
        jasmine.objectContaining({
          id: 'facility-new-1',
          definitionId: FacilityId.Mine,
          bodyId: 'body-1',
          level: 1,
          condition: 100,
          operational: true
        })
      );
    });

    it('should update surface slots for surface facility', () => {
      const result = service.buildFacility(FacilityId.Mine, 'body-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateBody).toHaveBeenCalledWith(
        'body-1',
        jasmine.objectContaining({ usedSurfaceSlots: 1 })
      );
    });

    it('should update orbital slots for orbital facility', () => {
      const result = service.buildFacility(FacilityId.TradeOutpost, 'body-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateBody).toHaveBeenCalledWith(
        'body-1',
        jasmine.objectContaining({ usedOrbitalSlots: 1 })
      );
    });

    it('should add facility to body facilityIds', () => {
      const result = service.buildFacility(FacilityId.Mine, 'body-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateBody).toHaveBeenCalledWith(
        'body-1',
        jasmine.objectContaining({ facilityIds: ['facility-new-1'] })
      );
    });

    it('should increment facilitiesBuilt stat', () => {
      const result = service.buildFacility(FacilityId.Mine, 'body-1');

      expect(result).toBe(true);
      expect(gameStateSpy.incrementStat).toHaveBeenCalledWith('facilitiesBuilt');
    });

    it('should update trade station tier when building TradeOutpost', () => {
      const result = service.buildFacility(FacilityId.TradeOutpost, 'body-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateSystem).toHaveBeenCalledWith(
        'system-1',
        jasmine.objectContaining({ hasTradeStation: true, tradeStationTier: 1 })
      );
    });

    it('should update trade station tier when building TradeStation', () => {
      const result = service.buildFacility(FacilityId.TradeStation, 'body-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateSystem).toHaveBeenCalledWith(
        'system-1',
        jasmine.objectContaining({ hasTradeStation: true, tradeStationTier: 2 })
      );
    });

    it('should update trade station tier when building TradeHub', () => {
      const result = service.buildFacility(FacilityId.TradeHub, 'body-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateSystem).toHaveBeenCalledWith(
        'system-1',
        jasmine.objectContaining({ hasTradeStation: true, tradeStationTier: 3 })
      );
    });

    it('should not downgrade trade station tier when building lower tier', () => {
      const existingTrade = {
        ...mockGameState,
        systems: {
          'system-1': { ...mockGameState.systems['system-1'], hasTradeStation: true, tradeStationTier: 3 }
        }
      };
      gameStateSpy.getState.and.returnValue(existingTrade);

      const result = service.buildFacility(FacilityId.TradeOutpost, 'body-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateSystem).not.toHaveBeenCalledWith(
        'system-1',
        jasmine.objectContaining({ tradeStationTier: 1 })
      );
    });

    it('should increase resource capacity when building trade facility', () => {
      const result = service.buildFacility(FacilityId.TradeOutpost, 'body-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateSystem).toHaveBeenCalledWith(
        'system-1',
        jasmine.objectContaining({ resources: jasmine.any(Array) })
      );
    });

    it('should send success notification', () => {
      const result = service.buildFacility(FacilityId.Mine, 'body-1');

      expect(result).toBe(true);
      expect(gameStateSpy.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({
          type: 'success',
          title: 'Construction Complete',
          systemId: 'system-1'
        })
      );
    });

    it('should spend correct amount of credits', () => {
      service.buildFacility(FacilityId.Mine, 'body-1');

      expect(gameStateSpy.spendCredits).toHaveBeenCalledWith(jasmine.any(Number));
      const creditAmount = gameStateSpy.spendCredits.calls.mostRecent().args[0];
      expect(creditAmount).toBeGreaterThan(0);
    });

    it('should remove correct resources from system', () => {
      service.buildFacility(FacilityId.Mine, 'body-1');

      expect(gameStateSpy.removeResourceFromSystem).toHaveBeenCalledTimes(2);
      expect(gameStateSpy.removeResourceFromSystem).toHaveBeenCalledWith(
        'system-1',
        ResourceId.Steel,
        jasmine.any(Number)
      );
      expect(gameStateSpy.removeResourceFromSystem).toHaveBeenCalledWith(
        'system-1',
        ResourceId.GlassCeramics,
        jasmine.any(Number)
      );
    });
  });

  describe('demolishFacility', () => {
    const mockFacility = {
      id: 'facility-1',
      definitionId: FacilityId.Mine,
      bodyId: 'body-1',
      level: 1,
      condition: 100,
      operational: true
    };

    beforeEach(() => {
      const stateWithFacility = {
        ...mockGameState,
        facilities: { 'facility-1': mockFacility },
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], facilityIds: ['facility-1'], usedSurfaceSlots: 1 }
        }
      };
      gameStateSpy.getState.and.returnValue(stateWithFacility);
    });

    it('should return false when facility not found', () => {
      const result = service.demolishFacility('invalid-facility');

      expect(result).toBe(false);
    });

    it('should return false when body not found', () => {
      const invalidState = {
        ...mockGameState,
        facilities: { 'facility-1': mockFacility },
        bodies: {}
      };
      gameStateSpy.getState.and.returnValue(invalidState);

      const result = service.demolishFacility('facility-1');

      expect(result).toBe(false);
    });

    it('should remove facility from body facilityIds', () => {
      const result = service.demolishFacility('facility-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateBody).toHaveBeenCalledWith(
        'body-1',
        jasmine.objectContaining({ facilityIds: [] })
      );
    });

    it('should decrease surface slots for surface facility', () => {
      const result = service.demolishFacility('facility-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateBody).toHaveBeenCalledWith(
        'body-1',
        jasmine.objectContaining({ usedSurfaceSlots: 0 })
      );
    });

    it('should decrease orbital slots for orbital facility', () => {
      const orbitalFacility = {
        ...mockFacility,
        definitionId: FacilityId.TradeOutpost
      };
      const stateWithOrbital = {
        ...mockGameState,
        facilities: { 'facility-1': orbitalFacility },
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], facilityIds: ['facility-1'], usedOrbitalSlots: 1 }
        }
      };
      gameStateSpy.getState.and.returnValue(stateWithOrbital);

      const result = service.demolishFacility('facility-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateBody).toHaveBeenCalledWith(
        'body-1',
        jasmine.objectContaining({ usedOrbitalSlots: 0 })
      );
    });

    it('should remove facility from game state', () => {
      const result = service.demolishFacility('facility-1');

      expect(result).toBe(true);
      expect(gameStateSpy.removeFacility).toHaveBeenCalledWith('facility-1');
    });

    it('should send info notification', () => {
      const result = service.demolishFacility('facility-1');

      expect(result).toBe(true);
      expect(gameStateSpy.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({
          type: 'info',
          title: 'Facility Demolished'
        })
      );
    });

    it('should recalculate trade station tier when demolishing trade facility', () => {
      const tradeFacility = {
        ...mockFacility,
        definitionId: FacilityId.TradeOutpost
      };
      const stateWithTrade = {
        ...mockGameState,
        facilities: { 'facility-1': tradeFacility },
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], facilityIds: ['facility-1'], usedOrbitalSlots: 1 }
        },
        systems: {
          'system-1': { ...mockGameState.systems['system-1'], hasTradeStation: true, tradeStationTier: 1 }
        }
      };

      // Return different states: initial state, then state after updateBody (facilityIds = [])
      const stateAfterUpdate = {
        ...stateWithTrade,
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], facilityIds: [], usedOrbitalSlots: 0 }
        }
      };

      gameStateSpy.getState.and.returnValues(stateWithTrade, stateAfterUpdate);

      const result = service.demolishFacility('facility-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateSystem).toHaveBeenCalledWith(
        'system-1',
        jasmine.objectContaining({ hasTradeStation: false, tradeStationTier: 0 })
      );
    });

    it('should not recalculate trade station tier when demolishing non-trade facility', () => {
      const result = service.demolishFacility('facility-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateSystem).not.toHaveBeenCalled();
    });

    it('should correctly recalculate when multiple trade facilities exist', () => {
      const tradeFacility1 = { id: 'fac-1', definitionId: FacilityId.TradeOutpost, bodyId: 'body-1', level: 1, condition: 100, operational: true };
      const tradeFacility2 = { id: 'fac-2', definitionId: FacilityId.TradeHub, bodyId: 'body-1', level: 1, condition: 100, operational: true };
      const stateWithMultipleTrade = {
        ...mockGameState,
        facilities: { 'fac-1': tradeFacility1, 'fac-2': tradeFacility2 },
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], facilityIds: ['fac-1', 'fac-2'], usedOrbitalSlots: 2 }
        },
        systems: {
          'system-1': { ...mockGameState.systems['system-1'], hasTradeStation: true, tradeStationTier: 3 }
        }
      };
      gameStateSpy.getState.and.returnValue(stateWithMultipleTrade);

      const result = service.demolishFacility('fac-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateSystem).toHaveBeenCalledWith(
        'system-1',
        jasmine.objectContaining({ hasTradeStation: true, tradeStationTier: 3 })
      );
    });

    it('should handle multiple facilities on same body', () => {
      const facility2 = { id: 'facility-2', definitionId: FacilityId.Smelter, bodyId: 'body-1', level: 1, condition: 100, operational: true };
      const stateWithMultiple = {
        ...mockGameState,
        facilities: { 'facility-1': mockFacility, 'facility-2': facility2 },
        bodies: {
          'body-1': { ...mockGameState.bodies['body-1'], facilityIds: ['facility-1', 'facility-2'], usedSurfaceSlots: 2 }
        }
      };
      gameStateSpy.getState.and.returnValue(stateWithMultiple);

      const result = service.demolishFacility('facility-1');

      expect(result).toBe(true);
      expect(gameStateSpy.updateBody).toHaveBeenCalledWith(
        'body-1',
        jasmine.objectContaining({ facilityIds: ['facility-2'], usedSurfaceSlots: 1 })
      );
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(() => {
      gameStateSpy.getState.and.returnValue(mockGameState);
    });

    it('should throw error when state is null', () => {
      gameStateSpy.getState.and.returnValue(null as any);

      expect(() => service.getConstructionCost(FacilityId.Mine, 'body-1')).toThrow();
    });

    it('should handle undefined resources array', () => {
      const noResources = {
        ...mockGameState,
        systems: {
          'system-1': { ...mockGameState.systems['system-1'], resources: undefined as any }
        }
      };
      gameStateSpy.getState.and.returnValue(noResources);
      gameStateSpy.getSystemResource.and.returnValue(1000);
      gameStateSpy.spendCredits.and.returnValue(true);
      gameStateSpy.removeResourceFromSystem.and.returnValue(true);
      gameStateSpy.generateId.and.returnValue('facility-new-1');

      const result = service.buildFacility(FacilityId.TradeOutpost, 'body-1');

      expect(result).toBe(true);
    });

    it('should handle empty resources array', () => {
      const emptyResources = {
        ...mockGameState,
        systems: {
          'system-1': { ...mockGameState.systems['system-1'], resources: [] }
        }
      };
      gameStateSpy.getState.and.returnValue(emptyResources);
      gameStateSpy.getSystemResource.and.returnValue(1000);
      gameStateSpy.spendCredits.and.returnValue(true);
      gameStateSpy.removeResourceFromSystem.and.returnValue(true);
      gameStateSpy.generateId.and.returnValue('facility-new-1');

      const result = service.buildFacility(FacilityId.TradeOutpost, 'body-1');

      expect(result).toBe(true);
    });

    it('should handle very high distance multipliers', () => {
      const farAway = {
        ...mockGameState,
        systems: {
          'system-1': { ...mockGameState.systems['system-1'], coordinates: { x: 1000, y: 1000 } }
        }
      };
      gameStateSpy.getState.and.returnValue(farAway);

      const result = service.getConstructionCost(FacilityId.Mine, 'body-1');

      expect(result).not.toBeNull();
      expect(result!.multiplier).toBeGreaterThan(100);
    });

    it('should handle very high facility count multipliers', () => {
      const facilities: any = {};
      for (let i = 0; i < 100; i++) {
        facilities[`fac-${i}`] = {
          id: `fac-${i}`,
          definitionId: FacilityId.Mine,
          bodyId: 'body-1',
          level: 1,
          condition: 100,
          operational: true
        };
      }
      const manyFacilities = {
        ...mockGameState,
        facilities
      };
      gameStateSpy.getState.and.returnValue(manyFacilities);

      const result = service.getConstructionCost(FacilityId.Mine, 'body-1');

      expect(result).not.toBeNull();
      expect(result!.multiplier).toBeGreaterThan(10);
    });

    it('should handle missing resource definition', () => {
      gameStateSpy.getSystemResource.and.returnValue(1000);

      const result = service.getConstructionCost(FacilityId.Mine, 'body-1');

      expect(result).not.toBeNull();
      result!.resources.forEach(r => {
        expect(r.name).toBeDefined();
        expect(r.name.length).toBeGreaterThan(0);
      });
    });

    it('should handle zero coordinates', () => {
      const atOrigin = {
        ...mockGameState,
        systems: {
          'system-1': { ...mockGameState.systems['system-1'], coordinates: { x: 0, y: 0 } }
        }
      };
      gameStateSpy.getState.and.returnValue(atOrigin);

      const result = service.getConstructionCost(FacilityId.Mine, 'body-1');

      expect(result).not.toBeNull();
      expect(result!.multiplier).toBeGreaterThan(0);
    });
  });
});
