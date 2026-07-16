// ─── Dominion Plugin v2 — Authoritative Spec Constants ───────────────────────
// SOURCE OF TRUTH. Mirrors the Dominion dashboard source 1:1 (v2.1.0-beta plugin contract; unchanged in v2.2.0-beta).
// LAST_SYNCED: 2026-07-14  (Dominion Dashboard v2.1.0-beta plugin contract)
//
// Traceability (Dominion dashboard source, branch main):
//   src/plugins/types.ts           -> contracts (ConfigField, StatOption, ...)
//   src/plugins/v2/types.ts        -> PluginManifestV2, WidgetNode, RestApiSpec
//   src/plugins/v2/validate.ts     -> validation rules (ported in ../lib/validate.ts)
//   src/plugins/v2/rest-adapter.ts -> No-Code REST adapter semantics
//   src/plugins/v2/sandbox.ts      -> adapter.js sandbox surface & limits
//   src/plugins/v2/safe-fetch.ts   -> guardedFetch SSRF/size/timeout rules
//   src/plugins/v2/loader.ts       -> runtime loader (PLUGINS_DIR, id==folder)
//   src/app/api/notifications/route.ts -> external POST /api/notifications
//   docs/schemas/plugin.schema.json    -> formal JSON Schema (embedded below)

export const SYNC = {
  dashboardVersion: "2.1.0-beta",
  dashboardCommit: "cf533e0+actions",
  pluginApiVersion: 2,
  lastSynced: "2026-07-14",
} as const;

export const TILE_SIZES = ["1x1", "2x1", "2x2"] as const;

export const CATEGORIES = [
  "Storage", "Media", "Network", "Automation", "System", "Monitoring",
  "Downloads", "Security", "Productivity", "Development", "Custom",
] as const;

export const CONFIG_FIELD_TYPES = [
  "text", "password", "url", "textarea", "select", "number", "oauth",
] as const;

export const WIDGET_NODE_TYPES = [
  "stats", "gauge", "progress", "sparkline", "text", "list", "carousel", "button", "row", "column",
] as const;

export const ACTION_PARAM_TYPES = ["text", "number", "select"] as const;
export const BUTTON_VARIANTS = ["default", "danger", "ghost"] as const;

export const STAT_FORMATS = ["number", "bytes", "percent", "duration", "raw"] as const;

// Notification categories accepted by the dashboard (plugin + external API).
export const NOTIFICATION_CATEGORIES = ["info", "warning", "critical", "update"] as const;
// notificationRules[].severity is a stricter subset (no "update").
export const NOTIFICATION_RULE_SEVERITIES = ["info", "warning", "critical"] as const;

// Per-size stat limits derived by the loader when no widget is declared.
export const STAT_LIMITS: Record<string, number> = { "1x1": 3, "2x1": 6, "2x2": 6 };

// Sandbox limits (src/plugins/v2/sandbox.ts + safe-fetch.ts).
export const SANDBOX = {
  available: [
    "fetch (guarded, 10s timeout, SSRF-blocked metadata hosts, 2 MB body cap)",
    "console (log/warn/error, routed to dashboard logger with plugin prefix)",
    "JSON", "Math", "Date", "URL", "URLSearchParams",
    "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI",
  ],
  forbidden: ["require", "process", "fs", "Buffer", "setTimeout", "setInterval", "host globalThis"],
  scriptCompileTimeoutMs: 5000,
  perCallTimeoutMs: 15000,
  fetchTimeoutMs: 10000,
  maxResponseBytes: 2 * 1024 * 1024,
  maxRedirects: 3,
  blockedHosts: ["169.254.169.254", "metadata.google.internal", "metadata.azure.com", "169.254.0.0/16"],
  privateIpsAllowed: true, // Homelab: 192.168.x / 10.x targets are the norm.
} as const;

