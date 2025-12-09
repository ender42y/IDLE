import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import { ResourceId } from '../models/resource.model';
import { StarSystem, SYSTEM_STATE_DEFINITIONS, SystemState } from '../models/star-system.model';
import { CelestialBody, BODY_TYPE_DEFINITIONS, BodyFeature, FEATURE_DEFINITIONS } from '../models/celestial-body.model';
import { FACILITY_DEFINITIONS } from '../models/facility.model';

// Population consumption rates per 1000 population per hour
const CONSUMPTION_RATES = {
  [ResourceId.PreparedFoods]: 1,    // 1 t/h per 1000 pop
  [ResourceId.PurifiedWater]: 0.5,  // 0.5 t/h per 1000 pop
  [ResourceId.BasicGoods]: 0.2      // 0.2 t/h per 1000 pop
};

// Optional consumption for higher SoL
const OPTIONAL_CONSUMPTION = {
  [ResourceId.QualityFoods]: { rate: 0.3, solBonus: 10 },
  [ResourceId.ComfortGoods]: { rate: 0.15, solBonus: 15 },
  [ResourceId.GourmetFoods]: { rate: 0.1, solBonus: 20 },
  [ResourceId.LuxuryGoods]: { rate: 0.05, solBonus: 25 }
};

@Injectable({
  providedIn: 'root'
})
export class PopulationService {
  private gameState = inject(GameStateService);

  /**
   * Process population changes for a tick
   * @param deltaHours Time elapsed in hours
   */
  processTick(deltaHours: number): void {
    const state = this.gameState.getState();

    for (const system of Object.values(state.systems)) {
      if (!system.colonized) continue;

      // Calculate consumption and SoL
      const { consumed, solFromConsumption } = this.processConsumption(system, deltaHours);

      // Calculate population floor and ceiling
      const { floor, ceiling } = this.calculatePopulationLimits(system);

      // Calculate SoL
      const standardOfLiving = this.calculateStandardOfLiving(system, solFromConsumption);

      // Calculate population drift
      const populationChange = this.calculatePopulationDrift(
        system.totalPopulation,
        floor,
        ceiling,
        standardOfLiving,
        system.state,
        deltaHours
      );

      // Update system
      const newPopulation = Math.max(floor, Math.min(ceiling, system.totalPopulation + populationChange));

      this.gameState.updateSystem(system.id, {
        totalPopulation: Math.round(newPopulation),
        standardOfLiving: Math.round(standardOfLiving)
      });

      // Check for state changes based on conditions
      this.checkSystemStateChanges(system, consumed);
    }
  }

  /**
   * Process resource consumption by population
   */
  private processConsumption(system: StarSystem, deltaHours: number): {
    consumed: Record<ResourceId, number>;
    solFromConsumption: number;
  } {
    const consumed: Record<ResourceId, number> = {} as Record<ResourceId, number>;
    let solFromConsumption = 50; // Base SoL
    const popThousands = system.totalPopulation / 1000;

    // Process required consumption
    for (const [resourceId, rate] of Object.entries(CONSUMPTION_RATES)) {
      const needed = rate * popThousands * deltaHours;
      const available = this.gameState.getSystemResource(system.id, resourceId as ResourceId);
      const actualConsumed = Math.min(needed, available);

      if (actualConsumed > 0) {
        this.gameState.removeResourceFromSystem(system.id, resourceId as ResourceId, actualConsumed);
        consumed[resourceId as ResourceId] = actualConsumed;
      }

      // Reduce SoL if not enough
      if (actualConsumed < needed) {
        const shortage = (needed - actualConsumed) / needed;
        solFromConsumption -= shortage * 20; // Up to -20 SoL per shortage
      }
    }

    // Process optional consumption for SoL bonuses
    for (const [resourceId, config] of Object.entries(OPTIONAL_CONSUMPTION)) {
      const needed = config.rate * popThousands * deltaHours;
      const available = this.gameState.getSystemResource(system.id, resourceId as ResourceId);
      const actualConsumed = Math.min(needed, available);

      if (actualConsumed > 0) {
        this.gameState.removeResourceFromSystem(system.id, resourceId as ResourceId, actualConsumed);
        consumed[resourceId as ResourceId] = actualConsumed;

        // Add SoL bonus proportional to consumption
        const fulfillment = actualConsumed / needed;
        solFromConsumption += config.solBonus * fulfillment;
      }
    }

    return { consumed, solFromConsumption };
  }

  /**
   * Calculate population floor and ceiling for a system
   */
  calculatePopulationLimits(system: StarSystem): { floor: number; ceiling: number } {
    const state = this.gameState.getState();
    let floor = 0;
    let ceiling = 0;

    for (const bodyId of system.bodyIds) {
      const body = state.bodies[bodyId];
      if (!body) continue;

      const bodyTypeDef = BODY_TYPE_DEFINITIONS[body.type];
      if (!bodyTypeDef.canHavePopulation) continue;

      // Calculate body ceiling
      let bodyCeiling = 1000 * bodyTypeDef.populationMultiplier;

      // Apply feature bonuses
      for (const feature of body.features) {
        const featureDef = FEATURE_DEFINITIONS[feature];
        if (featureDef?.bonus.populationBonus) {
          bodyCeiling *= (1 + featureDef.bonus.populationBonus);
        }
      }

      // Each slot adds to ceiling
      bodyCeiling *= (body.surfaceSlots + body.orbitalSlots);

      ceiling += bodyCeiling;

      // Calculate floor from facilities
      for (const facilityId of body.facilityIds) {
        const facility = state.facilities[facilityId];
        if (!facility || !facility.operational) continue;

        const facilityDef = FACILITY_DEFINITIONS[facility.definitionId];
        if (facilityDef) {
          floor += facilityDef.populationFloor;
        }
      }
    }

    return { floor, ceiling: Math.round(ceiling) };
  }

