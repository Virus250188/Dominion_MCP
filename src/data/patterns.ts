// ─── Patterns & Best Practices Module ──────────────────────────────────────
// Code patterns, anti-patterns, and implementation guidelines for Enhanced Apps.
// Served to AI agents via MCP tools to guide correct plugin implementation.
//
// LAST_SYNCED: 2026-04-13
// DASHBOARD_VERSION: 1.3.0-beta
// SOURCE: Dashboard/src/plugins/types.ts, utils.ts, builtin/emby/index.ts,
//         src/lib/notifications/plugin-checker.ts, src/lib/actions/notifications.ts,
//         src/components/dashboard/TileDialog.tsx, src/components/settings/NotificationSourceManager.tsx
// ────────────────────────────────────────────────────────────────────────────

export const PATTERNS = {
  pluginStructure: `
# Plugin-Struktur (AppPlugin Interface)

## ⚠️ Stille Fallen — bevor du anfaengst zu coden, lies das hier

Diese drei Punkte haben in echten Plugin-Entwicklungs-Sessions zusammen 60+ Minuten
Refactor verursacht. Sie sind nicht offensichtlich aus dem Type-System ableitbar.

### 1. \`crawlEntities\` ↔ \`statOptions\` sind im UI exklusiv

Sobald \`crawlEntities\` exportiert wird UND beim Verbindungstest non-leere Gruppen
zurueckgibt (\`crawledGroups.length > 0\`), ersetzt der **Entity-Picker** den
**stat-Picker** — fuer **alle Tile-Groessen**, nicht nur die mit Crawler.
Es gibt keinen Per-Size-Override.

\`\`\`
Plugin exportiert crawlEntities → User sieht Entity-Picker im 1x1, 2x1, 2x2
Plugin exportiert NICHT crawlEntities → User sieht statOptions-Checkboxen
\`\`\`

**Konsequenz:** Wenn dein 1x1 statOption-Auswahl braucht UND dein 2x2 einen
Entity-Picker, geht das nicht in einem Plugin. Entscheide bewusst pro Plugin.
Source: \`core/src/components/dashboard/TileDialog.tsx\` ~line 1574 (\`crawledGroups.length > 0 ? ... : ...\`).

### 2. CONNECTION_KEYS Whitelist — required configFields muessen darauf liegen

Das Dashboard hat eine **hardcodierte Liste** der Keys die als "Connection-Daten"
gelten und beim Reuse einer AppConnection automatisch geladen werden:

\`\`\`typescript
const CONNECTION_KEYS = ["apiUrl", "apiKey", "accessToken", "username", "password"];
\`\`\`
(Source: \`core/src/lib/actions/tiles.ts:43\`)

**Was passiert wenn du einen anderen \`required: true\` configField definierst
(z.B. \`apiSecret\`, \`token\`, \`bearer\`):**

- Erste Tile: funktioniert, der User gibt den Wert ein
- Zweite Tile mit derselben Connection: bricht ab mit \`Missing required config
  fields: <key>\` weil das Dashboard nur die 5 CONNECTION_KEYS aus der gespeicherten
  Connection laedt, dein Custom-Field aber nicht

**Regel:** Fuer required Credential-aehnliche Felder NUR \`apiKey\`, \`accessToken\`,
\`username\`, \`password\` benutzen — nie \`apiSecret\`, \`secret\`, \`token\`, \`bearer\`,
\`authKey\` o.ae. \`apiUrl\` ist auch in der Liste, aber wird in der UI gesondert behandelt.

Optional/Feature-Fields (\`required: false\`) duerfen jeden Key haben, sie sind
"Per-Tile" Konfiguration und werden nicht aus der Connection geladen.

\`validate_plugin\` fangt das jetzt automatisch (Rule 31).

### 3. \`showForSizes\` ist DAS Per-Size-Konfigurations-Pattern

Sowohl \`ConfigField\` als auch \`StatOption\` haben ein \`showForSizes?: TileSize[]\`
Property. Es ist die einzige Art, Felder an Tile-Groessen zu binden:

\`\`\`typescript
statOptions: [
  { key: "cpu", label: "CPU", description: "...", defaultEnabled: true,
    showForSizes: ["1x1"] },  // ← nur im 1x1 Dialog sichtbar
],
configFields: [
  { key: "apiUrl", label: "...", type: "url", required: true },
  { key: "gauge1", label: "Gauge Links", type: "select", options: [...],
    showForSizes: ["2x1", "2x2"] },  // ← nur in den Widget-Groessen sichtbar
],
\`\`\`

**Faustregel:** Wenn dein Plugin Widgets hat, gehoeren statOptions nach \`["1x1"]\`
und Widget-Konfiguration in configFields mit \`showForSizes: ["2x1", "2x2"]\`.

---

## Plugin Manifest (plugin.manifest.json)

Jedes Plugin MUSS ein Manifest haben (Pflicht fuer ZIP-Upload):

\`\`\`json
{
  "id": "mein-plugin",
  "name": "Mein Plugin",
  "version": "1.0.0",
  "author": "Dein Name",
  "description": "Kurzbeschreibung des Plugins",
  "minDashboardVersion": "1.0.5",
  "hasWidget": true,
  "widgetFile": "MeinPluginWidget.tsx"
}
\`\`\`

| Feld | Pflicht | Beschreibung |
|------|---------|-------------|
| id | Ja | Kebab-case, muss mit metadata.id + Ordnername uebereinstimmen |
| name | Ja | Anzeigename |
| version | Ja | Semver (z.B. "1.0.0") |
| author | Ja | Name oder Handle des Entwicklers |
| description | Ja | Kurzbeschreibung (ein Satz) |
| minDashboardVersion | Nein | Minimale Dashboard-Version (z.B. "1.0.5") |
| hasWidget | Nein | true wenn Widget vorhanden |
| widgetFile | Nein | Dateiname des Widgets (Pflicht wenn hasWidget=true) |

## Vollstaendiges Interface

\`\`\`typescript
import type { AppPlugin, PluginConfig, PluginStats } from "../../types";
import { getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions } from "../../utils";

// PFLICHT: Genau "plugin" als Export-Name (fuer Auto-Discovery)
export const plugin: AppPlugin = {
  metadata: {
    id: string,           // lowercase, z.B. "emby", "opnsense" (= Ordnername!)
    name: string,         // Anzeigename, z.B. "Emby", "OPNsense"
    icon: string,         // simple-icons Slug, z.B. "Emby", "Opnsense"
    color: string,        // Hex-Farbe, z.B. "#0095d5" (MUSS #XXXXXX Format)
    description: string,  // Kurzbeschreibung auf Deutsch
    category: PluginCategory,  // "Storage" | "Media" | "Network" | "Automation" |
                               // "System" | "Monitoring" | "Downloads" | "Security" |
                               // "Productivity" | "Development" | "Custom"
    website?: string,     // Optionale URL zur offiziellen Website
  },

  configFields: ConfigField[],     // Formularfelder fuer die Konfiguration
  statOptions: StatOption[],       // Waehlbare Statistiken
  supportedSizes: TileSize[],      // Mindestens ["1x1"]
  renderHints: Partial<Record<TileSize, SizeRenderHint>>,

  // Pflicht-Funktionen:
  async fetchStats(config: PluginConfig): Promise<PluginStats> { ... },
  async testConnection(config: PluginConfig): Promise<{ ok: boolean; message: string }> { ... },

  // Optional:
  async crawlEntities?(config: PluginConfig): Promise<{ groups: CrawlEntityGroup[] }> { ... },

  // Optional (nur fuer OAuth-Plugins):
  async exchangeToken?(code: string, redirectUri: string, config: PluginConfig): Promise<{
    accessToken: string; refreshToken?: string; expiresAt?: number;
  }> { ... },
  async refreshToken?(config: PluginConfig): Promise<{
    accessToken: string; refreshToken?: string; expiresAt?: number;
  }> { ... },

  // Optional: Notification-Support (beide Felder zusammen noetig!)
  supportsNotifications?: boolean,  // true = Plugin kann Notifications ausloesen
  notificationRules?: PluginNotificationRule[],  // Katalog aller Rules die das Plugin anbietet

  // Optional: Plugin-originated Notifications (nur aktiv wenn der User die Source via
  // TileDialog-Toggle explizit erstellt hat UND die jeweilige Rule eingeschaltet ist)
  async checkNotifications?(
    config: PluginConfig,
    currentData: Record<string, unknown>,      // Aktuelles widgetData aus fetchStats
    previousData: Record<string, unknown> | null, // Vorheriges widgetData (null beim ersten Poll!)
  ): Promise<PluginNotification[]> { ... },
};

// PFLICHT fuer Auto-Discovery (auch wenn null):
export const widget = MeinWidget;        // oder null
export const widgetName = "MeinWidget";  // oder null
\`\`\`

## Typ-Definitionen

### PluginMetadata
\`\`\`typescript
interface PluginMetadata {
  id: string;            // Plugin-ID (kebab-case, muss Registry-weit eindeutig sein)
  name: string;          // Anzeigename (wird im TileDialog und Katalog gezeigt)
  icon: string;          // simple-icons Slug mit Grossbuchstabe (z.B. "Emby")
  color: string;         // Hex-Farbe (#XXXXXX) - wird als App-Farbe verwendet
  description: string;   // Kurzbeschreibung auf Deutsch (z.B. "Zeigt an: ...")
  category: PluginCategory;  // Kategorie fuer die Sortierung im Katalog
  website?: string;      // URL zur offiziellen Projekt-Website
}
\`\`\`

### ConfigField
\`\`\`typescript
interface ConfigField {
  key: string;          // Config-Key (z.B. "apiUrl", "apiKey", "accessToken")
  label: string;        // Formular-Label auf Deutsch (z.B. "Emby Server URL")
  type: "text" | "password" | "url" | "textarea" | "select" | "number" | "oauth";
  placeholder?: string; // Platzhaltertext (z.B. "http://emby.local:8096")
  required?: boolean;   // Pflichtfeld? (apiUrl ist fast immer required)
  description?: string; // Hilfetext auf Deutsch unter dem Feld
  options?: { label: string; value: string }[];  // Nur fuer type: "select"
  min?: number;         // Nur fuer type: "number"
  max?: number;         // Nur fuer type: "number"
  showForSizes?: TileSize[];  // Optional: Feld nur fuer bestimmte Tile-Groessen anzeigen (z.B. ["2x1", "2x2"])
  oauth?: {             // Nur fuer type: "oauth"
    authUrl: string;    // Authorization Endpoint des Providers
    tokenUrl: string;   // Token Exchange Endpoint
    scopes: string[];   // Benoetigte Scopes
    pkce?: boolean;     // Optional: PKCE Flow verwenden
  };
}
\`\`\`

### StatOption
\`\`\`typescript
interface StatOption {
  key: string;           // Interner Key (z.B. "usage", "streams", "uptime")
  label: string;         // Label auf Deutsch (z.B. "Speicher-Belegung")
  description: string;   // Beschreibung auf Deutsch (z.B. "Prozent des belegten Speichers")
  defaultEnabled: boolean; // Standard-aktiviert? (true fuer die wichtigsten 2-3)
  showForSizes?: TileSize[];  // Optional: Nur fuer bestimmte Tile-Groessen anzeigen
}
\`\`\`

### SizeRenderHint
\`\`\`typescript
interface SizeRenderHint {
  maxStats: number;           // Max Stats fuer diese Groesse (1x1: bis 3, 2x1/2x2: bis 6)
  layout: "compact" | "detailed" | "widget";
  widgetComponent?: string;   // Widget-Name (nur bei layout: "widget")
}
\`\`\`

### OAuthConfig (fuer type: "oauth" ConfigFields)
\`\`\`typescript
interface OAuthConfig {
  authUrl: string;     // Authorization Endpoint des Providers
  tokenUrl: string;    // Token Exchange Endpoint
  scopes: string[];    // Benoetigte Scopes
  pkce?: boolean;      // Optional: PKCE Flow verwenden (sicherer)
}
\`\`\`

### CrawlEntityGroup (fuer crawlEntities)
\`\`\`typescript
interface CrawlEntityGroup {
  domain: string;      // Gruppierungs-Key (z.B. "sensor", "light", "container")
  label: string;       // Anzeige-Label auf Deutsch (z.B. "Sensoren", "Lichter")
  icon: string;        // Lucide-Icon-Name (z.B. "Activity", "Lightbulb")
  entities: Array<{
    id: string;        // Eindeutige Entity-ID (z.B. "sensor.temperature_kitchen")
    name: string;      // Anzeigename (z.B. "Kueche Temperatur")
    state: string;     // Aktueller Status (z.B. "23.5", "on", "running")
  }>;
}
\`\`\`

### PluginNotificationRule (fuer notificationRules-Katalog)
\`\`\`typescript
interface PluginNotificationRule {
  id: string;              // Rule-ID — MUSS mit PluginNotification.tag uebereinstimmen
                           //   (z.B. "interface_down", "disk_full", "array_stopped")
  label: string;           // Angezeigter Name im Settings-Picker (Deutsch)
  description: string;     // Hilfetext unter der Checkbox (Deutsch)
  severity: "info" | "warning" | "critical";
  defaultEnabled: boolean; // Default beim Erstellen der NotificationSource
}
\`\`\`

### PluginNotification (Rueckgabewert von checkNotifications)
\`\`\`typescript
interface PluginNotification {
  dedupKey: string;        // Eindeutiger Dedup-Key (z.B. "container-stopped-abc123")
  title: string;           // Notification-Titel (max 255 Zeichen)
  message?: string;        // Body-Text (max 2000 Zeichen)
  category: "info" | "warning" | "critical" | "update";
  priority?: number;       // 0-3, default 1
  tag?: string;            // PFLICHT fuer Plugin-Notifications: MUSS exakt der id einer
                           //   PluginNotificationRule entsprechen. Notifications ohne tag
                           //   oder mit unbekanntem tag werden vom Framework SILENT gedropped
                           //   (runNotificationCheck rule-filter in plugin-checker.ts).
  url?: string;            // Link zum Oeffnen bei Klick
  dedupMinutes?: number;   // Unterdrueckung gleicher dedupKey fuer N Minuten (default: 60)
}
\`\`\`
`,

  configFields: `
# ConfigField Typen und Beispiele

## Typ-Uebersicht

| Typ        | HTML Element | Beispiel-Einsatz                      |
|------------|-------------|---------------------------------------|
| \`"url"\`    | Input URL   | Server-URL, API-Endpunkt              |
| \`"password"\`| Input PW   | API Key, Access Token, Passwort       |
| \`"text"\`   | Input Text  | Benutzername, benutzerdefinierte IDs  |
| \`"textarea"\`| Textarea   | Mehrzeilige Entity-Listen (Legacy)    |
| \`"select"\` | Select      | Dropdown-Auswahl (z.B. Protokoll)     |
| \`"number"\` | Input Num   | Port, Intervall, Limits               |
| \`"oauth"\`  | OAuth Button| OAuth-Verbindung (Spotify, GitHub, etc.) |

## Typische Muster

### Muster 1: URL + API Key (am häufigsten)
\`\`\`typescript
configFields: [
  {
    key: "apiUrl",
    label: "Server URL",
    type: "url",
    placeholder: "http://service.local:8080",
    required: true,
    description: "Die URL deiner Service-Instanz",
  },
  {
    key: "apiKey",
    label: "API Key",
    type: "password",
    required: true,
    description: "Erstelle einen API Key unter Einstellungen → API Keys",
  },
],
\`\`\`

### Muster 2: URL + Access Token (z.B. Smart-Home Services)
\`\`\`typescript
configFields: [
  {
    key: "apiUrl",
    label: "Server URL",
    type: "url",
    placeholder: "http://service.local:8123",
    required: true,
    description: "Die URL deiner Service-Instanz",
  },
  {
    key: "accessToken",
    label: "Long-Lived Access Token",
    type: "password",
    required: true,
    description: "Erstelle einen Token in den Service-Einstellungen",
  },
],
\`\`\`

### Muster 3: URL + Username + Password (z.B. Download-Manager)
\`\`\`typescript
configFields: [
  {
    key: "apiUrl",
    label: "Service URL",
    type: "url",
    placeholder: "http://service.local:3129",
    required: true,
    description: "Die URL deines Services",
  },
  {
    key: "username",
    label: "Benutzername",
    type: "text",
    required: false,
    description: "Optional: Benutzername fuer die Authentifizierung",
  },
  {
    key: "password",
    label: "Passwort",
    type: "password",
    required: false,
    description: "Optional: Passwort fuer die Authentifizierung",
  },
],
\`\`\`

### Muster 4: Mit Select-Dropdown
\`\`\`typescript
configFields: [
  // ... URL + Key
  {
    key: "protocol",
    label: "Protokoll",
    type: "select",
    required: true,
    options: [
      { label: "HTTPS", value: "https" },
      { label: "HTTP", value: "http" },
    ],
    description: "Verbindungsprotokoll zum Server",
  },
],
\`\`\`

### Muster 5: Widget-spezifische Feature-Felder (z.B. Emby)
\`\`\`typescript
configFields: [
  // Connection fields (immer sichtbar):
  { key: "apiUrl", label: "Server URL", type: "url", required: true, ... },
  { key: "apiKey", label: "API Key", type: "password", required: true, ... },
  // Feature fields (erst nach erfolgreichem Verbindungstest sichtbar):
  {
    key: "mediaCategory",
    label: "Medien-Kategorie",
    type: "select",
    description: "Welche Kategorie soll in den Widgets angezeigt werden?",
    options: [
      { label: "Filme", value: "Movie" },
      { label: "Serien", value: "Series" },
      { label: "Filme & Serien", value: "Mixed" },
    ],
  },
  {
    key: "carouselSpeed",
    label: "Karussell-Geschwindigkeit",
    type: "select",
    showForSizes: ["2x1", "2x2"],  // Nur fuer Widget-Groessen anzeigen
    options: [
      { label: "Langsam (8s)", value: "8000" },
      { label: "Normal (5s)", value: "5000" },
      { label: "Schnell (3s)", value: "3000" },
    ],
  },
],
\`\`\`

## Regeln
- **apiUrl ist fast immer das erste Feld** mit type: "url" und required: true
- **Labels und Beschreibungen auf Deutsch**
- **Hilfreiche Descriptions:** Sage dem User WO er den Key/Token findet
- **Placeholders:** Zeige ein realistisches Beispiel der URL
- **Reihenfolge:** URL zuerst, dann Authentifizierung, dann optionale Feature-Felder
- **Connection vs Feature Split:** Connection-Felder (apiUrl, apiKey, etc.) sind immer sichtbar.
  Feature-Felder (mediaCategory, carouselSpeed, etc.) werden im TileDialog erst nach
  erfolgreichem Verbindungstest angezeigt. Feature-Felder NICHT als required markieren.
`,

  statOptions: `
# StatOption Pattern

## Grundstruktur

\`\`\`typescript
statOptions: [
  {
    key: "usage",          // Interner Schluessel (in visibleStats Array)
    label: "Speicher-Belegung",  // Anzeige-Label auf Deutsch
    description: "Prozent des belegten Speichers",  // Hilfetext auf Deutsch
    defaultEnabled: true,   // Standardmaessig aktiviert?
  },
  {
    key: "free",
    label: "Freier Speicher",
    description: "Verbleibender freier Speicherplatz",
    defaultEnabled: true,
  },
  {
    key: "uptime",
    label: "Uptime",
    description: "System-Betriebszeit",
    defaultEnabled: true,
  },
  {
    key: "pools",
    label: "Pool-Anzahl",
    description: "Anzahl der Storage Pools",
    defaultEnabled: false,  // Nicht standardmaessig sichtbar
  },
],
\`\`\`

## Regeln

1. **defaultEnabled: true** fuer die wichtigsten 2-3 Stats
2. **defaultEnabled: false** fuer optionale/sekundaere Stats
3. **Labels auf Deutsch** - kurz und praegnant
4. **Descriptions auf Deutsch** - erklaeren was der Stat zeigt
5. **key muss in fetchStats verwendet werden** - via \`visibleStats.includes(key)\`
6. **Max 6 statOptions empfohlen** - Validator schneidet bei 6 Items ab

## showForSizes bei StatOptions

StatOptions koennen \`showForSizes\` definieren, um bestimmte Stats nur fuer
bestimmte Tile-Groessen im TileDialog anzubieten:

\`\`\`typescript
statOptions: [
  {
    key: "streams",
    label: "Aktive Streams",
    description: "Anzahl der aktiven Streaming-Sessions",
    defaultEnabled: true,
    // Kein showForSizes → wird fuer alle Groessen angezeigt (Standard)
  },
  {
    key: "detailedTraffic",
    label: "Traffic Details",
    description: "Detaillierte Traffic-Statistiken",
    defaultEnabled: false,
    showForSizes: ["2x1", "2x2"],  // Nur fuer groessere Tiles sinnvoll
  },
],
\`\`\`

- Wenn \`showForSizes\` **nicht gesetzt** ist (Standard): Stat-Option erscheint fuer alle Groessen
- Wenn gesetzt: Nur wenn die aktuelle Tile-Groesse im Array enthalten ist
- Beim Wechsel auf eine Groesse, in der ein bereits gewaehlter Stat nicht verfuegbar ist,
  wird dieser automatisch abgewaehlt

## Wie visibleStats in fetchStats funktioniert

\`\`\`typescript
import { getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions, formatBytes } from "../../utils";

async fetchStats(config: PluginConfig): Promise<PluginStats> {
  // Shared Utility: parst config.visibleStats (JSON-String oder Array) mit Fallback auf Defaults
  const visibleStats = getVisibleStats(config, this.statOptions);

  const items: StatItem[] = [];

  // Nur Stats sammeln die der User aktiviert hat
  if (visibleStats.includes("usage")) {
    items.push({ label: "Belegt", value: \\\`\\\${usedPercent}%\\\`, color: "green" });
  }
  if (visibleStats.includes("free")) {
    items.push({ label: "Frei", value: formatBytes(freeSpace) });
  }

  return { items, status: "ok" };
}
\`\`\`

### PluginConfig Felder

\`\`\`typescript
interface PluginConfig {
  apiUrl: string;
  apiKey?: string;
  accessToken?: string;
  username?: string;
  password?: string;
  entityIds?: string;           // Legacy: Komma-/Newline-separierte Entity-IDs
  visibleStats?: unknown;       // JSON-String ODER Array (backward compat)
  selectedEntities?: unknown;   // JSON-String ODER Array (backward compat)
  [key: string]: unknown;       // Weitere benutzerdefinierte Felder (mediaCategory, carouselSpeed, etc.)
}
\`\`\`

### Shared Utilities (src/plugins/utils.ts)

\`\`\`typescript
// Visible Stats mit Fallback auf Defaults
getVisibleStats(config: PluginConfig, statOptions: StatOption[]): string[]

// URL normalisieren (trailing slash entfernen)
normalizeUrl(url: string | unknown): string

// Error-Response erstellen
createErrorResponse(err: unknown): PluginStats  // { items: [], status: "error", error: message }

// Fetch-Optionen mit AbortSignal.timeout und optionalen Headers
createFetchOptions(timeout?: number, headers?: Record<string, string>): RequestInit

// Bytes formatieren (z.B. 1536000 -> "1.5 MB")
formatBytes(bytes: number): string

// Uptime formatieren (z.B. 90000 -> "1d 1h")
formatUptime(seconds: number): string
\`\`\`
`,

  widgetDataPattern: `
# widgetData Pattern (Reichhaltige Widget-Daten)

## Konzept

Plugins koennen neben den \`items\` (StatItem[]) auch ein \`widgetData\` Objekt zurueckgeben.
\`widgetData\` ist ein freies \`Record<string, unknown>\` und wird NICHT vom Validator gefiltert.
Es wird direkt an die Widget-Komponente durchgereicht via \`stats.widgetData\`.

## Wann verwenden?

- Wenn das Widget **mehr als nur Zahlen** anzeigen soll (z.B. Cover-Bilder, Listen, Metadaten)
- Wenn Widget-spezifische **Konfigurationswerte** weitergegeben werden muessen (z.B. Karussell-Geschwindigkeit)
- Wenn die Daten **nicht in das StatItem-Format** passen (z.B. Arrays von Objekten)

## Emby Referenz-Beispiel

Das Emby Plugin ist das Referenz-Beispiel fuer widgetData:

\`\`\`typescript
// In fetchStats():
return {
  items,          // Normale Stats: Streams, Filme, Serien
  status: "ok",
  widgetData: {
    recentItems: [    // Array von kuerzlich hinzugefuegten Medien
      {
        id: "12345",
        title: "Film Name",
        year: 2024,
        rating: 7.5,
        officialRating: "PG-13",
        type: "Movie",               // oder "Series"
        imageUrl: "http://emby.local:8096/Items/12345/Images/Primary?maxHeight=400&quality=90",
        overview: "Kurze Beschreibung...",
      },
    ],
    mediaCategory: "Mixed",          // Config-Wert durchgereicht
    carouselSpeed: 5000,             // Config-Wert durchgereicht (ms)
    carouselItems: 5,                // Config-Wert durchgereicht
  },
};
\`\`\`

## Widget-spezifische ConfigFields

Plugins die widgetData verwenden, definieren haeufig zusaetzliche ConfigFields
fuer Widget-Einstellungen. Diese Feature-Felder werden im TileDialog ERST
angezeigt, nachdem der Verbindungstest erfolgreich war.

\`\`\`typescript
// Emby configFields (nach apiUrl + apiKey):
{
  key: "mediaCategory",
  label: "Medien-Kategorie",
  type: "select",
  description: "Welche Kategorie soll in den Widgets angezeigt werden?",
  options: [
    { label: "Filme", value: "Movie" },
    { label: "Serien", value: "Series" },
    { label: "Filme & Serien", value: "Mixed" },
  ],
},
{
  key: "carouselSpeed",
  label: "Karussell-Geschwindigkeit",
  type: "select",
  showForSizes: ["2x1", "2x2"],  // Nur fuer Widget-Groessen
  options: [
    { label: "Langsam (8s)", value: "8000" },
    { label: "Normal (5s)", value: "5000" },
    { label: "Schnell (3s)", value: "3000" },
  ],
},
{
  key: "carouselItems",
  label: "Anzahl Covers",
  type: "select",
  showForSizes: ["2x1", "2x2"],  // Nur fuer Widget-Groessen
  options: [
    { label: "3 Covers", value: "3" },
    { label: "5 Covers", value: "5" },
    { label: "8 Covers", value: "8" },
    { label: "10 Covers", value: "10" },
  ],
},
\`\`\`

## Im Widget lesen

\`\`\`typescript
function EmbyWidget2x2({ stats }: WidgetProps) {
  const widgetData = stats.widgetData as {
    recentItems?: Array<{ id: string; title: string; imageUrl: string; ... }>;
    carouselSpeed?: number;
    carouselItems?: number;
    mediaCategory?: string;
  } | undefined;

  const recentItems = widgetData?.recentItems || [];
  const speed = widgetData?.carouselSpeed || 5000;

  // Pre-render slides, use CSS opacity transitions (no JS-driven fades)
  return (
    <div className="flex flex-col h-full">
      {/* ... carousel with CSS transitions ... */}
    </div>
  );
}
\`\`\`

## Regeln

1. **widgetData ist optional** - Plugins ohne Widgets brauchen es nicht
2. **Nicht fuer Stats verwenden** - Stats gehoeren in \`items\`, nicht in widgetData
3. **Config-Werte durchreichen** - Widget-spezifische Config-Werte (carouselSpeed etc.) in widgetData ablegen
4. **Im Widget typisieren** - \`stats.widgetData as { ... } | undefined\` mit Fallback-Werten
5. **Bildgroessen begrenzen** - Image-URLs sollten \`maxHeight=400\` oder aehnlich haben
6. **CSS-Transitions bevorzugen** - Fuer Karussells und Uebergaenge CSS opacity verwenden statt JS-Animationen
`,

  fetchStatsPattern: `
# fetchStats Implementation Pattern

## Komplettes Beispiel (basierend auf dem Emby Referenz-Plugin)

\`\`\`typescript
import { getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions } from "../../utils";

async fetchStats(config: PluginConfig): Promise<PluginStats> {
  try {
    // 1. Sichtbare Stats ermitteln (Shared Utility)
    const visibleStats = getVisibleStats(config, this.statOptions);

    // 2. Basis-URL normalisieren (Shared Utility)
    const baseUrl = normalizeUrl(config.apiUrl);
    const apiKey = String(config.apiKey || "");

    // 3. Auth-Header vorbereiten
    const headers: HeadersInit = { "X-Emby-Token": apiKey };
    const fetchOpts = { ...createFetchOptions(8000), headers };

    // 4. Mehrere Endpoints PARALLEL abfragen (Promise.all)
    const [sessionsRes, countsRes] = await Promise.all([
      fetch(\\\`\\\${baseUrl}/Sessions\\\`, fetchOpts),
      fetch(\\\`\\\${baseUrl}/Items/Counts\\\`, fetchOpts),
    ]);

    // 5. Stats sammeln (NUR sichtbare, Reihenfolge = Prioritaet)
    const items: StatItem[] = [];

    if (visibleStats.includes("streams") && sessionsRes.ok) {
      const sessions = await sessionsRes.json();
      const active = Array.isArray(sessions)
        ? sessions.filter((s: { NowPlayingItem?: unknown }) => s.NowPlayingItem)
        : [];
      items.push({
        label: "Streams",
        value: active.length,
        color: active.length > 0 ? "green" : undefined,
      });
    }

    if (countsRes.ok) {
      const counts = await countsRes.json();
      if (visibleStats.includes("movies")) {
        items.push({ label: "Filme", value: counts.MovieCount ?? 0 });
      }
      if (visibleStats.includes("series")) {
        items.push({ label: "Serien", value: counts.SeriesCount ?? 0 });
      }
    }

    // 6. Optional: widgetData fuer reichhaltige Widget-Daten
    // Nur noetig wenn das Plugin ein Widget hat das mehr als Stats braucht
    // const widgetData = { recentItems: [...], carouselSpeed: 5000 };

    // 7. Zurueckgeben (NICHT selbst slicen, Validator macht das)
    return { items, status: "ok" /* , widgetData */ };
  } catch (err) {
    // NIEMALS eine Exception werfen! Shared Utility fuer Error-Response.
    return createErrorResponse(err);
  }
}
\`\`\`

## Regeln (Zusammenfassung)

1. **Immer try/catch** - fetchStats darf NIEMALS eine Exception werfen
2. **Shared Utilities verwenden** - \`getVisibleStats\`, \`normalizeUrl\`, \`createFetchOptions\`, \`createErrorResponse\`
3. **visibleStats respektieren** - Nur vom User aktivierte Stats sammeln
4. **Promise.all() fuer parallele Requests** - Unabhaengige Endpoints parallel
5. **Nicht selbst slicen** - Validator und StatsDisplay uebernehmen das
6. **Reihenfolge = Prioritaet** - Wichtigste Stats zuerst im items Array
7. **Config-Werte als String casten** - \`String(config.apiKey || "")\`

## StatItem Rueckgabe

\`\`\`typescript
interface StatItem {
  label: string;          // DEUTSCH! z.B. "Belegt", "Streams", "Uptime"
  value: string | number; // z.B. "72%", 42, "3d 12h"
  unit?: string;          // z.B. "GB", "%", "MB/s", "°C"
  icon?: string;          // Lucide-Icon-Name z.B. "HardDrive", "Activity"
  color?: string;         // "green" | "red" | "yellow" | undefined
}
\`\`\`
`,

  testConnectionPattern: `
# testConnection Implementation Pattern

## Komplettes Beispiel

\`\`\`typescript
import { normalizeUrl, createFetchOptions } from "../../utils";

async testConnection(
  config: PluginConfig,
): Promise<{ ok: boolean; message: string }> {
  try {
    const baseUrl = normalizeUrl(config.apiUrl);

    const res = await fetch(\\\`\\\${baseUrl}/System/Info/Public\\\`, {
      ...createFetchOptions(),
      headers: {
        "X-Emby-Token": String(config.apiKey || ""),
      },
    });

    if (!res.ok) {
      // Deutsche Fehlermeldung mit HTTP-Status
      return { ok: false, message: \\\`HTTP \\\${res.status}: Zugriff verweigert\\\` };
    }

    const info = await res.json();

    // Erfolg: Zeige Service-Name oder Version
    return {
      ok: true,
      message: \\\`Verbunden mit \\\${info.ServerName || "Service"} (v\\\${info.Version || "?"})\\\`,
    };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
\`\`\`

## Regeln

1. **try/catch** - Fehler abfangen und als \`{ ok: false, message }\` zurueckgeben
2. **AbortSignal.timeout(5000)** - 5 Sekunden Timeout
3. **Deutsche Fehlermeldungen:**
   - \`"HTTP {status}: Zugriff verweigert"\` bei 401/403
   - \`"HTTP {status}: Nicht gefunden"\` bei 404
   - \`"Verbindung fehlgeschlagen"\` bei Netzwerkfehler
4. **Erfolgs-Nachricht:** \`"Verbunden mit {ServiceName} (v{Version})"\`
   - Zeige Service-Name, Hostname oder Version wenn verfuegbar
   - Fallback: \`"Verbunden mit {PluginName}"\`
5. **Leichtgewichtiger Endpoint** - Waehle einen schnellen API-Endpunkt fuer den Test
   (z.B. /api/info, /system/status, nicht /api/all-data)

## Typische Erfolgs-Nachrichten

\`\`\`typescript
// Emby (Referenz-Plugin)
{ ok: true, message: "Verbunden mit MeinEmby (v4.8.0)" }

// Generische Beispiele
{ ok: true, message: "Verbunden mit mein-server" }
{ ok: true, message: "Verbunden mit ServiceName (v2.1.0)" }
\`\`\`

## Typische Fehler-Nachrichten

\`\`\`typescript
{ ok: false, message: "HTTP 401: Zugriff verweigert" }
{ ok: false, message: "HTTP 404: Nicht gefunden" }
{ ok: false, message: "HTTP 500: Serverfehler" }
{ ok: false, message: "fetch failed" }  // Netzwerkfehler
{ ok: false, message: "The operation was aborted due to timeout" }  // Timeout
\`\`\`
`,

  crawlEntitiesPattern: `
# crawlEntities Pattern (Optional)

## Wann implementieren?

- Plugin hat waehlbare Datenquellen (z.B. HA-Sensoren, Docker-Container, Proxmox-VMs)
- User soll im TileDialog auswaehlen koennen, welche Entities angezeigt werden

## Wann NICHT implementieren?

- Plugin hat feste Stats (z.B. Emby: Filme/Serien-Zaehler sind immer gleich)
- Keine sinnvolle Entity-Auswahl moeglich

## Interfaces

\`\`\`typescript
// Return-Format von crawlEntities
interface CrawlResult {
  groups: CrawlEntityGroup[];
}

interface CrawlEntityGroup {
  domain: string;     // Technischer Key (z.B. "sensor", "light")
  label: string;      // Anzeigename auf Deutsch (z.B. "Sensoren", "Lichter")
  icon: string;       // Lucide-Icon Name (z.B. "Activity", "Lightbulb") — PFLICHT
  entities: CrawlEntity[];
}

interface CrawlEntity {
  id: string;         // Eindeutige Entity-ID (z.B. "sensor.temperatur")
  name: string;       // Anzeigename (z.B. "Raumtemperatur")
  state: string;      // Aktueller Zustand (z.B. "22.5 °C", "An") — PFLICHT
}
\`\`\`

## selectedEntities-Format (Config)

Der Entity-Picker speichert die Auswahl als \`config.selectedEntities\`:

\`\`\`typescript
// Format in der Config (JSON-Array):
type SelectedEntity = { id: string; label: string };
// Beispiel:
// [{ "id": "sensor.temp", "label": "Raumtemperatur" },
//  { "id": "light.wohnzimmer", "label": "Wohnzimmer Licht" }]
\`\`\`

- \`label\` = Custom Anzeigename, den der User pro Tile setzen kann
- Labels sind **per-Tile**, nicht per-Connection (verschiedene Tiles koennen verschiedene Labels haben)
- Wenn der User keinen Custom-Label setzt, wird der \`name\` aus crawlEntities verwendet

## Entity-Limits pro Tile-Groesse

Das System nutzt die Konstante \`STAT_LIMITS = { "1x1": 3, "2x1": 6, "2x2": 6 }\`:

- **1x1:** Maximal 3 Entities
- **2x1:** Maximal 6 Entities
- **2x2:** Maximal 6 Entities

Der Entity-Picker zeigt dem User diese Limits an und verhindert Ueberauswahl.
Beim Groessenwechsel werden ueberzaehlige Entities automatisch getrimmt.

## Dashboard Entity-Picker Verhalten

Das Plugin hat **keinen Einfluss** auf folgendes UI-Verhalten:
- **Gruppen:** Werden als aufklappbare Sektionen dargestellt (collapsed by default)
- **Auto-Expand:** Domains mit bereits ausgewaehlten Entities werden beim Bearbeiten
  automatisch aufgeklappt
- **Checkboxen:** Jede Entity hat eine Checkbox zum An-/Abwaehlen
- **Suchfeld:** User kann Entities nach Name filtern
- **Custom Labels:** User kann pro Entity einen eigenen Anzeigenamen eingeben
- **Sortierung:** Innerhalb einer Gruppe alphabetisch nach Name

## Komplettes Beispiel (generisches Pattern fuer Entity-basierte Services)

\`\`\`typescript
async crawlEntities(config: PluginConfig) {
  const baseUrl = String(config.apiUrl || "").replace(/\\/$/, "");
  const headers: HeadersInit = {
    Authorization: \\\`Bearer \\\${String(config.accessToken || "")}\\\`,
    "Content-Type": "application/json",
  };

  // Laengerer Timeout fuer Crawler (10s statt 5s, da mehr Daten)
  const res = await fetch(\\\`\\\${baseUrl}/api/states\\\`, {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(\\\`HTTP \\\${res.status}\\\`);

  const states: HAState[] = await res.json();

  // Gruppieren nach Domain/Typ
  const domainMap = new Map<string, { id: string; name: string; state: string }[]>();
  for (const entity of states) {
    const domain = entity.entity_id.split(".")[0];
    if (!domainMap.has(domain)) domainMap.set(domain, []);
    domainMap.get(domain)!.push({
      id: entity.entity_id,
      name: entity.attributes?.friendly_name || entity.entity_id.split(".")[1],
      state: entity.state,
    });
  }

  // Gruppen mit deutschen Labels und Icons
  const DOMAIN_LABELS: Record<string, { label: string; icon: string }> = {
    sensor:        { label: "Sensoren",        icon: "Activity" },
    binary_sensor: { label: "Binaer-Sensoren", icon: "ToggleRight" },
    light:         { label: "Lichter",         icon: "Lightbulb" },
    switch:        { label: "Schalter",        icon: "Power" },
    climate:       { label: "Klima",           icon: "Thermometer" },
    automation:    { label: "Automationen",    icon: "Zap" },
  };

  const groups = Array.from(domainMap.entries())
    .map(([domain, entities]) => ({
      domain,
      label: DOMAIN_LABELS[domain]?.label || domain,
      icon: DOMAIN_LABELS[domain]?.icon || "Activity",
      entities: entities.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.entities.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  return { groups };
}
\`\`\`

## Flow: Test -> Crawl -> Pick -> Save

1. User gibt API-Credentials ein im TileDialog
2. "Verbindung testen" ruft \`testConnection()\` auf
3. Bei Erfolg: System ruft automatisch \`crawlEntities()\` auf
4. Entity-Picker UI zeigt gruppierte Entities zum Auswaehlen
5. User waehlt gewuenschte Entities
6. Auswahl wird als \`selectedEntities\` JSON in der Config gespeichert

## selectedEntities in fetchStats

Der Entity-Picker speichert die Auswahl als JSON-Array in \`config.selectedEntities\`.
Empfohlenes Parsing:

\`\`\`typescript
// Empfohlen: Direktes Casten (neues Format vom Entity-Picker)
const entities = (config.selectedEntities as Array<{ id: string; label: string }>) ?? [];

for (const entity of entities) {
  // entity.id    = "sensor.wohnzimmer_temperatur"
  // entity.label = "Wohnzimmer Temp" (Custom-Label vom User)
  const res = await fetch(\\\`\\\${baseUrl}/api/states/\\\${entity.id}\\\`, fetchOpts);
  if (!res.ok) continue;
  const data = await res.json();
  items.push({ label: entity.label, value: data.state ?? "unknown" });
}
\`\`\`

### Legacy-Fallback (optional)

Aeltere Tile-Konfigurationen koennten noch das alte \`entityIds\` Textarea-Format verwenden.
Falls Abwaertskompatibilitaet noetig ist:

\`\`\`typescript
let entityEntries: { id: string; customLabel?: string }[] = [];
if (config.selectedEntities) {
  try {
    const parsed = JSON.parse(String(config.selectedEntities));
    if (Array.isArray(parsed)) {
      entityEntries = parsed.map((e: { id: string; label?: string }) => ({
        id: e.id,
        customLabel: e.label,
      }));
    }
  } catch { /* fall through to legacy */ }
}
if (entityEntries.length === 0 && config.entityIds) {
  entityEntries = String(config.entityIds)
    .split(/[\\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const colonIdx = entry.indexOf(":");
      if (colonIdx > 0) {
        return {
          id: entry.substring(0, colonIdx).trim(),
          customLabel: entry.substring(colonIdx + 1).trim() || undefined,
        };
      }
      return { id: entry };
    });
}
\`\`\`

## WICHTIG: Keine Entity-Textarea wenn crawlEntities existiert

Wenn ein Plugin \`crawlEntities\` implementiert, darf es **KEIN** Textarea-ConfigField
fuer Entity-IDs haben (z.B. \`entityIds\`). Der Entity-Picker des Dashboards
erscheint automatisch nach dem Verbindungstest und uebernimmt die Entity-Auswahl.

Ein Textarea-Feld wuerde **NEBEN** dem Entity-Picker angezeigt und verwirrt den User.

\`configFields\` sollten NUR Connection-Felder enthalten:
- \`apiUrl\` (url, required)
- \`apiKey\` / \`accessToken\` (password, required)

Die Entity-Auswahl wird automatisch als \`config.selectedEntities\` gespeichert.
Das Dual-Format-Parsing im fetchStats (siehe oben) bleibt als Legacy-Fallback.

## Regeln

1. **AbortSignal.timeout(10000)** - 10s Timeout (mehr Daten als normaler Fetch)
2. **Gruppieren nach Domain/Typ** - Sortierte Gruppen mit deutschen Labels
3. **Lucide-Icons fuer Gruppen** - Passende Icons pro Domain waehlen
4. **crawlEntities darf Exceptions werfen** - (anders als fetchStats!) System fängt ab
5. **Entity-Namen alphabetisch sortieren** innerhalb jeder Gruppe
6. **Keine Entity-Textarea in configFields** - Entity-Picker uebernimmt (siehe oben)
`,

  widgetPattern: `
# Widget-Komponente Pattern

## Dateistruktur

\`\`\`
src/components/widgets/
  registry.ts                    # Zentrale Widget-Registry
  shared/
    WidgetHeader.tsx              # Gemeinsamer Widget-Header (40px, border-bottom)
    CircularProgress.tsx          # Kreisfoermiger Fortschritt
    SparklineChart.tsx            # Mini-Liniendiagramm
    HorizontalProgressBar.tsx     # Horizontaler Balken
    ControlButton.tsx             # Steuerungs-Button
  {plugin-id}/
    {Name}Widget.tsx              # Widget-Komponente
\`\`\`

## WidgetProps Interface

\`\`\`typescript
interface WidgetProps {
  stats: EnhancedStats;                    // Aktuelle Stats (loading/error/ok)
  config: Record<string, unknown>;         // Geparste Tile-Konfiguration
  tileId: number;                          // ID des Tiles in der DB
  size: "2x1" | "2x2";                    // Aktuelle Groesse des Tiles
  onAction?: (action: string, payload?: unknown) => void;  // Optionale Widget-Actions
}

// EnhancedStats = PluginStats + "loading" Status
interface EnhancedStats {
  items: StatItem[];
  status: "ok" | "error" | "loading";
  error?: string;
  widgetData?: Record<string, unknown>;    // Reichhaltige Daten vom Plugin (Cover-Bilder, Listen, etc.)
}
\`\`\`

## Komplettes Widget-Grundgeruest

\`\`\`typescript
"use client";

import { cn } from "@/lib/utils";
import type { WidgetProps } from "../registry";
import { WidgetHeader } from "../shared/WidgetHeader";
import { Loader2, AlertCircle } from "lucide-react";

// ── Loading State ──────────────────────────────────────────────
function WidgetLoading() {
  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon="LucideIconName"     // Passendes Lucide-Icon
        iconColor="#hexcolor"     // metadata.color des Plugins
        title="Plugin-Name"
        status="unknown"
      />
      <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Laden...</span>
      </div>
    </div>
  );
}

// ── Error State ────────────────────────────────────────────────
function WidgetError({ error }: { error?: string }) {
  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon="LucideIconName"
        iconColor="#hexcolor"
        title="Plugin-Name"
        status="offline"
      />
      <div className="flex-1 flex items-center justify-center gap-2 text-destructive">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">{error || "Verbindungsfehler"}</span>
      </div>
    </div>
  );
}

// ── 2x1 Variant ───────────────────────────────────────────────
function MeinPlugin2x1({ stats }: WidgetProps) {
  const items = stats.items.slice(0, 6);

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon="LucideIconName"
        iconColor="#hexcolor"
        title="Plugin-Name"
        status={stats.status === "ok" ? "online" : "offline"}
      />
      <div className="flex-1 p-2 min-h-0">
        {/* 2x1 Content: ~112px verfuegbar */}
        {/* z.B. kompakte Cards, Progress-Bars, Inline-Stats */}
      </div>
    </div>
  );
}

// ── 2x2 Variant ───────────────────────────────────────────────
function MeinPlugin2x2({ stats }: WidgetProps) {
  const items = stats.items.slice(0, 6);

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon="LucideIconName"
        iconColor="#hexcolor"
        title="Plugin-Name"
        subtitle="Optionaler Untertitel"
        status={stats.status === "ok" ? "online" : "offline"}
      />
      <div className="flex-1 p-3 min-h-0">
        {/* 2x2 Content: ~290px verfuegbar */}
        {/* z.B. Grid mit Entity-Cards, Charts, Listen */}
      </div>
    </div>
  );
}

// ── Main Export (dispatches by state and size) ─────────────────
export function MeinPluginWidget(props: WidgetProps) {
  // PFLICHT: 3 States handlen
  if (props.stats.status === "loading") return <WidgetLoading />;
  if (props.stats.status === "error") return <WidgetError error={props.stats.error} />;

  // Dispatch by size
  if (props.size === "2x2") return <MeinPlugin2x2 {...props} />;
  return <MeinPlugin2x1 {...props} />;
}
\`\`\`

## WidgetHeader Props

\`\`\`typescript
interface WidgetHeaderProps {
  icon?: string;          // Lucide-Icon-Name (z.B. "House", "HardDrive")
  iconColor?: string;     // Hex-Farbe fuer das Icon
  title: string;          // Widget-Titel
  subtitle?: string;      // Optionaler Untertitel (rechts neben Titel)
  status?: "online" | "offline" | "unknown";  // Status-Punkt (links)
  children?: ReactNode;   // Rechte Seite (z.B. Action-Buttons)
}
\`\`\`

## Widget-Registrierung

### Fuer Community Plugins (empfohlen):

In \`src/plugins/community/index.ts\` hinzufuegen:

\`\`\`typescript
export { MeinPluginWidget } from "./meinservice/MeinPluginWidget";

export const communityWidgets: Record<string, ComponentType<unknown>> = {
  "MeinPluginWidget": MeinPluginWidget,
};
\`\`\`

Die Widget-Registry importiert \`communityWidgets\` automatisch und registriert alle Eintraege.

### Fuer Builtin Plugins:

In \`src/components/widgets/registry.ts\` hinzufuegen:

\`\`\`typescript
import { MeinPluginWidget } from "./{plugin-id}/MeinPluginWidget";
registerWidget("MeinPluginWidget", MeinPluginWidget);
\`\`\`

Der Name muss EXAKT mit \`renderHints[size].widgetComponent\` uebereinstimmen.

## Widget-Regeln

1. **\`"use client"\` ist Pflicht** - Widgets sind Client-Komponenten
2. **Alle 3 Zustaende behandeln:** loading -> Spinner, error -> Fehlermeldung, ok -> Inhalt
3. **Daten ueber stats Prop** - Keine eigenen Daten-Calls (Actions direkt zum Service sind OK)
4. **Groessen-Varianten via size Prop** - 2x1 (kompakt) vs 2x2 (voll)
5. **WidgetHeader fuer einheitliches Aussehen** verwenden
6. **Widget-Name muss mit renderHints.widgetComponent uebereinstimmen**
7. **Shared Components nutzen:** CircularProgress, SparklineChart, HorizontalProgressBar, ControlButton
8. **Texte auf Deutsch** - "Laden...", "Verbindungsfehler", "Keine Daten"
9. **widgetData nutzen** - Reichhaltige Daten (Listen, Bilder) aus \`stats.widgetData\` lesen, mit Type-Assertion und Fallback-Werten
10. **CSS-Transitions bevorzugen** - Fuer Karussells und Uebergaenge CSS opacity/transform verwenden statt JS-Animationen (pre-rendered slides mit opacity transitions)
`,

  registrationPattern: `
# Registrierungs-Pattern: Wie ein neues Community Plugin registriert wird

## KEINE Core-Dateien bearbeiten — vollstaendig automatisch!

\`src/plugins/community/index.ts\` ist **AUTO-GENERATED** durch
\`scripts/generate-community-plugins.ts\` (bzw. \`npm run generate:plugins\`).
Diese Datei NICHT manuell editieren — Aenderungen werden ueberschrieben.

### Installation per ZIP-Upload (empfohlen)

1. Plugin als ZIP erstellen (via \`create_plugin_zip\` Tool)
2. Dashboard: **Einstellungen > Plugins > Upload**
3. Dashboard validiert, extrahiert und registriert automatisch
4. Server neustarten — fertig

### Installation per manuelles Ablegen

1. Plugin-Ordner nach \`src/plugins/community/{plugin-id}/\` kopieren
2. \`npm run generate:plugins\` ausfuehren (oder Server neustarten)
3. Auto-Discovery erkennt das Plugin und generiert die Barrel-Datei neu

### Das war's! Keine weiteren Core-Dateien noetig.

- **Kein \`registry.ts\` bearbeiten** — Community Plugins werden automatisch importiert
- **Kein \`icons.ts\` bearbeiten** — Icons werden automatisch aus metadata.icon aufgeloest
- **Kein \`widgets/registry.ts\` bearbeiten** — Community Widgets werden automatisch registriert
- **Kein \`community/index.ts\` bearbeiten** — wird automatisch generiert

## Validierung beim Start

Nach der Registrierung prueft \`validatePlugin()\` automatisch:
- metadata.id ist nicht-leerer String
- metadata.name ist nicht-leerer String
- metadata.color ist gueltiges Hex (#XXXXXX)
- configFields ist ein Array
- supportedSizes ist nicht-leeres Array mit gueltigen Groessen
- fetchStats ist eine Funktion
- testConnection ist eine Funktion

Bei Fehler: Plugin wird NICHT registriert, Fehler wird geloggt (logger.error).
Doppelte IDs werden erkannt und uebersprungen (logger.warn).
`,

  tileDialogUx: `
# TileDialog UX: Connection-Fields vs Feature-Fields

## Konzept

Im TileDialog werden die \`configFields\` eines Plugins in zwei Gruppen aufgeteilt:

1. **Connection Fields** - Immer sichtbar (apiUrl, apiKey, accessToken, username, password + alle required-Felder)
2. **Feature Fields** - Erst sichtbar NACH erfolgreichem Verbindungstest (nicht-required, nicht-Connection)

## Aufteilungs-Logik

\`\`\`typescript
const CONNECTION_KEYS = new Set(["apiUrl", "apiKey", "accessToken", "username", "password"]);

const connectionFields = plugin.configFields.filter(
  (f) => CONNECTION_KEYS.has(f.key) || f.required || f.type === "oauth"
);

const featureFields = plugin.configFields.filter(
  (f) => !CONNECTION_KEYS.has(f.key) && !f.required && f.type !== "oauth"
);
\`\`\`

## Flow

1. User gibt Titel ein -> Plugin wird erkannt -> Connection-Fields erscheinen
2. User fuellt apiUrl + apiKey aus
3. User klickt "Verbindung testen"
4. Bei Erfolg: Feature-Fields erscheinen (z.B. mediaCategory, carouselSpeed)
5. Stat-Optionen und Groessen-Auswahl erscheinen ebenfalls erst nach dem Test

## Auswirkung auf Plugin-Design

Plugin-Entwickler muessen darauf achten:
- **Connection-relevante Felder:** \`key\` sollte \`apiUrl\`, \`apiKey\`, \`accessToken\`, \`username\`, oder \`password\` sein,
  ODER \`required: true\` setzen
- **Feature-Felder:** Alle anderen (mediaCategory, carouselSpeed, etc.) mit \`required: false\`
  (oder required weglassen, da default false)
- Feature-Felder werden NUR angezeigt wenn die Verbindung bereits getestet wurde

## showForSizes (groessenabhaengige Sichtbarkeit)

ConfigFields und StatOptions koennen \`showForSizes\` definieren, um sie nur fuer
bestimmte Tile-Groessen im TileDialog anzuzeigen. Das ersetzt hardcodierte Key-Listen:

\`\`\`typescript
// Feature-Fields werden nach showForSizes gefiltert (falls definiert):
const featureFields = plugin.configFields
  .filter((f) => !CONNECTION_KEYS.has(f.key) && !f.required && f.type !== "oauth")
  .filter((f) => !f.showForSizes || f.showForSizes.includes(currentSize));
\`\`\`

**Bedeutung fuer Plugin-Entwickler:**
- \`showForSizes\` nicht gesetzt → Feld erscheint fuer **alle** Groessen (Standard, abwaertskompatibel)
- \`showForSizes: ["2x1", "2x2"]\` → Feld nur fuer 2x1 und 2x2 sichtbar (z.B. carouselSpeed)
- \`showForSizes: ["2x2"]\` → Feld nur fuer 2x2 sichtbar
- Beim Groessenwechsel werden nicht-verfuegbare Felder automatisch ausgeblendet
- **Gilt auch fuer StatOptions:** Stats mit \`showForSizes\` erscheinen nur bei passender Groesse

## Bearbeiten einer bestehenden Tile (Edit Mode)

Wenn der User eine bestehende Tile bearbeitet, die bereits eine AppConnection hat:
- **Connection-Fields werden NICHT angezeigt** (apiUrl, apiKey, etc.)
- Stattdessen erscheint ein **"Verbunden" Badge** mit Hinweis auf
  **Einstellungen > Apps verwalten** fuer Verbindungsaenderungen
- Nur **Feature-Fields**, **Stat-Auswahl** und **Entity-Picker** werden angezeigt
- Das Plugin muss nichts aendern — der Edit-Mode wird vom TileDialog automatisch gehandhabt

## Size-spezifische Hints

Im TileDialog werden unter der Groessen-Auswahl Hints angezeigt:

\`\`\`typescript
const SIZE_HINTS = {
  "1x1": "Info-Panel -- Zeigt bis zu 3 Statistiken",
  "2x1": "Mini Widget -- Kompakte Medienvorschau",
  "2x2": "Widget -- Vollstaendige Medienansicht mit Karussell",
};
\`\`\`

Die Hints helfen dem Benutzer die richtige Groesse zu waehlen.
`,

  colorConventions: `
# Farb-Konventionen fuer Stats

## Uebersicht

| Farbe      | CSS-Klasse       | Verwendung                                     |
|------------|------------------|------------------------------------------------|
| \`"green"\`  | text-emerald-400 | Positiv, aktiv, online, niedrige Auslastung    |
| \`"red"\`    | text-red-400     | Negativ, kritisch, offline, hohe Auslastung    |
| \`"yellow"\` | text-yellow-400  | Warnung, mittlere Auslastung                  |
| \`undefined\`| text-foreground  | Standard, neutral, Zaehler, Groessen           |

## Regeln

- **Farbe ist OPTIONAL** - Im Zweifel weglassen (undefined)
- **Max 2 farbige Stats pro Plugin** - Sonst wird es visuell unuebersichtlich
- **Konsistenz:** Gleiche Bedeutung = gleiche Farbe ueberall
- **Prozent-Schwellenwerte:** > 85% rot, 70-85% gelb, < 70% gruen (oder undefined)

## Beispiele

\`\`\`typescript
// Speicher-Auslastung mit Schwellenwerten
{ label: "Belegt", value: "72%", color: usedPercent > 85 ? "red" : usedPercent > 70 ? "yellow" : "green" }

// Online/Offline Status
{ label: "Status", value: "Online", color: "green" }
{ label: "Status", value: "Offline", color: "red" }

// Aktive Streams (gruen wenn > 0)
{ label: "Streams", value: 3, color: activeStreams > 0 ? "green" : undefined }

// Temperatur (keine spezielle Farbe — Standard-Textfarbe)
{ label: "CPU Temp", value: 45, unit: "°C" }

// Neutrale Zaehler (keine Farbe)
{ label: "Filme", value: 1234 }
{ label: "Uptime", value: "3d 12h" }
\`\`\`

## Widget-Farben (in Widget-Komponenten)

Widgets koennen dieselben Farben ueber Hilfsfunktionen anwenden:

\`\`\`typescript
function getStatColor(color?: string): string {
  if (color === "green") return "text-emerald-400";
  if (color === "red") return "text-red-400";
  if (color === "yellow") return "text-yellow-400";
  return "text-foreground";
}

function getStatBgColor(color?: string): string {
  if (color === "green") return "bg-emerald-500/10";
  if (color === "red") return "bg-red-500/10";
  if (color === "yellow") return "bg-yellow-500/10";
  return "bg-muted/20";
}
\`\`\`
`,

  antiPatterns: `
# Anti-Patterns (NICHT machen!)

## 1. Widget das nur Stats groesser zeigt

\`\`\`typescript
// FALSCH: Widget zeigt nur Stats in groesserer Schrift
function MeinWidget2x2({ stats }: WidgetProps) {
  return (
    <div className="grid grid-cols-2 gap-4 p-6">
      {stats.items.map((item, i) => (
        <div key={i} className="text-2xl font-bold">{item.value}</div>  // Nur groesser!
      ))}
    </div>
  );
}
\`\`\`

**Richtig:** Kein Widget erstellen. Stattdessen \`layout: "detailed"\` in renderHints verwenden.
Widgets muessen visuellen Mehrwert bieten (Charts, Listen, Progress-Bars, Entity-Cards).

## 2. Widget mit eigenen DATEN-API-Calls

\`\`\`typescript
// FALSCH: Widget holt DATEN ueber eigene API
function MeinWidget({ stats }: WidgetProps) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("/api/my-custom-endpoint").then(r => r.json()).then(setData);  // VERBOTEN!
  }, []);
}
\`\`\`

**Richtig fuer Daten:** Alle Daten kommen ueber \`stats\` Prop. Der Polling-Loop
des Systems liefert die Daten via \`fetchStats()\`. Spezielle Daten (Cover-Bilder,
Listen) kommen als \`widgetData\`.

**AUSNAHME fuer Actions:** Interaktive Controls (Play/Pause, Like, Toggle) duerfen
direkt vom Widget die **externe** API aufrufen (NICHT das Dashboard!).
Der Token kommt dabei ueber \`stats.widgetData.accessToken\`.
Siehe: Widget-Actions Pattern fuer Details.

## 3. Widget ohne loading/error States

\`\`\`typescript
// FALSCH: Nur ok-State behandelt
export function MeinWidget(props: WidgetProps) {
  return <div>{props.stats.items.map(...)}</div>;  // Crash bei loading/error!
}
\`\`\`

**Richtig:** Immer 3 States handlen:
\`\`\`typescript
export function MeinWidget(props: WidgetProps) {
  if (props.stats.status === "loading") return <WidgetLoading />;
  if (props.stats.status === "error") return <WidgetError error={props.stats.error} />;
  // ... ok-State
}
\`\`\`

## 4. fetchStats das Exceptions wirft

\`\`\`typescript
// FALSCH: Kein try/catch - Exception bricht den Polling-Loop
async fetchStats(config) {
  const res = await fetch(url);  // Kann werfen! (Netzwerk, Timeout)
  const data = await res.json(); // Kann werfen! (kein JSON)
  return { items: [...], status: "ok" };
}
\`\`\`

**Richtig:** Immer try/catch mit error-Rueckgabe:
\`\`\`typescript
async fetchStats(config) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(\\\`HTTP \\\${res.status}\\\`);
    // ...
    return { items: [...], status: "ok" };
  } catch (err) {
    return { items: [], status: "error", error: (err as Error).message };
  }
}
\`\`\`

## 5. fetch ohne AbortSignal.timeout(5000)

\`\`\`typescript
// FALSCH: Kein Timeout - kann alles blockieren
await fetch(url);
await fetch(url, { headers });

// RICHTIG: Immer 5s Timeout
await fetch(url, { signal: AbortSignal.timeout(5000) });
await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
\`\`\`

## 6. Stats Labels auf Englisch

\`\`\`typescript
// FALSCH: Englische Labels
items.push({ label: "Used", value: "72%" });
items.push({ label: "Free Space", value: "1.2 TB" });
items.push({ label: "Error", value: "Connection failed" });

// RICHTIG: Deutsche Labels
items.push({ label: "Belegt", value: "72%" });
items.push({ label: "Frei", value: "1,2 TB" });
// Error-Messages:
return { items: [], status: "error", error: "Verbindung fehlgeschlagen" };
\`\`\`

## 7. Plugin das von anderen Plugins abhaengt

\`\`\`typescript
// FALSCH: Import aus einem anderen Plugin
import { formatBytes } from "../anderes-plugin";

// RICHTIG: Shared Utilities importieren
import { formatBytes, formatUptime } from "../../utils";
\`\`\`

Jedes Plugin ist vollstaendig eigenstaendig. Keine Imports aus anderen Plugins.
Gemeinsame Funktionen kommen aus \`src/plugins/utils.ts\`.

## 8. Canvas-Animationen in 1x1 Tiles

\`\`\`typescript
// FALSCH: Canvas in 1x1 Tile
renderHints: {
  "1x1": { maxStats: 1, layout: "widget", widgetComponent: "MeinCanvasWidget" },
}
\`\`\`

1x1 Tiles haben kein Widget-Support. Nur Text und Zahlen via StatsDisplay.
Canvas/SVG ist nur in 2x2 Widgets erlaubt (und auch dort einfach halten).

## 9. Poll-Intervall unter 30 Sekunden

Das Poll-Intervall wird vom System gesteuert (30s). Der Entwickler hat keinen
Einfluss darauf. Es gibt keinen Mechanismus um kuerzere Intervalle zu setzen.
Kuerzere Intervalle wuerden die Ziel-Services ueberlasten.

## 10. Mehr als 6 Stats zurueckgeben

\`\`\`typescript
// TECHNISCH erlaubt, aber der Validator schneidet still bei 6 ab.
// Die Stats 7+ werden einfach verworfen ohne Warnung.
return { items: [stat1, stat2, stat3, stat4, stat5, stat6, stat7], status: "ok" };
// stat7 wird NIE angezeigt!
\`\`\`

Maximal 6 Stats in der items-Liste. Reihenfolge = Prioritaet (wichtigste zuerst).

## 11. Eigene API-Routes erstellen

\`\`\`
FALSCH: Plugin mit eigenen API-Routes
spotify/
  api/
    auth/route.ts        <- VERBOTEN!
    callback/route.ts    <- VERBOTEN!
    status/route.ts      <- VERBOTEN!
    action/route.ts      <- VERBOTEN!
  plugin/
    index.ts

RICHTIG: Alles in einem Ordner, keine API-Routes
spotify/
  plugin.manifest.json   <- Manifest
  index.ts               <- Plugin-Definition mit fetchStats + testConnection + exchangeToken + refreshToken
  SpotifyWidget.tsx       <- Optional: Widget-Komponente
\`\`\`

Plugins erstellen KEINE eigenen \`/api/\` Routes. Das Enhanced App System hat
diese System-Endpunkte:
- \`GET /api/enhanced/[appId]\` - ruft \`fetchStats()\` auf (inkl. auto Token-Refresh)
- \`POST /api/enhanced/test\` - ruft \`testConnection()\` auf
- \`POST /api/enhanced/crawl\` - ruft \`crawlEntities()\` auf
- \`GET /api/enhanced/oauth/callback\` - OAuth Callback (ruft \`exchangeToken()\` auf)

**OAuth ist erlaubt** — aber ueber das Framework, NICHT ueber eigene Routes.
Das Plugin deklariert \`type: "oauth"\` im configField und implementiert
\`exchangeToken()\` + \`refreshToken()\`. Das Framework handhabt den Rest
(Redirect, Callback, Token-Speicherung, automatischer Refresh).

## 12. Dateien ausserhalb des Plugin-Ordners erstellen

\`\`\`
FALSCH: Dateien ueber das Projekt verstreut
src/plugins/community/mein-plugin/index.ts
src/components/widgets/mein-plugin/Widget.tsx    <- VERBOTEN! (alter Pfad)
src/app/api/mein-plugin/route.ts                 <- VERBOTEN!
.env.example                                     <- VERBOTEN!

RICHTIG: Alles in EINEM Ordner
src/plugins/community/mein-plugin/
  index.ts
  MeinPluginWidget.tsx    <- Widget im GLEICHEN Ordner
\`\`\`

Ein Community Plugin darf NUR Dateien in seinem eigenen Ordner haben.
Keine Aenderungen an Core-Dateien, keine neuen API-Routes, keine .env Dateien.

## 13. Direkt ins Dashboard-Projekt schreiben

Der Agent erstellt Plugin-Dateien in einem **separaten Arbeitsordner**, NICHT
direkt im Dashboard-Repository. Am Ende wird der fertige Ordner als ZIP
geliefert. Der Benutzer legt ihn dann selbst in \`src/plugins/community/\` ab.
`,

  widgetActionsPattern: `
# Widget-Actions: Direkte API-Calls vom Browser

## Wann braucht man Widget-Actions?

Wenn das Widget interaktive Controls hat:
- Media Player: Play, Pause, Skip, Volume, Like
- Smart Home: Licht an/aus, Temperatur setzen
- Download Manager: Start, Stop, Prioritaet aendern
- Container Manager: Start, Stop, Restart

## Architektur: Die App macht es selbst

Das Dashboard ist NICHT beteiligt bei Widget-Aktionen. Das Widget ruft die
externe API **direkt vom Browser** auf. Kein Umweg, kein Framework-Endpoint.

\`\`\`
Widget (Browser)  --->  Externe API (z.B. Spotify)
                        DIREKT, ohne Dashboard
\`\`\`

## Token-Weitergabe ueber widgetData

Das Plugin gibt den Token bewusst ueber \`widgetData\` an das Widget weiter:

\`\`\`typescript
// In fetchStats (serverseitig):
async fetchStats(config: PluginConfig): Promise<PluginStats> {
  const token = String(config.accessToken || "");

  // ... stats holen ...

  return {
    items,
    status: "ok",
    widgetData: {
      accessToken: token,           // Token fuer Widget-Actions
      deviceId: currentDevice?.id,  // Weitere Daten die das Widget braucht
      isPlaying: playback?.is_playing,
      // ... mehr Widget-Daten
    },
  };
}
\`\`\`

## Widget-seitige Actions

\`\`\`typescript
// Im Widget (client-seitig):
"use client";

export function MeinWidget({ stats, config }: WidgetProps) {
  const data = stats.widgetData as {
    accessToken?: string;
    deviceId?: string;
    isPlaying?: boolean;
  } | undefined;

  const token = data?.accessToken;

  const handlePlayPause = async () => {
    if (!token) return;
    const endpoint = data?.isPlaying ? "pause" : "play";
    await fetch(\\\`https://api.service.com/v1/me/player/\\\${endpoint}\\\`, {
      method: "PUT",
      headers: { Authorization: \\\`Bearer \\\${token}\\\` },
    });
  };

  const handleSkip = async () => {
    if (!token) return;
    await fetch("https://api.service.com/v1/me/player/next", {
      method: "POST",
      headers: { Authorization: \\\`Bearer \\\${token}\\\` },
    });
  };

  return (
    <div>
      <button onClick={handlePlayPause}>
        {data?.isPlaying ? "Pause" : "Play"}
      </button>
      <button onClick={handleSkip}>Skip</button>
    </div>
  );
}
\`\`\`

## Regeln

1. **Token ueber widgetData:** Das Plugin entscheidet bewusst was es dem Widget gibt.
   Nur Service-spezifische Tokens, keine Dashboard-internen Secrets.
2. **Fehler abfangen:** Widget-Actions muessen Fehler graceful handlen (try/catch,
   visuelles Feedback, kein Crash).
3. **Kein Dashboard-Endpoint:** Es gibt KEINE \`/api/enhanced/action\` Route.
   Das Widget kommuniziert direkt mit dem externen Service.
4. **CORS beachten:** Client-seitige Calls koennten CORS-Probleme haben.
   Die meisten OAuth-APIs (Spotify, GitHub) erlauben Browser-Calls mit Bearer Token.
   Falls CORS blockiert: Action ueber \`onAction\` Callback an das Dashboard
   signalisieren und dort serverseitig ausfuehren (Fallback-Pattern).
5. **onAction ist NICHT fuer API-Calls:** \`onAction\` ist nur fuer Widget->Dashboard
   Signale (z.B. "bitte Stats neu laden"). Die eigentliche Service-Kommunikation
   macht die App direkt.

## onAction Fallback (fuer CORS-Probleme)

Falls die externe API keine Browser-Calls erlaubt:

\`\`\`typescript
// Widget signalisiert dem Dashboard eine Aktion
onAction?.("refresh");  // Dashboard laedt Stats neu
\`\`\`

Das ist ein Signal, kein API-Call. Das Dashboard ruft dann \`fetchStats()\` erneut auf.
`,

  notificationPattern: `
# Notification-Support (Optional)

## Konzept (v1.3.0-beta)

Das Dashboard hat ein Notification Panel (rechte Seite). Plugins koennen
Notifications ausloesen, **aber nur** wenn der User die Notification-Quelle
vorher explizit ueber den TileDialog-Toggle erstellt hat und die jeweilige
Rule aktiviert ist.

**Drei-Schichten-Kontrakt:**
1. **Plugin deklariert:** \`supportsNotifications: true\` + \`notificationRules: PluginNotificationRule[]\`
   (Katalog aller Rules mit id, label, description, severity, defaultEnabled).
2. **User aktiviert:** TileDialog "Benachrichtigungen aktivieren"-Toggle beim
   Erstellen einer neuen AppConnection → ruft \`enableAppNotifications(connectionId)\`.
   Settings-Seite zeigt pro Source einen Rule-Picker → ruft \`updateNotificationRules(sourceId, enabledRules)\`.
3. **Framework filtert:** \`runNotificationCheck\` verwirft alle Notifications
   deren \`tag\` nicht in \`source.ruleConfig.enabledRules\` steht — STILL und ohne Fehler.

**Wichtig:** NotificationSources werden **nicht mehr auto-provisioniert**. Ohne
expliziten User-Opt-in laeuft \`checkNotifications\` zwar, aber das Framework
findet keine passende Source und dropped ALLES.

Es gibt zwei Trigger-Arten:
1. **Plugin-originated (empfohlen):** Plugin implementiert \`checkNotifications()\` —
   erkennt Zustandsaenderungen automatisch beim Polling. Braucht \`notificationRules\`.
2. **Webhook:** Externer Service pushed Notifications via HTTP POST \`/api/notifications\`.
   Geht direkt in die DB, ohne Rule-Filter.

## 12.1 Plugin-Originated Notifications (checkNotifications) — EMPFOHLEN

Das Dashboard ruft \`checkNotifications()\` nach jedem \`fetchStats\` Poll auf
und uebergibt das aktuelle und vorherige \`widgetData\` zum Vergleich. Jede
zurueckgegebene Notification muss ein \`tag\` haben, das einer Rule-ID aus
\`notificationRules\` entspricht — sonst wird sie silent verworfen.

\`\`\`typescript
export const plugin: AppPlugin = {
  metadata: { ... },
  supportsNotifications: true,

  // Katalog aller Rules die das Plugin anbietet. Die UI zeigt diese Rules im
  // Settings-Picker. Der tag der emittierten Notifications MUSS mit einer id hier matchen.
  notificationRules: [
    {
      id: "array_stopped",
      label: "Array gestoppt",
      description: "Feuert wenn das Unraid Array unerwartet gestoppt wird.",
      severity: "critical",
      defaultEnabled: true,
    },
    {
      id: "disk_full",
      label: "Disk voll",
      description: "Feuert wenn eine Disk > 95% belegt ist.",
      severity: "warning",
      defaultEnabled: true,
    },
    {
      id: "container_stopped",
      label: "Container gestoppt",
      description: "Feuert wenn ein ueberwachter Container stoppt.",
      severity: "info",
      defaultEnabled: false,
    },
  ],

  async checkNotifications(config, currentData, previousData) {
    const notifications: PluginNotification[] = [];

    // previousData ist null beim ersten Poll (oder nach Server-Restart)!
    if (!previousData) return notifications;

    // Beispiel: Zustandsaenderung erkennen. tag MUSS mit einer Rule-ID oben matchen.
    const prevStatus = previousData.arrayStatus as string;
    const currStatus = currentData.arrayStatus as string;
    if (prevStatus === "Started" && currStatus === "Stopped") {
      notifications.push({
        dedupKey: "array-stopped",
        title: "Array gestoppt",
        message: "Das Unraid Array wurde gestoppt.",
        category: "critical",
        tag: "array_stopped",  // ← MUSS notificationRules[].id matchen!
      });
    }

    return notifications;
  },

  async fetchStats(config) {
    // ... WICHTIG: widgetData muss die Daten enthalten,
    // die checkNotifications fuer Vergleiche braucht!
    return {
      items,
      status: "ok",
      widgetData: {
        arrayStatus: data.arrayStatus,  // ← fuer Notification-Vergleiche
        containers: data.containers,
        // ...
      },
    };
  },
};
\`\`\`

### Wie es funktioniert (End-to-End)

1. **User erstellt AppConnection** ueber TileDialog. Wenn das Plugin
   \`supportsNotifications: true\` UND mindestens eine \`notificationRules\`-Entry hat
   UND es fuer diese Connection noch keine NotificationSource gibt, erscheint
   ein "Benachrichtigungen aktivieren"-Toggle unter dem Enhanced-Toggle.
2. **User klickt Toggle + Save.** Handler ruft \`enableAppNotifications(newConn.id)\`
   (Server Action in \`src/lib/actions/notifications.ts\`). Diese Action legt
   einen \`NotificationSource\` an mit \`sourceId = "plugin-{pluginType}-{connId}"\`,
   \`type: "plugin"\` und \`ruleConfig = { enabledRules: [alle Rules mit defaultEnabled: true] }\`.
3. **Dashboard pollt \`fetchStats\`** → erhaelt \`{ items, status, widgetData }\`.
4. **Plugin-checker ruft \`checkNotifications\`** mit currentData + previousData.
   Plugin gibt \`PluginNotification[]\` zurueck.
5. **Framework filtert:** \`runNotificationCheck\` liest \`source.ruleConfig.enabledRules\`
   und verwirft alle Notifications deren \`tag\` nicht im Set steht. Notifications
   ohne \`tag\` werden ebenfalls verworfen.
6. **Dedup + SSE-Broadcast** fuer die uebrig gebliebenen Notifications.
7. **User kann Rules nachtraeglich andern** auf \`/settings/notifications\` — der
   expandable Rule-Picker pro Source triggert \`updateNotificationRules(sourceId, enabledRules)\`.

### dedupKey-Strategie

Der \`dedupKey\` ist pro Plugin-NotificationSource eindeutig. Eine Notification mit
dem gleichen \`dedupKey\` wird innerhalb von \`dedupMinutes\` (default: 60) nicht
erneut ausgeloest, es sei denn der User hat die vorherige bestaetigt.

**Strategie-Tipps:**
- **State-based:** \`"array-stopped"\` — Feuert einmal pro Zustand
- **Instance-based:** \`"container-stopped-\${containerId}"\` — Pro Item Dedup
- **Threshold-based:** \`"disk-temp-\${diskName}"\` — Pro Disk pro Zeitfenster

### Wichtige Regeln

- **\`previousData\` ist null** beim ersten Poll nach Server-Start. Immer mit
  \`if (!previousData) return []\` behandeln — niemals beim ersten Poll feuern!
- **\`tag\` ist PFLICHT** fuer plugin-originated Notifications — ohne oder mit
  unbekanntem tag wird silent gedropped. Der tag MUSS exakt einer Rule-ID
  aus \`notificationRules\` entsprechen (case-sensitive).
- **Rules-Katalog stabil halten:** Eine Rule-ID umzubenennen bricht bestehende
  User-Konfigurationen (ruleConfig in der DB referenziert die alte ID). Neue
  Rules hinzufuegen ist OK, Rules umbenennen ist breaking.
- **Fire-and-forget:** checkNotifications laeuft async, Fehler blockieren NICHT den Stats-Return
- **Throttled:** Max 1x pro 30 Sekunden pro Tile (auch bei mehreren Browser-Tabs)
- **widgetData designen fuer Vergleiche:** Die Daten die checkNotifications braucht,
  MUESSEN in \`widgetData\` von \`fetchStats\` enthalten sein
- **Ohne NotificationSource = nichts passiert:** Wenn der User den TileDialog-Toggle
  nicht aktiviert hat, laeuft checkNotifications ins Leere — der plugin-checker
  findet keine Source und verwirft alle Rueckgaben.

## 12.2 Webhook Notifications (Externer Push)

Fuer Services die selbst HTTP-Requests senden koennen (z.B. Home Assistant Webhooks).
**Hinweis:** Webhook-Notifications gehen direkt an die DB und umgehen den
\`ruleConfig\`-Filter — sie sind nicht an \`notificationRules\` gebunden. Eine
Webhook-NotificationSource wird separat in den Settings unter "Neue Quelle"
angelegt und bekommt ihren eigenen API Key.

\`\`\`
POST /api/notifications
Headers:
  X-Notification-Key: <generierter-api-key>
  Content-Type: application/json

Body:
{
  "title": "Neue Firmware verfuegbar",           // Pflicht, max 255 Zeichen
  "message": "Version 2.5.0 mit Bugfixes...",    // Optional, max 2000 Zeichen
  "category": "update",                          // "info" | "warning" | "critical" | "update"
  "tag": "Firmware",                             // Optional: Freies Tag
  "priority": 1,                                 // 0-3
  "url": "https://release-notes.example.com",    // Optional: Link
}
\`\`\`

Wenn \`supportsNotifications: true\` gesetzt ist, erscheint das Plugin in
**Einstellungen > Benachrichtigungen > Neue Quelle > App verbinden**.
Der User erhaelt einen API Key fuer Webhook-Authentifizierung.

## Kategorien

| Kategorie  | Farbe           | Animation              | Einsatz                        |
|------------|-----------------|------------------------|--------------------------------|
| \`info\`     | Weiss/neutral   | Keine                  | Allgemeine Infos, Status       |
| \`warning\`  | Gelb            | Keine                  | Warnungen, Hinweise            |
| \`critical\` | Rot             | Pulse-Animation        | Ausfaelle, kritische Fehler    |
| \`update\`   | Blau            | Keine                  | Updates, neue Versionen        |

## Rate Limiting

- **Plugin-originated:** Throttle auf Polling-Ebene (max 1x/30s pro Tile)
- **Webhook:** Pro Quelle konfigurierbar (Standard: 60/Stunde), HTTP 429 bei Ueberschreitung

## Echtzeit-Delivery

Notifications werden per SSE (Server-Sent Events) in Echtzeit an das Dashboard gepusht.
Der User sieht sie sofort im Notification Panel ohne Seite neu zu laden.
`,

  performanceRules: `
# Performance-Regeln

## API-Aufrufe

| Regel                      | Details                                              |
|----------------------------|------------------------------------------------------|
| Poll-Intervall             | 30s (System steuert, Entwickler hat keinen Einfluss) |
| fetchStats/testConnection  | AbortSignal.timeout(5000) PFLICHT                    |
| crawlEntities              | AbortSignal.timeout(10000) erlaubt (mehr Daten)      |
| Parallele Requests         | Promise.all() fuer unabhaengige Endpoints            |
| Fehlerbehandlung           | fetchStats darf NIEMALS eine Exception werfen         |

## Tab-Verhalten

- **System pausiert Polling** wenn Tab verborgen ist (document.visibilitychange)
- **System resumed Polling** wenn Tab wieder sichtbar wird (sofortiger Fetch + neuer Interval)
- **Der Entwickler bekommt das gratis** - keine eigene Implementierung noetig

## Grafische Last pro Tile-Groesse

| Groesse | Erlaubt                                  | Verboten                          |
|---------|------------------------------------------|-----------------------------------|
| 1x1     | Nur Text/Zahlen, keine Grafiken          | Canvas, SVG, Animationen          |
| 2x1     | Leichte CSS-Animationen, Progress-Bars   | Canvas, requestAnimationFrame     |
| 2x2     | Canvas/SVG (einfach), CSS-Transitions    | requestAnimationFrame Loops,      |
|         | Statische Charts, Progress-Bars          | schwere Animationen, Video        |

## CSS vs JS Animationen

\`\`\`typescript
// BEVORZUGT: CSS Transition
<div className="transition-all duration-300" style={{ width: \\\`\\\${percent}%\\\` }} />

// VERMEIDEN: JS Animation
useEffect(() => {
  const id = requestAnimationFrame(animate);  // NICHT in Tiles verwenden
  return () => cancelAnimationFrame(id);
}, []);
\`\`\`

## Re-Render Optimierung

\`\`\`typescript
// RICHTIG: useMemo fuer berechnete Werte
const processedItems = useMemo(() => {
  return stats.items.map(item => ({
    ...item,
    percentage: parseFloat(String(item.value)),
  }));
}, [stats.items]);

// FALSCH: Berechnung bei jedem Render
const processedItems = stats.items.map(item => ({  // Laeuft bei jedem Render!
  ...item,
  percentage: parseFloat(String(item.value)),
}));
\`\`\`

## Weitere Regeln

- **Bildgroessen:** Keine Bilder > 100KB in Widgets laden
- **DOM-Elemente:** Widget DOM-Baum flach halten (< 50 Elemente)
- **Max 6 Stats:** Validator schneidet still ab - nicht mehr als 6 Items zurueckgeben
- **Plugin-Code schlank:** < 200 Zeilen fuer einfache Plugins, < 400 fuer komplexe
- **Keine externen Dependencies:** Nur Typen aus dem Framework importieren
- **Shared Components nutzen:** WidgetHeader, CircularProgress, SparklineChart, etc.

## Anti-Pattern: TLS self-signed Zertifikate aus Plugin-Code

Wenn das Plugin gegen einen Service mit **self-signed Cert** (OPNsense, Unraid,
Synology, viele Firewalls) fetchen muss, hat \`fetch()\` (das undici nutzt) ein
echtes Problem:

\`\`\`typescript
// FALSCH: blockt bis Timeout, kein klarer Error
const res = await fetch("https://opnsense.local/api/...");

// FALSCH: undici Agent funktioniert nicht ueber Plugin-Bundling
import { Agent } from "undici";
const agent = new Agent({ connect: { rejectUnauthorized: false } });
const res = await fetch(url, { dispatcher: agent });
// Next.js bundled undici nicht als ESM fuer Plugin-Code → schlaegt zur Laufzeit fehl
\`\`\`

**Loesung:** \`node:https\` direkt benutzen, NICHT \`fetch\`.

\`\`\`typescript
async function pluginFetch(url: string, opts: { headers?: Record<string,string>; timeoutMs?: number } = {}) {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === "https:";
  const lib = isHttps ? await import("node:https") : await import("node:http");

  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: opts.headers,
        rejectUnauthorized: false, // der entscheidende Schalter
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("error", reject);
    req.setTimeout(opts.timeoutMs ?? 5000, () => req.destroy(new Error("timeout")));
    req.end();
  });
}
\`\`\`

**Wann anwenden:** Service hat nur self-signed HTTPS, kein gueltiges CA-Cert.
**Sicherheits-Hinweis:** \`rejectUnauthorized: false\` deaktiviert Cert-Validierung
KOMPLETT — nutze es nur fuer LAN-Services die der User selbst betreibt.

Referenz: \`core/src/plugins/community/opnsense/types.ts\` hat eine voll
kommentierte Implementation dieses Patterns.
`,

  checklist: `
# Enhanced App Implementierungs-Checkliste

## 1. Plugin-Datei erstellen

- [ ] Datei angelegt: \`src/plugins/community/{id}/index.ts\`
- [ ] Shared Utilities importiert: \`import { getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions } from "../../utils";\`
- [ ] \`metadata.id\` in lowercase (z.B. "emby", "opnsense")
- [ ] \`metadata.name\` als Anzeigename
- [ ] \`metadata.icon\` als simple-icons Slug (auf simpleicons.org pruefen, PascalCase)
- [ ] \`metadata.color\` als Hex-Wert (#XXXXXX)
- [ ] \`metadata.description\` auf Deutsch
- [ ] \`metadata.category\` aus erlaubten Werten
- [ ] \`metadata.website\` gesetzt (optional aber empfohlen)
- [ ] \`configFields\` mit korrekten Typen und deutschen Labels
- [ ] \`statOptions\` mit defaultEnabled fuer die wichtigsten 2-3
- [ ] \`supportedSizes\` enthaelt mindestens \`"1x1"\`
- [ ] \`renderHints\` fuer JEDE unterstuetzte Groesse vorhanden (KEIN features Feld)

## 2. fetchStats implementieren

- [ ] Aeusserer try/catch Block (darf NICHT werfen)
- [ ] \`getVisibleStats(config, this.statOptions)\` verwenden (Shared Utility)
- [ ] \`normalizeUrl(config.apiUrl)\` verwenden (Shared Utility)
- [ ] \`createFetchOptions()\` fuer fetch-Optionen verwenden (Shared Utility)
- [ ] \`createErrorResponse(err)\` im catch-Block verwenden (Shared Utility)
- [ ] \`Promise.all()\` fuer parallele Requests
- [ ] Stats-Reihenfolge = Prioritaet (wichtigste zuerst)
- [ ] Farben korrekt verwendet (green/red/yellow Konventionen)
- [ ] Alle Labels auf Deutsch

## 3. testConnection implementieren

- [ ] try/catch Block
- [ ] \`normalizeUrl()\` und \`createFetchOptions()\` verwenden
- [ ] Leichtgewichtiger API-Endpunkt gewaehlt
- [ ] Erfolg: \`{ ok: true, message: "Verbunden mit {Service}" }\`
- [ ] Fehler: \`{ ok: false, message: "HTTP {status}: Zugriff verweigert" }\`
- [ ] Deutsche Fehlermeldungen

## 4. Auto-Discovery Exports (Pflicht fuer Community Plugins)

- [ ] \`export const plugin: AppPlugin = { ... }\` (genau "plugin" als Name)
- [ ] \`export const widget = MeinWidget;\` oder \`export const widget = null;\`
- [ ] \`export const widgetName = "MeinWidget";\` oder \`export const widgetName = null;\`
- [ ] Ordnername = \`metadata.id\` (kebab-case)
- [ ] KEINE Dateien ausserhalb des eigenen Ordners bearbeiten

## 5. Optional: crawlEntities

- [ ] Nur implementiert wenn Entity-Auswahl sinnvoll ist
- [ ] \`CrawlEntityGroup[]\` mit domain, label, icon, entities
- [ ] \`AbortSignal.timeout(10000)\` (10s Timeout)
- [ ] Deutsche Labels fuer Gruppen
- [ ] Dual-Format Support in fetchStats (\`selectedEntities\` + \`entityIds\`)

## 6. Optional: Notifications (notificationRules + checkNotifications)

- [ ] \`supportsNotifications: true\` gesetzt
- [ ] \`notificationRules: PluginNotificationRule[]\` deklariert (mindestens 1 Rule)
- [ ] Jede Rule hat id (snake_case), label (Deutsch), description (Deutsch),
      severity ("info"|"warning"|"critical"), defaultEnabled
- [ ] Rule-IDs sind STABIL — Umbenennen bricht bestehende ruleConfig in der DB
- [ ] \`checkNotifications(config, currentData, previousData)\` implementiert
- [ ] Jede erzeugte Notification hat einen \`tag\` der EXAKT einer Rule-ID entspricht
      (case-sensitive) — sonst wird sie vom Framework silent gedropped
- [ ] \`previousData === null\` wird behandelt (erster Poll → leeres Array zurueck)
- [ ] widgetData in fetchStats enthaelt ALLE Daten die fuer Vergleiche noetig sind
- [ ] dedupKey-Strategie gewaehlt (state-based / instance-based / threshold-based)
- [ ] Deutsche Notification-Titel und -Messages
- [ ] Keine Notification beim ersten Poll (previousData=null Guard)
- [ ] Verstanden: Ohne User-Opt-in im TileDialog-Toggle wird checkNotifications
      zwar aufgerufen, aber es existiert keine NotificationSource und alles dropt

## 7. Optional: Widget-Komponente

- [ ] Datei: \`src/plugins/community/{id}/{Name}Widget.tsx\` (im Plugin-Ordner!)
- [ ] \`"use client"\` Direktive am Anfang
- [ ] Alle 3 Zustaende: loading (Spinner), error (Fehlermeldung), ok (Inhalt)
- [ ] \`WidgetHeader\` fuer konsistente Kopfzeile
- [ ] Groessen-Varianten implementiert (2x1 und/oder 2x2)
- [ ] In index.ts: \`export const widget = MeinWidget;\` und \`export const widgetName = "MeinWidget";\`
- [ ] \`widgetComponent\` in renderHints stimmt mit widgetName ueberein
- [ ] Daten NUR ueber stats Prop (Actions direkt zum externen Service sind OK)
- [ ] Widget-Actions: Token ueber widgetData, fetch direkt zur externen API
- [ ] widgetData aus stats.widgetData lesen (mit Type-Assertion und Fallback)
- [ ] CSS-Transitions fuer Karussells/Uebergaenge (keine JS-Animationen)
- [ ] DOM-Baum flach (< 50 Elemente)
- [ ] Keine Bilder > 100KB

## 8. Per-Size Konfiguration (wenn Widgets vorhanden)

- [ ] statOptions haben \`showForSizes: ["1x1"]\` (damit 2x1/2x2 keine wirkungslosen Checkboxen zeigen)
- [ ] Widget-spezifische configFields haben \`showForSizes: ["2x1", "2x2"]\` oder \`["2x2"]\`
- [ ] Jede sichtbare Widget-Sektion hat eine zugehoerige Config-Option
- [ ] Gauge-Felder bieten nur Prozentwert-Metriken als Optionen
- [ ] 2x2-exklusive Felder (zusaetzliche Gauges, Slots) haben \`showForSizes: ["2x2"]\`
- [ ] 1x1 Dialog zeigt NUR statOptions (keine Widget-spezifischen configFields)
- [ ] 2x1/2x2 Dialog zeigt passende configFields (Gauge-Auswahl, Info-Zeilen, Slots)
- [ ] Groessenwechsel im Dialog aktualisiert die sichtbaren Optionen

## 9. Testen

- [ ] \`npm run build\` kompiliert fehlerfrei
- [ ] Verbindungstest im TileDialog funktioniert ("Verbunden mit ...")
- [ ] Stats werden korrekt in 1x1 angezeigt
- [ ] Stats werden korrekt in 2x1 angezeigt (falls unterstuetzt)
- [ ] Widget rendert korrekt in 2x2 (falls vorhanden)
- [ ] Loading-State wird kurz sichtbar beim Laden
- [ ] Error-State wird bei falscher Config angezeigt
- [ ] visibleStats Toggle funktioniert (Stats erscheinen/verschwinden)

## 10. Version-Bump (Pflicht bei jeder ZIP-Erstellung)

- [ ] Version im Manifest hochgezaehlt (semver):
  - Bug-Fix: patch (1.0.0 -> 1.0.1)
  - Neue Features/Stats: minor (1.0.0 -> 1.1.0)
  - Breaking Changes: major (1.0.0 -> 2.0.0)
- [ ] NIEMALS eine ZIP mit der gleichen Version wie zuvor erstellen
`,

  helloWorldExample: `
# Hello World Plugin — Komplettes Beispiel mit Multi-Size

Dieses Beispiel zeigt ein vollstaendiges Plugin mit 1x1 + 2x1 Support,
\`showForSizes\` fuer per-size Konfiguration, und allen Pflicht-Exports.

## plugin.manifest.json

\`\`\`json
{
  "id": "hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "author": "Dein Name",
  "description": "Minimales Beispiel-Plugin fuer das Dominion Dashboard",
  "hasWidget": true,
  "widgetFile": "HelloWorldWidget.tsx"
}
\`\`\`

## index.ts

\`\`\`typescript
import type { AppPlugin, PluginConfig } from "../../types";
import {
  getVisibleStats,
  normalizeUrl,
  createErrorResponse,
  createFetchOptions,
} from "../../utils";

export const plugin: AppPlugin = {
  metadata: {
    id: "hello-world",
    name: "Hello World",
    icon: "Smile",                    // simple-icons Slug (simpleicons.org)
    color: "#4CAF50",                 // Markenfarbe als Hex
    description: "Zeigt an: Uptime und Status eines beliebigen HTTP-Endpunkts",
    category: "Monitoring",
  },

  configFields: [
    // Connection-Field (immer sichtbar)
    {
      key: "apiUrl",
      label: "Server URL",
      type: "url",
      required: true,
      placeholder: "http://192.168.1.100:8080",
      description: "URL des zu ueberwachenden Services",
    },
    // Widget-Config: Nur fuer 2x1 sichtbar
    {
      key: "displayMode",
      label: "Darstellung",
      type: "select",
      showForSizes: ["2x1"],
      options: [
        { label: "Status + Antwortzeit", value: "status" },
        { label: "Antwortzeit-Verlauf", value: "history" },
      ],
    },
  ],

  statOptions: [
    {
      key: "status",
      label: "Status",
      description: "Online/Offline Status des Services",
      defaultEnabled: true,
      showForSizes: ["1x1"],  // Nur im 1x1 compact view als Checkbox
    },
    {
      key: "responseTime",
      label: "Antwortzeit",
      description: "HTTP-Antwortzeit in Millisekunden",
      defaultEnabled: true,
      showForSizes: ["1x1"],  // Nur im 1x1 compact view als Checkbox
    },
  ],

  supportedSizes: ["1x1", "2x1"],

  renderHints: {
    "1x1": { maxStats: 3, layout: "compact" },
    "2x1": { maxStats: 6, layout: "widget", widgetComponent: "HelloWorldWidget" },
  },

  async fetchStats(config: PluginConfig) {
    const visibleStats = getVisibleStats(config, this.statOptions);
    const baseUrl = normalizeUrl(config.apiUrl);

    try {
      const start = Date.now();
      const res = await fetch(baseUrl, createFetchOptions(5000));
      const responseTime = Date.now() - start;

      const items = [];

      if (visibleStats.includes("status")) {
        items.push({
          label: "Status",
          value: res.ok ? "Online" : \`HTTP \${res.status}\`,
          color: res.ok ? "green" : "red",
        });
      }

      if (visibleStats.includes("responseTime")) {
        items.push({
          label: "Antwortzeit",
          value: responseTime,
          unit: "ms",
          color: responseTime < 500 ? "green" : responseTime < 2000 ? "yellow" : "red",
        });
      }

      return {
        items,
        status: "ok",
        // widgetData fuer das 2x1 Widget
        widgetData: {
          responseTime,
          isOnline: res.ok,
          displayMode: (config.displayMode as string) || "status",
        },
      };
    } catch (err) {
      return createErrorResponse(err);
    }
  },

  async testConnection(config: PluginConfig) {
    const baseUrl = normalizeUrl(config.apiUrl);
    try {
      const res = await fetch(baseUrl, createFetchOptions(5000));
      if (res.ok) {
        return { ok: true, message: \`Verbunden mit \${baseUrl}\` };
      }
      return { ok: false, message: \`HTTP \${res.status}: \${res.statusText}\` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  },
};

// Pflicht-Exports fuer Community Auto-Discovery
export { HelloWorldWidget as widget } from "./HelloWorldWidget";
export const widgetName = "HelloWorldWidget";
\`\`\`

## Erklaerung der Schluessel-Patterns

1. **showForSizes bei statOptions:** \`showForSizes: ["1x1"]\` — Checkboxen erscheinen nur im
   1x1 Dialog. Im 2x1 Dialog sieht der User stattdessen die Widget-spezifischen configFields.
2. **showForSizes bei configFields:** \`showForSizes: ["2x1"]\` — das \`displayMode\` Feld
   erscheint nur wenn der User 2x1 waehlt. Im 1x1 Dialog ist es ausgeblendet.
3. **widgetData:** fetchStats liefert \`widgetData\` mit reichhaltigen Daten fuer das Widget.
   Das Widget liest \`config.displayMode\` aus den configFields.
4. **visibleStats:** \`getVisibleStats(config, this.statOptions)\` — filtert nach User-Auswahl
5. **normalizeUrl:** Entfernt trailing Slash von der URL
6. **createFetchOptions(5000):** Erstellt RequestInit mit 5s AbortSignal.timeout
7. **createErrorResponse:** Baut ein korrektes Error-PluginStats Objekt
8. **try/catch:** Pflicht! Exceptions wuerden den Polling-Loop brechen
9. **Deutsche Labels:** "Status", "Antwortzeit" — UI ist auf Deutsch
10. **Drei Pflicht-Exports:** \`plugin\`, \`widget\`, \`widgetName\`
`,

  sharedUtilitiesSource: `
# Shared Utilities — Quellcode

Diese Funktionen sind im Dashboard unter \`src/plugins/utils.ts\` verfuegbar.
Plugins importieren sie mit \`import { ... } from "../../utils"\`.
Dieser Import funktioniert nach dem Deployment im Dashboard automatisch.

## Verfuegbare Funktionen

\`\`\`typescript
import type { PluginConfig, PluginStats, StatOption } from "./types";

/**
 * Ermittelt welche Stats sichtbar sind (User-Auswahl oder Defaults).
 * Handles beide Formate: Array (neu) und JSON-String (alte DB-Daten).
 * JSON.parse ist in try/catch gewrappt fuer robuste Fehlerbehandlung.
 */
export function getVisibleStats(config: PluginConfig, statOptions: StatOption[]): string[] {
  if (config.visibleStats) {
    if (Array.isArray(config.visibleStats)) return config.visibleStats;
    if (typeof config.visibleStats === "string") {
      try {
        const parsed = JSON.parse(config.visibleStats);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Invalid JSON — fall through to defaults
      }
    }
  }
  return statOptions.filter((o) => o.defaultEnabled).map((o) => o.key);
}

/**
 * Entfernt einen trailing Slash von der URL.
 */
export function normalizeUrl(url: string | unknown): string {
  return String(url || "").replace(/\\/$/, "");
}

/**
 * Erstellt ein Error-PluginStats Objekt aus einem gefangenen Fehler.
 */
export function createErrorResponse(err: unknown): PluginStats {
  return { items: [], status: "error", error: (err as Error).message };
}

/**
 * Erstellt ein RequestInit Objekt mit AbortSignal.timeout und optionalen Headers.
 */
export function createFetchOptions(timeout = 5000, headers?: Record<string, string>): RequestInit {
  return { signal: AbortSignal.timeout(timeout), headers };
}

/**
 * Formatiert Bytes in lesbaren String (z.B. "1.5 TB").
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Formatiert Sekunden in lesbaren Uptime-String (z.B. "3d 5h", "2h 15m", "45m").
 * Zeigt Minuten bei Werten unter 1 Stunde.
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return \\\`\\\${days}d \\\${hours}h\\\`;
  if (hours > 0) return \\\`\\\${hours}h \\\${minutes}m\\\`;
  return \\\`\\\${minutes}m\\\`;
}
\`\`\`

## Verwendung im Plugin

\`\`\`typescript
import {
  getVisibleStats,
  normalizeUrl,
  createErrorResponse,
  createFetchOptions,
  formatBytes,
  formatUptime,
} from "../../utils";

// In fetchStats:
const visibleStats = getVisibleStats(config, this.statOptions);
const baseUrl = normalizeUrl(config.apiUrl);

try {
  const res = await fetch(\\\`\\\${baseUrl}/api/stats\\\`, createFetchOptions(5000, {
    "Authorization": \\\`Bearer \\\${config.apiKey}\\\`,
  }));
  const data = await res.json();

  const items = [];
  if (visibleStats.includes("storage")) {
    items.push({ label: "Belegt", value: formatBytes(data.usedBytes) });
  }
  if (visibleStats.includes("uptime")) {
    items.push({ label: "Uptime", value: formatUptime(data.uptimeSeconds), color: "green" });
  }

  return { items, status: "ok" };
} catch (err) {
  return createErrorResponse(err);
}
\`\`\`
`,

  widgetDesignByServiceType: `
# Widget-Design nach Service-Typ

Wenn der User keine genaue Vision hat, mache PROAKTIV Vorschlaege basierend
auf dem Service-Typ. Nutze diese Tabelle als Orientierung.

## Media Services (Emby, Plex, Jellyfin, Spotify, Navidrome)

| Groesse | Design | Inhalt |
|---------|--------|--------|
| 1x1 | Stats | Aktive Streams, Bibliotheks-Groesse (Filme/Serien/Songs) |
| 2x1 | Mini-Karussell | 2-3 kuerzlich hinzugefuegte Cover-Thumbnails mit Titel |
| 2x2 | Cover-Karussell | Grosses Karussell mit Cover-Art, Titel, Artist/Year, Auto-Slide |

**widgetData-Idee:** \`{ recentItems: [{ title, image, year }], isPlaying, nowPlaying }\`
**Shared Components:** WidgetHeader (Status-Dot), ControlButton (Play/Pause falls interaktiv)

## Monitoring / Virtualisierung (Proxmox, Portainer, Docker)

| Groesse | Design | Inhalt |
|---------|--------|--------|
| 1x1 | Stats | CPU, RAM, Uptime, Running VMs/Container |
| 2x1 | Status-Liste | Kompakte Liste: VM/Container-Name + Status-Dot (running/stopped) |
| 2x2 | Resource-Grid | Karten pro VM/Container mit CircularProgress fuer CPU + RAM |

**widgetData-Idee:** \`{ vms: [{ name, status, cpu, ram, uptime }] }\`
**Shared Components:** CircularProgress (CPU/RAM Gauges), WidgetHeader, HorizontalProgressBar
**Entity-Crawler:** Ja! \`crawlEntities\` liefert VMs/Container als waehlbare Entities.

## Smart Home (Home Assistant, openHAB)

| Groesse | Design | Inhalt |
|---------|--------|--------|
| 1x1 | Stats | Entity-Count, Aktive Automations, Unreachable Devices |
| 2x1 | Mini Entity-Grid | 4-6 Entities als kleine Karten mit Icon + State |
| 2x2 | Entity-Dashboard | Grosses Grid mit Entity-Karten, State-Anzeige, ggf. Toggle-Buttons |

**widgetData-Idee:** \`{ entities: [{ id, name, state, domain, icon }] }\`
**Shared Components:** WidgetHeader, ControlButton (Toggle On/Off)
**Entity-Crawler:** Ja! \`crawlEntities\` liefert Domains (light, sensor, switch, climate) mit Entities.

## Netzwerk (OPNsense, Pi-hole, AdGuard, Unifi)

| Groesse | Design | Inhalt |
|---------|--------|--------|
| 1x1 | Stats | DNS Queries, Blocked, Block-Rate %, Latenz |
| 2x1 | Mini-Sparkline | Traffic-Verlauf der letzten Stunde + aktuelle Werte |
| 2x2 | Dashboard | Traffic-Chart (SparklineChart) + Top-Blocked-Liste + Interface-Status |

**widgetData-Idee:** \`{ trafficHistory: number[], topBlocked: [{ domain, count }] }\`
**Shared Components:** SparklineChart (Traffic), HorizontalProgressBar (Block-Rate), WidgetHeader

## Storage (TrueNAS, Synology, Unraid)

| Groesse | Design | Inhalt |
|---------|--------|--------|
| 1x1 | Stats | Belegt/Frei, Pool-Gesundheit, Uptime |
| 2x1 | Pool-Balken | Pools als HorizontalProgressBar mit Belegung |
| 2x2 | Storage-Dashboard | Pool-Grid mit Disk-Health, Temperatur, SMART-Status |

**widgetData-Idee:** \`{ pools: [{ name, used, total, health, disks: [{ temp, smart }] }] }\`
**Shared Components:** HorizontalProgressBar (Pool-Belegung), CircularProgress (Health), WidgetHeader

## Downloads (SABnzbd, qBittorrent, Transmission, Sonarr/Radarr)

| Groesse | Design | Inhalt |
|---------|--------|--------|
| 1x1 | Stats | Download-Speed, Queue-Size, Active Downloads |
| 2x1 | Mini-Queue | Top 3 Downloads mit Progress + Speed |
| 2x2 | Volle Queue | Alle Downloads mit Fortschrittsbalken, Speed, ETA |

**widgetData-Idee:** \`{ downloads: [{ name, progress, speed, eta, status }] }\`
**Shared Components:** HorizontalProgressBar (Progress), WidgetHeader

## Allgemeine Widget-Regeln

- **2x2 soll HERAUSSTECHEN** — nicht einfach groessere Stats, sondern visuelle Daten
- **2x1 Mini-Widget ist REDUZIERT** — kompakte Version des 2x2, nicht identisch
- **Immer loading/error/ok States** — WidgetHeader mit Status-Dot
- **widgetData fuer alle Nicht-Stats-Daten** — Cover-Bilder, Listen, Charts-Daten
- **Deutsche Labels** — "Streams", "Belegt", "Geschwindigkeit", nicht englisch

## Per-Size Konfiguration pro Service-Typ

**Jede sichtbare Widget-Sektion braucht eine Config-Option im TileDialog.**

| Service-Typ | 1x1 Konfiguration | 2x1 Konfiguration | 2x2 Konfiguration |
|-------------|-------------------|-------------------|-------------------|
| Monitoring | statOptions: CPU, RAM, Uptime | gauge1/gauge2 Select, info1-3 Select | 4x Gauge, Slot-System, Filter |
| Media | statOptions: Streams, Bibliothek | displayMode Select | carouselSpeed, carouselItems, mediaCategory |
| Smart Home | statOptions (via crawlEntities) | Entity-Layout Select | Entity-Grid Konfiguration |
| Storage | statOptions: Belegt, Frei, Health | gauge1/gauge2, Pool-Anzeige | Pool-Grid, Disk-Ansicht, Temp-Anzeige |
| Netzwerk | statOptions: Queries, Blocked | Chart-Zeitraum, Info-Zeilen | Dashboard-Layout, Top-Listen |

**Umsetzung:**
- statOptions mit \`showForSizes: ["1x1"]\` wenn das Plugin Widgets hat
- Widget-Config mit \`showForSizes: ["2x1", "2x2"]\` oder \`["2x2"]\`
- Gauge-Felder: Nur Prozentwert-Metriken als Optionen (CircularProgress)
- Slots: Select mit "Ausblenden" als Option fuer optionale Bereiche
`,

  tileDialogFlow: `
# TileDialog UX-Flow: Was passiert wann?

Der Agent MUSS diesen Flow verstehen, weil er bestimmt WANN welche
Plugin-Features im UI erscheinen. Das beeinflusst direkt das Design
von configFields, statOptions, und crawlEntities.

## Chronologischer Ablauf

\`\`\`
┌─────────────────────────────────────────────────────┐
│ 1. USER GIBT TITEL EIN                              │
│    → Auto-Detection: Passt Titel zu einem Plugin?   │
│    → Falls ja: "Enhanced" Toggle erscheint           │
└──────────────────────┬──────────────────────────────┘
                       │ User aktiviert Enhanced
┌──────────────────────▼──────────────────────────────┐
│ 2. VERBINDUNGS-AUSWAHL                              │
│    → "Bestehende Verbindung waehlen" (Dropdown)     │
│    → ODER "Neue Verbindung anlegen"                  │
│                                                      │
│    Falls neue Verbindung:                            │
│    → Connection-Fields erscheinen (apiUrl, apiKey)   │
│    → "Verbindung testen" Button                      │
└──────────────────────┬──────────────────────────────┘
                       │ User klickt "Verbindung testen"
                       │ (ODER waehlt bestehende Verbindung)
┌──────────────────────▼──────────────────────────────┐
│ 3. NACH ERFOLGREICHEM TEST — Drei Dinge gleichzeitig│
│                                                      │
│    a) GROESSEN-AUSWAHL erscheint                     │
│       → Buttons: 1x1, 2x1, 2x2 (nur supportedSizes)│
│                                                      │
│    b) FEATURE-FIELDS erscheinen                      │
│       → Widget-spezifische Config (carouselSpeed)    │
│       → NUR wenn aktuelles Layout = "widget"         │
│                                                      │
│    c) ENTITY-CRAWLER laeuft (falls Plugin hat)       │
│       → System ruft crawlEntities() auf              │
│       → Bei Erfolg: Entity-Picker erscheint          │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│ 4. STAT/ENTITY AUSWAHL                              │
│                                                      │
│    ENTWEDER: Entity-Picker (wenn crawlEntities)      │
│    → Gruppierte Entities (Light, Sensor, Climate)    │
│    → Checkboxen, max je nach Groesse                 │
│    → Gespeichert als selectedEntities                │
│                                                      │
│    ODER: Stat-Options (wenn keine Entities)          │
│    → Checkboxen fuer statOptions                     │
│    → Gespeichert als visibleStats                    │
└──────────────────────┬──────────────────────────────┘
                       │ User klickt "Hinzufuegen"
┌──────────────────────▼──────────────────────────────┐
│ 5. SPEICHERN                                         │
│    → AppConnection wird erstellt (verschluesselt)    │
│    → Tile wird erstellt mit enhancedConfig           │
│    → Polling startet (alle 30s fetchStats)           │
└─────────────────────────────────────────────────────┘
\`\`\`

## Zwei Konfigurationskontexte (KRITISCH!)

Das Dashboard speichert Plugin-Daten in ZWEI getrennten Orten:

### AppConnection.config (die VERBINDUNG)
- **Wo:** Datenbank, AES-256-GCM verschluesselt
- **Was:** apiUrl, apiKey, accessToken, username, password, refreshToken
- **Wann gesetzt:** Beim Anlegen/Bearbeiten der Verbindung
- **Geteilt:** Eine Verbindung kann von MEHREREN Tiles genutzt werden
- **Im Plugin:** Kommt als \`config.apiUrl\`, \`config.apiKey\` etc. an

### Tile.enhancedConfig (die ANZEIGE)
- **Wo:** Datenbank, AES-256-GCM verschluesselt
- **Was:** visibleStats, selectedEntities, carouselSpeed, mediaCategory
- **Wann gesetzt:** Beim Anlegen/Bearbeiten der Tile
- **Pro Tile:** Jede Tile hat eigene Anzeige-Einstellungen
- **Im Plugin:** Kommt als \`config.visibleStats\`, \`config.selectedEntities\` etc. an

### Merge in fetchStats
\`\`\`typescript
// Das Dashboard merged BEIDE Configs bevor es fetchStats aufruft:
const mergedConfig = { ...connectionConfig, ...tileConfig };
plugin.fetchStats(mergedConfig);
// → Plugin erhaelt ALLES in einem Objekt:
// { apiUrl, apiKey, visibleStats, selectedEntities, carouselSpeed, ... }
\`\`\`

## Was bedeutet das fuer den Plugin-Entwickler?

### configFields Split:

**Connection-Fields** (werden sofort angezeigt):
Felder mit key = apiUrl, apiKey, accessToken, username, password, oder type = oauth
→ Diese landen in AppConnection.config

**Feature-Fields** (erscheinen NACH dem Verbindungstest):
Alle anderen Felder (z.B. carouselSpeed, mediaCategory, entityFilter)
→ Diese landen in Tile.enhancedConfig
→ Werden nach \`showForSizes\` gefiltert (wenn definiert, sonst fuer alle Groessen sichtbar)

### WICHTIG: Dynamisches Options-Menue pro Groesse

Jede Tile-Groesse hat ihr EIGENES Options-Fenster im TileDialog!
Wenn der User die Groesse wechselt, aendert sich was angezeigt wird:

\`\`\`
User waehlt 1x1 → Stat-Checkboxen (max 3), Feature-Fields ohne showForSizes oder mit "1x1" drin
User waehlt 2x1 → Stat-Checkboxen (max 6), Feature-Fields ohne showForSizes oder mit "2x1" drin
User waehlt 2x2 → Stat-Checkboxen (max 6), Feature-Fields ohne showForSizes oder mit "2x2" drin
\`\`\`

**Beispiel:** Ein Media-Plugin hat ein \`select\`-Feld "Darstellung" mit
Optionen "Karussell" und "Liste". Wenn der User "Karussell" waehlt,
sollen weitere Felder erscheinen (carouselSpeed, carouselItems).
Bei "Liste" verschwinden diese Felder.

**Wie implementieren:** Nutze \`type: "select"\` als Steuerfeld und definiere
die abhaengigen Felder so, dass sie fuer die jeweilige Auswahl relevant sind.
Das Plugin liefert alle Felder — das Dashboard zeigt nur die fuer das
aktuelle Layout relevanten an.

### Entity-Crawler Timing:

\`crawlEntities()\` wird automatisch VOM SYSTEM aufgerufen — NICHT vom User.
Der Ablauf ist:
1. User gibt Connection-Daten ein
2. User klickt "Verbindung testen"
3. \`testConnection(config)\` wird aufgerufen
4. Bei Erfolg: System ruft automatisch \`crawlEntities(config)\` auf
5. Entity-Picker erscheint mit den Ergebnissen
6. User waehlt Entities → gespeichert als \`selectedEntities\`

Der Plugin-Entwickler muss NUR \`crawlEntities()\` implementieren.
Das Dashboard uebernimmt den gesamten UI-Flow automatisch.
`,

  readmeTemplate: `
# README-Vorlage fuer App-Einreichung

Jedes Plugin muss neben der ZIP-Datei eine README.md liefern.
Die README folgt einem festen Format (Beispiel: Emby).
Das Tool \`generate_readme\` erzeugt diese automatisch.

## Pflicht-Sektionen

1. **Titel + Meta-Zeile:** Name, Category, Sizes, Auth-Typ
2. **Installations-Hinweis:** Community-Plugin → Download-Link / ZIP-Upload
3. **Beschreibung:** 1-2 Saetze was die App kann
4. **Requirements:** Voraussetzungen (Server-Version, API-Key, etc.)
5. **Features:** 4-7 Bullet-Points der wichtigsten Funktionen
6. **Tile Sizes:** Tabelle mit Size | Layout | What you see | Widget
7. **Configuration:** Tabelle mit Field | Type | Required | Default | Description
8. **Statistics:** Tabelle mit Stat | Description | Default (On/Off)
9. **Screenshots:** Platzhalter oder echte Screenshots
10. **Troubleshooting:** 2-3 haeufige Probleme mit Loesungsschritten

## Beispiel-Struktur

\`\`\`markdown
# {Plugin Name}

**Category:** {category} | **Sizes:** {sizes} | **Auth:** {auth_type}

> Community Plugin -- Install via ZIP upload in Settings > Plugins.

{Kurze Beschreibung was die App tut und welchen Service sie anbindet.}

---

## Requirements

- **{Service Name}** {version} or newer
- **{Auth}** -- {wie man den Key/Token erstellt}
- **Server URL** -- {was der User eingeben muss}

---

## Features

- {Feature 1}
- {Feature 2}
- ...

---

## Tile Sizes

| Size | Layout | What you see | Widget |
|------|--------|-------------|--------|
| **1x1** | Compact | {stats} | No |
| **2x1** | {layout} | {stats + widget?} | {Yes/No} |
| **2x2** | {layout} | {stats + widget?} | {Yes/No} |

---

## Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| Server URL | URL | Yes | -- | {description} |
| {Auth Field} | Password | Yes | -- | {description} |
| ... | ... | ... | ... | ... |

---

## Statistics

| Stat | Description | Default |
|------|-------------|---------|
| {stat_label} | {stat_description} | {On/Off} |
| ... | ... | ... |

---

## Screenshots

<!-- Screenshots coming soon -->

---

## Troubleshooting

**"{Typisches Problem 1}"**
- {Diagnose-Schritt}
- {Loesung}

**"{Typisches Problem 2}"**
- {Diagnose-Schritt}
- {Loesung}
\`\`\`
`,
} as const;
