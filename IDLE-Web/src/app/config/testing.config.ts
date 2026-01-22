/**
 * Testing Configuration
 *
 * This file centralizes all testing-related values and multipliers.
 * When preparing for production, set TESTING_ENABLED to false and all
 * multipliers will reset to their production values (1).
 *
 * To find all places that use testing config, search for:
 * - import from 'testing.config'
 * - TESTING_CONFIG
 */

/**
 * Master switch for testing mode.
 * Set to false for production builds.
 */
const TESTING_ENABLED = true;

/**
 * Testing configuration values.
 * When TESTING_ENABLED is false, all multipliers default to 1 (production values).
 */
export const TESTING_CONFIG = {
  /** Master toggle - when false, all multipliers are 1 */
  enabled: TESTING_ENABLED,

  /**
   * Speed multiplier for freighter travel times.
   * Production: 1, Testing: 200
   * Affects: calculateTravelTime() in ship.model.ts
   */
  freighterSpeedMultiplier: TESTING_ENABLED ? 200 : 1,

  /**
   * Speed multiplier for scout missions.
   * Production: 1, Testing: 40
   * Affects: sendScoutMission() in exploration.service.ts
   */
  scoutSpeedMultiplier: TESTING_ENABLED ? 40 : 1,

  /**
   * Multiplier for starting resources.
   * Production: 1, Testing: 10
   * Affects: createStartingResources() in home-system.service.ts
   */
  startingResourcesMultiplier: TESTING_ENABLED ? 10 : 1,

  /**
   * Enable verbose debug logging for colonization service.
   * Production: false, Testing: true
   */
  debugColonization: TESTING_ENABLED,

  /**
   * Enable verbose debug logging for exploration service.
   * Production: false, Testing: true
   */
  debugExploration: TESTING_ENABLED,

  /**
   * Enable verbose debug logging for trade service.
   * Production: false, Testing: true
   */
  debugTrade: TESTING_ENABLED,
} as const;

/**
 * Helper function to log debug messages only when testing is enabled.
 * @param service - Service name prefix (e.g., 'Colonization', 'Trade')
 * @param message - Log message
 * @param data - Optional data to log
 */
export function debugLog(service: string, message: string, data?: unknown): void {
  if (!TESTING_CONFIG.enabled) return;

  if (data !== undefined) {
    console.log(`[${service}] ${message}`, data);
  } else {
    console.log(`[${service}] ${message}`);
  }
}

/**
 * Helper function to log debug warnings only when testing is enabled.
 */
export function debugWarn(service: string, message: string, data?: unknown): void {
  if (!TESTING_CONFIG.enabled) return;

  if (data !== undefined) {
    console.warn(`[${service}] ${message}`, data);
  } else {
    console.warn(`[${service}] ${message}`);
  }
}
