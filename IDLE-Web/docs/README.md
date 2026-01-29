# IDLE-Web Documentation

Welcome to the IDLE game documentation! This folder contains comprehensive reference materials for understanding and working with the IDLE-Web codebase.

## Quick Start for AI Agents

If you're an AI agent working on IDLE-Web, start here:

1. **First time?** Read [Architecture Overview](./architecture-overview.md) (5 min)
   - Understand folder structure, core patterns, game loop flow

2. **Need to find something?** Use [File Location Index](./file-location-index.md) (quick lookup)
   - "Where is X?" answers for all major features
   - Search patterns for grep

3. **Working on a feature?** Consult the relevant guide:
   - **Models & types**: [Models and Types](./models-and-types.md)
   - **Service APIs**: [Service API Reference](./service-api-reference.md)
   - **Game mechanics**: [Game Systems](./game-systems.md)

4. **Need exact rules?** Check [Game Systems Deep Dive](./game-systems.md)
   - Production formulas, population growth, transport mechanics
   - GDD references with actual calculations

## Document Structure

### [Architecture Overview](./architecture-overview.md)
**What**: High-level codebase structure and design patterns
**For**: Understanding project organization, module layout, core concepts
**Time**: 5-10 minutes

**Covers**:
- File structure and purpose of each directory
- Signal-based state management pattern
- Service injection and immutable update patterns
- Time handling conventions
- Game loop flow
- Key locations by feature

### [Models and Types Reference](./models-and-types.md)
**What**: Complete catalog of all game data types and enums
**For**: Understanding data structures, looking up interfaces, finding constants
**Time**: 10-15 minutes (or use as lookup reference)

**Covers**:
- ResourceId enum (56 resources across 5 tiers)
- FacilityId enum (50 facilities)
- All major interfaces (definitions, state, instances)
- Type aliases and constants
- RESOURCE_DEFINITIONS and FACILITY_DEFINITIONS lookups
- GameState structure

### [Service API Reference](./service-api-reference.md)
**What**: All service methods, signals, and behavioral documentation
**For**: Calling services, understanding what's available, method signatures
**Time**: 15-20 minutes (or use as API lookup)

**Covers**:
- Every public method on every service
- Signals (computed and mutable)
- Return types and descriptions
- Service dependency graph
- Notification types
- Pattern conventions (boolean returns, notifications)

### [Game Systems Deep Dive](./game-systems.md)
**What**: Game mechanics and subsystem behavior with formulas
**For**: Understanding how the game works, implementing features correctly
**Time**: 20-30 minutes (system-specific sections)

**Covers**:
- Production tier processing order and algorithm
- Population growth formula and pull factors
- Exploration and discovery mechanics
- Colonization flow and colony ships
- Trade route and transport mission lifecycle
- Fuel and travel time calculations
- Galactic market mechanics
- Prestige system behavior

### [File Location Index](./file-location-index.md)
**What**: Quick "where to find X" reference
**For**: Fast lookup when you know what you need
**Time**: 1-2 minutes per lookup

**Covers**:
- Quick navigation by feature
- File-to-purpose mapping
- Constants and lookups location
- GDD section to file cross-reference
- Search patterns for grep
- Directory tree summary

## For Different Tasks

### "I need to add a new feature"
1. Read what's already implemented in [Architecture Overview](./architecture-overview.md)
2. Check [Models and Types](./models-and-types.md) for related enums/interfaces
3. Look up service methods in [Service API Reference](./service-api-reference.md)
4. Understand the mechanics in [Game Systems](./game-systems.md)
5. Use [File Location Index](./file-location-index.md) to find relevant code

### "I need to fix a bug"
1. Use [File Location Index](./file-location-index.md) to locate relevant service/component
2. Read method documentation in [Service API Reference](./service-api-reference.md)
3. Check game mechanics in [Game Systems](./game-systems.md) for expected behavior
4. Look at actual implementation in source files

### "I need to understand production/population/trade"
1. Go directly to [Game Systems Deep Dive](./game-systems.md)
2. Find the numbered section (1. Production, 2. Population, 5. Trade, etc.)
3. Read the detailed mechanics and formulas

### "I'm looking for data structure X"
1. Go to [Models and Types Reference](./models-and-types.md)
2. Use Ctrl+F to search for interface name or enum
3. Find the interface definition with all properties documented

### "I need to call a service method"
1. Go to [Service API Reference](./service-api-reference.md)
2. Find the service (e.g., ProductionService)
3. Look up the method signature and description
4. Check return type and notification behavior

