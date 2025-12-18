import { Component, inject, computed } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { ExplorationService } from '../../services/exploration.service';
import { Ship, SHIP_SIZE_DEFINITIONS, SHIP_TIER_DEFINITIONS } from '../../models/ship.model';

@Component({
  selector: 'app-fleet-view',
  templateUrl: './fleet-view.component.html',
  styleUrl: './fleet-view.component.css'
})
export class FleetViewComponent {
  private gameState = inject(GameStateService);
  private explorationService = inject(ExplorationService);

  readonly ships = this.gameState.ships;
  readonly tradeRoutes = this.gameState.tradeRoutes;
  readonly scoutMissions = this.gameState.scoutMissions;
  readonly systems = this.gameState.systems;

  readonly shipsList = computed(() => Object.values(this.ships()));
  readonly routesList = computed(() => Object.values(this.tradeRoutes()));
  readonly missionsList = computed(() => Object.values(this.scoutMissions()));

  readonly idleScouts = computed(() =>
    Object.values(this.ships()).filter(s => s.type === 'scout' && s.status === 'idle')
  );

  readonly activeMissions = computed(() =>
    Object.values(this.scoutMissions()).filter(m => m.status !== 'completed')
  );

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
}
