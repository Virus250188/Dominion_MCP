// ─── Tile Size Specifications Module ───────────────────────────────────────
// Detailed specs for each tile size in the Dominion Dashboard.
// Served to AI agents via MCP tools to guide plugin rendering decisions.
//
// LAST_SYNCED: 2026-04-06
// DASHBOARD_VERSION: 1.0.7-alpha
// SOURCE: Dashboard/src/components/dashboard/EnhancedTile.tsx, TileDialog.tsx
// ────────────────────────────────────────────────────────────────────────────

export const TILE_SPECS = {
  comparison: `
# Tile-Groessen: Rollen und Vergleich

## Die drei Rollen

- **1x1 = STATUSANZEIGE** — Auf einen Blick: Ist alles OK? 2-3 Kennzahlen. Kein Widget.
- **2x1 = DETAIL oder MINI-WIDGET** — Mehr Stats ODER ein kompaktes Widget (Liste, Mini-Chart). Reduziert gegenueber 2x2.
- **2x2 = VISUELLES PREMIUM-WIDGET** — Die Highlight-Ansicht. Cover-Karussell, Entity-Grid, System-Dashboard. Soll herausstechen.

## Technischer Vergleich

| Eigenschaft       | 1x1 (Klein)         | 2x1 (Mittel)           | 2x2 (Gross)              |
|-------------------|---------------------|------------------------|--------------------------|
| Grid Spalten      | 1 (columnSpan: 1)   | 2 (columnSpan: 2)      | 2 (columnSpan: 2)        |
| Grid Zeilen       | 1 (rowSpan: 1)      | 1 (rowSpan: 1)         | 2 (rowSpan: 2)           |
| Hoehe             | 160px               | 160px                  | 336px (2*160 + 16 gap)   |
| Max Stats         | 3 (sichtbar)        | 6                      | 6                        |
| Layout            | compact             | detailed ODER widget   | widget ODER detailed     |
| Widget-Support    | Nein                | Optional               | Ja (empfohlen)           |
| Anwendungsfall    | Einfache Metriken   | Mehr Daten / Mini-Vis  | Komplexe Visualisierung  |

### Wichtige Regeln:

- **gridAutoRows: 160px** - Jede Grid-Zeile ist exakt 160px hoch
- **gap: 16px (1rem)** - Abstand zwischen Tiles
- Die tatsaechliche Hoehe eines 2x2 Tiles ist \`2 * 160 + 16 = 336px\` (inkl. Gap)
- Responsive Breakpoints: 6 Spalten (Desktop) -> 4 Spalten (< 1024px) -> 2 Spalten (< 640px)
- 1x1 Tiles sind IMMER verfuegbar, auch fuer Enhanced Apps
- 2x1 und 2x2 sind NUR fuer Enhanced Apps mit entsprechenden supportedSizes

### supportedSizes Optionen

| Deklaration            | Verhalten                 | Beschreibung                          |
|------------------------|---------------------------|---------------------------------------|
| \`["1x1"]\`              | Kein Groessen-Selektor    | Immer 1x1, einfachste Form           |
| \`["1x1", "2x1"]\`       | 2 Optionen                | Stats-Erweiterung, kein Widget noetig |
| \`["1x1", "2x1", "2x2"]\`| 3 Optionen                | Volle Widget-Unterstuetzung           |
| \`["1x1", "2x2"]\`       | 2 Optionen                | Ueberspringt 2x1, direkt zum Widget  |

### Pflichtregeln

1. \`"1x1"\` ist Pflicht - jedes Plugin MUSS mindestens 1x1 unterstuetzen
2. Keine Groesse ohne renderHints - jede deklarierte Groesse braucht einen renderHints-Eintrag
3. Widget-Groessen brauchen Widget-Komponenten - layout: "widget" erfordert widgetComponent
`,

  "1x1": {
    name: "Klein (1x1)",
    gridSpans: { columnSpan: 1, rowSpan: 1 },
    height: "160px",
    maxStats: 3,
    layout: "compact" as const,
    widgetSupport: false,
    spec: `
# 1x1 Tile (Klein) - Detaillierte Spezifikation

## ASCII Layout

\`\`\`
+----------------------------------+
| [.] Online    [...] Context Menu |  <- System (nicht Entwickler)
|                                  |
|           [ICON 48px]            |  <- System (AppIcon)
|                                  |
|          "App Title"             |  <- System (tile.title)
|       "Beschreibung"            |  <- System (tile.description)
|                                  |
|  ---- Stats-Bereich (border) -  |  <- Entwickler kontrolliert INHALT
|   Stat1    Stat2    Stat3       |  <- max 3 Stats sichtbar
+----------------------------------+
\`\`\`

## Grid-Dimensionen

- columnSpan: 1
- rowSpan: 1
- Hoehe: 160px (1 Grid-Zeile)
- Breite: 1 Grid-Spalte (variiert je nach Gesamtspalten, 6 Spalten Desktop)

## Was der Entwickler kontrolliert

Der Entwickler bestimmt ueber \`fetchStats()\` welche Stats erscheinen.
Das System rendert alles andere: Icon, Titel, Glass Card, Online-Punkt, Context Menu.

**1x1 Tile Styling:** Kompakter Aufbau mit \`p-3 pt-6\`, \`gap-1.5\`, Icon 40px.
Wenn Stats vorhanden sind, wird die Beschreibung ausgeblendet fuer mehr Platz.

Der Stats-Bereich zeigt maximal 3 Items in einer horizontalen Reihe:
- Jeder Stat: Wert oben (text-xs, font-semibold, tabular-nums), Label unten (text-[9px], muted)
- Optionale Unit rechts neben dem Wert (text-[10px], muted)
- Farbe des Werts bestimmt durch \`StatItem.color\`
- Stats-Bereich hat \`border-t border-border/30\` Separator

| Anzahl | Layout                             |
|--------|------------------------------------|
| 1 Stat | Zentriert unter dem Titel          |
| 2 Stats| Zwei Spalten, gleichmaessig        |
| 3 Stats| Drei Spalten, gleichmaessig        |

## renderHints Format

\`\`\`typescript
renderHints: {
  "1x1": {
    maxStats: 3,      // System zeigt max 3
    layout: "compact",
    // KEIN widgetComponent fuer 1x1 - wird ignoriert
  },
}
\`\`\`

## Einschraenkungen

- **Kein Widget** - 1x1 Tiles rendern immer ueber StatsDisplay, niemals ueber eine Widget-Komponente
- **Kein Canvas/SVG** - Nur Text und Zahlen, keine grafischen Elemente
- **Keine Animationen** - Zu wenig Platz, CPU-Overhead nicht gerechtfertigt
- **Max 3 Stats sichtbar** - StatsDisplay schneidet bei 3 ab, auch wenn mehr geliefert werden
- **Kurze Labels** - Max ~10 Zeichen, sonst wird abgeschnitten
- **Kurze Werte** - Max ~8 Zeichen inkl. Unit
`,
  },

  "2x1": {
    name: "Mittel (2x1)",
    gridSpans: { columnSpan: 2, rowSpan: 1 },
    height: "160px",
    maxStats: 6,
    layout: "detailed" as const,
    widgetSupport: true,
    spec: `
# 2x1 Tile (Mittel) - Detaillierte Spezifikation

## ASCII Layout - Variante A: Stats Mode (layout: "detailed")

\`\`\`
+------------------------------------------------------------------+
| [.] Online                              [...] Context Menu       |
|                                                                  |
|  [ICON 44px]  "App Title"    Stat1  Stat2  Stat3  Stat4  Stat5  |
|               "Beschreibung"                              Stat6  |
|                                                                  |
+------------------------------------------------------------------+
\`\`\`

## ASCII Layout - Variante B: Widget Mode (layout: "widget")

\`\`\`
+------------------------------------------------------------------+
|                                              [...] Context Menu  |
| +--------------------------------------------------------------+ |
| | Widget-Komponente fuellt den gesamten Bereich                | |
| | z.B. WidgetHeader + kompakte Entity-Cards / Progress-Bars    | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
\`\`\`

## Grid-Dimensionen

- columnSpan: 2
- rowSpan: 1
- Hoehe: 160px (1 Grid-Zeile)
- Breite: 2 Grid-Spalten (doppelt so breit wie 1x1)

## Was der Entwickler kontrolliert

### Bei layout: "detailed" (Standard)
- Stats-Inhalte via \`fetchStats()\`
- System rendert: Icon (44px) links, Titel/Beschreibung daneben, Stats rechts
- Stats in horizontaler Reihe, rechtsbündig (\`justify-end\`, \`gap-4\`)
- Bis zu 6 Stats sichtbar, je Stat: Wert oben, Label unten

### Bei layout: "widget"
- Widget-Komponente fuellt den gesamten Tile-Bereich
- Context Menu bleibt (absolute positioned, vom System)
- Widget erhaelt \`size: "2x1"\` als Prop
- Geeignet fuer: kompakte Entity-Cards, Progress-Bars, Mini-Charts
- WidgetHeader.tsx verwenden fuer konsistente Kopfzeile (40px hoch, dann ~112px Content)

## renderHints Format

\`\`\`typescript
// Ohne Widget (Standard):
renderHints: {
  "2x1": {
    maxStats: 6,
    layout: "detailed",
  },
}

// Mit Widget:
renderHints: {
  "2x1": {
    maxStats: 6,
    layout: "widget",
    widgetComponent: "MeinServiceWidget",
  },
}
\`\`\`

## Einschraenkungen

- **160px Hoehe** - Wenig vertikaler Platz, alles muss in eine Zeile passen
- **Leichte CSS-Animationen OK** - Transitions, Progress-Bars, Farbwechsel
- **Kein Canvas** - Nicht genug Platz, zu schwer fuer die Groesse
- **Widget muss loading/error handlen** - 3 States Pflicht
- **Labels kurz halten** - Max ~12 Zeichen fuer Stats im detailed Mode
`,
  },

  "2x2": {
    name: "Gross (2x2)",
    gridSpans: { columnSpan: 2, rowSpan: 2 },
    height: "336px (2 * 160 + 16 gap)",
    maxStats: 6,
    layout: "widget" as const,
    widgetSupport: true,
    spec: `
# 2x2 Tile (Gross) - Detaillierte Spezifikation

## ASCII Layout - Variante A: Widget Mode (empfohlen)

\`\`\`
+------------------------------------------------------------------+
|                                              [...] Context Menu  |
| +--------------------------------------------------------------+ |
| | Widget-Komponente (voller Bereich, flex-col, min-h-0)        | |
| |                                                              | |
| | +----------------------------------------------------------+ | |
| | | WidgetHeader: [Status] [Icon] Titel    Subtitle          | | |
| | +----------------------------------------------------------+ | |
| | |                                                          | | |
| | |  Widget-Inhalt (flex-1, overflow-hidden)                 | | |
| | |  z.B. Entity-Grid, Charts, Listen, Progress-Bars        | | |
| | |  Verfuegbare Hoehe: ~290px                               | | |
| | |                                                          | | |
| | |                                                          | | |
| | +----------------------------------------------------------+ | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
\`\`\`

## ASCII Layout - Variante B: Stats Grid (Fallback ohne Widget)

\`\`\`
+------------------------------------------------------------------+
|                                              [...] Context Menu  |
| [.] [ICON 32px] "App Title"              [Pin] [Enhanced Badge]  |
| ---------------------------------------------------------(mb-3)- |
|                                                                  |
|  LABEL1            LABEL2            LABEL3                      |
|  Wert1             Wert2             Wert3                       |
|                                                                  |
|  LABEL4            LABEL5            LABEL6                      |
|  Wert4             Wert5             Wert6                       |
|                                                                  |
|  [========== Progress Bar (wenn % Wert) ==========]             |
|                                                                  |
+------------------------------------------------------------------+
\`\`\`

## Grid-Dimensionen

- columnSpan: 2
- rowSpan: 2
- Hoehe: ~336px (2 * 160px Zeilen + 16px Gap)
- Breite: 2 Grid-Spalten

## Was der Entwickler kontrolliert

### Bei layout: "widget" (empfohlen fuer 2x2)
- Gesamter Tile-Inhalt via Widget-Komponente
- Glass-Card mit \`overflow-hidden rounded-xl\` ist gesetzt (alle grid items clip overflow)
- Widget in \`<div className="flex-1 flex flex-col min-h-0">\` gewrappt
- Context Menu bleibt (absolute positioned, vom System)
- Widget erhaelt \`size: "2x2"\` als Prop
- WidgetHeader fuer Kopfzeile verwenden (40px, border-bottom)
- Restlicher Platz: ~290px fuer Widget-Inhalt

### Bei layout: "detailed" (Fallback)
- Stats-Inhalte via \`fetchStats()\`
- System rendert: kompakte Kopfzeile (Icon 32px + Titel + Pin + Badge)
- Stats in 3-Spalten Grid (\`grid-cols-3\`, \`gap-x-4 gap-y-3\`)
- Jeder Stat: Label oben (text-[10px], uppercase, tracking-wide), Wert unten (text-base, font-bold)
- Automatischer Progress-Bar fuer Prozent-Werte (>85% rot, >70% gelb, sonst gruen)

## renderHints Format

\`\`\`typescript
// Widget Mode (empfohlen):
renderHints: {
  "2x2": {
    maxStats: 4,  // Stats werden dem Widget via props uebergeben
    layout: "widget",
    widgetComponent: "MeinServiceWidget",
  },
}

// Stats Grid (fuer einfachere Plugins):
renderHints: {
  "2x2": {
    maxStats: 6,
    layout: "detailed",
  },
}
\`\`\`

## Einschraenkungen

- **Canvas/SVG erlaubt** - Aber einfach halten, keine requestAnimationFrame Loops
- **CSS-Transitions bevorzugen** - Statt JS-Animationen
- **DOM-Baum flach halten** - Maximal ~50 Elemente im Widget
- **Keine Bilder > 100KB** - Performance-Regel
- **Widget MUSS 3 States handlen:**
  1. \`stats.status === "loading"\` -> Lade-Anzeige (Loader2 Spinner + "Laden...")
  2. \`stats.status === "error"\` -> Fehler-Anzeige (AlertCircle + Fehlermeldung)
  3. \`stats.status === "ok"\` -> Normaler Inhalt mit stats.items
- **KEINE eigenen API-Calls** - Alle Daten kommen ueber stats Prop
`,
  },

  decisionGuide: `
# Entscheidungshilfe: Welche Tile-Groesse verwenden?

## 1x1 (Klein) - Standard, immer der Startpunkt

Verwende 1x1 fuer:
- **Einfache Services mit 1-3 Schluesselmetriken**
- Beispiele:
  - Emby: Streams, Filme, Serien (Referenz-Plugin)
  - NAS-Service: Belegt %, Frei GB, Uptime
  - DNS-Blocker: Queries, Blocked %, Status
  - Download-Manager: Downloads, Geschwindigkeit
- Jedes Plugin MUSS mindestens 1x1 unterstuetzen

## 2x1 (Mittel) - Wenn 1x1 zu eng wird

Verwende 2x1 wenn:
- **Mehr als 3 wichtige Metriken** vorhanden sind
- **Mini-Visualisierungen** Mehrwert bieten (Progress-Bars, kleine Charts)
- **Kompakte Entity-Cards** sinnvoll sind (z.B. Sensoren nebeneinander)
- Der Service genuegend Daten liefert, um die doppelte Breite zu rechtfertigen
- Beispiele:
  - Emby: Medien-Karussell mit Cover-Bildern (Referenz-Widget)
  - Smart-Home: 4-6 Sensor-Cards kompakt nebeneinander
  - NAS-Service: Pool-Usage-Bars neben den Stats
  - Firewall: Regeln + Traffic in einer Zeile

## 2x2 (Gross) - Nur bei klarem visuellem Mehrwert

Verwende 2x2 wenn:
- **Komplexe Visualisierungen** noetig sind (Graphen, Listen, Karten)
- **Dashboard-in-Dashboard** Sinn ergibt
- **Entity-Grids** mit vielen Eintraegen dargestellt werden sollen
- Der Service genug Daten fuer den grossen Bereich liefert
- Beispiele:
  - Emby: Medien-Karussell mit Cover, Bewertungen, Beschreibungen (Referenz-Widget)
  - Smart-Home: Entity-Cards im Grid mit Icons und Farben
  - NAS-Service: Pool-Liste + Kreisdiagramm + Uptime-Visualisierung
  - Firewall: Interface-Stats + Traffic-Graph + Threat Map

## Mehrere Tiles gleichzeitig

Ein User kann von derselben App MEHRERE Tiles auf dem Dashboard anlegen —
z.B. eine 1x1-Tile fuer den Schnell-Ueberblick UND eine 2x2-Tile fuer das
detaillierte Widget. Jede Tile hat eigene Anzeige-Einstellungen.
**Deshalb: Alle supportedSizes muessen sauber funktionieren, sie werden parallel genutzt.**

## Goldene Regel

> **Starte immer mit 1x1.** Fuege groessere Groessen nur hinzu, wenn es
> einen klaren visuellen Mehrwert gibt. Ein Widget, das nur Stats in
> groesserer Schrift zeigt, ist KEIN Mehrwert - dafuer gibt es layout: "detailed".

## Entscheidungsbaum

\`\`\`
Hat der Service <= 3 Schluesselmetriken?
  +-- Ja --> Nur 1x1
  +-- Nein
       |
       Hat der Service visuelle Daten (Bars, Charts, Listen)?
         +-- Nein --> 1x1 + 2x1 (detailed Layout)
         +-- Ja
              |
              Braucht die Visualisierung viel Platz (> 160px)?
                +-- Nein --> 1x1 + 2x1 (widget Layout)
                +-- Ja ----> 1x1 + 2x1 + 2x2 (widget Layout)
\`\`\`
`,
} as const;
