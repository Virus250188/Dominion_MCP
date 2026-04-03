# Migration Guide: Plugin auf neue Konvention umstellen

Dieses Dokument beschreibt wie bestehende Plugins auf die neue Auto-Discovery Konvention umgestellt werden.

---

## Was hat sich geaendert?

### Alte Konvention (VERALTET)
```
mein-plugin/
  api/
    auth/route.ts           <- Eigene API-Routes (VERBOTEN)
    callback/route.ts
    status/route.ts
    action/route.ts
  plugin/
    index.ts                <- export const meinPluginPlugin: AppPlugin
    spotify-api.ts          <- Separate API-Utilities
    types.ts                <- Separate Typen
  widget/
    MeinWidget.tsx           <- Widget in separatem Ordner
```

### Neue Konvention (AKTUELL)
```
mein-plugin/
  index.ts                  <- export const plugin: AppPlugin + widget/widgetName Exports
  MeinPluginWidget.tsx       <- Widget im GLEICHEN Ordner (optional)
```

---

## Checkliste fuer die Migration

### 1. Ordnerstruktur vereinfachen

- [ ] Alle Dateien in EINEN Ordner zusammenfuehren
- [ ] Keine Unterordner (`api/`, `plugin/`, `widget/`)
- [ ] Ordnername = `metadata.id` (kebab-case)

### 2. API-Routes entfernen

- [ ] ALLE `api/` Ordner und `route.ts` Dateien loeschen
- [ ] Keine eigenen API-Endpunkte — das System hat nur drei:
  - `GET /api/enhanced/[appId]` -> ruft `fetchStats()` auf
  - `POST /api/enhanced/test` -> ruft `testConnection()` auf
  - `POST /api/enhanced/crawl` -> ruft `crawlEntities()` auf
- [ ] OAuth/Auth-Flows entfernen — Benutzer traegt API Key / Access Token manuell ein

### 3. Exports standardisieren

**VORHER:**
```typescript
export const spotifyPlugin: AppPlugin = { ... };
```

**NACHHER:**
```typescript
// ALLE DREI EXPORTS SIND PFLICHT:
export const plugin: AppPlugin = { ... };
export const widget = SpotifyWidget;     // oder null
export const widgetName = "SpotifyWidget"; // oder null
```

### 4. API-Logik in fetchStats integrieren

**VORHER:** Separate API-Utility-Dateien + Route-Handler
```typescript
// spotify-api.ts
export async function getPlaybackState(token: string) { ... }
export async function getTokens(connectionId: number) { ... }

// api/status/route.ts
export async function GET(req: NextRequest) {
  const tokens = await getTokens(connectionId);
  const state = await getPlaybackState(tokens.accessToken);
  return NextResponse.json(state);
}
```

**NACHHER:** Alles direkt in fetchStats
```typescript
export const plugin: AppPlugin = {
  // ...
  async fetchStats(config: PluginConfig): Promise<PluginStats> {
    try {
      const visibleStats = getVisibleStats(config, this.statOptions);
      const baseUrl = normalizeUrl(config.apiUrl);
      const token = String(config.accessToken || "");

      const res = await fetch(`${baseUrl}/api/endpoint`, {
        ...createFetchOptions(),
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        return { items: [], status: "error", error: `HTTP ${res.status}` };
      }

      const data = await res.json();
      const items = [];

      if (visibleStats.includes("meineMetrik")) {
        items.push({ label: "Meine Metrik", value: data.value });
      }

      return {
        items,
        status: "ok",
        widgetData: { /* Daten fuer Widget */ },
      };
    } catch (err) {
      return createErrorResponse(err);
    }
  },
};
```

### 5. Widget in den Plugin-Ordner verschieben

**VORHER:**
```
src/components/widgets/spotify/SpotifyWidget.tsx
```

**NACHHER:**
```
src/plugins/community/spotify/SpotifyWidget.tsx
```

- Widget-Datei in den Plugin-Ordner verschieben
- Import-Pfade anpassen:
  ```typescript
  // WidgetHeader Import bleibt gleich:
  import { WidgetHeader } from "@/components/widgets/shared/WidgetHeader";
  ```

### 6. Separate Typen-Dateien entfernen

- [ ] Typen direkt in `index.ts` definieren (wenn wenige)
- [ ] Oder als `types.ts` im gleichen Ordner behalten (wenn viele)
- [ ] Keine Typen-Dateien ausserhalb des Plugin-Ordners

### 7. Shared Utilities verwenden

```typescript
// PFLICHT-Imports:
import type { AppPlugin, PluginConfig, PluginStats } from "../../types";
import { getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions } from "../../utils";

// OPTIONAL:
import { formatBytes, formatUptime } from "../../utils";
```

### 8. Keine .env Aenderungen

- [ ] Keine `.env.example` Dateien erstellen
- [ ] Keine Umgebungsvariablen voraussetzen
- [ ] API Keys kommen ueber `configFields` vom Benutzer, nicht aus .env

---

## Haeufige Fehler bei der Migration

### OAuth/Auth-Flows

**Problem:** Plugin implementiert OAuth mit eigenen Routes (auth, callback).

**Loesung:** Das Framework bietet einen eingebauten OAuth-Flow.
Statt eigene Routes: `type: "oauth"` ConfigField deklarieren und
`exchangeToken()` + `refreshToken()` implementieren. Das Framework
handhabt Redirect, Callback, Token-Speicherung und automatischen Refresh.

```typescript
configFields: [
  { key: "clientId", label: "Client ID", type: "text", required: true },
  { key: "clientSecret", label: "Client Secret", type: "password", required: true },
  {
    key: "oauth",
    label: "Verbinden",
    type: "oauth",
    oauth: { authUrl: "...", tokenUrl: "...", scopes: ["..."] },
  },
]
```

### Player-Controls / Aktionen

**Problem:** Plugin hat einen Action-Endpoint fuer Play/Pause/Skip etc.

**Loesung:** Interaktive Aktionen sind derzeit nicht im Plugin-System
vorgesehen. Das Widget zeigt nur Daten an (read-only). Zukuenftige Updates
koennten `onAction` Callbacks ermoeglichen, aber aktuell nicht implementiert.

### Mehrere Dateien / komplexe Struktur

**Problem:** Plugin hat viele Dateien (api-utils.ts, types.ts, helpers.ts etc.)

**Loesung:** Alles in `index.ts` konsolidieren. Ein Plugin sollte schlank sein
(< 200 Zeilen fuer einfache, < 400 fuer komplexe Plugins). Wenn Typen noetig
sind, duerfen sie als separate `types.ts` im gleichen Ordner liegen.

---

## Validierung nach der Migration

Nutze die MCP Validation Tools um dein migriertes Plugin zu pruefen:

1. `validate_plugin_structure` — Prueft Plugin-Code gegen Framework-Regeln
2. `test_plugin_export` — Prueft ob alle Exports korrekt sind
3. `validate_stats_output` — Prueft das fetchStats Rueckgabe-Format
4. `validate_render_hints` — Prueft renderHints Konfiguration

### Erwartetes Ergebnis nach Migration

```
src/plugins/community/mein-plugin/
  index.ts               <- export const plugin + widget + widgetName
  MeinPluginWidget.tsx    <- (optional) Widget-Komponente
```

Sonst nichts. Kein api/ Ordner, kein plugin/ Unterordner, kein widget/ Unterordner.
