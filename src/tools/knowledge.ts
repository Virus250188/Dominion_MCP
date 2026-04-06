import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FRAMEWORK } from "../data/framework.js";
import { TILE_SPECS } from "../data/tile-specs.js";
import { PATTERNS } from "../data/patterns.js";
import { COMPONENTS } from "../data/components.js";

// ─── Knowledge Tools ──────────────────────────────────────────────────────
// These tools provide structured knowledge about the Dominion Enhanced App
// framework. An agent should call get_framework_overview first, then
// get_agent_workflow to understand the development flow.

export function registerKnowledgeTools(server: McpServer): void {
  // ── get_framework_overview ────────────────────────────────────────────
  server.tool(
    "get_framework_overview",
    "START HERE. Returns a high-level overview of the Enhanced App system, the plugin lifecycle, and what a developer needs to create. Call this FIRST before building any plugin, then call get_agent_workflow for the full development flow.",
    async () => {
      const text = [
        FRAMEWORK.overview,
        FRAMEWORK.lifecycle,
        FRAMEWORK.developerScope,
      ].join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );

  // ── get_agent_workflow ────────────────────────────────────────────────
  server.tool(
    "get_agent_workflow",
    "Returns the complete 10-step agent workflow for building a plugin from requirements to ZIP delivery. Call AFTER get_framework_overview to understand the tool call sequence and development flow.",
    async () => {
      return {
        content: [{ type: "text" as const, text: FRAMEWORK.agentWorkflow }],
      };
    },
  );

  // ── get_tile_size_spec ────────────────────────────────────────────────
  server.tool(
    "get_tile_size_spec",
    "Returns the detailed specification for a specific tile size, including ASCII diagram, pixel dimensions, stat limits, layout variants, and renderHints examples. Call when choosing or implementing a specific tile size.",
    {
      size: z
        .string()
        .describe('The tile size to get specs for: "1x1", "2x1", or "2x2"'),
    },
    async ({ size }) => {
      const validSizes = ["1x1", "2x1", "2x2"];
      if (!validSizes.includes(size)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Ungueltige Groesse: "${size}". Gueltige Groessen sind: ${validSizes.join(", ")}`,
            },
          ],
          isError: true,
        };
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

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );

  // ── get_tile_size_comparison ──────────────────────────────────────────
  server.tool(
    "get_tile_size_comparison",
    "Returns a comparison table of all three tile sizes and a decision guide for choosing the right size. Useful when deciding which sizes to support.",
    async () => {
      const text = [TILE_SPECS.comparison, TILE_SPECS.decisionGuide].join(
        "\n\n---\n\n",
      );

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );

  // ── get_data_contracts ────────────────────────────────────────────────
  server.tool(
    "get_data_contracts",
    "Returns the TypeScript data contracts: PluginStats, StatItem, ConfigField, StatOption interfaces, the fetchStats pattern with visibleStats, the widgetData pattern, and color conventions. Call BEFORE writing fetchStats logic.",
    async () => {
      const text = [
        PATTERNS.pluginStructure,
        PATTERNS.fetchStatsPattern,
        PATTERNS.widgetDataPattern,
        PATTERNS.colorConventions,
      ].join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );

  // ── get_widget_contract ───────────────────────────────────────────────
  server.tool(
    "get_widget_contract",
    "Returns the widget component contract: WidgetProps interface, widget rules, WidgetHeader usage, registration pattern, the TileDialog UX, and the Widget-Actions pattern. Call BEFORE implementing a widget component.",
    async () => {
      const text = [
        PATTERNS.widgetPattern,
        PATTERNS.widgetActionsPattern,
        PATTERNS.tileDialogUx,
      ].join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );

  // ── get_entity_crawler_spec ───────────────────────────────────────────
  server.tool(
    "get_entity_crawler_spec",
    "Returns the entity crawler specification: CrawlEntityGroup interface, when to implement, the Test-Crawl-Pick flow. Only needed for plugins with selectable entities (smart home, containers).",
    async () => {
      return {
        content: [
          { type: "text" as const, text: PATTERNS.crawlEntitiesPattern },
        ],
      };
    },
  );

  // ── get_performance_guidelines ────────────────────────────────────────
  server.tool(
    "get_performance_guidelines",
    "Returns performance rules and anti-patterns: timeouts, polling, rendering, tab behavior, and common mistakes. Good to check before finalizing plugin code.",
    async () => {
      const text = [PATTERNS.performanceRules, PATTERNS.antiPatterns].join(
        "\n\n---\n\n",
      );

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );

  // ── get_implementation_checklist ──────────────────────────────────────
  server.tool(
    "get_implementation_checklist",
    "Returns the complete implementation checklist covering all aspects of plugin development. Use as a final review before packaging.",
    async () => {
      return {
        content: [{ type: "text" as const, text: PATTERNS.checklist }],
      };
    },
  );

  // ── get_hello_world_example ──────────────────────────────────────────
  server.tool(
    "get_hello_world_example",
    "Returns a complete, minimal, working plugin example (Hello World) with manifest + index.ts. Shows correct imports, exports, error handling, and all patterns. Great starting point for understanding plugin structure.",
    async () => {
      return {
        content: [{ type: "text" as const, text: PATTERNS.helloWorldExample }],
      };
    },
  );

  // ── get_shared_utilities ─────────────────────────────────────────────
  server.tool(
    "get_shared_utilities",
    "Returns the full source code of the Dashboard's shared utility functions (getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions, formatBytes, formatUptime). Shows exactly what each function does so agents can use them correctly. The import `../../utils` resolves after deployment.",
    async () => {
      return {
        content: [{ type: "text" as const, text: PATTERNS.sharedUtilitiesSource }],
      };
    },
  );

  // ── get_shared_components ────────────────────────────────────────────
  server.tool(
    "get_shared_components",
    "Returns the source code and documentation of all shared widget components: WidgetHeader, CircularProgress, SparklineChart, HorizontalProgressBar, ControlButton. Shows props, usage examples, and the WidgetProps interface. Call when building a widget component.",
    async () => {
      const text = [
        COMPONENTS.overview,
        COMPONENTS.widgetHeader,
        COMPONENTS.circularProgress,
        COMPONENTS.sparklineChart,
        COMPONENTS.horizontalProgressBar,
        COMPONENTS.controlButton,
      ].join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );

  // ── get_deployment_guide ─────────────────────────────────────────────
  server.tool(
    "get_deployment_guide",
    "Returns the deployment and installation guide: how plugins are installed (ZIP upload via UI or manual), Docker considerations, ZIP structure, and upload validation rules. Call when preparing the final deliverable.",
    async () => {
      return {
        content: [{ type: "text" as const, text: FRAMEWORK.deployment }],
      };
    },
  );
}
