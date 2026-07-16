// ─── Dominion Plugin v2 — Knowledge Text (AI-optimized, dense) ───────────────
// These strings are returned verbatim by the knowledge tools. They describe
// the Dominion 2.0.0-beta Enhanced App plugin format (v2). Every claim traces
// to dashboard source — see ./spec.ts header for file mapping.

export const STARTED = `# Dominion Enhanced App — Build Guide (Plugin Format v2)

You are building an "Enhanced App": a plugin that connects to a self-hosted
service and shows live stats + widgets on a Dominion dashboard tile.

## Ground truth (Dominion 2.0.0-beta)
- A plugin is a FOLDER (or ZIP) — NOT TypeScript, NOT React, NO build step.
  mein-plugin/
    plugin.json   (REQUIRED — manifest: metadata, config, stats, widgets, api)
    adapter.js    (OPTIONAL — sandboxed JS; only if the No-Code api block is not enough)
    README.md     (OPTIONAL)
- The dashboard loads plugins AT RUNTIME from PLUGINS_DIR (Docker: /data/plugins).
  Upload a ZIP -> validated -> instantly available. No restart, no compile.
- The plugin FOLDER NAME must equal the manifest "id".
- Plugin format v1 (index.ts + React .tsx + plugin.manifest.json) is DEAD and is
  rejected by the loader. Never emit v1 artifacts.

## Two ways to fetch data (pick ONE per plugin)
1. NO-CODE  -> plugin.json only. Add an "api" block: one HTTP endpoint + JSON
   path mappings. Best for simple JSON APIs (Pi-hole, most self-hosted tools).
2. adapter.js -> sandboxed JavaScript. Use ONLY when No-Code cannot do it:
   login/cookie flows, multiple requests, computed values, custom notifications.
   Adapter takes priority over the api block if both are present.

## Recommended agent workflow
1. get_started (this).
2. get_lifecycle_spec — what happens AFTER upload (config modal, testConnection,
   states). Read this BEFORE writing configFields — it prevents the #1 mistake
   (credentials never being collected on first setup).
3. get_contracts — the exact TypeScript contracts (ConfigField, StatOption,
   StatItem, PluginStats, categories, tile sizes, OAuth, entity crawler).
4. get_manifest_spec (+ get_json_schema) — every plugin.json field.
5. Choose path: get_rest_adapter_spec (No-Code) OR get_adapter_sandbox_spec (adapter.js).
6. get_widgets_spec — declarative widget "Baukasten" for 2x1 / 2x2 tiles.
7. get_actions_spec — only if the tile should have interactive buttons.
8. get_notifications_spec — only if the app should push notifications.
9. get_examples — copy the closest gold example, then adapt.
10. scaffold_plugin — generate a correct skeleton, then fill it in.
11. validate_manifest — MUST pass (mirrors the dashboard's own validator).
12. preview_widget (optional visual check) -> create_plugin_zip -> hand user the ZIP.

## Tile sizes = roles
- 1x1: status indicator, max 3 stats, NO widget area.
- 2x1: detail / mini-widget, up to 6 stats OR a compact widget.
- 2x2: full visual widget (gauge, list, carousel, ...).
Users can place multiple tiles of the same app (e.g. a 1x1 + a 2x2), each with
its own display settings but sharing one connection.

## Golden rules
- Exactly one of { api block, adapter.js } must be present, or the plugin is rejected.
- configFields MUST contain a field with key "apiUrl" — and apiUrl plus every
  credential field MUST be required:true (see get_lifecycle_spec for why).
- Secrets (apiKey/password/oauth) never reach the browser — the server holds them,
  passes them to your adapter/api at fetch time, and strips them from client payloads.
- widgets are only valid for 2x1 and 2x2. "1x1" in widgets is a hard validation error.
- Tiles CAN be interactive: declare manifest.actions + a "button" widget node
  (see get_actions_spec). Buttons execute server-side — never in the browser.
- Deliverable is always a ZIP the user uploads via Einstellungen > Community Apps.`;

