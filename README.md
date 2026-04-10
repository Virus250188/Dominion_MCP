# Dominion Enhanced App MCP Server

An MCP (Model Context Protocol) server that helps AI agents develop Enhanced App plugins for the [Dominion Dashboard](https://github.com/Virus250188/Dominion_Public).

## What It Does

This MCP server acts as a **complete knowledge base and toolkit** for AI coding assistants. When connected, the agent can build a production-ready plugin **without ever needing access to the Dashboard source code** -- the result is a ZIP file ready for upload.

- **Knowledge Tools** -- Framework architecture, tile specs, data contracts, widget patterns, notification system, shared utilities & components source code
- **Scaffold Tools** -- Generate complete plugin code, widget components, manifests, and READMEs
- **Validation Tools** -- Validate plugin structure, stats output, and render hints against 20+ rules
- **Test Tools** -- Standalone TypeScript syntax checks (no Dashboard access needed)
- **Package Tools** -- Create ready-to-upload ZIP files
- **Preview Tools** -- Generate HTML tile previews in the Dashboard's glass theme

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Claude Code](https://claude.ai/claude-code) or any MCP-compatible client

### Installation

```bash
git clone https://github.com/Virus250188/Dominion_MCP.git
cd Dominion_MCP
npm install
npm run build
```

### Connect to Claude Code

```bash
# Global (available in all projects):
claude mcp add --transport stdio --scope user dominion-mcp -- node /path/to/Dominion_MCP/dist/index.js

# Windows:
claude mcp add --transport stdio --scope user dominion-mcp -- cmd /c node "C:/path/to/Dominion_MCP/dist/index.js"
```

Or add manually to `~/.claude.json`:

```json
{
  "mcpServers": {
    "dominion-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/Dominion_MCP/dist/index.js"]
    }
  }
}
```

### Verify

```bash
claude mcp list
# dominion-mcp: ... - Connected
```

## Usage

Once connected, ask your AI agent to build a plugin:

> "Build me a Pi-hole plugin that shows DNS queries, blocked count, and block percentage"

The agent will:
1. Call `get_framework_overview` to understand the system
2. Call `get_agent_workflow` to learn the development flow
3. Call `scaffold_plugin` to generate the code + manifest
4. Customize the generated code (fill in API endpoints, auth, labels)
5. Call `validate_plugin` to check for issues
6. Call `preview_tile` to see a visual preview
7. Call `create_plugin_zip` to package everything as a ZIP
8. Hand you the ZIP file for upload via Dashboard UI

**No Dashboard access needed.** The agent works entirely in a separate directory and delivers a ZIP.

## Available Tools (25)

### Knowledge (15 tools)

| Tool | Description |
|------|-------------|
| `get_framework_overview` | **Start here.** System architecture, plugin lifecycle, developer scope |
| `get_agent_workflow` | Complete 10-step development workflow from requirements to ZIP |
| `get_app_design_guide` | Service-type to widget-design mapping, proactive design suggestions |
| `get_tile_size_spec` | Detailed spec for a specific tile size (1x1, 2x1, 2x2) |
| `get_tile_size_comparison` | Comparison table + decision guide for all sizes |
| `get_data_contracts` | TypeScript interfaces, fetchStats patterns, color conventions |
| `get_widget_contract` | Widget props, WidgetHeader, registration, Widget-Actions pattern |
| `get_entity_crawler_spec` | CrawlEntityGroup interface, entity picker flow |
| `get_notification_spec` | Notification system: supportsNotifications, webhook API, categories |
| `get_performance_guidelines` | Performance rules, anti-patterns, timeouts |
| `get_implementation_checklist` | Complete checklist for plugin development |
| `get_hello_world_example` | Complete minimal plugin example with manifest + code |
| `get_shared_utilities` | Source code of Dashboard utility functions (formatBytes, etc.) |
| `get_shared_components` | Source code of shared widget components (WidgetHeader, etc.) |
| `get_deployment_guide` | ZIP upload, manual install, Docker, upload validation rules |

### Scaffold (4 tools)

| Tool | Description |
|------|-------------|
| `scaffold_plugin` | Generate complete plugin (manifest + index.ts + optional OAuth/Crawler) |
| `scaffold_widget` | Generate widget component with size-specific layouts and configurable icon |
| `get_registration_steps` | Step-by-step guide for ZIP delivery and installation |
| `generate_readme` | Generate a README.md for the plugin in Dominion docs format |

### Validation (3 tools)

| Tool | Description |
|------|-------------|
| `validate_plugin` | Static analysis of plugin code, manifest, and widget (25+ checks with fix suggestions) |
| `validate_stats_output` | Validate PluginStats JSON against schema (items, colors, status) |
| `validate_render_hints` | Validate renderHints for completeness, layout-per-size rules, widget consistency |

### Test (1 tool)

| Tool | Description |
|------|-------------|
| `test_typescript_syntax` | Check bracket balance, imports, console.log usage, common mistakes |

### Package (1 tool)

| Tool | Description |
|------|-------------|
| `create_plugin_zip` | Package plugin files into a ZIP for upload (writes to disk) |

### Preview (1 tool)

| Tool | Description |
|------|-------------|
| `preview_tile` | Generate HTML preview with glass-dark theme and real tile dimensions |

## Plugin Development

Quick overview of the plugin structure:

```
my-plugin/
  plugin.manifest.json    # Required: id, name, version, author, description
  index.ts                # Required: export const plugin, widget, widgetName
  MyPluginWidget.tsx       # Optional: Widget for 2x1/2x2 tiles
```

### Supported Features

- **Tile Sizes**: 1x1 (compact stats), 2x1 (detailed/mini-widget), 2x2 (full premium widget)
- **Auth Methods**: API Key, Username/Password, OAuth (framework-managed flow)
- **Widget Components**: Custom React components with WidgetHeader, shared UI components
- **Entity Crawling**: For services with selectable entities (smart home, containers)
- **Notifications**: Plugins can declare `supportsNotifications: true` to enable webhook-based notifications (info, warning, critical, update)
- **ZIP Upload**: Package and upload plugins via Dashboard Settings > Plugins > Upload
- **Auto-Discovery**: Drop plugin folder + restart -- no core files to edit

### Tile Sizes = Roles

Each size serves a different purpose on the dashboard:

| Size | Role | Content |
|------|------|---------|
| **1x1** | Status indicator | 1-3 key stats, no widget |
| **2x1** | Detail or mini-widget | Up to 6 stats OR compact widget |
| **2x2** | Visual premium widget | Full widget with charts, carousels, grids |

Users can have **multiple tiles** of the same app (e.g., a 1x1 for quick status + a 2x2 for the full widget), each with their own display settings but sharing the same connection.

### Installation Methods

1. **Dashboard UI (recommended):** Settings > Plugins > Upload > Select ZIP
2. **Manual:** Unzip into `src/plugins/community/`, restart server

Works with Docker, bare metal, and local development -- no special handling needed.

## Project Structure

```
src/
  index.ts                # Server entry point (v2.2.0)
  data/
    framework.ts          # Core architecture, lifecycle, API endpoints, notifications
    patterns.ts           # Code patterns, notifications, shared utilities, anti-patterns
    tile-specs.ts         # Tile size specifications with ASCII diagrams
    components.ts         # Widget shared component source code (1:1 with Dashboard)
  tools/
    knowledge.ts          # 15 knowledge retrieval tools
    scaffold.ts           # 4 code generation tools
    validate.ts           # 3 validation tools (25+ checks)
    test.ts               # 1 standalone testing tool
    package.ts            # 1 ZIP packaging tool
    preview.ts            # 1 HTML preview tool
    _response.ts          # Shared response formatting helpers
```

## Development

```bash
# Watch mode (auto-rebuild on changes):
npm run dev

# Build once:
npm run build

# Run the server directly:
npm start
```

## Knowledge Sync

The hardcoded knowledge in `src/data/` is synced against the Dashboard source code. Each file has a `LAST_SYNCED` timestamp. Current sync: **2026-04-10** (Dashboard v1.0.7-alpha).

## Related Projects

- [Dominion Dashboard](https://github.com/Virus250188/Dominion_Public) -- The dashboard this MCP server supports

## License

[MIT](LICENSE)
