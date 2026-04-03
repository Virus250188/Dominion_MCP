import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ─── Preview Tools ───────────────────────────────────────────────────────
// Generates self-contained HTML previews of plugin tiles in the Dashboard's
// glass theme. The agent writes the HTML to a file and opens it in the
// browser so the developer can see how their plugin will look.

const PREVIEW_TEMPLATE = `<!DOCTYPE html>
<html lang="de" data-theme="glass-dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plugin Preview: {{PLUGIN_NAME}}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0a0a0f;
    color: #e4e4e7;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 20px;
    gap: 32px;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #fafafa;
    text-align: center;
  }
  h1 span { color: {{PLUGIN_COLOR}}; }

  .subtitle {
    font-size: 0.85rem;
    color: #71717a;
    text-align: center;
    margin-top: -16px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    grid-auto-rows: 160px;
    gap: 16px;
    width: 100%;
    max-width: 1200px;
  }

  .tile {
    background: oklch(1 0 0 / 8%);
    backdrop-filter: blur(24px);
    border: 1px solid oklch(1 0 0 / 15%);
    border-radius: 14px;
    box-shadow: 0 8px 32px oklch(0 0 0 / 40%), inset 0 1px 0 oklch(1 0 0 / 5%);
    overflow: hidden;
    position: relative;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .tile:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px oklch(0 0 0 / 50%), inset 0 1px 0 oklch(1 0 0 / 8%);
  }

  .tile-1x1 { grid-column: span 1; grid-row: span 1; }
  .tile-2x1 { grid-column: span 2; grid-row: span 1; }
  .tile-2x2 { grid-column: span 2; grid-row: span 2; }

  /* ─── 1x1 Layout ─── */
  .layout-1x1 {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 12px 8px;
    height: 100%;
  }

  .online-dot {
    position: absolute;
    top: 8px;
    left: 10px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #34d399;
  }

  .icon-circle {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: {{PLUGIN_COLOR}};
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 18px;
  }

  .tile-title {
    font-size: 12px;
    font-weight: 600;
    color: #fafafa;
    text-align: center;
    line-height: 1.2;
  }

  .stats-row {
    display: flex;
    gap: 12px;
    justify-content: center;
    width: 100%;
    border-top: 1px solid oklch(1 0 0 / 10%);
    padding-top: 6px;
    margin-top: auto;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  .stat-value {
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: #fafafa;
  }
  .stat-label {
    font-size: 9px;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .stat-unit {
    font-size: 10px;
    color: #71717a;
    margin-left: 2px;
    font-weight: 400;
  }
  .color-green { color: #34d399; }
  .color-red { color: #f87171; }
  .color-yellow { color: #fbbf24; }
  .color-blue { color: #38bdf8; }

  /* ─── 2x1 Layout ─── */
  .layout-2x1 {
    display: flex;
    align-items: center;
    padding: 16px;
    gap: 16px;
    height: 100%;
  }
  .layout-2x1 .icon-circle {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
  }
  .layout-2x1 .info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .layout-2x1 .tile-title { text-align: left; }
  .layout-2x1 .tile-desc {
    font-size: 11px;
    color: #71717a;
  }
  .layout-2x1 .stats-row {
    margin-left: auto;
    border-top: none;
    padding-top: 0;
    gap: 16px;
  }

  /* ─── 2x2 Layout ─── */
  .layout-2x2 {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .widget-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid oklch(1 0 0 / 10%);
    flex-shrink: 0;
    height: 40px;
  }
  .widget-header .icon-circle {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    font-size: 12px;
  }
  .widget-header .title {
    font-size: 13px;
    font-weight: 600;
    color: #fafafa;
  }
  .widget-header .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #34d399;
    margin-left: auto;
  }
  .widget-body {
    flex: 1;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
  }
  .widget-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #52525b;
    font-size: 13px;
    gap: 8px;
    border: 1px dashed oklch(1 0 0 / 12%);
    border-radius: 8px;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px 12px;
  }
  .stats-grid .stat { align-items: flex-start; }
  .stats-grid .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
  .stats-grid .stat-value { font-size: 16px; font-weight: 700; }

  /* ─── Size Labels ─── */
  .size-label {
    position: absolute;
    top: 6px;
    right: 8px;
    font-size: 9px;
    color: #52525b;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  /* ─── Responsive ─── */
  @media (max-width: 800px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }

  .note {
    font-size: 12px;
    color: #52525b;
    text-align: center;
    max-width: 600px;
    line-height: 1.6;
  }
</style>
</head>
<body>

<h1>Preview: <span>{{PLUGIN_NAME}}</span></h1>
<p class="subtitle">So sieht dein Plugin im Dominion Dashboard aus (Glass-Dark Theme)</p>

<div class="grid">
  {{TILES_HTML}}
</div>

<p class="note">
  Grid: 6 Spalten, 160px Zeilenhoehe, 16px Gap<br>
  Die Vorschau zeigt das glass-dark Theme. Im Dashboard gibt es 6 verschiedene Themes.
</p>

</body>
</html>`;

function generateTile1x1(
  pluginName: string,
  pluginColor: string,
  stats: Array<{ label: string; value: string; unit?: string; color?: string }>,
): string {
  const initial = pluginName.charAt(0).toUpperCase();
  const statsHtml = stats
    .slice(0, 3)
    .map(
      (s) =>
        `<div class="stat"><span class="stat-value${s.color ? ` color-${s.color}` : ""}">${s.value}${s.unit ? `<span class="stat-unit">${s.unit}</span>` : ""}</span><span class="stat-label">${s.label}</span></div>`,
    )
    .join("\n          ");

  return `
  <!-- 1x1 Tile -->
  <div class="tile tile-1x1">
    <span class="size-label">1x1</span>
    <span class="online-dot"></span>
    <div class="layout-1x1">
      <div class="icon-circle">${initial}</div>
      <div class="tile-title">${pluginName}</div>
      <div class="stats-row">
        ${statsHtml}
      </div>
    </div>
  </div>`;
}

