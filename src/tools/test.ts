import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ─── Types ────────────────────────────────────────────────────────────────

interface CheckItem {
  check: string;
  passed: boolean;
  detail: string;
}

interface ChecklistResult {
  pluginId: string;
  checks: CheckItem[];
  allPassed: boolean;
}

// ─── test_plugin_completeness ────────────────────────────────────────────
// Validates that all required files and exports are present for a complete plugin.
// Works standalone on code strings — no filesystem or DASHBOARD_PATH needed.

function testPluginCompleteness(params: {
  pluginId: string;
  pluginCode: string;
  manifestJson?: string;
  widgetCode?: string;
  widgetFileName?: string;
}): ChecklistResult {
  const { pluginId, pluginCode, manifestJson, widgetCode, widgetFileName } = params;
  const checks: CheckItem[] = [];

  // 1. Manifest present and valid
  if (manifestJson) {
    try {
      const manifest = JSON.parse(manifestJson);
      const requiredFields = ["id", "name", "version", "author", "description"];
      const missingFields = requiredFields.filter(
        (f) => typeof manifest[f] !== "string" || manifest[f].trim() === "",
      );

      if (missingFields.length === 0) {
        checks.push({
          check: "Manifest hat alle Pflichtfelder",
          passed: true,
          detail: `id="${manifest.id}", name="${manifest.name}", version="${manifest.version}"`,
        });
      } else {
        checks.push({
          check: "Manifest hat alle Pflichtfelder",
          passed: false,
          detail: `Fehlende Felder: ${missingFields.join(", ")}`,
        });
      }

      // Manifest ID matches pluginId
      if (manifest.id && manifest.id !== pluginId) {
        checks.push({
          check: "Manifest ID stimmt mit pluginId ueberein",
          passed: false,
          detail: `manifest.id="${manifest.id}" != pluginId="${pluginId}"`,
        });
      } else if (manifest.id) {
        checks.push({
          check: "Manifest ID stimmt mit pluginId ueberein",
          passed: true,
          detail: `Beide sind "${pluginId}"`,
        });
      }

      // kebab-case check
      const kebabOk = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(manifest.id || "");
      checks.push({
        check: "Plugin-ID ist kebab-case",
        passed: kebabOk,
        detail: kebabOk
          ? `"${manifest.id}" ist korrektes kebab-case`
          : `"${manifest.id}" ist KEIN gueltiges kebab-case (erlaubt: a-z, 0-9, -)`,
      });

      // semver check
      const semverOk = /^\d+\.\d+\.\d+/.test(manifest.version || "");
      checks.push({
        check: "Version ist semver",
        passed: semverOk,
        detail: semverOk
          ? `"${manifest.version}" ist gueltiges semver`
          : `"${manifest.version}" ist KEIN gueltiges semver (erwartet: x.y.z)`,
      });

      // Widget consistency
      if (manifest.hasWidget === true) {
        const hasWidgetFile = !!widgetCode;
        checks.push({
          check: "Widget-Datei vorhanden (manifest.hasWidget=true)",
          passed: hasWidgetFile,
          detail: hasWidgetFile
            ? `Widget-Code wurde mitgeliefert${widgetFileName ? ` (${widgetFileName})` : ""}`
            : "manifest.hasWidget ist true, aber kein widgetCode angegeben",
        });
      }
    } catch {
      checks.push({
        check: "Manifest ist gueltiges JSON",
        passed: false,
        detail: "Konnte manifest nicht als JSON parsen",
      });
    }
  } else {
    checks.push({
      check: "Manifest vorhanden",
      passed: false,
      detail: "Kein manifestJson angegeben. Pflicht fuer ZIP-Upload.",
    });
  }

  // 2. Plugin has standardized export
  const hasPluginExport = /export\s+const\s+plugin\s*[=:]/.test(pluginCode);
  checks.push({
    check: "Hat `export const plugin` Export",
    passed: hasPluginExport,
    detail: hasPluginExport
      ? "Gefunden: `export const plugin` (Auto-Discovery kompatibel)"
      : "Fehlend: Community Plugins muessen `export const plugin: AppPlugin = { ... }` exportieren",
  });

  // 3. Has widget + widgetName exports
  const hasWidgetExport = /export\s+const\s+widget\s*=/.test(pluginCode);
  const hasWidgetNameExport = /export\s+const\s+widgetName\s*=/.test(pluginCode);
  checks.push({
    check: "Hat widget/widgetName Exports (Auto-Discovery)",
    passed: hasWidgetExport && hasWidgetNameExport,
    detail:
      hasWidgetExport && hasWidgetNameExport
        ? "Gefunden: `export const widget` und `export const widgetName`"
        : `Fehlend: ${!hasWidgetExport ? "export const widget" : ""}${!hasWidgetExport && !hasWidgetNameExport ? " und " : ""}${!hasWidgetNameExport ? "export const widgetName" : ""}. Beide Pflicht (null falls kein Widget).`,
  });

  // 4. All required AppPlugin fields present
  const requiredFields = ["metadata", "configFields", "statOptions", "supportedSizes", "renderHints", "fetchStats", "testConnection"];
  const missingFields: string[] = [];
  for (const field of requiredFields) {
    const fieldAsProperty = new RegExp(`\\b${field}\\s*[:(]`);
    const fieldAsAsync = new RegExp(`async\\s+${field}\\s*\\(`);
    if (!fieldAsProperty.test(pluginCode) && !fieldAsAsync.test(pluginCode)) {
      missingFields.push(field);
    }
  }
  checks.push({
    check: "Alle Pflicht-Felder von AppPlugin vorhanden",
    passed: missingFields.length === 0,
    detail:
      missingFields.length === 0
        ? `Alle ${requiredFields.length} Felder gefunden`
        : `Fehlende Felder: ${missingFields.join(", ")}`,
  });

  // 5. fetchStats is async
  const asyncFetchStats = /async\s+fetchStats\s*\(/.test(pluginCode);
  checks.push({
    check: "fetchStats ist async",
    passed: asyncFetchStats,
    detail: asyncFetchStats
      ? "fetchStats ist als async Funktion definiert"
      : "fetchStats ist NICHT async. Muss Promise<PluginStats> zurueckgeben.",
  });

  // 6. testConnection is async
  const asyncTestConnection = /async\s+testConnection\s*\(/.test(pluginCode);
  checks.push({
    check: "testConnection ist async",
    passed: asyncTestConnection,
    detail: asyncTestConnection
      ? "testConnection ist als async Funktion definiert"
      : "testConnection ist NICHT async. Muss Promise<{ ok, message }> zurueckgeben.",
  });

  // 7. Uses shared utilities
  const usesSharedUtils = /from\s+["'].*utils["']/.test(pluginCode);
  checks.push({
    check: "Nutzt Shared Utilities aus utils.ts",
    passed: usesSharedUtils,
    detail: usesSharedUtils
      ? 'Import von utils.ts gefunden (getVisibleStats, normalizeUrl, etc.)'
      : 'Kein Import von "../../utils". Plugins sollten getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions nutzen.',
  });

  // 8. No deprecated features field
  const hasFeaturesField = /features\s*:\s*\[/.test(pluginCode);
  checks.push({
    check: "Kein veraltetes `features` Feld in renderHints",
    passed: !hasFeaturesField,
    detail: hasFeaturesField
      ? "Veraltetes `features` Feld gefunden. Entfernen -- wurde aus SizeRenderHint entfernt."
      : "Kein veraltetes `features` Feld. Gut.",
  });

  // 9. Widget validation (if provided)
  if (widgetCode) {
    const hasUseClient = widgetCode.includes('"use client"') || widgetCode.includes("'use client'");
    checks.push({
      check: 'Widget hat "use client" Direktive',
      passed: hasUseClient,
      detail: hasUseClient
        ? '"use client" gefunden'
        : 'Fehlend: Widget-Dateien muessen `"use client"` am Anfang haben.',
    });

    const hasWidgetHeader = widgetCode.includes("WidgetHeader");
    checks.push({
      check: "Widget nutzt WidgetHeader",
      passed: hasWidgetHeader,
      detail: hasWidgetHeader
        ? "WidgetHeader Import/Nutzung gefunden"
        : "WidgetHeader nicht gefunden. Empfohlen fuer konsistente Widget-Kopfzeile.",
    });
  }

  return {
    pluginId,
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}

// ─── test_typescript_syntax ──────────────────────────────────────────────
// Basic TypeScript syntax validation via regex. Checks bracket balance,
// import format, and common mistakes. No compiler needed.

function testTypescriptSyntax(params: {
  pluginCode: string;
  widgetCode?: string;
}): { checks: CheckItem[]; allPassed: boolean } {
  const checks: CheckItem[] = [];

  function checkCode(code: string, label: string): void {
    // 1. Bracket balance
    let braceDepth = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let inString = false;
    let stringChar = "";
    let inTemplateString = false;

    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      const prev = i > 0 ? code[i - 1] : "";

      if (inString) {
        if (ch === stringChar && prev !== "\\") inString = false;
        continue;
      }
      if (inTemplateString) {
        if (ch === "`" && prev !== "\\") inTemplateString = false;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (ch === "`") {
        inTemplateString = true;
        continue;
      }
      // Skip line comments
      if (ch === "/" && i + 1 < code.length && code[i + 1] === "/") {
        const newline = code.indexOf("\n", i);
        i = newline === -1 ? code.length : newline;
        continue;
      }

      if (ch === "{") braceDepth++;
      if (ch === "}") braceDepth--;
      if (ch === "(") parenDepth++;
      if (ch === ")") parenDepth--;
      if (ch === "[") bracketDepth++;
      if (ch === "]") bracketDepth--;
    }

    const balanced = braceDepth === 0 && parenDepth === 0 && bracketDepth === 0;
    checks.push({
      check: `${label}: Klammern balanciert`,
      passed: balanced,
      detail: balanced
        ? "Alle Klammern korrekt geschlossen"
        : `Unbalanciert: { ${braceDepth > 0 ? `+${braceDepth}` : braceDepth} } ( ${parenDepth > 0 ? `+${parenDepth}` : parenDepth} ) [ ${bracketDepth > 0 ? `+${bracketDepth}` : bracketDepth} ]`,
    });

    // 2. Import paths check (should use relative paths for plugin utils)
    const absoluteImports = [...code.matchAll(/from\s+["']([^"']+)["']/g)];
    const badImports: string[] = [];
    for (const match of absoluteImports) {
      const importPath = match[1];
      // Plugin code should use relative imports for local files or @/ for Dashboard internals
      if (importPath.startsWith("/") && !importPath.startsWith("//")) {
        badImports.push(importPath);
      }
    }
    checks.push({
      check: `${label}: Keine absoluten Import-Pfade`,
      passed: badImports.length === 0,
      detail:
        badImports.length === 0
          ? "Alle Imports verwenden relative Pfade oder @/ Alias"
          : `Absolute Pfade gefunden: ${badImports.join(", ")}`,
    });

    // 3. No console.log (warning)
    const hasConsoleLog = /console\.(log|debug|info)\s*\(/.test(code);
    checks.push({
      check: `${label}: Kein console.log (Production)`,
      passed: !hasConsoleLog,
      detail: hasConsoleLog
        ? "console.log/debug/info gefunden. Sollte fuer Production entfernt werden."
        : "Keine console.log Aufrufe. Gut.",
    });
  }

  checkCode(params.pluginCode, "index.ts");

  if (params.widgetCode) {
    checkCode(params.widgetCode, "Widget");
  }

  return {
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}

// ─── test_plugin_export ──────────────────────────────────────────────────
// Static analysis of plugin exports. Accepts code as string.

function testPluginExport(pluginCode: string): { checks: CheckItem[]; allPassed: boolean } {
  const checks: CheckItem[] = [];

  // 1. Has standardized export
  const hasPluginExport = /export\s+const\s+plugin\s*[=:]/.test(pluginCode);
  const legacyExportMatch = pluginCode.match(/export\s+const\s+(\w+Plugin)\s*[=:]/);

  if (hasPluginExport) {
    checks.push({
      check: "Hat standardisierten Plugin-Export",
      passed: true,
      detail: "Gefunden: `export const plugin` (Auto-Discovery kompatibel)",
    });
  } else if (legacyExportMatch) {
    checks.push({
      check: "Hat standardisierten Plugin-Export",
      passed: true,
      detail: `Gefunden: Legacy Export ${legacyExportMatch[1]} (Builtin Format)`,
    });
  } else {
    checks.push({
      check: "Hat standardisierten Plugin-Export",
      passed: false,
      detail: "Kein `export const plugin` gefunden. Community Plugins muessen `export const plugin: AppPlugin = { ... }` exportieren.",
    });
  }

  // 2. Widget/widgetName exports
  const hasWidgetExport = /export\s+const\s+widget\s*=/.test(pluginCode);
  const hasWidgetNameExport = /export\s+const\s+widgetName\s*=/.test(pluginCode);
  checks.push({
    check: "Hat widget/widgetName Exports",
    passed: hasWidgetExport && hasWidgetNameExport,
    detail:
      hasWidgetExport && hasWidgetNameExport
        ? "Beide Exports gefunden (koennen null sein)"
        : `Fehlend: ${!hasWidgetExport ? "export const widget" : ""}${!hasWidgetExport && !hasWidgetNameExport ? " und " : ""}${!hasWidgetNameExport ? "export const widgetName" : ""}`,
  });

  // 3. All required AppPlugin fields
  const requiredFields = ["metadata", "configFields", "statOptions", "supportedSizes", "renderHints", "fetchStats", "testConnection"];
  const missingFields: string[] = [];
  for (const field of requiredFields) {
    const fieldAsProperty = new RegExp(`\\b${field}\\s*[:(]`);
    const fieldAsAsync = new RegExp(`async\\s+${field}\\s*\\(`);
    if (!fieldAsProperty.test(pluginCode) && !fieldAsAsync.test(pluginCode)) {
      missingFields.push(field);
    }
  }
  checks.push({
    check: "Alle Pflicht-Felder von AppPlugin vorhanden",
    passed: missingFields.length === 0,
    detail:
      missingFields.length === 0
        ? `Alle ${requiredFields.length} Felder gefunden: ${requiredFields.join(", ")}`
        : `Fehlende Felder: ${missingFields.join(", ")}`,
  });

  // 4. fetchStats is async
  checks.push({
    check: "fetchStats ist async",
    passed: /async\s+fetchStats\s*\(/.test(pluginCode),
    detail: /async\s+fetchStats\s*\(/.test(pluginCode)
      ? "fetchStats ist async"
      : "fetchStats ist NICHT async definiert",
  });

  // 5. testConnection is async
  checks.push({
    check: "testConnection ist async",
    passed: /async\s+testConnection\s*\(/.test(pluginCode),
    detail: /async\s+testConnection\s*\(/.test(pluginCode)
      ? "testConnection ist async"
      : "testConnection ist NICHT async definiert",
  });

  // 6. Uses shared utils
  const usesSharedUtils = /from\s+["'].*utils["']/.test(pluginCode);
  checks.push({
    check: "Nutzt Shared Utilities",
    passed: usesSharedUtils,
    detail: usesSharedUtils
      ? "Import von utils.ts gefunden"
      : 'Kein Import von "../../utils". Empfohlen: getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions.',
  });

  // 7. No deprecated features
  const hasFeaturesField = /features\s*:\s*\[/.test(pluginCode);
  checks.push({
    check: "Kein veraltetes features Feld",
    passed: !hasFeaturesField,
    detail: hasFeaturesField
      ? "Veraltetes `features` Feld gefunden. Entfernen."
      : "Kein veraltetes Feld. Gut.",
  });

  return {
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}

// ─── Registration ─────────────────────────────────────────────────────────

export function registerTestTools(server: McpServer): void {
  server.tool(
    "test_plugin_completeness",
    "Tests whether all required files, exports, and fields are present for a complete plugin. Works standalone on code strings — no Dashboard access needed. Call AFTER writing plugin code to verify completeness before packaging.",
    {
      pluginId: z.string().describe("The plugin ID (kebab-case), e.g. 'my-plugin'."),
      pluginCode: z.string().describe("Full TypeScript source code of index.ts."),
      manifestJson: z.string().optional().describe("Full JSON content of plugin.manifest.json."),
      widgetCode: z.string().optional().describe("Full source code of the widget .tsx file (if applicable)."),
      widgetFileName: z.string().optional().describe("Widget filename, e.g. 'MyWidget.tsx'."),
    },
    async ({ pluginId, pluginCode, manifestJson, widgetCode, widgetFileName }) => {
      const checklist = testPluginCompleteness({ pluginId, pluginCode, manifestJson, widgetCode, widgetFileName });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(checklist, null, 2),
        }],
      };
    },
  );

  server.tool(
    "test_typescript_syntax",
    "Performs basic TypeScript syntax validation: bracket balance, import paths, and common mistakes. Works standalone — no compiler or Dashboard needed. Call to catch syntax issues before packaging.",
    {
      pluginCode: z.string().describe("Full TypeScript source code of index.ts."),
      widgetCode: z.string().optional().describe("Full source code of the widget .tsx file (if applicable)."),
    },
    async ({ pluginCode, widgetCode }) => {
      const syntaxResult = testTypescriptSyntax({ pluginCode, widgetCode });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(syntaxResult, null, 2),
        }],
      };
    },
  );

  server.tool(
    "test_plugin_export",
    "Performs static analysis on plugin source code to verify it has the correct export shape, required AppPlugin fields, async methods, shared utility usage, and no deprecated fields. Works standalone on code strings.",
    {
      pluginCode: z.string().describe("Full TypeScript source code of the plugin's index.ts."),
    },
    async ({ pluginCode }) => {
      const exportResult = testPluginExport(pluginCode);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(exportResult, null, 2),
        }],
      };
    },
  );
}
