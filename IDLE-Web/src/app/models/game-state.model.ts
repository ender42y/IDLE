/**
 * Game state model for I.D.L.E.
 * Central definition of the complete game state including all systems, ships,
 * resources, and player progress. Designed for immutable signal-based updates.
 */

import { ResourceId, ResourceStock } from './resource.model';
import { StarSystem } from './star-system.model';
import { CelestialBody } from './celestial-body.model';
import { Facility } from './facility.model';
import { Ship, TradeRoute, ScoutMission, TradeTrip, TradeMission } from './ship.model';
import { PrestigeState, INITIAL_PRESTIGE_STATE } from './prestige.model';
import { TransportMission } from './transport-mission.model';

/**
 * Player-configurable game settings.
 * Persisted separately from game state for convenience.
 */
export interface GameSettings {
  tickRate: number; // ms between ticks
  autoSaveInterval: number; // ms between auto-saves
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  theme: 'dark' | 'light';
}

/**
 * Statistical tracking of player achievements and milestones.
 * Used for prestige calculations and UI display.
 */
export interface GameStats {
  totalPlayTime: number; // ms
  systemsDiscovered: number;
  systemsColonized: number;
  facilitiesBuilt: number;
  totalResourcesProduced: Record<ResourceId, number>;
  totalCreditsEarned: number;
  shipsLost: number;
  maxPopulation: number;
}

/**
 * In-game notification shown to the player.
 * Types: info (neutral), success (positive), warning (caution), danger (critical)
 */
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  systemId?: string;
}

/**
 * Complete game state representing the entire player session.
 * All collections use Record<id, T> for O(1) lookups.
 * Designed to be updated immutably via Angular signals.
 */
export interface GameState {
  // Meta
  version: string;
  createdAt: number;
  lastSavedAt: number;
  lastPlayedAt: number;

  // Settings
  settings: GameSettings;

  // Global resources
  credits: number;

  // Galaxy state
  systems: Record<string, StarSystem>;
  bodies: Record<string, CelestialBody>;
  facilities: Record<string, Facility>;

  // Fleet state
  ships: Record<string, Ship>;
  tradeRoutes: Record<string, TradeRoute>;
  scoutMissions: Record<string, ScoutMission>;
  activeTrips: Record<string, TradeTrip>;
  tradeMissions: Record<string, TradeMission>; // GDD v6: One-time trade missions
  transportMissions: Record<string, TransportMission>; // GDD v6 Section 15: Supply transport

  // Discovery frontier
  explorationFrontier: { x: number; y: number }[];
  nextDiscoveryDistance: number;

  // UI state
  selectedSystemId: string | null;
  selectedBodyId: string | null;

  // Notifications queue
  notifications: Notification[];
  unreadNotificationCount: number;

  // Statistics
  stats: GameStats;

  // Galactic market prices (fluctuate slightly)
  marketPrices: Record<ResourceId, { buy: number; sell: number }>;

  // GDD v6 Section 24: Prestige system
  prestige: PrestigeState;
}

/**
 * Default game settings for new games.
 * Tickrate of 200ms = 5 ticks per second for smooth animations.
 */
export const INITIAL_GAME_SETTINGS: GameSettings = {
  tickRate: 200, // 5 ticks per second
  autoSaveInterval: 60000, // 1 minute
  soundEnabled: true,
  notificationsEnabled: true,
  theme: 'dark'
};

/**
 * Initial stat values for new games.
 * Sol counts as first discovered and colonized system.
 */
export const INITIAL_GAME_STATS: GameStats = {
  totalPlayTime: 0,
  systemsDiscovered: 1, // Home system
  systemsColonized: 1,
  facilitiesBuilt: 0,
  totalResourcesProduced: {} as Record<ResourceId, number>,
  totalCreditsEarned: 0,
  shipsLost: 0,
  maxPopulation: 0
};

/**
 * Current game version for save file migration.
 * Updated when save format changes to trigger migration logic.
 */
export const GAME_VERSION = '0.2.0';  // v6 GDD update

/**
 * Previous game version - used to detect saves that need migration.
 */
export const PREVIOUS_VERSION = '0.1.0';  // v5 GDD
