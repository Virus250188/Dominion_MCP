import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";
import { registerScaffoldTools } from "./tools/scaffold.js";
import { registerValidationTools } from "./tools/validate.js";
import { registerPackageTools } from "./tools/package.js";
import { registerPreviewTools } from "./tools/preview.js";
import { SYNC } from "./data/spec.js";

// ─── Dominion Enhanced App MCP Server (v3 — plugin format v2) ────────────────
//
// Teaches AI agents to build Dominion Dashboard Enhanced Apps for the CURRENT
// runtime plugin format (v2): a plugin.json manifest + optional sandboxed
// adapter.js. No TypeScript, no React, no build — the dashboard loads plugins
// at runtime. Synced to Dominion Dashboard 2.0.0-beta.
//
// Flow for the agent:
//   get_started -> get_contracts -> get_manifest_spec (+ get_json_schema)
//   -> pick data path: get_rest_adapter_spec (No-Code) | get_adapter_sandbox_spec
//   -> get_widgets_spec -> get_notifications_spec (if needed) -> get_examples
//   -> scaffold_plugin -> validate_manifest -> preview_widget -> create_plugin_zip

const server = new McpServer({
  name: "dominion-enhanced",
  version: "3.1.0",
  description:
    `Baut Dominion Enhanced Apps (Plugin-Format v2, Dashboard ${SYNC.dashboardVersion}). ` +
    "Ein Plugin = plugin.json (+ optional adapter.js). Kein TS, kein React, kein Build. " +
    "Tiles koennen interaktiv sein (actions + button-Node, serverseitig ausgefuehrt). " +
    "Start: get_started -> get_lifecycle_spec (PFLICHT vor configFields!) -> get_contracts, " +
    "get_manifest_spec, Datenpfad waehlen (get_rest_adapter_spec ODER get_adapter_sandbox_spec), " +
    "get_widgets_spec, get_actions_spec (bei Interaktivitaet), get_notifications_spec, " +
    "get_examples -> scaffold_plugin -> validate_manifest (Warnungen beheben!) -> " +
    "preview_widget -> create_plugin_zip.",
});

registerKnowledgeTools(server);
registerScaffoldTools(server);
registerValidationTools(server);
registerPackageTools(server);
registerPreviewTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Dominion MCP failed to start:", err);
  process.exit(1);
});