  /**
   * Calculate overall standard of living
   */
  private calculateStandardOfLiving(system: StarSystem, solFromConsumption: number): number {
    const state = this.gameState.getState();
    let sol = solFromConsumption;

    // Tech level bonus
    sol += system.techLevel * 2;

    // Security level bonus
    sol += system.securityLevel * 3;

    // Facility bonuses (tourism, etc.)
    for (const bodyId of system.bodyIds) {
      const body = state.bodies[bodyId];
      if (!body) continue;

      for (const facilityId of body.facilityIds) {
        const facility = state.facilities[facilityId];
        if (!facility || !facility.operational) continue;

        const facilityDef = FACILITY_DEFINITIONS[facility.definitionId];
        if (facilityDef?.bonuses?.solBonus) {
          sol += facilityDef.bonuses.solBonus * 100;
        }
      }
    }

    // State effects
    const stateDefinition = SYSTEM_STATE_DEFINITIONS[system.state];
    if (stateDefinition.effects.securityModifier) {
      sol += stateDefinition.effects.securityModifier * 10;
    }

    return Math.max(0, Math.min(100, sol));
  }

  /**
   * Calculate population drift towards equilibrium
   */
  private calculatePopulationDrift(
    currentPop: number,
    floor: number,
    ceiling: number,
    sol: number,
    systemState: SystemState,
    deltaHours: number
  ): number {
    // Determine target based on SoL
    // At 50 SoL, target is midpoint between floor and ceiling
    // Higher SoL pushes towards ceiling, lower towards floor
    const solFactor = (sol - 50) / 50; // -1 to 1
    const midpoint = (floor + ceiling) / 2;
    const range = (ceiling - floor) / 2;
    const target = midpoint + (range * solFactor);

    // Calculate drift rate
    const stateDefinition = SYSTEM_STATE_DEFINITIONS[systemState];
    let driftRate = 0.01; // Base 1% per hour towards target

    if (stateDefinition.effects.populationGrowth) {
      driftRate += stateDefinition.effects.populationGrowth;
    }

    // Calculate change
    const diff = target - currentPop;
    const change = diff * driftRate * deltaHours;

    return change;
  }

  /**
   * Check for state changes based on conditions
   */
  private checkSystemStateChanges(system: StarSystem, consumed: Record<ResourceId, number>): void {
    // Check for famine
    const foodNeeded = (system.totalPopulation / 1000) * CONSUMPTION_RATES[ResourceId.PreparedFoods];
    const foodConsumed = consumed[ResourceId.PreparedFoods] ?? 0;

    if (foodConsumed < foodNeeded * 0.5 && system.state === SystemState.Stable) {
      // Severe food shortage - enter famine
      this.gameState.updateSystem(system.id, { state: SystemState.Famine });
      this.gameState.addNotification({
        type: 'danger',
        title: 'Famine!',
        message: `${system.name} is experiencing a severe food shortage.`,
        systemId: system.id
      });
    } else if (system.state === SystemState.Famine && foodConsumed >= foodNeeded * 0.8) {
      // Recovered from famine
      this.gameState.updateSystem(system.id, { state: SystemState.Stable });
      this.gameState.addNotification({
        type: 'success',
        title: 'Famine Ended',
        message: `${system.name} has recovered from famine.`,
        systemId: system.id
      });
    }

    // Check for rioting (low security + low SoL)
    if (system.securityLevel < 2 && system.standardOfLiving < 30 && system.state === SystemState.Stable) {
      this.gameState.updateSystem(system.id, { state: SystemState.Rioting });
      this.gameState.addNotification({
        type: 'warning',
        title: 'Rioting!',
        message: `Civil unrest has broken out in ${system.name}.`,
        systemId: system.id
      });
    }

    // Check for prosperity (high SoL sustained)
    if (system.standardOfLiving > 70 && system.state === SystemState.Stable) {
      this.gameState.updateSystem(system.id, { state: SystemState.Prosperous });
      this.gameState.addNotification({
        type: 'success',
        title: 'Prosperity!',
        message: `${system.name} is now prosperous.`,
        systemId: system.id
      });
    }
  }

  /**
   * Get consumption summary for UI
   */
  getConsumptionSummary(systemId: string): {
    resource: ResourceId;
    name: string;
    needed: number;
    available: number;
    status: 'ok' | 'warning' | 'critical';
  }[] {
    const system = this.gameState.getSystem(systemId);
    if (!system) return [];

    const popThousands = system.totalPopulation / 1000;
    const summary = [];

    for (const [resourceId, rate] of Object.entries(CONSUMPTION_RATES)) {
      const needed = rate * popThousands; // per hour
      const available = this.gameState.getSystemResource(systemId, resourceId as ResourceId);

      let status: 'ok' | 'warning' | 'critical' = 'ok';
      if (available < needed) {
        status = 'critical';
      } else if (available < needed * 10) { // Less than 10 hours supply
        status = 'warning';
      }

      summary.push({
        resource: resourceId as ResourceId,
        name: resourceId,
        needed,
        available,
        status
      });
    }

    return summary;
  }
}
