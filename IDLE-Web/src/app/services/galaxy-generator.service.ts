import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import {
  StarSystem,
  SystemRarity,
  SystemState,
  SYSTEM_RARITY_DEFINITIONS,
  getDistanceFromHome
} from '../models/star-system.model';
import {
  CelestialBody,
  BodyType,
  BodyFeature,
  BODY_TYPE_DEFINITIONS,
  FEATURE_DEFINITIONS
} from '../models/celestial-body.model';
import { ResourceId } from '../models/resource.model';

/**
 * GDD v6 Section 23.2: Xeno-Science distance thresholds (in light-years)
 */
const XENO_DISTANCE_THRESHOLDS = {
  NO_XENO: 100,           // 0-100 ly: No xeno discoveries
  VERY_RARE: 150,         // 100-150 ly: Very rare chance
  LOW_CHANCE: 200         // 150-200 ly: Low chance, 200+: Standard rates
};

/**
 * Xeno discovery probabilities by distance band
 */
const XENO_DISCOVERY_CHANCES = {
  VERY_RARE: {
    xenoDeposits: 0.02,   // 2% chance per body
    alienArtifact: 0.005, // 0.5% chance per body
    anomalousSystem: 0.01 // 1% chance for system
  },
  LOW_CHANCE: {
    xenoDeposits: 0.08,   // 8% chance per body
    alienArtifact: 0.02,  // 2% chance per body
    anomalousSystem: 0.03 // 3% chance for system
  },
  STANDARD: {
    xenoDeposits: 0.15,   // 15% chance per body
    alienArtifact: 0.05,  // 5% chance per body
    anomalousSystem: 0.08 // 8% chance for system
  }
};

// System naming themes
const GREEK_LETTERS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'];
const CONSTELLATIONS = [
  // Major constellations
  'Centauri', 'Cygni', 'Eridani', 'Cassiopeiae', 'Draconis', 'Orionis', 'Tauri', 'Leonis', 'Aquilae', 'Lyrae',
  // Zodiac constellations
  'Arietis', 'Geminorum', 'Cancri', 'Virginis', 'Librae', 'Scorpii', 'Sagittarii', 'Capricorni', 'Aquarii', 'Piscium',
  // Northern constellations
  'Ursae Majoris', 'Ursae Minoris', 'Bootis', 'Coronae Borealis', 'Herculis', 'Serpentis', 'Ophiuchi', 'Pegasi', 'Andromedae', 'Persei',
  // Southern constellations
  'Carinae', 'Velorum', 'Puppis', 'Crucis', 'Centauri', 'Pavonis', 'Gruis', 'Phoenicis', 'Tucani', 'Hydrae',
  // Additional constellations
  'Ceti', 'Aquilae', 'Cephei', 'Canum Venaticorum', 'Comae Berenices', 'Corvi', 'Crateris', 'Delphini', 'Equulei', 'Vulpeculae',
  'Lacertae', 'Lyncis', 'Monocerotis', 'Pictoris', 'Sculptoris', 'Trianguli', 'Aurigae', 'Canis Majoris', 'Canis Minoris', 'Columbae'
];
const DESCRIPTIVE_PREFIXES = ['New', 'Nova', 'Far', 'Deep', 'Outer', 'Inner', 'High', 'Low', 'First', 'Last', 'Greater', 'Lesser'];
const DESCRIPTIVE_SUFFIXES = ['Haven', 'Hope', 'Prime', 'Major', 'Minor', 'Station', 'Colony', 'Outpost', 'Reach', 'Gate', 'Point', 'Landing', 'Port', 'Terminus'];
const MYTHOLOGY = ['Prometheus', 'Icarus', 'Daedalus', 'Perseus', 'Andromeda', 'Orion', 'Artemis', 'Apollo', 'Helios', 'Selene', 'Atlas', 'Titan', 'Hyperion', 'Theseus', 'Achilles', 'Odysseus', 'Hera', 'Athena', 'Poseidon', 'Ares', 'Hephaestus', 'Hermes', 'Dionysus', 'Demeter'];
const CORPORATE = ['Weyland', 'Tyrell', 'Axiom', 'Nexus', 'Stellar', 'Frontier', 'Pioneer', 'Venture', 'Unity', 'Horizon', 'Genesis', 'Apex', 'Nova', 'Zenith', 'Quantum', 'Vector', 'Helix', 'Catalyst', 'Synergy', 'Vanguard'];

