import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { success, error } from "./_response.js";

// ─── Scaffold Tools ───────────────────────────────────────────────────────
// Code generation tools that produce ready-to-use plugin files, widget
// components, and registration instructions for the Dominion Dashboard.

// ─── Helpers ──────────────────────────────────────────────────────────────

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c: string | undefined) =>
      c ? c.toUpperCase() : "",
    )
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
}

/** Escape strings before embedding in template literals to prevent code injection */
function sanitize(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

interface ConfigFieldInput {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  description?: string;
}

interface StatOptionInput {
  key: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

function generateRenderHints(
  supportedSizes: string[],
  hasWidget: boolean,
  pascalName: string,
): string {
  const hints: string[] = [];

  if (supportedSizes.includes("1x1")) {
    hints.push(`    "1x1": { maxStats: 3, layout: "compact" }`);
  }

  if (supportedSizes.includes("2x1")) {
    if (hasWidget) {
      hints.push(
        `    "2x1": { maxStats: 6, layout: "widget", widgetComponent: "${pascalName}Widget" }`,
      );
    } else {
      hints.push(`    "2x1": { maxStats: 6, layout: "detailed" }`);
    }
  }

  if (supportedSizes.includes("2x2")) {
    if (hasWidget) {
      hints.push(
        `    "2x2": { maxStats: 4, layout: "widget", widgetComponent: "${pascalName}Widget" }`,
      );
    } else {
      hints.push(`    "2x2": { maxStats: 6, layout: "detailed" }`);
    }
  }

  return hints.join(",\n");
}

function generateConfigFields(fields: ConfigFieldInput[]): string {
  return fields
    .map((f) => {
      const lines = [
        `    {`,
        `      key: "${sanitize(f.key)}",`,
        `      label: "${sanitize(f.label)}",`,
        `      type: "${sanitize(f.type)}",`,
      ];
      if (f.required) lines.push(`      required: true,`);
      if (f.placeholder) lines.push(`      placeholder: "${sanitize(f.placeholder)}",`);
      if (f.description) lines.push(`      description: "${sanitize(f.description)}",`);
      lines.push(`    }`);
      return lines.join("\n");
    })
    .join(",\n");
}

function generateStatOptions(options: StatOptionInput[]): string {
  return options
    .map(
      (o) =>
        `    {\n      key: "${sanitize(o.key)}",\n      label: "${sanitize(o.label)}",\n      description: "${sanitize(o.description)}",\n      defaultEnabled: ${o.defaultEnabled},\n    }`,
    )
    .join(",\n");
}

function generateManifest(params: {
  id: string;
  name: string;
  description: string;
  author: string;
  hasWidget: boolean;
  widgetName?: string;
}): string {
  const manifest: Record<string, unknown> = {
    id: params.id,
    name: params.name,
    version: "1.0.0",
    author: params.author,
    description: params.description,
  };
  if (params.hasWidget && params.widgetName) {
    manifest.hasWidget = true;
    manifest.widgetFile = `${params.widgetName}.tsx`;
  }
  return JSON.stringify(manifest, null, 2);
}

function generatePluginCode(params: {
  id: string;
  name: string;
  description: string;
  category: string;
  configFields: ConfigFieldInput[];
  statOptions: StatOptionInput[];
  supportedSizes: string[];
  hasCrawler: boolean;
  hasWidget: boolean;
  hasOAuth: boolean;
}): string {
  const {
    id,
    name,
    description,
    category,
    configFields,
    statOptions,
    supportedSizes,
    hasCrawler,
    hasWidget,
    hasOAuth,
  } = params;

  const pascalName = toPascalCase(name.replace(/\s+/g, ""));

  const visibleStatsConditions = statOptions
    .map(
      (opt) =>
        `    if (visibleStats.includes("${opt.key}")) {\n      // TODO: Wert von der API holen\n      items.push({ label: "${opt.label}", value: 0 });\n    }`,
    )
    .join("\n\n");

  const crawlerSection = hasCrawler
    ? `

  async crawlEntities(config: PluginConfig) {
    const baseUrl = normalizeUrl(config.apiUrl);
    const headers: Record<string, string> = {
      // TODO: Auth-Header anpassen
      Authorization: \`Bearer \${String(config.accessToken || config.apiKey || "")}\`,
    };

    const res = await fetch(\`\${baseUrl}/api/entities\`, {
      ...createFetchOptions(10000),
      headers,
    });
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);

    const data: Array<{ id: string; name: string; status: string }> = await res.json();

    // TODO: Entities nach Domain/Typ gruppieren
    const groups = [
      {
        domain: "default",
        label: "Alle",
        icon: "Activity",
        entities: data.map((item) => ({
          id: item.id,
          name: item.name,
          state: item.status,
        })),
      },
    ];

    return { groups };
  },`
    : "";

  const selectedEntitiesBlock = hasCrawler
    ? `
    // Entity-Auswahl parsen (selectedEntities + Legacy entityIds)
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
      } catch {
        // Fallback auf Legacy-Format
      }
    }
    if (entityEntries.length === 0 && config.entityIds) {
      entityEntries = String(config.entityIds)
        .split(/[\\n,]/)
        .map((entry: string) => entry.trim())
        .filter(Boolean)
        .map((entry: string) => {
          const colonIdx = entry.indexOf(":");
          if (colonIdx > 0) {
            return { id: entry.substring(0, colonIdx).trim(), customLabel: entry.substring(colonIdx + 1).trim() || undefined };
          }
          return { id: entry };
        });
    }

    // TODO: Wenn entityEntries vorhanden, spezifische Entities abfragen
`
    : "";

  const oauthSection = hasOAuth
    ? `

  // OAuth Token URL: Ersetze mit dem Token-Endpoint des Anbieters.
  // Beispiele:
  //   Spotify: "https://accounts.spotify.com/api/token"
  //   GitHub:  "https://github.com/login/oauth/access_token"
  //   Google:  "https://oauth2.googleapis.com/token"
  async exchangeToken(code: string, redirectUri: string, config: PluginConfig) {
    const tokenUrl = "TODO_TOKEN_URL"; // <-- Hier die Token-URL des Anbieters einsetzen
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: String(config.clientId || ""),
        client_secret: String(config.clientSecret || ""),
      }),
    });
    if (!res.ok) throw new Error(\`Token exchange failed: HTTP \${res.status}\`);
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    };
  },

  async refreshToken(config: PluginConfig) {
    const tokenUrl = "TODO_TOKEN_URL"; // <-- Gleiche Token-URL wie oben
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: String(config.refreshToken || ""),
        client_id: String(config.clientId || ""),
        client_secret: String(config.clientSecret || ""),
      }),
    });
    if (!res.ok) throw new Error(\`Token refresh failed: HTTP \${res.status}\`);
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? String(config.refreshToken),
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    };
  },`
    : "";

  const widgetImportLine = hasWidget
    ? `import { ${pascalName}Widget } from "./${pascalName}Widget";\n`
    : "";

  const widgetExports = hasWidget
    ? `\n// PFLICHT fuer Auto-Discovery:\nexport const widget = ${pascalName}Widget;\nexport const widgetName = "${pascalName}Widget";\n`
    : `\n// PFLICHT fuer Auto-Discovery:\nexport const widget = null;\nexport const widgetName = null;\n`;

  return `import type { AppPlugin, PluginConfig, PluginStats, StatItem } from "../../types";
import { getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions } from "../../utils";
${widgetImportLine}
export const plugin: AppPlugin = {
  metadata: {
    id: "${sanitize(id)}",
    name: "${sanitize(name)}",
    icon: "${toPascalCase(name.replace(/\s+/g, ""))}",
    color: "#000000", // TODO: Markenfarbe von simpleicons.org
    description: "${sanitize(description)}",
    category: "${sanitize(category)}",
    website: "https://example.com", // TODO: Offizielle Website
  },

  configFields: [
${generateConfigFields(configFields)}
  ],

  statOptions: [
${generateStatOptions(statOptions)}
  ],

  supportedSizes: [${supportedSizes.map((s) => `"${s}"`).join(", ")}],

  renderHints: {
${generateRenderHints(supportedSizes, hasWidget, pascalName)}
  },

  async fetchStats(config: PluginConfig): Promise<PluginStats> {
    try {
      const visibleStats = getVisibleStats(config, this.statOptions);
      const baseUrl = normalizeUrl(config.apiUrl);
      const headers: Record<string, string> = {
        // TODO: Auth-Header anpassen (z.B. X-API-Key, Authorization Bearer, etc.)
        "Authorization": String(config.apiKey || config.accessToken || ""),
      };
${selectedEntitiesBlock}
      // TODO: API-Endpoints abfragen
      const res = await fetch(\`\${baseUrl}/api/status\`, {
        ...createFetchOptions(),
        headers,
      });

      if (!res.ok) {
        return { items: [], status: "error", error: \`HTTP \${res.status}\` };
      }

      // const data = await res.json();

      const items: StatItem[] = [];

${visibleStatsConditions}

      // Optional: widgetData fuer reichhaltige Widget-Daten (Cover-Bilder, Listen, etc.)
      // Nur noetig wenn ein Widget mehr als Stats braucht.
      // const widgetData = {
      //   recentItems: [...],
      //   // Config-Werte fuer das Widget durchreichen:
      //   // someConfigValue: parseInt(String(config.someField || "5"), 10),
      // };

      return { items, status: "ok" /* , widgetData */ };
    } catch (err) {
      return createErrorResponse(err);
    }
  },

  async testConnection(
    config: PluginConfig,
  ): Promise<{ ok: boolean; message: string }> {
    try {
      const baseUrl = normalizeUrl(config.apiUrl);
      const res = await fetch(\`\${baseUrl}/api/status\`, {
        ...createFetchOptions(),
        headers: {
          // TODO: Auth-Header anpassen
          "Authorization": String(config.apiKey || config.accessToken || ""),
        },
      });

      if (!res.ok) {
        return { ok: false, message: \`HTTP \${res.status}: Zugriff verweigert\` };
      }

      const data = await res.json();
      return {
        ok: true,
        message: \`Verbunden mit ${name} (\${data.version || "OK"})\`,
      };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  },${crawlerSection}${oauthSection}
};
${widgetExports}`;
}

function generateWidgetCode(params: {
  pluginId: string;
  pluginName: string;
  color: string;
  icon: string;
  sizes: string[];
}): string {
  const { pluginId, pluginName, color, icon, sizes } = params;
  const pascalName = toPascalCase(pluginName.replace(/\s+/g, ""));
  const widgetName = `${pascalName}Widget`;

  const has2x1 = sizes.includes("2x1");
  const has2x2 = sizes.includes("2x2");

  const subComponents: string[] = [];

  if (has2x1) {
    subComponents.push(`
function ${widgetName}2x1({ stats }: WidgetProps) {
  const items = stats.items.slice(0, 6);
  // Read rich widget data (if plugin provides it via fetchStats widgetData):
  // const widgetData = stats.widgetData as { recentItems?: unknown[] } | undefined;

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon="${icon}"
        iconColor="${color}"
        title="${pluginName}"
        status={stats.status === "ok" ? "online" : stats.status === "error" ? "offline" : "unknown"}
      />
      <div className="flex-1 p-3">
        {items.length > 0 ? (
          <div className="flex items-center gap-4 h-full">
            {items.map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-sm font-bold tabular-nums text-foreground">
                  {item.value}
                  {item.unit && (
                    <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                      {item.unit}
                    </span>
                  )}
                </span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Keine Daten
          </div>
        )}
      </div>
    </div>
  );
}`);
  }

  if (has2x2) {
    subComponents.push(`
function ${widgetName}2x2({ stats }: WidgetProps) {
  const items = stats.items.slice(0, 4);
  // Read rich widget data (if plugin provides it via fetchStats widgetData):
  // const widgetData = stats.widgetData as { recentItems?: unknown[] } | undefined;

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon="${icon}"
        iconColor="${color}"
        title="${pluginName}"
        subtitle="Dashboard"
        status={stats.status === "ok" ? "online" : stats.status === "error" ? "offline" : "unknown"}
      />
      <div className="flex-1 p-3">
        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 h-full">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center gap-1.5 rounded-lg bg-muted/20 p-3"
              >
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {item.value}
                  {item.unit && (
                    <span className="text-xs font-normal text-muted-foreground ml-0.5">
                      {item.unit}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </span>
              </div>
            ))}
            {/* Leere Slots fuellen */}
            {items.length < 4 &&
              Array.from({ length: 4 - items.length }).map((_, i) => (
                <div
                  key={\`empty-\${i}\`}
                  className="rounded-lg bg-muted/10"
                />
              ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Keine Daten
          </div>
        )}
      </div>
    </div>
  );
}`);
  }

  const sizeRouting = has2x2
    ? `  if (props.size === "2x2") return <${widgetName}2x2 {...props} />;
  return <${widgetName}${has2x1 ? "2x1" : "2x2"} {...props} />;`
    : `  return <${widgetName}2x1 {...props} />;`;

  return `"use client";

import type { WidgetProps } from "../registry";
import { WidgetHeader } from "../shared/WidgetHeader";
${subComponents.join("\n")}

export function ${widgetName}(props: WidgetProps) {
  // Loading state
  if (props.stats.status === "loading") {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Laden...
      </div>
    );
  }

  // Error state
  if (props.stats.status === "error") {
    return (
      <div className="flex items-center justify-center h-full text-sm text-red-400">
        {props.stats.error || "Fehler"}
      </div>
    );
  }

  // Route to size-specific component
${sizeRouting}
}
`;
}

function generateRegistrationSteps(params: {
  pluginId: string;
  pluginName: string;
  hasWidget: boolean;
}): string {
  const { pluginId, pluginName, hasWidget } = params;
  const pascalName = toPascalCase(pluginName.replace(/\s+/g, ""));
  const widgetName = `${pascalName}Widget`;

  const steps: string[] = [];

  // Step 1: Prepare files in working directory
  steps.push(`## Schritt 1: Plugin-Dateien vorbereiten

Erstelle einen Ordner \`${pluginId}/\` in deinem **Arbeitsverzeichnis** (NICHT im Dashboard!):

\`\`\`
${pluginId}/
  plugin.manifest.json   # Pflicht: Manifest mit ID, Name, Version, Autor
  index.ts               # Pflicht: Plugin-Definition mit allen Exports${hasWidget ? `\n  ${widgetName}.tsx       # Widget-Komponente` : ""}
\`\`\`

Pflicht-Exports in index.ts:
\`\`\`typescript
export const plugin: AppPlugin = { ... };    // Plugin-Definition
export const widget = ${hasWidget ? widgetName : "null"};${" ".repeat(hasWidget ? 1 : 16)}// Widget-Komponente oder null
export const widgetName = ${hasWidget ? `"${widgetName}"` : "null"};${" ".repeat(hasWidget ? 1 : 10)}// Widget-Name oder null
\`\`\`
`);

  // Step 2: Widget file (if applicable)
  if (hasWidget) {
    steps.push(`## Schritt 2: Widget-Datei erstellen

**Datei:** \`${pluginId}/${widgetName}.tsx\`

Die Widget-Datei wird mit \`scaffold_widget\` generiert.
Das Widget liegt im GLEICHEN Ordner wie das Plugin.
`);
  }

  // Step 3: Create ZIP
  steps.push(`## Schritt ${hasWidget ? "3" : "2"}: ZIP erstellen

Rufe \`create_plugin_zip\` auf mit:
- \`pluginId\`: "${pluginId}"
- \`manifestJson\`: Inhalt der plugin.manifest.json
- \`pluginCode\`: Inhalt der index.ts${hasWidget ? `\n- \`widgetCode\`: Inhalt der ${widgetName}.tsx\n- \`widgetFileName\`: "${widgetName}.tsx"` : ""}

Das Tool validiert alle Dateien und erstellt eine ZIP-Datei auf der Festplatte.
`);

  // Step 4: Deliver to user
  steps.push(`## Schritt ${hasWidget ? "4" : "3"}: ZIP dem User uebergeben

Der User installiert das Plugin auf einem von zwei Wegen:

### Weg A: Dashboard UI (empfohlen)
1. Dashboard oeffnen > **Einstellungen** > **Plugins** > **Upload**
2. ZIP-Datei auswaehlen und hochladen
3. Dashboard neu starten (Button erscheint nach Upload)

### Weg B: Manuell (nur bei direktem Dateizugang)
1. ZIP entpacken
2. Ordner nach \`src/plugins/community/${pluginId}/\` kopieren
3. Server neustarten (\`npm run dev\` oder \`npm run build\`)
`);

  steps.push(`## Hinweise

- **NICHT ins Dashboard-Projekt schreiben!** Alle Dateien im Arbeitsverzeichnis erstellen
- **Kein \`community/index.ts\` bearbeiten** — Wird automatisch generiert
- **Kein \`registry.ts\` bearbeiten** — Community Plugins werden automatisch importiert
- **Kein \`icons.ts\` bearbeiten** — Icons werden automatisch aus \`metadata.icon\` aufgeloest
- **Kein \`widgets/registry.ts\` bearbeiten** — Community Widgets werden automatisch registriert
- **Icon-Slug pruefen** auf https://simpleicons.org (PascalCase, z.B. "Emby", "Grafana")
- **Ordnername = Plugin-ID** in \`metadata.id\` (kebab-case)
`);

  return `# Auslieferungs-Schritte fuer ${pluginName}

${steps.join("\n---\n\n")}
## Zusammenfassung

Dateien im Plugin-Ordner:
1. \`${pluginId}/plugin.manifest.json\` (Manifest)
2. \`${pluginId}/index.ts\` (Plugin + Exports)${hasWidget ? `\n3. \`${pluginId}/${widgetName}.tsx\` (Widget-Komponente)` : ""}

Workflow: Dateien erstellen -> \`create_plugin_zip\` aufrufen -> ZIP dem User geben.
`;
}

