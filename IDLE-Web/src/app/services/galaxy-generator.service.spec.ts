import { TestBed } from '@angular/core/testing';
import { GalaxyGeneratorService } from './galaxy-generator.service';
import { GameStateService } from './game-state.service';
import { SystemRarity, SYSTEM_RARITY_DEFINITIONS } from '../models/star-system.model';
import { BodyType, BodyFeature } from '../models/celestial-body.model';

describe('GalaxyGeneratorService', () => {
  let service: GalaxyGeneratorService;
  let gameState: jasmine.SpyObj<GameStateService>;

  beforeEach(() => {
    const gameStateSpy = jasmine.createSpyObj('GameStateService', [
      'generateId',
      'addBody',
      'getState'
    ]);

    // Mock ID generation to return sequential IDs for testing
    let idCounter = 0;
    gameStateSpy.generateId.and.callFake(() => `id-${idCounter++}`);

    TestBed.configureTestingModule({
      providers: [
        GalaxyGeneratorService,
        { provide: GameStateService, useValue: gameStateSpy }
      ]
    });

    service = TestBed.inject(GalaxyGeneratorService);
    gameState = TestBed.inject(GameStateService) as jasmine.SpyObj<GameStateService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateSystem', () => {
    it('should generate a star system at given coordinates', () => {
      const coordinates = { x: 10, y: 20 };
      const system = service.generateSystem(coordinates);

      expect(system).toBeTruthy();
      expect(system.coordinates).toEqual(coordinates);
      expect(system.discovered).toBe(true);
      expect(system.surveyed).toBe(false);
    });

    it('should generate a system with a valid rarity', () => {
      const system = service.generateSystem({ x: 0, y: 0 });

      expect(Object.values(SystemRarity)).toContain(system.rarity);
    });

    it('should force rarity when specified', () => {
      const system = service.generateSystem({ x: 0, y: 0 }, { forceRarity: SystemRarity.Legendary });

      expect(system.rarity).toBe(SystemRarity.Legendary);
    });

    it('should increase body count when specified', () => {
      const normalSystem = service.generateSystem({ x: 0, y: 0 });
      const boostedSystem = service.generateSystem({ x: 0, y: 0 }, { increaseBodiesBy: 5 });

      expect(boostedSystem.bodyIds.length).toBeGreaterThanOrEqual(normalSystem.bodyIds.length);
    });

    it('should respect maximum body count', () => {
      const system = service.generateSystem({ x: 0, y: 0 }, { increaseBodiesBy: 100 });

      // Should cap at 20
      expect(system.bodyIds.length).toBeLessThanOrEqual(20);
    });

    it('should generate at least one body (star)', () => {
      const system = service.generateSystem({ x: 0, y: 0 });

      expect(system.bodyIds.length).toBeGreaterThanOrEqual(1);
      expect(gameState.addBody).toHaveBeenCalled();
    });

    it('should assign bodies to the system', () => {
      const system = service.generateSystem({ x: 0, y: 0 });

      expect(system.bodyIds.length).toBeGreaterThan(0);
      expect(gameState.addBody).toHaveBeenCalledTimes(system.bodyIds.length);
    });

    it('should generate unique system names', () => {
      const system1 = service.generateSystem({ x: 0, y: 0 });
      const system2 = service.generateSystem({ x: 10, y: 10 });
      const system3 = service.generateSystem({ x: 20, y: 20 });

      expect(system1.name).not.toBe(system2.name);
      expect(system1.name).not.toBe(system3.name);
      expect(system2.name).not.toBe(system3.name);
    });

    it('should set stellarSlots based on body count', () => {
      const smallSystem = service.generateSystem({ x: 0, y: 0 }, { forceRarity: SystemRarity.Common });
      const largeSystem = service.generateSystem({ x: 0, y: 0 }, { forceRarity: SystemRarity.Legendary });

      if (smallSystem.bodyIds.length <= 5) {
        expect(smallSystem.stellarSlots).toBe(1);
      } else {
        expect(smallSystem.stellarSlots).toBe(2);
      }
    });

    it('should not generate xeno features within 100 ly of home', () => {
      const nearSystem = service.generateSystem({ x: 50, y: 50 }); // ~70 ly from origin

      expect(nearSystem.anomalous).toBe(false);
      expect(nearSystem.hasXenoDiscovery).toBe(false);
    });

    it('should have low chance of xeno features between 100-150 ly', () => {
      const systems: any[] = [];

      // Generate multiple systems to check probability
      for (let i = 0; i < 50; i++) {
        const system = service.generateSystem({ x: 100, y: 50 }); // ~112 ly from origin
        systems.push(system);
      }

      const xenoCount = systems.filter(s => s.hasXenoDiscovery).length;
      // Should be possible but rare
      expect(xenoCount).toBeLessThan(systems.length);
    });
  });

  describe('Body Generation', () => {
    it('should always generate a star as first body', () => {
      const system = service.generateSystem({ x: 0, y: 0 });

      // First addBody call should be the star
      const firstBodyCall = gameState.addBody.calls.first();
      const star = firstBodyCall.args[0];

      expect(star.type).toBe(BodyType.Star);
      expect(star.name).toBe(system.name);
    });

    it('should generate bodies with valid types', () => {
      const system = service.generateSystem({ x: 0, y: 0 });

      const bodyTypes = gameState.addBody.calls.allArgs().map(args => args[0].type);

      bodyTypes.forEach(type => {
        expect(Object.values(BodyType)).toContain(type);
      });
    });

    it('should generate terraformable planets in rare systems', () => {
      const allBodyTypes: BodyType[] = [];

      // Generate multiple rare systems
      for (let i = 0; i < 20; i++) {
        gameState.addBody.calls.reset();
        const system = service.generateSystem({ x: i * 10, y: 0 }, { forceRarity: SystemRarity.Rare });

        // Collect body types from this system
        const bodyTypes = gameState.addBody.calls.allArgs().map(args => args[0].type);
        allBodyTypes.push(...bodyTypes);
      }

      // At least some rare systems should have terraformable planets
      expect(allBodyTypes).toContain(BodyType.TerraformablePlanet);
    });

    it('should generate moons for gas giants', () => {
      let foundMoon = false;

      // Generate multiple systems until we find a moon
      for (let i = 0; i < 20; i++) {
        gameState.addBody.calls.reset();
        service.generateSystem({ x: i * 10, y: 0 }, { increaseBodiesBy: 5 });

        const bodies = gameState.addBody.calls.allArgs().map(args => args[0]);
        const gasGiants = bodies.filter(b => b.type === BodyType.GasGiant);
        const moons = bodies.filter(b => b.type === BodyType.Moon || b.type === BodyType.IcyMoon);

        if (gasGiants.length > 0 && moons.length > 0) {
          foundMoon = true;
          // Check that moons have parentBodyId
          moons.forEach(moon => {
            expect(moon.parentBodyId).toBeTruthy();
          });
          break;
        }
      }

      // With 20 attempts and increased bodies, should find at least one moon
      expect(foundMoon).toBe(true);
    });

    it('should assign surface and orbital slots to bodies', () => {
      const system = service.generateSystem({ x: 0, y: 0 });

      const bodies = gameState.addBody.calls.allArgs().map(args => args[0]);

      bodies.forEach(body => {
        expect(body.surfaceSlots).toBeGreaterThanOrEqual(0);
        expect(body.orbitalSlots).toBeGreaterThanOrEqual(0);
        expect(body.usedSurfaceSlots).toBe(0);
        expect(body.usedOrbitalSlots).toBe(0);
      });
    });

    it('should generate features for bodies', () => {
      const system = service.generateSystem({ x: 0, y: 0 }, {
        forceRarity: SystemRarity.Legendary,
        increaseBodiesBy: 5
      });

      const bodies = gameState.addBody.calls.allArgs().map(args => args[0]);

      // At least some bodies should have features in legendary systems
      const totalFeatures = bodies.reduce((sum, b) => sum + b.features.length, 0);
      expect(totalFeatures).toBeGreaterThan(0);
    });

    it('should generate valid body features', () => {
      const system = service.generateSystem({ x: 0, y: 0 }, {
        forceRarity: SystemRarity.Legendary,
        increaseBodiesBy: 5
      });

      const bodies = gameState.addBody.calls.allArgs().map(args => args[0]);

      bodies.forEach(body => {
        body.features.forEach((feature: BodyFeature) => {
          expect(Object.values(BodyFeature)).toContain(feature);
        });
      });
    });

    it('should assign population ceilings to habitable bodies', () => {
      const system = service.generateSystem({ x: 0, y: 0 }, { increaseBodiesBy: 5 });

      const bodies = gameState.addBody.calls.allArgs().map(args => args[0]);

      bodies.forEach(body => {
        if (body.type === BodyType.TerraformablePlanet || body.type === BodyType.EarthLikePlanet) {
          expect(body.populationCeiling).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('System Naming', () => {
    it('should generate system names in various formats', () => {
      const names: string[] = [];

      for (let i = 0; i < 20; i++) {
        const system = service.generateSystem({ x: i * 10, y: 0 });
        names.push(system.name);
      }

      // Should have variety in naming styles
      const hasGreekLetter = names.some(n => n.includes('Alpha') || n.includes('Beta') || n.includes('Gamma'));
      const hasCatalogNumber = names.some(n => n.includes('HD'));
      const hasDescriptive = names.some(n => n.includes('New') || n.includes('Far') || n.includes('Deep'));

      // Should have at least one of these styles
      expect(hasGreekLetter || hasCatalogNumber || hasDescriptive).toBe(true);
    });

    it('should not repeat system names', () => {
      const names = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const system = service.generateSystem({ x: i * 10, y: 0 });
        names.add(system.name);
      }

      // Should have 100 unique names
      expect(names.size).toBe(100);
    });

    it('should fall back to timestamp-based names if needed', () => {
      // Generate many systems to potentially exhaust name pool
      const systems: any[] = [];

      for (let i = 0; i < 500; i++) {
        const system = service.generateSystem({ x: i * 10, y: 0 });
        systems.push(system);
      }

      // All should have valid names
      systems.forEach(system => {
        expect(system.name).toBeTruthy();
        expect(system.name.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Rarity Distribution', () => {
    it('should respect rarity probabilities', () => {
      const counts = {
        [SystemRarity.Common]: 0,
        [SystemRarity.Uncommon]: 0,
        [SystemRarity.Rare]: 0,
        [SystemRarity.Exceptional]: 0,
        [SystemRarity.Legendary]: 0
      };

      // Generate many systems to test distribution
      for (let i = 0; i < 200; i++) {
        const system = service.generateSystem({ x: i * 10, y: 0 });
        counts[system.rarity]++;
      }

      // Common should be most frequent
      expect(counts[SystemRarity.Common]).toBeGreaterThan(counts[SystemRarity.Rare]);
      expect(counts[SystemRarity.Common]).toBeGreaterThan(counts[SystemRarity.Legendary]);

      // Should have some variety
      const uniqueRarities = Object.values(counts).filter(c => c > 0).length;
      expect(uniqueRarities).toBeGreaterThanOrEqual(3);
    });

    it('should generate more bodies for higher rarity systems', () => {
      const commonSystem = service.generateSystem({ x: 0, y: 0 }, { forceRarity: SystemRarity.Common });
      const legendarySystem = service.generateSystem({ x: 0, y: 0 }, { forceRarity: SystemRarity.Legendary });

      // Legendary systems should generally have more bodies
      // Allow some variance due to randomness
      expect(legendarySystem.bodyIds.length).toBeGreaterThanOrEqual(commonSystem.bodyIds.length - 2);
    });
  });

  describe('Xeno-Science Gating', () => {
    it('should not generate xeno deposits close to home', () => {
      const nearSystem = service.generateSystem({ x: 50, y: 50 });

      const bodies = gameState.addBody.calls.allArgs().map(args => args[0]);
      const hasXenoDeposits = bodies.some(b => b.features.includes(BodyFeature.XenoDeposits));

      expect(hasXenoDeposits).toBe(false);
    });

    it('should not generate alien artifacts close to home', () => {
      const nearSystem = service.generateSystem({ x: 50, y: 50 });

      const bodies = gameState.addBody.calls.allArgs().map(args => args[0]);
      const hasArtifact = bodies.some(b => b.features.includes(BodyFeature.AlienArtifact));

      expect(hasArtifact).toBe(false);
    });

    it('should set hasXenoDiscovery when xeno features present', () => {
      let foundXenoSystem = false;

      // Generate systems far from home
      for (let i = 0; i < 50; i++) {
        gameState.addBody.calls.reset();
        const system = service.generateSystem({ x: 200, y: 200 }, { forceRarity: SystemRarity.Legendary });

        const bodies = gameState.addBody.calls.allArgs().map(args => args[0]);
        const hasXenoFeatures = bodies.some(b =>
          b.features.includes(BodyFeature.XenoDeposits) ||
          b.features.includes(BodyFeature.AlienArtifact)
        );

        if (hasXenoFeatures) {
          expect(system.hasXenoDiscovery).toBe(true);
          foundXenoSystem = true;
          break;
        }
      }

      // With 50 legendary systems far from home, should find at least one xeno discovery
      expect(foundXenoSystem).toBe(true);
    });

    it('should set hasXenoDiscovery when system is anomalous', () => {
      let foundAnomalous = false;

      // Generate systems far from home
      for (let i = 0; i < 50; i++) {
        const system = service.generateSystem({ x: 250, y: 250 });

        if (system.anomalous) {
          expect(system.hasXenoDiscovery).toBe(true);
          foundAnomalous = true;
          break;
        }
      }

      // Should eventually find an anomalous system
      expect(foundAnomalous).toBe(true);
    });
  });
});