export const LIFECYCLE = `# App lifecycle — what happens AFTER upload

Read this before writing configFields. Most broken plugins fail here, not in code.

1. INSTALL    ZIP upload (or PLUGINS_DIR drop) -> validation -> the app appears in
              the "App hinzufuegen" dialog. No tile exists yet, NO CONFIG EXISTS YET.
2. ADD TILE   The user picks the app + a tile size. The dashboard opens the CONFIG
              MODAL, generated 1:1 from your configFields. Fields with required:true
              block submission when empty. THIS IS THE ONLY MOMENT credentials are
              collected — if apiUrl/apiKey are not required:true, the user can skip
              them and gets a broken tile that never asked for credentials.
3. TEST       The modal's "Verbindung testen" button calls testConnection(config)
              (or api.test / api.stats). Return a human-readable, actionable message
              ("401 — API-Key falsch?") — it is shown verbatim to the user.
4. SAVE       Config is stored server-side, encrypted (AES-256-GCM), on the app's
              CONNECTION (AppConnection). Secrets never reach the browser afterwards.
5. RUN        First fetchStats runs immediately, then on the poll interval.
              status:"error" renders the tile in error state with your error string.
              A tile whose required config is missing renders an explicit
              "Einrichten" (set up) call-to-action instead.
6. MORE TILES Additional tiles of the same app REUSE the same connection/config —
              only display settings (size, enabled stats) are per-tile. Never ask
              the user to re-enter credentials in tile-level config.
7. RECONFIGURE Tile context menu -> Einstellungen reopens the modal with saved
              values (secrets masked).

## Rules that follow from this lifecycle
- apiUrl and EVERY secret field: required:true. Always. validate_manifest warns if not.
- testConnection must return actionable messages, not just ok:false.
- fetchStats must handle missing/empty config defensively (return status:"error",
  never throw) — polls can race an instance that is not yet configured.
- Use placeholder + description on every configField — the modal is your only setup UI.`;

export const ACTIONS_SPEC = `# Actions — interactive tile buttons (server-executed)

Tiles are no longer display-only: a widget may contain "button" nodes that trigger
ACTIONS (pause a downloader, restart a container, ...). The trust boundary is
unchanged: the browser only sends an actionKey + validated params to the dashboard
server (POST /api/enhanced/:tileId/actions/:key); the server injects the decrypted
config/secrets and executes the action in the same sandbox as fetchStats.

## 1. Declare actions in plugin.json (top-level "actions")
"actions": [
  { "key": "pause-all", "label": "Pause", "icon": "pause",
    "confirm": "Alle Downloads pausieren?", "successMessage": "Pausiert" },
  { "key": "set-limit", "label": "Limit", "icon": "gauge",
    "params": [ { "key": "limit", "label": "Limit (KB/s)", "type": "number",
                  "required": true, "min": 0 } ] }
]
PluginAction: { key (kebab-case), label, icon?, confirm?, params?, successMessage? }
ActionParam:  { key, label, type: "text"|"number"|"select", options?, required?, min?, max?, placeholder? }
confirm -> confirmation dialog before execution. params -> input dialog, validated
server-side against this declaration (type, required, min/max, select values).

## 2. Provide the execution — one of two ways (like fetchStats)
No-Code (api block): "api": { "actions": {
  "pause-all": { "path": "/api/v2/torrents/pause", "method": "POST", "body": "hashes=all" },
  "set-limit": { "path": "/api/v2/transfer/setDownloadLimit", "method": "POST", "body": "limit={params.limit}" }
} }
Templating: {config.*} as everywhere, plus {params.*} from validated user input.
The response does NOT need to be JSON; any 2xx counts as success.

adapter.js: exports.executeAction = async (actionKey, params, config) => {
  // same sandbox, same guardedFetch, 15s timeout
  return { ok: true, message: "optional" };
}
adapter.executeAction wins if both exist. Declared actions without any execution
source are a hard validation error.

## 3. Put buttons in the widget (2x1/2x2 only, like all widgets)
{ "type": "button", "action": "pause-all",
  "label": "Pause",                    // default: action.label
  "icon": "pause",                     // default: action.icon (Lucide name)
  "variant": "default" | "danger" | "ghost",
  "showIf": "widgetData.isRunning",    // render condition (binding)
  "disabledIf": "widgetData.busy" }     // disable condition (binding)
button.action MUST reference a declared manifest action (validated).

## 4. Runtime behavior
- After a successful action the server-side stats refresh immediately — bindings
  like showIf/disabledIf react without waiting for the poll interval.
- Rate limit: 10 actions/minute per tile (HTTP 429).
- Audit log line per action (without params — they may carry sensitive values).
- The button shows busy/success/error state inline; message/successMessage appears
  as feedback.`;

