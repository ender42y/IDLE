import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import { ResourceId } from '../models/resource.model';
import { StarSystem, SYSTEM_STATE_DEFINITIONS, SystemState } from '../models/star-system.model';
import { CelestialBody, BODY_TYPE_DEFINITIONS, BodyFeature, FEATURE_DEFINITIONS } from '../models/celestial-body.model';
import { FACILITY_DEFINITIONS } from '../models/facility.model';

// Population consumption rates per 1000 population per hour (GDD v6 Section 10.8)
const CONSUMPTION_RATES = {
  [ResourceId.PreparedFoods]: 1,    // 1 t/h per 1000 pop
  [ResourceId.PurifiedWater]: 0.5,  // 0.5 t/h per 1000 pop
  [ResourceId.BasicGoods]: 0.2      // 0.2 t/h per 1000 pop
};

// Optional consumption for higher SoL and pull factors (GDD v6 Section 10.7)
const OPTIONAL_CONSUMPTION = {
  [ResourceId.QualityFoods]: { rate: 0.3, solBonus: 10, pullFactor: 0.2 },
  [ResourceId.ComfortGoods]: { rate: 0.15, solBonus: 15, pullFactor: 0.2 },
  [ResourceId.GourmetFoods]: { rate: 0.1, solBonus: 20, pullFactor: 0.3 },
  [ResourceId.LuxuryGoods]: { rate: 0.05, solBonus: 25, pullFactor: 0.3 }
};

// GDD v6 Section 10.6: Base growth rate (people per second)
const BASE_GROWTH_RATE = 5;

