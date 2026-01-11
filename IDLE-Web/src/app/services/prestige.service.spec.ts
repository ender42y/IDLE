import { TestBed } from '@angular/core/testing';
import { PrestigeService } from './prestige.service';
import { GameStateService } from './game-state.service';
import { HomeSystemService } from './home-system.service';
import { INITIAL_PRESTIGE_STATE } from '../models/prestige.model';
import { SystemRarity, SystemState } from '../models/star-system.model';
import { ResourceId } from '../models/resource.model';

describe('PrestigeService', () => {
  let service: PrestigeService;
  let gameState: jasmine.SpyObj<GameStateService>;
  let homeSystem: jasmine.SpyObj<HomeSystemService>;

  beforeEach(() => {
    const gameStateSpy = jasmine.createSpyObj('GameStateService', [
      'getState',
      'setPrestigeState',
      'addNotification',
      'removeFacility',
      'removeShip',
      'resetGameStateForPrestige'
    ]);

    const homeSystemSpy = jasmine.createSpyObj('HomeSystemService', [
      'initializeHomeSystem'
    ]);

    // Add _gameState signal property for internal state updates
    (gameStateSpy as any)._gameState = jasmine.createSpyObj('Signal', ['update']);

    TestBed.configureTestingModule({
      providers: [
        PrestigeService,
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: HomeSystemService, useValue: homeSystemSpy }
      ]
    });

    service = TestBed.inject(PrestigeService);
    gameState = TestBed.inject(GameStateService) as jasmine.SpyObj<GameStateService>;
    homeSystem = TestBed.inject(HomeSystemService) as jasmine.SpyObj<HomeSystemService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getPrestigeState', () => {
    it('should return prestige state', () => {
      gameState.getState.and.returnValue({
        prestige: INITIAL_PRESTIGE_STATE
      } as any);

      const prestige = service.getPrestigeState();

      expect(prestige).toEqual(INITIAL_PRESTIGE_STATE);
    });

    it('should return initial state if missing', () => {
      gameState.getState.and.returnValue({} as any);

      const prestige = service.getPrestigeState();

      expect(prestige).toEqual(INITIAL_PRESTIGE_STATE);
    });
  });

  describe('getPrestigeBonuses', () => {
    it('should calculate bonuses from tokens', () => {
      gameState.getState.and.returnValue({
        prestige: {
          totalTokens: 10,
          prestigeCount: 1,
          highestScore: 10000,
          lastPrestigeAt: Date.now()
        }
      } as any);

      const bonuses = service.getPrestigeBonuses();

      expect(bonuses.productionBonus).toBeGreaterThan(0);
      expect(bonuses.shipSpeedBonus).toBeGreaterThan(0);
      expect(bonuses.researchSpeedBonus).toBeGreaterThan(0);
    });

    it('should return zero bonuses with no tokens', () => {
      gameState.getState.and.returnValue({
        prestige: INITIAL_PRESTIGE_STATE
      } as any);

      const bonuses = service.getPrestigeBonuses();

      expect(bonuses.productionBonus).toBe(0);
      expect(bonuses.shipSpeedBonus).toBe(0);
      expect(bonuses.researchSpeedBonus).toBe(0);
    });
  });

  describe('calculatePrestigeScore', () => {
    it('should calculate score from game state', () => {
      gameState.getState.and.returnValue({
        credits: 100000,
        systems: {
          'sys-1': {
            colonized: true,
            totalPopulation: 5000,
            resources: [
              { resourceId: ResourceId.Steel, amount: 1000, capacity: 10000 },
              { resourceId: ResourceId.Fuel, amount: 500, capacity: 10000 }
            ]
          },
          'sys-2': {
            colonized: false,
            totalPopulation: 0,
            resources: []
          }
        },
        facilities: {
          'fac-1': {},
          'fac-2': {},
          'fac-3': {}
        },
        ships: {
          'ship-1': {},
          'ship-2': {}
        }
      } as any);

      const breakdown = service.calculatePrestigeScore();

      expect(breakdown.creditsBalance).toBe(100000);
      expect(breakdown.totalPopulation).toBe(5000);
      expect(breakdown.systemsColonized).toBe(1);
      expect(breakdown.facilitiesBuilt).toBe(3);
      expect(breakdown.shipsOwned).toBe(2);
      expect(breakdown.storageTonnage).toBe(1500); // Steel + Fuel, excluding credits
      expect(breakdown.totalScore).toBeGreaterThan(0);
    });

    it('should exclude credits from storage tonnage', () => {
      gameState.getState.and.returnValue({
        credits: 50000,
        systems: {
          'sys-1': {
            colonized: true,
            totalPopulation: 1000,
            resources: [
              { resourceId: ResourceId.Credits, amount: 10000, capacity: 100000 },
              { resourceId: ResourceId.Steel, amount: 500, capacity: 10000 }
            ]
          }
        },
        facilities: {},
        ships: {}
      } as any);

      const breakdown = service.calculatePrestigeScore();

      // Should only count Steel, not Credits
      expect(breakdown.storageTonnage).toBe(500);
    });

    it('should calculate component scores', () => {
      gameState.getState.and.returnValue({
        credits: 100000,
        systems: {
          'sys-1': {
            colonized: true,
            totalPopulation: 10000,
            resources: [{ resourceId: ResourceId.Steel, amount: 1000, capacity: 10000 }]
          }
        },
        facilities: { 'fac-1': {}, 'fac-2': {} },
        ships: { 'ship-1': {} }
      } as any);

      const breakdown = service.calculatePrestigeScore();

      expect(breakdown.storageScore).toBeGreaterThan(0);
      expect(breakdown.creditsScore).toBeGreaterThan(0);
      expect(breakdown.populationScore).toBeGreaterThan(0);
      expect(breakdown.bonusScore).toBeGreaterThan(0);
    });
  });

  describe('getTokensFromCurrentScore', () => {
    it('should calculate tokens from score', () => {
      gameState.getState.and.returnValue({
        credits: 2500000,
        systems: {
          'sys-1': { colonized: true, totalPopulation: 30000, resources: [] },
          'sys-2': { colonized: true, totalPopulation: 25000, resources: [] },
          'sys-3': { colonized: true, totalPopulation: 20000, resources: [] },
          'sys-4': { colonized: true, totalPopulation: 15000, resources: [] },
          'sys-5': { colonized: true, totalPopulation: 10000, resources: [] }
        },
        facilities: Array(120).fill({}).reduce((acc, _, i) => ({ ...acc, [`fac-${i}`]: {} }), {}),
        ships: Array(20).fill({}).reduce((acc, _, i) => ({ ...acc, [`ship-${i}`]: {} }), {})
      } as any);

      const tokens = service.getTokensFromCurrentScore();

      expect(tokens).toBeGreaterThan(0);
    });

    it('should return 0 tokens for low score', () => {
      gameState.getState.and.returnValue({
        credits: 1000,
        systems: {},
        facilities: {},
        ships: {}
      } as any);

      const tokens = service.getTokensFromCurrentScore();

      expect(tokens).toBe(0);
    });
  });

  describe('canPrestige', () => {
    it('should return true when tokens can be earned', () => {
      gameState.getState.and.returnValue({
        credits: 2500000,
        systems: {
          'sys-1': { colonized: true, totalPopulation: 30000, resources: [] },
          'sys-2': { colonized: true, totalPopulation: 25000, resources: [] },
          'sys-3': { colonized: true, totalPopulation: 20000, resources: [] },
          'sys-4': { colonized: true, totalPopulation: 15000, resources: [] },
          'sys-5': { colonized: true, totalPopulation: 10000, resources: [] }
        },
        facilities: Array(120).fill({}).reduce((acc, _, i) => ({ ...acc, [`fac-${i}`]: {} }), {}),
        ships: Array(20).fill({}).reduce((acc, _, i) => ({ ...acc, [`ship-${i}`]: {} }), {})
      } as any);

      const canPrestige = service.canPrestige();

      expect(canPrestige).toBe(true);
    });

    it('should return false when no tokens can be earned', () => {
      gameState.getState.and.returnValue({
        credits: 1000,
        systems: {},
        facilities: {},
        ships: {}
      } as any);

      const canPrestige = service.canPrestige();

      expect(canPrestige).toBe(false);
    });
  });

  describe('performPrestige', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        credits: 2500000,
        systems: {
          'sys-1': { colonized: true, totalPopulation: 30000, resources: [] },
          'sys-2': { colonized: true, totalPopulation: 25000, resources: [] },
          'sys-3': { colonized: true, totalPopulation: 20000, resources: [] },
          'sys-4': { colonized: true, totalPopulation: 15000, resources: [] },
          'sys-5': { colonized: true, totalPopulation: 10000, resources: [] }
        },
        bodies: { 'body-1': {} },
        facilities: Array(120).fill({}).reduce((acc, _, i) => ({ ...acc, [`fac-${i}`]: {} }), {}),
        ships: Array(20).fill({}).reduce((acc, _, i) => ({ ...acc, [`ship-${i}`]: {} }), {}),
        prestige: {
          totalTokens: 5,
          prestigeCount: 1,
          highestScore: 50000,
          lastPrestigeAt: Date.now() - 100000
        }
      } as any);
    });

    it('should perform prestige successfully', () => {
      const result = service.performPrestige();

      expect(result).toBe(true);
      expect(gameState.setPrestigeState).toHaveBeenCalled();
      expect(homeSystem.initializeHomeSystem).toHaveBeenCalled();
    });

    it('should increment prestige count', () => {
      service.performPrestige();

      const prestigeCall = gameState.setPrestigeState.calls.mostRecent();
      const newState = prestigeCall.args[0];

      expect(newState.prestigeCount).toBe(2);
    });

    it('should add earned tokens to total', () => {
      service.performPrestige();

      const prestigeCall = gameState.setPrestigeState.calls.mostRecent();
      const newState = prestigeCall.args[0];

      expect(newState.totalTokens).toBeGreaterThan(5);
    });

    it('should update highest score', () => {
      gameState.getState.and.returnValue({
        credits: 5000000,
        systems: {
          'sys-1': { colonized: true, totalPopulation: 50000, resources: [] },
          'sys-2': { colonized: true, totalPopulation: 40000, resources: [] },
          'sys-3': { colonized: true, totalPopulation: 30000, resources: [] },
          'sys-4': { colonized: true, totalPopulation: 20000, resources: [] },
          'sys-5': { colonized: true, totalPopulation: 10000, resources: [] }
        },
        facilities: Array(200).fill({}).reduce((acc, _, i) => ({ ...acc, [`fac-${i}`]: {} }), {}),
        ships: Array(30).fill({}).reduce((acc, _, i) => ({ ...acc, [`ship-${i}`]: {} }), {}),
        bodies: {},
        prestige: {
          totalTokens: 5,
          prestigeCount: 1,
          highestScore: 50000,
          lastPrestigeAt: Date.now()
        }
      } as any);

      service.performPrestige();

      const prestigeCall = gameState.setPrestigeState.calls.mostRecent();
      const newState = prestigeCall.args[0];

      expect(newState.highestScore).toBeGreaterThan(50000);
    });

    it('should reset game state', () => {
      service.performPrestige();

      expect(gameState.resetGameStateForPrestige).toHaveBeenCalled();
      expect(homeSystem.initializeHomeSystem).toHaveBeenCalled();
    });

    it('should fail if cannot prestige', () => {
      gameState.getState.and.returnValue({
        credits: 100,
        systems: {},
        facilities: {},
        ships: {},
        bodies: {},
        prestige: INITIAL_PRESTIGE_STATE
      } as any);

      const result = service.performPrestige();

      expect(result).toBe(false);
      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({
          type: 'warning',
          title: 'Cannot Prestige'
        })
      );
    });

    it('should send success notification', () => {
      service.performPrestige();

      expect(gameState.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({
          type: 'success',
          title: 'Prestige Complete!'
        })
      );
    });
  });

  describe('Modifier Methods', () => {
    beforeEach(() => {
      gameState.getState.and.returnValue({
        prestige: {
          totalTokens: 10,
          prestigeCount: 2,
          highestScore: 100000,
          lastPrestigeAt: Date.now()
        }
      } as any);
    });

    it('should calculate production modifier', () => {
      const modifier = service.getProductionModifier();

      expect(modifier).toBeGreaterThanOrEqual(1.0);
    });

    it('should calculate ship speed modifier', () => {
      const modifier = service.getShipSpeedModifier();

      expect(modifier).toBeGreaterThanOrEqual(1.0);
    });

    it('should calculate research speed modifier', () => {
      const modifier = service.getResearchSpeedModifier();

      expect(modifier).toBeGreaterThanOrEqual(1.0);
    });

    it('should return 1.0 modifiers with no tokens', () => {
      gameState.getState.and.returnValue({
        prestige: INITIAL_PRESTIGE_STATE
      } as any);

      expect(service.getProductionModifier()).toBe(1.0);
      expect(service.getShipSpeedModifier()).toBe(1.0);
      expect(service.getResearchSpeedModifier()).toBe(1.0);
    });
  });
});
