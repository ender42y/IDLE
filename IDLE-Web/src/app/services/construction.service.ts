import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import {
  Facility,
  FacilityId,
  FacilityDefinition,
  FACILITY_DEFINITIONS,
  SlotType
} from '../models/facility.model';
import { ResourceId, RESOURCE_DEFINITIONS } from '../models/resource.model';
import { CelestialBody, BodyType, BodyFeature } from '../models/celestial-body.model';
import { calculateConstructionCostMultiplier, getDistanceFromHome } from '../models/star-system.model';

export interface ConstructionCost {
  credits: number;
  resources: { resourceId: ResourceId; name: string; amount: number; available: number }[];
  canAfford: boolean;
  multiplier: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConstructionService {
  private gameState = inject(GameStateService);

  /**
   * Get the cost to build a facility at a specific body
   */
  getConstructionCost(facilityId: FacilityId, bodyId: string): ConstructionCost | null {
    const state = this.gameState.getState();
    const body = state.bodies[bodyId];
    const system = body ? state.systems[body.systemId] : null;
    const definition = FACILITY_DEFINITIONS[facilityId];

    if (!body || !system || !definition) return null;

    // Calculate multiplier
    const distance = getDistanceFromHome(system.coordinates);
    const facilityCount = Object.values(state.facilities).filter(
      f => state.bodies[f.bodyId]?.systemId === system.id
    ).length;
    const multiplier = calculateConstructionCostMultiplier(distance, facilityCount);

    // Calculate costs
    const creditCost = Math.ceil(definition.baseCost.credits * multiplier);
    const resourceCosts = definition.baseCost.resources.map(r => {
      const resourceDef = RESOURCE_DEFINITIONS[r.resourceId];
      const available = this.gameState.getSystemResource(system.id, r.resourceId);
      return {
        resourceId: r.resourceId,
        name: resourceDef?.name ?? r.resourceId,
        amount: Math.ceil(r.amount * multiplier),
        available
      };
    });

    // Check affordability
    const canAffordCredits = state.credits >= creditCost;
    const canAffordResources = resourceCosts.every(r => r.available >= r.amount);

    return {
      credits: creditCost,
      resources: resourceCosts,
      canAfford: canAffordCredits && canAffordResources,
      multiplier
    };
  }

  /**
   * Get available facilities that can be built on a body
   */
  getAvailableFacilities(bodyId: string): { facility: FacilityDefinition; canBuild: boolean; reason?: string }[] {
    const state = this.gameState.getState();
    const body = state.bodies[bodyId];

    if (!body) return [];

    const available: { facility: FacilityDefinition; canBuild: boolean; reason?: string }[] = [];

    for (const [id, def] of Object.entries(FACILITY_DEFINITIONS)) {
      const result = this.canBuildFacility(id as FacilityId, bodyId);
      available.push({
        facility: def,
        canBuild: result.canBuild,
        reason: result.reason
      });
    }

    return available.filter(a => a.canBuild || a.reason !== 'Wrong slot type');
  }

  /**
   * Check if a facility can be built on a body
   */
  canBuildFacility(facilityId: FacilityId, bodyId: string): { canBuild: boolean; reason?: string } {
    const state = this.gameState.getState();
    const body = state.bodies[bodyId];
    const definition = FACILITY_DEFINITIONS[facilityId];

    if (!body || !definition) {
      return { canBuild: false, reason: 'Invalid body or facility' };
    }

    // Check slot type compatibility
    const slotType = definition.slotType;
    if (slotType === 'surface' && body.surfaceSlots === 0) {
      return { canBuild: false, reason: 'Wrong slot type' };
    }
    if (slotType === 'orbital' && body.orbitalSlots === 0) {
      return { canBuild: false, reason: 'Wrong slot type' };
    }

    // Check available slots
    if (slotType === 'surface' && body.usedSurfaceSlots >= body.surfaceSlots) {
      return { canBuild: false, reason: 'No surface slots available' };
    }
    if (slotType === 'orbital' && body.usedOrbitalSlots >= body.orbitalSlots) {
      return { canBuild: false, reason: 'No orbital slots available' };
    }

    // Check body type restrictions for certain facilities
    if (definition.production) {
      const output = definition.production.output;

      // Check for required features
      if (output === ResourceId.RareEarthOre) {
        if (!body.features.includes(BodyFeature.RareElementDeposits)) {
          return { canBuild: false, reason: 'Requires Rare Element Deposits' };
        }
      }
      if (output === ResourceId.ExoticGases) {
        if (!body.features.includes(BodyFeature.ExoticAtmosphere)) {
          return { canBuild: false, reason: 'Requires Exotic Atmosphere' };
        }
      }
      if (output === ResourceId.Ice) {
        if (!body.features.includes(BodyFeature.IceDeposits) &&
            body.type !== BodyType.IcyMoon) {
          return { canBuild: false, reason: 'Requires Ice Deposits' };
        }
      }
      if (output === ResourceId.AtmosphericGases) {
        if (body.type !== BodyType.GasGiant) {
          return { canBuild: false, reason: 'Requires Gas Giant' };
        }
      }
      if (output === ResourceId.Organics || output === ResourceId.Livestock) {
        if (body.type !== BodyType.TerraformablePlanet) {
          return { canBuild: false, reason: 'Requires Terraformable Planet' };
        }
      }
    }

    // Check survey status
    if (!body.surveyed) {
      return { canBuild: false, reason: 'Body must be surveyed first' };
    }

    return { canBuild: true };
  }

  /**
   * Build a facility on a body
   */
  buildFacility(facilityId: FacilityId, bodyId: string): boolean {
    const state = this.gameState.getState();
    const body = state.bodies[bodyId];
    const system = body ? state.systems[body.systemId] : null;
    const definition = FACILITY_DEFINITIONS[facilityId];

    if (!body || !system || !definition) return false;

    // Check if can build
    const canBuild = this.canBuildFacility(facilityId, bodyId);
    if (!canBuild.canBuild) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Cannot Build',
        message: canBuild.reason ?? 'Unknown reason'
      });
      return false;
    }

    // Get and validate cost
    const cost = this.getConstructionCost(facilityId, bodyId);
    if (!cost || !cost.canAfford) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Insufficient Resources',
        message: 'Cannot afford construction costs.'
      });
      return false;
    }

    // Spend credits first
    if (!this.gameState.spendCredits(cost.credits)) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Insufficient Credits',
        message: 'Not enough credits to begin construction.'
      });
      return false;
    }

    // Spend resources transactionally - if any removal fails, rollback credits and any removed resources
    const removed: { resourceId: ResourceId; amount: number }[] = [];
    for (const resource of cost.resources) {
      const ok = this.gameState.removeResourceFromSystem(system.id, resource.resourceId, resource.amount);
      if (!ok) {
        // rollback previously removed resources
        for (const r of removed) {
          this.gameState.addResourceToSystem(system.id, r.resourceId, r.amount);
        }
        // refund credits
        this.gameState.addCredits(cost.credits);
        this.gameState.addNotification({
          type: 'warning',
          title: 'Insufficient Resources',
          message: 'Failed to remove required resources for construction. Transaction rolled back.'
        });
        return false;
      }
      removed.push({ resourceId: resource.resourceId, amount: resource.amount });
    }

    // Create facility
    const facility: Facility = {
      id: this.gameState.generateId(),
      definitionId: facilityId,
      bodyId,
      level: 1,
      condition: 100,
      operational: true
    };

    this.gameState.addFacility(facility);

    // Update body slot usage
    if (definition.slotType === 'surface') {
      this.gameState.updateBody(bodyId, {
        usedSurfaceSlots: body.usedSurfaceSlots + 1,
        facilityIds: [...body.facilityIds, facility.id]
      });
    } else if (definition.slotType === 'orbital') {
      this.gameState.updateBody(bodyId, {
        usedOrbitalSlots: body.usedOrbitalSlots + 1,
        facilityIds: [...body.facilityIds, facility.id]
      });
    }

    // Update stats
    this.gameState.incrementStat('facilitiesBuilt');

    // Check if this adds a trade station
    if (facilityId === FacilityId.TradeOutpost ||
        facilityId === FacilityId.TradeStation ||
        facilityId === FacilityId.TradeHub) {
      const tier = facilityId === FacilityId.TradeHub ? 3 :
                   facilityId === FacilityId.TradeStation ? 2 : 1;
      if (tier > system.tradeStationTier) {
        // Update trade station flags
        this.gameState.updateSystem(system.id, {
          hasTradeStation: true,
          tradeStationTier: tier
        });

        // Increase resource capacity on the system so the new trade facility can hold more goods
        const state = this.gameState.getState();
        const sys = state.systems[system.id];
        if (sys && Array.isArray(sys.resources) && sys.resources.length > 0) {
          const extra = 5000 * tier; // arbitrary additional capacity per tier
          const newResources = sys.resources.map(r => ({ ...r, capacity: (r.capacity ?? 0) + extra }));
          this.gameState.updateSystem(system.id, { resources: newResources });
        }
      }
    }

    // Notification
    this.gameState.addNotification({
      type: 'success',
      title: 'Construction Complete',
      message: `${definition.name} built on ${body.name}.`,
      systemId: system.id
    });

    return true;
  }

  /**
   * Demolish a facility
   */
  demolishFacility(facilityId: string): boolean {
    const state = this.gameState.getState();
    const facility = state.facilities[facilityId];

    if (!facility) return false;

    const body = state.bodies[facility.bodyId];
    const definition = FACILITY_DEFINITIONS[facility.definitionId];

    if (!body || !definition) return false;

    // Remove from body
    const newFacilityIds = body.facilityIds.filter(id => id !== facilityId);
    const slotUpdate = definition.slotType === 'surface'
      ? { usedSurfaceSlots: body.usedSurfaceSlots - 1 }
      : { usedOrbitalSlots: body.usedOrbitalSlots - 1 };

    this.gameState.updateBody(body.id, {
      ...slotUpdate,
      facilityIds: newFacilityIds
    });

    // Remove facility
    this.gameState.removeFacility(facilityId);

    // Check if we need to update trade station tier
    const system = state.systems[body.systemId];
    if (system && (facility.definitionId === FacilityId.TradeOutpost ||
                   facility.definitionId === FacilityId.TradeStation ||
                   facility.definitionId === FacilityId.TradeHub)) {
      this.recalculateTradeStationTier(system.id);
    }

    this.gameState.addNotification({
      type: 'info',
      title: 'Facility Demolished',
      message: `${definition.name} on ${body.name} has been demolished.`
    });

    return true;
  }

  /**
   * Recalculate trade station tier for a system
   */
  private recalculateTradeStationTier(systemId: string): void {
    const state = this.gameState.getState();
    const system = state.systems[systemId];
    if (!system) return;

    let maxTier = 0;
    for (const bodyId of system.bodyIds) {
      const body = state.bodies[bodyId];
      if (!body) continue;

      for (const facilityId of body.facilityIds) {
        const facility = state.facilities[facilityId];
        if (!facility) continue;

        if (facility.definitionId === FacilityId.TradeHub) maxTier = Math.max(maxTier, 3);
        else if (facility.definitionId === FacilityId.TradeStation) maxTier = Math.max(maxTier, 2);
        else if (facility.definitionId === FacilityId.TradeOutpost) maxTier = Math.max(maxTier, 1);
      }
    }

    this.gameState.updateSystem(systemId, {
      hasTradeStation: maxTier > 0,
      tradeStationTier: maxTier
    });
  }
}