function generateTile2x1(
  pluginName: string,
  pluginColor: string,
  description: string,
  stats: Array<{ label: string; value: string; unit?: string; color?: string }>,
): string {
  const initial = pluginName.charAt(0).toUpperCase();
  const statsHtml = stats
    .slice(0, 6)
    .map(
      (s) =>
        `<div class="stat"><span class="stat-value${s.color ? ` color-${s.color}` : ""}">${s.value}${s.unit ? `<span class="stat-unit">${s.unit}</span>` : ""}</span><span class="stat-label">${s.label}</span></div>`,
    )
    .join("\n        ");

  return `
  <!-- 2x1 Tile -->
  <div class="tile tile-2x1">
    <span class="size-label">2x1</span>
    <span class="online-dot"></span>
    <div class="layout-2x1">
      <div class="icon-circle">${initial}</div>
      <div class="info">
        <div class="tile-title">${pluginName}</div>
        <div class="tile-desc">${description}</div>
      </div>
      <div class="stats-row">
        ${statsHtml}
      </div>
    </div>
  </div>`;
}

function generateTile2x2(
  pluginName: string,
  pluginColor: string,
  stats: Array<{ label: string; value: string; unit?: string; color?: string }>,
  hasWidget: boolean,
): string {
  const initial = pluginName.charAt(0).toUpperCase();

  let bodyHtml: string;
  if (hasWidget) {
    bodyHtml = `<div class="widget-placeholder">Widget-Bereich<br><span style="font-size:11px">~290px verfuegbar</span></div>`;
  } else {
    const statsHtml = stats
      .slice(0, 6)
      .map(
        (s) =>
          `<div class="stat"><span class="stat-label">${s.label}</span><span class="stat-value${s.color ? ` color-${s.color}` : ""}">${s.value}${s.unit ? `<span class="stat-unit">${s.unit}</span>` : ""}</span></div>`,
      )
      .join("\n          ");

    bodyHtml = `<div class="stats-grid">\n          ${statsHtml}\n        </div>`;
  }

  return `
  <!-- 2x2 Tile -->
  <div class="tile tile-2x2">
    <span class="size-label">2x2</span>
    <div class="layout-2x2">
      <div class="widget-header">
        <div class="icon-circle">${initial}</div>
        <span class="title">${pluginName}</span>
        <span class="status-dot"></span>
      </div>
      <div class="widget-body">
        ${bodyHtml}
      </div>
    </div>
  </div>`;
}

export function registerPreviewTools(server: McpServer): void {
  server.tool(
    "preview_tile",
    "Generates a self-contained HTML file that previews how a plugin's tiles will look in the Dominion Dashboard (glass-dark theme). The agent should write the returned HTML to a file and open it in the browser. Shows all supported tile sizes (1x1, 2x1, 2x2) with realistic dimensions (160px row height, 16px gap).",
    {
      pluginName: z.string().describe("Display name of the plugin, e.g. 'OPNsense'"),
      pluginColor: z.string().describe("Brand color as hex, e.g. '#D94F00'"),
      description: z.string().describe("Short description shown in 2x1 tile"),
      supportedSizes: z
        .array(z.string())
        .describe('Tile sizes to preview, e.g. ["1x1", "2x1", "2x2"]'),
      stats: z
        .array(
          z.object({
            label: z.string().describe("Stat label, e.g. 'CPU'"),
            value: z.string().describe("Stat value, e.g. '23%'"),
            unit: z.string().optional().describe("Optional unit, e.g. 'GB'"),
            color: z
              .string()
              .optional()
              .describe("Optional color: green, red, yellow, blue"),
          }),
        )
        .describe("Mock stats to display in the preview"),
      hasWidget: z
        .boolean()
        .describe("Whether the plugin has a widget component (affects 2x2 preview)"),
    },
    async ({ pluginName, pluginColor, description, supportedSizes, stats, hasWidget }) => {
      const tiles: string[] = [];

      if (supportedSizes.includes("1x1")) {
        tiles.push(generateTile1x1(pluginName, pluginColor, stats));
      }

      if (supportedSizes.includes("2x1")) {
        tiles.push(generateTile2x1(pluginName, pluginColor, description, stats));
      }

      if (supportedSizes.includes("2x2")) {
        tiles.push(generateTile2x2(pluginName, pluginColor, stats, hasWidget));
      }

      const html = PREVIEW_TEMPLATE
        .replace(/\{\{PLUGIN_NAME\}\}/g, pluginName)
        .replace(/\{\{PLUGIN_COLOR\}\}/g, pluginColor)
        .replace("{{TILES_HTML}}", tiles.join("\n"));

      return {
        content: [
          {
            type: "text" as const,
            text: `# Tile Preview fuer ${pluginName}\n\nSchreibe den folgenden HTML-Code in eine Datei (z.B. \`preview-${pluginName.toLowerCase().replace(/\s+/g, "-")}.html\`) und oeffne sie im Browser:\n\n\`\`\`html\n${html}\n\`\`\`\n\n**Anweisung:** Schreibe diese HTML-Datei und oeffne sie mit dem Browser. Der User sieht dann eine Vorschau aller Tile-Groessen im Dashboard-Look.`,
          },
        ],
      };
    },
  );
}
