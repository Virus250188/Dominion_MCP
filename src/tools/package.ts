import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import AdmZip from "adm-zip";
import * as fs from "node:fs";
import * as path from "node:path";
import { json, error } from "../lib/response.js";
import { validateManifestJson } from "../lib/validate.js";

export function registerPackageTools(server: McpServer): void {
  server.tool(
    "create_plugin_zip",
    "Validate then package a plugin into an upload-ready ZIP on disk. Files are placed under a top-level folder equal to the manifest id (folder name must equal id). Refuses to package if validation fails. Returns the absolute ZIP path to hand to the user for Einstellungen > Community Apps > Upload.",
    {
      pluginJson: z.string().describe("plugin.json content"),
      adapterJs: z.string().optional().describe("adapter.js content (omit for No-Code plugins)"),
      readme: z.string().optional().describe("README.md content (optional)"),
      outputDir: z.string().describe("absolute directory where the .zip should be written"),
    },
    async ({ pluginJson, adapterJs, readme, outputDir }) => {
      const v = validateManifestJson(pluginJson, { hasAdapter: !!adapterJs });
      if (!v.ok) {
        return error(
          "Refusing to package — plugin.json is invalid:\n" +
            v.errors.map((e) => `  - ${e}`).join("\n") +
            "\nFix these (validate_manifest) and retry.",
        );
      }

      let id: string;
      try {
        id = (JSON.parse(pluginJson) as { id: string }).id;
      } catch (err) {
        return error(`plugin.json parse failed: ${(err as Error).message}`);
      }

      try {
        fs.mkdirSync(outputDir, { recursive: true });
      } catch (err) {
        return error(`Cannot create outputDir: ${(err as Error).message}`);
      }

      const zip = new AdmZip();
      // Store files under <id>/ so a bare-metal unzip into PLUGINS_DIR is correct.
      zip.addFile(`${id}/plugin.json`, Buffer.from(pluginJson, "utf-8"));
      if (adapterJs) zip.addFile(`${id}/adapter.js`, Buffer.from(adapterJs, "utf-8"));
      if (readme) zip.addFile(`${id}/README.md`, Buffer.from(readme, "utf-8"));

      const zipPath = path.join(outputDir, `${id}.zip`);
      try {
        zip.writeZip(zipPath);
      } catch (err) {
        return error(`Failed to write ZIP: ${(err as Error).message}`);
      }

      const size = fs.statSync(zipPath).size;
      return json({
        ok: true,
        zipPath,
        bytes: size,
        contents: [`${id}/plugin.json`, ...(adapterJs ? [`${id}/adapter.js`] : []), ...(readme ? [`${id}/README.md`] : [])],
        warnings: v.warnings,
        install: "Einstellungen > Community Apps > ZIP hochladen. Available immediately (runtime loader).",
      });
    },
  );
}
