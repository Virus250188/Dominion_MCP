// ─── Framework Knowledge Module ────────────────────────────────────────────
// Complete documentation of the Dominion Dashboard Enhanced App system.
// Served to AI agents via MCP tools to guide plugin development.
//
// LAST_SYNCED: 2026-04-06
// DASHBOARD_VERSION: 1.0.7-alpha
// SOURCE: Dashboard/src/plugins/types.ts, registry.ts, utils.ts, validator.ts
// ────────────────────────────────────────────────────────────────────────────

export const FRAMEWORK = {
  overview: `
# Enhanced App System - Uebersicht

> **Nach diesem Overview unbedingt aufrufen:**
> - \`get_widget_contract\` — Widget-Regeln, **Widget-Actions Pattern** (interaktive Controls wie Play/Pause), WidgetHeader
> - \`get_tile_size_spec\` — Exakte Pixel-Dimensionen pro Tile-Groesse
> - \`get_data_contracts\` — fetchStats Pattern, StatItem Format, Farb-Konventionen
> Falls OAuth noetig: \`get_framework_overview\` enthaelt die OAuth-Architektur.

Enhanced Apps sind Plugins fuer das **Dominion Dashboard**, die Live-Daten von
selbst-gehosteten Diensten anzeigen. Es gibt zwei Plugin-Kategorien:

- **Builtin Plugins:** Vom Projekt mitgeliefert in \`src/plugins/builtin/{id}/index.ts\`
- **Community Plugins:** Von externen Entwicklern erstellt in \`src/plugins/community/{id}/index.ts\`

Beide implementieren das gleiche \`AppPlugin\` Interface.

## WICHTIG: Arbeitsweise fuer AI Agents

**NIEMALS direkt ins Dashboard-Projekt schreiben!** Der Agent erstellt alle
Plugin-Dateien in einem **separaten Arbeitsordner** (z.B. \`Apps_enhanced/mein-plugin/\`).
Am Ende wird der fertige Plugin-Ordner als ZIP geliefert oder manuell in
\`src/plugins/community/\` abgelegt. Der Agent hat KEINEN Schreibzugriff auf
das Dashboard-Repository.

**Ein Plugin ist EIN Ordner** mit diesen Dateien:
- \`plugin.manifest.json\` (Pflicht) — Manifest mit ID, Name, Version, Autor
- \`index.ts\` (Pflicht) — Plugin-Definition mit allen Exports
- \`{Name}Widget.tsx\` (Optional) — Widget-Komponente
- \`types.ts\` (Optional) — Eigene Typ-Definitionen
- Sonst nichts. KEINE eigenen API-Routes, KEINE eigenen Ordnerstrukturen,
  KEINE Dateien ausserhalb des Plugin-Ordners.

**Delivery:** Der fertige Ordner wird als ZIP geliefert. Der User kann es
entweder in \`src/plugins/community/\` ablegen ODER ueber
**Einstellungen > Plugins > Upload** hochladen.

## Kernkonzepte

- **Plugin-Architektur:** Jedes Plugin ist ein einzelnes TypeScript-Modul, das
  Metadaten, Konfigurationsfelder, Statistik-Optionen und Laufzeit-Funktionen
  exportiert. Plugins werden beim Start ueber die Registry validiert und registriert.

- **Community-System (Auto-Discovery):** Neue Plugins werden als Community Plugins
  erstellt. Workflow: Plugin-Ordner bauen mit standardisierten Exports
  (\`plugin\`, \`widget\`, \`widgetName\`) - Ordner in \`src/plugins/community/\` ablegen -
  Server neustarten - fertig. Das Plugin wird automatisch erkannt.
  Keine Core-Dateien bearbeiten, keine Barrel-Dateien editieren.

- **KEINE eigenen API-Routes:** Plugins erstellen KEINE eigenen \`/api/\` Routes.
  Daten-Fetching laeuft ueber \`fetchStats()\` (serverseitig, alle 30s).

- **Widget-Actions (App macht es selbst):** Wenn ein Widget interaktive Controls
  braucht (Play/Pause, Like, Device-Wechsel), ruft das Widget die externe API
  **direkt vom Browser** auf. Das Dashboard ist dabei NICHT beteiligt.
  Das Plugin gibt den \`accessToken\` ueber \`widgetData\` an das Widget weiter,
  und das Widget macht \`fetch("https://api.service.com/action")\` selbst.
  \`onAction\` bleibt als optionaler Callback fuer Widget->Dashboard Kommunikation
  (z.B. "Daten neu laden"), aber die Service-Kommunikation macht die App direkt.

- **OAuth-Support (Framework-Feature):** Fuer Services die OAuth brauchen
  (Spotify, GitHub, etc.) bietet das Framework einen eingebauten OAuth-Flow.
  Das Plugin deklariert nur \`type: "oauth"\` im configField und implementiert
  \`exchangeToken()\` + \`refreshToken()\` — das Framework handhabt Redirect,
  Callback, Token-Speicherung und automatischen Token-Refresh.
  **KEINE eigenen OAuth-Routes bauen!**

- **Plugin Manifest (\`plugin.manifest.json\`):** Jedes Plugin braucht ein
  Manifest mit id, name, version, author, description. Pflicht fuer ZIP-Upload,
  empfohlen fuer manuell platzierte Plugins.

- **Shared Utilities:** Gemeinsame Hilfsfunktionen in \`src/plugins/utils.ts\`:
  \`getVisibleStats\`, \`normalizeUrl\`, \`createErrorResponse\`, \`createFetchOptions\`,
  \`formatBytes\`, \`formatUptime\`. Plugins importieren diese statt eigene zu schreiben.

- **Auto-Icon-Resolution:** Icons werden automatisch aus \`metadata.icon\` aufgeloest.
  Die Registry baut beim Start eine Icon-Map aus allen registrierten Plugins.
  Kein manuelles Editieren von \`ICON_MAP\` oder \`icons.ts\` noetig fuer Plugins.

- **Server-seitige API-Aufrufe:** Alle externen API-Aufrufe geschehen ueber den
  Server (\`/api/enhanced/[appId]\`). Der Client ruft niemals direkt die Ziel-APIs
  auf. Dadurch gibt es keine CORS-Probleme und API-Keys bleiben verborgen.

- **Sicherheit:** Die API-Endpunkte \`/api/enhanced/test\` und \`/api/enhanced/crawl\`
  erfordern Authentifizierung (Auth.js Session) und sind mit Rate Limiting
  geschuetzt (In-Memory Rate Limiter pro User).

- **Automatisches Polling:** Stats werden alle 30 Sekunden automatisch gepollt.
  Der Entwickler muss keinen Polling-Loop implementieren - das System uebernimmt
  das komplett, inklusive Pause bei Tab-Inaktivitaet.

- **Validator-Schutzschicht:** Alle Stats werden durch \`validateStats()\` gefiltert
  bevor sie den Client erreichen. Ungueltige Eintraege werden entfernt, maximal
  6 Items durchgelassen.

- **widgetData (optional):** Plugins koennen neben \`items\` auch ein \`widgetData\`
  Objekt zurueckgeben (\`Record<string, unknown>\`), das reichhaltige Daten fuer
  Widget-Rendering enthaelt (z.B. Cover-Bilder, Listen, Medien-Metadaten).
  \`widgetData\` wird NICHT vom Validator gefiltert -- es wird direkt an die
  Widget-Komponente durchgereicht via \`stats.widgetData\`.
  Beispiel: Das Emby Plugin liefert \`widgetData: { recentItems, mediaCategory,
  carouselSpeed, carouselItems }\` fuer ein Medien-Karussell im Widget.

- **Deutsche Sprache:** Alle Labels, Beschreibungen und Fehlermeldungen muessen
  auf Deutsch sein. Code-Kommentare bleiben auf Englisch fuer die Agent-Lesbarkeit.

## Dateisystem-Struktur

\`\`\`
src/plugins/
  types.ts              # AppPlugin Interface und alle Typen
  registry.ts           # Plugin-Registry mit Validierung beim Laden
  validator.ts          # Laufzeit-Validierung (validatePlugin + validateStats)
  utils.ts              # Shared Utilities (getVisibleStats, normalizeUrl, etc.)
  builtin/              # Builtin Plugins (vom Projekt mitgeliefert)
    emby/index.ts       # Referenz-Implementation (einziges Builtin)
  community/            # Community Plugins (von externen Entwicklern, Auto-Discovery)
    index.ts            # AUTO-GENERATED: wird beim Start/Build automatisch generiert
    {plugin-id}/        # Ein Ordner pro Plugin (Ordnername = metadata.id)
      plugin.manifest.json  # Pflicht: Manifest mit id, name, version, author
      index.ts          # Pflicht-Exports: plugin, widget, widgetName
      {Name}Widget.tsx   # Optional: Widget-Komponente

src/components/widgets/
  registry.ts           # Widget-Registry (registerWidget/getWidget + auto-import communityWidgets)
  shared/               # Wiederverwendbare Widget-Bausteine
    WidgetHeader.tsx     # Standard-Widget-Kopfzeile mit Status-Punkt
    CircularProgress.tsx # Kreisfoermiger Fortschrittsbalken
    SparklineChart.tsx   # Mini-Liniendiagramm
    HorizontalProgressBar.tsx
    ControlButton.tsx
  emby/EmbyWidget.tsx   # Referenz-Widget (einziges Builtin-Widget)
\`\`\`

## API-Endpunkte

| Endpunkt | Methode | Beschreibung | Auth | Rate Limit |
|----------|---------|-------------|------|------------|
| \`/api/enhanced/[appId]\` | GET | Stats abrufen (ruft \`fetchStats\` auf, inkl. auto Token-Refresh) | Ja | Nein |
| \`/api/enhanced/test\` | POST | Verbindung testen (\`{ enhancedType, config }\`) | Ja | Ja |
| \`/api/enhanced/crawl\` | POST | Entities crawlen (\`{ enhancedType, config }\`) | Ja | Ja |
| \`/api/enhanced/oauth/state\` | POST | HMAC-signierten OAuth State generieren (CSRF-Schutz) | Ja | Nein |
| \`/api/enhanced/oauth/callback\` | GET | OAuth Callback (verifiziert HMAC-Signatur, ruft \`exchangeToken\` auf, speichert Tokens) | Ja | Nein |
| \`/api/plugins/upload\` | POST | ZIP-Upload eines Community Plugins | Ja | Ja |

## Tech Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4 + CSS Custom Properties fuer Themes
- shadcn/ui (base-nova Style)
- Prisma 7.x + SQLite
- motion v12 (import from "motion/react")
- simple-icons fuer Brand-Logos
`,

  lifecycle: `
# Plugin Lifecycle - 3 Phasen

## Phase 1: Registrierung (Server-Start)

1. Das Plugin-Modul wird in \`registry.ts\` importiert (builtin oder community)
2. \`registerPlugin()\` ruft \`validatePlugin()\` auf und prueft die Struktur:
   - \`metadata.id\` muss ein nicht-leerer String sein
   - \`metadata.name\` muss ein nicht-leerer String sein
   - \`metadata.color\` muss ein gueltiger Hex-Wert sein (\`#XXXXXX\`)
   - \`configFields\` muss ein Array sein
   - \`supportedSizes\` muss ein nicht-leeres Array mit gueltigen Groessen sein (\`"1x1"\`, \`"2x1"\`, \`"2x2"\`)
   - \`fetchStats\` und \`testConnection\` muessen Funktionen sein
3. Bei Erfolg: Plugin wird in der Registry-Map registriert
4. Bei Fehler: Plugin wird uebersprungen, Fehler wird in die Konsole geloggt
5. Nach Registrierung: Icon-Map wird automatisch aus allen Plugins gebaut

\`\`\`typescript
// registry.ts - Registrierungsprozess
import { embyPlugin } from "./builtin/emby";

import { communityPlugins } from "./community";

const builtinPlugins: AppPlugin[] = [
  embyPlugin,
];

const registry = new Map<string, AppPlugin>();

function registerPlugin(plugin: AppPlugin, source: string): boolean {
  const errors = validatePlugin(plugin);
  if (errors.length > 0) {
    console.error(\\\`[\\\${source}] Plugin "\\\${plugin.metadata?.id ?? "unknown"}" failed validation:\\\`, errors);
    return false;
  }
  if (registry.has(plugin.metadata.id)) {
    console.warn(\\\`[\\\${source}] Plugin "\\\${plugin.metadata.id}" already registered -- skipping.\\\`);
    return false;
  }
  registry.set(plugin.metadata.id, plugin);
  return true;
}

// Register builtin + community plugins
for (const plugin of builtinPlugins) registerPlugin(plugin, "builtin");
for (const plugin of communityPlugins) registerPlugin(plugin, "community");

// Auto-generated icon map from all registered plugins
const pluginIconMap = new Map<string, string>();
for (const plugin of registry.values()) {
  pluginIconMap.set(plugin.metadata.name, plugin.metadata.icon);
  pluginIconMap.set(plugin.metadata.name.toLowerCase(), plugin.metadata.icon);
}
\`\`\`

## Phase 2: Konfiguration (Benutzer-Interaktion)

1. Benutzer oeffnet TileDialog und gibt einen Titel ein
2. Auto-Detection matcht den Titel gegen den Plugin-Katalog (Fuzzy-Matching)
3. Enhanced-Konfigurationsfelder erscheinen automatisch basierend auf \`configFields\`
4. Benutzer fuellt die Felder aus (URL, API Key, etc.)
5. "Verbindung testen" Button ruft \`/api/enhanced/test\` auf, was \`plugin.testConnection()\` ausfuehrt
6. Optional: Entity-Crawler holt verfuegbare Entities via \`plugin.crawlEntities()\`
7. Benutzer waehlt Tile-Groesse aus \`supportedSizes\`
8. Tile wird gespeichert mit \`type: "enhanced"\`, \`enhancedType: "{pluginId}"\`, \`enhancedConfig: JSON\`

## Phase 3: Laufzeit (Dashboard-Anzeige)

1. \`EnhancedTile\` Komponente mounted und startet den Polling-Loop
2. Alle 30 Sekunden: \`GET /api/enhanced/{tileId}\`
3. Server laedt Tile aus DB, parst Config, ruft \`plugin.fetchStats(config)\` auf
4. \`validateStats()\` filtert und sanitized die Antwort (max 6 Items)
5. Client empfaengt Stats und rendert via \`StatsDisplay\` oder Widget-Komponente
6. Bei Tab-Inaktivitaet (document.hidden): Polling wird pausiert (clearInterval)
7. Bei Tab-Aktivierung: Sofortiger Fetch + Polling wird fortgesetzt (neues setInterval)
`,

  dataflow: `
# Datenfluss: Plugin -> Validator -> API -> Client -> Tile

\`\`\`
+------------------------------------------------------------------+
| SERVER                                                            |
|                                                                   |
|  +---------------+    +---------------+    +-------------------+  |
|  |   registry    |--->|   plugin      |--->|  fetchStats()     |  |
|  |  getPlugin()  |    |  (emby,       |    |  -> fetch ext API |  |
|  |               |    |   emby, ...)  |    |  -> parse JSON    |  |
|  +---------------+    +---------------+    |  -> build items   |  |
|                                            +---------+---------+  |
|                                                      |            |
|                                            +---------v---------+  |
|                                            |  validateStats()  |  |
|                                            |  -> sanitize items|  |
|                                            |  -> max 6 items   |  |
|                                            |  -> type checking |  |
|                                            +---------+---------+  |
|                                                      |            |
|  +---------------------------------------------------v--------+  |
|  |  /api/enhanced/[appId] -> NextResponse.json(stats)          |  |
|  +---------------------------------------------------+--------+  |
+----------------------------------------------------------+--------+
                                                           | HTTP JSON
+----------------------------------------------------------v--------+
| CLIENT                                                            |
|                                                                   |
|  +-------------------------------------------------------------+ |
|  |  EnhancedTile                                                | |
|  |  -> fetch('/api/enhanced/{id}') every 30s                    | |
|  |  -> pause on tab hidden, resume on tab visible               | |
|  +---------------------------+----------------------------------+ |
|                              |                                    |
|              +---------------+---------------+                    |
|              v               v               v                    |
|  +----------------+ +----------------+ +----------------+         |
|  | 1x1: compact   | | 2x1: detailed  | | 2x2: widget   |         |
|  | StatsDisplay   | | OR Widget      | | WidgetComponent|         |
|  | (max 3 stats)  | | (max 6 stats)  | | (via registry) |         |
|  +----------------+ +----------------+ +----------------+         |
+-------------------------------------------------------------------+
\`\`\`

### Schluessel-Details:

1. **Plugin -> Externe API:** \`fetchStats()\` macht echte HTTP-Aufrufe zum Ziel-Service
   (z.B. Emby API). Diese laufen serverseitig - keine CORS-Probleme,
   API-Keys bleiben im Server-Prozess.

2. **Validator-Schutzschicht:** \`validateStats()\` ist die Sicherheitsbarriere:
   - Prueft ob \`status\` "ok" oder "error" ist
   - Filtert ungueltige Items heraus (fehlende label/value)
   - Begrenzt auf maximal 6 Items (ueberzaehlige werden still abgeschnitten)
   - Normalisiert optionale Felder (unit, icon, color)

3. **Client-Rendering:** \`EnhancedTile\` entscheidet basierend auf Tile-Groesse:
   - 1x1: Immer \`StatsDisplay size="small"\` (max 3 Stats sichtbar)
   - 2x1: \`StatsDisplay size="medium"\` ODER Widget (wenn layout: "widget" in renderHints)
   - 2x2: Widget-Komponente (wenn vorhanden) ODER \`StatsDisplay size="large"\`

4. **Widget-Aufloesung im EnhancedTile:**
   - Hat das Plugin \`renderHints[size].layout === "widget"\`?
   - Gibt es ein \`widgetComponent\` String im renderHint?
   - Ist diese Komponente in der Widget-Registry registriert?
   - Falls ja: Widget erhaelt \`{ stats, config, tileId, size }\` als Props
   - Falls nein: Fallback zu \`StatsDisplay\`
`,

  architecture: `
# Architektur-Konzepte

## Plugin-Isolation

Jedes Plugin ist vollstaendig eigenstaendig:
- Kein Plugin darf ein anderes Plugin importieren oder davon abhaengen
- Builtin Plugins: \`src/plugins/builtin/{id}/index.ts\`
- Community Plugins: \`src/plugins/community/{id}/index.ts\`
- Shared Utilities aus \`src/plugins/utils.ts\` importieren (getVisibleStats, normalizeUrl, etc.)
- Kein Shared State zwischen Plugins

## Registry-Pattern

\`\`\`typescript
// Plugin-Registry: src/plugins/registry.ts
getPlugin(id: string): AppPlugin | undefined
getAllPlugins(): AppPlugin[]
getPluginsByCategory(category: string): AppPlugin[]
getPluginCatalog(): Array<{
  name: string;
  icon: string;
  color: string;
  website: string | null;
  description: string;
  category: string;
  enhanced: true;
  pluginId: string;
  supportedSizes: TileSize[];
}>
getPluginIconSlug(appName: string): string | undefined  // Auto-resolved from registry

// Widget-Registry: src/components/widgets/registry.ts
registerWidget(name: string, component: ComponentType<WidgetProps>): void
getWidget(name: string): ComponentType<WidgetProps> | undefined
// Community widgets are auto-registered from communityWidgets map
\`\`\`

## Konfigurationsspeicherung

Tile-Konfiguration wird als JSON-String in der SQLite Datenbank gespeichert:

\`\`\`typescript
// Prisma Tile Model (relevante Felder)
{
  type: "standard" | "enhanced",
  enhancedType: string | null,     // Plugin-ID, z.B. "emby"
  enhancedConfig: string | null,   // JSON-String: { apiUrl, apiKey, visibleStats, ... }
  columnSpan: number,              // 1 oder 2
  rowSpan: number,                 // 1 oder 2
}
\`\`\`

## Stats-Struktur

\`\`\`typescript
interface StatItem {
  label: string;          // DEUTSCH! z.B. "Belegt", "Streams", "Uptime"
  value: string | number; // z.B. "85%", 42, "3d 12h"
  unit?: string;          // z.B. "GB", "%", "°C"
  icon?: string;          // Lucide Icon Name, z.B. "HardDrive", "Play"
  color?: string;         // "green" | "red" | "yellow" | "blue"
}

interface PluginStats {
  items: StatItem[];      // Max 6 nach Validierung
  status: "ok" | "error";
  error?: string;         // DEUTSCH! z.B. "Verbindung fehlgeschlagen"
  /** Optional: Reichhaltige Daten fuer Widget-Rendering (nicht vom Validator gefiltert) */
  widgetData?: Record<string, unknown>;
}
\`\`\`

## Icon-System

- **App-Icons:** Kommen von \`simple-icons\` (simpleicons.org).
  Das \`metadata.icon\` Feld enthaelt den simple-icons Slug (PascalCase),
  z.B. \`"Emby"\`, \`"Opnsense"\`, \`"Grafana"\`.
  **Kein manuelles Mapping noetig!** Die Registry baut beim Start automatisch
  eine Icon-Map aus allen registrierten Plugins. \`src/lib/icons.ts\` hat nur
  noch eine \`FOUNDATION_ICON_MAP\` fuer nicht-Plugin Apps (z.B. Plex, Sonarr).
  Plugin-Icons werden automatisch ueber \`getPluginIconSlug()\` aufgeloest.

- **Stat-Icons:** Kommen von \`lucide-react\`.
  Das \`StatItem.icon\` Feld enthaelt den Lucide-Komponentennamen,
  z.B. \`"HardDrive"\`, \`"Play"\`, \`"Thermometer"\`, \`"Activity"\`.

## Farb-Konventionen

| Farbe    | Bedeutung                                       | CSS Klasse          |
|----------|--------------------------------------------------|---------------------|
| \`green\`  | Gut, aktiv, online, niedrige Auslastung          | text-emerald-400    |
| \`red\`    | Schlecht, offline, Fehler, hohe Auslastung (>85%) | text-red-400       |
| \`yellow\` | Warnung, mittlere Auslastung (>70%)              | text-yellow-400     |
| \`blue\`   | Informativ, Temperatur, neutral                  | text-sky-400        |
| (kein)   | Standard-Textfarbe, keine besondere Bedeutung    | text-foreground     |
`,

  developerScope: `
# Entwickler-Scope: Was kontrolliert der Plugin-Entwickler?

## KRITISCH: Der Plugin-Entwickler kontrolliert NUR den Inhalt innerhalb der Tile-Box

Die Tile-Box selbst (Glaseffekt-Karte, Rahmen, Schatten) wird vom System gerendert.
Der Entwickler bestimmt nur, welche Daten und Visualisierungen darin erscheinen.

---

## Was der Entwickler kontrolliert:

### 1. Metadata (\`metadata: PluginMetadata\`)
- \`id\`: Eindeutiger Identifier (lowercase, z.B. "emby", "opnsense")
- \`name\`: Anzeigename (z.B. "Emby", "OPNsense")
- \`icon\`: simple-icons Slug (z.B. "Emby") - muss auf simpleicons.org existieren
- \`color\`: Hex-Farbe der App (z.B. "#0095d5") - muss \`#XXXXXX\` Format sein
- \`description\`: Deutsche Kurzbeschreibung (z.B. "Zeigt an: Speicher-Belegung, freier Platz, System-Uptime")
- \`category\`: Eine von: Storage, Media, Network, Automation, System, Monitoring, Downloads, Security, Productivity, Development, Custom
- \`website\`: Optionale URL zur offiziellen Seite

### 2. Konfigurationsfelder (\`configFields: ConfigField[]\`)
- Welche Eingabefelder der Benutzer im TileDialog sieht
- Typen: \`"text"\` | \`"password"\` | \`"url"\` | \`"textarea"\` | \`"select"\` | \`"number"\`
- Jedes Feld hat: key, label, type, placeholder?, required?, description?, options?, min?, max?
- Labels und Beschreibungen auf Deutsch
- \`apiUrl\` ist fast immer das erste Pflichtfeld (type: "url", required: true)

### 3. Statistik-Optionen (\`statOptions: StatOption[]\`)
- Welche Stats der Benutzer aktivieren/deaktivieren kann
- Jede Option hat: key, label, description, defaultEnabled
- Labels und Beschreibungen auf Deutsch
- defaultEnabled: true fuer die wichtigsten 2-3 Stats

### 4. Unterstuetzte Groessen (\`supportedSizes: TileSize[]\`)
- Array von: \`"1x1"\`, \`"2x1"\`, \`"2x2"\`
- Mindestens \`["1x1"]\` ist Pflicht
- Bestimmt welche Groessen der Benutzer im TileDialog waehlen kann

### 5. Render-Hints (\`renderHints: Partial<Record<TileSize, SizeRenderHint>>\`)
- Pro unterstuetzte Groesse ein Eintrag:
  - \`maxStats\`: Maximale Anzahl Stats fuer diese Groesse
  - \`layout\`: \`"compact"\` (1x1) | \`"detailed"\` (2x1) | \`"widget"\` (2x2, optional 2x1)
  - \`widgetComponent?\`: Name der Widget-Komponente (nur bei layout: "widget")

### 6. Widget-spezifische ConfigFields
- Plugins koennen neben Verbindungsfeldern (apiUrl, apiKey) auch **Feature-Felder**
  fuer Widget-Einstellungen definieren (z.B. Karussell-Geschwindigkeit, Medien-Kategorie)
- Im TileDialog werden diese Feature-Felder ERST angezeigt, nachdem der Verbindungstest
  erfolgreich war (Connection-Fields vs Feature-Fields Split)
- Feature-Felder nutzen haeufig \`type: "select"\` mit vordefinierten Optionen
- Beispiel (Emby): \`mediaCategory\` (Filme/Serien/Mixed), \`carouselSpeed\` (3s/5s/8s),
  \`carouselItems\` (3/5/8/10 Covers)

### 7. fetchStats-Logik (\`fetchStats(config) -> Promise<PluginStats>\`)
- Shared Utilities verwenden:
  - \`getVisibleStats(config, this.statOptions)\` statt manuelles JSON.parse
  - \`normalizeUrl(config.apiUrl)\` statt manuelles replace
  - \`createFetchOptions(timeout, headers)\` fuer Request-Optionen mit AbortSignal
  - \`createErrorResponse(err)\` statt manuelles Error-Objekt
  - \`formatBytes(bytes)\` und \`formatUptime(seconds)\` fuer formatierte Werte
- Beachtung von \`config.visibleStats\` (kann JSON-Array-String ODER Array sein, backward compat)
- Aufbau der StatItem-Liste mit deutschen Labels
- MUSS try/catch haben und bei Fehler \`createErrorResponse(err)\` zurueckgeben
- DARF KEINE Exceptions werfen (wuerde den Polling-Loop brechen)
- Kann optional \`widgetData\` zurueckgeben fuer reichhaltige Widget-Daten:
  \`return { items, status: "ok", widgetData: { recentItems, ... } }\`
- Widget-spezifische Config-Werte (z.B. carouselSpeed) aus \`config\` lesen und
  in \`widgetData\` weiterreichen, damit das Widget sie verwenden kann

### 8. testConnection-Logik (\`testConnection(config) -> Promise<{ ok, message }>\`)
- Verbindungstest zum Ziel-Service
- Rueckgabe: \`{ ok: true, message: "Verbunden mit {name}" }\` bei Erfolg
- Rueckgabe: \`{ ok: false, message: "HTTP {status}: Zugriff verweigert" }\` bei Fehler
- Deutsche Fehlermeldungen

### 9. Optional: crawlEntities (\`crawlEntities?(config) -> Promise<{ groups: CrawlEntityGroup[] }>\`)
- Nur fuer Services mit vielen waehlbaren Entities (z.B. Smart-Home-Systeme)
- Gibt gruppierte Entity-Liste zurueck fuer den Entity-Picker im TileDialog
- Jede Gruppe: \`{ domain, label, icon, entities: [{ id, name, state }] }\`

### 10. Optional: Widget-Komponente
- React-Komponente im Plugin-Ordner: \`src/plugins/community/{id}/{Name}Widget.tsx\`
- \`"use client"\` Direktive am Anfang
- Empfaengt WidgetProps: \`{ stats, config, tileId, size, onAction? }\`
- MUSS 3 States handlen: loading, error, ok (Daten vorhanden)
- **Builtin Widgets:** Registrierung in \`src/components/widgets/registry.ts\`
- **Community Widgets:** Export als \`widget\` und \`widgetName\` in der Plugin \`index.ts\`
  (werden automatisch per Auto-Discovery erkannt und registriert)

### 11. Pflicht-Exports fuer Community Plugins (Auto-Discovery)
- \`export const plugin: AppPlugin = { ... }\` — MUSS genau \`plugin\` heissen
- \`export const widget = MeinWidget;\` oder \`export const widget = null;\`
- \`export const widgetName = "MeinWidget";\` oder \`export const widgetName = null;\`
- Alle drei Exports sind PFLICHT, auch wenn widget/widgetName null sind

### 12. Widget-Actions (direkte API-Calls vom Browser)
- Fuer interaktive Widgets (Player-Controls, Toggles, Device-Wechsel)
- Das Widget ruft die externe API **direkt vom Browser** auf (client-side fetch)
- Das Plugin gibt den \`accessToken\` ueber \`widgetData\` in \`fetchStats\` weiter
- Das Widget liest den Token aus \`stats.widgetData.accessToken\`
- **KEIN Umweg ueber das Dashboard** — die App kontrolliert ihre eigene Kommunikation
- \`onAction\` ist nur fuer Widget->Dashboard Signale (z.B. "refresh"), NICHT fuer API-Calls
- **Sicherheit:** Das Plugin entscheidet bewusst welche Tokens es dem Widget mitgibt.
  Nur OAuth-Tokens fuer den jeweiligen Service, keine Dashboard-internen Secrets.

### 13. Plugin Manifest (\`plugin.manifest.json\`)
- Pflichtfelder: \`id\`, \`name\`, \`version\` (semver), \`author\`, \`description\`
- Optionale Felder: \`minDashboardVersion\`, \`hasWidget\`, \`widgetFile\`
- \`id\` muss mit \`metadata.id\` und dem Ordnernamen uebereinstimmen
- Pflicht fuer ZIP-Upload, empfohlen fuer manuell platzierte Plugins

### 13. Optional: OAuth (\`exchangeToken\` + \`refreshToken\`)
- Nur fuer Services die OAuth brauchen (kein API Key verfuegbar)
- Plugin deklariert \`type: "oauth"\` configField mit authUrl, tokenUrl, scopes
- Plugin implementiert \`exchangeToken(code, redirectUri, config)\` — tauscht Auth-Code gegen Tokens
- Plugin implementiert \`refreshToken(config)\` — erneuert abgelaufene Tokens
- Beide geben zurueck: \`{ accessToken, refreshToken?, expiresAt? }\`
- **Das Framework handhabt:** Redirect zum Provider, Callback-Route, Token-Speicherung,
  automatischer Refresh wenn Token < 60s vor Ablauf
- **Das Plugin handhabt:** Die HTTP-Calls zum Token-Endpoint des Providers
- \`config.accessToken\` ist in \`fetchStats\` automatisch verfuegbar nach OAuth

---

## Was das System automatisch handhabt (NICHT im Plugin implementieren!):

### Visuelles (System rendert die Tile-Box)
- **Glass Card Rendering:** \`glass-card\` CSS-Klasse mit Glaseffekt, Rahmen, Schatten
- **Online-Indikator:** Gruener/roter/grauer Punkt (oben links in der Tile-Box)
- **Pin-Icon:** Anzeige ob Tile angepinnt ist
- **Context-Menu:** Oeffnen, Bearbeiten, Loeschen, Anheften, Gruppieren (DropdownMenu)
- **Theme/Glass-Styling:** Automatisch via CSS Custom Properties und \`[data-theme]\`
- **Hover-Effekte:** Scale (1.03/1.02/1.01) und Y-Translation (-2px) via motion

### Interaktion (System handhabt alle Events)
- **Drag & Drop:** Sortierung der Tiles per @dnd-kit/react (useSortable)
- **Click-Handler:** Oeffnet die App-URL in neuem Tab (\`window.open\`)
- **Responsive Grid:** Automatische Spaltenanpassung (6 -> 4 -> 2 Spalten)

### Daten-Management (System handhabt den gesamten Datenfluss)
- **Polling-Loop:** 30-Sekunden-Intervall via setInterval in EnhancedTile
- **Tab-Visibility:** document.visibilitychange Event pausiert/resumed Polling
- **API-Proxy:** \`/api/enhanced/[appId]\` laedt Tile aus DB, ruft fetchStats auf
- **Stats-Validierung:** \`validateStats()\` sanitized und begrenzt Items auf max 6
- **Grid-Layout:** \`gridAutoRows: 160px\`, 6-Spalten Grid, columnSpan/rowSpan steuern die Tile-Groesse

### Konfiguration (System stellt die UI bereit)
- **TileDialog:** Auto-Detection, Enhanced-Config-UI, Groessen-Auswahl
- **Verbindungstest-Button:** UI und API-Aufruf an \`/api/enhanced/test\`
- **Entity-Picker:** UI Komponente fuer \`crawlEntities\` Ergebnisse
- **Stat-Auswahl:** Toggle-UI fuer jede statOption mit Persistierung in Config
`,

  agentWorkflow: `
# Agent-Workflow: Plugin entwickeln in 10 Schritten

> Dieser Workflow beschreibt den vollstaendigen Ablauf fuer einen AI-Agent,
> der ein Plugin fuer das Dominion Dashboard entwickelt.
> **WICHTIG: Arbeite IMMER in einem separaten Verzeichnis. Schreibe NIEMALS
> direkt ins Dashboard-Projekt.** Das Ergebnis ist eine ZIP-Datei.

## Schritt 1: Framework verstehen
Rufe \`get_framework_overview\` auf.
→ Verstehe das Enhanced App System, Plugin-Lifecycle, Tech Stack.

## Schritt 2: Workflow kennen
Du bist hier. Dieser Workflow gibt dir die Reihenfolge der Tool-Aufrufe.

## Schritt 3: Anforderungen klaeren
Klaere mit dem User:
- Welchen Service soll das Plugin anbinden? (z.B. Proxmox, AdGuard, Plex)
- Welche Daten sollen angezeigt werden? (z.B. CPU, RAM, Streams)
- Braucht es ein Widget? (Karussell, Chart, Controls?)
- Welche Tile-Groessen? (1x1 immer, 2x1 fuer Details, 2x2 fuer Widget)
- Braucht es OAuth oder reicht API-Key?
- Braucht es einen Entity-Crawler? (viele waehlbare Geraete/Container)

## Schritt 4: Specs lesen
Rufe auf (je nach Bedarf):
- \`get_data_contracts\` → PluginStats, StatItem, ConfigField Interfaces
- \`get_tile_size_spec\` (fuer jede gewuenschte Groesse) → Pixel-Dimensionen, Limits
- \`get_widget_contract\` (falls Widget) → WidgetProps, WidgetHeader, Shared Components
- \`get_entity_crawler_spec\` (falls Crawler) → CrawlEntityGroup Interface
- \`get_performance_guidelines\` → Timeouts, Polling, Anti-Patterns
- \`get_shared_utilities\` → Verfuegbare Hilfsfunktionen (getVisibleStats, formatBytes etc.)
- \`get_shared_components\` (falls Widget) → WidgetHeader, CircularProgress etc. Quellcode

## Schritt 5: Plugin generieren
Rufe \`scaffold_plugin\` auf mit den gesammelten Parametern.
→ Erhaeltst: plugin.manifest.json + index.ts mit TODOs

## Schritt 6: Code anpassen
Fuelle die TODO-Kommentare im generierten Code:
- API-Endpoints des Ziel-Services einsetzen
- Auth-Header konfigurieren (API-Key, Bearer Token, etc.)
- fetchStats-Logik implementieren (Response parsen, StatItems bauen)
- testConnection implementieren (Endpunkt pruefen, Fehlermeldungen)
- Markenfarbe von simpleicons.org holen
- Deutsche Labels und Beschreibungen

## Schritt 7: Widget generieren (optional)
Falls Widget gewuenscht: Rufe \`scaffold_widget\` auf.
→ Erhaeltst: {Name}Widget.tsx mit Size-Varianten
→ Widget-Code anpassen: widgetData nutzen, Visualisierung bauen

## Schritt 8: Validieren
Rufe auf:
- \`validate_plugin_structure\` → Prueft alle 20+ Regeln
- \`test_plugin_completeness\` → Prueft Vollstaendigkeit aller Dateien
- \`test_plugin_export\` → Prueft Export-Shape
- \`test_typescript_syntax\` → Prueft Klammern, Imports

## Schritt 9: Preview (optional)
Rufe \`preview_tile\` auf fuer eine visuelle HTML-Vorschau der Tiles.

## Schritt 10: ZIP erstellen und ausliefern
Rufe \`create_plugin_zip\` auf mit:
- pluginId, manifestJson, pluginCode
- Optional: widgetCode, widgetFileName, typesCode
→ ZIP wird auf die Festplatte geschrieben
→ Teile dem User den Dateipfad mit

Der User installiert das Plugin:
- **Via UI:** Dashboard > Einstellungen > Plugins > Upload
- **Manuell:** ZIP entpacken nach \`src/plugins/community/\`, Server neustarten
`,

  deployment: `
# Deployment & Installation

## Wie das Dashboard betrieben wird

Das Dominion Dashboard kann auf verschiedene Arten betrieben werden:
- **Docker:** \`docker pull miguel1988/dominion:latest\` — laeuft irgendwo im Netzwerk
- **Bare Metal:** Direkt auf einem Server mit Node.js installiert
- **Entwicklung:** \`npm run dev\` auf dem lokalen Rechner

**Fuer den Plugin-Entwickler ist der Betriebsmodus EGAL.** Plugins funktionieren
identisch in allen Umgebungen.

## Plugin-Installation (Sicht des Users)

### Weg 1: ZIP-Upload ueber Dashboard UI (empfohlen)
1. Dashboard oeffnen (z.B. \`http://192.168.1.100:3000\`)
2. **Einstellungen** > **Plugins** > **Upload**
3. ZIP-Datei auswaehlen (max 5 MB)
4. Dashboard validiert: Manifest, Exports, Widget-Dateien
5. Bei Erfolg: Plugin wird nach \`src/plugins/community/{id}/\` extrahiert
6. **Server neustarten** (Button erscheint nach Upload)
7. Plugin erscheint im Tile-Dialog unter der jeweiligen Kategorie

### Weg 2: Manuelles Ablegen (nur bei Dateizugang)
1. ZIP entpacken
2. Ordner nach \`src/plugins/community/{id}/\` kopieren
3. Server neustarten (\`npm run dev\` oder Docker Container neustarten)
4. Auto-Discovery erkennt das Plugin automatisch

## Wichtig fuer Plugin-Entwickler

- **Keine Dashboard-URL im Plugin-Code!** Das Plugin kennt die Dashboard-URL nicht
  und braucht sie auch nicht. Alle API-Aufrufe laufen ueber den Server.
- **Service-URLs kommen vom User:** Der User gibt die URL seines Services
  (z.B. Emby, Proxmox) ueber die \`configFields\` ein. Diese werden verschluesselt
  in der Datenbank gespeichert.
- **Kein Dateisystem-Zugriff noetig:** Plugins greifen nicht auf das Dateisystem zu.
  Alles laeuft ueber \`fetchStats(config)\` -> HTTP-Request zum Ziel-Service.
- **Docker-Netzwerk:** In Docker-Umgebungen muessen Service-URLs aus dem
  Docker-Netzwerk erreichbar sein (z.B. \`http://emby:8096\` statt \`http://localhost:8096\`).
  Das ist aber Sache des Users bei der Konfiguration, nicht des Plugins.

## ZIP-Struktur fuer Upload

\`\`\`
mein-plugin.zip
├── mein-plugin/                  # Ordner mit Plugin-ID als Name
│   ├── plugin.manifest.json      # Pflicht: Manifest
│   ├── index.ts                  # Pflicht: Plugin-Code
│   ├── MeinPluginWidget.tsx      # Optional: Widget
│   └── types.ts                  # Optional: Eigene Typen
\`\`\`

Hinweis: Der ZIP darf optional einen Wrapper-Ordner haben — die Upload-Logik
erkennt und entfernt diesen automatisch.

## Validierung beim Upload

Das Dashboard prueft beim ZIP-Upload:
1. ZIP ist lesbar und nicht korrupt
2. Keine Path-Traversal-Attacken (\`../\`)
3. \`plugin.manifest.json\` vorhanden und gueltiges JSON
4. Alle Pflichtfelder: id, name, version, author, description
5. ID ist kebab-case, Version ist semver
6. \`index.ts\` vorhanden und exportiert \`const plugin\`
7. Falls \`hasWidget: true\`: Widget-Datei vorhanden
8. ID kollidiert nicht mit bestehenden Plugins
9. Optional: \`minDashboardVersion\` Kompatibilitaet
`,
} as const;