@Injectable({
  providedIn: 'root'
})
export class GalaxyGeneratorService {
  private gameState = inject(GameStateService);
  private usedNames = new Set<string>();

  /**
   * Generate a new star system at the given coordinates
   */
  generateSystem(coordinates: { x: number; y: number }, options?: { forceRarity?: SystemRarity; increaseBodiesBy?: number }): StarSystem {
    const rarity = options?.forceRarity ?? this.rollRarity();
    const rarityDef = SYSTEM_RARITY_DEFINITIONS[rarity];

    // Generate body count
    let bodyCount = this.randomRange(rarityDef.bodiesMin, rarityDef.bodiesMax);
    if (options?.increaseBodiesBy) {
      bodyCount = Math.min(20, bodyCount + options.increaseBodiesBy);
    }

    // Generate name
    const name = this.generateSystemName();

    // GDD v6 Section 23: Calculate distance for xeno-science gating
    const distanceFromSol = getDistanceFromHome(coordinates);
    const xenoChances = this.getXenoChances(distanceFromSol);

    // Check for anomalous system (GDD v6 Section 23.3)
    const isAnomalous = xenoChances !== null && Math.random() < xenoChances.anomalousSystem;
    const hasXenoDiscovery = isAnomalous; // Will be updated if bodies have xeno features

    // Create system
    const systemId = this.gameState.generateId();
    const system: StarSystem = {
      id: systemId,
      name,
      coordinates,
      rarity,
      discovered: true,
      discoveredAt: Date.now(),
      surveyed: false,
      bodyIds: [],
      stellarSlots: bodyCount > 5 ? 2 : 1,
      state: SystemState.Stable,
      totalPopulation: 0,
      techLevel: 0,
      securityLevel: 0,
      standardOfLiving: 0,
      resources: [],
      storageCapacity: 10000,
      hasTradeStation: false,
      tradeStationTier: 0,
      colonized: false,
      // GDD v6: Xeno-science properties
      anomalous: isAnomalous,
      hasXenoDiscovery: hasXenoDiscovery
    };

    // Generate bodies (pass distance for xeno feature generation)
    const bodies = this.generateBodies(systemId, name, bodyCount, rarity, distanceFromSol);

    // Check if any body has xeno features
    const hasXenoFeatures = bodies.some(b =>
      b.features.includes(BodyFeature.XenoDeposits) ||
      b.features.includes(BodyFeature.AlienArtifact)
    );
    if (hasXenoFeatures) {
      system.hasXenoDiscovery = true;
    }

    // Add bodies to game state
    for (const body of bodies) {
      this.gameState.addBody(body);
    }

    system.bodyIds = bodies.map(b => b.id);

    return system;
  }

  /**
   * GDD v6 Section 23.2: Get xeno discovery chances based on distance
   */
  private getXenoChances(distanceFromSol: number): typeof XENO_DISCOVERY_CHANCES.STANDARD | null {
    if (distanceFromSol < XENO_DISTANCE_THRESHOLDS.NO_XENO) {
      return null; // No xeno discoveries within 100 ly
    } else if (distanceFromSol < XENO_DISTANCE_THRESHOLDS.VERY_RARE) {
      return XENO_DISCOVERY_CHANCES.VERY_RARE;
    } else if (distanceFromSol < XENO_DISTANCE_THRESHOLDS.LOW_CHANCE) {
      return XENO_DISCOVERY_CHANCES.LOW_CHANCE;
    } else {
      return XENO_DISCOVERY_CHANCES.STANDARD;
    }
  }

