import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import { HomeSystemService } from './home-system.service';
import {
  PrestigeState,
  PrestigeScoreBreakdown,
  PrestigeBonuses,
  INITIAL_PRESTIGE_STATE,
  calculatePrestigeBonuses,
  calculateTokensFromScore
} from '../models/prestige.model';
import { ResourceId } from '../models/resource.model';

/**
 * GDD v6 Section 24: Prestige Service
 * Handles prestige score calculation, token earning, and New Game+ reset
 */
@Injectable({
  providedIn: 'root'
})
export class PrestigeService {
  private gameState = inject(GameStateService);
  private homeSystem = inject(HomeSystemService);

  /**
   * Get current prestige state
   */
  getPrestigeState(): PrestigeState {
    const state = this.gameState.getState();
    return state.prestige ?? INITIAL_PRESTIGE_STATE;
  }

  /**
   * Get current prestige bonuses
   */
  getPrestigeBonuses(): PrestigeBonuses {
    const prestige = this.getPrestigeState();
    return calculatePrestigeBonuses(prestige.totalTokens);
  }

  /**
   * Calculate prestige score breakdown for current game state
   * GDD v6 Section 24.2
   */
  calculatePrestigeScore(): PrestigeScoreBreakdown {
    const state = this.gameState.getState();

    // Calculate storage tonnage (total resources across all systems)
    let storageTonnage = 0;
    for (const system of Object.values(state.systems)) {
      for (const resource of system.resources) {
        if (resource.resourceId !== ResourceId.Credits) {
          storageTonnage += resource.amount;
        }
      }
    }

    // Credits balance
    const creditsBalance = state.credits;

    // Total population
    let totalPopulation = 0;
    for (const system of Object.values(state.systems)) {
      if (system.colonized) {
        totalPopulation += system.totalPopulation;
      }
    }

    // Systems colonized
    const systemsColonized = Object.values(state.systems).filter(s => s.colonized).length;

    // Facilities built
    const facilitiesBuilt = Object.keys(state.facilities).length;

    // Ships owned
    const shipsOwned = Object.keys(state.ships).length;

    // Calculate component scores
    // These multipliers are placeholder values - TBD for balancing
    const storageScore = Math.floor(storageTonnage * 0.1);
    const creditsScore = Math.floor(creditsBalance * 0.01);
    const populationScore = Math.floor(totalPopulation * 0.5);

    // Bonus score from achievements (colonies, facilities, ships)
    const bonusScore =
      (systemsColonized * 1000) +
      (facilitiesBuilt * 100) +
      (shipsOwned * 500);

    const totalScore = storageScore + creditsScore + populationScore + bonusScore;

    return {
      storageTonnage,
      creditsBalance,
      totalPopulation,
      systemsColonized,
      facilitiesBuilt,
      shipsOwned,
      storageScore,
      creditsScore,
      populationScore,
      bonusScore,
      totalScore
    };
  }

  /**
   * Calculate how many tokens would be earned from current score
   */
  getTokensFromCurrentScore(): number {
    const breakdown = this.calculatePrestigeScore();
    return calculateTokensFromScore(breakdown.totalScore);
  }

  /**
   * Check if prestige is available (score > 0 tokens)
   */
  canPrestige(): boolean {
    return this.getTokensFromCurrentScore() > 0;
  }

  /**
   * Perform prestige reset
   * GDD v6 Section 24.5: Resets most game state, keeps tokens
   */
  performPrestige(): boolean {
    if (!this.canPrestige()) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Cannot Prestige',
        message: 'You need to earn at least 1 prestige token first.'
      });
      return false;
    }

    const breakdown = this.calculatePrestigeScore();
    const tokensEarned = calculateTokensFromScore(breakdown.totalScore);
    const currentPrestige = this.getPrestigeState();

    // Update prestige state
    const newPrestigeState: PrestigeState = {
      totalTokens: currentPrestige.totalTokens + tokensEarned,
      prestigeCount: currentPrestige.prestigeCount + 1,
      highestScore: Math.max(currentPrestige.highestScore, breakdown.totalScore),
      lastPrestigeAt: Date.now()
    };

    // Store prestige state before reset
    this.gameState.setPrestigeState(newPrestigeState);

    // Reset game state (GDD v6 Section 24.5)
    this.resetGameState();

    // Notification
    this.gameState.addNotification({
      type: 'success',
      title: 'Prestige Complete!',
      message: `You earned ${tokensEarned} prestige token(s). Total: ${newPrestigeState.totalTokens}`
    });

    return true;
  }

  /**
   * Reset game state for new prestige run
   * GDD v6 Section 24.5: What Resets
   */
  private resetGameState(): void {
    try {
      // Get current prestige state to preserve it
      const currentPrestige = this.getPrestigeState();

      // Use batched state reset to avoid redundant signal updates
      this.gameState.resetGameStateForPrestige(currentPrestige);

      // Reinitialize Sol with starting configuration
      this.homeSystem.initializeHomeSystem();
    } catch (error) {
      console.error('[Prestige] Failed to reset game state:', error);
      this.gameState.addNotification({
        type: 'danger',
        title: 'Prestige Failed',
        message: 'An error occurred during prestige reset. Your progress has been preserved.'
      });
      throw error;
    }
  }

  /**
   * Get production modifier from prestige
   */
  getProductionModifier(): number {
    const bonuses = this.getPrestigeBonuses();
    return 1 + bonuses.productionBonus;
  }

  /**
   * Get ship speed modifier from prestige
   */
  getShipSpeedModifier(): number {
    const bonuses = this.getPrestigeBonuses();
    return 1 + bonuses.shipSpeedBonus;
  }

  /**
   * Get research speed modifier from prestige
   */
  getResearchSpeedModifier(): number {
    const bonuses = this.getPrestigeBonuses();
    return 1 + bonuses.researchSpeedBonus;
  }
}
