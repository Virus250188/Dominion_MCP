import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FRAMEWORK } from "../data/framework.js";
import { TILE_SPECS } from "../data/tile-specs.js";
import { PATTERNS } from "../data/patterns.js";

// ─── Knowledge Tools ──────────────────────────────────────────────────────
// These tools provide structured knowledge about the Dominion Enhanced App
// framework. An agent should call get_framework_overview first to understand
// the system before building anything.

export function registerKnowledgeTools(server: McpServer): void {
  // ── get_framework_overview ────────────────────────────────────────────
  server.tool(
    "get_framework_overview",
    "Returns a high-level overview of the Enhanced App system, the plugin lifecycle, and what a developer needs to create. Call this first before building any plugin.",
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

  // ── get_tile_size_spec ────────────────────────────────────────────────
  server.tool(
    "get_tile_size_spec",
    "Returns the detailed specification for a specific tile size, including ASCII diagram, pixel dimensions, stat limits, layout variants, and renderHints examples.",
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
    "Returns a comparison table of all three tile sizes and a decision guide for choosing the right size for a plugin.",
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
    "Returns the data contracts for plugins: PluginStats, StatItem, ConfigField, StatOption interfaces, the fetchStats pattern with visibleStats, and color conventions.",
    async () => {
      const text = [
        PATTERNS.pluginStructure,
        PATTERNS.fetchStatsPattern,
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
    "Returns the widget component contract: WidgetProps interface, widget rules, WidgetHeader usage, registration pattern, and shared components.",
    async () => {
      return {
        content: [{ type: "text" as const, text: PATTERNS.widgetPattern }],
      };
    },
  );

  // ── get_entity_crawler_spec ───────────────────────────────────────────
  server.tool(
    "get_entity_crawler_spec",
    "Returns the entity crawler specification: CrawlEntityGroup interface, when to implement, the Test-Crawl-Pick flow, and dual-format support in fetchStats.",
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
    "Returns performance rules and anti-patterns to avoid when building Enhanced Apps: timeouts, polling, rendering, tab behavior, and common mistakes.",
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
    "Returns the complete implementation checklist for building an Enhanced App, covering plugin file (in community/), shared utilities, fetchStats, testConnection, registration in community/index.ts, optional crawler, optional widget, and testing.",
    async () => {
      return {
        content: [{ type: "text" as const, text: PATTERNS.checklist }],
      };
    },
  );
}