export const MANIFEST_SPEC = `# plugin.json — Manifest (Format v2)

Top-level fields (see get_json_schema for the formal JSON Schema).

REQUIRED
- apiVersion   : number   -> MUST be exactly 2.
- id           : string   -> kebab-case (^[a-z0-9]+(-[a-z0-9]+)*$). MUST equal folder name. e.g. "pi-hole".
- name         : string   -> display name, e.g. "Pi-hole".
- version      : string   -> semver, e.g. "1.0.0".
- author       : string
- description  : string
- category     : enum      -> Storage | Media | Network | Automation | System |
                              Monitoring | Downloads | Security | Productivity |
                              Development | Custom
- icon         : string   -> simple-icons slug (e.g. "pihole") or Lucide name.
- color        : string   -> hex #rrggbb (exactly 6 hex digits).
- configFields : ConfigField[]  -> >=1 item; MUST include a field with key "apiUrl".
- statOptions  : StatOption[]   -> >=1 item.
- supportedSizes : ("1x1"|"2x1"|"2x2")[]  -> >=1.

OPTIONAL
- website              : string
- widgets             : { "2x1"?: WidgetNode, "2x2"?: WidgetNode }  (declarative; NEVER "1x1")
- api                 : RestApiSpec   -> No-Code REST adapter (omit if adapter.js is used)
- supportsNotifications : boolean
- notificationRules   : PluginNotificationRule[]  -> REQUIRED (>=1) when supportsNotifications is true

DATA-SOURCE RULE: provide EITHER an "api" block in plugin.json OR an adapter.js
file (with exports.fetchStats + exports.testConnection). If both exist, adapter.js
wins. If neither exists, the plugin is REJECTED at load.

Tip: add "$schema": "../../schemas/plugin.schema.json" as the first key for
editor autocompletion (ignored by the loader).`;

export const CONTRACTS = `# Runtime Contracts (src/plugins/types.ts, verbatim shapes)

type TileSize = "1x1" | "2x1" | "2x2";

type PluginCategory =
  "Storage" | "Media" | "Network" | "Automation" | "System" | "Monitoring" |
  "Downloads" | "Security" | "Productivity" | "Development" | "Custom";

interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "textarea" | "select" | "number" | "oauth";
  placeholder?: string;
  required?: boolean;
  description?: string;
  options?: { label: string; value: string }[];   // for type "select"
  min?: number; max?: number;                       // for type "number"
  oauth?: { authUrl: string; tokenUrl: string; scopes: string[]; pkce?: boolean };
  showForSizes?: TileSize[];                         // field only shown for these sizes
}
// The dashboard stores config values encrypted (AES-256-GCM) and injects them
// into your fetch context as { config }. A field with key "apiUrl" is MANDATORY.
// Common keys the framework understands specially: apiUrl, apiKey, accessToken,
// refreshToken, expiresAt, username, password, entityIds.

interface StatOption {
  key: string;            // referenced by api.mappings[].key and by the "stats" widget
  label: string;
  description?: string;
  defaultEnabled?: boolean;
  showForSizes?: TileSize[];
}

interface StatItem {     // what fetchStats returns per stat
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;          // Lucide icon name
  color?: string;         // hex
}

interface PluginStats {  // return shape of fetchStats
  items: StatItem[];
  status: "ok" | "error";
  error?: string;
  widgetData?: Record<string, unknown>;  // rich data referenced by widget bindings
}

// testConnection returns: { ok: boolean; message: string }

interface ActionParam {
  key: string; label: string;
  type: "text" | "number" | "select";
  options?: { label: string; value: string }[];   // for type "select"
  required?: boolean; min?: number; max?: number; placeholder?: string;
}
interface PluginAction {   // manifest.actions[] — triggered by "button" widget nodes
  key: string;             // kebab-case, unique within the plugin
  label: string;
  icon?: string;           // Lucide name
  confirm?: string;        // confirmation dialog text before execution
  params?: ActionParam[];  // user inputs, validated server-side
  successMessage?: string;
}
// executeAction returns: { ok: boolean; message?: string }  (PluginActionResult)

// OAUTH (optional): declare a config field of type "oauth". The framework runs a
// managed OAuth flow (HMAC-signed state, shared callback). In adapter.js you may
// export exchangeToken(code, redirectUri, config) and refreshToken(config), each
// returning { accessToken, refreshToken?, expiresAt? }. accessToken/refreshToken/
// expiresAt are treated as secrets and stripped before any client delivery.

// ENTITY CRAWLER (optional, for services with selectable entities e.g. smart home):
interface CrawlEntityGroup {
  domain: string; label: string; icon: string;
  entities: Array<{ id: string; name: string; state: string }>;
}
// adapter.js may export crawlEntities(config) => { groups: CrawlEntityGroup[] }.
// The dashboard then shows an entity picker; selections arrive back in config.entityIds.`;

