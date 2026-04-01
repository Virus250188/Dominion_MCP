# Plugin Development Guide

Anleitung zum Entwickeln von Enhanced App Plugins fuer das Dominion Dashboard.

---

## Schnellstart

1. Ordner anlegen: `src/plugins/community/mein-plugin/`
2. `index.ts` mit Plugin-Definition schreiben
3. Optional: Widget-Komponente als `MeinPluginWidget.tsx` im selben Ordner
4. Server neustarten — Plugin wird automatisch erkannt

**Keine weiteren Dateien bearbeiten.** Kein `registry.ts`, kein `community/index.ts`, kein Build-Script.

---

## Ordnerstruktur

```
src/plugins/community/
  mein-plugin/
    index.ts              <- PFLICHT: Plugin-Definition + Auto-Discovery Exports
    MeinPluginWidget.tsx   <- OPTIONAL: Widget fuer 2x1/2x2 Tiles
```

Der Ordnername MUSS mit `metadata.id` uebereinstimmen (kebab-case).

---

## Pflicht-Exports (index.ts)

Jede `index.ts` MUSS genau diese drei Exports haben:

```typescript
import type { AppPlugin, PluginConfig, PluginStats } from "../../types";
import { getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions } from "../../utils";

// 1. Plugin-Definition (MUSS "plugin" heissen)
export const plugin: AppPlugin = {
  metadata: { ... },
  configFields: [ ... ],
  statOptions: [ ... ],
  supportedSizes: ["1x1"],
  renderHints: { ... },
  async fetchStats(config) { ... },
  async testConnection(config) { ... },
};

// 2. Widget-Komponente (null wenn kein Widget)
export const widget = null;

// 3. Widget-Name (null wenn kein Widget)
export const widgetName = null;
```

---

## Vollstaendiges Beispiel

