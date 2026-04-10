# Dominion MCP Server

## Purpose
MCP server providing AI agents with framework knowledge, scaffolding, validation, and packaging tools for building Dominion Dashboard apps. Hardcodes knowledge extracted from the Dashboard source.

## Git Setup
- **origin** → Virus250188/Dominion_MCP.git (PUBLIC)
- Default branch: `master` (not main)
- Branch convention: `feature/*` from `master`

## Architecture
- `src/index.ts` — MCP server entry point
- `src/tools/` — Tool implementations (knowledge, scaffold, validate, test, package, preview)
- `src/data/` — Hardcoded framework knowledge with LAST_SYNCED timestamps
  - `framework.ts` — Core architecture, lifecycle, API endpoints
  - `patterns.ts` — Code patterns, hello-world, shared utilities source
  - `tile-specs.ts` — Tile sizes, pixel dimensions, renderHints
  - `components.ts` — Widget shared component source code

## Development Commands
```
npm run build    # tsc compile
npm run dev      # tsc --watch
npm start        # Run MCP server
```

## Knowledge Sync Workflow
When core/ changes affect the plugin API:
1. `git checkout -b feature/sync-{topic}`
2. **Read** `../core/src/plugins/types.ts` and other contract files
3. Update the relevant file in `src/data/` with new knowledge
4. Update the LAST_SYNCED comment at the top of the file
5. Build and test: `npm run build && timeout 5 node dist/index.js`
6. Merge to master, push

## Workspace Read Access
This project has READ access to sibling directories for knowledge sync:
- `../core/src/plugins/` — Plugin API contract, types, utilities
- `../core/src/components/widgets/` — Shared widget components
- `../apps/` — App source code for pattern analysis

WRITE access is restricted to this directory only.

## Key Conventions
- Every tool must be self-documenting (clear name, description, inputSchema)
- Knowledge must trace back to actual Dashboard source code
- LAST_SYNCED timestamps must be updated when syncing
- Plugin scaffolds must produce valid Enhanced App structure

## Role
Focus on: MCP tools, framework knowledge accuracy, scaffold quality, validation.

Do NOT:
- Write to core/ or apps/
- Include raw Dashboard source in MCP responses (use contracts/specs)
- Invent API functions not present in the Dashboard
