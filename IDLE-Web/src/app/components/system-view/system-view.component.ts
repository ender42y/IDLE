import { Component, inject, computed } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { ProductionService } from '../../services/production.service';
import { ConstructionService } from '../../services/construction.service';
import { CelestialBody, BODY_TYPE_DEFINITIONS, FEATURE_DEFINITIONS } from '../../models/celestial-body.model';
import { FACILITY_DEFINITIONS, FacilityId } from '../../models/facility.model';
import { RESOURCE_DEFINITIONS, ResourceId } from '../../models/resource.model';

@Component({
  selector: 'app-system-view',
  templateUrl: './system-view.component.html',
  styleUrl: './system-view.component.css'
})
export class SystemViewComponent {
  private gameState = inject(GameStateService);
  private productionService = inject(ProductionService);
  private constructionService = inject(ConstructionService);

  readonly selectedSystem = this.gameState.selectedSystem;
  readonly selectedBody = this.gameState.selectedBody;
  readonly bodies = this.gameState.bodies;
  readonly facilities = this.gameState.facilities;

  selectedFacilityToBuild: FacilityId | null = null;
  showBuildMenu = false;

  readonly systemBodies = computed(() => {
    const system = this.selectedSystem();
    if (!system) return [];

    return system.bodyIds
      .map(id => this.bodies()[id])
      .filter(Boolean)
      .sort((a, b) => {
        // Sort: Star first, then planets, then moons
        if (a.type === 'star') return -1;
        if (b.type === 'star') return 1;
        if (a.parentBodyId && !b.parentBodyId) return 1;
        if (!a.parentBodyId && b.parentBodyId) return -1;
        return a.name.localeCompare(b.name);
      });
  });

  readonly systemResources = computed(() => {
    const system = this.selectedSystem();
    if (!system) return [];

    return system.resources
      .filter(r => r.amount > 0)
      .map(r => ({
        ...r,
        name: RESOURCE_DEFINITIONS[r.resourceId]?.name ?? r.resourceId,
        rate: this.productionService.getNetProductionRate(system.id, r.resourceId)
      }))
      .sort((a, b) => (RESOURCE_DEFINITIONS[a.resourceId]?.tier ?? 0) - (RESOURCE_DEFINITIONS[b.resourceId]?.tier ?? 0));
  });

  readonly bodyFacilities = computed(() => {
    const body = this.selectedBody();
    if (!body) return [];

    return body.facilityIds
      .map(id => this.facilities()[id])
      .filter(Boolean)
      .map(f => ({
        ...f,
        definition: FACILITY_DEFINITIONS[f.definitionId]
      }));
  });

  readonly availableFacilities = computed(() => {
    const body = this.selectedBody();
    if (!body) return [];

    return this.constructionService.getAvailableFacilities(body.id)
      .filter(f => f.canBuild);
  });

  getBodyTypeName(body: CelestialBody): string {
    return BODY_TYPE_DEFINITIONS[body.type]?.name ?? body.type;
  }

  getFeatureName(feature: string): string {
    return FEATURE_DEFINITIONS[feature as keyof typeof FEATURE_DEFINITIONS]?.name ?? feature;
  }

  selectBody(body: CelestialBody): void {
    this.gameState.selectBody(body.id);
    this.showBuildMenu = false;
  }

  toggleBuildMenu(): void {
    this.showBuildMenu = !this.showBuildMenu;
    this.selectedFacilityToBuild = null;
  }

  selectFacilityToBuild(facilityId: FacilityId): void {
    this.selectedFacilityToBuild = facilityId;
  }

  buildFacility(): void {
    const body = this.selectedBody();
    if (!body || !this.selectedFacilityToBuild) return;

    this.constructionService.buildFacility(this.selectedFacilityToBuild, body.id);
    this.showBuildMenu = false;
    this.selectedFacilityToBuild = null;
  }

  getCost(facilityId: FacilityId): ReturnType<ConstructionService['getConstructionCost']> {
    const body = this.selectedBody();
    if (!body) return null;
    return this.constructionService.getConstructionCost(facilityId, body.id);
  }

  formatNumber(value: number): string {
    if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(2) + 'M';
    }
    if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    if (Math.abs(value) >= 100) {
      return value.toFixed(0);
    }
    return value.toFixed(1);
  }

  formatRate(rate: number): string {
    const formatted = this.formatNumber(rate);
    return rate >= 0 ? `+${formatted}/h` : `${formatted}/h`;
  }
}