```typescript
import type { AppPlugin, PluginConfig, PluginStats, StatItem } from "../../types";
import { getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions } from "../../utils";

export const plugin: AppPlugin = {
  metadata: {
    id: "opnsense",                    // = Ordnername, lowercase
    name: "OPNsense",                  // Anzeigename
    icon: "Opnsense",                  // simple-icons Slug (simpleicons.org)
    color: "#D94F00",                  // Markenfarbe (#XXXXXX)
    description: "Firewall Status und Interface Traffic",  // Deutsch!
    category: "Network",               // Siehe Kategorien unten
    website: "https://opnsense.org",
  },

  configFields: [
    {
      key: "apiUrl",
      label: "OPNsense URL",
      type: "url",
      placeholder: "https://opnsense.local",
      required: true,
      description: "Die URL deiner OPNsense Instanz",
    },
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      required: true,
      description: "Erstelle einen API Key unter System -> Zugang -> Benutzer",
    },
    {
      key: "apiSecret",
      label: "API Secret",
      type: "password",
      required: true,
      description: "Das zugehoerige API Secret",
    },
  ],

  statOptions: [
    {
      key: "cpu",
      label: "CPU Auslastung",
      description: "Aktuelle CPU Last in Prozent",
      defaultEnabled: true,
    },
    {
      key: "memory",
      label: "RAM Auslastung",
      description: "Genutzter Arbeitsspeicher",
      defaultEnabled: true,
    },
    {
      key: "wanStatus",
      label: "WAN Status",
      description: "Status der WAN-Schnittstelle",
      defaultEnabled: true,
    },
    {
      key: "activeConnections",
      label: "Aktive Verbindungen",
      description: "Anzahl aktiver Firewall-Verbindungen",
      defaultEnabled: false,
    },
  ],

  supportedSizes: ["1x1", "2x1"],

  renderHints: {
    "1x1": { maxStats: 3, layout: "compact" },
    "2x1": { maxStats: 6, layout: "detailed" },
  },

  async fetchStats(config: PluginConfig): Promise<PluginStats> {
    try {
      const visibleStats = getVisibleStats(config, this.statOptions);
      const baseUrl = normalizeUrl(config.apiUrl);
      const apiKey = String(config.apiKey || "");
      const apiSecret = String(config.apiSecret || "");

      const auth = btoa(`${apiKey}:${apiSecret}`);
      const headers: HeadersInit = { Authorization: `Basic ${auth}` };
      const fetchOpts = { ...createFetchOptions(8000), headers };

      // Mehrere Endpoints parallel abfragen
      const [sysRes, actRes] = await Promise.all([
        fetch(`${baseUrl}/api/diagnostics/system/systemResources`, fetchOpts),
        fetch(`${baseUrl}/api/diagnostics/firewall/pf_states`, fetchOpts),
      ]);

      const items: StatItem[] = [];

      if (sysRes.ok) {
        const sys = await sysRes.json();

        if (visibleStats.includes("cpu")) {
          const cpuVal = Math.round(Number(sys.cpu?.used || 0));
          items.push({
            label: "CPU",
            value: `${cpuVal}%`,
            color: cpuVal > 85 ? "red" : cpuVal > 70 ? "yellow" : "green",
          });
        }

        if (visibleStats.includes("memory")) {
          const memVal = Math.round(Number(sys.memory?.used || 0));
          items.push({
            label: "RAM",
            value: `${memVal}%`,
            color: memVal > 85 ? "red" : memVal > 70 ? "yellow" : "green",
          });
        }

        if (visibleStats.includes("wanStatus")) {
          items.push({
            label: "WAN",
            value: "Online",
            color: "green",
          });
        }
      }

      if (visibleStats.includes("activeConnections") && actRes.ok) {
        const states = await actRes.json();
        items.push({
          label: "Verbindungen",
          value: Number(states.total || 0),
        });
      }

      return { items, status: "ok" };
    } catch (err) {
      return createErrorResponse(err);
    }
  },

  async testConnection(config: PluginConfig): Promise<{ ok: boolean; message: string }> {
    try {
      const baseUrl = normalizeUrl(config.apiUrl);
      const auth = btoa(`${String(config.apiKey || "")}:${String(config.apiSecret || "")}`);

      const res = await fetch(`${baseUrl}/api/core/firmware/status`, {
        ...createFetchOptions(),
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!res.ok) {
        return { ok: false, message: `HTTP ${res.status}: Zugriff verweigert` };
      }

      const data = await res.json();
      return {
        ok: true,
        message: `Verbunden mit OPNsense (${data.product_version || "OK"})`,
      };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  },
};

// Auto-Discovery Exports
export const widget = null;
export const widgetName = null;
```

---

## Tile-Groessen

| Groesse | Grid | Hoehe | Max Stats | Layout | Widget |
|---------|------|-------|-----------|--------|--------|
| **1x1** | 1x1 | 160px | 3 | compact | Nein |
| **2x1** | 2x1 | 160px | 6 | detailed oder widget | Optional |
| **2x2** | 2x2 | 336px | 6 | widget (empfohlen) | Ja |

### 1x1 (Klein) — Info-Kachel

```
+----------------------------------+
|  [Icon]  "App Name"              |
|                                  |
|   Stat1    Stat2    Stat3        |  <- max 3 Stats
+----------------------------------+
```

- Nur Text und Zahlen, kein Widget
- Jedes Plugin MUSS mindestens 1x1 unterstuetzen

### 2x1 (Mittel) — Erweiterte Info oder Mini-Widget

**Info-Modus** (`layout: "detailed"`):
```
+------------------------------------------------------------------+
|  [Icon]  "App Name"     Stat1  Stat2  Stat3  Stat4  Stat5  Stat6 |
+------------------------------------------------------------------+
```

**Widget-Modus** (`layout: "widget"`):
```
+------------------------------------------------------------------+
| [WidgetHeader: Icon + Titel + Status]                            |
| [Widget-Inhalt: ~112px verfuegbar]                               |
+------------------------------------------------------------------+
```

### 2x2 (Gross) — Volles Widget