export const REST_ADAPTER_SPEC = `# Path 1 — No-Code REST Adapter ("api" block in plugin.json)

For services with a simple JSON HTTP API, no code is needed. The dashboard's
generic adapter (src/plugins/v2/rest-adapter.ts) calls your endpoint and maps
JSON fields onto stats.

interface RestApiSpec {
  base?: string;                       // default "{config.apiUrl}"; trailing slashes trimmed
  headers?: Record<string,string>;     // merged into every request; templated
  stats: RestEndpoint;                 // REQUIRED — its response feeds the stats
  test?: RestEndpoint;                 // connection test; defaults to "stats"
  mappings: RestStatMapping[];         // REQUIRED — >=1
  widgetData?: Record<string,string>;  // response paths copied 1:1 into widgetData
  timeoutMs?: number;                  // default 8000, hard-capped at 15000
  actions?: Record<string,RestEndpoint>; // No-Code action endpoints, keyed by manifest action key (see get_actions_spec)
}
interface RestEndpoint {
  path: string;                        // "/api/status?token={config.apiKey}" — absolute http(s) allowed
  method?: "GET" | "POST";             // default GET
  headers?: Record<string,string>;     // e.g. { "X-Api-Key": "{config.apiKey}" }
  body?: string;                       // templated
}
interface RestStatMapping {
  key: string;                         // MUST match a statOptions[].key
  label: string;
  path: string;                        // dot-path into the JSON response ("a.b.0.c")
  unit?: string; icon?: string; color?: string;
  format?: "number" | "bytes" | "percent" | "duration" | "raw";
}

## Templating
- {config.X} in base/path/headers/body -> replaced with the user's config value.
- Unresolvable placeholders become "".

## format semantics (src/plugins/v2/binding.ts)
- number   : Number; >=10000 -> locale-grouped ("de-DE"); non-finite -> raw string.
- bytes    : 1024-scaled to B/KB/MB/GB/TB/PB, 1 decimal (0 decimals >=100).
- percent  : rounds to 1 decimal, appends "%".
- duration : seconds -> "Xd Yh" / "Xh Ym" / "Xm".
- raw      : passthrough (number stays number, else String()).
- null/undefined -> "—".

## Response handling
- Response body must be valid JSON (adapter JSON.parses it; else error).
- Non-2xx -> stats status "error" with "HTTP <code>".
- All requests go through guardedFetch (see get_adapter_sandbox_spec: SSRF block,
  2 MB cap, timeout, redirect re-check).

Minimal example: see get_examples -> pi-hole.`;

export const SANDBOX_SPEC = `# Path 2 — adapter.js (Sandbox)

Use adapter.js ONLY when the No-Code api block cannot express the logic:
login/cookie flows, multiple/chained requests, computed values, custom
notification detection, OAuth token exchange, or entity crawling.

## Exports (CommonHS "exports." or "module.exports = {}") — all async
exports.fetchStats      = async (config) => PluginStats           // REQUIRED
exports.testConnection  = async (config) => ({ ok, message })     // REQUIRED
exports.crawlEntities   = async (config) => ({ groups: [...] })   // optional
exports.checkNotifications = async (config, current, previous) => PluginNotification[]  // optional
exports.executeAction   = async (actionKey, params, config) => ({ ok, message? })  // optional, see get_actions_spec

If adapter.js is present it fully replaces the api block for fetchStats/testConnection.

## Sandbox surface (src/plugins/v2/sandbox.ts) — node:vm context
AVAILABLE:  fetch (guarded), console (log/warn/error -> dashboard logger),
            JSON, Math, Date, URL, URLSearchParams,
            encodeURIComponent, decodeURIComponent, encodeURI, decodeURI.
FORBIDDEN:  require, process, fs, Buffer, setTimeout, setInterval, host globalThis.
            -> No timers, no npm imports, no filesystem. Pure request/transform code.

## Limits
- Script compile timeout: 5s. Per-exported-call timeout: 15s. fetch timeout: 10s.
- fetchStats must return { items: StatItem[], status, widgetData? } or it is
  coerced to an error result. testConnection must return { ok: boolean, message }.

## guardedFetch (src/plugins/v2/safe-fetch.ts) — the ONLY network primitive
- http/https only.
- Blocks cloud metadata endpoints (169.254.169.254, metadata.google.internal,
  metadata.azure.com, 169.254.0.0/16) — re-checked on EVERY redirect hop (max 3).
- PRIVATE IPs ARE ALLOWED (homelab: 192.168.x / 10.x are the normal targets).
- Response body hard-capped at 2 MB (byte counter). Errors never include the full
  URL (templates can carry secrets).
- Returns a fetch-like object: { ok, status, statusText, headers.get(name),
  text(), json() }. Read the body with await res.text() then JSON.parse, or await res.json().

## Trust boundary
adapter.js runs SERVER-SIDE. node:vm is isolation, not a hard security boundary —
so uploads are admin-gated and validated at install. Write only what you'd run on
your own server. Keep it deterministic and side-effect-free beyond fetch.

Full example with a login flow: get_examples -> qbittorrent.`;

