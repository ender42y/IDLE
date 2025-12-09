# CLAUDE.md - AI Assistant Guide for IDLE

This document provides comprehensive guidance for AI assistants working on the IDLE project.

## Project Overview

**Project Name**: IDLE-Web
**Type**: Angular Web Application
**Framework**: Angular 18.2
**License**: MIT License (Copyright 2025 Steven Yorgason)
**Primary Language**: TypeScript
**Build System**: Angular CLI

This is a freshly generated Angular 18.2 application with minimal customization, representing a clean starting point for web development.

## Repository Structure

```
IDLE/
├── IDLE-Web/                 # Main Angular application directory
│   ├── .vscode/              # VS Code configuration
│   │   ├── extensions.json   # Recommended extensions (Angular Language Service)
│   │   ├── launch.json       # Debug configurations (Chrome & Edge)
│   │   └── tasks.json        # NPM task configurations
│   ├── public/               # Static assets
│   │   └── favicon.ico       # Application favicon
│   ├── src/                  # Source code
│   │   ├── app/              # Application components and modules
│   │   │   ├── app.component.ts        # Root component
│   │   │   ├── app.component.html      # Root template (default Angular welcome)
│   │   │   ├── app.component.css       # Root component styles
│   │   │   ├── app.component.spec.ts   # Root component tests
│   │   │   ├── app.module.ts           # Root module
│   │   │   └── app-routing.module.ts   # Routing configuration (empty)
│   │   ├── index.html        # Main HTML file
│   │   ├── main.ts           # Application entry point
│   │   └── styles.css        # Global styles
│   ├── .editorconfig         # Editor configuration
│   ├── .gitignore            # Git ignore patterns
│   ├── angular.json          # Angular CLI configuration
│   ├── package.json          # NPM dependencies and scripts
│   ├── tsconfig.json         # TypeScript base configuration
│   ├── tsconfig.app.json     # TypeScript app configuration
│   ├── tsconfig.spec.json    # TypeScript test configuration
│   ├── IDLE-Web.esproj       # Visual Studio project file
│   ├── IDLE-Web.esproj.user  # VS user settings
│   ├── IDLE-Web.sln          # Visual Studio solution file
│   └── README.md             # Angular CLI generated readme
├── .gitignore                # Root git ignore
├── LICENSE                   # MIT License
└── CLAUDE.md                 # This file
```

## Technology Stack

### Core Technologies
- **Angular**: 18.2.0 (latest at project creation)
- **TypeScript**: 5.5.2
- **RxJS**: 7.8.0
- **Zone.js**: 0.14.10

### Development Tools
- **Angular CLI**: 18.2.16
- **Karma**: 6.4.0 (test runner)
- **Jasmine**: 5.2.0 (testing framework)

### Build System
- **Builder**: @angular-devkit/build-angular:application
- **Module Resolution**: bundler
- **Target**: ES2022

## Development Workflows

### Starting the Development Server

```bash
cd IDLE-Web
npm start
# or
ng serve
```

- Dev server runs on: `http://localhost:61552` (custom port configured in angular.json:80)
- Application auto-reloads on file changes
- Default configuration: development mode

### Building the Project

```bash
# Production build
npm run build
# or
ng build

# Development build with watch
npm run watch
# or
ng build --watch --configuration development
```

- **Output directory**: `dist/idle-web/` (configured in angular.json:26)
- **Production optimizations**: Enabled by default
- **Bundle size limits**:
  - Initial bundle: 500kB warning, 1MB error (angular.json:49-50)
  - Component styles: 2kB warning, 4kB error (angular.json:54-55)

### Running Tests

```bash
npm test
# or
ng test
```

- Uses Karma with Chrome launcher
- Jasmine test framework
- Coverage reports available

### Code Generation

```bash
# Generate new component
ng generate component component-name

# Other generators available
ng generate directive|pipe|service|class|guard|interface|enum|module
```

**Important**: Components are configured to be non-standalone by default (angular.json:10)

## Code Style and Conventions

### TypeScript Configuration

The project uses **strict TypeScript settings** (tsconfig.json):

- `strict: true` - All strict mode checks enabled
- `noImplicitOverride: true` - Explicit override required
- `noPropertyAccessFromIndexSignature: true` - Stricter property access
- `noImplicitReturns: true` - All code paths must return
- `noFallthroughCasesInSwitch: true` - Prevent fallthrough cases

### Angular Compiler Settings

Strict Angular compilation enabled (tsconfig.json:28-31):

- `strictInjectionParameters: true`
- `strictInputAccessModifiers: true`
- `strictTemplates: true`

### Editor Configuration (.editorconfig)

- **Charset**: UTF-8
- **Indentation**: 2 spaces (not tabs)
- **Line endings**: LF with final newline
- **Trailing whitespace**: Trimmed (except in .md files)
- **TypeScript quotes**: Single quotes preferred (editorconfig:12)

### Component Structure