```
+------------------------------------------------------------------+
| [WidgetHeader: Icon + Titel + Status]                            |
|                                                                  |
| [Widget-Inhalt: ~290px verfuegbar]                               |
|                                                                  |
|  z.B. Charts, Listen, Karten, Grids                             |
+------------------------------------------------------------------+
```

### renderHints Konfiguration

```typescript
renderHints: {
  // 1x1: Immer compact, kein Widget
  "1x1": { maxStats: 3, layout: "compact" },

  // 2x1 ohne Widget: Bis zu 6 Stats horizontal
  "2x1": { maxStats: 6, layout: "detailed" },

  // 2x1 mit Widget: Eigene Komponente
  "2x1": { maxStats: 6, layout: "widget", widgetComponent: "MeinWidget" },

  // 2x2: Widget empfohlen
  "2x2": { maxStats: 4, layout: "widget", widgetComponent: "MeinWidget" },
}
```

---

## Widget-Komponente

Widgets liegen im Plugin-Ordner: `community/mein-plugin/MeinPluginWidget.tsx`

```tsx
"use client";

import type { WidgetProps } from "@/components/widgets/registry";
import { WidgetHeader } from "@/components/widgets/shared/WidgetHeader";

function MeinPluginWidget2x1({ stats }: WidgetProps) {
  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon="Activity"
        iconColor="#D94F00"
        title="Mein Service"
        status={stats.status === "ok" ? "online" : "offline"}
      />
      <div className="flex-1 p-3">
        {/* Widget-Inhalt (~112px verfuegbar) */}
      </div>
    </div>
  );
}

function MeinPluginWidget2x2({ stats }: WidgetProps) {
  // Reichhaltige Daten aus widgetData lesen
  const data = stats.widgetData as { items?: unknown[] } | undefined;

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon="Activity"
        iconColor="#D94F00"
        title="Mein Service"
        subtitle="Dashboard"
        status={stats.status === "ok" ? "online" : "offline"}
      />
      <div className="flex-1 p-3">
        {/* Widget-Inhalt (~290px verfuegbar) */}
      </div>
    </div>
  );
}

export function MeinPluginWidget(props: WidgetProps) {
  // Loading
  if (props.stats.status === "loading") {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Laden...
      </div>
    );
  }

  // Error
  if (props.stats.status === "error") {
    return (
      <div className="flex items-center justify-center h-full text-sm text-red-400">
        {props.stats.error || "Fehler"}
      </div>
    );
  }

  // Route nach Groesse
  if (props.size === "2x2") return <MeinPluginWidget2x2 {...props} />;
  return <MeinPluginWidget2x1 {...props} />;
}
```

### Widget in index.ts registrieren

```typescript
import { MeinPluginWidget } from "./MeinPluginWidget";

export const plugin: AppPlugin = {
  // ...
  renderHints: {
    "1x1": { maxStats: 3, layout: "compact" },
    "2x1": { maxStats: 6, layout: "widget", widgetComponent: "MeinPluginWidget" },
    "2x2": { maxStats: 4, layout: "widget", widgetComponent: "MeinPluginWidget" },
  },
  // ...
};

export const widget = MeinPluginWidget;
export const widgetName = "MeinPluginWidget";
```

### widgetData fuer reichhaltige Daten

Wenn dein Widget mehr als Stats braucht (Bilder, Listen, etc.), nutze `widgetData` in `fetchStats`:

```typescript
async fetchStats(config: PluginConfig): Promise<PluginStats> {
  // ... API-Calls ...

  return {
    items,
    status: "ok",
    widgetData: {
      interfaces: [
        { name: "WAN", traffic: 125000, status: "up" },
        { name: "LAN", traffic: 89000, status: "up" },
      ],
      threatCount: 42,
    },
  };
}
```

Im Widget liest du die Daten so:

```typescript
const data = stats.widgetData as {
  interfaces?: Array<{ name: string; traffic: number; status: string }>;
  threatCount?: number;
} | undefined;
```

`widgetData` wird NICHT vom Validator gefiltert — du hast volle Freiheit was du dort reinpackst.

---

## fetchStats — Daten liefern

