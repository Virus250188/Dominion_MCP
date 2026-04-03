// ─── Patterns & Best Practices Module ──────────────────────────────────────
// Code patterns, anti-patterns, and implementation guidelines for Enhanced Apps.
// Served to AI agents via MCP tools to guide correct plugin implementation.
// ────────────────────────────────────────────────────────────────────────────

export const PATTERNS = {
  pluginStructure: `
# Plugin-Struktur (AppPlugin Interface)

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
  type: "text" | "password" | "url" | "textarea" | "select" | "number";
  placeholder?: string; // Platzhaltertext (z.B. "http://emby.local:8096")
  required?: boolean;   // Pflichtfeld? (apiUrl ist fast immer required)
  description?: string; // Hilfetext auf Deutsch unter dem Feld
  options?: { label: string; value: string }[];  // Nur fuer type: "select"
  min?: number;         // Nur fuer type: "number"
  max?: number;         // Nur fuer type: "number"
}
\`\`\`

### StatOption
\`\`\`typescript
interface StatOption {
  key: string;           // Interner Key (z.B. "usage", "streams", "uptime")
  label: string;         // Label auf Deutsch (z.B. "Speicher-Belegung")
  description: string;   // Beschreibung auf Deutsch (z.B. "Prozent des belegten Speichers")
  defaultEnabled: boolean; // Standard-aktiviert? (true fuer die wichtigsten 2-3)
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
  color?: string;         // "green" | "red" | "yellow" | "blue" | undefined
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

## Dual-Format Support in fetchStats

Plugins mit crawlEntities MUESSEN beide Formate in fetchStats lesen:

\`\`\`typescript
// Neues Format (vom Entity-Picker gespeichert)
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

// Legacy-Format (Textarea mit entity_id:Label pro Zeile)
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

## Regeln

1. **AbortSignal.timeout(10000)** - 10s Timeout (mehr Daten als normaler Fetch)
2. **Gruppieren nach Domain/Typ** - Sortierte Gruppen mit deutschen Labels
3. **Lucide-Icons fuer Gruppen** - Passende Icons pro Domain waehlen
4. **crawlEntities darf Exceptions werfen** - (anders als fetchStats!) System fängt ab
5. **Entity-Namen alphabetisch sortieren** innerhalb jeder Gruppe
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
3. **KEINE eigenen API-Calls** - Daten kommen ausschliesslich ueber stats Prop
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

## NUR 1 Datei muss angepasst werden: \`src/plugins/community/index.ts\`

### Schritt 1: Plugin-Ordner erstellen

\`\`\`
src/plugins/community/meinservice/index.ts
\`\`\`

### Schritt 2: Export + Array-Eintrag in community/index.ts

\`\`\`typescript
// ── Community plugin exports go here ──
export { meinPlugin } from "./meinservice";

// All community plugins collected for the registry.
export const communityPlugins: AppPlugin[] = [
  meinPlugin,  // <-- Neues Plugin
];

// Optional: Widget-Map (nur wenn Plugin ein Widget hat)
export const communityWidgets: Record<string, ComponentType<unknown>> = {
  "MeinServiceWidget": MeinServiceWidget,  // <-- Automatisch registriert
};
\`\`\`

### Das war's! Keine weiteren Core-Dateien noetig.

- **Kein \`registry.ts\` bearbeiten** - Community Plugins werden automatisch importiert
- **Kein \`icons.ts\` bearbeiten** - Icons werden automatisch aus metadata.icon aufgeloest
- **Kein \`widgets/registry.ts\` bearbeiten** - Community Widgets werden automatisch registriert

## Validierung beim Start

Nach der Registrierung prueft \`validatePlugin()\` automatisch:
- metadata.id ist nicht-leerer String
- metadata.name ist nicht-leerer String
- metadata.color ist gueltiges Hex (#XXXXXX)
- configFields ist ein Array
- supportedSizes ist nicht-leeres Array mit gueltigen Groessen
- fetchStats ist eine Funktion
- testConnection ist eine Funktion

Bei Fehler: Plugin wird NICHT registriert, Fehler in Console.
Doppelte IDs werden erkannt und uebersprungen (Warnung in Console).
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
  (f) => CONNECTION_KEYS.has(f.key) || f.required
);

const featureFields = plugin.configFields.filter(
  (f) => !CONNECTION_KEYS.has(f.key) && !f.required
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
| \`"blue"\`   | text-sky-400     | Information, Temperatur, neutral-hervorgehoben |
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

// Temperatur (immer blau)
{ label: "CPU Temp", value: 45, unit: "°C", color: "blue" }

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
  if (color === "blue") return "text-sky-400";
  return "text-foreground";
}

function getStatBgColor(color?: string): string {
  if (color === "green") return "bg-emerald-500/10";
  if (color === "red") return "bg-red-500/10";
  if (color === "yellow") return "bg-yellow-500/10";
  if (color === "blue") return "bg-sky-500/10";
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

## 2. Widget mit eigenen API-Calls

\`\`\`typescript
// FALSCH: Widget ruft eigene API auf
function MeinWidget({ stats }: WidgetProps) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("/api/my-custom-endpoint").then(r => r.json()).then(setData);  // VERBOTEN!
  }, []);
}
\`\`\`

**Richtig:** Alle Daten kommen ueber \`stats\` Prop. Der Polling-Loop des Systems
liefert die Daten. Wenn das Widget spezielle Daten braucht (z.B. Cover-Bilder,
Listen), muessen diese in \`fetchStats()\` geholt und als \`widgetData\` zurueckgegeben
werden. Das Widget liest dann \`stats.widgetData\`.

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
- [ ] Farben korrekt verwendet (green/red/yellow/blue Konventionen)
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

## 6. Optional: Widget-Komponente

- [ ] Datei: \`src/plugins/community/{id}/{Name}Widget.tsx\` (im Plugin-Ordner!)
- [ ] \`"use client"\` Direktive am Anfang
- [ ] Alle 3 Zustaende: loading (Spinner), error (Fehlermeldung), ok (Inhalt)
- [ ] \`WidgetHeader\` fuer konsistente Kopfzeile
- [ ] Groessen-Varianten implementiert (2x1 und/oder 2x2)
- [ ] In index.ts: \`export const widget = MeinWidget;\` und \`export const widgetName = "MeinWidget";\`
- [ ] \`widgetComponent\` in renderHints stimmt mit widgetName ueberein
- [ ] KEINE eigenen API-Calls - nur stats Prop verwenden
- [ ] widgetData aus stats.widgetData lesen (mit Type-Assertion und Fallback)
- [ ] CSS-Transitions fuer Karussells/Uebergaenge (keine JS-Animationen)
- [ ] DOM-Baum flach (< 50 Elemente)
- [ ] Keine Bilder > 100KB

## 7. Testen

- [ ] \`npm run build\` kompiliert fehlerfrei
- [ ] Verbindungstest im TileDialog funktioniert ("Verbunden mit ...")
- [ ] Stats werden korrekt in 1x1 angezeigt
- [ ] Stats werden korrekt in 2x1 angezeigt (falls unterstuetzt)
- [ ] Widget rendert korrekt in 2x2 (falls vorhanden)
- [ ] Loading-State wird kurz sichtbar beim Laden
- [ ] Error-State wird bei falscher Config angezeigt
- [ ] visibleStats Toggle funktioniert (Stats erscheinen/verschwinden)
`,
} as const;
