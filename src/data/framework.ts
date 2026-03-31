// ─── Framework Knowledge Module ────────────────────────────────────────────
// Complete documentation of the Dominion Dashboard Enhanced App system.
// Served to AI agents via MCP tools to guide plugin development.
// ────────────────────────────────────────────────────────────────────────────

export const FRAMEWORK = {
  overview: `
# Enhanced App System - Uebersicht

Enhanced Apps sind Plugins fuer das **Dominion Dashboard**, die Live-Daten von
selbst-gehosteten Diensten anzeigen. Es gibt zwei Plugin-Kategorien:

- **Builtin Plugins:** Vom Projekt mitgeliefert in \`src/plugins/builtin/{id}/index.ts\`
- **Community Plugins:** Von externen Entwicklern erstellt in \`src/plugins/community/{id}/index.ts\`

Beide implementieren das gleiche \`AppPlugin\` Interface.

## Kernkonzepte

- **Plugin-Architektur:** Jedes Plugin ist ein einzelnes TypeScript-Modul, das
  Metadaten, Konfigurationsfelder, Statistik-Optionen und Laufzeit-Funktionen
  exportiert. Plugins werden beim Start ueber die Registry validiert und registriert.

- **Community-System:** Neue Plugins werden als Community Plugins erstellt.
  Workflow: Ordner anlegen in \`src/plugins/community/my-plugin/\`, Export +
  Array-Eintrag in \`src/plugins/community/index.ts\` hinzufuegen - fertig.
  Keine weiteren Core-Dateien muessen bearbeitet werden.

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
    truenas/index.ts
    emby/index.ts
    homeassistant/
    opnsense/index.ts
    unraid/index.ts
    teslamate/index.ts
    jdownloader/index.ts
    filemover/index.ts
  community/            # Community Plugins (von externen Entwicklern)
    index.ts            # Barrel-Datei: Exports + communityPlugins Array + communityWidgets Map

src/components/widgets/
  registry.ts           # Widget-Registry (registerWidget/getWidget + auto-import communityWidgets)
  shared/               # Wiederverwendbare Widget-Bausteine
    WidgetHeader.tsx     # Standard-Widget-Kopfzeile mit Status-Punkt
    CircularProgress.tsx # Kreisfoermiger Fortschrittsbalken
    SparklineChart.tsx   # Mini-Liniendiagramm
    HorizontalProgressBar.tsx
    ControlButton.tsx
  emby/EmbyWidget.tsx
  truenas/TrueNASWidget.tsx
  unraid/UnraidWidget.tsx
  homeassistant/HomeAssistantWidget.tsx
\`\`\`

## API-Endpunkte

| Endpunkt | Methode | Beschreibung | Auth | Rate Limit |
|----------|---------|-------------|------|------------|
| \`/api/enhanced/[appId]\` | GET | Stats fuer ein Enhanced Tile abrufen | Ja | Nein |
| \`/api/enhanced/test\` | POST | Verbindung testen (\`{ enhancedType, config }\`) | Ja | Ja |
| \`/api/enhanced/crawl\` | POST | Entities crawlen (\`{ enhancedType, config }\`) | Ja | Ja |

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
import { truenasPlugin } from "./builtin/truenas";
import { embyPlugin } from "./builtin/emby";
// ... weitere Builtin-Imports

import { communityPlugins } from "./community";

const builtinPlugins: AppPlugin[] = [
  truenasPlugin,
  embyPlugin,
  // ... weitere Builtin-Plugins
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
|  |  getPlugin()  |    |  (truenas,    |    |  -> fetch ext API |  |
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
   (z.B. TrueNAS API). Diese laufen serverseitig - keine CORS-Probleme,
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
  enhancedType: string | null,     // Plugin-ID, z.B. "truenas"
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
  z.B. \`"Truenas"\`, \`"Emby"\`, \`"Homeassistant"\`.
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
- \`id\`: Eindeutiger Identifier (lowercase, z.B. "truenas", "emby")
- \`name\`: Anzeigename (z.B. "TrueNAS", "Emby")
- \`icon\`: simple-icons Slug (z.B. "Truenas") - muss auf simpleicons.org existieren
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
- Nur fuer Services mit vielen waehlbaren Entities (z.B. Home Assistant)
- Gibt gruppierte Entity-Liste zurueck fuer den Entity-Picker im TileDialog
- Jede Gruppe: \`{ domain, label, icon, entities: [{ id, name, state }] }\`

### 10. Optional: Widget-Komponente
- React-Komponente in \`src/components/widgets/{id}/{Name}Widget.tsx\`
- \`"use client"\` Direktive am Anfang
- Empfaengt WidgetProps: \`{ stats, config, tileId, size, onAction? }\`
- MUSS 3 States handlen: loading, error, ok (Daten vorhanden)
- **Builtin Widgets:** Registrierung in \`src/components/widgets/registry.ts\`
- **Community Widgets:** Export in \`communityWidgets\` Map in \`src/plugins/community/index.ts\`
  (werden automatisch von der Widget-Registry importiert und registriert)

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
- **Responsive Grid:** Automatische Spaltenanpassung (5 -> 3 -> 2 Spalten)

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
} as const;