// ─── Tool Registration ────────────────────────────────────────────────────

export function registerScaffoldTools(server: McpServer): void {
  // ── scaffold_plugin ───────────────────────────────────────────────────
  server.tool(
    "scaffold_plugin",
    "[Phase 3: Generieren] Generates a complete plugin (index.ts + manifest). Call AFTER get_framework_overview + get_data_contracts. Code has TODO markers to customize.",
    {
      id: z.string().describe("Plugin ID in kebab-case, e.g. 'my-plugin'"),
      name: z.string().describe("Display name, e.g. 'My Plugin'"),
      description: z
        .string()
        .describe("Short description in German, e.g. 'Zeigt CPU und RAM'"),
      category: z
        .string()
        .describe(
          "Plugin category: Storage, Media, Network, Automation, System, Monitoring, Downloads, Security, Productivity, Development, Custom",
        ),
      configFields: z
        .array(
          z.object({
            key: z.string().describe("Config key, e.g. 'apiUrl'"),
            label: z.string().describe("Form label in German"),
            type: z
              .string()
              .describe(
                "Field type: text, password, url, textarea, select, number",
              ),
            required: z.boolean().describe("Is this field required?"),
            placeholder: z
              .string()
              .optional()
              .describe("Placeholder text"),
            description: z
              .string()
              .optional()
              .describe("Help text in German"),
          }),
        )
        .describe("Configuration form fields"),
      statOptions: z
        .array(
          z.object({
            key: z.string().describe("Stat key, e.g. 'cpu'"),
            label: z.string().describe("Stat label in German"),
            description: z
              .string()
              .describe("Stat description in German"),
            defaultEnabled: z
              .boolean()
              .describe("Enabled by default?"),
          }),
        )
        .describe("Selectable statistics"),
      supportedSizes: z
        .array(z.string())
        .describe('Supported tile sizes, e.g. ["1x1", "2x1", "2x2"]'),
      hasCrawler: z
        .boolean()
        .describe("Whether to generate a crawlEntities skeleton"),
      hasWidget: z
        .boolean()
        .describe(
          "Whether this plugin has a widget component (affects renderHints layout)",
        ),
      hasOAuth: z
        .boolean()
        .describe(
          "Whether this plugin uses OAuth (generates exchangeToken + refreshToken skeletons)",
        ),
    },
    async (params) => {
      // Input validation
      if (!/^[a-z][a-z0-9-]*$/.test(params.id)) {
        return error(`Plugin-ID "${params.id}" ist kein gueltiges kebab-case. Erlaubt: Kleinbuchstaben, Ziffern, Bindestriche (z.B. "mein-plugin").`);
      }
      if (params.statOptions.length === 0) {
        return error("statOptions darf nicht leer sein. Mindestens eine Statistik mit defaultEnabled: true ist Pflicht.");
      }
      if (!params.statOptions.some((o) => o.defaultEnabled)) {
        return error("Mindestens eine statOption muss defaultEnabled: true haben.");
      }
      const configKeys = params.configFields.map((f) => f.key);
      const duplicateKeys = configKeys.filter((k, i) => configKeys.indexOf(k) !== i);
      if (duplicateKeys.length > 0) {
        return error(`Doppelte configField keys: ${[...new Set(duplicateKeys)].join(", ")}. Jeder key muss eindeutig sein.`);
      }

      const code = generatePluginCode(params);
      const pascalName = toPascalCase(params.name.replace(/\s+/g, ""));
      const manifest = generateManifest({
        id: params.id,
        name: params.name,
        description: params.description,
        author: "TODO: Dein Name",
        hasWidget: params.hasWidget,
        widgetName: params.hasWidget ? `${pascalName}Widget` : undefined,
      });

      return success(
        `# Generierte Plugin-Dateien fuer: ${params.name}\n\n## 1. plugin.manifest.json\n\n\`\`\`json\n${manifest}\n\`\`\`\n\n## 2. index.ts\n\n\`\`\`typescript\n${code}\`\`\`\n\n**Naechste Schritte:**\n1. TODO-Kommentare abarbeiten (API-Endpoints, Auth-Header, Markenfarbe, Author)\n2. Code mit \`validate_plugin\` pruefen\n3. Bei jeder neuen ZIP: Version im Manifest hochzaehlen (semver: patch/minor/major)\n4. Mit \`create_plugin_zip\` als ZIP verpacken und dem User uebergeben`,
      );
    },
  );

  // ── scaffold_widget ───────────────────────────────────────────────────
  server.tool(
    "scaffold_widget",
    "[Phase 3: Generieren] Generates a widget component (.tsx) with size-specific sub-components and WidgetHeader. Call AFTER scaffold_plugin.",
    {
      pluginId: z.string().describe("Plugin ID in kebab-case"),
      pluginName: z.string().describe("Plugin display name"),
      color: z
        .string()
        .describe("Brand color as hex, e.g. '#52b54b'"),
      icon: z
        .string()
        .optional()
        .describe("Lucide icon name for WidgetHeader, e.g. 'MonitorPlay'. Defaults to 'Activity'."),
      sizes: z
        .array(z.string())
        .describe(
          'Widget sizes to support, e.g. ["2x1", "2x2"]. Only 2x1 and 2x2 are valid widget sizes.',
        ),
    },
    async ({ pluginId, pluginName, color, icon, sizes }) => {
      const validSizes = sizes.filter((s) => s === "2x1" || s === "2x2");
      if (validSizes.length === 0) {
        return error("Mindestens eine Widget-Groesse (2x1 oder 2x2) muss angegeben werden.");
      }

      const pascalName = toPascalCase(pluginName.replace(/\s+/g, ""));
      const widgetName = `${pascalName}Widget`;
      const code = generateWidgetCode({
        pluginId,
        pluginName,
        color,
        icon: icon || "Activity",
        sizes: validSizes,
      });

      return success(
        `# Generierte Widget-Datei: ${pluginId}/${widgetName}.tsx\n\n\`\`\`tsx\n${code}\`\`\`\n\n**Naechste Schritte:**\n1. In der Plugin \`index.ts\`: \`export const widget = ${widgetName};\` und \`export const widgetName = "${widgetName}";\`\n2. Sicherstellen dass \`renderHints.widgetComponent\` im Plugin auf "${widgetName}" gesetzt ist\n3. Mit \`create_plugin_zip\` als ZIP verpacken (widgetCode + widgetFileName mitgeben)`,
      );
    },
  );

  // ── get_registration_steps ────────────────────────────────────────────
  server.tool(
    "get_registration_steps",
    "[Phase 6: Paketieren] Returns delivery and installation steps: ZIP packaging with create_plugin_zip and upload via Dashboard UI.",
    {
      pluginId: z.string().describe("Plugin ID in kebab-case"),
      pluginName: z.string().describe("Plugin display name"),
      hasWidget: z
        .boolean()
        .describe("Whether this plugin has a widget component"),
    },
    async ({ pluginId, pluginName, hasWidget }) => {
      const steps = generateRegistrationSteps({
        pluginId,
        pluginName,
        hasWidget,
      });

      return success(steps);
    },
  );

  // ── generate_readme ──────────────────────────────────────────────────
  server.tool(
    "generate_readme",
    "[Phase 6: Paketieren] Generates a README.md for app submission. The README follows the Dominion docs/apps format (like Emby). Deliver alongside the ZIP.",
    {
      pluginName: z.string().describe("Display name, e.g. 'Home Assistant'"),
      pluginId: z.string().describe("Plugin ID in kebab-case, e.g. 'home-assistant'"),
      category: z.string().describe("Category: Storage, Media, Network, Automation, System, Monitoring, Downloads, Security, Productivity, Development, Custom"),
      supportedSizes: z.array(z.string()).describe('e.g. ["1x1", "2x1"]'),
      authType: z.string().describe("Authentication type shown in header, e.g. 'API Key', 'OAuth', 'Token', 'Username/Password'"),
      description: z.string().describe("1-2 sentence description of what the app does (German)"),
      requirements: z.array(z.string()).describe("List of prerequisites, e.g. ['Home Assistant 2024.1+', 'Long-Lived Access Token']"),
      features: z.array(z.string()).describe("List of 4-7 key features as bullet points"),
      configFields: z.array(z.object({
        label: z.string().describe("Field label"),
        type: z.string().describe("Field type: URL, Password, Text, Select, Number, Textarea"),
        required: z.boolean(),
        defaultValue: z.string().optional().describe("Default value or '--' if none"),
        description: z.string().describe("Short description"),
      })).describe("Configuration fields for the table"),
      statOptions: z.array(z.object({
        label: z.string().describe("Stat display name"),
        description: z.string().describe("What this stat shows"),
        defaultEnabled: z.boolean(),
      })).describe("Statistics toggle options"),
      hasWidget: z.boolean().describe("Whether plugin has a widget component"),
      hasCrawler: z.boolean().describe("Whether plugin has crawlEntities"),
      troubleshooting: z.array(z.object({
        problem: z.string().describe("Problem title, e.g. 'Connection failed'"),
        steps: z.array(z.string()).describe("Diagnostic/solution steps"),
      })).optional().describe("Common issues with solutions"),
    },
    async (params) => {
      const {
        pluginName, pluginId, category, supportedSizes, authType,
        description, requirements, features, configFields, statOptions,
        hasWidget, hasCrawler, troubleshooting,
      } = params;

      // Build tile sizes table
      const sizeRows = supportedSizes.map((size) => {
        const isCompact = size === "1x1";
        const maxStats = isCompact ? 3 : 6;
        const layout = isCompact ? "Compact" : (hasWidget ? "Widget" : "Detailed");
        const widget = isCompact ? "No" : (hasWidget ? "Yes" : "No");
        const content = hasCrawler
          ? `Up to ${maxStats} entities`
          : `Up to ${maxStats} stats${hasWidget && !isCompact ? " + widget" : ""}`;
        return `| **${size}** | ${layout} | ${content} | ${widget} |`;
      }).join("\n");

      // Build config table
      const configRows = configFields.map((f) =>
        `| ${sanitize(f.label)} | ${f.type} | ${f.required ? "Yes" : "No"} | ${f.defaultValue || "--"} | ${sanitize(f.description)} |`
      ).join("\n");

      // Build stats table
      const statRows = statOptions.map((s) =>
        `| ${sanitize(s.label)} | ${sanitize(s.description)} | ${s.defaultEnabled ? "On" : "Off"} |`
      ).join("\n");

      // Build troubleshooting
      let troubleshootingSection = "";
      if (troubleshooting && troubleshooting.length > 0) {
        troubleshootingSection = troubleshooting.map((t) =>
          `**"${sanitize(t.problem)}"**\n${t.steps.map((s) => `- ${sanitize(s)}`).join("\n")}`
        ).join("\n\n");
      } else {
        troubleshootingSection = `**"Connection failed"**\n- Verify the Server URL is reachable from the machine running Dominion\n- Check that the API Key/Token is correct\n- Use the **Test Connection** button in Settings to get a detailed error message`;
      }

      const readme = `# ${sanitize(pluginName)}

**Category:** ${sanitize(category)} | **Sizes:** ${supportedSizes.join(", ")} | **Auth:** ${sanitize(authType)}

> Community Plugin -- Install via ZIP upload in Settings > Plugins.

${sanitize(description)}

---

## Requirements

${requirements.map((r) => `- **${sanitize(r)}**`).join("\n")}

---

## Features

${features.map((f) => `- ${sanitize(f)}`).join("\n")}

---

## Tile Sizes

| Size | Layout | What you see | Widget |
|------|--------|-------------|--------|
${sizeRows}

---

## Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
${configRows}

---

## Statistics

| Stat | Description | Default |
|------|-------------|---------|
${statRows}

---

## Screenshots

<!-- Screenshots coming soon -->

---

## Troubleshooting

${troubleshootingSection}
`;

      return success(
        `# README fuer ${pluginName}\n\nSpeichere als \`README.md\` und liefere sie zusammen mit der ZIP-Datei.\n\n\`\`\`markdown\n${readme}\`\`\`\n\n**Naechste Schritte:**\n1. README.md speichern\n2. \`create_plugin_zip\` aufrufen fuer die ZIP-Datei\n3. Beides dem User uebergeben: ZIP + README.md`,
      );
    },
  );
}