export const WIDGETS_SPEC = `# Widgets — the declarative Baukasten (kit of parts)

Widgets are declared as JSON per tile size under manifest.widgets. NO React.
Valid sizes: "2x1" and "2x2" ONLY. Declaring widgets["1x1"] is a validation error
(1x1 shows stats only). Rendered by the dashboard's WidgetRenderer in the glass theme.

## Bindings & templates
- A BINDING is a dot-path into the render context { stats, widgetData, config }.
  e.g. "widgetData.blockRate", "widgetData.torrents", "stats.items.0.value".
- A TEMPLATE STRING mixes text + bindings in braces: "{widgetData.movieCount} Filme".
- Array indexing by number: "widgetData.list.0.name".
- showIf (binding) on any node: node renders only when the path is truthy.
- Max nesting depth: 6 levels.

## Node types
- stats     : grid of the user's enabled stats.        fields: max?, columns? (2|3)
- gauge     : circular 0–100 dial.                     fields: value(binding 0-100), label?, color?, size?(px, default 64)
- progress  : horizontal 0–100 bar.                    fields: value(binding), label?, color?
- sparkline : mini trend line.                          fields: values(binding -> number[]), label?, color?
- text      : template text.                            fields: content(template), variant?(title|subtitle|value|muted), align?(left|center|right)
- list      : rows from an array.                       fields: items(binding -> array), primary(template), secondary?(template), icon?, max?
- carousel  : media carousel with images.               fields: items(binding -> array), map{image?,title(req),subtitle?,badge?,rating?,url?}, speed?(autoplay s), maxItems?
- button    : triggers a manifest action (server-side). fields: action(req, key from manifest.actions), label?, icon?, variant?(default|danger|ghost), disabledIf?(binding) — see get_actions_spec
- row       : horizontal layout container.              fields: children(WidgetNode[]), gap?
- column    : vertical layout container.                fields: children(WidgetNode[]), gap?

## Notes
- carousel only renders http(s) image URLs (others are dropped).
- button is the ONLY interactive node. It never runs code in the browser — it POSTs
  the actionKey to the dashboard server. Requires manifest.actions (get_actions_spec).
- The "stats" node pulls from the user's enabled statOptions — you don't wire values.
- Everything else pulls from widgetData (populated by your api.widgetData map or by
  fetchStats' widgetData return). Populate widgetData with exactly the paths your
  bindings reference.

Example (Pi-hole 2x2):
"widgets": { "2x2": { "type": "column", "gap": 10, "children": [
  { "type": "gauge", "value": "widgetData.blockRate", "label": "Block-Rate", "color": "#22c55e", "size": 84 },
  { "type": "stats", "max": 3 },
  { "type": "text", "content": "Status: {widgetData.status}", "variant": "muted", "align": "center" }
]}}`;