  /**
   * Roll for system rarity
   */
  private rollRarity(): SystemRarity {
    const roll = Math.random();
    let cumulative = 0;

    for (const [rarity, def] of Object.entries(SYSTEM_RARITY_DEFINITIONS)) {
      cumulative += def.chance;
      if (roll < cumulative) {
        return rarity as SystemRarity;
      }
    }

    return SystemRarity.Common;
  }

  /**
   * Generate bodies for a system
   */
  private generateBodies(
    systemId: string,
    systemName: string,
    count: number,
    rarity: SystemRarity,
    distanceFromSol: number = 0
  ): CelestialBody[] {
    const bodies: CelestialBody[] = [];

    // Always add a star
    const star: CelestialBody = {
      id: this.gameState.generateId(),
      systemId,
      name: systemName,
      type: BodyType.Star,
      orbitalSlots: count > 5 ? 2 : 1,
      surfaceSlots: 0,
      usedOrbitalSlots: 0,
      usedSurfaceSlots: 0,
      features: [],
      surveyed: false,
      facilityIds: [],
      population: 0,
      populationCeiling: 0,
      populationFloor: 0
    };
    bodies.push(star);

    // Generate remaining bodies
    let planetIndex = 1;
    const remainingCount = count - 1;
    const rarityDef = SYSTEM_RARITY_DEFINITIONS[rarity];

    for (let i = 0; i < remainingCount; i++) {
      // Enforce hard cap of 20 total bodies including moons
      if (bodies.length >= 20) {
        break;
      }

      const bodyType = this.rollBodyType(rarity, i, remainingCount);

      // Skip moons for direct generation - they come with gas giants
      if (bodyType === BodyType.Moon || bodyType === BodyType.IcyMoon) {
        continue;
      }

      const body = this.generateBody(systemId, systemName, planetIndex, bodyType, rarity, distanceFromSol);
      bodies.push(body);
      planetIndex++;

      // Gas giants may have moons
      if (bodyType === BodyType.GasGiant && Math.random() < 0.7) {
        const moonCount = this.randomRange(1, 3);
        const moonLetters = ['a', 'b', 'c', 'd'];

        for (let m = 0; m < moonCount; m++) {
          // Enforce hard cap of 20 total bodies
          if (bodies.length >= 20) {
            break;
          }

          const moonType = Math.random() < 0.6 ? BodyType.IcyMoon : BodyType.Moon;
          const moon = this.generateBody(
            systemId,
            systemName,
            planetIndex - 1,
            moonType,
            rarity,
            distanceFromSol,
            body.id,
            moonLetters[m]
          );
          bodies.push(moon);
        }
      }
    }

    return bodies;
  }

  /**
   * Generate a single body
   */
  private generateBody(
    systemId: string,
    systemName: string,
    index: number,
    type: BodyType,
    rarity: SystemRarity,
    distanceFromSol: number = 0,
    parentId?: string,
    moonLetter?: string
  ): CelestialBody {
    const typeDef = BODY_TYPE_DEFINITIONS[type];

    // Generate name
    const name = moonLetter
      ? `${systemName} ${index}-${moonLetter}`
      : `${systemName} ${index}`;

    // Generate slots
    const surfaceSlots = this.randomRange(typeDef.surfaceSlots.min, typeDef.surfaceSlots.max);

    // Generate features (including distance-gated xeno features)
    const features = this.generateFeatures(type, rarity, distanceFromSol);

    // Calculate population ceiling
    let popCeiling = typeDef.canHavePopulation
      ? 1000 * typeDef.populationMultiplier * (surfaceSlots + typeDef.orbitalSlots)
      : 0;

    // Apply feature bonuses
    for (const feature of features) {
      const featureDef = FEATURE_DEFINITIONS[feature];
      if (featureDef?.bonus.populationBonus) {
        popCeiling *= (1 + featureDef.bonus.populationBonus);
      }
    }

    return {
      id: this.gameState.generateId(),
      systemId,
      name,
      type,
      parentBodyId: parentId,
      orbitalSlots: typeDef.orbitalSlots,
      surfaceSlots,
      usedOrbitalSlots: 0,
      usedSurfaceSlots: 0,
      features,
      surveyed: false,
      facilityIds: [],
      population: 0,
      populationCeiling: Math.round(popCeiling),
      populationFloor: 0
    };
  }