`fetchStats` wird alle 30 Sekunden vom Server aufgerufen. Du holst Daten von deiner API und gibst sie als `PluginStats` zurueck.

### Rueckgabe-Format

```typescript
interface PluginStats {
  items: StatItem[];                    // Max 6 (Validator schneidet ab)
  status: "ok" | "error";
  error?: string;                       // Deutsch! z.B. "Verbindung fehlgeschlagen"
  widgetData?: Record<string, unknown>; // Freie Daten fuer Widget
}

interface StatItem {
  label: string;          // Deutsch! z.B. "CPU", "Streams", "Uptime"
  value: string | number; // z.B. "72%", 42, "3d 12h"
  unit?: string;          // z.B. "GB", "%", "MB/s"
  icon?: string;          // Lucide-Icon Name (optional)
  color?: string;         // "green" | "red" | "yellow" | "blue"
}
```

### Regeln

1. **Immer try/catch** — `fetchStats` darf NIEMALS eine Exception werfen
2. **Shared Utilities nutzen** — `getVisibleStats`, `normalizeUrl`, `createFetchOptions`, `createErrorResponse`
3. **visibleStats respektieren** — Nur vom User aktivierte Stats zurueckgeben
4. **Promise.all()** — Mehrere Endpoints parallel abfragen
5. **Reihenfolge = Prioritaet** — Wichtigste Stats zuerst
6. **Deutsche Labels** — Alle Labels und Fehlermeldungen auf Deutsch

### Farb-Konventionen

| Farbe | Bedeutung | Beispiel |
|-------|-----------|---------|
| `green` | Gut, aktiv, niedrig | CPU < 70%, Online, 0 Fehler |
| `yellow` | Warnung, mittel | CPU 70-85%, Wartung |
| `red` | Schlecht, hoch, Fehler | CPU > 85%, Offline |
| `blue` | Informativ, neutral | Temperatur, Version |

---

## testConnection — Verbindung pruefen

Wird aufgerufen wenn der User im TileDialog "Verbindung testen" klickt.

```typescript
async testConnection(config: PluginConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const baseUrl = normalizeUrl(config.apiUrl);
    const res = await fetch(`${baseUrl}/api/status`, {
      ...createFetchOptions(),
      headers: { "X-API-Key": String(config.apiKey || "") },
    });

    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status}: Zugriff verweigert` };
    }

    const data = await res.json();
    return { ok: true, message: `Verbunden mit ${data.name || "Service"}` };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
```

Waehle einen **leichtgewichtigen Endpoint** (z.B. `/api/status`, `/system/info`), nicht einen der alle Daten laedt.

---

## configFields — Konfigurationsfelder

Definieren welche Eingabefelder der User im TileDialog sieht.

| Typ | Einsatz | Beispiel |
|-----|---------|---------|
| `"url"` | Server-URLs | `http://service.local:8080` |
| `"password"` | API Keys, Secrets | Wird maskiert angezeigt |
| `"text"` | Benutzernamen, IDs | Klartext |
| `"select"` | Dropdown-Auswahl | Protokoll, Kategorie |
| `"number"` | Zahlen | Port, Intervall |
| `"textarea"` | Mehrzeilige Eingabe | Entity-Listen |

### Typische Muster

**URL + API Key** (am haeufigsten):
```typescript
configFields: [
  { key: "apiUrl", label: "Server URL", type: "url", required: true, placeholder: "http://service.local:8080" },
  { key: "apiKey", label: "API Key", type: "password", required: true },
]
```

**URL + Access Token**:
```typescript
configFields: [
  { key: "apiUrl", label: "Server URL", type: "url", required: true },
  { key: "accessToken", label: "Access Token", type: "password", required: true },
]
```

**Mit Feature-Feldern** (fuer Widget-Optionen):
```typescript
configFields: [
  { key: "apiUrl", label: "Server URL", type: "url", required: true },
  { key: "apiKey", label: "API Key", type: "password", required: true },
  // Feature-Felder erscheinen nach erfolgreichem Verbindungstest:
  {
    key: "updateInterval",
    label: "Aktualisierung",
    type: "select",
    options: [
      { label: "Normal (5s)", value: "5000" },
      { label: "Langsam (10s)", value: "10000" },
    ],
  },
]
```

