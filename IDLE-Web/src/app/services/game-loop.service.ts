import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { GameStateService } from './game-state.service';
import { ProductionService } from './production.service';
import { PopulationService } from './population.service';
import { TradeService } from './trade.service';
import { ExplorationService } from './exploration.service';
import { ColonizationService } from './colonization.service';

/**
 * Orchestrates the main game simulation loop.
 * Runs all subsystems (production, population, trade, exploration, colonization)
 * at regular intervals and handles offline progress calculation.
 *
 * Game Loop Architecture:
 * - Tick-based simulation running at configurable rate (default: 200ms = 5 ticks/second)
 * - Each tick processes deltaTime since last tick
 * - All systems receive same deltaTime for consistency
 * - Performance tracking (TPS = ticks per second)
 *
 * Subsystem Processing Order:
 * 1. Production: Facilities consume inputs, produce outputs
 * 2. Population: Consume resources, calculate growth/decline
 * 3. Trade: Process active trips, start new ones
 * 4. Exploration: Update scout missions
 * 5. Colonization: Progress multi-trip colonization missions
 *
 * Time Conversion:
 * - Tick interval: Milliseconds between ticks (default 200ms)
 * - deltaTime: Milliseconds since last tick (converted to hours for production/population)
 * - Production rates: All expressed in tonnes/hour (t/h)
 * - Conversion: deltaHours = deltaMs / (1000 × 60 × 60)
 *
 * Offline Progress:
 * - On start(), calculates time elapsed since lastPlayedAt
 * - Processes production/population in chunks (6-minute chunks = 0.1 hour)
 * - Completes any trade/scout missions that finished during offline time
 * - Shows notification summarizing offline progress
 * - Only processes if offline > 1 minute (prevents spamming on quick reload)
 *
 * Auto-Save:
 * - Separate interval from tick (default: 60 seconds)
 * - Saves to localStorage via GameStateService
 * - Can be disabled by setting autoSaveInterval to 0
 *
 * Performance Monitoring:
 * - Tracks actual TPS (ticks per second achieved)
 * - tickCount: Total ticks processed since start
 * - tickTimes: Recent tick timestamps for TPS calculation
 * - Updated every 1 second
 *
 * Lifecycle:
 * - start(): Begin game loop and auto-save timer
 * - stop(): Halt game loop and auto-save timer
 * - toggle(): Pause/resume (useful for UI control)
 * - ngOnDestroy(): Cleanup intervals when service destroyed
 *
 * @see tick for main loop execution
 * @see calculateOfflineProgress for offline time processing
 * @see GameStateService.settings for tick rate and auto-save configuration
 */
@Injectable({
  providedIn: 'root'
})
export class GameLoopService implements OnDestroy {
  private gameState = inject(GameStateService);
  private productionService = inject(ProductionService);
  private populationService = inject(PopulationService);
  private tradeService = inject(TradeService);
  private explorationService = inject(ExplorationService);
  private colonizationService = inject(ColonizationService);

  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickTime = Date.now();

  // Observable state
  private _isRunning = signal(false);
  private _tickCount = signal(0);
  private _ticksPerSecond = signal(0);

  readonly isRunning = computed(() => this._isRunning());
  readonly tickCount = computed(() => this._tickCount());
  readonly ticksPerSecond = computed(() => this._ticksPerSecond());

  // Performance tracking
  private tickTimes: number[] = [];
  private lastTpsUpdate = Date.now();

  ngOnDestroy(): void {
    this.stop();
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this._isRunning()) return;

    this._isRunning.set(true);
    this.lastTickTime = Date.now();

    // Calculate offline progress first
    this.calculateOfflineProgress();

    // Start the tick loop
    const tickRate = this.gameState.settings().tickRate;
    this.tickInterval = setInterval(() => this.tick(), tickRate);

    // Start auto-save
    const autoSaveInterval = this.gameState.settings().autoSaveInterval;
    if (autoSaveInterval > 0) {
      this.autoSaveInterval = setInterval(() => {
        this.gameState.saveGame();
      }, autoSaveInterval);
    }

    console.log('Game loop started');
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    this._isRunning.set(false);
    console.log('Game loop stopped');
  }

  /**
   * Pause/resume toggle
   */
  toggle(): void {
    if (this._isRunning()) {
      this.stop();
    } else {
      this.start();
    }
  }

  /**
   * Main tick function - called every tickRate ms
   */
  private tick(): void {
    const now = Date.now();
    const deltaTime = now - this.lastTickTime;
    this.lastTickTime = now;

    // Convert to hours for production calculations (game rates are in t/h)
    const deltaHours = deltaTime / (1000 * 60 * 60);

    // Run all systems
    this.productionService.processTick(deltaHours);
    this.populationService.processTick(deltaHours);
    this.tradeService.processTick(deltaTime);
    this.explorationService.processTick(deltaTime);
    this.colonizationService.processTick(deltaTime);

    // Update tick counter
    this._tickCount.update(c => c + 1);

    // Track TPS
    this.tickTimes.push(now);
    if (now - this.lastTpsUpdate > 1000) {
      const recentTicks = this.tickTimes.filter(t => now - t < 1000);
      this._ticksPerSecond.set(recentTicks.length);
      this.tickTimes = recentTicks;
      this.lastTpsUpdate = now;
    }
  }

  /**
   * Calculate progress while the game was closed
   */
  private calculateOfflineProgress(): void {
    const state = this.gameState.getState();
    const lastPlayed = state.lastPlayedAt;
    const now = Date.now();
    const offlineTime = now - lastPlayed;

    // Only process if more than 1 minute offline
    if (offlineTime < 60000) return;

    const offlineHours = offlineTime / (1000 * 60 * 60);

    console.log(`Calculating ${offlineHours.toFixed(2)} hours of offline progress...`);

    // Process production in larger chunks for offline calculation
    const CHUNK_SIZE = 0.1; // 6 minute chunks
    let remainingHours = offlineHours;

    while (remainingHours > 0) {
      const chunkHours = Math.min(remainingHours, CHUNK_SIZE);
      this.productionService.processTick(chunkHours);
      this.populationService.processTick(chunkHours);
      remainingHours -= chunkHours;
    }

    // Process trade trips that completed
    this.tradeService.processOfflineTrips(offlineTime);

    // Process scout missions that completed
    this.explorationService.processOfflineMissions(offlineTime);

    // Show summary notification
    this.gameState.addNotification({
      type: 'info',
      title: 'Welcome Back!',
      message: `Processed ${this.formatDuration(offlineTime)} of offline progress.`
    });
  }

  /**
   * Force process a specific amount of time (for debugging/testing)
   */
  processTime(hours: number): void {
    this.productionService.processTick(hours);
    this.populationService.processTick(hours);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  }
}