// ─── Formal JSON Schema (docs/schemas/plugin.schema.json, verbatim) ─────────
export const PLUGIN_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://raw.githubusercontent.com/Virus250188/Dominion_Public/main/docs/schemas/plugin.schema.json",
  title: "Dominion Plugin Manifest (Format v2)",
  type: "object",
  required: ["apiVersion", "id", "name", "version", "author", "description", "category", "icon", "color", "configFields", "statOptions", "supportedSizes"],
  properties: {
    apiVersion: { const: 2 },
    id: { type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" },
    name: { type: "string", minLength: 1 },
    version: { type: "string", minLength: 1 },
    author: { type: "string", minLength: 1 },
    description: { type: "string", minLength: 1 },
    category: { enum: [...CATEGORIES] },
    icon: { type: "string" },
    color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    website: { type: "string" },
    configFields: {
      type: "array", minItems: 1,
      items: {
        type: "object", required: ["key", "label", "type"],
        properties: {
          key: { type: "string" }, label: { type: "string" },
          type: { enum: [...CONFIG_FIELD_TYPES] },
          placeholder: { type: "string" }, required: { type: "boolean" },
          description: { type: "string" },
          options: { type: "array", items: { type: "object", required: ["label", "value"] } },
          min: { type: "number" }, max: { type: "number" },
          showForSizes: { type: "array", items: { enum: [...TILE_SIZES] } },
        },
      },
    },
    statOptions: {
      type: "array", minItems: 1,
      items: {
        type: "object", required: ["key", "label"],
        properties: {
          key: { type: "string" }, label: { type: "string" },
          description: { type: "string" }, defaultEnabled: { type: "boolean" },
          showForSizes: { type: "array", items: { enum: [...TILE_SIZES] } },
        },
      },
    },
    supportedSizes: { type: "array", minItems: 1, items: { enum: [...TILE_SIZES] } },
    widgets: { type: "object", propertyNames: { enum: [...TILE_SIZES] }, additionalProperties: { $ref: "#/definitions/widgetNode" } },
    actions: {
      type: "array",
      items: {
        type: "object", required: ["key", "label"],
        properties: {
          key: { type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" },
          label: { type: "string" }, icon: { type: "string" },
          confirm: { type: "string" }, successMessage: { type: "string" },
          params: {
            type: "array",
            items: {
              type: "object", required: ["key", "label", "type"],
              properties: {
                key: { type: "string" }, label: { type: "string" },
                type: { enum: [...ACTION_PARAM_TYPES] },
                options: { type: "array", items: { type: "object", required: ["label", "value"] } },
                required: { type: "boolean" }, min: { type: "number" }, max: { type: "number" },
                placeholder: { type: "string" },
              },
            },
          },
        },
      },
    },
    api: {
      type: "object", required: ["stats", "mappings"],
      properties: {
        base: { type: "string" },
        headers: { type: "object", additionalProperties: { type: "string" } },
        stats: { $ref: "#/definitions/endpoint" },
        test: { $ref: "#/definitions/endpoint" },
        mappings: {
          type: "array", minItems: 1,
          items: {
            type: "object", required: ["key", "label", "path"],
            properties: {
              key: { type: "string" }, label: { type: "string" }, path: { type: "string" },
              unit: { type: "string" }, icon: { type: "string" }, color: { type: "string" },
              format: { enum: [...STAT_FORMATS] },
            },
          },
        },
        widgetData: { type: "object", additionalProperties: { type: "string" } },
        timeoutMs: { type: "number" },
        actions: { type: "object", additionalProperties: { $ref: "#/definitions/endpoint" } },
      },
    },
    supportsNotifications: { type: "boolean" },
    notificationRules: {
      type: "array",
      items: {
        type: "object", required: ["id", "label", "description", "severity", "defaultEnabled"],
        properties: {
          id: { type: "string" }, label: { type: "string" }, description: { type: "string" },
          severity: { enum: [...NOTIFICATION_RULE_SEVERITIES] }, defaultEnabled: { type: "boolean" },
        },
      },
    },
  },
  definitions: {
    endpoint: {
      type: "object", required: ["path"],
      properties: {
        path: { type: "string" }, method: { enum: ["GET", "POST"] },
        headers: { type: "object", additionalProperties: { type: "string" } }, body: { type: "string" },
      },
    },
    widgetNode: {
      type: "object", required: ["type"],
      properties: {
        type: { enum: [...WIDGET_NODE_TYPES] },
        showIf: { type: "string" }, max: { type: "number" }, columns: { enum: [2, 3] },
        value: { type: "string" }, values: { type: "string" }, label: { type: "string" },
        color: { type: "string" }, size: { type: "number" }, content: { type: "string" },
        variant: { enum: ["title", "subtitle", "value", "muted", "default", "danger", "ghost"] },
        align: { enum: ["left", "center", "right"] },
        items: { type: "string" }, primary: { type: "string" }, secondary: { type: "string" },
        icon: { type: "string" }, maxItems: { type: "number" }, speed: { type: "number" }, gap: { type: "number" },
        action: { type: "string" }, disabledIf: { type: "string" },
        map: {
          type: "object", required: ["title"],
          properties: {
            image: { type: "string" }, title: { type: "string" }, subtitle: { type: "string" },
            badge: { type: "string" }, rating: { type: "string" }, url: { type: "string" },
          },
        },
        children: { type: "array", items: { $ref: "#/definitions/widgetNode" } },
      },
    },
  },
} as const;

// ─── Gold Examples (docs/examples/*, verbatim) ──────────────────────────────

export const EXAMPLE_PIHOLE_JSON = `{
  "$schema": "../../schemas/plugin.schema.json",
  "apiVersion": 2,
  "id": "pi-hole",
  "name": "Pi-hole",
  "version": "1.0.0",
  "author": "Dominion Community",
  "description": "DNS-Adblocker — Queries, geblockte Anfragen und Block-Rate",
  "category": "Network",
  "icon": "pihole",
  "color": "#96060C",
  "website": "https://pi-hole.net",
  "configFields": [
    { "key": "apiUrl", "label": "Pi-hole URL", "type": "url", "placeholder": "http://192.168.1.2", "required": true },
    { "key": "apiKey", "label": "API Token", "type": "password", "description": "Einstellungen > API > Show API token", "required": true }
  ],
  "statOptions": [
    { "key": "queries", "label": "DNS-Anfragen heute", "description": "Gesamtzahl der DNS-Anfragen", "defaultEnabled": true },
    { "key": "blocked", "label": "Geblockt heute", "description": "Anzahl geblockter Anfragen", "defaultEnabled": true },
    { "key": "blockRate", "label": "Block-Rate", "description": "Prozent geblockter Anfragen", "defaultEnabled": true },
    { "key": "domains", "label": "Domains auf Blocklist", "description": "Groesse der Blockliste", "defaultEnabled": false }
  ],
  "supportedSizes": ["1x1", "2x1", "2x2"],
  "api": {
    "stats": { "path": "/admin/api.php?summaryRaw&auth={config.apiKey}" },
    "mappings": [
      { "key": "queries", "label": "Anfragen", "path": "dns_queries_today", "format": "number", "icon": "globe" },
      { "key": "blocked", "label": "Geblockt", "path": "ads_blocked_today", "format": "number", "icon": "shield", "color": "#ef4444" },
      { "key": "blockRate", "label": "Block-Rate", "path": "ads_percentage_today", "format": "percent", "icon": "percent", "color": "#22c55e" },
      { "key": "domains", "label": "Blocklist", "path": "domains_being_blocked", "format": "number", "icon": "list" }
    ],
    "widgetData": { "blockRate": "ads_percentage_today", "status": "status" }
  },
  "widgets": {
    "2x2": {
      "type": "column", "gap": 10,
      "children": [
        { "type": "gauge", "value": "widgetData.blockRate", "label": "Block-Rate", "color": "#22c55e", "size": 84 },
        { "type": "stats", "max": 3 },
        { "type": "text", "content": "Status: {widgetData.status}", "variant": "muted", "align": "center" }
      ]
    }
  }
}`;

export const EXAMPLE_QBIT_JSON = `{
  "$schema": "../../schemas/plugin.schema.json",
  "apiVersion": 2,
  "id": "qbittorrent",
  "name": "qBittorrent",
  "version": "1.0.0",
  "author": "Dominion Community",
  "description": "Torrent-Client — aktive Downloads, Geschwindigkeiten, Transfers",
  "category": "Downloads",
  "icon": "qbittorrent",
  "color": "#2F67BA",
  "website": "https://www.qbittorrent.org",
  "configFields": [
    { "key": "apiUrl", "label": "qBittorrent URL", "type": "url", "placeholder": "http://192.168.1.2:8080", "required": true },
    { "key": "username", "label": "Benutzername", "type": "text", "required": true },
    { "key": "password", "label": "Passwort", "type": "password", "required": true }
  ],
  "statOptions": [
    { "key": "active", "label": "Aktive Torrents", "description": "Anzahl aktiver Torrents", "defaultEnabled": true },
    { "key": "dlSpeed", "label": "Download-Speed", "description": "Aktuelle Download-Geschwindigkeit", "defaultEnabled": true },
    { "key": "upSpeed", "label": "Upload-Speed", "description": "Aktuelle Upload-Geschwindigkeit", "defaultEnabled": true },
    { "key": "total", "label": "Torrents gesamt", "description": "Alle Torrents", "defaultEnabled": false }
  ],
  "supportedSizes": ["1x1", "2x1", "2x2"],
  "widgets": {
    "2x2": {
      "type": "column", "gap": 8,
      "children": [
        { "type": "stats", "max": 3 },
        { "type": "list", "items": "widgetData.torrents", "primary": "{name}", "secondary": "{progress}%", "max": 4 }
      ]
    }
  }
}`;

export const EXAMPLE_QBIT_ADAPTER = `// qBittorrent Adapter — Beispiel fuer adapter.js (Sandbox).
// Zeigt: Login-Flow mit Cookie, mehrere API-Calls, widgetData fuer den Baukasten.
//
// Verfuegbar in der Sandbox: fetch (abgesichert, 10s Timeout), console,
// JSON, Math, Date, URL, URLSearchParams. KEIN require/process/fs.

async function login(config) {
  const res = await fetch(config.apiUrl.replace(/\\/+$/, "") + "/api/v2/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "username=" + encodeURIComponent(config.username || "") +
          "&password=" + encodeURIComponent(config.password || ""),
  });
  const cookie = res.headers.get("set-cookie");
  if (!cookie || !cookie.includes("SID=")) {
    throw new Error("Login fehlgeschlagen — Benutzername/Passwort pruefen.");
  }
  return cookie.split(";")[0];
}

function formatSpeed(bytesPerSec) {
  if (bytesPerSec >= 1048576) return (bytesPerSec / 1048576).toFixed(1) + " MB/s";
  if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(0) + " KB/s";
  return bytesPerSec + " B/s";
}

exports.fetchStats = async (config) => {
  const base = config.apiUrl.replace(/\\/+$/, "");
  const cookie = await login(config);
  const headers = { Cookie: cookie };

  const [infoRes, torrentsRes] = await Promise.all([
    fetch(base + "/api/v2/transfer/info", { headers }),
    fetch(base + "/api/v2/torrents/info?limit=20", { headers }),
  ]);
  const info = JSON.parse(await infoRes.text());
  const torrents = JSON.parse(await torrentsRes.text());
  const active = torrents.filter((t) => t.state === "downloading" || t.state === "uploading");

  return {
    status: "ok",
    items: [
      { label: "Aktiv", value: active.length, icon: "activity" },
      { label: "Download", value: formatSpeed(info.dl_info_speed), icon: "arrow-down", color: "#22c55e" },
      { label: "Upload", value: formatSpeed(info.up_info_speed), icon: "arrow-up", color: "#3b82f6" },
      { label: "Gesamt", value: torrents.length, icon: "layers" },
    ],
    widgetData: {
      torrents: torrents.slice(0, 6).map((t) => ({
        name: t.name,
        progress: Math.round(t.progress * 100),
        state: t.state,
      })),
    },
  };
};

exports.testConnection = async (config) => {
  try {
    await login(config);
    return { ok: true, message: "Verbindung und Login erfolgreich." };
  } catch (err) {
    return { ok: false, message: err.message };
  }
};
`;