---

## Shared Utilities

Importiere aus `../../utils` — schreibe keine eigenen Helfer dafuer:

```typescript
import {
  getVisibleStats,     // Filtert Stats nach User-Auswahl
  normalizeUrl,        // Entfernt Trailing Slash von URLs
  createErrorResponse, // Baut PluginStats Error-Objekt
  createFetchOptions,  // Fetch-Optionen mit AbortSignal.timeout
  formatBytes,         // 1024000 -> "1.0 MB"
  formatUptime,        // 90061 -> "1d 1h"
} from "../../utils";
```

---

## Shared Widget-Komponenten

Verfuegbar in `@/components/widgets/shared/`:

| Komponente | Beschreibung |
|-----------|-------------|
| `WidgetHeader` | Kopfzeile mit Status-Punkt, Icon, Titel, Subtitle |
| `CircularProgress` | Kreisfoermiger Fortschrittsbalken |
| `SparklineChart` | Mini-Liniendiagramm |
| `HorizontalProgressBar` | Horizontaler Fortschrittsbalken |
| `ControlButton` | Aktions-Button fuer Widgets |

---

## Kategorien

Erlaubte Werte fuer `metadata.category`:

| Kategorie | Beispiele |
|-----------|----------|
| `Storage` | NAS, Backup |
| `Media` | Emby, Plex, Jellyfin |
| `Network` | Firewall, DNS, VPN |
| `Automation` | Smart Home |
| `System` | Server-Monitoring |
| `Monitoring` | Grafana, Uptime |
| `Downloads` | Download-Manager |
| `Security` | Passwort-Manager, Auth |
| `Productivity` | Kalender, Notizen |
| `Development` | CI/CD, Git |
| `Custom` | Alles andere |

---

## Checkliste

### Plugin-Datei
- [ ] Ordner: `src/plugins/community/{id}/`
- [ ] `export const plugin: AppPlugin` (genau "plugin")
- [ ] `export const widget` (Komponente oder null)
- [ ] `export const widgetName` (String oder null)
- [ ] `metadata.id` = Ordnername (kebab-case)
- [ ] `metadata.icon` auf simpleicons.org pruefen
- [ ] `metadata.color` als #XXXXXX
- [ ] Alle Labels und Beschreibungen auf Deutsch
- [ ] `supportedSizes` enthaelt mindestens `"1x1"`
- [ ] `renderHints` fuer jede unterstuetzte Groesse

### fetchStats
- [ ] try/catch (darf nicht werfen)
- [ ] Shared Utilities verwendet
- [ ] `visibleStats` respektiert
- [ ] Deutsche Labels
- [ ] Farben nach Konvention

### testConnection
- [ ] try/catch
- [ ] Leichtgewichtiger Endpoint
- [ ] Deutsche Erfolgs-/Fehlermeldungen

### Widget (falls vorhanden)
- [ ] `"use client"` Direktive
- [ ] 3 States: loading, error, ok
- [ ] WidgetHeader fuer konsistente Kopfzeile
- [ ] Keine eigenen API-Calls (nur stats Prop)
- [ ] DOM-Baum flach (< 50 Elemente)

### Testen
- [ ] Server neustarten — Plugin erscheint
- [ ] Verbindungstest funktioniert
- [ ] Stats in 1x1 korrekt
- [ ] Widget rendert (falls vorhanden)

---

## Referenz-Plugin

Das **Emby Plugin** (`src/plugins/builtin/emby/`) ist die vollstaendige Referenz-Implementation mit:
- Alle drei Tile-Groessen (1x1, 2x1, 2x2)
- Widget mit Medien-Karussell
- widgetData fuer Cover-Bilder
- Feature-Felder (Karussell-Geschwindigkeit, Medien-Kategorie)

Schau dir den Code an wenn du ein komplexes Beispiel brauchst.
