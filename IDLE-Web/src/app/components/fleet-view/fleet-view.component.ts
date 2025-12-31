import { Component, inject, computed, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { ExplorationService } from '../../services/exploration.service';
import { ColonizationService } from '../../services/colonization.service';
import { Ship, ShipType, ShipStatus, SHIP_SIZE_DEFINITIONS, SHIP_TIER_DEFINITIONS, calculateFuelCost } from '../../models/ship.model';
import { getRouteDist } from '../../models/star-system.model';
import { ResourceId, RESOURCE_DEFINITIONS } from '../../models/resource.model';

@Component({
  selector: 'app-fleet-view',
  templateUrl: './fleet-view.component.html',
  styleUrl: './fleet-view.component.css'
})
export class FleetViewComponent {
  private gameState = inject(GameStateService);
  private explorationService = inject(ExplorationService);
  private colonizationService = inject(ColonizationService);

  readonly ships = this.gameState.ships;
  readonly tradeRoutes = this.gameState.tradeRoutes;
  readonly scoutMissions = this.gameState.scoutMissions;
  readonly systems = this.gameState.systems;

  readonly shipsList = computed(() => Object.values(this.ships()));
  readonly routesList = computed(() => Object.values(this.tradeRoutes()));
  readonly missionsList = computed(() => Object.values(this.scoutMissions()));

  readonly idleScouts = computed(() =>
    Object.values(this.ships()).filter(s => s.type === ShipType.Scout && s.status === ShipStatus.Idle)
  );

  readonly idleFreighters = computed(() =>
    Object.values(this.ships()).filter(s => s.type === ShipType.Freighter && s.status === ShipStatus.Idle)
  );

  readonly uncolonizedSystems = computed(() =>
    Object.values(this.systems()).filter(s => s.discovered && !s.colonized)
  );

  readonly activeMissions = computed(() =>
    Object.values(this.scoutMissions()).filter(m => m.status !== 'completed')
  );

  // Colonization UI state
  showColonizationPanel = signal(false);
  selectedFreighterId = signal<string | null>(null);
  selectedTargetSystemId = signal<string | null>(null);
  selectedPortBodyId = signal<string | null>(null);

  readonly colonizationRequirements = this.colonizationService.getColonizationRequirements();

  readonly targetSystemBodies = computed(() => {
    const targetId = this.selectedTargetSystemId();
    if (!targetId) return [];
    const target = this.systems()[targetId];
    if (!target) return [];
    return target.bodyIds
      .map(id => this.gameState.getState().bodies[id])
      .filter(body => body && body.orbitalSlots > 0); // Only bodies with orbital slots can have starports
  });

  readonly canSendColonization = computed(() => {
    const freighterId = this.selectedFreighterId();
    const targetId = this.selectedTargetSystemId();
    const portBodyId = this.selectedPortBodyId();
    if (!freighterId || !targetId || !portBodyId) return false;

    const freighter = this.ships()[freighterId];
    if (!freighter || freighter.status !== ShipStatus.Idle) return false;

    const target = this.systems()[targetId];
    if (!target || target.colonized) return false;

    // Check if origin system has required resources
    const origin = this.systems()[freighter.currentSystemId];
    if (!origin) return false;

    for (const req of this.colonizationRequirements) {
      const available = this.gameState.getSystemResource(origin.id, req.resourceId);
      if (available < req.amount) return false;
    }

    // Also check fuel availability for the trip
    const totalCargo = this.colonizationRequirements.reduce((s, c) => s + c.amount, 0);
    const destination = this.systems()[targetId];
    if (!destination) return false;
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const fuelNeeded = calculateFuelCost(distance, totalCargo, freighter);
    const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);
    if (fuelAvailable < fuelNeeded) return false;

    return true;
  });

  getShipSizeName(ship: Ship): string {
    return SHIP_SIZE_DEFINITIONS[ship.size]?.name ?? ship.size;
  }

  getShipTierName(ship: Ship): string {
    return SHIP_TIER_DEFINITIONS[ship.tier]?.name ?? `Tier ${ship.tier}`;
  }

  getSystemName(systemId: string): string {
    return this.systems()[systemId]?.name ?? 'Unknown';
  }

  getMissionShipName(mission: { shipId?: string } | any): string {
    const shipId = mission?.shipId;
    if (!shipId) return 'Unknown';
    return this.ships()[shipId]?.name ?? 'Unknown';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'idle': return 'status-idle';
      case 'in_transit': return 'status-transit';
      case 'scouting': return 'status-scouting';
      case 'surveying': return 'status-surveying';
      default: return '';
    }
  }

  formatTime(timestamp: number): string {
    const remainingMs = timestamp - Date.now();
    if (remainingMs <= 0) return 'Arriving...';

    const totalSeconds = Math.ceil(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  launchScout(): void {
    const scouts = this.idleScouts();
    if (scouts.length === 0) return;
    this.explorationService.launchScoutMission(scouts[0].id);
  }

  recallMission(missionId: string): void {
    this.explorationService.cancelScoutMission(missionId);
  }

  toggleColonizationPanel(): void {
    this.showColonizationPanel.update(v => !v);
    if (!this.showColonizationPanel()) {
      this.selectedFreighterId.set(null);
      this.selectedTargetSystemId.set(null);
      this.selectedPortBodyId.set(null);
    }
  }

  selectFreighter(shipId: string): void {
    console.log('[FleetView] selectFreighter', shipId);
    this.selectedFreighterId.set(shipId);
  }

  selectTargetSystem(systemId: string): void {
    console.log('[FleetView] selectTargetSystem', systemId);
    this.selectedTargetSystemId.set(systemId);
    // Reset port body selection when changing target system
    this.selectedPortBodyId.set(null);
  }

  selectPortBody(bodyId: string): void {
    console.log('[FleetView] selectPortBody', bodyId);
    this.selectedPortBodyId.set(bodyId);
  }

  getResourceName(resourceId: ResourceId): string {
    return RESOURCE_DEFINITIONS[resourceId]?.name ?? resourceId;
  }

  getBodyTypeName(body: any): string {
    return body.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  }

  getResourceAvailable(resourceId: ResourceId): number {
    const freighterId = this.selectedFreighterId();
    if (!freighterId) return 0;
    const freighter = this.ships()[freighterId];
    if (!freighter) return 0;
    return this.gameState.getSystemResource(freighter.currentSystemId, resourceId);
  }

  sendColonizationMission(): void {
    const freighterId = this.selectedFreighterId();
    const targetId = this.selectedTargetSystemId();
    const portBodyId = this.selectedPortBodyId();

    console.log('[FleetView] sendColonizationMission called', { freighterId, targetId, portBodyId });
    if (!freighterId || !targetId || !portBodyId) {
      console.log('[FleetView] sendColonizationMission aborted - missing selection');
      return;
    }

    const success = this.colonizationService.sendColonizationMission(
      freighterId,
      targetId,
      this.colonizationRequirements,
      portBodyId
    );

    if (success) {
      this.showColonizationPanel.set(false);
      this.selectedFreighterId.set(null);
      this.selectedTargetSystemId.set(null);
      this.selectedPortBodyId.set(null);
    }
  }

  getColonizationDisabledReason(): string | null {
    const freighterId = this.selectedFreighterId();
    const targetId = this.selectedTargetSystemId();
    const portBodyId = this.selectedPortBodyId();
    if (!freighterId) return 'Select a freighter to send.';
    if (!targetId) return 'Select a target system.';
    if (!portBodyId) return 'Select a body for the initial starport.';

    const freighter = this.ships()[freighterId];
    if (!freighter) return 'Selected freighter not found.';
    if (freighter.status !== ShipStatus.Idle) return `${freighter.name} is not available.`;

    const origin = this.systems()[freighter.currentSystemId];
    const destination = this.systems()[targetId];
    if (!origin || !destination) return 'Invalid origin or destination.';
    if (destination.colonized) return 'Target system is already colonized.';

    for (const req of this.colonizationRequirements) {
      const available = this.gameState.getSystemResource(origin.id, req.resourceId);
      if (available < req.amount) return `Insufficient ${req.resourceId} at origin.`;
    }

    const totalCargo = this.colonizationRequirements.reduce((s, c) => s + c.amount, 0);
    const distance = getRouteDist(origin.coordinates, destination.coordinates);
    const fuelNeeded = calculateFuelCost(distance, totalCargo, freighter);
    const fuelAvailable = this.gameState.getSystemResource(origin.id, ResourceId.Fuel);
    if (fuelAvailable < fuelNeeded) return `Insufficient fuel at origin (${Math.round(fuelAvailable)} available).`;

    return null;
  }
}