export const NOTIFICATIONS_SPEC = `# Notifications — plugin side + external API

Dominion 2.0.0 has a real notification system: Server-Sent Events (SSE) live
panel, RSS sources, API-Key sources, and Enhanced-App (plugin) sources. There are
TWO ways a plugin/service can push notifications.

## A) Plugin notifications (checkNotifications) — inside the plugin
1. In plugin.json set:  "supportsNotifications": true
2. Provide a rule catalog (REQUIRED when supportsNotifications is true):
   "notificationRules": [
     { "id": "update-available", "label": "Update verfuegbar",
       "description": "Neue Version erkannt", "severity": "info", "defaultEnabled": true }
   ]
   severity is one of: info | warning | critical.
3. In adapter.js export checkNotifications. It runs right after fetchStats when the
   tile has a linked notification source, and receives the previous widgetData so you
   can detect state changes:
   exports.checkNotifications = async (config, current, previous) => {
     const out = [];
     if (current.version !== (previous && previous.version)) {
       out.push({
         dedupKey: "version:" + current.version,   // dedupe key (see below)
         title: "Update verfuegbar",
         message: "Neue Version " + current.version,
         category: "update",                        // info|warning|critical|update
         tag: "update-available",                   // MUST equal a notificationRules[].id
         priority: 1,                               // 0 low .. 3 critical (default 1)
         url: config.apiUrl,
         dedupMinutes: 60                            // suppress same dedupKey for N min (default 60)
       });
     }
     return out;
   };

PluginNotification shape (src/plugins/types.ts):
  { dedupKey: string; title: string; message?: string;
    category: "info"|"warning"|"critical"|"update"; priority?: 0|1|2|3;
    tag?: string; url?: string; dedupMinutes?: number }

RULE MATCHING: each emitted notification's "tag" MUST match a notificationRules[].id.
The framework filters by the user's per-source enabled rules — unknown tags are
silently dropped. Users opt in explicitly via the tile dialog's notification toggle;
there is no auto-provisioning.

## B) External notification API (for scripts, N8N, webhooks) — NOT plugin-bound
Any external service can POST notifications using an API-Key source the user creates
under Einstellungen > Benachrichtigungen (RSS / API Key / App Connect wizard).

  POST /api/notifications
  Header: X-Notification-Key: <the source's API key>
  Body (JSON):
    { "title": "string (required, <=255)",
      "message": "string (<=2000, optional)",
      "category": "info|warning|critical|update (default info)",
      "tag": "string (optional grouping)",
      "priority": 0-3 (default 1),
      "url": "http(s) link (optional)",
      "icon": "string (optional)",
      "expiresAt": "ISO-8601 date (optional)" }
  Responses: 201 {id} | 401 missing/invalid key | 403 source paused |
             429 rate limit exceeded | 400 validation error.
  Rate limit: per source, default 60/hour (configurable). Key auth is sha256-hashed
  lookup. Delivered live to the user's panel via SSE.
  Other routes: GET /api/notifications (session; 20 newest unacked),
  POST /api/notifications/{id}/ack, GET /api/notifications/stream (SSE),
  POST /api/notifications/rss-poll.

Use A) for state your plugin already fetches. Use B) for out-of-band pushes from
external automations (no plugin needed).`;

export const DEPLOYMENT_SPEC = `# Packaging, install & runtime behavior

## Package
Zip the plugin files at the ROOT of the archive (no wrapping folder needed for
upload; the loader keys off the manifest id, and the folder name must match id):
  zip mein-plugin.zip plugin.json adapter.js README.md
(Use create_plugin_zip to produce this correctly.)

## Install (users)
Einstellungen > Community Apps > ZIP hochladen.
- Validation runs on upload; errors return as plain text.
- Admin-gated (adapter.js executes server-side; upload is the trust boundary).
- Zip-bomb guard: unpacks at most 5 MB.
- Failed install auto-rolls back to the previous working version.
- On success the app is IMMEDIATELY available in the "App hinzufuegen" dialog —
  no build, no restart (runtime loader, PLUGINS_DIR, Docker: /data/plugins).

## Install (developers / bare metal)
Drop the plugin folder into PLUGINS_DIR; it is auto-discovered. Folder name MUST
equal the manifest id. reloadRuntimePlugins() is idempotent and runs on demand.

## Catalog
GET /api/plugins/catalog returns all plugins (builtin + runtime) as serializable
descriptors to the client. Built-in plugins (Emby, Home Assistant) still run as
compiled legacy widgets; your community plugins run through the v2 runtime.

## Migration from v1 (index.ts/.tsx)
1. Move metadata/configFields/statOptions/supportedSizes into plugin.json (apiVersion 2, id=folder).
2. Port fetchStats/testConnection into adapter.js (pure JS, exports.* style) — or
   replace them entirely with an api block.
3. Rebuild the React widget as a declarative widgets layout.
4. renderHints are gone — they are derived from widgets.
A v1 folder left in PLUGINS_DIR is ignored with a clear migration hint.`;
