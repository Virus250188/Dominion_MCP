import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { success, error } from "./_response.js";
import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ─── Constants ───────────────────────────────────────────────────────────

const KEBAB_CASE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+/;
const MANIFEST_REQUIRED_FIELDS = ["id", "name", "version", "author", "description"] as const;
const MAX_FILE_SIZE = 512 * 1024;       // 500KB per file
const MAX_TOTAL_SIZE = 2 * 1024 * 1024; // 2MB total

// ─── Types ───────────────────────────────────────────────────────────────

interface ManifestValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Security Helpers ───────────────────────────────────────────────────

function isUnsafeFileName(fileName: string): boolean {
  return (
    fileName.includes("..") ||
    fileName.includes("\\") ||
    path.isAbsolute(fileName) ||
    fileName.startsWith("/") ||
    fileName.includes("\0")
  );
}

function checkContentSize(content: string, fileName: string): string | null {
  const size = Buffer.byteLength(content, "utf-8");
  if (size > MAX_FILE_SIZE) {
    return `Datei "${fileName}" ist ${Math.round(size / 1024)}KB gross, Maximum ist ${Math.round(MAX_FILE_SIZE / 1024)}KB.`;
  }
  return null;
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

  for (const field of MANIFEST_REQUIRED_FIELDS) {
    const value = manifest[field];
    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`Pflichtfeld "${field}" fehlt oder ist leer.`);
    }
  }

  if (typeof manifest.id === "string" && !KEBAB_CASE_RE.test(manifest.id)) {
    errors.push(`"id" muss kebab-case sein (z.B. "mein-plugin"). Erhalten: "${manifest.id}"`);
  }

  if (typeof manifest.version === "string" && !SEMVER_RE.test(manifest.version)) {
    errors.push(`"version" muss semver-Format haben (z.B. "1.0.0"). Erhalten: "${manifest.version}"`);
  }

  if (manifest.hasWidget === true && typeof manifest.widgetFile !== "string") {
    errors.push(`"hasWidget" ist true, aber "widgetFile" fehlt (z.B. "MeinWidget.tsx").`);
  }

  if (!manifest.minDashboardVersion) {
    warnings.push(`"minDashboardVersion" nicht gesetzt. Empfohlen fuer Kompatibilitaetspruefung.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Plugin Code Quick-Check ─────────────────────────────────────────────

function quickValidateCode(pluginCode: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!/export\s+const\s+plugin\s*[=:]/.test(pluginCode)) {
    errors.push('Fehlender Export: `export const plugin: AppPlugin = { ... }`');
  }

  if (!/export\s+const\s+widget\s*=/.test(pluginCode)) {
    warnings.push('Fehlender Export: `export const widget = ...` (null falls kein Widget)');
  }

  if (!/export\s+const\s+widgetName\s*=/.test(pluginCode)) {
    warnings.push('Fehlender Export: `export const widgetName = ...` (null falls kein Widget)');
  }

  if (!/fetchStats\s*[\(:]/.test(pluginCode) && !/async\s+fetchStats/.test(pluginCode)) {
    errors.push('Fehlende Funktion: `fetchStats`');
  }

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
    "[Phase 6: Paketieren] FINAL STEP. Packages plugin files into a validated ZIP. Call AFTER validate_plugin. Returns file path of the created ZIP.",
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
    },
    async ({ pluginId, manifestJson, pluginCode, widgetCode, widgetFileName, typesCode, additionalFiles }) => {
      // ── Security: Validate pluginId ───────────────────────────────────
      if (!KEBAB_CASE_RE.test(pluginId)) {
        return error(`Ungueltige Plugin-ID: "${pluginId}". Muss kebab-case sein (a-z, 0-9, -).`);
      }

      // ── Security: Validate file names ─────────────────────────────────
      if (widgetFileName && isUnsafeFileName(widgetFileName)) {
        return error(`Ungueltiger Widget-Dateiname: "${widgetFileName}". Nur relative Pfade ohne ".." erlaubt.`);
      }

      if (additionalFiles) {
        for (const file of additionalFiles) {
          if (isUnsafeFileName(file.fileName)) {
            return error(`Ungueltiger Dateiname: "${file.fileName}". Nur relative Pfade ohne ".." erlaubt.`);
          }
        }
      }

      // ── Security: Check file sizes ────────────────────────────────────
      let totalSize = Buffer.byteLength(manifestJson, "utf-8") + Buffer.byteLength(pluginCode, "utf-8");

      const sizeError = checkContentSize(pluginCode, "index.ts");
      if (sizeError) return error(sizeError);

      if (widgetCode) {
        const wErr = checkContentSize(widgetCode, widgetFileName || "widget.tsx");
        if (wErr) return error(wErr);
        totalSize += Buffer.byteLength(widgetCode, "utf-8");
      }

      if (typesCode) {
        const tErr = checkContentSize(typesCode, "types.ts");
        if (tErr) return error(tErr);
        totalSize += Buffer.byteLength(typesCode, "utf-8");
      }

      if (additionalFiles) {
        for (const file of additionalFiles) {
          const aErr = checkContentSize(file.content, file.fileName);
          if (aErr) return error(aErr);
          totalSize += Buffer.byteLength(file.content, "utf-8");
        }
      }

      if (totalSize > MAX_TOTAL_SIZE) {
        return error(`Gesamt-Inhalt ist ${Math.round(totalSize / 1024)}KB, Maximum ist ${Math.round(MAX_TOTAL_SIZE / 1024)}KB.`);
      }

      // ── Validate manifest ─────────────────────────────────────────────
      const manifestResult = validateManifest(manifestJson);

      try {
        const manifest = JSON.parse(manifestJson);
        if (manifest.id && manifest.id !== pluginId) {
          manifestResult.errors.push(
            `pluginId "${pluginId}" stimmt nicht mit manifest.id "${manifest.id}" ueberein.`
          );
          manifestResult.valid = false;
        }
      } catch { /* already caught by validateManifest */ }

      // ── Validate plugin code ──────────────────────────────────────────
      const codeResult = quickValidateCode(pluginCode);

      // ── Validate widget code (if provided) ────────────────────────────
      if (widgetCode) {
        if (!widgetFileName) {
          codeResult.errors.push("widgetCode angegeben aber widgetFileName fehlt.");
        }
        const widgetResult = quickValidateWidget(widgetCode);
        codeResult.errors.push(...widgetResult.errors);
        codeResult.warnings.push(...widgetResult.warnings);
      }

      // ── Collect all validation results ────────────────────────────────
      const allErrors = [...manifestResult.errors, ...codeResult.errors];
      const hasBlockingErrors = allErrors.length > 0;

      // ── Build ZIP in memory ───────────────────────────────────────────
      const zip = new AdmZip();
      const files: string[] = [];

      zip.addFile("plugin.manifest.json", Buffer.from(manifestJson, "utf-8"));
      files.push("plugin.manifest.json");

      zip.addFile("index.ts", Buffer.from(pluginCode, "utf-8"));
      files.push("index.ts");

      if (widgetCode && widgetFileName) {
        zip.addFile(widgetFileName, Buffer.from(widgetCode, "utf-8"));
        files.push(widgetFileName);
      }

      if (typesCode) {
        zip.addFile("types.ts", Buffer.from(typesCode, "utf-8"));
        files.push("types.ts");
      }

      if (additionalFiles) {
        for (const file of additionalFiles) {
          zip.addFile(file.fileName, Buffer.from(file.content, "utf-8"));
          files.push(file.fileName);
        }
      }

      // ── Write ZIP to disk (always use temp dir) ───────────────────────
      const targetDir = os.tmpdir();
      const zipFileName = `${pluginId}.zip`;
      const zipPath = path.join(targetDir, zipFileName).replace(/\\/g, "/");

      try {
        zip.writeZip(zipPath);
      } catch (err) {
        return error(`Fehler beim Schreiben der ZIP-Datei: ${(err as Error).message}\n\nVersuchter Pfad: ${zipPath}`);
      }

      // ── Build result report ───────────────────────────────────────────
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

      // Version-Bump reminder
      let manifestVersion = "?";
      try {
        const m = JSON.parse(manifestJson);
        if (typeof m.version === "string") manifestVersion = m.version;
      } catch { /* ignore */ }

      sections.push(
        "",
        `## Version: ${manifestVersion}`,
        "",
        "**WICHTIG:** Bei jeder neuen ZIP die Version im Manifest hochzaehlen (semver):",
        "- Bug-Fix: patch (1.0.0 -> 1.0.1)",
        "- Neue Features: minor (1.0.0 -> 1.1.0)",
        "- Breaking Changes: major (1.0.0 -> 2.0.0)",
        "",
        "## Naechste Schritte",
        "",
        "Der User kann die ZIP-Datei auf zwei Wegen installieren:",
        "1. **Dashboard UI:** Einstellungen > Plugins > Upload > ZIP-Datei auswaehlen",
        "2. **Manuell:** ZIP entpacken und Ordner nach `src/plugins/community/` kopieren, dann Server neustarten",
      );

      return success(sections.join("\n"));
    },
  );
}
