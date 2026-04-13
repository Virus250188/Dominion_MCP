import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FRAMEWORK } from "../data/framework.js";
import { TILE_SPECS } from "../data/tile-specs.js";
import { PATTERNS } from "../data/patterns.js";
import { COMPONENTS } from "../data/components.js";
import { success, error } from "./_response.js";

// ─── Knowledge Tools ──────────────────────────────────────────────────────
// These tools provide structured knowledge about the Dominion Enhanced App
// framework. An agent should call get_framework_overview first, then
// get_agent_workflow to understand the development flow.

export function registerKnowledgeTools(server: McpServer): void {
  // ── get_framework_overview ────────────────────────────────────────────
  server.tool(
    "get_framework_overview",
    "[Phase 1: Lernen] START HERE. Returns the Enhanced App system overview, plugin lifecycle, and developer scope. Call FIRST, then get_agent_workflow.",
    async () => {
      const text = [
        FRAMEWORK.overview,
        FRAMEWORK.lifecycle,
        FRAMEWORK.developerScope,
      ].join("\n\n---\n\n");

      return success(text);
    },
  );

  // ── get_agent_workflow ────────────────────────────────────────────────
  server.tool(
    "get_agent_workflow",
    "[Phase 1: Lernen] Returns the 4-phase requirements checklist and 10-step development flow. Call AFTER get_framework_overview.",
    async () => {
      return success(FRAMEWORK.agentWorkflow);
    },
  );

  // ── get_tile_size_spec ────────────────────────────────────────────────
  server.tool(
    "get_tile_size_spec",
    "[Phase 1: Lernen] Returns tile size spec with ASCII diagram, pixel dimensions, stat limits, and renderHints examples.",
    {
      size: z
        .string()
        .describe('The tile size to get specs for: "1x1", "2x1", or "2x2"'),
    },
    async ({ size }) => {
      const validSizes = ["1x1", "2x1", "2x2"];
      if (!validSizes.includes(size)) {
        return error(`Ungueltige Groesse: "${size}". Gueltige Groessen sind: ${validSizes.join(", ")}`);
      }

      const spec = TILE_SPECS[size as "1x1" | "2x1" | "2x2"];
      const text = [
        `# ${spec.name}`,
        "",
        `**Grid:** ${spec.gridSpans.columnSpan} Spalte(n) x ${spec.gridSpans.rowSpan} Zeile(n)`,
        `**Hoehe:** ${spec.height}`,
        `**Max Stats:** ${spec.maxStats}`,
        `**Layout:** ${spec.layout}`,
        `**Widget-Support:** ${spec.widgetSupport ? "Ja" : "Nein"}`,
        "",
        spec.spec,
      ].join("\n");

      return success(text);
    },
  );

  // ── get_tile_size_comparison ──────────────────────────────────────────
  server.tool(
    "get_tile_size_comparison",
    "[Phase 1: Lernen] Returns comparison table of all tile sizes and decision guide for choosing sizes.",
    async () => {
      const text = [TILE_SPECS.comparison, TILE_SPECS.decisionGuide].join(
        "\n\n---\n\n",
      );

      return success(text);
    },
  );

  // ── get_data_contracts ────────────────────────────────────────────────
  server.tool(
    "get_data_contracts",
    "[Phase 1: Lernen] Returns TypeScript data contracts: PluginStats, StatItem, ConfigField, StatOption, fetchStats pattern, widgetData, colors. **Includes a 'Stille Fallen' section** documenting the crawlEntities↔statOptions UI exclusivity, the CONNECTION_KEYS whitelist (apiUrl/apiKey/accessToken/username/password) that gates connection-reuse, and showForSizes per-size config. Call BEFORE writing code.",
    async () => {
      const text = [
        PATTERNS.pluginStructure,
        PATTERNS.fetchStatsPattern,
        PATTERNS.widgetDataPattern,
        PATTERNS.colorConventions,
      ].join("\n\n---\n\n");

      return success(text);
    },
  );

  // ── get_widget_contract ───────────────────────────────────────────────
  server.tool(
    "get_widget_contract",
    "[Phase 1: Lernen] Returns widget contract: WidgetProps, widget rules, WidgetHeader, TileDialog UX, Widget-Actions pattern. Call BEFORE implementing widgets.",
    async () => {
      const text = [
        PATTERNS.widgetPattern,
        PATTERNS.widgetActionsPattern,
        PATTERNS.tileDialogUx,
      ].join("\n\n---\n\n");

      return success(text);
    },
  );

  // ── get_entity_crawler_spec ───────────────────────────────────────────
  server.tool(
    "get_entity_crawler_spec",
    "[Phase 1: Lernen] Returns entity crawler spec: CrawlEntityGroup interface, Test-Crawl-Pick flow. Only for plugins with selectable entities.",
    async () => {
      return success(PATTERNS.crawlEntitiesPattern);
    },
  );

  // ── get_performance_guidelines ────────────────────────────────────────
  server.tool(
    "get_performance_guidelines",
    "[Phase 1: Lernen] Returns performance rules and anti-patterns: timeouts, polling, rendering, tab behavior. Check before finalizing code.",
    async () => {
      const text = [PATTERNS.performanceRules, PATTERNS.antiPatterns].join(
        "\n\n---\n\n",
      );

      return success(text);
    },
  );

  // ── get_implementation_checklist ──────────────────────────────────────
  server.tool(
    "get_implementation_checklist",
    "[Phase 4: Validieren] Returns the complete implementation checklist. Use as final review before packaging.",
    async () => {
      return success(PATTERNS.checklist);
    },
  );

  // ── get_hello_world_example ──────────────────────────────────────────
  server.tool(
    "get_hello_world_example",
    "[Phase 1: Lernen] Returns a complete Hello World plugin example (manifest + index.ts). Great starting point for understanding plugin structure.",
    async () => {
      return success(PATTERNS.helloWorldExample);
    },
  );

  // ── get_shared_utilities ─────────────────────────────────────────────
  server.tool(
    "get_shared_utilities",
    "[Phase 1: Lernen] Returns source code of shared utilities: getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions, formatBytes, formatUptime.",
    async () => {
      return success(PATTERNS.sharedUtilitiesSource);
    },
  );

  // ── get_shared_components ────────────────────────────────────────────
  server.tool(
    "get_shared_components",
    "[Phase 1: Lernen] Returns source code of shared widget components: WidgetHeader, CircularProgress, SparklineChart, HorizontalProgressBar, ControlButton.",
    async () => {
      const text = [
        COMPONENTS.overview,
        COMPONENTS.widgetHeader,
        COMPONENTS.circularProgress,
        COMPONENTS.sparklineChart,
        COMPONENTS.horizontalProgressBar,
        COMPONENTS.controlButton,
      ].join("\n\n---\n\n");

      return success(text);
    },
  );

  // ── get_app_design_guide ──────────────────────────────────────────────
  server.tool(
    "get_app_design_guide",
    "[Phase 2: Entwerfen] Returns app design guidance: Service-Type to Widget-Design mapping, TileDialog UX flow. Call AFTER get_framework_overview, BEFORE scaffold_plugin.",
    async () => {
      const text = [
        FRAMEWORK.appDesignGuidance,
        PATTERNS.widgetDesignByServiceType,
        PATTERNS.tileDialogFlow,
      ].join("\n\n---\n\n");

      return success(text);
    },
  );

  // ── get_notification_spec ─────────────────────────────────────────
  server.tool(
    "get_notification_spec",
    "[Phase 1: Lernen] Returns notification system spec (v1.3.0-beta): supportsNotifications + notificationRules catalog, PluginNotificationRule shape, tag→rule-ID filter semantics, checkNotifications contract, enableAppNotifications / updateNotificationRules server actions, TileDialog opt-in flow, webhook alternative, categories, SSE delivery. Required reading for any plugin that wants to emit notifications — the API changed, no more auto-provisioning.",
    async () => {
      return success(PATTERNS.notificationPattern);
    },
  );

  // ── get_deployment_guide ─────────────────────────────────────────────
  server.tool(
    "get_deployment_guide",
    "[Phase 6: Paketieren] Returns deployment and installation guide: ZIP upload, manual install, Docker, upload validation rules.",
    async () => {
      return success(FRAMEWORK.deployment);
    },
  );
}
