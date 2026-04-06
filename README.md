# Dominion Enhanced App MCP Server

An MCP (Model Context Protocol) server that helps AI agents develop Enhanced App plugins for the [Dominion Dashboard](https://github.com/Virus250188/Dominion_Public).

## What It Does

This MCP server acts as a **complete knowledge base and toolkit** for AI coding assistants. When connected, the agent can build a production-ready plugin **without ever needing access to the Dashboard source code** -- the result is a ZIP file ready for upload.

- **Knowledge Tools** -- Framework architecture, tile specs, data contracts, widget patterns, shared utilities & components source code
- **Scaffold Tools** -- Generate complete plugin code, widget components, and manifests
- **Validation Tools** -- Validate plugin structure, stats output, and render hints
- **Test Tools** -- Standalone code checks (no Dashboard access needed)
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
5. Call `validate_plugin_structure` to check for issues
6. Call `create_plugin_zip` to package everything as a ZIP
7. Hand you the ZIP file for upload via Dashboard UI

**No Dashboard access needed.** The agent works entirely in a separate directory and delivers a ZIP.

## Available Tools (24)

### Knowledge (12 tools)

| Tool | Description |
|------|-------------|
| `get_framework_overview` | **Start here.** System architecture, plugin lifecycle, developer scope |
| `get_agent_workflow` | Complete 10-step development workflow from requirements to ZIP |
| `get_tile_size_spec` | Detailed spec for a specific tile size (1x1, 2x1, 2x2) |
| `get_tile_size_comparison` | Comparison table + decision guide for all sizes |
| `get_data_contracts` | TypeScript interfaces, fetchStats patterns, color conventions |
| `get_widget_contract` | Widget props, WidgetHeader, registration, Widget-Actions pattern |
| `get_entity_crawler_spec` | CrawlEntityGroup interface, entity picker flow |
| `get_performance_guidelines` | Performance rules, anti-patterns, timeouts |
| `get_implementation_checklist` | Complete checklist for plugin development |
| `get_hello_world_example` | Complete minimal plugin example with manifest + code |
| `get_shared_utilities` | Source code of Dashboard utility functions (formatBytes, etc.) |
| `get_shared_components` | Source code of shared widget components (WidgetHeader, etc.) |
| `get_deployment_guide` | Docker deployment, ZIP upload, installation guide |

### Scaffold (3 tools)

| Tool | Description |
|------|-------------|
| `scaffold_plugin` | Generate complete plugin (manifest + index.ts + optional OAuth) |
| `scaffold_widget` | Generate widget component with size-specific layouts |
| `get_registration_steps` | Step-by-step guide for ZIP delivery and installation |

### Validation (3 tools)

| Tool | Description |
|------|-------------|
| `validate_plugin_structure` | Static analysis of plugin code (20+ checks) |
| `validate_stats_output` | Validate PluginStats JSON against schema |
| `validate_render_hints` | Validate renderHints for completeness and rules |

### Test (3 tools)

| Tool | Description |
|------|-------------|
| `test_plugin_completeness` | Verify all files, exports, and fields are present |
| `test_typescript_syntax` | Check bracket balance, imports, common mistakes |
| `test_plugin_export` | Verify export shape, required fields, async methods |

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

- **Tile Sizes**: 1x1 (compact stats), 2x1 (detailed/widget), 2x2 (full widget)
- **Auth Methods**: API Key, Username/Password, OAuth (framework-managed)
- **Widget Components**: Custom React components with WidgetHeader, shared UI components
- **Entity Crawling**: For services with selectable entities (smart home, containers)
- **ZIP Upload**: Package and upload plugins via Dashboard Settings > Plugins > Upload

### Installation Methods

1. **Dashboard UI (recommended):** Settings > Plugins > Upload > Select ZIP
2. **Manual:** Unzip into `src/plugins/community/`, restart server

Works with Docker, bare metal, and local development -- no special handling needed.

## Project Structure

```
src/
  index.ts                # Server entry point
  data/
    framework.ts          # Core system documentation + agent workflow + deployment
    patterns.ts           # Code patterns, hello world example, shared utilities
    tile-specs.ts         # Tile size specifications
    components.ts         # Widget shared component source code
  tools/
    knowledge.ts          # 12 knowledge retrieval tools
    scaffold.ts           # 3 code generation tools
    validate.ts           # 3 validation tools
    test.ts               # 3 standalone testing tools
    package.ts            # 1 ZIP packaging tool
    preview.ts            # 1 HTML preview tool
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

## Related Projects

- [Dominion Dashboard](https://github.com/Virus250188/Dominion_Public) -- The dashboard this MCP server supports

## License

[MIT](LICENSE)
