import { Injectable, signal, computed, effect } from '@angular/core';
import {
  GameState,
  GameSettings,
  Notification,
  INITIAL_GAME_SETTINGS,
  INITIAL_GAME_STATS,
  GAME_VERSION
} from '../models/game-state.model';
import {
  StarSystem,
  SystemRarity,
  SystemState
} from '../models/star-system.model';
import { CelestialBody, BodyType, BodyFeature } from '../models/celestial-body.model';
import { Facility, FacilityId } from '../models/facility.model';
import { Ship, ShipType, ShipSize, ShipTier, ShipStatus, TradeRoute, ScoutMission, TradeTrip } from '../models/ship.model';
import { ResourceId, ResourceStock, RESOURCE_DEFINITIONS } from '../models/resource.model';

const STORAGE_KEY = 'idle_game_state';
const SETTINGS_KEY = 'idle_game_settings';

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  // Core game state signal
  private _gameState = signal<GameState>(this.createInitialState());

  // Derived signals for specific parts of state
  readonly credits = computed(() => this._gameState().credits);
  readonly systems = computed(() => this._gameState().systems);
  readonly bodies = computed(() => this._gameState().bodies);
  readonly facilities = computed(() => this._gameState().facilities);
  readonly ships = computed(() => this._gameState().ships);
  readonly tradeRoutes = computed(() => this._gameState().tradeRoutes);
  readonly scoutMissions = computed(() => this._gameState().scoutMissions);
  readonly notifications = computed(() => this._gameState().notifications);
  readonly stats = computed(() => this._gameState().stats);
  readonly settings = computed(() => this._gameState().settings);
  readonly marketPrices = computed(() => this._gameState().marketPrices);

  // Selection state
  readonly selectedSystemId = computed(() => this._gameState().selectedSystemId);
  readonly selectedBodyId = computed(() => this._gameState().selectedBodyId);

  // Computed helpers
  readonly selectedSystem = computed(() => {
    const systemId = this.selectedSystemId();
    return systemId ? this.systems()[systemId] : null;
  });

  readonly selectedBody = computed(() => {
    const bodyId = this.selectedBodyId();
    return bodyId ? this.bodies()[bodyId] : null;
  });

  readonly systemsList = computed(() => Object.values(this.systems()));
  readonly discoveredSystems = computed(() =>
    this.systemsList().filter(s => s.discovered)
  );
  readonly colonizedSystems = computed(() =>
    this.systemsList().filter(s => s.colonized)
  );

  readonly shipsList = computed(() => Object.values(this.ships()));
  readonly idleShips = computed(() =>
    this.shipsList().filter(s => s.status === ShipStatus.Idle)
  );

  readonly unreadNotifications = computed(() =>
    this.notifications().filter(n => !n.read)
  );

  constructor() {
    // Auto-save effect
    effect(() => {
      const state = this._gameState();
      if (state.settings.autoSaveInterval > 0) {
        // This effect triggers on state changes
        // Actual auto-save timing is handled by the game loop
      }
    });
  }

  // State access
  getState(): GameState {
    return this._gameState();
  }

  // System operations
  getSystem(systemId: string): StarSystem | undefined {
    return this._gameState().systems[systemId];
  }

  updateSystem(systemId: string, updates: Partial<StarSystem>): void {
    this._gameState.update(state => ({
      ...state,
      systems: {
        ...state.systems,
        [systemId]: { ...state.systems[systemId], ...updates }
      }
    }));
  }

  addSystem(system: StarSystem): void {
    this._gameState.update(state => ({
      ...state,
      systems: { ...state.systems, [system.id]: system }
    }));
  }

  // Body operations
  getBody(bodyId: string): CelestialBody | undefined {
    return this._gameState().bodies[bodyId];
  }

  updateBody(bodyId: string, updates: Partial<CelestialBody>): void {
    this._gameState.update(state => ({
      ...state,
      bodies: {
        ...state.bodies,
        [bodyId]: { ...state.bodies[bodyId], ...updates }
      }
    }));
  }

  addBody(body: CelestialBody): void {
    this._gameState.update(state => ({
      ...state,
      bodies: { ...state.bodies, [body.id]: body }
    }));
  }

  // Facility operations
  getFacility(facilityId: string): Facility | undefined {
    return this._gameState().facilities[facilityId];
  }

  addFacility(facility: Facility): void {
    this._gameState.update(state => ({
      ...state,
      facilities: { ...state.facilities, [facility.id]: facility }
    }));
  }

  updateFacility(facilityId: string, updates: Partial<Facility>): void {
    this._gameState.update(state => ({
      ...state,
      facilities: {
        ...state.facilities,
        [facilityId]: { ...state.facilities[facilityId], ...updates }
      }
    }));
  }

  removeFacility(facilityId: string): void {
    this._gameState.update(state => {
      const { [facilityId]: removed, ...remaining } = state.facilities;
      return { ...state, facilities: remaining };
    });
  }

  // Ship operations
  getShip(shipId: string): Ship | undefined {
    return this._gameState().ships[shipId];
  }

  addShip(ship: Ship): void {
    this._gameState.update(state => ({
      ...state,
      ships: { ...state.ships, [ship.id]: ship }
    }));
  }

  updateShip(shipId: string, updates: Partial<Ship>): void {
    this._gameState.update(state => ({
      ...state,
      ships: {
        ...state.ships,
        [shipId]: { ...state.ships[shipId], ...updates }
      }
    }));
  }

  removeShip(shipId: string): void {
    this._gameState.update(state => {
      const { [shipId]: removed, ...remaining } = state.ships;
      return { ...state, ships: remaining };
    });
  }

  // Trade route operations
  addTradeRoute(route: TradeRoute): void {
    this._gameState.update(state => ({
      ...state,
      tradeRoutes: { ...state.tradeRoutes, [route.id]: route }
    }));
  }

  updateTradeRoute(routeId: string, updates: Partial<TradeRoute>): void {
    this._gameState.update(state => ({
      ...state,
      tradeRoutes: {
        ...state.tradeRoutes,
        [routeId]: { ...state.tradeRoutes[routeId], ...updates }
      }
    }));
  }

  removeTradeRoute(routeId: string): void {
    this._gameState.update(state => {
      const { [routeId]: removed, ...remaining } = state.tradeRoutes;
      return { ...state, tradeRoutes: remaining };
    });
  }

  // Scout mission operations
  addScoutMission(mission: ScoutMission): void {
    this._gameState.update(state => ({
      ...state,
      scoutMissions: { ...state.scoutMissions, [mission.id]: mission }
    }));
  }

  updateScoutMission(missionId: string, updates: Partial<ScoutMission>): void {
    this._gameState.update(state => ({
      ...state,
      scoutMissions: {
        ...state.scoutMissions,
        [missionId]: { ...state.scoutMissions[missionId], ...updates }
      }
    }));
  }

  removeScoutMission(missionId: string): void {
    this._gameState.update(state => {
      const { [missionId]: removed, ...remaining } = state.scoutMissions;
      return { ...state, scoutMissions: remaining };
    });
  }

  // Credits operations
  addCredits(amount: number): void {
    this._gameState.update(state => ({
      ...state,
      credits: state.credits + amount,
      stats: {
        ...state.stats,
        totalCreditsEarned: state.stats.totalCreditsEarned + Math.max(0, amount)
      }
    }));
  }

  spendCredits(amount: number): boolean {
    if (this._gameState().credits < amount) {
      return false;
    }
    this._gameState.update(state => ({
      ...state,
      credits: state.credits - amount
    }));
    return true;
  }

  // Resource operations for systems
  addResourceToSystem(systemId: string, resourceId: ResourceId, amount: number): void {
    this._gameState.update(state => {
      const system = state.systems[systemId];
      if (!system) return state;

      const existingIndex = system.resources.findIndex(r => r.resourceId === resourceId);
      let newResources: ResourceStock[];

      if (existingIndex >= 0) {
        newResources = [...system.resources];
        const newAmount = Math.min(
          newResources[existingIndex].amount + amount,
          newResources[existingIndex].capacity
        );
        newResources[existingIndex] = {
          ...newResources[existingIndex],
          amount: newAmount
        };
      } else {
        newResources = [
          ...system.resources,
          { resourceId, amount, capacity: 10000 } // Default capacity
        ];
      }

      return {
        ...state,
        systems: {
          ...state.systems,
          [systemId]: { ...system, resources: newResources }
        }
      };
    });
  }

  removeResourceFromSystem(systemId: string, resourceId: ResourceId, amount: number): boolean {
    const system = this._gameState().systems[systemId];
    if (!system) return false;

    const resource = system.resources.find(r => r.resourceId === resourceId);
    if (!resource || resource.amount < amount) return false;

    this._gameState.update(state => {
      const sys = state.systems[systemId];
      const newResources = sys.resources.map(r =>
        r.resourceId === resourceId
          ? { ...r, amount: r.amount - amount }
          : r
      );

      return {
        ...state,
        systems: {
          ...state.systems,
          [systemId]: { ...sys, resources: newResources }
        }
      };
    });

    return true;
  }

  getSystemResource(systemId: string, resourceId: ResourceId): number {
    const system = this._gameState().systems[systemId];
    if (!system) return 0;
    const resource = system.resources.find(r => r.resourceId === resourceId);
    return resource?.amount ?? 0;
  }

  // Selection operations
  selectSystem(systemId: string | null): void {
    this._gameState.update(state => ({
      ...state,
      selectedSystemId: systemId,
      selectedBodyId: null
    }));
  }

  selectBody(bodyId: string | null): void {
    this._gameState.update(state => ({
      ...state,
      selectedBodyId: bodyId
    }));
  }

  // Notification operations
  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      timestamp: Date.now(),
      read: false
    };

    this._gameState.update(state => ({
      ...state,
      notifications: [newNotification, ...state.notifications].slice(0, 100),
      unreadNotificationCount: state.unreadNotificationCount + 1
    }));
  }

  markNotificationRead(notificationId: string): void {
    this._gameState.update(state => ({
      ...state,
      notifications: state.notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
      unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1)
    }));
  }

  markAllNotificationsRead(): void {
    this._gameState.update(state => ({
      ...state,
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadNotificationCount: 0
    }));
  }

  // Settings operations
  updateSettings(updates: Partial<GameSettings>): void {
    this._gameState.update(state => ({
      ...state,
      settings: { ...state.settings, ...updates }
    }));
    this.saveSettings();
  }

  // Stats operations
  incrementStat(stat: keyof typeof INITIAL_GAME_STATS, amount: number = 1): void {
    this._gameState.update(state => ({
      ...state,
      stats: {
        ...state.stats,
        [stat]: (state.stats[stat] as number) + amount
      }
    }));
  }

  // Market prices
  updateMarketPrices(): void {
    this._gameState.update(state => {
      const newPrices = { ...state.marketPrices };
      for (const resourceId of Object.keys(newPrices) as ResourceId[]) {
        const baseDef = RESOURCE_DEFINITIONS[resourceId];
        if (!baseDef) continue;

        // Fluctuate between 75-90% for sell, 100% for buy
        const sellVariation = 0.75 + Math.random() * 0.15;
        newPrices[resourceId] = {
          sell: Math.floor(baseDef.basePrice * sellVariation),
          buy: baseDef.basePrice
        };
      }
      return { ...state, marketPrices: newPrices };
    });
  }

  // Persistence
  saveGame(): void {
    const state = this._gameState();
    const saveData: GameState = {
      ...state,
      lastSavedAt: Date.now()
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      this.addNotification({
        type: 'success',
        title: 'Game Saved',
        message: 'Your progress has been saved.'
      });
    } catch (error) {
      console.error('Failed to save game:', error);
      this.addNotification({
        type: 'danger',
        title: 'Save Failed',
        message: 'Could not save your progress.'
      });
    }
  }

  loadGame(): boolean {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (!savedData) return false;

      const state: GameState = JSON.parse(savedData);

      // Validate version compatibility
      if (state.version !== GAME_VERSION) {
        console.warn('Save game version mismatch, may need migration');
        // Could add migration logic here
      }

      this._gameState.set({
        ...state,
        lastPlayedAt: Date.now()
      });

      return true;
    } catch (error) {
      console.error('Failed to load game:', error);
      return false;
    }
  }

  saveSettings(): void {
    try {
      const settings = this._gameState().settings;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  loadSettings(): void {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        const settings: GameSettings = JSON.parse(savedSettings);
        this._gameState.update(state => ({
          ...state,
          settings: { ...INITIAL_GAME_SETTINGS, ...settings }
        }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  resetGame(): void {
    if (confirm('Are you sure you want to reset your game? All progress will be lost.')) {
      localStorage.removeItem(STORAGE_KEY);
      this._gameState.set(this.createInitialState());
    }
  }

  // Utility
  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private createInitialState(): GameState {
    const initialMarketPrices: Record<ResourceId, { buy: number; sell: number }> = {} as Record<ResourceId, { buy: number; sell: number }>;

    for (const [id, def] of Object.entries(RESOURCE_DEFINITIONS)) {
      initialMarketPrices[id as ResourceId] = {
        sell: Math.floor(def.basePrice * 0.8),
        buy: def.basePrice
      };
    }

    return {
      version: GAME_VERSION,
      createdAt: Date.now(),
      lastSavedAt: Date.now(),
      lastPlayedAt: Date.now(),
      settings: INITIAL_GAME_SETTINGS,
      credits: 10000,
      systems: {},
      bodies: {},
      facilities: {},
      ships: {},
      tradeRoutes: {},
      scoutMissions: {},
      activeTrips: {},
      explorationFrontier: [],
      nextDiscoveryDistance: 5,
      selectedSystemId: null,
      selectedBodyId: null,
      notifications: [],
      unreadNotificationCount: 0,
      stats: INITIAL_GAME_STATS,
      marketPrices: initialMarketPrices
    };
  }
}
