// ─── Plugin v2 Validator ─────────────────────────────────────────────────────
// Ported 1:1 from the Dominion dashboard src/plugins/v2/validate.ts so that an
// agent's local validation matches the server-side validation performed at
// upload. Same rules, same order, same messages (English mirror kept in sync).

import {
  ACTION_PARAM_TYPES, CATEGORIES, CONFIG_FIELD_TYPES, TILE_SIZES, WIDGET_NODE_TYPES,
} from "../data/spec.js";

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const VALID_SIZES: readonly string[] = TILE_SIZES;
const VALID_CATEGORIES: readonly string[] = CATEGORIES;
const VALID_FIELD_TYPES: readonly string[] = CONFIG_FIELD_TYPES;
const VALID_WIDGET_TYPES: readonly string[] = WIDGET_NODE_TYPES;
const VALID_ACTION_PARAM_TYPES: readonly string[] = ACTION_PARAM_TYPES;

export interface ManifestValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** true when a data source is present (api block or provided adapter flag) */
  dataSource: "api" | "adapter.js" | "none";
}

export interface ValidateOptions {
  /** Whether an adapter.js file accompanies this manifest (affects data-source check). */
  hasAdapter?: boolean;
}

/**
 * Validate a plugin.json object (already JSON-parsed) against the v2 rules.
 * Mirrors validateManifestV2 + validateWidgetNode from the dashboard.
 */
