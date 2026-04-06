import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";
import { registerScaffoldTools } from "./tools/scaffold.js";
import { registerValidationTools } from "./tools/validate.js";
import { registerTestTools } from "./tools/test.js";
import { registerPreviewTools } from "./tools/preview.js";
import { registerPackageTools } from "./tools/package.js";

// ─── Dominion Enhanced App MCP Server ────────────────────────────────────
//
// This MCP server helps AI agents develop Enhanced Apps (plugins) for the
// Dominion Dashboard. It provides:
//
//   Knowledge Tools  - Framework specs, tile sizes, data contracts, workflow
//   Scaffold Tools   - Plugin & widget code generation
//   Validation Tools - Static analysis of plugin code & stats output
//   Test Tools       - Standalone code checks (no Dashboard access needed)
//   Package Tools    - ZIP creation for plugin delivery
//
// Start by calling get_framework_overview, then get_agent_workflow.

const server = new McpServer({
  name: "dominion-enhanced",
  version: "2.0.0",
});

// Register all tool groups
registerKnowledgeTools(server);
registerScaffoldTools(server);
registerValidationTools(server);
registerTestTools(server);
registerPreviewTools(server);
registerPackageTools(server);

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP Server failed to start:", err);
  process.exit(1);
});
