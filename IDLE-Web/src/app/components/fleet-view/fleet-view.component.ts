import { Component, inject, computed, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { ExplorationService } from '../../services/exploration.service';
import { ColonizationService } from '../../services/colonization.service';
import { SupplyTransportService } from '../../services/supply-transport.service';
import { Ship, ShipType, ShipStatus, SHIP_SIZE_DEFINITIONS, SHIP_TIER_DEFINITIONS, calculateFuelCost } from '../../models/ship.model';
import { getRouteDist } from '../../models/star-system.model';
import { ResourceId, RESOURCE_DEFINITIONS } from '../../models/resource.model';
import { TransportMission, TransportMissionType, TransportCargoItem } from '../../models/transport-mission.model';

@Component({
  selector: 'app-fleet-view',
  templateUrl: './fleet-view.component.html',
  styleUrl: './fleet-view.component.css'
})
export class FleetViewComponent {
  private gameState = inject(GameStateService);
  private explorationService = inject(ExplorationService);
  private colonizationService = inject(ColonizationService);
  private supplyTransportService = inject(SupplyTransportService);

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

  // Transport missions
  readonly transportMissions = this.gameState.transportMissions;
  readonly activeTransportMissions = computed(() =>
    Object.values(this.transportMissions()).filter(m => m.status !== 'completed')
  );
  readonly colonizedSystems = computed(() =>
    Object.values(this.systems()).filter(s => s.colonized)
  );

  // Colonization UI state
  showColonizationPanel = signal(false);
  selectedFreighterId = signal<string | null>(null);
  selectedTargetSystemId = signal<string | null>(null);
  selectedPortBodyId = signal<string | null>(null);

  // Transport UI state
  showTransportPanel = signal(false);
  selectedTransportShipId = signal<string | null>(null);
  selectedDestinationId = signal<string | null>(null);
  selectedMissionType = signal<TransportMissionType>(TransportMissionType.OneWay);
  outboundCargo = signal<{ resourceId: ResourceId; amount: number }[]>([]);
  returnCargo = signal<{ resourceId: ResourceId; amount: number }[]>([]);

  readonly colonizationRequirements = this.colonizationService.getColonizationRequirements();

  readonly availableResourcesAtShip = computed(() => {
    const shipId = this.selectedTransportShipId();
    if (!shipId) return [];
    const ship = this.ships()[shipId];
    if (!ship) return [];
    const system = this.systems()[ship.currentSystemId];
    return system?.resources?.filter(r => r.amount > 0) || [];
  });

  readonly canSendTransportMission = computed(() => {
    const shipId = this.selectedTransportShipId();
    const destId = this.selectedDestinationId();
    const outbound = this.outboundCargo();
    return shipId && destId && outbound.length > 0 && outbound.every(c => c.amount > 0);
  });

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

  getTransportResourceName(resourceId: ResourceId | string): string {
    const def = RESOURCE_DEFINITIONS[resourceId as ResourceId];
    return def?.name ?? (typeof resourceId === 'string' ? resourceId : '');
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

  // Transport panel toggle
  toggleTransportPanel(): void {
    this.showTransportPanel.update(v => !v);
    if (!this.showTransportPanel()) {
      this.resetTransportSelections();
    }
  }

  resetTransportSelections(): void {
    this.selectedTransportShipId.set(null);
    this.selectedDestinationId.set(null);
    this.selectedMissionType.set(TransportMissionType.OneWay);
    this.outboundCargo.set([]);
    this.returnCargo.set([]);
  }

  // Selection methods
  selectTransportShip(shipId: string): void {
    this.selectedTransportShipId.set(shipId);
  }

  selectDestinationSystem(systemId: string): void {
    this.selectedDestinationId.set(systemId);
  }

  selectMissionType(type: TransportMissionType): void {
    this.selectedMissionType.set(type);
    if (type === TransportMissionType.OneWay) {
      this.returnCargo.set([]);
    }
  }

  // Cargo management
  addOutboundCargoItem(): void {
    const available = this.availableResourcesAtShip();
    if (available.length > 0) {
      this.outboundCargo.update(cargo => [
        ...cargo,
        { resourceId: available[0].resourceId, amount: 0 }
      ]);
    }
  }

  removeOutboundCargoItem(index: number): void {
    this.outboundCargo.update(cargo => cargo.filter((_, i) => i !== index));
  }

  updateOutboundCargoItem(index: number, resourceId: ResourceId, amount: number): void {
    this.outboundCargo.update(cargo => {
      const newCargo = [...cargo];
      newCargo[index] = { resourceId, amount };
      return newCargo;
    });
  }

  addReturnCargoItem(): void {
    this.returnCargo.update(cargo => [
      ...cargo,
      { resourceId: ResourceId.Steel, amount: 0 }
    ]);
  }

  removeReturnCargoItem(index: number): void {
    this.returnCargo.update(cargo => cargo.filter((_, i) => i !== index));
  }

  updateReturnCargoItem(index: number, resourceId: ResourceId, amount: number): void {
    this.returnCargo.update(cargo => {
      const newCargo = [...cargo];
      newCargo[index] = { resourceId, amount };
      return newCargo;
    });
  }

  // Mission control
  sendTransportMission(): void {
    const shipId = this.selectedTransportShipId();
    const destId = this.selectedDestinationId();
    const type = this.selectedMissionType();

    if (!shipId || !destId) return;

    // Convert to simple format for service (service gets origin from ship)
    const outbound = this.outboundCargo().map(c => ({
      resourceId: c.resourceId,
      amount: c.amount
    }));

    const return_ = this.returnCargo().map(c => ({
      resourceId: c.resourceId,
      amount: c.amount
    }));

    let success = false;
    switch (type) {
      case TransportMissionType.OneWay:
        success = this.supplyTransportService.createOneWayMission(shipId, destId, outbound);
        break;
      case TransportMissionType.RoundTrip:
        success = this.supplyTransportService.createRoundTripMission(shipId, destId, outbound, return_);
        break;
      case TransportMissionType.RecurringRoute:
        success = this.supplyTransportService.createRecurringRoute(shipId, destId, outbound, return_);
        break;
    }

    if (success) {
      this.showTransportPanel.set(false);
      this.resetTransportSelections();
    }
  }

  cancelTransportMission(missionId: string): void {
    this.supplyTransportService.cancelMission(missionId);
  }

  // Helper methods

  formatTransportCargoDisplay(cargo: TransportCargoItem[]): string {
    if (cargo.length === 0) return 'Empty';
    return cargo
      .filter(c => c.loadedAmount > 0)
      .map(c => `${c.loadedAmount.toFixed(0)}t ${this.getResourceName(c.resourceId)}`)
      .join(', ');
  }

  getMissionStatusPhase(mission: TransportMission): string {
    const phaseNames: Record<string, string> = {
      'at_origin_preparing_outbound': 'Loading at origin',
      'in_transit_to_destination': 'En route to destination',
      'at_destination_unloading_and_preparing': 'Unloading at destination',
      'in_transit_to_origin': 'Returning to origin',
      'at_origin_unloading': 'Unloading at origin'
    };

    if (mission.status === 'waiting') {
      const waitReasons: Record<string, string> = {
        'waiting_for_cargo': 'Waiting for cargo',
        'waiting_for_fuel': 'Waiting for fuel',
        'waiting_for_storage_space': 'Waiting for storage space'
      };
      return mission.waitReason ? waitReasons[mission.waitReason] : 'Waiting';
    }

    return phaseNames[mission.phase] || mission.phase;
  }

  formatMissionETA(mission: TransportMission): string {
    if (!mission.arrivalTime) return '';
    const remaining = mission.arrivalTime - Date.now();
    if (remaining <= 0) return 'Arriving...';
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  // Export enum and constants for template
  TransportMissionType = TransportMissionType;
  ResourceId = ResourceId;
  RESOURCE_DEFINITIONS = RESOURCE_DEFINITIONS;
  resourceIds = Object.keys(RESOURCE_DEFINITIONS);
}