export function validateManifest(raw: unknown, opts: ValidateOptions = {}): ManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ["plugin.json must be a JSON object."], warnings, dataSource: "none" };
  }
  const m = raw as Record<string, unknown>;

  if (m.apiVersion !== 2) errors.push('apiVersion must be 2 (format v1 is no longer supported).');
  if (typeof m.id !== "string" || !KEBAB_RE.test(m.id)) errors.push('id: required kebab-case field (e.g. "pi-hole").');
  for (const f of ["name", "version", "author", "description", "icon"] as const) {
    if (typeof m[f] !== "string" || !(m[f] as string).trim()) errors.push(`${f}: required field (string).`);
  }
  if (typeof m.color !== "string" || !HEX_COLOR_RE.test(m.color as string)) errors.push('color: hex color required (e.g. "#22c55e").');
  if (typeof m.category !== "string" || !VALID_CATEGORIES.includes(m.category as string)) {
    errors.push(`category: one of ${VALID_CATEGORIES.join(", ")}.`);
  }

  // configFields
  if (!Array.isArray(m.configFields) || m.configFields.length === 0) {
    errors.push("configFields: at least one field required.");
  } else {
    (m.configFields as unknown[]).forEach((f, i) => {
      const cf = f as Record<string, unknown>;
      if (typeof cf?.key !== "string") errors.push(`configFields[${i}].key missing.`);
      if (typeof cf?.label !== "string") errors.push(`configFields[${i}].label missing.`);
      if (typeof cf?.type !== "string" || !VALID_FIELD_TYPES.includes(cf.type as string)) {
        errors.push(`configFields[${i}].type: one of ${VALID_FIELD_TYPES.join(", ")}.`);
      }
    });
    const fields = m.configFields as Array<Record<string, unknown>>;
    const hasApiUrl = fields.some((f) => f.key === "apiUrl");
    if (!hasApiUrl) errors.push('configFields: a field with key "apiUrl" is mandatory.');

    // Lifecycle guardrails: credentials are ONLY collected in the config modal
    // when a tile is added. Fields without required:true can be skipped there,
    // producing a broken, never-configured tile.
    if (!fields.some((f) => f.required === true)) {
      warnings.push(
        "No configField has required:true — the config modal can be submitted empty and the tile starts broken. Mark apiUrl (and every credential) required:true.",
      );
    } else {
      const apiUrlField = fields.find((f) => f.key === "apiUrl");
      if (apiUrlField && apiUrlField.required !== true) {
        warnings.push('configFields: "apiUrl" should be required:true — without it the tile cannot fetch anything.');
      }
      for (const f of fields) {
        const isSecret = f.type === "password" || f.key === "apiKey" || f.key === "token";
        if (isSecret && f.required !== true && f.type !== "oauth") {
          warnings.push(`configFields: secret field "${String(f.key)}" should be required:true, or first-run setup will silently skip it.`);
        }
      }
    }
  }

  // statOptions
  if (!Array.isArray(m.statOptions) || m.statOptions.length === 0) {
    errors.push("statOptions: at least one option required.");
  } else {
    (m.statOptions as unknown[]).forEach((o, i) => {
      const so = o as Record<string, unknown>;
      if (typeof so?.key !== "string") errors.push(`statOptions[${i}].key missing.`);
      if (typeof so?.label !== "string") errors.push(`statOptions[${i}].label missing.`);
    });
  }

  // supportedSizes
  if (!Array.isArray(m.supportedSizes) || m.supportedSizes.length === 0) {
    errors.push("supportedSizes: at least one size required.");
  } else {
    for (const s of m.supportedSizes as unknown[]) {
      if (typeof s !== "string" || !VALID_SIZES.includes(s)) errors.push(`supportedSizes: invalid size "${String(s)}".`);
    }
  }

  // actions
  const actionKeys = new Set<string>();
  if (m.actions !== undefined) {
    if (!Array.isArray(m.actions)) {
      errors.push("actions: array expected.");
    } else {
      (m.actions as unknown[]).forEach((a, i) => {
        const ac = a as Record<string, unknown>;
        if (typeof ac?.key !== "string" || !KEBAB_RE.test(ac.key)) {
          errors.push(`actions[${i}].key: required kebab-case field.`);
        } else if (actionKeys.has(ac.key)) {
          errors.push(`actions[${i}].key "${ac.key}" is a duplicate.`);
        } else {
          actionKeys.add(ac.key);
        }
        if (typeof ac?.label !== "string" || !ac.label) errors.push(`actions[${i}].label missing.`);
        if (ac.params !== undefined) {
          if (!Array.isArray(ac.params)) {
            errors.push(`actions[${i}].params: array expected.`);
          } else {
            (ac.params as unknown[]).forEach((p, j) => {
              const pp = p as Record<string, unknown>;
              if (typeof pp?.key !== "string") errors.push(`actions[${i}].params[${j}].key missing.`);
              if (typeof pp?.label !== "string") errors.push(`actions[${i}].params[${j}].label missing.`);
              if (typeof pp?.type !== "string" || !VALID_ACTION_PARAM_TYPES.includes(pp.type as string)) {
                errors.push(`actions[${i}].params[${j}].type: one of ${VALID_ACTION_PARAM_TYPES.join(", ")}.`);
              }
              if (pp.type === "select" && (!Array.isArray(pp.options) || pp.options.length === 0)) {
                errors.push(`actions[${i}].params[${j}].options: required for type "select".`);
              }
            });
          }
        }
        // Advisory: destructive-sounding actions should ask for confirmation.
        if (typeof ac?.key === "string" && /(delete|remove|stop|restart|shutdown|kill)/.test(ac.key) && typeof ac.confirm !== "string") {
          warnings.push(`actions[${i}] ("${ac.key}") sounds destructive — consider a "confirm" text.`);
        }
      });
    }
  }

  // api.actions must match manifest.actions
  if (m.api && typeof m.api === "object" && !Array.isArray(m.api)) {
    const apiActions = (m.api as Record<string, unknown>).actions;
    if (apiActions !== undefined) {
      if (typeof apiActions !== "object" || apiActions === null || Array.isArray(apiActions)) {
        errors.push("api.actions: object { actionKey: Endpoint } expected.");
      } else {
        for (const [key, ep] of Object.entries(apiActions as Record<string, unknown>)) {
          if (!actionKeys.has(key)) {
            errors.push(`api.actions["${key}"]: no matching action in manifest.actions.`);
          }
          if (typeof (ep as Record<string, unknown>)?.path !== "string") {
            errors.push(`api.actions["${key}"].path: required field.`);
          }
        }
        // Advisory: declared actions the api block cannot execute (adapter may cover them).
        for (const key of actionKeys) {
          if (!(key in (apiActions as Record<string, unknown>)) && !opts.hasAdapter) {
            errors.push(`actions: "${key}" has no api.actions endpoint and no adapter.js — it cannot be executed.`);
          }
        }
      }
    } else if (actionKeys.size > 0 && !opts.hasAdapter) {
      errors.push("actions declared, but neither exports.executeAction (adapter.js) nor api.actions present.");
    }
  } else if (actionKeys.size > 0 && !opts.hasAdapter) {
    errors.push("actions declared, but neither exports.executeAction (adapter.js) nor api.actions present.");
  }

  // widgets (declarative)
  if (m.widgets !== undefined) {
    if (typeof m.widgets !== "object" || m.widgets === null) {
      errors.push("widgets: object keyed by tile size expected.");
    } else {
      for (const [size, node] of Object.entries(m.widgets as Record<string, unknown>)) {
        if (!VALID_SIZES.includes(size)) errors.push(`widgets: invalid size "${size}".`);
        if (size === "1x1") errors.push('widgets: "1x1" has no widget area (stats only) — widgets only for 2x1/2x2.');
        validateWidgetNode(node, `widgets.${size}`, errors, 0, actionKeys);
      }
    }
  }

  // api (No-Code REST)
  if (m.api !== undefined) {
    const api = m.api as Record<string, unknown>;
    if (typeof api !== "object" || api === null) {
      errors.push("api: object expected.");
    } else {
      const stats = api.stats as Record<string, unknown> | undefined;
      if (!stats || typeof stats.path !== "string") errors.push("api.stats.path: required field.");
      if (!Array.isArray(api.mappings) || api.mappings.length === 0) {
        errors.push("api.mappings: at least one mapping required.");
      } else {
        const statKeys = new Set(
          Array.isArray(m.statOptions)
            ? (m.statOptions as Array<Record<string, unknown>>).map((o) => o.key)
            : [],
        );
        (api.mappings as Array<Record<string, unknown>>).forEach((map, i) => {
          if (typeof map?.key !== "string") errors.push(`api.mappings[${i}].key missing.`);
          else if (statKeys.size > 0 && !statKeys.has(map.key)) {
            errors.push(`api.mappings[${i}].key "${String(map.key)}" has no matching statOption.`);
          }
          if (typeof map?.path !== "string") errors.push(`api.mappings[${i}].path missing.`);
          if (typeof map?.label !== "string") errors.push(`api.mappings[${i}].label missing.`);
        });
      }
    }
  }

  // Notification rules
  if (m.supportsNotifications === true) {
    if (!Array.isArray(m.notificationRules) || m.notificationRules.length === 0) {
      errors.push("supportsNotifications requires notificationRules (rule catalog).");
    }
  }

  // Data-source rule (loader): need api block OR adapter.js.
  const hasApi = m.api !== undefined && typeof m.api === "object" && m.api !== null;
  const dataSource: ManifestValidationResult["dataSource"] =
    opts.hasAdapter ? "adapter.js" : hasApi ? "api" : "none";
  if (!opts.hasAdapter && !hasApi) {
    errors.push("Plugin needs adapter.js (with fetchStats + testConnection) or an api block.");
  }
  if (opts.hasAdapter && hasApi) {
    warnings.push("Both adapter.js and api block present — adapter.js takes priority, the api block is ignored for fetchStats/testConnection.");
  }

  // Advisory: api without a dedicated test endpoint falls back to "stats".
  if (hasApi && (m.api as Record<string, unknown>).test === undefined) {
    warnings.push('api: no "test" endpoint — the connection test defaults to the stats endpoint. Fine if that call also validates credentials.');
  }

  // Advisory: widget bindings referencing widgetData that the api block never populates.
  if (hasApi && m.widgets && typeof m.widgets === "object") {
    const provided = new Set<string>(
      Object.keys(((m.api as Record<string, unknown>).widgetData as Record<string, unknown>) ?? {}),
    );
    const referenced: string[] = [];
    for (const node of Object.values(m.widgets as Record<string, unknown>)) collectWidgetDataKeys(node, referenced);
    for (const key of referenced) {
      if (!provided.has(key)) {
        warnings.push(`widget binding references widgetData.${key}, but api.widgetData does not populate "${key}".`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, dataSource };
}

function validateWidgetNode(
  node: unknown,
  path: string,
  errors: string[],
  depth: number,
  actionKeys: Set<string> = new Set(),
): void {
  if (depth > 6) { errors.push(`${path}: nesting too deep (max 6 levels).`); return; }
  if (typeof node !== "object" || node === null) { errors.push(`${path}: widget node must be an object.`); return; }
  const n = node as Record<string, unknown>;
  if (typeof n.type !== "string" || !VALID_WIDGET_TYPES.includes(n.type as string)) {
    errors.push(`${path}.type: one of ${VALID_WIDGET_TYPES.join(", ")}.`);
    return;
  }
  switch (n.type) {
    case "gauge":
    case "progress":
      if (typeof n.value !== "string") errors.push(`${path}.value: binding path required.`);
      break;
    case "sparkline":
      if (typeof n.values !== "string") errors.push(`${path}.values: binding path required.`);
      break;
    case "text":
      if (typeof n.content !== "string") errors.push(`${path}.content: template string required.`);
      break;
    case "list":
      if (typeof n.items !== "string") errors.push(`${path}.items: binding path required.`);
      if (typeof n.primary !== "string") errors.push(`${path}.primary: template required.`);
      break;
    case "carousel": {
      if (typeof n.items !== "string") errors.push(`${path}.items: binding path required.`);
      const map = n.map as Record<string, unknown> | undefined;
      if (!map || typeof map.title !== "string") errors.push(`${path}.map.title: template required.`);
      break;
    }
    case "button":
      if (typeof n.action !== "string" || !n.action) {
        errors.push(`${path}.action: action key required.`);
      } else if (!actionKeys.has(n.action as string)) {
        errors.push(`${path}.action: "${String(n.action)}" is not declared in manifest.actions.`);
      }
      break;
    case "row":
    case "column":
      if (!Array.isArray(n.children) || n.children.length === 0) {
        errors.push(`${path}.children: at least one child node.`);
      } else {
        (n.children as unknown[]).forEach((c, i) => validateWidgetNode(c, `${path}.children[${i}]`, errors, depth + 1, actionKeys));
      }
      break;
  }
}

/** Collect widgetData.<key> references from a widget subtree (advisory checks). */
function collectWidgetDataKeys(node: unknown, acc: string[]): void {
  if (typeof node !== "object" || node === null) return;
  const n = node as Record<string, unknown>;
  const scan = (s: unknown) => {
    if (typeof s !== "string") return;
    const re = /widgetData\.([a-zA-Z0-9_]+)/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(s)) !== null) acc.push(mm[1]);
  };
  for (const key of ["value", "values", "items", "showIf", "content", "primary", "secondary"]) scan(n[key]);
  const map = n.map as Record<string, unknown> | undefined;
  if (map) for (const v of Object.values(map)) scan(v);
  if (Array.isArray(n.children)) for (const c of n.children) collectWidgetDataKeys(c, acc);
}

/** Convenience: parse a JSON string then validate. */
export function validateManifestJson(jsonText: string, opts: ValidateOptions = {}): ManifestValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return { ok: false, errors: [`plugin.json is not valid JSON: ${(err as Error).message}`], warnings: [], dataSource: "none" };
  }
  return validateManifest(parsed, opts);
}