Components follow the **non-standalone** pattern:

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'  // Note: styleUrl (singular) for Angular 18+
})
export class AppComponent {
  // Component logic
}
```

### Module Pattern

Using traditional NgModule pattern (app.module.ts:7-18):

```typescript
@NgModule({
  declarations: [/* components */],
  imports: [/* modules */],
  providers: [/* services */],
  bootstrap: [AppComponent]
})
```

## Important Conventions for AI Assistants

### When Making Changes

1. **Read files before modifying**: Always read the current file content before suggesting changes
2. **Preserve code style**: Maintain 2-space indentation and single quotes in TypeScript
3. **Follow strict TypeScript**: Ensure all changes comply with strict mode requirements
4. **Test changes**: Run `ng build` to verify TypeScript compilation
5. **Component selector prefix**: Use `app-` prefix for all component selectors (angular.json:21)

### Module vs. Standalone Components

- This project uses **traditional NgModule** architecture, not standalone components
- New components must be declared in a module's `declarations` array
- Schematics are configured to generate non-standalone components by default

### File Naming Conventions

- Components: `component-name.component.ts`
- Services: `service-name.service.ts`
- Modules: `module-name.module.ts`
- Routing: `module-name-routing.module.ts`

### Routing

- Main routing module: `src/app/app-routing.module.ts`
- Currently configured with empty routes array (app-routing.module.ts:4)
- Uses `RouterModule.forRoot(routes)` pattern

## Key File Locations

### Configuration Files

- **Angular CLI Config**: `IDLE-Web/angular.json`
- **Package Management**: `IDLE-Web/package.json`
- **TypeScript Config**: `IDLE-Web/tsconfig.json`
- **Editor Settings**: `IDLE-Web/.editorconfig`

### Source Code

- **Application Root**: `IDLE-Web/src/app/`
- **Entry Point**: `IDLE-Web/src/main.ts`
- **Global Styles**: `IDLE-Web/src/styles.css`
- **HTML Template**: `IDLE-Web/src/index.html`

### Build Output

- **Distribution**: `IDLE-Web/dist/idle-web/`
- **TypeScript Output**: `IDLE-Web/dist/out-tsc/`

## Development Environment

### Recommended VS Code Extensions

- `angular.ng-template` - Angular Language Service (extensions.json:3)

### Debug Configurations

Two launch configurations available (launch.json):

1. **localhost (Edge)**: Debug in Microsoft Edge at http://localhost:61552
2. **localhost (Chrome)**: Debug in Chrome at http://localhost:61552

### VS Code Tasks

- **npm: start** - Start development server with background mode
- **npm: test** - Run tests in background mode

## Git Workflow

### Protected Files and Directories

The following are ignored by Git (per .gitignore):

- `/node_modules/` - NPM dependencies
- `/dist/` - Build output
- `/.angular/` - Angular cache
- `/coverage/` - Test coverage reports
- `*.tsbuildinfo` - TypeScript build info
- `.env` - Environment files
- Visual Studio specific files (/.vs/, etc.)

### Current State

- **Branch**: claude/claude-md-miyu1u497gn5vb1v-01XCFDC9id2B4pjRuS9B2w4G
- **Status**: Clean working directory
- **Recent commits**: Initial setup and test commits

## Common Tasks for AI Assistants

### Adding a New Feature

1. Generate necessary components/services using Angular CLI
2. Update routing in `app-routing.module.ts` if needed
3. Add component to module declarations
4. Implement business logic
5. Add tests
6. Build to verify compilation

### Updating Dependencies

```bash
cd IDLE-Web
npm update
# or for specific package
npm install package-name@latest
```

### Troubleshooting Build Issues

1. Clear Angular cache: `rm -rf .angular/cache`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check TypeScript errors: `ng build --configuration development`

## Production Considerations

### Build Optimization

- Output hashing enabled for production (angular.json:58)
- Source maps disabled in production
- License extraction enabled
- Bundle size budgets enforced

### Performance Budgets

Monitor bundle sizes carefully:
- Keep initial bundles under 500kB
- Keep component styles under 2kB

## Notes for Code Generation

### TypeScript Patterns to Follow

```typescript
// Use strict null checks
function example(value: string | null): void {
  if (value !== null) {
    console.log(value);
  }
}

// Explicit return types
function calculate(): number {
  return 42;
}

// Single quotes for strings
const message = 'Hello, World!';
```

### Angular Patterns to Follow

```typescript
// Component with proper typing
export class MyComponent {
  title: string = 'My Title';

  onClick(): void {
    // Handle click
  }
}

// Service with dependency injection
@Injectable({
  providedIn: 'root'
})
export class MyService {
  constructor(private http: HttpClient) {}
}
```

## Current Application State

The application is in its **initial state** with:

- Default Angular welcome screen (app.component.html)
- Single root component (AppComponent)
- Empty routing configuration
- No custom services or components yet
- All default Angular CLI scaffolding intact

## Next Steps for Development

Typical next steps would include:

1. Define application requirements
2. Plan component hierarchy
3. Set up routing structure
4. Create services for business logic
5. Implement components and views
6. Add state management (if needed)
7. Configure HTTP interceptors
8. Set up environment configurations
9. Add authentication/authorization
10. Implement error handling

---

**Last Updated**: 2025-12-09
**Angular Version**: 18.2.0
**Project Status**: Initial scaffolding - ready for development
