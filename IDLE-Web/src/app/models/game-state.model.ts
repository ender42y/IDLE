// Game state model for I.D.L.E.

import { ResourceId, ResourceStock } from './resource.model';
import { StarSystem } from './star-system.model';
import { CelestialBody } from './celestial-body.model';
import { Facility } from './facility.model';
import { Ship, TradeRoute, ScoutMission, TradeTrip } from './ship.model';

export interface GameSettings {
  tickRate: number; // ms between ticks
  autoSaveInterval: number; // ms between auto-saves
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  theme: 'dark' | 'light';
}

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

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  systemId?: string;
}

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
}

export const INITIAL_GAME_SETTINGS: GameSettings = {
  tickRate: 200, // 5 ticks per second
  autoSaveInterval: 60000, // 1 minute
  soundEnabled: true,
  notificationsEnabled: true,
  theme: 'dark'
};

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

export const GAME_VERSION = '0.1.0';
