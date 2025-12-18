import { Component, inject, computed, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { ExplorationService } from '../../services/exploration.service';
import { ColonizationService } from '../../services/colonization.service';
import { Ship, ShipType, ShipStatus, SHIP_SIZE_DEFINITIONS, SHIP_TIER_DEFINITIONS } from '../../models/ship.model';
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

  readonly colonizationRequirements = this.colonizationService.getColonizationRequirements();

  readonly canSendColonization = computed(() => {
    const freighterId = this.selectedFreighterId();
    const targetId = this.selectedTargetSystemId();
    if (!freighterId || !targetId) return false;

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
    }
  }

  selectFreighter(shipId: string): void {
    this.selectedFreighterId.set(shipId);
  }

  selectTargetSystem(systemId: string): void {
    this.selectedTargetSystemId.set(systemId);
  }

  getResourceName(resourceId: ResourceId): string {
    return RESOURCE_DEFINITIONS[resourceId]?.name ?? resourceId;
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

    if (!freighterId || !targetId) return;

    const success = this.colonizationService.sendColonizationMission(
      freighterId,
      targetId,
      this.colonizationRequirements
    );

    if (success) {
      this.showColonizationPanel.set(false);
      this.selectedFreighterId.set(null);
      this.selectedTargetSystemId.set(null);
    }
  }
}
