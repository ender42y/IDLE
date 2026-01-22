import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import { GalaxyGeneratorService } from './galaxy-generator.service';
import { PrestigeService } from './prestige.service';
import {
  Ship,
  ShipType,
  ShipStatus,
  ScoutMission,
  calculateTravelTime
} from '../models/ship.model';
import { ResourceId } from '../models/resource.model';
import { getDistanceFromHome, getRouteDist, SystemRarity } from '../models/star-system.model';
import { TESTING_CONFIG } from '../config/testing.config';

/**
 * Manages scout missions that discover and survey new star systems.
 * Handles mission lifecycle from launch to completion, including automatic
 * system generation and surveying (GDD v6: scouts auto-survey on discovery).
 *
 * Scout Mission Lifecycle:
 * 1. Launch: Scout departs with fuel reserved for round trip
 * 2. Outbound: Ship travels to target coordinates
 * 3. Exploring: Ship scans area, generates new system if found
 * 4. Auto-Survey: GDD v6 - scouts now survey all bodies automatically upon discovery
 * 5. Returning: Ship returns to origin with exploration data
 * 6. Complete: Ship arrives, data integrated, ship becomes Idle
 *
 * Mission States:
 * - outbound: Flying to exploration target
 * - exploring: At target, scanning and generating system
 * - returning: Flying back to origin system
 * - completed: Mission finished, ship can be reassigned
 *
 * GDD v6 Changes:
 * - Scouts now automatically survey ALL bodies upon system discovery
 * - Removed separate survey step (was manual in v5)
 * - surveyComplete flag set to true when system generated
 * - All bodies in discovered system marked surveyed immediately
 *
 * Fuel Management:
 * - Fuel cost calculated for round trip: distance × 2
 * - Fuel consumed upfront before launch
 * - If insufficient fuel, mission launch fails
 * - No mid-mission refueling (different from trade/colonization)
 *
 * Discovery Mechanics:
 * - First non-home discovery boosted (Rare system, +3 bodies)
 * - Target coordinates calculated from origin + direction + scout range
 * - Frontier direction algorithm finds least-explored areas
 * - Can be recalled mid-mission (returns immediately from current position)
 *
 * TESTING Values:
 * - Scout speed multiplied by 20× for faster testing (line 111)
 * - Production scout speed: 300 ly/h, testing: 6000 ly/h
 *
 * @see launchScoutMission for starting new exploration
 * @see cancelScoutMission for recalling scouts mid-flight
 * @see getExplorationDirections for suggested exploration vectors
 */
@Injectable({
  providedIn: 'root'
})
export class ExplorationService {
  private gameState = inject(GameStateService);
  private galaxyGenerator = inject(GalaxyGeneratorService);
  private prestigeService = inject(PrestigeService);

  /**
   * Process exploration missions
   */
  processTick(deltaMs: number): void {
    const state = this.gameState.getState();
    const now = Date.now();

    for (const mission of Object.values(state.scoutMissions)) {
      this.updateMission(mission, now);
    }
  }

  /**
   * Process missions that completed while offline
   */
  processOfflineMissions(offlineMs: number): void {
    const state = this.gameState.getState();
    const now = Date.now();

    for (const mission of Object.values(state.scoutMissions)) {
      this.updateMission(mission, now);
    }
  }

