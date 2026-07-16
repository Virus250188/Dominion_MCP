import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { result, error } from "../lib/response.js";
import { validateManifestJson, validateManifest } from "../lib/validate.js";

export function registerValidationTools(server: McpServer): void {
  server.tool(
    "validate_manifest",
    "Validate a plugin.json against the v2 rules — SAME checks the dashboard runs at upload (apiVersion, kebab id, hex color, category, configFields incl. mandatory apiUrl, statOptions, sizes, widget nodes, api.mappings<->statOptions, notification rules, and the api-OR-adapter data-source rule). Pass the plugin.json text. Set hasAdapter=true if an adapter.js ships alongside. MUST pass before packaging.",
    {
      pluginJson: z.string().describe("the full plugin.json content as a string"),
      hasAdapter: z.boolean().default(false).describe("true if an adapter.js file ships with this plugin"),
    },
    async ({ pluginJson, hasAdapter }) => {
      const v = validateManifestJson(pluginJson, { hasAdapter });
      return result({ ok: v.ok, dataSource: v.dataSource, errors: v.errors, warnings: v.warnings });
    },
  );

  server.tool(
    "validate_widget",
    "Validate a single declarative widget node tree (the value you'd put under widgets['2x2']). Checks node types and required binding/template fields recursively. Reminder: widgets are only valid for 2x1/2x2.",
    {
      widget: z.string().describe("the widget node as a JSON string, e.g. {\"type\":\"column\",\"children\":[...]}"),
      size: z.enum(["2x1", "2x2"]).default("2x2"),
    },
    async ({ widget, size }) => {
      let node: unknown;
      try {
        node = JSON.parse(widget);
      } catch (err) {
        return error(`widget is not valid JSON: ${(err as Error).message}`);
      }
      // Reuse the manifest validator by embedding the node into a minimal manifest.
      const stub = {
        apiVersion: 2, id: "x", name: "x", version: "1.0.0", author: "x",
        description: "x", category: "Custom", icon: "x", color: "#000000",
        configFields: [{ key: "apiUrl", label: "URL", type: "url" }],
        statOptions: [{ key: "x", label: "x" }],
        supportedSizes: [size],
        widgets: { [size]: node },
        api: { stats: { path: "/" }, mappings: [{ key: "x", label: "x", path: "x" }] },
      };
      const v = validateManifest(stub);
      // Keep only widget-scoped messages.
      const widgetErrors = v.errors.filter((e) => e.startsWith("widgets."));
      return result({ ok: widgetErrors.length === 0, errors: widgetErrors, warnings: [] });
    },
  );
}
