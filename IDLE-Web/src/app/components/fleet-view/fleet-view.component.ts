import { Component, inject, computed } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { Ship, SHIP_SIZE_DEFINITIONS, SHIP_TIER_DEFINITIONS } from '../../models/ship.model';

@Component({
  selector: 'app-fleet-view',
  templateUrl: './fleet-view.component.html',
  styleUrl: './fleet-view.component.css'
})
export class FleetViewComponent {
  private gameState = inject(GameStateService);

  readonly ships = this.gameState.ships;
  readonly tradeRoutes = this.gameState.tradeRoutes;
  readonly scoutMissions = this.gameState.scoutMissions;
  readonly systems = this.gameState.systems;

  readonly shipsList = computed(() => Object.values(this.ships()));
  readonly routesList = computed(() => Object.values(this.tradeRoutes()));
  readonly missionsList = computed(() => Object.values(this.scoutMissions()));

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
    const remaining = timestamp - Date.now();
    if (remaining <= 0) return 'Arriving...';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
