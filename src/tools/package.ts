import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ─── Constants ───────────────────────────────────────────────────────────

const KEBAB_CASE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+/;
const MANIFEST_REQUIRED_FIELDS = ["id", "name", "version", "author", "description"] as const;

// ─── Types ───────────────────────────────────────────────────────────────

interface ManifestValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Manifest Validation ─────────────────────────────────────────────────

function validateManifest(manifestJson: string): ManifestValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestJson);
  } catch {
    return { valid: false, errors: ["Manifest ist kein gueltiges JSON."], warnings };
  }

  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return { valid: false, errors: ["Manifest muss ein JSON-Objekt sein."], warnings };
  }

  // Required fields
  for (const field of MANIFEST_REQUIRED_FIELDS) {
    const value = manifest[field];
    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`Pflichtfeld "${field}" fehlt oder ist leer.`);
    }
  }

  // ID must be kebab-case
  if (typeof manifest.id === "string" && !KEBAB_CASE_RE.test(manifest.id)) {
    errors.push(`"id" muss kebab-case sein (z.B. "mein-plugin"). Erhalten: "${manifest.id}"`);
  }

  // Version must be semver
  if (typeof manifest.version === "string" && !SEMVER_RE.test(manifest.version)) {
    errors.push(`"version" muss semver-Format haben (z.B. "1.0.0"). Erhalten: "${manifest.version}"`);
  }

  // Widget file check
  if (manifest.hasWidget === true && typeof manifest.widgetFile !== "string") {
    errors.push(`"hasWidget" ist true, aber "widgetFile" fehlt (z.B. "MeinWidget.tsx").`);
  }

  // Optional warnings
  if (!manifest.minDashboardVersion) {
    warnings.push(`"minDashboardVersion" nicht gesetzt. Empfohlen fuer Kompatibilitaetspruefung.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Plugin Code Quick-Check ─────────────────────────────────────────────

function quickValidateCode(pluginCode: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Must have export const plugin
  if (!/export\s+const\s+plugin\s*[=:]/.test(pluginCode)) {
    errors.push('Fehlender Export: `export const plugin: AppPlugin = { ... }`');
  }

  // Must have export const widget
  if (!/export\s+const\s+widget\s*=/.test(pluginCode)) {
    warnings.push('Fehlender Export: `export const widget = ...` (null falls kein Widget)');
  }

  // Must have export const widgetName
  if (!/export\s+const\s+widgetName\s*=/.test(pluginCode)) {
    warnings.push('Fehlender Export: `export const widgetName = ...` (null falls kein Widget)');
  }

  // Must have fetchStats
  if (!/fetchStats\s*[\(:]/.test(pluginCode) && !/async\s+fetchStats/.test(pluginCode)) {
    errors.push('Fehlende Funktion: `fetchStats`');
  }

  // Must have testConnection
  if (!/testConnection\s*[\(:]/.test(pluginCode) && !/async\s+testConnection/.test(pluginCode)) {
    errors.push('Fehlende Funktion: `testConnection`');
  }

  return { errors, warnings };
}

// ─── Widget Code Quick-Check ─────────────────────────────────────────────

function quickValidateWidget(widgetCode: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!widgetCode.includes('"use client"') && !widgetCode.includes("'use client'")) {
    errors.push('Widget muss `"use client"` Direktive am Anfang haben.');
  }

  if (!/export\s+(function|const|default)/.test(widgetCode)) {
    errors.push("Widget muss mindestens einen Export haben.");
  }

  if (!widgetCode.includes("WidgetHeader")) {
    warnings.push("Widget sollte `WidgetHeader` fuer eine konsistente Kopfzeile verwenden.");
  }

  return { errors, warnings };
}

// ─── Registration ────────────────────────────────────────────────────────

export function registerPackageTools(server: McpServer): void {
  server.tool(
    "create_plugin_zip",
    "FINAL STEP: Packages all plugin files into a ZIP for delivery. Validates manifest + code, then writes the ZIP to disk. Call this AFTER scaffold_plugin, code customization, and validate_plugin_structure. Returns the file path of the created ZIP.",
    {
      pluginId: z.string().describe("Plugin ID in kebab-case, e.g. 'my-plugin'. Must match manifest id."),
      manifestJson: z.string().describe("Full content of plugin.manifest.json as JSON string."),
      pluginCode: z.string().describe("Full content of index.ts (the plugin source code)."),
      widgetCode: z.string().optional().describe("Full content of the widget .tsx file (if plugin has a widget)."),
      widgetFileName: z.string().optional().describe("Filename for the widget, e.g. 'MyPluginWidget.tsx'. Required if widgetCode is provided."),
      typesCode: z.string().optional().describe("Optional content of a types.ts file for custom type definitions."),
      additionalFiles: z.array(z.object({
        fileName: z.string().describe("File name relative to plugin root, e.g. 'helpers.ts'"),
        content: z.string().describe("Full file content"),
      })).optional().describe("Additional files to include in the ZIP."),
      outputDir: z.string().optional().describe("Directory to write the ZIP file to. Defaults to the OS temp directory."),
    },
    async ({ pluginId, manifestJson, pluginCode, widgetCode, widgetFileName, typesCode, additionalFiles, outputDir }) => {
      // 1. Validate manifest
      const manifestResult = validateManifest(manifestJson);

      // Check pluginId matches manifest.id
      try {
        const manifest = JSON.parse(manifestJson);
        if (manifest.id && manifest.id !== pluginId) {
          manifestResult.errors.push(
            `pluginId "${pluginId}" stimmt nicht mit manifest.id "${manifest.id}" ueberein.`
          );
          manifestResult.valid = false;
        }
      } catch { /* already caught by validateManifest */ }

      // 2. Validate plugin code
      const codeResult = quickValidateCode(pluginCode);

      // 3. Validate widget code (if provided)
      if (widgetCode) {
        if (!widgetFileName) {
          codeResult.errors.push("widgetCode angegeben aber widgetFileName fehlt.");
        }
        const widgetResult = quickValidateWidget(widgetCode);
        codeResult.errors.push(...widgetResult.errors);
        codeResult.warnings.push(...widgetResult.warnings);
      }

      // 4. Collect all validation results
      const allErrors = [...manifestResult.errors, ...codeResult.errors];
      const hasBlockingErrors = allErrors.length > 0;

      // If there are blocking errors, report but still create ZIP (agent can fix and retry)
      // This is intentional: we want to help, not block

      // 5. Build ZIP in memory
      // Files go at ROOT level (no wrapper folder). The Dashboard's upload handler
      // extracts to src/plugins/community/{manifest.id}/ based on the manifest ID.
      // A wrapper folder causes issues because adm-zip.addFile() does not create
      // explicit directory entries, and the Dashboard's prefix detection relies on them.
      const zip = new AdmZip();
      const files: string[] = [];

      // Add manifest
      zip.addFile("plugin.manifest.json", Buffer.from(manifestJson, "utf-8"));
      files.push("plugin.manifest.json");

      // Add plugin code
      zip.addFile("index.ts", Buffer.from(pluginCode, "utf-8"));
      files.push("index.ts");

      // Add widget (if provided)
      if (widgetCode && widgetFileName) {
        zip.addFile(widgetFileName, Buffer.from(widgetCode, "utf-8"));
        files.push(widgetFileName);
      }

      // Add types (if provided)
      if (typesCode) {
        zip.addFile("types.ts", Buffer.from(typesCode, "utf-8"));
        files.push("types.ts");
      }

      // Add additional files
      if (additionalFiles) {
        for (const file of additionalFiles) {
          zip.addFile(file.fileName, Buffer.from(file.content, "utf-8"));
          files.push(file.fileName);
        }
      }

      // 6. Write ZIP to disk
      const targetDir = outputDir || os.tmpdir();
      const zipFileName = `${pluginId}.zip`;
      const zipPath = path.join(targetDir, zipFileName).replace(/\\/g, "/");

      try {
        // Ensure target directory exists
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        zip.writeZip(zipPath);
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: `Fehler beim Schreiben der ZIP-Datei: ${(err as Error).message}\n\nVersuchter Pfad: ${zipPath}`,
          }],
          isError: true,
        };
      }

      // 7. Build result report
      const statusIcon = hasBlockingErrors ? "WARNUNG" : "OK";
      const sections: string[] = [
        `# ZIP erstellt: ${statusIcon}`,
        "",
        `**Datei:** \`${zipPath}\``,
        `**Groesse:** ${fs.statSync(zipPath).size} Bytes`,
        "",
        "## Enthaltene Dateien",
        ...files.map((f) => `- \`${f}\``),
      ];

      if (allErrors.length > 0) {
        sections.push("", "## Validierungs-Fehler (sollten behoben werden)", ...allErrors.map((e) => `- ${e}`));
      }

      const allWarnings = [...manifestResult.warnings, ...codeResult.warnings];
      if (allWarnings.length > 0) {
        sections.push("", "## Hinweise", ...allWarnings.map((w) => `- ${w}`));
      }

      sections.push(
        "",
        "## Naechste Schritte",
        "",
        "Der User kann die ZIP-Datei auf zwei Wegen installieren:",
        "1. **Dashboard UI:** Einstellungen > Plugins > Upload > ZIP-Datei auswaehlen",
        "2. **Manuell:** ZIP entpacken und Ordner nach `src/plugins/community/` kopieren, dann Server neustarten",
      );

      return {
        content: [{
          type: "text" as const,
          text: sections.join("\n"),
        }],
      };
    },
  );
}