  /**
   * Roll for body type
   */
  private rollBodyType(rarity: SystemRarity, index: number, total: number): BodyType {
    const roll = Math.random();
    const rarityBonus = {
      [SystemRarity.Common]: 0,
      [SystemRarity.Uncommon]: 0.05,
      [SystemRarity.Rare]: 0.1,
      [SystemRarity.Exceptional]: 0.15,
      [SystemRarity.Legendary]: 0.2
    }[rarity];

    // Terraformable is rare
    if (roll < 0.05 + rarityBonus) {
      return BodyType.TerraformablePlanet;
    }

    // Gas giants in outer positions
    if (index > total / 2 && roll < 0.3) {
      return BodyType.GasGiant;
    }

    // Most are terrestrial
    return BodyType.TerrestrialPlanet;
  }

  /**
   * Generate features for a body
   * GDD v6 Section 23.2: Xeno features are distance-gated
   */
  private generateFeatures(type: BodyType, rarity: SystemRarity, distanceFromSol: number = 0): BodyFeature[] {
    const features: BodyFeature[] = [];
    const rarityMultiplier = {
      [SystemRarity.Common]: 0.8,
      [SystemRarity.Uncommon]: 1.0,
      [SystemRarity.Rare]: 1.3,
      [SystemRarity.Exceptional]: 1.6,
      [SystemRarity.Legendary]: 2.0
    }[rarity];

    // Get xeno chances based on distance
    const xenoChances = this.getXenoChances(distanceFromSol);

    for (const [featureId, def] of Object.entries(FEATURE_DEFINITIONS)) {
      if (!def.validBodyTypes.includes(type)) continue;

      // GDD v6: Handle xeno features separately with distance-based chances
      if (featureId === BodyFeature.XenoDeposits) {
        if (xenoChances && Math.random() < xenoChances.xenoDeposits * rarityMultiplier) {
          features.push(BodyFeature.XenoDeposits);
        }
        continue;
      }

      if (featureId === BodyFeature.AlienArtifact) {
        if (xenoChances && Math.random() < xenoChances.alienArtifact * rarityMultiplier) {
          features.push(BodyFeature.AlienArtifact);
        }
        continue;
      }

      // Regular features use their defined rarity
      if (Math.random() < def.rarity * rarityMultiplier) {
        features.push(featureId as BodyFeature);
      }
    }

    return features;
  }

  /**
   * Generate a unique system name
   */
  private generateSystemName(): string {
    let attempts = 0;
    let name = '';

    while (attempts < 100) {
      const style = Math.floor(Math.random() * 5);

      switch (style) {
        case 0: // Greek letter + Constellation
          name = `${this.randomFrom(GREEK_LETTERS)} ${this.randomFrom(CONSTELLATIONS)}`;
          break;
        case 1: // Catalog number
          name = `HD ${Math.floor(Math.random() * 200000)}`;
          break;
        case 2: // Descriptive
          name = `${this.randomFrom(DESCRIPTIVE_PREFIXES)} ${this.randomFrom(DESCRIPTIVE_SUFFIXES)}`;
          break;
        case 3: // Mythology
          name = this.randomFrom(MYTHOLOGY);
          break;
        case 4: // Corporate
          name = `${this.randomFrom(CORPORATE)}-${Math.floor(Math.random() * 100)}`;
          break;
      }

      if (!this.usedNames.has(name)) {
        this.usedNames.add(name);
        return name;
      }

      attempts++;
    }

    // Fallback to guaranteed unique
    return `System-${Date.now()}`;
  }

  private randomFrom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private randomRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
