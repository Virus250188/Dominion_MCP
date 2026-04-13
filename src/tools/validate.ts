import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validationResponse, type ValidationIssue } from "./_response.js";

// ─── Types ────────────────────────────────────────────────────────────────

interface ValidationResult {
  [key: string]: unknown;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  passed: boolean;
}

function result(errors: ValidationIssue[], warnings: ValidationIssue[]): ValidationResult {
  return { errors, warnings, passed: errors.length === 0 };
}

function err(message: string, fix?: string): ValidationIssue {
  return fix ? { message, fix } : { message };
}

function warn(message: string, fix?: string): ValidationIssue {
  return fix ? { message, fix } : { message };
}

// ─── validate_plugin (consolidated) ──────────────────────────────────────

function validatePlugin(params: {
  pluginCode: string;
  pluginId?: string;
  manifestJson?: string;
  widgetCode?: string;
  widgetFileName?: string;
}): ValidationResult {
  const { pluginCode, pluginId, manifestJson, widgetCode } = params;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // ── Manifest Validation (merged from test_plugin_completeness) ──────

  if (manifestJson) {
    try {
      const manifest = JSON.parse(manifestJson) as Record<string, unknown>;
      const requiredFields = ["id", "name", "version", "author", "description"];
      const missingFields = requiredFields.filter(
        (f) => typeof manifest[f] !== "string" || (manifest[f] as string).trim() === "",
      );

      if (missingFields.length > 0) {
        errors.push(err(
          `Manifest: Fehlende Pflichtfelder: ${missingFields.join(", ")}`,
          `Ergaenze in plugin.manifest.json:\n${missingFields.map((f) => `  "${f}": "..."`).join(",\n")}`,
        ));
      }

      // ID matches pluginId
      if (pluginId && manifest.id && manifest.id !== pluginId) {
        errors.push(err(
          `Manifest ID "${String(manifest.id)}" stimmt nicht mit pluginId "${pluginId}" ueberein.`,
          `Setze "id": "${pluginId}" im Manifest.`,
        ));
      }

      // kebab-case check
      if (typeof manifest.id === "string" && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(manifest.id)) {
        errors.push(err(
          `Manifest ID "${manifest.id}" ist kein gueltiges kebab-case.`,
          `Erlaubt: Kleinbuchstaben, Ziffern, Bindestriche. Beispiel: "mein-plugin"`,
        ));
      }

      // semver check
      if (typeof manifest.version === "string" && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
        errors.push(err(
          `Manifest Version "${manifest.version}" ist kein gueltiges semver.`,
          `Verwende Format x.y.z, z.B. "1.0.0"`,
        ));
      }

      // Widget file consistency
      if (manifest.hasWidget === true) {
        if (typeof manifest.widgetFile !== "string") {
          errors.push(err(
            `Manifest: "hasWidget" ist true, aber "widgetFile" fehlt.`,
            `Ergaenze: "widgetFile": "MeinWidget.tsx"`,
          ));
        }
        if (!widgetCode) {
          warnings.push(warn(
            `Manifest: "hasWidget" ist true, aber kein widgetCode wurde uebergeben.`,
            `Uebergib den Widget-Code als widgetCode Parameter.`,
          ));
        }
      }

      if (!manifest.minDashboardVersion) {
        warnings.push(warn(
          `Manifest: "minDashboardVersion" nicht gesetzt.`,
          `Empfohlen fuer Kompatibilitaet: "minDashboardVersion": "1.0.7"`,
        ));
      }
    } catch {
      errors.push(err(
        "Manifest ist kein gueltiges JSON.",
        `Stelle sicher, dass der manifestJson-String gueltiges JSON ist. Beispiel:\n{\n  "id": "mein-plugin",\n  "name": "Mein Plugin",\n  "version": "1.0.0",\n  "author": "Name",\n  "description": "Beschreibung"\n}`,
      ));
    }
  }

  // ── Plugin Code Validation ──────────────────────────────────────────

  // 1. Has metadata object with required fields
  const metadataMatch = pluginCode.match(/metadata\s*:\s*\{/);
  if (!metadataMatch) {
    errors.push(err(
      "Missing `metadata` object in plugin definition.",
      `Ergaenze:\nmetadata: {\n  id: "mein-plugin",\n  name: "Mein Plugin",\n  icon: "Activity",\n  color: "#000000",\n  description: "Beschreibung",\n  category: "Custom",\n},`,
    ));
  } else {
    const requiredMetaFields = ["id", "name", "icon", "color", "description", "category"];
    const metaStart = pluginCode.indexOf("metadata");
    const afterMeta = pluginCode.slice(metaStart, metaStart + 800);
    for (const field of requiredMetaFields) {
      if (!afterMeta.includes(`${field}:`)) {
        const examples: Record<string, string> = {
          id: 'id: "mein-plugin",',
          name: 'name: "Mein Plugin",',
          icon: 'icon: "Activity",  // PascalCase Slug von simpleicons.org',
          color: 'color: "#000000",  // Hex-Farbe von simpleicons.org',
          description: 'description: "Kurze Beschreibung",',
          category: 'category: "Custom",  // Storage | Media | Network | Automation | System | Monitoring | Downloads | Security | Productivity | Development | Custom',
        };
        errors.push(err(
          `metadata is missing required field: ${field}`,
          `Ergaenze in metadata: ${examples[field] || `${field}: "..."`}`,
        ));
      }
    }
  }

  // 2. metadata.id is kebab-case
  const idMatch = pluginCode.match(/id\s*:\s*["']([^"']+)["']/);
  if (idMatch) {
    if (!/^[a-z][a-z0-9-]*$/.test(idMatch[1])) {
      errors.push(err(
        `metadata.id "${idMatch[1]}" is not kebab-case. Must match /^[a-z][a-z0-9-]*$/.`,
        `Verwende nur Kleinbuchstaben, Ziffern und Bindestriche. Beispiel: "mein-plugin"`,
      ));
    }
  } else {
    if (metadataMatch) {
      warnings.push(warn("Could not extract metadata.id value for validation."));
    }
  }

  // 3. metadata.color is valid hex
  const colorMatch = pluginCode.match(/color\s*:\s*["']([^"']+)["']/);
  if (colorMatch) {
    if (!/^#[0-9a-fA-F]{6}$/.test(colorMatch[1])) {
      errors.push(err(
        `metadata.color "${colorMatch[1]}" is not a valid hex color. Must match #XXXXXX format.`,
        `Verwende eine 6-stellige Hex-Farbe: "#52b54b". Finde die Markenfarbe auf simpleicons.org.`,
      ));
    }
  } else {
    if (metadataMatch) {
      warnings.push(warn("Could not extract metadata.color value for validation."));
    }
  }

  // 4. Has configFields array
  if (!/configFields\s*:\s*\[/.test(pluginCode)) {
    errors.push(err(
      "Missing `configFields` array.",
      `Ergaenze:\nconfigFields: [\n  { key: "apiUrl", label: "Server URL", type: "url", required: true, placeholder: "http://localhost:8096" },\n],`,
    ));
  } else {
    // Validate configField.type values
    const validFieldTypes = new Set(["text", "password", "url", "textarea", "select", "number", "oauth"]);
    const fieldTypeMatches = [...pluginCode.matchAll(/type\s*:\s*["']([^"']+)["']/g)];
    for (const match of fieldTypeMatches) {
      const typeValue = match[1];
      // Skip non-configField type values (e.g. type: "enhanced")
      if (typeValue === "enhanced" || typeValue === "standard") continue;
      if (!validFieldTypes.has(typeValue) && !["1x1", "2x1", "2x2"].includes(typeValue)) {
        warnings.push(warn(
          `ConfigField type "${typeValue}" is not a recognized type.`,
          `Gueltige Typen: "text", "password", "url", "textarea", "select", "number", "oauth"`,
        ));
      }
    }
  }

  // 5. Has statOptions array with at least one defaultEnabled: true
  if (!/statOptions\s*:\s*\[/.test(pluginCode)) {
    errors.push(err(
      "Missing `statOptions` array.",
      `Ergaenze:\nstatOptions: [\n  { key: "status", label: "Status", description: "Aktueller Status", defaultEnabled: true },\n],`,
    ));
  } else {
    if (!/defaultEnabled\s*:\s*true/.test(pluginCode)) {
      errors.push(err(
        "statOptions must have at least one entry with `defaultEnabled: true`.",
        `Setze bei mindestens einer statOption: defaultEnabled: true`,
      ));
    }
  }

  // 6. Has supportedSizes array containing "1x1"
  if (!/supportedSizes\s*:\s*\[/.test(pluginCode)) {
    errors.push(err(
      "Missing `supportedSizes` array.",
      `Ergaenze: supportedSizes: ["1x1", "2x1"],`,
    ));
  } else {
    if (!/supportedSizes\s*:\s*\[[\s\S]*?["']1x1["']/.test(pluginCode)) {
      errors.push(err(
        'supportedSizes must contain "1x1".',
        `"1x1" ist Pflicht. Beispiel: supportedSizes: ["1x1", "2x1"]`,
      ));
    }
  }

  // 7. Has renderHints object
  if (!/renderHints\s*:\s*\{/.test(pluginCode)) {
    errors.push(err(
      "Missing `renderHints` object.",
      `Ergaenze:\nrenderHints: {\n  "1x1": { maxStats: 3, layout: "compact" },\n},`,
    ));
  }

  // 8. For each size in supportedSizes, check renderHints has a matching key
  const sizesMatch = pluginCode.match(/supportedSizes\s*:\s*\[([\s\S]*?)\]/);
  if (sizesMatch) {
    const sizesStr = sizesMatch[1];
    const sizes = [...sizesStr.matchAll(/["'](\dx\d)["']/g)].map((m) => m[1]);
    for (const size of sizes) {
      const hintKeyRegex = new RegExp(`["']${size}["']\\s*:`);
      if (!hintKeyRegex.test(pluginCode)) {
        const maxStats = size === "1x1" ? 3 : 6;
        const layout = size === "1x1" ? "compact" : "detailed";
        errors.push(err(
          `renderHints is missing key for supported size "${size}".`,
          `Ergaenze in renderHints:\n"${size}": { maxStats: ${maxStats}, layout: "${layout}" }`,
        ));
      }
    }
  }

  // 9. If any renderHint has layout: "widget", check it also has widgetComponent
  const widgetHints = [...pluginCode.matchAll(/["']\dx\d["']\s*:\s*\{([^}]*)\}/g)];
  for (const hint of widgetHints) {
    const hintBody = hint[1];
    if (/layout\s*:\s*["']widget["']/.test(hintBody)) {
      if (!/widgetComponent\s*:/.test(hintBody)) {
        errors.push(err(
          `renderHint with layout "widget" is missing widgetComponent.`,
          `Ergaenze: widgetComponent: "MeinWidget"  // Name der exportierten Widget-Komponente`,
        ));
      }
    }
  }

  // 10. Has fetchStats function/method
  if (!/fetchStats\s*[\(:]/.test(pluginCode) && !/async\s+fetchStats/.test(pluginCode)) {
    errors.push(err(
      "Missing `fetchStats` function/method.",
      `Ergaenze:\nasync fetchStats(config: PluginConfig): Promise<PluginStats> {\n  try {\n    const visibleStats = getVisibleStats(config, this.statOptions);\n    const baseUrl = normalizeUrl(config.apiUrl);\n    // ... API-Abfrage ...\n    return { items: [...], status: "ok" };\n  } catch (err) {\n    return createErrorResponse(err);\n  }\n}`,
    ));
  }

  // 11. Has testConnection function/method
  if (!/testConnection\s*[\(:]/.test(pluginCode) && !/async\s+testConnection/.test(pluginCode)) {
    errors.push(err(
      "Missing `testConnection` function/method.",
      `Ergaenze:\nasync testConnection(config: PluginConfig): Promise<{ ok: boolean; message: string }> {\n  try {\n    const baseUrl = normalizeUrl(config.apiUrl);\n    const res = await fetch(baseUrl + "/api/status", createFetchOptions());\n    if (!res.ok) return { ok: false, message: "HTTP " + res.status };\n    return { ok: true, message: "Verbunden" };\n  } catch (err) {\n    return { ok: false, message: (err as Error).message };\n  }\n}`,
    ));
  }

  // 12-14. fetchStats body checks
  const fetchStatsBody = extractFunctionBody(pluginCode, "fetchStats");
  if (fetchStatsBody) {
    // AbortSignal check: skip if createFetchOptions is used (it includes AbortSignal.timeout internally)
    if (!fetchStatsBody.includes("AbortSignal.timeout") && !fetchStatsBody.includes("createFetchOptions")) {
      warnings.push(warn(
        "fetchStats should use `AbortSignal.timeout` for request timeouts.",
        `Nutze createFetchOptions() welches bereits AbortSignal.timeout(8000) beinhaltet:\nconst res = await fetch(url, { ...createFetchOptions(), headers });`,
      ));
    }

    if (!/try\s*\{/.test(fetchStatsBody)) {
      warnings.push(warn(
        "fetchStats should contain a try/catch block for error handling.",
        `Wrappe den fetchStats-Body:\ntry {\n  // ... API-Logik ...\n  return { items, status: "ok" };\n} catch (err) {\n  return createErrorResponse(err);\n}`,
      ));
    }

    if (!fetchStatsBody.includes("visibleStats")) {
      warnings.push(warn(
        "fetchStats should use the `visibleStats` pattern to filter stats by user selection.",
        `Am Anfang von fetchStats:\nconst visibleStats = getVisibleStats(config, this.statOptions);\n\nDann pro Stat:\nif (visibleStats.includes("meineStatKey")) {\n  items.push({ label: "Mein Stat", value: 42 });\n}`,
      ));
    }
  }

  // 15. All fetch() calls have signal parameter
  const usesCreateFetchOptions = pluginCode.includes("createFetchOptions");
  if (!usesCreateFetchOptions) {
    const fetchCalls = [...pluginCode.matchAll(/fetch\s*\([^)]*\{([^}]*)\}/g)];
    for (const call of fetchCalls) {
      const fetchOptions = call[1];
      if (!/signal\s*:/.test(fetchOptions)) {
        warnings.push(warn(
          "A fetch() call is missing the `signal` parameter with AbortSignal.timeout.",
          `Nutze: fetch(url, { ...createFetchOptions(), headers })  // createFetchOptions() hat signal eingebaut`,
        ));
      }
    }
  }

  // 16. Check for shared utilities usage
  const utilImportRegex = /from\s+["'].*utils["']/;
  if (!utilImportRegex.test(pluginCode)) {
    warnings.push(warn(
      'Plugin does not import shared utilities from "../../utils".',
      `Ergaenze am Dateianfang:\nimport { getVisibleStats, normalizeUrl, createErrorResponse, createFetchOptions } from "../../utils";`,
    ));
  }

  // 17. Check metadata.icon format
  const iconMatch = pluginCode.match(/icon\s*:\s*["']([^"']+)["']/);
  if (iconMatch) {
    const iconSlug = iconMatch[1];
    if (/\s/.test(iconSlug)) {
      errors.push(err(
        `metadata.icon "${iconSlug}" contains spaces. Must be a valid simple-icons slug.`,
        `Verwende PascalCase ohne Leerzeichen, z.B. "Emby", "HomeAssistant". Pruefe auf simpleicons.org.`,
      ));
    }
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(iconSlug)) {
      warnings.push(warn(
        `metadata.icon "${iconSlug}" may not be a valid simple-icons slug. Expected PascalCase like "Emby" or "Grafana".`,
        `Pruefe den Icon-Slug auf https://simpleicons.org`,
      ));
    }
  }

  // 18. Check that renderHints do NOT contain deprecated 'features' field
  const renderHintsBlock = pluginCode.match(/renderHints\s*:\s*\{([\s\S]*?)\}\s*,?\s*\n\s*\n/);
  if (renderHintsBlock) {
    if (/features\s*:/.test(renderHintsBlock[1])) {
      errors.push(err(
        'renderHints contains deprecated `features` field.',
        `Entferne das "features" Array aus renderHints. Es wurde aus SizeRenderHint entfernt.`,
      ));
    }
  }

  // 19. widgetData consistency
  const hasWidgetLayout = /layout\s*:\s*["']widget["']/.test(pluginCode);
  const usesWidgetData = /widgetData\s*[=:{]/.test(pluginCode) || /widgetData\s*:/.test(pluginCode);
  if (hasWidgetLayout && !usesWidgetData) {
    warnings.push(warn(
      'Plugin has layout "widget" in renderHints but does not return widgetData.',
      `Ergaenze in fetchStats return:\nreturn { items, status: "ok", widgetData: { recentItems: [...] } };`,
    ));
  }

  // 20. Check configField feature-fields pattern
  const hasSelectFields = /type\s*:\s*["']select["']/.test(pluginCode);
  if (hasWidgetLayout && !hasSelectFields) {
    warnings.push(warn(
      'Plugin has widget layout but no select-type configFields.',
      `Erwaege widget-spezifische Config-Optionen als select-Felder:\n{ key: "displayMode", label: "Anzeigemodus", type: "select", required: false }`,
    ));
  }

  // 21. Auto-Discovery: Check for standardized exports
  const hasStandardPluginExport = /export\s+const\s+plugin\s*[=:]/.test(pluginCode);
  const hasWidgetExport = /export\s+const\s+widget\s*=/.test(pluginCode);
  const hasWidgetNameExport = /export\s+const\s+widgetName\s*=/.test(pluginCode);

  if (!hasStandardPluginExport) {
    const legacyExport = /export\s+const\s+\w+Plugin\s*[=:]/.test(pluginCode);
    if (legacyExport) {
      warnings.push(warn(
        'Plugin uses legacy export format (export const {name}Plugin).',
        `Community Plugins muessen verwenden:\nexport const plugin: AppPlugin = { ... };`,
      ));
    } else {
      errors.push(err(
        'Missing `export const plugin`.',
        `Ergaenze:\nexport const plugin: AppPlugin = {\n  metadata: { ... },\n  configFields: [...],\n  statOptions: [...],\n  supportedSizes: [...],\n  renderHints: { ... },\n  async fetchStats(config) { ... },\n  async testConnection(config) { ... },\n};`,
      ));
    }
  }

  if (!hasWidgetExport) {
    warnings.push(warn(
      'Missing `export const widget`.',
      `Ergaenze (Pflicht fuer Auto-Discovery):\nexport const widget = MeinWidget;  // oder null falls kein Widget`,
    ));
  }

  if (!hasWidgetNameExport) {
    warnings.push(warn(
      'Missing `export const widgetName`.',
      `Ergaenze (Pflicht fuer Auto-Discovery):\nexport const widgetName = "MeinWidget";  // oder null falls kein Widget`,
    ));
  }

  // 22. fetchStats is async
  if (/fetchStats\s*[\(:]/.test(pluginCode) && !/async\s+fetchStats\s*\(/.test(pluginCode)) {
    // fetchStats exists but is not marked async
    warnings.push(warn(
      "fetchStats is not declared as async.",
      `Aendere zu: async fetchStats(config: PluginConfig): Promise<PluginStats> { ... }`,
    ));
  }

  // 23. testConnection is async
  if (/testConnection\s*[\(:]/.test(pluginCode) && !/async\s+testConnection\s*\(/.test(pluginCode)) {
    warnings.push(warn(
      "testConnection is not declared as async.",
      `Aendere zu: async testConnection(config: PluginConfig): Promise<{ ok: boolean; message: string }> { ... }`,
    ));
  }

  // 24. crawlEntities + selectedEntities compatibility
  const hasCrawlEntities = /crawlEntities\s*[\(:]/.test(pluginCode) || /async\s+crawlEntities/.test(pluginCode);
  if (hasCrawlEntities) {
    // Check that fetchStats reads selectedEntities
    if (fetchStatsBody && !fetchStatsBody.includes("selectedEntities")) {
      warnings.push(warn(
        "Plugin hat crawlEntities aber fetchStats liest config.selectedEntities nicht.",
        `Wenn crawlEntities implementiert ist, speichert der Entity-Picker die Auswahl als config.selectedEntities.\nErgaenze in fetchStats:\nlet entityConfig = parseEntityConfig(config.selectedEntities);\nif (entityConfig.length === 0 && config.entityIds) {\n  entityConfig = parseEntityConfig(config.entityIds); // Legacy-Fallback\n}`,
      ));
    }

    // Check that configFields don't include an entity textarea (redundant with picker)
    if (/key\s*:\s*["']entityIds["']/.test(pluginCode)) {
      warnings.push(warn(
        "Plugin hat crawlEntities UND ein entityIds ConfigField. Das ist redundant.",
        `Entferne das entityIds-Feld aus configFields. Der Entity-Picker des Dashboards uebernimmt die Auswahl automatisch.\nconfigFields sollte nur Connection-Felder enthalten (apiUrl, apiKey).`,
      ));
    }
  }

  // 25. Feature-Field visibility warning
  const CONNECTION_KEYS = new Set(["apiUrl", "apiKey", "accessToken", "username", "password"]);
  const configFieldMatches = [...pluginCode.matchAll(/\{\s*key\s*:\s*["']([^"']+)["'][^}]*?required\s*:\s*(true|false)/g)];
  for (const match of configFieldMatches) {
    const key = match[1];
    const isRequired = match[2] === "true";

    const fieldBlock = pluginCode.slice(Math.max(0, match.index! - 20), match.index! + match[0].length + 100);
    const isOAuth = /type\s*:\s*["']oauth["']/.test(fieldBlock);
    const hasShowForSizes = /showForSizes\s*:/.test(fieldBlock);

    if (!isRequired && !CONNECTION_KEYS.has(key) && !isOAuth) {
      if (hasShowForSizes) {
        warnings.push(warn(
          `ConfigField "${key}" hat showForSizes — wird nur fuer die angegebenen Tile-Groessen angezeigt.`,
        ));
      } else {
        warnings.push(warn(
          `ConfigField "${key}" ist nicht required und kein Connection-Key — es wird erst nach erfolgreichem Verbindungstest sichtbar. Ist das beabsichtigt?`,
          `Connection-Keys (sofort sichtbar): apiUrl, apiKey, accessToken, username, password.\nAlle anderen Felder erscheinen erst NACH dem Verbindungstest als "Feature-Fields".\nTipp: Nutze showForSizes um Felder nur fuer bestimmte Tile-Groessen anzuzeigen.`,
        ));
      }
    }

    // 31. Required configField that isn't a CONNECTION_KEY breaks tile-reuse
    // (Dashboard hardcodes CONNECTION_KEYS = ["apiUrl","apiKey","accessToken","username","password"]
    //  in core/src/lib/actions/tiles.ts:43. When a tile is created against an existing
    //  AppConnection, only those keys are loaded from the saved row — any other required
    //  field will fail validation with "Missing required config fields: <key>".)
    if (isRequired && !CONNECTION_KEYS.has(key) && !isOAuth) {
      const credentialish = /^(api)?(secret|token|bearer|auth|key|password|pass|pwd)$/i.test(key);
      const remap = credentialish
        ? `Benenne den Key um auf einen der CONNECTION_KEYS:\n  apiKey, accessToken, username, password\nz.B. \`{ key: "apiKey", label: "${key}", type: "password", required: true }\` (das Label kann frei bleiben).`
        : `Entweder den Key auf einen CONNECTION_KEY (apiUrl/apiKey/accessToken/username/password) abbilden, oder das Feld auf \`required: false\` setzen damit es als per-Tile Feature-Field behandelt wird.`;
      errors.push(err(
        `ConfigField "${key}" ist required, aber kein CONNECTION_KEY — bricht beim Wiederverwenden einer Connection mit "Missing required config fields: ${key}".`,
        `Hintergrund: Dashboard hat eine hardcodierte Liste CONNECTION_KEYS = ["apiUrl","apiKey","accessToken","username","password"] (core/src/lib/actions/tiles.ts:43). Beim Anlegen einer zweiten Tile auf derselben AppConnection laedt das Dashboard nur diese 5 Keys aus der gespeicherten Connection — alles andere wird als fehlend gemeldet.\n\n${remap}`,
      ));
    }
  }

  // ── 26-30. Notification System (v1.3.0-beta contract) ──────────────

  const hasSupportsNotifications = /supportsNotifications\s*:\s*true/.test(pluginCode);
  const notificationRulesMatch = pluginCode.match(/notificationRules\s*:\s*\[/);
  const hasNotificationRules = !!notificationRulesMatch;
  const hasCheckNotifications = /(?:async\s+)?checkNotifications\s*[\(:]/.test(pluginCode);

  // 26. supportsNotifications without notificationRules
  if (hasSupportsNotifications && !hasNotificationRules) {
    errors.push(err(
      "Plugin hat supportsNotifications: true aber kein notificationRules Array.",
      `Seit Dashboard v1.3.0-beta muessen beide Felder zusammen gesetzt sein. Ohne notificationRules erscheint der TileDialog-Toggle nicht und der User kann keine Notifications aktivieren.\nBeispiel:\nnotificationRules: [\n  {\n    id: "service_offline",\n    label: "Service offline",\n    description: "Feuert wenn der Service nicht erreichbar ist.",\n    severity: "critical",\n    defaultEnabled: true,\n  },\n],`,
    ));
  }

  // 27. notificationRules without supportsNotifications
  if (hasNotificationRules && !hasSupportsNotifications) {
    errors.push(err(
      "Plugin hat notificationRules aber supportsNotifications ist nicht true.",
      `Setze \`supportsNotifications: true\`. Der TileDialog-Toggle gated auf beide Flags zusammen.`,
    ));
  }

  // 28. notificationRules without checkNotifications
  if (hasNotificationRules && !hasCheckNotifications) {
    warnings.push(warn(
      "Plugin deklariert notificationRules aber implementiert kein checkNotifications.",
      `Ohne checkNotifications werden keine plugin-originated Notifications erzeugt.\nImplementiere: async checkNotifications(config, currentData, previousData): Promise<PluginNotification[]> { ... }`,
    ));
  }

  // 29. checkNotifications without notificationRules
  if (hasCheckNotifications && !hasNotificationRules) {
    errors.push(err(
      "Plugin implementiert checkNotifications aber hat kein notificationRules Array.",
      `Seit v1.3.0-beta verwirft das Framework alle Notifications deren tag keiner Rule-ID entspricht. Ohne notificationRules ist die Rule-ID-Menge leer — ALLES wird gedropped.\nDeklariere notificationRules: PluginNotificationRule[] mit allen moeglichen Zustaenden die checkNotifications erkennt.`,
    ));
  }

  // 30. Tag/Rule-ID consistency + severity check (only if both are present)
  if (hasNotificationRules && notificationRulesMatch) {
    const bracketStart = notificationRulesMatch.index! + notificationRulesMatch[0].length - 1; // position of '['
    let depth = 0;
    let bracketEnd = bracketStart;
    for (let i = bracketStart; i < pluginCode.length; i++) {
      if (pluginCode[i] === "[") depth++;
      else if (pluginCode[i] === "]") {
        depth--;
        if (depth === 0) { bracketEnd = i; break; }
      }
    }
    const rulesBlock = pluginCode.slice(bracketStart, bracketEnd + 1);

    const ruleIds = new Set<string>();
    for (const m of rulesBlock.matchAll(/\bid\s*:\s*["']([^"']+)["']/g)) {
      ruleIds.add(m[1]);
    }

    if (ruleIds.size === 0) {
      errors.push(err(
        "notificationRules ist leer oder enthaelt keine gueltigen Rule-Objekte.",
        `Deklariere mindestens eine Rule mit { id, label, description, severity, defaultEnabled }. Ein leeres Array verhindert dass der TileDialog-Toggle erscheint.`,
      ));
    }

    // Severity whitelist check
    for (const m of rulesBlock.matchAll(/\bseverity\s*:\s*["']([^"']+)["']/g)) {
      if (!["info", "warning", "critical"].includes(m[1])) {
        errors.push(err(
          `notificationRules: severity "${m[1]}" ist ungueltig.`,
          `Erlaubt sind nur: "info" | "warning" | "critical". PluginNotification.category kennt zusaetzlich "update", aber die PluginNotificationRule-Severity nicht.`,
        ));
      }
    }

    // Tag consistency check — walk every notifications.push(...) call in checkNotifications
    if (hasCheckNotifications && ruleIds.size > 0) {
      const checkBody = extractFunctionBody(pluginCode, "checkNotifications");
      if (checkBody) {
        const pushRegex = /notifications\s*\.\s*push\s*\(/g;
        let pushMatch: RegExpExecArray | null;
        while ((pushMatch = pushRegex.exec(checkBody)) !== null) {
          const argStart = pushMatch.index + pushMatch[0].length;
          let parenDepth = 1;
          let argEnd = argStart;
          for (let i = argStart; i < checkBody.length; i++) {
            if (checkBody[i] === "(") parenDepth++;
            else if (checkBody[i] === ")") {
              parenDepth--;
              if (parenDepth === 0) { argEnd = i; break; }
            }
          }
          const arg = checkBody.slice(argStart, argEnd);
          const tagMatch = arg.match(/\btag\s*:\s*["']([^"']+)["']/);
          if (!tagMatch) {
            warnings.push(warn(
              "notifications.push(...) ohne tag-Feld — das Framework verwirft Notifications ohne tag silent.",
              `Jede plugin-originated Notification MUSS einen tag haben der exakt einer notificationRules[].id entspricht.\nBekannte Rule-IDs: ${[...ruleIds].join(", ")}`,
            ));
          } else if (!ruleIds.has(tagMatch[1])) {
            errors.push(err(
              `checkNotifications benutzt tag: "${tagMatch[1]}" — diese ID existiert nicht in notificationRules.`,
              `Notifications mit unbekanntem tag werden vom Framework (runNotificationCheck) silent verworfen.\nBekannte Rule-IDs: ${[...ruleIds].join(", ")}\nEntweder den tag auf eine existierende Rule-ID aendern oder eine neue Rule in notificationRules ergaenzen.`,
            ));
          }
        }
      }
    }
  }

  // ── Widget Validation (merged from test_plugin_completeness) ────────

  if (widgetCode) {
    const hasUseClient = widgetCode.includes('"use client"') || widgetCode.includes("'use client'");
    if (!hasUseClient) {
      errors.push(err(
        'Widget: Missing "use client" directive.',
        `Fuege als erste Zeile der Widget-Datei hinzu:\n"use client";`,
      ));
    }

    const hasWidgetHeader = widgetCode.includes("WidgetHeader");
    if (!hasWidgetHeader) {
      warnings.push(warn(
        "Widget: WidgetHeader nicht verwendet.",
        `Importiere und verwende WidgetHeader fuer eine konsistente Kopfzeile:\nimport { WidgetHeader } from "../shared/WidgetHeader";\n\n<WidgetHeader icon="Activity" iconColor="#000" title="Mein Plugin" status="online" />`,
      ));
    }

    if (!/export\s+(function|const|default)/.test(widgetCode)) {
      errors.push(err(
        "Widget: Kein Export gefunden.",
        `Das Widget muss exportiert werden:\nexport function MeinWidget(props: WidgetProps) { ... }`,
      ));
    }
  }

  return result(errors, warnings);
}

/**
 * Best-effort extraction of a method/function body by name.
 */
function extractFunctionBody(code: string, funcName: string): string | null {
  const funcIndex = code.search(new RegExp(`(async\\s+)?${funcName}\\s*\\(`));
  if (funcIndex === -1) return null;

  const afterSignature = code.indexOf("{", funcIndex);
  if (afterSignature === -1) return null;

  let depth = 0;
  let end = afterSignature;
  for (let i = afterSignature; i < code.length; i++) {
    if (code[i] === "{") depth++;
    if (code[i] === "}") depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }

  return code.slice(afterSignature, end + 1);
}

// ─── validate_stats_output ────────────────────────────────────────────────

function validateStatsOutput(statsJson: string): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(statsJson);
  } catch {
    errors.push(err(
      "Invalid JSON: could not parse the stats output.",
      `Stelle sicher dass der JSON-String gueltig ist. Erwartetes Format:\n{ "items": [...], "status": "ok" }`,
    ));
    return result(errors, warnings);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    errors.push(err(
      "Stats output must be a JSON object, not an array or primitive.",
      `Erwartetes Format:\n{ "items": [...], "status": "ok" }`,
    ));
    return result(errors, warnings);
  }

  const stats = parsed as Record<string, unknown>;

  if (!Array.isArray(stats.items)) {
    errors.push(err(
      "Missing `items` array in stats output.",
      `Ergaenze:\n"items": [\n  { "label": "Status", "value": "Online" }\n]`,
    ));
  } else {
    const items = stats.items as unknown[];

    if (items.length > 6) {
      errors.push(err(
        `items array has ${items.length} entries, maximum is 6.`,
        `Reduziere die items auf maximal 6. Verwende statOptions + visibleStats um dem User die Auswahl zu ueberlassen.`,
      ));
    }

    const validColors = new Set(["green", "red", "yellow"]);

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Record<string, unknown>;
      if (typeof item !== "object" || item === null) {
        errors.push(err(`items[${i}] is not an object.`, `Jedes Item muss ein Objekt sein: { "label": "...", "value": "..." }`));
        continue;
      }

      if (typeof item.label !== "string" || item.label.trim() === "") {
        errors.push(err(
          `items[${i}].label must be a non-empty string.`,
          `Ergaenze: "label": "Mein Label"`,
        ));
      }

      if (typeof item.value !== "string" && typeof item.value !== "number") {
        errors.push(err(
          `items[${i}].value must be a string or number.`,
          `Wert muss string oder number sein: "value": 42 oder "value": "Online"`,
        ));
      }

      if (item.unit !== undefined && typeof item.unit !== "string") {
        errors.push(err(`items[${i}].unit must be a string if provided.`, `Beispiel: "unit": "GB"`));
      }

      if (item.icon !== undefined && typeof item.icon !== "string") {
        errors.push(err(`items[${i}].icon must be a string if provided.`, `Verwende einen Lucide-Icon-Namen: "icon": "HardDrive"`));
      }

      if (item.color !== undefined) {
        if (typeof item.color !== "string" || !validColors.has(item.color)) {
          errors.push(err(
            `items[${i}].color must be one of: green, red, yellow. Got "${String(item.color)}".`,
            `Gueltige Farben: "green", "red", "yellow"`,
          ));
        }
      }
    }
  }

  if (stats.status !== "ok" && stats.status !== "error") {
    errors.push(err(
      'Missing or invalid `status` field. Must be "ok" or "error".',
      `Ergaenze: "status": "ok"  // oder "error" bei Fehlern`,
    ));
  }

  if (stats.status === "error") {
    if (typeof stats.error !== "string" || stats.error.trim() === "") {
      warnings.push(warn(
        'status is "error" but no `error` message string is provided.',
        `Ergaenze: "error": "Verbindung fehlgeschlagen: Connection refused"`,
      ));
    }
  }

  if (stats.widgetData !== undefined) {
    if (typeof stats.widgetData !== "object" || stats.widgetData === null || Array.isArray(stats.widgetData)) {
      errors.push(err(
        "widgetData must be a plain object (Record<string, unknown>), not an array or primitive.",
        `Verwende ein Objekt: "widgetData": { "recentItems": [...] }`,
      ));
    }
  }

  return result(errors, warnings);
}

// ─── validate_render_hints ────────────────────────────────────────────────

function validateRenderHints(renderHintsJson: string, supportedSizes: string[]): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  let hints: Record<string, unknown>;
  try {
    hints = JSON.parse(renderHintsJson);
  } catch {
    errors.push(err(
      "Invalid JSON: could not parse render hints.",
      `Erwartetes Format:\n{ "1x1": { "maxStats": 3, "layout": "compact" } }`,
    ));
    return result(errors, warnings);
  }

  if (typeof hints !== "object" || hints === null || Array.isArray(hints)) {
    errors.push(err("renderHints must be a JSON object.", `Verwende ein Objekt mit Size-Keys.`));
    return result(errors, warnings);
  }

  for (const size of supportedSizes) {
    if (!(size in hints)) {
      const maxStats = size === "1x1" ? 3 : 6;
      const layout = size === "1x1" ? "compact" : "detailed";
      errors.push(err(
        `renderHints is missing entry for supported size "${size}".`,
        `Ergaenze: "${size}": { "maxStats": ${maxStats}, "layout": "${layout}" }`,
      ));
    }
  }

  const maxStatsLimits: Record<string, number> = { "1x1": 3, "2x1": 6, "2x2": 6 };

  for (const [size, hintValue] of Object.entries(hints)) {
    if (typeof hintValue !== "object" || hintValue === null) {
      errors.push(err(`renderHints["${size}"] must be an object.`, `Verwende: "${size}": { "maxStats": 3, "layout": "compact" }`));
      continue;
    }

    const hint = hintValue as Record<string, unknown>;

    if (typeof hint.maxStats === "number") {
      const limit = maxStatsLimits[size];
      if (limit !== undefined && hint.maxStats > limit) {
        warnings.push(warn(`renderHints["${size}"].maxStats is ${hint.maxStats}, recommended max for ${size} is ${limit}.`));
      }
    }

    // Layout restrictions per size
    if (size === "1x1" && hint.layout && hint.layout !== "compact") {
      errors.push(err(
        `renderHints["1x1"] has layout "${String(hint.layout)}" but 1x1 only supports "compact".`,
        `Aendere zu: "layout": "compact". 1x1 Tiles haben keinen Widget-Support.`,
      ));
    }

    if ((size === "2x1" || size === "2x2") && hint.layout === "compact") {
      errors.push(err(
        `renderHints["${size}"] has layout "compact" but that is only valid for 1x1.`,
        `Verwende "detailed" oder "widget" fuer ${size}.`,
      ));
    }

    if (hint.layout === "widget") {
      if (!hint.widgetComponent || typeof hint.widgetComponent !== "string") {
        errors.push(err(
          `renderHints["${size}"] has layout "widget" but missing or invalid widgetComponent.`,
          `Ergaenze: "widgetComponent": "MeinWidget"`,
        ));
      }
    }

    if (hint.layout === "compact" || hint.layout === "detailed") {
      if (hint.widgetComponent) {
        warnings.push(warn(
          `renderHints["${size}"] has layout "${String(hint.layout)}" but sets widgetComponent. widgetComponent is only for layout "widget".`,
        ));
      }
    }
  }

  return result(errors, warnings);
}

// ─── Registration ─────────────────────────────────────────────────────────

export function registerValidationTools(server: McpServer): void {
  server.tool(
    "validate_plugin",
    "[Phase 4: Validieren] Validates plugin code, manifest, and widget against 31 framework rules. Covers: types/exports, manifest, fetchStats shape, crawlEntities, feature-field visibility, CONNECTION_KEYS whitelist for required fields (catches the 'required apiSecret breaks tile-reuse' class of bugs), notification system (supportsNotifications + notificationRules + checkNotifications + tag/rule-ID consistency), widget basics. Returns errors with fix suggestions. Call BEFORE create_plugin_zip.",
    {
      pluginCode: z.string().describe("The full TypeScript source code of the plugin (index.ts)."),
      pluginId: z.string().optional().describe("Plugin ID in kebab-case. If provided, checks manifest ID match."),
      manifestJson: z.string().optional().describe("Full JSON content of plugin.manifest.json."),
      widgetCode: z.string().optional().describe("Full source code of the widget .tsx file."),
      widgetFileName: z.string().optional().describe("Widget filename, e.g. 'MyWidget.tsx'."),
    },
    async (params) => {
      const validation = validatePlugin(params);
      return validationResponse(validation);
    },
  );

  server.tool(
    "validate_stats_output",
    "[Phase 4: Validieren] Validates PluginStats JSON: items array (max 6), types, colors, status. Returns errors with fix suggestions.",
    {
      statsJson: z.string().describe("JSON string of a PluginStats object to validate."),
    },
    async ({ statsJson }) => {
      const validation = validateStatsOutput(statsJson);
      return validationResponse(validation);
    },
  );

  server.tool(
    "validate_render_hints",
    "[Phase 4: Validieren] Validates renderHints JSON: size entries, maxStats limits, widget/compact layout rules. Returns errors with fix suggestions.",
    {
      renderHintsJson: z.string().describe("JSON string of the renderHints object to validate."),
      supportedSizes: z.array(z.string()).describe('Array of supported sizes, e.g. ["1x1", "2x1", "2x2"].'),
    },
    async ({ renderHintsJson, supportedSizes }) => {
      const validation = validateRenderHints(renderHintsJson, supportedSizes);
      return validationResponse(validation);
    },
  );
}
