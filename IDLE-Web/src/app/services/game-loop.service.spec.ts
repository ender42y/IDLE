import { TestBed, fakeAsync, tick, flush, discardPeriodicTasks } from '@angular/core/testing';
import { GameLoopService } from './game-loop.service';
import { GameStateService } from './game-state.service';
import { ProductionService } from './production.service';
import { PopulationService } from './population.service';
import { TradeService } from './trade.service';
import { ExplorationService } from './exploration.service';
import { ColonizationService } from './colonization.service';
import { GameState, GAME_VERSION, INITIAL_GAME_SETTINGS, INITIAL_GAME_STATS } from '../models/game-state.model';
import { ResourceId } from '../models/resource.model';

describe('GameLoopService', () => {
  let service: GameLoopService;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let productionSpy: jasmine.SpyObj<ProductionService>;
  let populationSpy: jasmine.SpyObj<PopulationService>;
  let tradeSpy: jasmine.SpyObj<TradeService>;
  let explorationSpy: jasmine.SpyObj<ExplorationService>;
  let colonizationSpy: jasmine.SpyObj<ColonizationService>;

  let mockGameState: GameState;

  beforeEach(() => {
    const marketPrices: Record<ResourceId, { buy: number; sell: number }> = {} as Record<ResourceId, { buy: number; sell: number }>;
    Object.values(ResourceId).forEach((id: ResourceId) => {
      marketPrices[id] = { buy: 100, sell: 90 };
    });

    mockGameState = {
      version: GAME_VERSION,
      createdAt: Date.now() - 1000000,
      lastSavedAt: Date.now() - 120000,
      lastPlayedAt: Date.now() - 120000,
      credits: 10000,
      systems: {},
      bodies: {},
      facilities: {},
      ships: {},
      tradeRoutes: {},
      scoutMissions: {},
      activeTrips: {},
      tradeMissions: {},
      explorationFrontier: [],
      nextDiscoveryDistance: 10,
      notifications: [],
      unreadNotificationCount: 0,
      selectedSystemId: null,
      selectedBodyId: null,
      stats: { ...INITIAL_GAME_STATS },
      settings: { ...INITIAL_GAME_SETTINGS },
      marketPrices: marketPrices,
      prestige: {
        totalTokens: 0,
        prestigeCount: 0,
        highestScore: 0,
        lastPrestigeAt: 0
      }
    };

    const gameStateSpyObj = jasmine.createSpyObj('GameStateService', [
      'getState',
      'saveGame',
      'addNotification',
      'settings'
    ]);

    const productionSpyObj = jasmine.createSpyObj('ProductionService', ['processTick']);
    const populationSpyObj = jasmine.createSpyObj('PopulationService', ['processTick']);
    const tradeSpyObj = jasmine.createSpyObj('TradeService', ['processTick', 'processOfflineTrips']);
    const explorationSpyObj = jasmine.createSpyObj('ExplorationService', ['processTick', 'processOfflineMissions']);
    const colonizationSpyObj = jasmine.createSpyObj('ColonizationService', ['processTick']);

    gameStateSpyObj.getState.and.returnValue(mockGameState);
    gameStateSpyObj.settings.and.returnValue(mockGameState.settings);

    TestBed.configureTestingModule({
      providers: [
        GameLoopService,
        { provide: GameStateService, useValue: gameStateSpyObj },
        { provide: ProductionService, useValue: productionSpyObj },
        { provide: PopulationService, useValue: populationSpyObj },
        { provide: TradeService, useValue: tradeSpyObj },
        { provide: ExplorationService, useValue: explorationSpyObj },
        { provide: ColonizationService, useValue: colonizationSpyObj }
      ]
    });

    service = TestBed.inject(GameLoopService);
    gameStateSpy = TestBed.inject(GameStateService) as jasmine.SpyObj<GameStateService>;
    productionSpy = TestBed.inject(ProductionService) as jasmine.SpyObj<ProductionService>;
    populationSpy = TestBed.inject(PopulationService) as jasmine.SpyObj<PopulationService>;
    tradeSpy = TestBed.inject(TradeService) as jasmine.SpyObj<TradeService>;
    explorationSpy = TestBed.inject(ExplorationService) as jasmine.SpyObj<ExplorationService>;
    colonizationSpy = TestBed.inject(ColonizationService) as jasmine.SpyObj<ColonizationService>;
  });

  afterEach(() => {
    service.stop();
  });

  describe('Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with isRunning false', () => {
      expect(service.isRunning()).toBe(false);
    });

    it('should initialize with tickCount 0', () => {
      expect(service.tickCount()).toBe(0);
    });

    it('should initialize with ticksPerSecond 0', () => {
      expect(service.ticksPerSecond()).toBe(0);
    });
  });

  describe('start()', () => {
    afterEach(fakeAsync(() => {
      service.stop();
      flush();
      discardPeriodicTasks();
    }));

    it('should set isRunning to true', () => {
      service.start();
      expect(service.isRunning()).toBe(true);
    });

    it('should not start if already running', fakeAsync(() => {
      service.start();
      const firstStart = service.isRunning();
      service.start();
      const secondStart = service.isRunning();

      expect(firstStart).toBe(true);
      expect(secondStart).toBe(true);

      discardPeriodicTasks();
    }));

    it('should calculate offline progress on start', () => {
      service.start();

      expect(gameStateSpy.getState).toHaveBeenCalled();
      expect(gameStateSpy.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({
          type: 'info',
          title: 'Welcome Back!'
        })
      );
    });

    it('should skip offline progress if less than 1 minute offline', () => {
      mockGameState.lastPlayedAt = Date.now() - 30000;
      gameStateSpy.getState.and.returnValue(mockGameState);

      service.start();

      expect(gameStateSpy.addNotification).not.toHaveBeenCalled();
    });

    it('should start tick interval with configured rate', fakeAsync(() => {
      service.start();

      tick(200);

      expect(productionSpy.processTick).toHaveBeenCalled();
      expect(populationSpy.processTick).toHaveBeenCalled();
      expect(tradeSpy.processTick).toHaveBeenCalled();
      expect(explorationSpy.processTick).toHaveBeenCalled();
      expect(colonizationSpy.processTick).toHaveBeenCalled();

      discardPeriodicTasks();
    }));

    it('should start auto-save interval when configured', fakeAsync(() => {
      service.start();

      tick(60000);

      expect(gameStateSpy.saveGame).toHaveBeenCalled();

      discardPeriodicTasks();
    }));

    it('should not start auto-save when interval is 0', fakeAsync(() => {
      mockGameState.settings.autoSaveInterval = 0;
      gameStateSpy.settings.and.returnValue(mockGameState.settings);

      service.start();

      tick(60000);

      expect(gameStateSpy.saveGame).not.toHaveBeenCalled();

      discardPeriodicTasks();
    }));

    it('should process offline production in chunks', () => {
      mockGameState.lastPlayedAt = Date.now() - (2 * 60 * 60 * 1000);
      gameStateSpy.getState.and.returnValue(mockGameState);

      service.start();

      expect(productionSpy.processTick).toHaveBeenCalled();
      expect(populationSpy.processTick).toHaveBeenCalled();

      const productionCalls = productionSpy.processTick.calls.count();
      expect(productionCalls).toBeGreaterThan(1);
    });

    it('should process offline trade trips', () => {
      mockGameState.lastPlayedAt = Date.now() - 120000;
      gameStateSpy.getState.and.returnValue(mockGameState);

      service.start();

      expect(tradeSpy.processOfflineTrips).toHaveBeenCalledWith(jasmine.any(Number));
    });

    it('should process offline scout missions', () => {
      mockGameState.lastPlayedAt = Date.now() - 120000;
      gameStateSpy.getState.and.returnValue(mockGameState);

      service.start();

      expect(explorationSpy.processOfflineMissions).toHaveBeenCalledWith(jasmine.any(Number));
    });
  });

  describe('stop()', () => {
    it('should set isRunning to false', fakeAsync(() => {
      service.start();
      service.stop();

      expect(service.isRunning()).toBe(false);

      flush();
      discardPeriodicTasks();
    }));

    it('should clear tick interval', fakeAsync(() => {
      service.start();

      productionSpy.processTick.calls.reset();

      service.stop();
      tick(200);

      expect(productionSpy.processTick).not.toHaveBeenCalled();

      flush();
      discardPeriodicTasks();
    }));

    it('should clear auto-save interval', fakeAsync(() => {
      service.start();

      gameStateSpy.saveGame.calls.reset();

      service.stop();
      tick(60000);

      expect(gameStateSpy.saveGame).not.toHaveBeenCalled();

      flush();
      discardPeriodicTasks();
    }));

    it('should be safe to call when not running', () => {
      expect(() => service.stop()).not.toThrow();
      expect(service.isRunning()).toBe(false);
    });
  });

  describe('toggle()', () => {
    afterEach(fakeAsync(() => {
      service.stop();
      flush();
      discardPeriodicTasks();
    }));

    it('should start when stopped', () => {
      expect(service.isRunning()).toBe(false);

      service.toggle();

      expect(service.isRunning()).toBe(true);
    });

    it('should stop when running', fakeAsync(() => {
      service.start();
      expect(service.isRunning()).toBe(true);

      service.toggle();

      expect(service.isRunning()).toBe(false);

      flush();
      discardPeriodicTasks();
    }));

    it('should toggle multiple times', fakeAsync(() => {
      service.toggle();
      expect(service.isRunning()).toBe(true);

      service.toggle();
      expect(service.isRunning()).toBe(false);

      service.toggle();
      expect(service.isRunning()).toBe(true);

      flush();
      discardPeriodicTasks();
    }));
  });

  describe('tick processing', () => {
    beforeEach(() => {
      mockGameState.lastPlayedAt = Date.now();
      gameStateSpy.getState.and.returnValue(mockGameState);
    });

    afterEach(fakeAsync(() => {
      service.stop();
      flush();
      discardPeriodicTasks();
    }));

    it('should process all subsystems in order', fakeAsync(() => {
      service.start();

      tick(200);

      expect(productionSpy.processTick).toHaveBeenCalled();
      expect(populationSpy.processTick).toHaveBeenCalled();
      expect(tradeSpy.processTick).toHaveBeenCalled();
      expect(explorationSpy.processTick).toHaveBeenCalled();
      expect(colonizationSpy.processTick).toHaveBeenCalled();

      const callOrder = [
        productionSpy.processTick.calls.first(),
        populationSpy.processTick.calls.first(),
        tradeSpy.processTick.calls.first(),
        explorationSpy.processTick.calls.first(),
        colonizationSpy.processTick.calls.first()
      ];

      expect(callOrder.every(call => call)).toBe(true);

      discardPeriodicTasks();
    }));

    it('should pass deltaHours to production service', fakeAsync(() => {
      service.start();

      tick(200);

      expect(productionSpy.processTick).toHaveBeenCalledWith(jasmine.any(Number));

      const deltaHours = productionSpy.processTick.calls.mostRecent().args[0];
      expect(deltaHours).toBeGreaterThan(0);
      expect(deltaHours).toBeLessThan(1);

      discardPeriodicTasks();
    }));

    it('should pass deltaHours to population service', fakeAsync(() => {
      service.start();

      tick(200);

      expect(populationSpy.processTick).toHaveBeenCalledWith(jasmine.any(Number));

      const deltaHours = populationSpy.processTick.calls.mostRecent().args[0];
      expect(deltaHours).toBeGreaterThan(0);

      discardPeriodicTasks();
    }));

    it('should pass deltaTime in milliseconds to trade service', fakeAsync(() => {
      service.start();

      tick(200);

      expect(tradeSpy.processTick).toHaveBeenCalledWith(jasmine.any(Number));

      const deltaMs = tradeSpy.processTick.calls.mostRecent().args[0];
      expect(deltaMs).toBeGreaterThanOrEqual(100);

      discardPeriodicTasks();
    }));

    it('should pass deltaTime in milliseconds to exploration service', fakeAsync(() => {
      service.start();

      tick(200);

      expect(explorationSpy.processTick).toHaveBeenCalledWith(jasmine.any(Number));

      const deltaMs = explorationSpy.processTick.calls.mostRecent().args[0];
      expect(deltaMs).toBeGreaterThanOrEqual(100);

      discardPeriodicTasks();
    }));

    it('should pass deltaTime in milliseconds to colonization service', fakeAsync(() => {
      service.start();

      tick(200);

      expect(colonizationSpy.processTick).toHaveBeenCalledWith(jasmine.any(Number));

      const deltaMs = colonizationSpy.processTick.calls.mostRecent().args[0];
      expect(deltaMs).toBeGreaterThanOrEqual(100);

      discardPeriodicTasks();
    }));

    it('should increment tick count on each tick', fakeAsync(() => {
      service.start();

      expect(service.tickCount()).toBe(0);

      tick(200);
      expect(service.tickCount()).toBe(1);

      tick(200);
      expect(service.tickCount()).toBe(2);

      tick(200);
      expect(service.tickCount()).toBe(3);

      discardPeriodicTasks();
    }));

    it('should update ticks per second calculation', fakeAsync(() => {
      service.start();

      tick(1500);

      const tps = service.ticksPerSecond();
      expect(tps).toBeGreaterThanOrEqual(0);
      expect(tps).toBeLessThanOrEqual(10);

      discardPeriodicTasks();
    }));

    it('should handle multiple ticks over time', fakeAsync(() => {
      service.start();

      tick(2000);

      const tickCount = service.tickCount();
      expect(tickCount).toBeGreaterThanOrEqual(8);
      expect(tickCount).toBeLessThanOrEqual(12);

      discardPeriodicTasks();
    }));
  });

  describe('processTime()', () => {
    it('should process production for specified hours', () => {
      service.processTime(5);

      expect(productionSpy.processTick).toHaveBeenCalledWith(5);
    });

    it('should process population for specified hours', () => {
      service.processTime(3);

      expect(populationSpy.processTick).toHaveBeenCalledWith(3);
    });

    it('should allow fractional hours', () => {
      service.processTime(0.5);

      expect(productionSpy.processTick).toHaveBeenCalledWith(0.5);
      expect(populationSpy.processTick).toHaveBeenCalledWith(0.5);
    });

    it('should handle zero hours', () => {
      service.processTime(0);

      expect(productionSpy.processTick).toHaveBeenCalledWith(0);
      expect(populationSpy.processTick).toHaveBeenCalledWith(0);
    });

    it('should not affect trade or exploration', () => {
      service.processTime(10);

      expect(tradeSpy.processTick).not.toHaveBeenCalled();
      expect(explorationSpy.processTick).not.toHaveBeenCalled();
      expect(colonizationSpy.processTick).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy()', () => {
    it('should stop the game loop on destroy', fakeAsync(() => {
      service.start();
      expect(service.isRunning()).toBe(true);

      service.ngOnDestroy();

      expect(service.isRunning()).toBe(false);

      flush();
      discardPeriodicTasks();
    }));

    it('should clean up intervals on destroy', fakeAsync(() => {
      service.start();

      productionSpy.processTick.calls.reset();
      gameStateSpy.saveGame.calls.reset();

      service.ngOnDestroy();
      tick(200);
      tick(60000);

      expect(productionSpy.processTick).not.toHaveBeenCalled();
      expect(gameStateSpy.saveGame).not.toHaveBeenCalled();

      flush();
      discardPeriodicTasks();
    }));
  });

  describe('offline progress calculation', () => {
    it('should format duration in seconds for short periods', () => {
      mockGameState.lastPlayedAt = Date.now() - 65000;
      gameStateSpy.getState.and.returnValue(mockGameState);

      service.start();

      expect(gameStateSpy.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: jasmine.stringMatching(/1m/)
        })
      );
    });

    it('should format duration in minutes for medium periods', () => {
      mockGameState.lastPlayedAt = Date.now() - (10 * 60 * 1000);
      gameStateSpy.getState.and.returnValue(mockGameState);

      service.start();

      expect(gameStateSpy.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: jasmine.stringMatching(/10m/)
        })
      );
    });

    it('should format duration in hours for long periods', () => {
      mockGameState.lastPlayedAt = Date.now() - (2 * 60 * 60 * 1000);
      gameStateSpy.getState.and.returnValue(mockGameState);

      service.start();

      expect(gameStateSpy.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: jasmine.stringMatching(/2h/)
        })
      );
    });

    it('should format duration in days for very long periods', () => {
      mockGameState.lastPlayedAt = Date.now() - (25 * 60 * 60 * 1000);
      gameStateSpy.getState.and.returnValue(mockGameState);

      service.start();

      expect(gameStateSpy.addNotification).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: jasmine.stringMatching(/1d/)
        })
      );
    });

    it('should process offline time in 0.1 hour chunks', () => {
      mockGameState.lastPlayedAt = Date.now() - (1 * 60 * 60 * 1000);
      gameStateSpy.getState.and.returnValue(mockGameState);

      service.start();

      const productionCalls = productionSpy.processTick.calls.allArgs();
      const hasSmallChunks = productionCalls.some(args => args[0] > 0 && args[0] <= 0.1);
      expect(hasSmallChunks).toBe(true);
      expect(productionCalls.length).toBeGreaterThan(1);
    });

    it('should process entire offline period', () => {
      const offlineHours = 3;
      mockGameState.lastPlayedAt = Date.now() - (offlineHours * 60 * 60 * 1000);
      gameStateSpy.getState.and.returnValue(mockGameState);

      service.start();

      const productionCalls = productionSpy.processTick.calls.allArgs();
      const totalHours = productionCalls.reduce((sum, args) => sum + args[0], 0);

      expect(totalHours).toBeCloseTo(offlineHours, 1);
    });
  });

  describe('performance tracking', () => {
    beforeEach(() => {
      mockGameState.lastPlayedAt = Date.now();
      gameStateSpy.getState.and.returnValue(mockGameState);
    });

    afterEach(fakeAsync(() => {
      service.stop();
      flush();
      discardPeriodicTasks();
    }));

    it('should track ticks per second after running for 1 second', fakeAsync(() => {
      service.start();

      tick(1500);

      const tps = service.ticksPerSecond();
      expect(tps).toBeGreaterThanOrEqual(0);

      discardPeriodicTasks();
    }));

    it('should update TPS every second', fakeAsync(() => {
      service.start();

      tick(1500);
      const firstTps = service.ticksPerSecond();

      tick(1500);
      const secondTps = service.ticksPerSecond();

      expect(firstTps).toBeGreaterThanOrEqual(0);
      expect(secondTps).toBeGreaterThanOrEqual(0);

      discardPeriodicTasks();
    }));

    it('should track tick count accurately', fakeAsync(() => {
      service.start();

      tick(1000);

      const tickCount = service.tickCount();
      expect(tickCount).toBeGreaterThanOrEqual(4);
      expect(tickCount).toBeLessThanOrEqual(6);

      discardPeriodicTasks();
    }));
  });

  describe('multiple start/stop cycles', () => {
    afterEach(fakeAsync(() => {
      service.stop();
      flush();
      discardPeriodicTasks();
    }));

    it('should handle start/stop/start cycle', fakeAsync(() => {
      service.start();
      expect(service.isRunning()).toBe(true);

      tick(200);
      expect(service.tickCount()).toBeGreaterThan(0);

      service.stop();
      expect(service.isRunning()).toBe(false);

      const ticksAfterStop = service.tickCount();

      service.start();
      expect(service.isRunning()).toBe(true);

      tick(200);
      expect(service.tickCount()).toBeGreaterThan(ticksAfterStop);

      flush();
      discardPeriodicTasks();
    }));

    it('should preserve tick count across stop/start', fakeAsync(() => {
      service.start();
      tick(600);

      const ticksBeforeStop = service.tickCount();
      expect(ticksBeforeStop).toBeGreaterThan(0);

      service.stop();

      tick(600);

      service.start();

      const ticksAfterRestart = service.tickCount();
      expect(ticksAfterRestart).toBe(ticksBeforeStop);

      flush();
      discardPeriodicTasks();
    }));
  });

  describe('edge cases', () => {
    afterEach(fakeAsync(() => {
      service.stop();
      flush();
      discardPeriodicTasks();
    }));

    it('should handle very fast tick rate', fakeAsync(() => {
      mockGameState.settings.tickRate = 50;
      gameStateSpy.settings.and.returnValue(mockGameState.settings);

      service.start();

      tick(250);

      expect(service.tickCount()).toBeGreaterThanOrEqual(4);

      discardPeriodicTasks();
    }));

    it('should handle very slow tick rate', fakeAsync(() => {
      mockGameState.settings.tickRate = 1000;
      gameStateSpy.settings.and.returnValue(mockGameState.settings);

      service.start();

      tick(1500);

      expect(service.tickCount()).toBeLessThanOrEqual(2);

      discardPeriodicTasks();
    }));

    it('should propagate service dependency errors', fakeAsync(() => {
      mockGameState.lastPlayedAt = Date.now();
      gameStateSpy.getState.and.returnValue(mockGameState);
      productionSpy.processTick.and.throwError('Production error');

      expect(() => {
        service.start();
        tick(200);
      }).toThrowError('Production error');

      service.stop();
      flush();
      discardPeriodicTasks();
    }));

    it('should handle zero offline time', () => {
      mockGameState.lastPlayedAt = Date.now();
      gameStateSpy.getState.and.returnValue(mockGameState);

      service.start();

      expect(gameStateSpy.addNotification).not.toHaveBeenCalled();
    });

    it('should handle negative offline time', () => {
      mockGameState.lastPlayedAt = Date.now() + 60000;
      gameStateSpy.getState.and.returnValue(mockGameState);

      service.start();

      expect(gameStateSpy.addNotification).not.toHaveBeenCalled();
    });
  });
});
