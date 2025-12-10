import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import {
  Facility,
  FacilityId,
  FACILITY_DEFINITIONS,
  FacilityDefinition
} from '../models/facility.model';
import { ResourceId, RESOURCE_DEFINITIONS } from '../models/resource.model';
import {
  CelestialBody,
  BodyFeature,
  FEATURE_DEFINITIONS
} from '../models/celestial-body.model';
import {
  StarSystem,
  SYSTEM_STATE_DEFINITIONS
} from '../models/star-system.model';

export interface ProductionReport {
  facilityId: string;
  facilityName: string;
  outputResource: ResourceId;
  baseRate: number;
  actualRate: number;
  efficiency: number;
  blockedReason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductionService {
  private gameState = inject(GameStateService);

  /**
   * Process a production tick for all facilities
   * @param deltaHours Time elapsed in hours
   */
  processTick(deltaHours: number): void {
    const state = this.gameState.getState();

    // Process each colonized system
    for (const system of Object.values(state.systems)) {
      if (!system.colonized) continue;

      // Get all bodies in this system
      const systemBodies = system.bodyIds
        .map(id => state.bodies[id])
        .filter(Boolean);

      // Get all facilities in this system
      const systemFacilities = systemBodies
        .flatMap(body => body.facilityIds)
        .map(id => state.facilities[id])
        .filter(Boolean);

      // Calculate system-wide modifiers
      const systemModifier = this.getSystemProductionModifier(system);

      // Process facilities in tier order (extractors first, then refiners, etc.)
      const sortedFacilities = this.sortFacilitiesByTier(systemFacilities);

      // Track production this tick
      const productionThisTick = new Map<ResourceId, number>();

      for (const facility of sortedFacilities) {
        if (!facility.operational) continue;

        const definition = FACILITY_DEFINITIONS[facility.definitionId];
        if (!definition) continue;

        const body = state.bodies[facility.bodyId];
        if (!body) continue;

        // Calculate body bonuses
        const bodyModifier = this.getBodyProductionModifier(body, definition);

        // Combined modifier
        const totalModifier = systemModifier * bodyModifier;

        // Handle extraction facilities
        if (definition.production) {
          const baseRate = definition.production.baseRate;
          const actualRate = baseRate * totalModifier * deltaHours;
          const produced = actualRate;

          // Add to system storage
          this.gameState.addResourceToSystem(
            system.id,
            definition.production.output,
            produced
          );

          // Track for consumption by other facilities
          const existing = productionThisTick.get(definition.production.output) ?? 0;
          productionThisTick.set(definition.production.output, existing + produced);
        }

        // Handle conversion facilities
        if (definition.conversion) {
          const conversion = definition.conversion;

          // Check if we have enough inputs
          let canProcess = true;
          let limitingFactor = 1;

          for (const input of conversion.inputs) {
            const available = this.gameState.getSystemResource(system.id, input.resourceId);
            const needed = conversion.throughput * input.amount * deltaHours;

            if (available < needed) {
              canProcess = available > 0;
              const factor = available / needed;
              limitingFactor = Math.min(limitingFactor, factor);
            }
          }

          if (canProcess && limitingFactor > 0) {
            // Calculate actual throughput
            const actualThroughput = conversion.throughput * limitingFactor * deltaHours;

            // Consume inputs
            for (const input of conversion.inputs) {
              const consumed = actualThroughput * input.amount;
              this.gameState.removeResourceFromSystem(system.id, input.resourceId, consumed);
            }

            // Produce output (with efficiency loss)
            const produced = actualThroughput * conversion.efficiency * totalModifier;
            this.gameState.addResourceToSystem(system.id, conversion.output, produced);

            // Track production
            const existing = productionThisTick.get(conversion.output) ?? 0;
            productionThisTick.set(conversion.output, existing + produced);
          }
        }
      }
    }
  }

  /**
   * Get production report for a system
   */
  getSystemProductionReport(systemId: string): ProductionReport[] {
    const state = this.gameState.getState();
    const system = state.systems[systemId];
    if (!system) return [];

    const reports: ProductionReport[] = [];
    const systemModifier = this.getSystemProductionModifier(system);

    const systemBodies = system.bodyIds
      .map(id => state.bodies[id])
      .filter(Boolean);

    const systemFacilities = systemBodies
      .flatMap(body => body.facilityIds)
      .map(id => state.facilities[id])
      .filter(Boolean);

    for (const facility of systemFacilities) {
      const definition = FACILITY_DEFINITIONS[facility.definitionId];
      if (!definition) continue;

      const body = state.bodies[facility.bodyId];
      if (!body) continue;

      const bodyModifier = this.getBodyProductionModifier(body, definition);
      const totalModifier = systemModifier * bodyModifier;

      if (definition.production) {
        reports.push({
          facilityId: facility.id,
          facilityName: definition.name,
          outputResource: definition.production.output,
          baseRate: definition.production.baseRate,
          actualRate: definition.production.baseRate * totalModifier,
          efficiency: totalModifier,
          blockedReason: facility.operational ? undefined : 'Facility offline'
        });
      }

      if (definition.conversion) {
        // Check inputs to determine actual efficiency
        let limitingFactor = 1;
        let blockedReason: string | undefined;

        for (const input of definition.conversion.inputs) {
          const available = this.gameState.getSystemResource(system.id, input.resourceId);
          const needed = definition.conversion.throughput * input.amount;

          if (available < needed) {
            const factor = available / needed;
            if (factor < limitingFactor) {
              limitingFactor = factor;
              const resourceName = RESOURCE_DEFINITIONS[input.resourceId]?.name ?? input.resourceId;
              blockedReason = `Insufficient ${resourceName}`;
            }
          }
        }

        reports.push({
          facilityId: facility.id,
          facilityName: definition.name,
          outputResource: definition.conversion.output,
          baseRate: definition.conversion.throughput * definition.conversion.efficiency,
          actualRate: definition.conversion.throughput * definition.conversion.efficiency * totalModifier * limitingFactor,
          efficiency: totalModifier * limitingFactor * definition.conversion.efficiency,
          blockedReason: facility.operational ? blockedReason : 'Facility offline'
        });
      }
    }

    return reports;
  }

  /**
   * Calculate net production rate for a resource in a system (per hour)
   */
  getNetProductionRate(systemId: string, resourceId: ResourceId): number {
    const reports = this.getSystemProductionReport(systemId);
    let netRate = 0;

    for (const report of reports) {
      if (report.outputResource === resourceId) {
        netRate += report.actualRate;
      }
    }

    // Subtract consumption (handled by population service)
    // This is a simplified version - full implementation would track consumption too

    return netRate;
  }

  private getSystemProductionModifier(system: StarSystem): number {
    const stateDefinition = SYSTEM_STATE_DEFINITIONS[system.state];
    let modifier = 1;

    if (stateDefinition.effects.productionModifier) {
      modifier *= (1 + stateDefinition.effects.productionModifier);
    }

    return modifier;
  }

  private getBodyProductionModifier(body: CelestialBody, facilityDef: FacilityDefinition): number {
    let modifier = 1;

    for (const feature of body.features) {
      const featureDef = FEATURE_DEFINITIONS[feature];
      if (!featureDef) continue;

      // Apply mining bonus
      if (featureDef.bonus.miningOutput && facilityDef.economy === 'mining') {
        modifier *= (1 + featureDef.bonus.miningOutput);
      }

      // Apply agriculture bonus
      if (featureDef.bonus.agricultureOutput && facilityDef.economy === 'agriculture') {
        modifier *= (1 + featureDef.bonus.agricultureOutput);
      }

      // Apply tourism bonus
      if (featureDef.bonus.tourismOutput && facilityDef.economy === 'tourism') {
        modifier *= (1 + featureDef.bonus.tourismOutput);
      }
    }

    return modifier;
  }

  private sortFacilitiesByTier(facilities: Facility[]): Facility[] {
    return facilities.sort((a, b) => {
      const defA = FACILITY_DEFINITIONS[a.definitionId];
      const defB = FACILITY_DEFINITIONS[b.definitionId];
      return (defA?.tier ?? 0) - (defB?.tier ?? 0);
    });
  }
}
