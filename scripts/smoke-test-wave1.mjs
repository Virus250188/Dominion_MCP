#!/usr/bin/env node
/**
 * Wave 1 Smoke Test.
 *
 * Runs validate_plugin against the existing apps and prints
 * errors/warnings categorised by the K1-K5 rules, so we can
 * see if our new rules fire (expected) or misfire (false positives).
 */

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPS_DIR = join(__dirname, "..", "..", "apps");

const { registerValidationTools } = await import("../dist/tools/validate.js");

// Collect tools by spying on the tool registration
const tools = new Map();
const fakeServer = {
  tool(name, _desc, _schema, handler) {
    const h = typeof _schema === "function" ? _schema : handler;
    tools.set(name, h);
  },
};
registerValidationTools(fakeServer);

async function validateApp(appName) {
  const appDir = join(APPS_DIR, appName);
  const pluginCode = await readFile(join(appDir, "index.ts"), "utf8");
  const manifestJson = await readFile(
    join(appDir, "plugin.manifest.json"),
    "utf8",
  );

  let widgetCode;
  let widgetFileName;
  try {
    const manifest = JSON.parse(manifestJson);
    if (manifest.hasWidget && manifest.widgetFile) {
      widgetCode = await readFile(join(appDir, manifest.widgetFile), "utf8");
      widgetFileName = manifest.widgetFile;
    }
  } catch {}

  const validate = tools.get("validate_plugin");
  if (!validate) throw new Error("validate_plugin tool not registered");

  const res = await validate({
    pluginCode,
    pluginId: appName,
    manifestJson,
    widgetCode,
    widgetFileName,
  });

  const payload = JSON.parse(res.content[0].text);
  return payload;
}

const apps = ["home-assistant", "opnsense", "unraid"];
for (const app of apps) {
  console.log(`\n━━━━ ${app} ━━━━`);
  try {
    const res = await validateApp(app);
    console.log(`passed: ${res.passed}`);
    console.log(`errors (${res.errors.length}):`);
    for (const e of res.errors) {
      console.log(`  - ${e.message}`);
    }
    console.log(`warnings (${res.warnings.length}):`);
    for (const w of res.warnings) {
      console.log(`  - ${w.message}`);
    }
  } catch (err) {
    console.log(`  ✗ ${err.message}`);
  }
}
