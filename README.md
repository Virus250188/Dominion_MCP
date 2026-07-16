# Dominion Enhanced App MCP Server (v3)

An MCP (Model Context Protocol) server that lets an AI agent build **Enhanced App
plugins** for the [Dominion Dashboard](https://github.com/Virus250188/Dominion_Public)
— **without any access to the dashboard source code**. The agent asks the tools
for the spec, generates a plugin, validates it against the dashboard's own rules,
previews it, and hands the user an upload-ready ZIP.

Current for **Dominion Dashboard 2.2.0-beta** (plugin **format v2** — runtime
`plugin.json` + optional sandboxed `adapter.js`; no TypeScript, no React, no build —
including the v2.1 **Actions API** for interactive tile buttons).

> **v3 is a breaking rewrite.** Dominion 2.0 replaced the old compile-time plugin
> system (TypeScript `index.ts` + React `.tsx` + esbuild) with a runtime loader.
> This server now teaches **only** the v2 format. v1 artifacts are rejected by the
> dashboard loader.

## What an agent can do with it

- **Learn the current framework** — `get_started`, `get_contracts`,
  `get_manifest_spec`, `get_json_schema`.
- **Fetch data two ways** — `get_rest_adapter_spec` (No-Code `api` block) or
  `get_adapter_sandbox_spec` (sandboxed `adapter.js`).
- **Build widgets** — `get_widgets_spec` (declarative Baukasten: stats, gauge,
  progress, sparkline, text, list, carousel, row, column).
- **Wire notifications & the API** — `get_notifications_spec` covers plugin-side
  `checkNotifications` + `notificationRules` **and** the external
  `POST /api/notifications` HTTP API.
- **Generate → validate → preview → package** — `scaffold_plugin`,
  `validate_manifest` (mirrors the dashboard validator 1:1), `validate_widget`,
  `preview_widget`, `create_plugin_zip`.

## Install

```bash
git clone https://github.com/Virus250188/Dominion_MCP.git
cd Dominion_MCP
npm install
npm run build
npm run smoke   # optional self-check
```

### Connect to Claude Code (or any MCP client)

```bash
# Global (all projects):
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
      "args": ["C:/path/to/Dominion_MCP/dist/index.js"]
    }
  }
}
```

## Usage

> "Build me a Pi-hole plugin that shows DNS queries, blocked count, and block rate."

The agent will: `get_started` → `get_contracts` → `get_manifest_spec` →
`get_rest_adapter_spec` → `get_widgets_spec` → `get_examples` → `scaffold_plugin`
→ fill in endpoints → `validate_manifest` → `preview_widget` → `create_plugin_zip`
→ hand you `pi-hole.zip`. You upload it via **Einstellungen > Community Apps** —
available immediately, no restart.

## Tools (17)

**Knowledge (12):** `get_started`, `get_lifecycle_spec`, `get_contracts`,
`get_manifest_spec`, `get_json_schema`, `get_rest_adapter_spec`,
`get_adapter_sandbox_spec`, `get_widgets_spec`, `get_actions_spec`,
`get_notifications_spec`, `get_deployment_guide`, `get_examples`.

**Build (5):** `scaffold_plugin`, `validate_manifest`, `validate_widget`,
`preview_widget`, `create_plugin_zip`.

## Plugin format v2 in one screen

```
my-plugin/
  plugin.json    # REQUIRED — apiVersion 2, metadata, configFields (incl. apiUrl),
                 #   statOptions, supportedSizes, optional widgets/api/notifications
  adapter.js     # OPTIONAL — sandboxed JS (fetchStats, testConnection, ...),
                 #   only when the No-Code api block is not enough
  README.md      # OPTIONAL
```

- Data source: **exactly one** of `api` block or `adapter.js`.
- `configFields` must include a field with key `apiUrl`.
- Widgets are declarative and only for `2x1`/`2x2`.
- `adapter.js` runs server-side in a `node:vm` sandbox: `fetch` (guarded), `console`,
  `JSON`, `Math`, `Date`, `URL`, `URLSearchParams` — no `require`/`process`/`fs`/timers.

## Knowledge sync

Hardcoded knowledge in `src/data/` is synced to the dashboard source. See the
`LAST_SYNCED` / `SYNC` markers. Current sync: **2026-07-14** — plugin contract of
Dashboard **v2.1.0-beta** (runtime plugin loader, No-Code REST adapter, adapter.js
sandbox, declarative widget toolkit, Actions API, SSE notification system). The
plugin format is unchanged in Dashboard **v2.2.0-beta**.

## License

[MIT](LICENSE)
