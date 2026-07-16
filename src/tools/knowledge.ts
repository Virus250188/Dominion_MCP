import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { text, json } from "../lib/response.js";
import {
  STARTED, LIFECYCLE, ACTIONS_SPEC, MANIFEST_SPEC, CONTRACTS, REST_ADAPTER_SPEC, SANDBOX_SPEC,
  WIDGETS_SPEC, NOTIFICATIONS_SPEC, DEPLOYMENT_SPEC,
} from "../data/docs.js";
import {
  SYNC, PLUGIN_JSON_SCHEMA, EXAMPLE_PIHOLE_JSON, EXAMPLE_QBIT_JSON, EXAMPLE_QBIT_ADAPTER,
} from "../data/spec.js";

// Knowledge tools. All content is synced to the Dominion 2.0.0-beta dashboard.
// Includes lifecycle + actions docs (added with the Actions API).
export function registerKnowledgeTools(server: McpServer): void {
  server.tool(
    "get_started",
    "[START HERE] Orientation for building a Dominion Enhanced App plugin (format v2): folder layout, the two data-source paths (No-Code api vs adapter.js), tile roles, golden rules, and the full agent workflow. Call this first.",
    async () => text(`Synced to Dominion Dashboard ${SYNC.dashboardVersion} (commit ${SYNC.dashboardCommit}, ${SYNC.lastSynced}). Plugin apiVersion ${SYNC.pluginApiVersion}.\n\n${STARTED}`),
  );

  server.tool(
    "get_lifecycle_spec",
    "[READ BEFORE configFields] The app lifecycle AFTER upload: install -> add tile -> config modal (where credentials are collected — required:true matters!) -> testConnection -> encrypted save -> first fetchStats -> states (error/unconfigured) -> reconfigure. Prevents the classic 'credentials never asked' bug.",
    async () => text(LIFECYCLE),
  );

  server.tool(
    "get_actions_spec",
    "Interactive tiles: declare manifest.actions, execute via api.actions (No-Code) or exports.executeAction (adapter.js), and place \"button\" widget nodes. Server-side execution, confirm dialogs, params with validation, rate limits, refresh behavior.",
    async () => text(ACTIONS_SPEC),
  );

  server.tool(
    "get_contracts",
    "Exact runtime TypeScript contracts a plugin must honor: ConfigField, StatOption, StatItem, PluginStats, categories, tile sizes, OAuth config, and the entity crawler. Read before writing plugin.json or adapter.js.",
    async () => text(CONTRACTS),
  );

  server.tool(
    "get_manifest_spec",
    "Full field reference for plugin.json (format v2): required/optional fields, the api-vs-adapter data-source rule, and the mandatory apiUrl config field.",
    async () => text(MANIFEST_SPEC),
  );

  server.tool(
    "get_json_schema",
    "The formal JSON Schema (draft-07) for plugin.json, verbatim from docs/schemas/plugin.schema.json. Use it to machine-validate a manifest or to drive generation.",
    async () => json(PLUGIN_JSON_SCHEMA),
  );

  server.tool(
    "get_rest_adapter_spec",
    "[Data path 1: No-Code] The plugin.json \"api\" block: RestApiSpec/RestEndpoint/RestStatMapping, {config.*} templating, dot-path mapping, format semantics (number/bytes/percent/duration/raw), and widgetData. Use for simple JSON HTTP APIs — no code.",
    async () => text(REST_ADAPTER_SPEC),
  );

  server.tool(
    "get_adapter_sandbox_spec",
    "[Data path 2: code] The adapter.js sandbox: required/optional exports (fetchStats, testConnection, crawlEntities, checkNotifications), the exact available/forbidden globals, timeouts, and the guardedFetch SSRF/size rules. Use for login flows, multiple requests, or computed values.",
    async () => text(SANDBOX_SPEC),
  );

  server.tool(
    "get_widgets_spec",
    "The declarative widget Baukasten for 2x1/2x2 tiles: all 9 node types (stats, gauge, progress, sparkline, text, list, carousel, row, column), bindings, template strings, showIf, and nesting limits. No React.",
    async () => text(WIDGETS_SPEC),
  );

  server.tool(
    "get_notifications_spec",
    "How notifications and the notification API work: plugin-side checkNotifications + notificationRules (rule/tag matching, dedup), the PluginNotification shape, AND the external POST /api/notifications HTTP API (headers, body, responses, rate limits) for scripts/N8N/webhooks.",
    async () => text(NOTIFICATIONS_SPEC),
  );

  server.tool(
    "get_deployment_guide",
    "Packaging, ZIP upload via Einstellungen > Community Apps, runtime-loader behavior (PLUGINS_DIR, hot-load, no restart), catalog API, and v1->v2 migration.",
    async () => text(DEPLOYMENT_SPEC),
  );

  server.tool(
    "get_examples",
    "Two complete gold-standard example plugins to copy and adapt: pi-hole (No-Code api block + widget) and qbittorrent (adapter.js login/cookie flow + widget). Verbatim from docs/examples.",
    async () =>
      text(
        `# Example A — pi-hole (No-Code, api block only)\n\n` +
          `## plugin.json\n\`\`\`json\n${EXAMPLE_PIHOLE_JSON}\n\`\`\`\n\n` +
          `---\n\n# Example B — qbittorrent (adapter.js sandbox)\n\n` +
          `## plugin.json\n\`\`\`json\n${EXAMPLE_QBIT_JSON}\n\`\`\`\n\n` +
          `## adapter.js\n\`\`\`js\n${EXAMPLE_QBIT_ADAPTER}\n\`\`\``,
      ),
  );
}
