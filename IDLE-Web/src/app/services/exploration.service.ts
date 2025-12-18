import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import { GalaxyGeneratorService } from './galaxy-generator.service';
import {
  Ship,
  ShipType,
  ShipStatus,
  ScoutMission,
  calculateTravelTime
} from '../models/ship.model';
import { ResourceId } from '../models/resource.model';
import { getDistanceFromHome, getRouteDist } from '../models/star-system.model';

@Injectable({
  providedIn: 'root'
})
export class ExplorationService {
  private gameState = inject(GameStateService);
  private galaxyGenerator = inject(GalaxyGeneratorService);

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
    const scoutSpeed = (ship.scoutSpeed ?? 300) * (ship.speedModifier ?? 1);
    const outboundTimeHours = distance / scoutSpeed;
    const explorationTimeHours = 1 / 60; // 1 minute to explore
    const returnTimeHours = distance / scoutSpeed;
    const totalTimeHours = outboundTimeHours + explorationTimeHours + returnTimeHours;

    const now = Date.now();
    const outboundArrival = now + (outboundTimeHours * 60 * 60 * 1000);
    const explorationComplete = outboundArrival + (explorationTimeHours * 60 * 60 * 1000);
    const returnTime = now + (totalTimeHours * 60 * 60 * 1000);

    // Create mission (store explorationComplete so we wait while exploring)
    const mission: ScoutMission = {
      id: this.gameState.generateId(),
      shipId,
      originSystemId: originSystem.id,
      targetCoordinates: targetCoords,
      startTime: now,
      estimatedArrival: outboundArrival,
      explorationComplete: explorationComplete,
      returnTime,
      status: 'outbound'
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

  /**
   * Start surveying a discovered system
   */
  startSurvey(systemId: string, shipId: string): boolean {
    const state = this.gameState.getState();
    const system = state.systems[systemId];
    const ship = state.ships[shipId];

    if (!system || !system.discovered || system.surveyed) {
      return false;
    }

    if (!ship || ship.type !== ShipType.Scout || ship.status !== ShipStatus.Idle) {
      this.gameState.addNotification({
        type: 'warning',
        title: 'Ship Unavailable',
        message: 'Need an idle scout ship to survey.'
      });
      return false;
    }

    // Survey time based on body count
    const surveyTimeHours = system.bodyIds.length * 2; // 2 hours per body

    const now = Date.now();
    const completionTime = now + (surveyTimeHours * 60 * 60 * 1000);

    // Update system
    this.gameState.updateSystem(systemId, {
      surveyProgress: 0
    });

    // Update ship
    this.gameState.updateShip(shipId, {
      status: ShipStatus.Surveying,
      currentSystemId: systemId,
      departureTime: now,
      arrivalTime: completionTime
    });

    this.gameState.addNotification({
      type: 'info',
      title: 'Survey Started',
      message: `${ship.name} is surveying ${system.name}. ETA: ${this.formatHours(surveyTimeHours)}`
    });

    return true;
  }

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
            const newSystem = this.galaxyGenerator.generateSystem(mission.targetCoordinates);
            this.gameState.addSystem(newSystem);

            // Mark new system as surveyed since the scout just scanned it
            this.gameState.updateSystem(newSystem.id, {
              surveyed: true,
              surveyedAt: Date.now(),
              surveyProgress: 100
            });

            // Set mission to returning and record discovered system
            this.gameState.updateScoutMission(mission.id, {
              status: 'returning',
              discoveredSystemId: newSystem.id
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