/**
 * Manages population growth, consumption, and standard of living across all systems.
 * Implements the GDD v6 population model with floor/ceiling constraints, pull factors,
 * and resource consumption requirements.
 *
 * Population Model (GDD v6):
 * - Floor: Minimum workers needed (sum of facility populationFloor values)
 * - Ceiling: Maximum capacity (sum of facility populationCeiling × body multiplier)
 * - Current population drifts toward ceiling based on pull factors
 * - Population CANNOT fall below floor (enforced minimum)
 *
 * Growth Formula (GDD v6 Section 10.6):
 * growth_per_second = BASE_GROWTH_RATE × net_pull_factor × (1 - current/ceiling)²
 *
 * Pull Factors (GDD v6 Section 10.7):
 * Positive: High SoL (+0.2), security (+0.1), medical facilities (+0.1), quality goods
 * Negative: Food scarcity (-0.3), low SoL (-0.2)
 * Special: Below floor (+0.2), far below ceiling (+0.1)
 *
 * Resource Consumption (GDD v6 Section 10.8):
 * Required (per 1000 pop/hour):
 * - Prepared Foods: 1.0 t/h
 * - Purified Water: 0.5 t/h
 * - Basic Goods: 0.2 t/h
 *
 * Optional (boosts SoL and pull factor):
 * - Quality Foods: +10 SoL, +0.2 pull
 * - Comfort Goods: +15 SoL, +0.2 pull
 * - Gourmet Foods: +20 SoL, +0.3 pull
 * - Luxury Goods: +25 SoL, +0.3 pull
 *
 * Standard of Living (0-100):
 * Base 50 + consumption fulfillment + tech bonuses + security + facility bonuses
 * Shortages reduce SoL, which reduces pull factor and can trigger system states (Famine, Rioting)
 *
 * Production Bonus (GDD v6 Section 10.9):
 * production_multiplier = 1 + log10(population / 1000)
 * Examples: 1K=1.0×, 10K=2.0×, 100K=3.0×, 1M=4.0×
 *
 * @see calculatePopulationLimits for floor/ceiling calculation
 * @see calculatePopulationDrift for growth formula implementation
 * @see getPopulationProductionBonus for production multiplier
 */
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

      // Calculate net pull factor (GDD v6 Section 10.7)
      const netPullFactor = this.calculateNetPullFactor(system, consumed, floor, ceiling, deltaHours);

      // Calculate population drift using GDD v6 formula
      const populationChange = this.calculatePopulationDrift(
        system.totalPopulation,
        floor,
        ceiling,
        standardOfLiving,
        system.state,
        deltaHours,
        netPullFactor
      );

      // Update system
      const newPopulation = Math.max(floor, Math.min(ceiling, system.totalPopulation + populationChange));

      this.gameState.updateSystem(system.id, {
        totalPopulation: Math.round(newPopulation),
        standardOfLiving: Math.round(standardOfLiving)
      });

      // Distribute population to bodies proportional to their population ceiling (GDD v6: population distributed by capacity)
      this.distributePopulationToBodies(system.id, Math.round(newPopulation));

      // Check for state changes based on conditions (pass deltaHours so comparisons use the same time basis)
      this.checkSystemStateChanges(system, consumed, deltaHours);
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
   * Calculate population floor and ceiling for a system (GDD v6 Section 10.2-10.5)
   * Floor = Sum of all facility floor values
   * Ceiling = Sum of (each facility's ceiling × body type multiplier)
   */
  calculatePopulationLimits(system: StarSystem): { floor: number; ceiling: number } {
    const state = this.gameState.getState();
    let floor = 0;
    let ceiling = 0;

    for (const bodyId of system.bodyIds) {
      const body = state.bodies[bodyId];
      if (!body) continue;

      const bodyTypeDef = BODY_TYPE_DEFINITIONS[body.type];
      const bodyMultiplier = bodyTypeDef.populationMultiplier;

      // Calculate floor and ceiling from facilities on this body
      for (const facilityId of body.facilityIds) {
        const facility = state.facilities[facilityId];
        if (!facility || !facility.operational) continue;

        const facilityDef = FACILITY_DEFINITIONS[facility.definitionId];
        if (facilityDef) {
          // Floor is summed directly
          floor += facilityDef.populationFloor;

          // Ceiling is multiplied by body type multiplier (GDD v6 Section 10.5)
          ceiling += facilityDef.populationCeiling * bodyMultiplier;
        }
      }

      // Apply feature bonuses to ceiling (e.g., Habitable adds 50% bonus)
      for (const feature of body.features) {
        const featureDef = FEATURE_DEFINITIONS[feature];
        if (featureDef?.bonus.populationBonus) {
          // Feature bonus applies to the body's contribution
          const facilityCount = body.facilityIds.length;
          if (facilityCount > 0) {
            ceiling *= (1 + featureDef.bonus.populationBonus);
          }
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
   * Calculate net pull factor for population growth (GDD v6 Section 10.7)
   */
  private calculateNetPullFactor(
    system: StarSystem,
    consumed: Record<ResourceId, number>,
    floor: number,
    ceiling: number,
    deltaHours: number
  ): number {
    let pullFactor = 0;

    // Base SoL factors
    if (system.standardOfLiving >= 70) pullFactor += 0.2;
    else if (system.standardOfLiving >= 50) pullFactor += 0.1;
    else if (system.standardOfLiving < 30) pullFactor -= 0.2;

    // Security bonus
    if (system.securityLevel >= 2) pullFactor += 0.1;

    // Medical facilities would add here (check for medical lab)
    const state = this.gameState.getState();
    for (const bodyId of system.bodyIds) {
      const body = state.bodies[bodyId];
      if (!body) continue;
      for (const facilityId of body.facilityIds) {
        const facility = state.facilities[facilityId];
        if (facility?.definitionId === 'medical_lab' || facility?.definitionId === 'pharmaceutical_plant') {
          pullFactor += 0.1;
          break; // Only count once per system
        }
      }
    }

    // Optional consumption bonuses (quality food, comfort goods, etc.)
    for (const [resourceId, config] of Object.entries(OPTIONAL_CONSUMPTION)) {
      const consumedAmount = consumed[resourceId as ResourceId] ?? 0;
      if (consumedAmount > 0) {
        pullFactor += config.pullFactor;
      }
    }

    // Food scarcity penalty
    const popThousands = system.totalPopulation / 1000;
    const foodNeeded = CONSUMPTION_RATES[ResourceId.PreparedFoods] * popThousands * deltaHours;
    const foodConsumed = consumed[ResourceId.PreparedFoods] ?? 0;
    if (foodConsumed < foodNeeded * 0.8) {
      pullFactor -= 0.3; // Food scarcity
    }

    // Capacity gap bonus (pulls up when far below ceiling)
    if (system.totalPopulation < ceiling * 0.5) {
      pullFactor += 0.1;
    }

    // Floor demand (workers needed)
    if (system.totalPopulation < floor) {
      pullFactor += 0.2;
    }

    // System state effects
    const stateDefinition = SYSTEM_STATE_DEFINITIONS[system.state];
    if (stateDefinition.effects.populationGrowth) {
      pullFactor += stateDefinition.effects.populationGrowth;
    }

    return pullFactor;
  }

  /**
   * Calculate population growth using GDD v6 formula (Section 10.6)
   * growth_per_second = base_rate * net_pull_factor * (1 - current/ceiling)^2
   */
  private calculatePopulationDrift(
    currentPop: number,
    floor: number,
    ceiling: number,
    sol: number,
    systemState: SystemState,
    deltaHours: number,
    netPullFactor: number
  ): number {
    if (ceiling <= 0) return 0;

    // GDD v6 Formula: growth_per_second = base_rate * net_pull_factor * (1 - current/ceiling)^2
    const ceilingRatio = Math.min(1, currentPop / ceiling);
    const capacityDampening = Math.pow(1 - ceilingRatio, 2);

    // Growth per second
    const growthPerSecond = BASE_GROWTH_RATE * netPullFactor * capacityDampening;

    // Convert to change over deltaHours
    const deltaSeconds = deltaHours * 3600;
    let change = growthPerSecond * deltaSeconds;

    // Ensure population doesn't drop below floor (GDD v6: population cannot fall below floor)
    if (currentPop + change < floor) {
      change = floor - currentPop;
    }

    return change;
  }

  /**
   * Check for state changes based on conditions
   */
  private checkSystemStateChanges(system: StarSystem, consumed: Record<ResourceId, number>, deltaHours: number): void {
    // Check for famine
    // foodNeededPerHour is the required food in t/h; scale by deltaHours to get the amount
    // that should have been consumed during this tick (same units as `consumed` values)
    const foodNeededPerHour = (system.totalPopulation / 1000) * CONSUMPTION_RATES[ResourceId.PreparedFoods];
    const foodNeeded = foodNeededPerHour * deltaHours;
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
   * Get population production bonus multiplier (GDD v6 Section 10.9)
   * production_multiplier = 1 + log10(system_population / 1000)
   *
   * System Population | Multiplier
   * 1,000            | 1.0x
   * 10,000           | 2.0x
   * 100,000          | 3.0x
   * 1,000,000        | 4.0x
   * 10,000,000       | 5.0x
   */
  getPopulationProductionBonus(systemId: string): number {
    const system = this.gameState.getSystem(systemId);
    if (!system || system.totalPopulation < 1000) {
      return 1.0; // No bonus below 1000 population
    }

    return 1 + Math.log10(system.totalPopulation / 1000);
  }

  /**
   * Distribute system population to individual bodies proportional to their ceiling capacity
   * (GDD v6: population distributed by capacity - bodies with higher capacity get more population)
   */
  private distributePopulationToBodies(systemId: string, totalPopulation: number): void {
    const state = this.gameState.getState();
    const system = state.systems[systemId];
    if (!system) return;

    // Calculate total ceiling capacity across all bodies
    let totalCeiling = 0;
    const bodyPopulationCeilings: Record<string, number> = {};

    for (const bodyId of system.bodyIds) {
      const body = state.bodies[bodyId];
      if (!body) continue;

      const bodyTypeDef = BODY_TYPE_DEFINITIONS[body.type];
      const bodyMultiplier = bodyTypeDef.populationMultiplier;

      let bodyCeiling = 0;
      // Sum facility ceilings for this body
      for (const facilityId of body.facilityIds) {
        const facility = state.facilities[facilityId];
        if (!facility || !facility.operational) continue;

        const facilityDef = FACILITY_DEFINITIONS[facility.definitionId];
        if (facilityDef) {
          bodyCeiling += facilityDef.populationCeiling * bodyMultiplier;
        }
      }

      // Apply feature bonuses to ceiling
      for (const feature of body.features) {
        const featureDef = FEATURE_DEFINITIONS[feature];
        if (featureDef?.bonus.populationBonus && bodyCeiling > 0) {
          bodyCeiling *= (1 + featureDef.bonus.populationBonus);
        }
      }

      bodyPopulationCeilings[bodyId] = bodyCeiling;
      totalCeiling += bodyCeiling;
    }

    // Distribute population proportional to each body's ceiling capacity
    if (totalCeiling > 0) {
      for (const bodyId of system.bodyIds) {
        const bodyCeiling = bodyPopulationCeilings[bodyId];
        if (bodyCeiling > 0) {
          const bodyPopulation = Math.round((bodyCeiling / totalCeiling) * totalPopulation);
          this.gameState.updateBody(bodyId, { population: bodyPopulation });
        }
      }
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
