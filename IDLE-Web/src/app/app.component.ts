import { Component, OnInit, inject } from '@angular/core';
import { GameStateService } from './services/game-state.service';
import { GameLoopService } from './services/game-loop.service';
import { HomeSystemService } from './services/home-system.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private gameState = inject(GameStateService);
  private gameLoop = inject(GameLoopService);
  private homeSystem = inject(HomeSystemService);

  readonly credits = this.gameState.credits;
  readonly selectedSystem = this.gameState.selectedSystem;
  readonly isRunning = this.gameLoop.isRunning;
  readonly ticksPerSecond = this.gameLoop.ticksPerSecond;

  currentView: 'galaxy' | 'system' | 'fleet' | 'market' = 'system';

  ngOnInit(): void {
    // Try to load existing save
    const loaded = this.gameState.loadGame();

    if (!loaded) {
      // Initialize new game with home system
      this.homeSystem.initializeHomeSystem();
      this.gameState.saveGame();
    }

    // Start the game loop
    this.gameLoop.start();
  }

  switchView(view: 'galaxy' | 'system' | 'fleet' | 'market'): void {
    this.currentView = view;
  }

  togglePause(): void {
    this.gameLoop.toggle();
  }

  saveGame(): void {
    this.gameState.saveGame();
  }

  restartGame(): void {
    // Stop loop while resetting
    this.gameLoop.stop();

    // Reset state (this includes a confirm in GameStateService.resetGame)
    this.gameState.resetGame();

    // Reinitialize home system and starting ships/resources
    this.homeSystem.initializeHomeSystem();

    // Save immediately
    this.gameState.saveGame();

    // Restart loop
    this.gameLoop.start();
  }

  formatCredits(amount: number): string {
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(2) + 'M';
    }
    if (amount >= 1000) {
      return (amount / 1000).toFixed(1) + 'K';
    }
    return amount.toFixed(0);
  }
}
