# Dominion Enhanced App MCP Server

An MCP (Model Context Protocol) server that helps AI agents develop Enhanced App plugins for the [Dominion Dashboard](https://github.com/Virus250188/Dominion_Public).

## What It Does

This MCP server acts as a knowledge base and toolkit for AI coding assistants. When connected, the agent gains access to:

- **Knowledge Tools** -- Framework architecture, tile size specs, data contracts, widget patterns
- **Scaffold Tools** -- Generate complete plugin code, widget components, and manifests
- **Validation Tools** -- Validate plugin structure, stats output, and render hints
- **Test Tools** -- Check file existence, verify exports, run build compilation
- **Preview Tools** -- Generate HTML tile previews in the Dashboard's glass theme

The agent can build a complete, ready-to-use plugin without ever needing to read the Dashboard source code.

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
2. Call `scaffold_plugin` to generate the code + manifest
3. Call `preview_tile` to show you a visual preview
4. Write all files to a working directory

You get a ready-to-use plugin folder that you can ZIP and upload to your Dashboard.

## Available Tools

### Knowledge (7 tools)

| Tool | Description |
|------|-------------|
| `get_framework_overview` | System architecture, plugin lifecycle, developer scope |
| `get_tile_size_spec` | Detailed spec for a specific tile size (1x1, 2x1, 2x2) |
| `get_tile_size_comparison` | Comparison table + decision guide for all sizes |
| `get_data_contracts` | TypeScript interfaces, fetchStats patterns, color conventions |
| `get_widget_contract` | Widget props, WidgetHeader, registration, TileDialog UX |
| `get_entity_crawler_spec` | CrawlEntityGroup interface, entity picker flow |
| `get_performance_guidelines` | Performance rules, anti-patterns, implementation checklist |

### Scaffold (3 tools)

| Tool | Description |
|------|-------------|
| `scaffold_plugin` | Generate complete plugin (manifest + index.ts + optional OAuth) |
| `scaffold_widget` | Generate widget component with size-specific layouts |
| `get_registration_steps` | Step-by-step guide for registering a plugin |

### Validation (3 tools)

| Tool | Description |
|------|-------------|
| `validate_plugin_structure` | Static analysis of plugin TypeScript code |
| `validate_stats_output` | Validate PluginStats JSON against schema |
| `validate_render_hints` | Validate renderHints for completeness and rules |

### Test (3 tools)

| Tool | Description |
|------|-------------|
| `test_plugin_files` | Check if all required files exist in the Dashboard |
| `test_build_compile` | Run `npm run build` in the Dashboard project |
| `test_plugin_export` | Verify export shape, required fields, async methods |

### Preview (1 tool)

| Tool | Description |
|------|-------------|
| `preview_tile` | Generate HTML preview with glass-dark theme and real tile dimensions |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DASHBOARD_PATH` | Path to the Dominion Dashboard project (required for test tools) | _(none)_ |

Set `DASHBOARD_PATH` if you want the test tools to verify files against a local Dashboard installation.

## Plugin Development

For a complete guide on building plugins, see [plugin-development.md](plugin-development.md).

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
- **ZIP Upload**: Package and upload plugins via Dashboard settings

## Project Structure

```
src/
  index.ts                # Server entry point
  data/
    framework.ts          # Core system documentation (~500 lines)
    patterns.ts           # Code patterns and anti-patterns (~1500 lines)
    tile-specs.ts         # Tile size specifications (~380 lines)
  tools/
    knowledge.ts          # 7 knowledge retrieval tools
    scaffold.ts           # 3 code generation tools
    validate.ts           # 3 validation tools
    test.ts               # 3 testing tools
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