  /**
   * Send a scout ship to discover a new system
   */
  launchScoutMission(shipId: string, direction?: { x: number; y: number }): boolean {
    const state = this.gameState.getState();
    const ship = state.ships[shipId];

    if (!ship || ship.type !== ShipType.Scout) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Invalid Ship',
        message: 'Only scout ships can explore.'
      });
      return false;
    }

    if (ship.status !== ShipStatus.Idle) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Ship Busy',
        message: `${ship.name} is not available.`
      });
      return false;
    }

    const originSystem = state.systems[ship.currentSystemId];
    if (!originSystem) return false;

    // Calculate target coordinates
    const scoutRange = (ship.scoutRange ?? 10) * (ship.rangeModifier ?? 1);
    let targetCoords: { x: number; y: number };

    if (direction) {
      // Normalize and scale direction
      const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
      if (magnitude === 0) {
        targetCoords = this.getNextFrontierPoint(originSystem.coordinates, scoutRange);
      } else {
        targetCoords = {
          x: originSystem.coordinates.x + (direction.x / magnitude) * scoutRange,
          y: originSystem.coordinates.y + (direction.y / magnitude) * scoutRange
        };
      }
    } else {
      targetCoords = this.getNextFrontierPoint(originSystem.coordinates, scoutRange);
    }

    // Calculate fuel needed
    const distance = getRouteDist(originSystem.coordinates, targetCoords);
    const fuelNeeded = distance * 2; // Round trip, simple calculation

    const fuelAvailable = this.gameState.getSystemResource(originSystem.id, ResourceId.Fuel);
    if (fuelAvailable < fuelNeeded) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Insufficient Fuel',
        message: `Need ${fuelNeeded.toFixed(1)} fuel for this mission.`
      });
      return false;
    }

    // Consume fuel
    this.gameState.removeResourceFromSystem(originSystem.id, ResourceId.Fuel, fuelNeeded);

    // Calculate timing based on distance and ship speed
    // With 300 ly/h and 1 min exploration, first 10ly mission = ~5 min
    const prestigeSpeedModifier = this.prestigeService.getShipSpeedModifier();
    const scoutSpeed = ((ship.scoutSpeed ?? 300) * (ship.speedModifier ?? 1) * prestigeSpeedModifier) * TESTING_CONFIG.scoutSpeedMultiplier;
    const outboundTimeHours = distance / scoutSpeed;

    const explorationTimeHours = 1 / 60; // 1 minute to explore
    const returnTimeHours = distance / scoutSpeed;
    const totalTimeHours = outboundTimeHours + explorationTimeHours + returnTimeHours;

    const now = Date.now();
    const outboundArrival = now + (outboundTimeHours * 60 * 60 * 1000);
    const explorationComplete = outboundArrival + (explorationTimeHours * 60 * 60 * 1000);
    const returnTime = now + (totalTimeHours * 60 * 60 * 1000);

    // Create mission (store explorationComplete so we wait while exploring)
    // GDD v6: Scouts auto-survey upon discovery - surveyComplete starts false
    const mission: ScoutMission = {
      id: this.gameState.generateId(),
      shipId,
      originSystemId: originSystem.id,
      targetCoordinates: targetCoords,
      startTime: now,
      estimatedArrival: outboundArrival,
      explorationComplete: explorationComplete,
      returnTime,
      status: 'outbound',
      surveyComplete: false
    };

    this.gameState.addScoutMission(mission);

    // Update ship
    this.gameState.updateShip(shipId, {
      status: ShipStatus.Scouting,
      missionId: mission.id,
      departureTime: now,
      arrivalTime: returnTime
    });

    this.gameState.addNotification({
      type: 'info',
      title: 'Scout Launched',
      message: `${ship.name} departing for exploration. ETA: ${this.formatHours(totalTimeHours)}`
    });

    return true;
  }

  /**
   * Cancel / recall a scout mission — ship will start returning immediately.
   */
  cancelScoutMission(missionId: string): boolean {
    const state = this.gameState.getState();
    const mission = state.scoutMissions[missionId];
    if (!mission) return false;

    const ship = state.ships[mission.shipId];
    if (!ship) return false;

    const now = Date.now();

    // If already returning or completed, nothing to do
    if (mission.status === 'returning' || mission.status === 'completed') return false;

    // Compute new returnTime based on current status
    let newReturnTime = mission.returnTime;

    if (mission.status === 'outbound') {
      // Ship is mid-outbound. Time spent outbound = now - startTime
      const timeSpent = Math.max(0, now - (mission.startTime ?? now));
      // Time to fly back equals time spent so far (assuming same speed)
      newReturnTime = now + timeSpent;
    } else if (mission.status === 'exploring') {
      // Ship is at target and exploring. Need to compute just the return travel time.
      const explorationCompleteTime = mission.explorationComplete ?? ((mission.estimatedArrival ?? now) + (1 * 60 * 1000));
      const originalReturnTravel = Math.max(0, (mission.returnTime ?? explorationCompleteTime) - explorationCompleteTime);
      newReturnTime = now + originalReturnTravel;
    }

    // Update mission and ship
    this.gameState.updateScoutMission(missionId, {
      status: 'returning',
      returnTime: newReturnTime
    });

    this.gameState.updateShip(mission.shipId, {
      status: ShipStatus.Scouting,
      arrivalTime: newReturnTime
    });

    this.gameState.addNotification({
      type: 'info',
      title: 'Mission Recalled',
      message: `Mission recalled: ${ship.name} is returning to ${state.systems[mission.originSystemId]?.name ?? 'origin'}.`
    });

    return true;
  }

  // GDD v6: startSurvey() removed - scouts now auto-survey upon discovery

  /**
   * Update mission status
   */
  private updateMission(mission: ScoutMission, now: number): void {
    const state = this.gameState.getState();
    const ship = state.ships[mission.shipId];

    if (!ship) {
      this.gameState.removeScoutMission(mission.id);
      return;
    }

    switch (mission.status) {
      case 'outbound':
        if (now >= mission.estimatedArrival) {
          // Arrived at exploration target
          this.gameState.updateScoutMission(mission.id, { status: 'exploring' });
        }
        break;

      case 'exploring':
        // Wait until explorationComplete before generating system
        if (mission.explorationComplete && now >= mission.explorationComplete) {
          // Generate new system if not already done
            if (!mission.discoveredSystemId && mission.targetCoordinates) {
            // If this is the first discovered non-home system, boost rarity and bodies
            const discoveredCount = this.gameState.discoveredSystems().length;
            const isFirstDiscovery = discoveredCount <= 1; // only 'Sol' exists initially

            const newSystem = this.galaxyGenerator.generateSystem(mission.targetCoordinates, isFirstDiscovery ? { forceRarity: SystemRarity.Rare, increaseBodiesBy: 3 } : undefined);
            this.gameState.addSystem(newSystem);

            // Mark new system as surveyed since the scout just scanned it
            this.gameState.updateSystem(newSystem.id, {
              surveyed: true,
              surveyedAt: Date.now(),
              surveyProgress: 100
            });

            // Mark all bodies in the new system as surveyed
            for (const bodyId of newSystem.bodyIds) {
              this.gameState.updateBody(bodyId, {
                surveyed: true
              });
            }

            // Set mission to returning and record discovered system
            // GDD v6: Mark surveyComplete since scouts auto-survey
            this.gameState.updateScoutMission(mission.id, {
              status: 'returning',
              discoveredSystemId: newSystem.id,
              surveyComplete: true
            });

            // Update ship arrival based on existing mission.returnTime
            this.gameState.updateShip(mission.shipId, {
              arrivalTime: mission.returnTime
            });

            this.gameState.incrementStat('systemsDiscovered');
          }
        }
        break;

      case 'returning':
        if (now >= mission.returnTime) {
          this.completeMission(mission);
        }
        break;

      case 'completed':
        break;
    }
  }

  /**
   * Complete a scout mission
   */
  private completeMission(mission: ScoutMission): void {
    const state = this.gameState.getState();
    const ship = state.ships[mission.shipId];
    const discoveredSystem = mission.discoveredSystemId
      ? state.systems[mission.discoveredSystemId]
      : null;

    // Update ship
    this.gameState.updateShip(mission.shipId, {
      status: ShipStatus.Idle,
      currentSystemId: mission.originSystemId,
      missionId: undefined,
      departureTime: undefined,
      arrivalTime: undefined
    });

    // Mark mission complete
    this.gameState.updateScoutMission(mission.id, { status: 'completed' });

    // Notification
    if (discoveredSystem) {
      this.gameState.addNotification({
        type: 'success',
        title: 'System Discovered!',
        message: `${ship?.name ?? 'Scout'} discovered ${discoveredSystem.name} (${discoveredSystem.rarity}).`,
        systemId: discoveredSystem.id
      });
    } else {
      this.gameState.addNotification({
        type: 'info',
        title: 'Scout Returned',
        message: `${ship?.name ?? 'Scout'} has returned from exploration.`
      });
    }
  }

  /**
   * Get next frontier point for exploration
   */
  private getNextFrontierPoint(origin: { x: number; y: number }, range: number): { x: number; y: number } {
    const state = this.gameState.getState();

    // Find direction with fewest nearby systems
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    let bestAngle = angles[Math.floor(Math.random() * angles.length)];
    let lowestDensity = Infinity;

    for (const angle of angles) {
      const radians = (angle * Math.PI) / 180;
      const testPoint = {
        x: origin.x + Math.cos(radians) * range,
        y: origin.y + Math.sin(radians) * range
      };

      // Count systems within range of this point
      let density = 0;
      for (const system of Object.values(state.systems)) {
        const dist = getRouteDist(testPoint, system.coordinates);
        if (dist < range / 2) {
          density++;
        }
      }

      if (density < lowestDensity) {
        lowestDensity = density;
        bestAngle = angle;
      }
    }

    const radians = (bestAngle * Math.PI) / 180;
    // Add some randomness
    const actualRange = range * (0.8 + Math.random() * 0.4);

    return {
      x: origin.x + Math.cos(radians) * actualRange,
      y: origin.y + Math.sin(radians) * actualRange
    };
  }

  /**
   * Get available exploration directions from a system
   */
  getExplorationDirections(systemId: string): { angle: number; name: string; distance: number }[] {
    const state = this.gameState.getState();
    const system = state.systems[systemId];
    if (!system) return [];

    const directions = [
      { angle: 0, name: 'Rimward' },
      { angle: 45, name: 'Rimward-Spinward' },
      { angle: 90, name: 'Spinward' },
      { angle: 135, name: 'Coreward-Spinward' },
      { angle: 180, name: 'Coreward' },
      { angle: 225, name: 'Coreward-Trailing' },
      { angle: 270, name: 'Trailing' },
      { angle: 315, name: 'Rimward-Trailing' }
    ];

    return directions.map(d => ({
      ...d,
      distance: state.nextDiscoveryDistance
    }));
  }

  private formatHours(hours: number): string {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours.toFixed(0)}h`;
  }
}
