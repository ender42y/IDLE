/**
 * GDD v6 Section 24: Prestige System
 * Defines the New Game+ mechanic where players reset their progress
 * to earn permanent bonuses (prestige tokens) based on achievements.
 */

/**
 * Prestige state stored in game.
 * Tracks total tokens earned, prestige count, and best run score.
 */
export interface PrestigeState {
  // Total tokens accumulated across all prestiges
  totalTokens: number;

  // Number of times player has prestiged
  prestigeCount: number;

  // Highest prestige score achieved in a single run
  highestScore: number;

  // Last prestige timestamp
  lastPrestigeAt?: number;
}

/**
 * Breakdown of prestige score components.
 * Separates raw metrics (tonnage, credits) from calculated scores and bonuses.
 */
export interface PrestigeScoreBreakdown {
  storageTonnage: number;      // Total tonnes across all systems
  creditsBalance: number;       // Current credits
  totalPopulation: number;      // Sum of all population
  systemsColonized: number;     // Number of colonized systems
  facilitiesBuilt: number;      // Total facilities
  shipsOwned: number;           // Fleet size

  // Calculated values
  storageScore: number;
  creditsScore: number;
  populationScore: number;
  bonusScore: number;
  totalScore: number;
}

/**
 * Permanent bonuses from accumulated prestige tokens.
 * GDD v6 Section 24.4: Bonuses are intentionally tiny (+0.1% per token)
 * to provide long-term progression without breaking game balance.
 */
export interface PrestigeBonuses {
  productionBonus: number;      // +0.1% per token
  shipSpeedBonus: number;       // +0.1% per token
  researchSpeedBonus: number;   // +0.1% per token
}

/**
 * Prestige score thresholds for earning tokens.
 * TBD - Requires balancing. Target: ~1 week of active play for first token.
 * Uses diminishing returns (1.5× scaling) to prevent runaway growth.
 */
export const PRESTIGE_TOKEN_THRESHOLDS = {
  // Score needed for first token
  FIRST_TOKEN_SCORE: 100000,

  // Score multiplier for each subsequent token (diminishing returns)
  TOKEN_SCALING: 1.5,

  // Maximum tokens achievable (soft cap)
  MAX_TOKENS: 1000
};

/**
 * Bonus percentage per prestige token.
 * Intentionally tiny per GDD v6 Section 24.4: 0.1% per token.
 * With 100 tokens, player has +10% production/speed/research.
 */
export const PRESTIGE_BONUS_PER_TOKEN = {
  production: 0.001,    // +0.1% per token
  shipSpeed: 0.001,     // +0.1% per token
  researchSpeed: 0.001  // +0.1% per token
};

/**
 * Initial prestige state for brand new games (no prestige yet).
 */
export const INITIAL_PRESTIGE_STATE: PrestigeState = {
  totalTokens: 0,
  prestigeCount: 0,
  highestScore: 0
};

/**
 * Calculate prestige bonuses from token count
 */
export function calculatePrestigeBonuses(tokens: number): PrestigeBonuses {
  return {
    productionBonus: tokens * PRESTIGE_BONUS_PER_TOKEN.production,
    shipSpeedBonus: tokens * PRESTIGE_BONUS_PER_TOKEN.shipSpeed,
    researchSpeedBonus: tokens * PRESTIGE_BONUS_PER_TOKEN.researchSpeed
  };
}

/**
 * Calculate tokens earned from a prestige score
 */
export function calculateTokensFromScore(score: number): number {
  if (score < PRESTIGE_TOKEN_THRESHOLDS.FIRST_TOKEN_SCORE) {
    return 0;
  }

  let tokens = 0;
  let threshold = PRESTIGE_TOKEN_THRESHOLDS.FIRST_TOKEN_SCORE;

  while (score >= threshold && tokens < PRESTIGE_TOKEN_THRESHOLDS.MAX_TOKENS) {
    tokens++;
    score -= threshold;
    threshold = Math.floor(threshold * PRESTIGE_TOKEN_THRESHOLDS.TOKEN_SCALING);
  }

  return tokens;
}
