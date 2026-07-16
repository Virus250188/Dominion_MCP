import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { json, error } from "../lib/response.js";
import { validateManifest } from "../lib/validate.js";
import { CATEGORIES, TILE_SIZES, STAT_FORMATS } from "../data/spec.js";
import { buildAdapterStub, buildReadme } from "./scaffold-templates.js";

const authPresets = {
  apikey: [
    { key: "apiUrl", label: "URL", type: "url", placeholder: "http://192.168.1.2", required: true },
    { key: "apiKey", label: "API Key", type: "password", required: true },
  ],
  userpass: [
    { key: "apiUrl", label: "URL", type: "url", placeholder: "http://192.168.1.2", required: true },
    { key: "username", label: "Benutzername", type: "text", required: true },
    { key: "password", label: "Passwort", type: "password", required: true },
  ],
  none: [
    { key: "apiUrl", label: "URL", type: "url", placeholder: "http://192.168.1.2", required: true },
  ],
} as const;

const statSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string().optional(),
  defaultEnabled: z.boolean().optional(),
});

const mappingSchema = z.object({
  key: z.string().describe("must match a statOptions[].key"),
  label: z.string(),
  path: z.string().describe("dot-path into the JSON response, e.g. a.b.0.c"),
  format: z.enum(STAT_FORMATS).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const ruleSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  defaultEnabled: z.boolean(),
});

export function registerScaffoldTools(server: McpServer): void {
  server.tool(
    "scaffold_plugin",
    "Generate a complete, validated plugin skeleton (files map: plugin.json + optional adapter.js + README.md). Choose mode 'nocode' (fills the api block from statsPath+mappings) or 'adapter' (emits an adapter.js stub with fetchStats/testConnection). The result is auto-validated; fix any reported errors before packaging.",
    {
      id: z.string().describe("kebab-case, must equal the plugin folder name, e.g. 'pi-hole'"),
      name: z.string(),
      author: z.string(),
      description: z.string(),
      category: z.enum(CATEGORIES),
      icon: z.string().describe("simple-icons slug or Lucide name"),
      color: z.string().describe("hex #rrggbb"),
      website: z.string().optional(),
      auth: z.enum(["apikey", "userpass", "none"]).describe("preset for configFields; 'apiUrl' is always included"),
      supportedSizes: z.array(z.enum(TILE_SIZES)).min(1).default(["1x1", "2x1", "2x2"]),
      statOptions: z.array(statSchema).min(1),
      mode: z.enum(["nocode", "adapter"]),
      statsPath: z.string().optional().describe("[nocode] endpoint path for the stats request, e.g. '/api/status?token={config.apiKey}'"),
      mappings: z.array(mappingSchema).optional().describe("[nocode] JSON path mappings; each key must match a statOption"),
      widgetData: z.record(z.string(), z.string()).optional().describe("[nocode] response paths copied 1:1 into widgetData for widgets"),
      includeWidget2x2: z.boolean().default(false).describe("emit a simple 2x2 widget (stats grid)"),
      supportsNotifications: z.boolean().default(false),
      notificationRules: z.array(ruleSchema).optional(),
    },
    async (args) => {
      const files: Record<string, string> = {};

      const manifest: Record<string, unknown> = {
        $schema: "../../schemas/plugin.schema.json",
        apiVersion: 2,
        id: args.id,
        name: args.name,
        version: "1.0.0",
        author: args.author,
        description: args.description,
        category: args.category,
        icon: args.icon,
        color: args.color,
      };
      if (args.website) manifest.website = args.website;

      manifest.configFields = [...authPresets[args.auth]];
      manifest.statOptions = args.statOptions.map((s) => ({ defaultEnabled: true, ...s }));
      manifest.supportedSizes = args.supportedSizes;

      if (args.includeWidget2x2 && args.supportedSizes.includes("2x2")) {
        manifest.widgets = { "2x2": { type: "column", gap: 10, children: [{ type: "stats", max: 4 }] } };
      }

      if (args.mode === "nocode") {
        if (!args.statsPath || !args.mappings || args.mappings.length === 0) {
          return error("mode 'nocode' requires statsPath and at least one mapping. Provide statsPath and mappings, or use mode 'adapter'.");
        }
        const api: Record<string, unknown> = {
          stats: { path: args.statsPath },
          mappings: args.mappings,
        };
        if (args.widgetData) api.widgetData = args.widgetData;
        manifest.api = api;
      }

      if (args.supportsNotifications) {
        manifest.supportsNotifications = true;
        manifest.notificationRules =
          args.notificationRules && args.notificationRules.length > 0
            ? args.notificationRules
            : [{ id: "status-change", label: "Statuswechsel", description: "Dienst wechselt online/offline", severity: "warning", defaultEnabled: true }];
      }

      files["plugin.json"] = JSON.stringify(manifest, null, 2);

      if (args.mode === "adapter") {
        files["adapter.js"] = buildAdapterStub(args.auth, args.statOptions.map((s) => s.key), args.supportsNotifications);
      }

      files["README.md"] = buildReadme(args.name, args.description, args.mode);

      const validation = validateManifest({ ...manifest }, { hasAdapter: args.mode === "adapter" });

      return json({
        ok: validation.ok,
        dataSource: validation.dataSource,
        errors: validation.errors,
        warnings: validation.warnings,
        folderName: args.id,
        files,
        next: validation.ok
          ? "Fill in TODOs (endpoints/logic), then validate_manifest -> preview_widget -> create_plugin_zip."
          : "Fix the errors above, then re-run validate_manifest.",
      });
    },
  );
}
