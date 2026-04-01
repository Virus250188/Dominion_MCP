import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ─── Types ────────────────────────────────────────────────────────────────

interface ValidationResult {
  errors: string[];
  warnings: string[];
  passed: boolean;
}

function result(errors: string[], warnings: string[]): ValidationResult {
  return { errors, warnings, passed: errors.length === 0 };
}

// ─── validate_plugin_structure ────────────────────────────────────────────

function validatePluginStructure(pluginCode: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Has metadata object with required fields
  const metadataMatch = pluginCode.match(/metadata\s*:\s*\{/);
  if (!metadataMatch) {
    errors.push("Missing `metadata` object in plugin definition.");
  } else {
    const requiredMetaFields = ["id", "name", "icon", "color", "description", "category"];
    for (const field of requiredMetaFields) {
      const fieldRegex = new RegExp(`metadata\\s*:\\s*\\{[^}]*?${field}\\s*:`);
      // Use a more forgiving approach: search for the field anywhere after metadata
      const metaStart = pluginCode.indexOf("metadata");
      const afterMeta = pluginCode.slice(metaStart, metaStart + 800);
      if (!afterMeta.includes(`${field}:`)) {
        errors.push(`metadata is missing required field: ${field}`);
      }
    }
  }

  // 2. metadata.id is kebab-case
  const idMatch = pluginCode.match(/id\s*:\s*["']([^"']+)["']/);
  if (idMatch) {
    if (!/^[a-z][a-z0-9-]*$/.test(idMatch[1])) {
      errors.push(`metadata.id "${idMatch[1]}" is not kebab-case. Must match /^[a-z][a-z0-9-]*$/.`);
    }
  } else {
    // Only warn if metadata exists (error for missing metadata already added above)
    if (metadataMatch) {
      warnings.push("Could not extract metadata.id value for validation.");
    }
  }

  // 3. metadata.color is valid hex
  const colorMatch = pluginCode.match(/color\s*:\s*["']([^"']+)["']/);
  if (colorMatch) {
    if (!/^#[0-9a-fA-F]{6}$/.test(colorMatch[1])) {
      errors.push(`metadata.color "${colorMatch[1]}" is not a valid hex color. Must match #XXXXXX format.`);
    }
  } else {
    if (metadataMatch) {
      warnings.push("Could not extract metadata.color value for validation.");
    }
  }

  // 4. Has configFields array
  if (!/configFields\s*:\s*\[/.test(pluginCode)) {
    errors.push("Missing `configFields` array.");
  }

  // 5. Has statOptions array with at least one defaultEnabled: true
  if (!/statOptions\s*:\s*\[/.test(pluginCode)) {
    errors.push("Missing `statOptions` array.");
  } else {
    if (!/defaultEnabled\s*:\s*true/.test(pluginCode)) {
      errors.push("statOptions must have at least one entry with `defaultEnabled: true`.");
    }
  }

  // 6. Has supportedSizes array containing "1x1"
  if (!/supportedSizes\s*:\s*\[/.test(pluginCode)) {
    errors.push("Missing `supportedSizes` array.");
  } else {
    if (!/supportedSizes\s*:\s*\[[\s\S]*?["']1x1["']/.test(pluginCode)) {
      errors.push('supportedSizes must contain "1x1".');
    }
  }

  // 7. Has renderHints object
  if (!/renderHints\s*:\s*\{/.test(pluginCode)) {
    errors.push("Missing `renderHints` object.");
  }

  // 8. For each size in supportedSizes, check renderHints has a matching key
  const sizesMatch = pluginCode.match(/supportedSizes\s*:\s*\[([\s\S]*?)\]/);
  if (sizesMatch) {
    const sizesStr = sizesMatch[1];
    const sizes = [...sizesStr.matchAll(/["'](\dx\d)["']/g)].map((m) => m[1]);
    for (const size of sizes) {
      const hintKeyRegex = new RegExp(`["']${size}["']\\s*:`);
      if (!hintKeyRegex.test(pluginCode)) {
        errors.push(`renderHints is missing key for supported size "${size}".`);
      }
    }
  }

  // 9. If any renderHint has layout: "widget", check it also has widgetComponent
  const widgetHints = [...pluginCode.matchAll(/["']\dx\d["']\s*:\s*\{([^}]*)\}/g)];
  for (const hint of widgetHints) {
    const hintBody = hint[1];
    if (/layout\s*:\s*["']widget["']/.test(hintBody)) {
      if (!/widgetComponent\s*:/.test(hintBody)) {
        errors.push(`renderHint with layout "widget" is missing widgetComponent.`);
      }
    }
  }

  // 10. Has fetchStats function/method
  if (!/fetchStats\s*[\(:]/.test(pluginCode) && !/async\s+fetchStats/.test(pluginCode)) {
    errors.push("Missing `fetchStats` function/method.");
  }

  // 11. Has testConnection function/method
  if (!/testConnection\s*[\(:]/.test(pluginCode) && !/async\s+testConnection/.test(pluginCode)) {
    errors.push("Missing `testConnection` function/method.");
  }

  // 12. fetchStats contains AbortSignal.timeout
  const fetchStatsBody = extractFunctionBody(pluginCode, "fetchStats");
  if (fetchStatsBody) {
    if (!fetchStatsBody.includes("AbortSignal.timeout")) {
      warnings.push("fetchStats should use `AbortSignal.timeout` for request timeouts.");
    }

    // 13. fetchStats contains try/catch
    if (!/try\s*\{/.test(fetchStatsBody)) {
      warnings.push("fetchStats should contain a try/catch block for error handling.");
    }

    // 14. fetchStats contains visibleStats pattern
    if (!fetchStatsBody.includes("visibleStats")) {
      warnings.push("fetchStats should use the `visibleStats` pattern to filter stats by user selection.");
    }
  }

  // 15. All fetch() calls have signal parameter (or use createFetchOptions which includes it)
  const usesCreateFetchOptions = pluginCode.includes("createFetchOptions");
  if (!usesCreateFetchOptions) {
    const fetchCalls = [...pluginCode.matchAll(/fetch\s*\([^)]*\{([^}]*)\}/g)];
    for (const call of fetchCalls) {
      const fetchOptions = call[1];
      if (!/signal\s*:/.test(fetchOptions)) {
        warnings.push("A fetch() call is missing the `signal` parameter with AbortSignal.timeout.");
      }
    }
  }

  // 16. Check for shared utilities usage (helpful hint, not blocking)
  const utilImportRegex = /from\s+["'].*utils["']/;
  if (!utilImportRegex.test(pluginCode)) {
    warnings.push(
      'Plugin does not import shared utilities from "../../utils". ' +
      'Consider using: getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions, formatBytes, formatUptime.'
    );
  }

  // 17. Check metadata.icon format (PascalCase or lowercase, no spaces)
  const iconMatch = pluginCode.match(/icon\s*:\s*["']([^"']+)["']/);
  if (iconMatch) {
    const iconSlug = iconMatch[1];
    if (/\s/.test(iconSlug)) {
      errors.push(`metadata.icon "${iconSlug}" contains spaces. Must be a valid simple-icons slug (PascalCase, no spaces, e.g. "Emby").`);
    }
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(iconSlug)) {
      warnings.push(`metadata.icon "${iconSlug}" may not be a valid simple-icons slug. Expected PascalCase like "Emby" or "Grafana". Check https://simpleicons.org.`);
    }
  }

  // 18. Check that renderHints do NOT contain deprecated 'features' field
  const renderHintsBlock = pluginCode.match(/renderHints\s*:\s*\{([\s\S]*?)\}\s*,?\s*\n\s*\n/);
  if (renderHintsBlock) {
    if (/features\s*:/.test(renderHintsBlock[1])) {
      errors.push('renderHints contains deprecated `features` field. The `features` field has been removed from SizeRenderHint.');
    }
  }

  // 19. widgetData consistency: if renderHints has widget layout, suggest using widgetData
  const hasWidgetLayout = /layout\s*:\s*["']widget["']/.test(pluginCode);
  const usesWidgetData = /widgetData\s*[=:{]/.test(pluginCode) || /widgetData\s*:/.test(pluginCode);
  if (hasWidgetLayout && !usesWidgetData) {
    warnings.push(
      'Plugin has layout "widget" in renderHints but does not return widgetData. ' +
      'Consider using widgetData in fetchStats for rich widget rendering (cover images, lists, etc.). ' +
      'Example: return { items, status: "ok", widgetData: { recentItems: [...] } }'
    );
  }

  // 20. Check configField feature-fields pattern: non-connection, non-required fields
  //     should use type "select" or "number" (informational)
  const hasSelectFields = /type\s*:\s*["']select["']/.test(pluginCode);
  if (hasWidgetLayout && !hasSelectFields) {
    warnings.push(
      'Plugin has widget layout but no select-type configFields. ' +
      'Consider adding widget-specific config options (e.g. carouselSpeed, mediaCategory) ' +
      'as select fields that appear after the connection test passes.'
    );
  }

  // 21. Auto-Discovery: Check for standardized exports (community plugins)
  const hasStandardPluginExport = /export\s+const\s+plugin\s*[=:]/.test(pluginCode);
  const hasWidgetExport = /export\s+const\s+widget\s*=/.test(pluginCode);
  const hasWidgetNameExport = /export\s+const\s+widgetName\s*=/.test(pluginCode);

  if (!hasStandardPluginExport) {
    // Check if it uses the legacy {name}Plugin format
    const legacyExport = /export\s+const\s+\w+Plugin\s*[=:]/.test(pluginCode);
    if (legacyExport) {
      warnings.push(
        'Plugin uses legacy export format (export const {name}Plugin). ' +
        'Community plugins must use: export const plugin: AppPlugin = { ... }'
      );
    } else {
      errors.push(
        'Missing `export const plugin`. Community plugins must export: ' +
        'export const plugin: AppPlugin = { ... }'
      );
    }
  }

  if (!hasWidgetExport) {
    warnings.push(
      'Missing `export const widget`. Community plugins must export: ' +
      'export const widget = MyWidget; (or null if no widget)'
    );
  }

  if (!hasWidgetNameExport) {
    warnings.push(
      'Missing `export const widgetName`. Community plugins must export: ' +
      'export const widgetName = "MyWidget"; (or null if no widget)'
    );
  }

  return result(errors, warnings);
}

/**
 * Best-effort extraction of a method/function body by name.
 * Finds the opening brace after the function signature and matches braces.
 */
function extractFunctionBody(code: string, funcName: string): string | null {
  const funcIndex = code.search(new RegExp(`(async\\s+)?${funcName}\\s*\\(`));
  if (funcIndex === -1) return null;

  // Find the opening brace of the function body
  const afterSignature = code.indexOf("{", funcIndex);
  if (afterSignature === -1) return null;

  let depth = 0;
  let end = afterSignature;
  for (let i = afterSignature; i < code.length; i++) {
    if (code[i] === "{") depth++;
    if (code[i] === "}") depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }

  return code.slice(afterSignature, end + 1);
}

// ─── validate_stats_output ────────────────────────────────────────────────

function validateStatsOutput(statsJson: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Is valid JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(statsJson);
  } catch {
    errors.push("Invalid JSON: could not parse the stats output.");
    return result(errors, warnings);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    errors.push("Stats output must be a JSON object, not an array or primitive.");
    return result(errors, warnings);
  }

  const stats = parsed as Record<string, unknown>;

  // 2. Has items array
  if (!Array.isArray(stats.items)) {
    errors.push("Missing `items` array in stats output.");
  } else {
    const items = stats.items as unknown[];

    // 3. items.length <= 6
    if (items.length > 6) {
      errors.push(`items array has ${items.length} entries, maximum is 6.`);
    }

    // 4. Each item has label (non-empty string) and value (string or number)
    const validColors = new Set(["green", "red", "yellow", "blue"]);

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Record<string, unknown>;
      if (typeof item !== "object" || item === null) {
        errors.push(`items[${i}] is not an object.`);
        continue;
      }

      if (typeof item.label !== "string" || item.label.trim() === "") {
        errors.push(`items[${i}].label must be a non-empty string.`);
      }

      if (typeof item.value !== "string" && typeof item.value !== "number") {
        errors.push(`items[${i}].value must be a string or number.`);
      }

      // 5. Optional fields validation
      if (item.unit !== undefined && typeof item.unit !== "string") {
        errors.push(`items[${i}].unit must be a string if provided.`);
      }

      if (item.icon !== undefined && typeof item.icon !== "string") {
        errors.push(`items[${i}].icon must be a string if provided.`);
      }

      if (item.color !== undefined) {
        if (typeof item.color !== "string" || !validColors.has(item.color)) {
          errors.push(`items[${i}].color must be one of: green, red, yellow, blue. Got "${String(item.color)}".`);
        }
      }
    }
  }

  // 6. Has status field
  if (stats.status !== "ok" && stats.status !== "error") {
    errors.push('Missing or invalid `status` field. Must be "ok" or "error".');
  }

  // 7. If status is "error", should have error string
  if (stats.status === "error") {
    if (typeof stats.error !== "string" || stats.error.trim() === "") {
      warnings.push('status is "error" but no `error` message string is provided.');
    }
  }

  // 8. widgetData validation (optional field)
  if (stats.widgetData !== undefined) {
    if (typeof stats.widgetData !== "object" || stats.widgetData === null || Array.isArray(stats.widgetData)) {
      errors.push("widgetData must be a plain object (Record<string, unknown>), not an array or primitive.");
    }
  }

  return result(errors, warnings);
}

// ─── validate_render_hints ────────────────────────────────────────────────

function validateRenderHints(renderHintsJson: string, supportedSizes: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Parse JSON
  let hints: Record<string, unknown>;
  try {
    hints = JSON.parse(renderHintsJson);
  } catch {
    errors.push("Invalid JSON: could not parse render hints.");
    return result(errors, warnings);
  }

  if (typeof hints !== "object" || hints === null || Array.isArray(hints)) {
    errors.push("renderHints must be a JSON object.");
    return result(errors, warnings);
  }

  // 2. Every supportedSize must have an entry in renderHints
  for (const size of supportedSizes) {
    if (!(size in hints)) {
      errors.push(`renderHints is missing entry for supported size "${size}".`);
    }
  }

  // Validate each hint entry
  const maxStatsLimits: Record<string, number> = {
    "1x1": 3,
    "2x1": 6,
    "2x2": 6,
  };

  for (const [size, hintValue] of Object.entries(hints)) {
    if (typeof hintValue !== "object" || hintValue === null) {
      errors.push(`renderHints["${size}"] must be an object.`);
      continue;
    }

    const hint = hintValue as Record<string, unknown>;

    // 3/4/5. maxStats limits
    if (typeof hint.maxStats === "number") {
      const limit = maxStatsLimits[size];
      if (limit !== undefined && hint.maxStats > limit) {
        warnings.push(`renderHints["${size}"].maxStats is ${hint.maxStats}, recommended max for ${size} is ${limit}.`);
      }
    }

    // 6. If layout is "widget", widgetComponent must be set
    if (hint.layout === "widget") {
      if (!hint.widgetComponent || typeof hint.widgetComponent !== "string") {
        errors.push(`renderHints["${size}"] has layout "widget" but missing or invalid widgetComponent.`);
      }
    }

    // 7. If layout is "compact" or "detailed", widgetComponent should NOT be set
    if (hint.layout === "compact" || hint.layout === "detailed") {
      if (hint.widgetComponent) {
        warnings.push(`renderHints["${size}"] has layout "${hint.layout}" but sets widgetComponent. widgetComponent is only for layout "widget".`);
      }
    }
  }

  return result(errors, warnings);
}

// ─── Registration ─────────────────────────────────────────────────────────

export function registerValidationTools(server: McpServer): void {
  server.tool(
    "validate_plugin_structure",
    "Validates a plugin's TypeScript source code against the Dominion framework rules. Checks metadata, configFields, statOptions, supportedSizes, renderHints, fetchStats, and testConnection.",
    {
      pluginCode: z.string().describe("The full TypeScript source code of the plugin to validate."),
    },
    async ({ pluginCode }) => {
      const validation = validatePluginStructure(pluginCode);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(validation, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "validate_stats_output",
    "Validates a PluginStats JSON object against the expected schema. Checks items array, label/value types, optional fields, and status.",
    {
      statsJson: z.string().describe("JSON string of a PluginStats object to validate."),
    },
    async ({ statsJson }) => {
      const validation = validateStatsOutput(statsJson);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(validation, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "validate_render_hints",
    "Validates renderHints JSON against supported sizes. Checks maxStats limits, widget/compact layout rules, and completeness.",
    {
      renderHintsJson: z.string().describe("JSON string of the renderHints object to validate."),
      supportedSizes: z.array(z.string()).describe('Array of supported sizes, e.g. ["1x1", "2x1", "2x2"].'),
    },
    async ({ renderHintsJson, supportedSizes }) => {
      const validation = validateRenderHints(renderHintsJson, supportedSizes);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(validation, null, 2),
          },
        ],
      };
    },
  );
}
