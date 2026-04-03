import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// ─── Constants ────────────────────────────────────────────────────────────

const DASHBOARD_PATH = (process.env.DASHBOARD_PATH || "").replace(/\\/g, "/");

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

interface BuildResult {
  success: boolean;
  output: string;
  errors: string;
}

interface ExportResult {
  pluginId: string;
  checks: CheckItem[];
  allPassed: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readFileContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Normalize a path for consistent forward-slash usage and resolve it.
 */
function normPath(...segments: string[]): string {
  return path.resolve(...segments).replace(/\\/g, "/");
}

// ─── test_plugin_files ────────────────────────────────────────────────────

function testPluginFiles(pluginId: string): ChecklistResult {
  const checks: CheckItem[] = [];

  // 1. Plugin index.ts exists (check both community/ and builtin/ locations)
  const communityPluginPath = normPath(DASHBOARD_PATH, "src/plugins/community", pluginId, "index.ts");
  const builtinPluginPath = normPath(DASHBOARD_PATH, "src/plugins/builtin", pluginId, "index.ts");
  const communityExists = fileExists(communityPluginPath);
  const builtinExists = fileExists(builtinPluginPath);
  const pluginExists = communityExists || builtinExists;
  const pluginIndexPath = communityExists ? communityPluginPath : builtinPluginPath;
  const pluginLocation = communityExists ? "community" : builtinExists ? "builtin" : "community";

  checks.push({
    check: "Plugin index.ts exists",
    passed: pluginExists,
    detail: pluginExists
      ? `Found: ${pluginIndexPath}`
      : `Missing: expected at ${communityPluginPath} (community) or ${builtinPluginPath} (builtin)`,
  });

  // 2. Plugin is registered (community/index.ts or registry.ts)
  if (communityExists) {
    // Community plugin: check community/index.ts
    const communityBarrelPath = normPath(DASHBOARD_PATH, "src/plugins/community/index.ts");
    const communityBarrelContent = readFileContent(communityBarrelPath);
    if (communityBarrelContent === null) {
      checks.push({
        check: "Plugin exported in community/index.ts",
        passed: false,
        detail: `Could not read: ${communityBarrelPath}`,
      });
    } else {
      const exportPattern = new RegExp(`from\\s+["']\\.\\/\\s*${pluginId}["']`);
      const hasExport = exportPattern.test(communityBarrelContent) || communityBarrelContent.includes(`./${pluginId}`);
      checks.push({
        check: "Plugin exported in community/index.ts",
        passed: hasExport,
        detail: hasExport
          ? `Found export for ./${pluginId} in community/index.ts`
          : `No export found for ./${pluginId} in community/index.ts`,
      });
    }
  } else if (builtinExists) {
    // Builtin plugin: check registry.ts
    const registryPath = normPath(DASHBOARD_PATH, "src/plugins/registry.ts");
    const registryContent = readFileContent(registryPath);
    if (registryContent === null) {
      checks.push({
        check: "Plugin registered in registry.ts",
        passed: false,
        detail: `Could not read: ${registryPath}`,
      });
    } else {
      const importPattern = new RegExp(`from\\s+["']\\./builtin/${pluginId}["']`);
      const hasImport = importPattern.test(registryContent);
      checks.push({
        check: "Plugin registered in registry.ts",
        passed: hasImport,
        detail: hasImport
          ? `Found import for ./builtin/${pluginId} in registry.ts`
          : `No import found for ./builtin/${pluginId} in registry.ts`,
      });
    }
  } else {
    checks.push({
      check: "Plugin registered",
      passed: false,
      detail: `Plugin file not found, cannot check registration.`,
    });
  }

  // 3. Icon auto-resolution check (informational - no ICON_MAP editing needed)
  checks.push({
    check: "Icon auto-resolution (no ICON_MAP editing needed)",
    passed: true,
    detail: "Icons are auto-resolved from metadata.icon via the plugin registry. No manual ICON_MAP entry required.",
  });

  // 4. If plugin has widget renderHints, check widget files
  const pluginContent = pluginExists ? readFileContent(pluginIndexPath) : null;
  let hasWidget = false;

  if (pluginContent) {
    const widgetComponentMatch = pluginContent.match(/widgetComponent\s*:\s*["']([^"']+)["']/);
    if (widgetComponentMatch) {
      hasWidget = true;
      const widgetName = widgetComponentMatch[1];

      // Check widget directory exists
      const widgetDir = normPath(DASHBOARD_PATH, "src/components/widgets", pluginId);
      const widgetDirExists = fileExists(widgetDir);
      checks.push({
        check: `Widget directory exists for "${widgetName}"`,
        passed: widgetDirExists,
        detail: widgetDirExists
          ? `Found: ${widgetDir}`
          : `Missing widget directory: ${widgetDir}`,
      });

      // Check widget registration (community: communityWidgets map, builtin: widgets/registry.ts)
      if (communityExists) {
        const communityBarrelPath = normPath(DASHBOARD_PATH, "src/plugins/community/index.ts");
        const communityBarrelContent = readFileContent(communityBarrelPath);
        if (communityBarrelContent === null) {
          checks.push({
            check: "Widget registered in communityWidgets map",
            passed: false,
            detail: `Could not read: ${communityBarrelPath}`,
          });
        } else {
          const hasRegistration = communityBarrelContent.includes(widgetName);
          checks.push({
            check: "Widget registered in communityWidgets map",
            passed: hasRegistration,
            detail: hasRegistration
              ? `Found "${widgetName}" in community/index.ts communityWidgets`
              : `No "${widgetName}" found in communityWidgets map in community/index.ts. Add it there for auto-registration.`,
          });
        }
      } else {
        const widgetRegistryPath = normPath(DASHBOARD_PATH, "src/components/widgets/registry.ts");
        const widgetRegistryContent = readFileContent(widgetRegistryPath);
        if (widgetRegistryContent === null) {
          checks.push({
            check: "Widget registered in widgets/registry.ts",
            passed: false,
            detail: `Could not read: ${widgetRegistryPath}`,
          });
        } else {
          const hasRegistration = widgetRegistryContent.includes(pluginId) || widgetRegistryContent.includes(widgetName);
          checks.push({
            check: "Widget registered in widgets/registry.ts",
            passed: hasRegistration,
            detail: hasRegistration
              ? `Found registration for "${widgetName}" in widgets/registry.ts`
              : `No registration found for "${widgetName}" in widgets/registry.ts`,
          });
        }
      }
    }
  }

  if (!hasWidget) {
    checks.push({
      check: "Widget files (if applicable)",
      passed: true,
      detail: "Plugin does not define a widgetComponent, no widget files needed.",
    });
  }

  return {
    pluginId,
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}

// ─── test_build_compile ───────────────────────────────────────────────────

function testBuildCompile(): BuildResult {
  try {
    const output = execSync("npm run build", {
      cwd: DASHBOARD_PATH.replace(/\//g, path.sep),
      timeout: 120_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return {
      success: true,
      output: typeof output === "string" ? output : String(output),
      errors: "",
    };
  } catch (err: unknown) {
    const execError = err as { stdout?: string; stderr?: string; message?: string };
    return {
      success: false,
      output: execError.stdout || "",
      errors: execError.stderr || execError.message || "Unknown build error",
    };
  }
}

// ─── test_plugin_export ───────────────────────────────────────────────────

function testPluginExport(pluginId: string): ExportResult {
  const checks: CheckItem[] = [];

  // Try community/ first, then builtin/
  const communityPath = normPath(DASHBOARD_PATH, "src/plugins/community", pluginId, "index.ts");
  const builtinPath = normPath(DASHBOARD_PATH, "src/plugins/builtin", pluginId, "index.ts");
  const pluginIndexPath = fileExists(communityPath) ? communityPath : builtinPath;

  // 1. File exists and is readable
  const content = readFileContent(pluginIndexPath);
  if (content === null) {
    checks.push({
      check: "File exists and is readable",
      passed: false,
      detail: `Cannot read: ${pluginIndexPath} (also checked: ${communityPath})`,
    });
    return { pluginId, checks, allPassed: false };
  }

  checks.push({
    check: "File exists and is readable",
    passed: true,
    detail: `Read ${content.length} characters from ${pluginIndexPath}`,
  });

  // 2. Has standardized export (export const plugin: AppPlugin)
  const hasPluginExport = /export\s+const\s+plugin\s*[=:]/.test(content);
  // Also accept legacy {name}Plugin export for builtin plugins
  const legacyExportMatch = content.match(/export\s+const\s+(\w+Plugin)\s*[=:]/);
  if (hasPluginExport) {
    checks.push({
      check: "Has standardized plugin export",
      passed: true,
      detail: 'Found `export const plugin` (Auto-Discovery compatible)',
    });
  } else if (legacyExportMatch) {
    checks.push({
      check: "Has standardized plugin export",
      passed: true,
      detail: `Found legacy export: ${legacyExportMatch[1]} (builtin format)`,
    });
  } else {
    checks.push({
      check: "Has standardized plugin export",
      passed: false,
      detail: 'No `export const plugin` found. Community plugins must export: `export const plugin: AppPlugin = { ... }`',
    });
  }

  // 2b. Community plugins: check for widget and widgetName exports
  if (fileExists(communityPath)) {
    const hasWidgetExport = /export\s+const\s+widget\s*[=]/.test(content);
    const hasWidgetNameExport = /export\s+const\s+widgetName\s*[=]/.test(content);
    checks.push({
      check: "Has widget/widgetName exports (Auto-Discovery)",
      passed: hasWidgetExport && hasWidgetNameExport,
      detail: hasWidgetExport && hasWidgetNameExport
        ? "Found `export const widget` and `export const widgetName` (can be null)"
        : `Missing: ${!hasWidgetExport ? "export const widget" : ""}${!hasWidgetExport && !hasWidgetNameExport ? " and " : ""}${!hasWidgetNameExport ? "export const widgetName" : ""}. Both are required (use null if no widget).`,
    });
  }

  // 3. Export object contains all required AppPlugin fields
  const requiredFields = ["metadata", "configFields", "statOptions", "supportedSizes", "renderHints", "fetchStats", "testConnection"];
  const missingFields: string[] = [];
  for (const field of requiredFields) {
    const fieldAsProperty = new RegExp(`\\b${field}\\s*[:(]`);
    const fieldAsAsync = new RegExp(`async\\s+${field}\\s*\\(`);
    if (!fieldAsProperty.test(content) && !fieldAsAsync.test(content)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length === 0) {
    checks.push({
      check: "Contains all required AppPlugin fields",
      passed: true,
      detail: `All ${requiredFields.length} required fields found: ${requiredFields.join(", ")}`,
    });
  } else {
    checks.push({
      check: "Contains all required AppPlugin fields",
      passed: false,
      detail: `Missing fields: ${missingFields.join(", ")}`,
    });
  }

  // 4. fetchStats is defined as async function
  const asyncFetchStats = /async\s+fetchStats\s*\(/.test(content);
  checks.push({
    check: "fetchStats is async",
    passed: asyncFetchStats,
    detail: asyncFetchStats
      ? "fetchStats is defined as async function."
      : "fetchStats is not defined with `async` keyword. It must return a Promise<PluginStats>.",
  });

  // 5. testConnection is defined as async function
  const asyncTestConnection = /async\s+testConnection\s*\(/.test(content);
  checks.push({
    check: "testConnection is async",
    passed: asyncTestConnection,
    detail: asyncTestConnection
      ? "testConnection is defined as async function."
      : "testConnection is not defined with `async` keyword. It must return a Promise<{ ok: boolean; message: string }>.",
  });

  // 6. Uses shared utilities from utils.ts
  const utilImportRegex = /from\s+["'].*utils["']/;
  const usesSharedUtils = utilImportRegex.test(content);
  checks.push({
    check: "Uses shared utilities from utils.ts",
    passed: usesSharedUtils,
    detail: usesSharedUtils
      ? "Found import from utils.ts (getVisibleStats, normalizeUrl, etc.)"
      : 'No import from "../../utils" found. Plugins should use shared utilities: getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions.',
  });

  // 7. No deprecated 'features' field in renderHints
  const hasFeaturesField = /features\s*:\s*\[/.test(content);
  checks.push({
    check: "No deprecated features field in renderHints",
    passed: !hasFeaturesField,
    detail: hasFeaturesField
      ? 'Found deprecated `features` field in renderHints. Remove it -- the `features` field has been removed from SizeRenderHint.'
      : "No deprecated `features` field found. Good.",
  });

  return {
    pluginId,
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}

// ─── Registration ─────────────────────────────────────────────────────────

export function registerTestTools(server: McpServer): void {
  server.tool(
    "test_plugin_files",
    "Checks if all required files for a plugin exist in the Dashboard project: index.ts in community/ or builtin/, export in community/index.ts (or registry.ts for builtin), and widget files if applicable. Icons are auto-resolved, no ICON_MAP check needed.",
    {
      pluginId: z.string().describe("The plugin ID (kebab-case), e.g. 'emby', 'opnsense'."),
    },
    async ({ pluginId }) => {
      const checklist = testPluginFiles(pluginId);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(checklist, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "test_build_compile",
    "Runs `npm run build` in the Dashboard project and reports success/failure with output. Timeout: 120 seconds.",
    {},
    async () => {
      const buildResult = testBuildCompile();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(buildResult, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "test_plugin_export",
    "Performs static analysis on a plugin's index.ts file to verify it has the correct export shape, required fields, async methods, shared utility usage, and no deprecated features field.",
    {
      pluginId: z.string().describe("The plugin ID (kebab-case), e.g. 'emby', 'opnsense'."),
    },
    async ({ pluginId }) => {
      const exportResult = testPluginExport(pluginId);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(exportResult, null, 2),
          },
        ],
      };
    },
  );
}
