import { Component, inject, computed, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { ProductionService } from '../../services/production.service';
import { ConstructionService } from '../../services/construction.service';
import { PopulationService } from '../../services/population.service';
import { CelestialBody, BODY_TYPE_DEFINITIONS, FEATURE_DEFINITIONS } from '../../models/celestial-body.model';
import { FACILITY_DEFINITIONS, FacilityId, FacilityDefinition } from '../../models/facility.model';
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
  private populationService = inject(PopulationService);

  readonly selectedSystem = this.gameState.selectedSystem;
  readonly selectedBody = this.gameState.selectedBody;
  readonly bodies = this.gameState.bodies;
  readonly facilities = this.gameState.facilities;

  selectedFacilityToBuild = signal<FacilityId | null>(null);
  showBuildMenu = false;

  // Signal to control whether unavailable facilities are shown
  showUnavailableFacilities = signal<boolean>(true);

  readonly systemBodies = computed(() => {
    const system = this.selectedSystem();
    if (!system) return [];

    const allBodies = system.bodyIds
      .map(id => this.bodies()[id])
      .filter(Boolean);

    // Separate into primary bodies (stars/planets) and moons
    const primaryBodies = allBodies
      .filter(b => !b.parentBodyId)
      .sort((a, b) => {
        // Star first, then sort by name
        if (a.type === 'star') return -1;
        if (b.type === 'star') return 1;
        return a.name.localeCompare(b.name);
      });

    // Build final list with moons placed directly after their parent
    const result: CelestialBody[] = [];
    for (const body of primaryBodies) {
      result.push(body);
      // Find and add moons of this body, sorted by name
      const moons = allBodies
        .filter(b => b.parentBodyId === body.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      result.push(...moons);
    }

    return result;
  });

  readonly systemResources = computed(() => {
    const system = this.selectedSystem();
    if (!system) return [];
    // Get consumption summary (per hour) from population service
    const consumptionSummary = this.populationService.getConsumptionSummary(system.id)
      .reduce((acc, cur) => {
        acc[cur.resource] = cur.needed; // per hour
        return acc;
      }, {} as Record<string, number>);

    // Collect resource IDs to show: present in storage, consumed, produced, or used as inputs/outputs by facilities
    const resourceIds = new Set<string>();

    // Add resources that exist in storage
    for (const r of system.resources) resourceIds.add(r.resourceId);

    // Add resources referenced by facilities in the system (production/conversion)
    const state = this.gameState.getState();
    const bodies = system.bodyIds.map(id => state.bodies[id]).filter(Boolean);
    const facilityIds = bodies.flatMap(b => b.facilityIds);
    for (const fid of facilityIds) {
      const facility = state.facilities[fid];
      if (!facility) continue;
      const def = FACILITY_DEFINITIONS[facility.definitionId];
      if (!def) continue;
      if (def.production) resourceIds.add(def.production.output);
      if (def.conversion) {
        resourceIds.add(def.conversion.output);
        for (const inp of def.conversion.inputs) resourceIds.add(inp.resourceId);
      }
    }

    // Add consumption resources
    for (const rid of Object.keys(consumptionSummary)) resourceIds.add(rid);

    // Build resource list using the collected ids (show zero amounts too)
    const results = Array.from(resourceIds).map(resourceId => {
      const stock = system.resources.find(r => r.resourceId === resourceId);
      const amount = stock?.amount ?? 0;
      const capacity = stock?.capacity ?? 0;
      const rate = this.productionService.getNetProductionRate(system.id, resourceId as ResourceId);
      const consumption = consumptionSummary[resourceId] ?? 0;
      const overdraw = consumption > rate;
      return {
        resourceId,
        amount,
        capacity,
        name: RESOURCE_DEFINITIONS[resourceId as ResourceId]?.name ?? resourceId,
        rate,
        consumption,
        overdraw
      };
    });

    return results.sort((a, b) => (RESOURCE_DEFINITIONS[a.resourceId as ResourceId]?.tier ?? 0) - (RESOURCE_DEFINITIONS[b.resourceId as ResourceId]?.tier ?? 0));
  });

  readonly bodyFacilities = computed(() => {
    const body = this.selectedBody();
    if (!body) return [];

    const system = this.selectedSystem();
    if (!system) return [];

    return body.facilityIds
      .map(id => this.facilities()[id])
      .filter(Boolean)
      .map(f => {
        const definition = FACILITY_DEFINITIONS[f.definitionId];
        const rateInfo = this.getFacilityRateInfo(definition, system.id);
        return {
          ...f,
          definition,
          rateInfo
        };
      });
  });

  // Available facilities: filter by slot types that actually have open slots, sort by tier then name
  readonly availableFacilities = computed(() => {
    const body = this.selectedBody();
    if (!body) return [];

    const all = this.constructionService.getAvailableFacilities(body.id);

    const surfaceOpen = body.surveyed && body.usedSurfaceSlots < body.surfaceSlots;
    const orbitalOpen = body.surveyed && body.usedOrbitalSlots < body.orbitalSlots;

    const showUnavailable = this.showUnavailableFacilities();

    const state = this.gameState.getState();

    const filtered = all.filter(a => {
      const slotType = a.facility.slotType;
      if (slotType === 'surface' && !surfaceOpen) return false;
      if (slotType === 'orbital' && !orbitalOpen) return false;
      if (!showUnavailable && !a.canBuild) return false;
      return true;
    }).map(a => {
      const cost = this.getCost(a.facility.id as FacilityId);
      // Determine affordability
      const affordable = !!cost && cost.canAfford;

      // Get rate info for tooltip
      const rateInfo = this.getFacilityRateInfo(a.facility);

      // Build tooltip with rate info
      const tooltipParts: string[] = [];

      // Add production rate info
      if (rateInfo) {
        tooltipParts.push(rateInfo);
      }

      // Add population floor info
      if (a.facility.populationFloor > 0) {
        tooltipParts.push(`Pop: +${a.facility.populationFloor}`);
      }

      // Add build status
      if (!a.canBuild) {
        tooltipParts.push(`Cannot: ${a.reason}`);
      } else if (!affordable) {
        const missing: string[] = [];
        if (cost && state.credits < cost.credits) {
          missing.push(`${cost.credits - state.credits} credits`);
        }
        if (cost) {
          for (const res of cost.resources) {
            if (res.available < res.amount) {
              missing.push(`${res.amount - res.available} ${res.name}`);
            }
          }
        }
        tooltipParts.push(`Need: ${missing.join(', ')}`);
      }

      return {
        ...a,
        affordable,
        rateInfo,
        tooltip: tooltipParts.join(' | ')
      };
    });

    filtered.sort((a, b) => {
      const tierDiff = a.facility.tier - b.facility.tier;
      if (tierDiff !== 0) return tierDiff;
      return a.facility.name.localeCompare(b.facility.name);
    });

    return filtered;
  });

  // Selected facility cost computed to simplify template expression
  readonly selectedFacilityCost = computed(() => {
    const fid = this.selectedFacilityToBuild();
    if (!fid) return null;
    return this.getCost(fid);
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
    this.selectedFacilityToBuild.set(null);
  }

  toggleShowUnavailableFacilities(): void {
    this.showUnavailableFacilities.update(v => !v);
  }

  selectFacilityToBuild(facilityId: FacilityId): void {
    this.selectedFacilityToBuild.set(facilityId);
  }

  buildFacility(): void {
    const body = this.selectedBody();
    const fid = this.selectedFacilityToBuild();
    if (!body || !fid) return;

    this.constructionService.buildFacility(fid, body.id);
    this.showBuildMenu = false;
    this.selectedFacilityToBuild.set(null);
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

  /**
   * Get production/conversion rate info for a facility definition
   */
  getFacilityRateInfo(definition: FacilityDefinition, systemId?: string): string {
    if (definition.production) {
      const outputName = RESOURCE_DEFINITIONS[definition.production.output]?.name ?? definition.production.output;
      return `Produces ${definition.production.baseRate} ${outputName}/h`;
    }

    if (definition.conversion) {
      const conv = definition.conversion;
      const inputParts = conv.inputs.map(inp => {
        const name = RESOURCE_DEFINITIONS[inp.resourceId]?.name ?? inp.resourceId;
        return `${inp.amount * conv.throughput} ${name}`;
      });
      const outputName = RESOURCE_DEFINITIONS[conv.output]?.name ?? conv.output;
      const outputRate = conv.throughput * conv.efficiency;
      return `${inputParts.join(' + ')} -> ${outputRate} ${outputName}/h`;
    }

    if (definition.bonuses) {
      const parts: string[] = [];
      if (definition.bonuses.tradeCapacity) parts.push(`Trade Tier ${definition.bonuses.tradeCapacity}`);
      if (definition.bonuses.techLevel) parts.push(`+${definition.bonuses.techLevel} Tech`);
      if (definition.bonuses.securityLevel) parts.push(`+${definition.bonuses.securityLevel} Security`);
      if (definition.bonuses.commsRange) parts.push(`+${definition.bonuses.commsRange} Comms Range`);
      if (definition.bonuses.creditBonus) parts.push(`+${(definition.bonuses.creditBonus * 100).toFixed(0)}% Credits`);
      if (definition.bonuses.solBonus) parts.push(`+${(definition.bonuses.solBonus * 100).toFixed(0)}% SoL`);
      return parts.length > 0 ? parts.join(', ') : 'Support Facility';
    }

    return '';
  }

  /**
   * Get tooltip with rate info for build menu
   */
  getBuildTooltip(facility: FacilityDefinition, canBuild: boolean, reason?: string, affordable?: boolean): string {
    const lines: string[] = [];

    // Add rate info
    const rateInfo = this.getFacilityRateInfo(facility);
    if (rateInfo) {
      lines.push(rateInfo);
    }

    // Add population floor
    if (facility.populationFloor > 0) {
      lines.push(`Pop. Floor: +${facility.populationFloor}`);
    }

    // Add build status
    if (!canBuild) {
      lines.push(`Cannot build: ${reason}`);
    } else if (!affordable) {
      lines.push('Cannot afford');
    }

    return lines.join(' | ');
  }
}