## Key Concepts

### The Enum + Definition Pattern

All major entities follow this pattern for O(1) lookups:

```typescript
// 1. Enum for IDs
export enum ResourceId { Iron = 'iron', Steel = 'steel', ... }

// 2. Interface for definitions
export interface ResourceDefinition { id, name, tier, ... }

// 3. Constant record for lookups
export const RESOURCE_DEFINITIONS: Record<ResourceId, ResourceDefinition> = {
  [ResourceId.Steel]: { id: ResourceId.Steel, name: 'Steel', ... }
}
```

### Signal-Based State Management

```typescript
// Mutable state
private _gameState = signal<GameState>(initialState);

// Derived state (auto-updates)
readonly credits = computed(() => this._gameState().credits);

// Updates are immutable
this._gameState.update(state => ({
  ...state,
  credits: state.credits - cost
}));
```

### Service Method Pattern

```typescript
// Methods return boolean (success/failure)
// Feedback via notifications, not exceptions
buildFacility(facilityId: FacilityId, bodyId: string): boolean {
  if (!canBuild(facilityId, bodyId)) {
    this.gameState.addNotification({
      type: 'warning',
      title: 'Cannot Build',
      message: 'Insufficient resources.'
    });
    return false;
  }
  // ... do work ...
  return true;
}
```

### Time Handling

- **Timestamps**: Always `Date.now()` (milliseconds)
- **Calculations**: Convert to hours: `ms / (1000 * 60 * 60)`
- **Game loop**: Passes `deltaTime` in milliseconds

## Version Info

- **Current Game Version**: 0.2.0 (GDD v6)
- **Angular**: 18.2
- **TypeScript**: 5.5.2
- **Architecture**: NgModule with signals
- **State Management**: Service-based with signals
- **Testing**: Jasmine + Karma

## Related Resources

### In This Repository
- **Game Design Document**: `/IDLE_GDD.txt` - Complete specification
- **Project Conventions**: `/CLAUDE.md` - Code style, patterns, principles

### Key Files to Know
- **Models**: `/src/app/models/` - All data structures
- **Services**: `/src/app/services/` - All game logic
- **Components**: `/src/app/components/` - UI code
- **Config**: `/src/app/config/testing.config.ts` - Testing values

## How to Use This Documentation

### As an AI Agent Working on Implementation

1. **Understand what you need to build**: Check relevant game system in [Game Systems](./game-systems.md)
2. **Find where to add code**: Use [File Location Index](./file-location-index.md)
3. **Understand existing data types**: Look up in [Models and Types](./models-and-types.md)
4. **Know what to call**: Reference [Service API Reference](./service-api-reference.md)
5. **Follow patterns**: Review [Architecture Overview](./architecture-overview.md)

### As a Human Developer

These docs are designed for both humans and AI agents. Feel free to:
- Jump directly to the section you need
- Use Ctrl+F to search within documents
- Cross-reference between docs (links provided)
- Check the GDD for game design rationale

## Updates & Maintenance

These documents were generated from source code by the codebase-cartographer agent. They represent:
- **Accurate**: Derived directly from actual code
- **Current**: As of 2026-01-29
- **Comprehensive**: Cover all major systems

When adding new features:
1. Update source code with proper types and documentation
2. New AI agents will reference these docs + CLAUDE.md
3. Consider asking codebase-cartographer to regenerate docs if making major changes

## Need Help?

If you can't find what you're looking for:

1. **Check the index files first**: [File Location Index](./file-location-index.md)
2. **Search within a document**: Use Ctrl+F
3. **Check the source code**: `/src/app/` - most files have comments
4. **Read the GDD**: `/IDLE_GDD.txt` - contains design rationale
5. **Check CLAUDE.md**: `/CLAUDE.md` - conventions and patterns

## Document Manifest

| File | Size | Sections |
|------|------|----------|
| architecture-overview.md | ~15KB | Structure, patterns, flow, key locations |
| models-and-types.md | ~25KB | All enums, interfaces, type definitions |
| service-api-reference.md | ~30KB | All service methods and signals |
| game-systems.md | ~40KB | Mechanics, formulas, algorithms |
| file-location-index.md | ~20KB | Quick lookup by feature and file |
| README.md | ~12KB | This guide |

**Total**: ~142KB of reference documentation

---

**Generated by**: codebase-cartographer
**Last Updated**: 2026-01-29
**Coverage**: Complete IDLE-Web v0.2.0 codebase
**Format**: Markdown with tables, code blocks, and cross-references
