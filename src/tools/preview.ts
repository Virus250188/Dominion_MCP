import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { json, error } from "../lib/response.js";

// ─── Binding helpers (mirror src/plugins/v2/binding.ts) ─────────────────────
function resolvePath(obj: unknown, p: string): unknown {
  if (!p) return undefined;
  let cur: unknown = obj;
  for (const part of p.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(part);
      cur = Number.isInteger(idx) ? cur[idx] : undefined;
    } else if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[part];
    } else return undefined;
  }
  return cur;
}
function renderTemplate(tpl: string, ctx: unknown): string {
  return tpl.replace(/\{([^}]+)\}/g, (_, p: string) => {
    const v = resolvePath(ctx, p.trim());
    return v === null || v === undefined ? "" : String(v);
  });
}
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

// ─── Node -> HTML (glass-dark theme approximation) ──────────────────────────
function renderNode(node: unknown, ctx: Record<string, unknown>): string {
  if (typeof node !== "object" || node === null) return "";
  const n = node as Record<string, unknown>;
  if (n.showIf && !resolvePath(ctx, String(n.showIf))) return "";
  const type = n.type as string;
  switch (type) {
    case "stats": {
      const items = ((ctx.stats as { items?: unknown[] })?.items ?? []) as Array<Record<string, unknown>>;
      const max = typeof n.max === "number" ? n.max : items.length;
      const cols = n.columns === 3 ? 3 : 2;
      const cells = items.slice(0, max).map((it) =>
        `<div class="stat"><div class="sv" style="color:${esc(String(it.color ?? "#e5e7eb"))}">${esc(String(it.value ?? "—"))}${it.unit ? " " + esc(String(it.unit)) : ""}</div><div class="sl">${esc(String(it.label ?? ""))}</div></div>`,
      ).join("");
      return `<div class="stats" style="grid-template-columns:repeat(${cols},1fr)">${cells}</div>`;
    }
    case "gauge": {
      const val = Math.max(0, Math.min(100, Number(resolvePath(ctx, String(n.value))) || 0));
      const size = typeof n.size === "number" ? n.size : 64;
      const color = esc(String(n.color ?? "#22c55e"));
      return `<div class="center"><div class="gauge" style="width:${size}px;height:${size}px;background:conic-gradient(${color} ${val * 3.6}deg,#334155 0)"><span>${Math.round(val)}%</span></div>${n.label ? `<div class="sl">${esc(String(n.label))}</div>` : ""}</div>`;
    }
    case "progress": {
      const val = Math.max(0, Math.min(100, Number(resolvePath(ctx, String(n.value))) || 0));
      const color = esc(String(n.color ?? "#3b82f6"));
      return `<div class="prog-wrap">${n.label ? `<div class="sl">${esc(String(n.label))}</div>` : ""}<div class="prog"><div style="width:${val}%;background:${color}"></div></div></div>`;
    }
    case "sparkline": {
      const arr = (resolvePath(ctx, String(n.values)) as number[]) ?? [];
      const max = Math.max(1, ...arr);
      const bars = arr.map((v) => `<span style="height:${Math.round((v / max) * 100)}%"></span>`).join("");
      return `<div class="prog-wrap">${n.label ? `<div class="sl">${esc(String(n.label))}</div>` : ""}<div class="spark">${bars}</div></div>`;
    }
    case "text": {
      const content = esc(renderTemplate(String(n.content ?? ""), ctx));
      const variant = String(n.variant ?? "value");
      const align = String(n.align ?? "left");
      return `<div class="txt ${variant}" style="text-align:${align}">${content}</div>`;
    }
    case "list": {
      const arr = (resolvePath(ctx, String(n.items)) as unknown[]) ?? [];
      const max = typeof n.max === "number" ? n.max : 6;
      const rows = arr.slice(0, max).map((it) => {
        const primary = esc(renderTemplate(String(n.primary ?? ""), it));
        const secondary = n.secondary ? esc(renderTemplate(String(n.secondary), it)) : "";
        return `<div class="row"><span>${primary}</span><span class="muted">${secondary}</span></div>`;
      }).join("");
      return `<div class="list">${rows}</div>`;
    }
    case "carousel": {
      const arr = (resolvePath(ctx, String(n.items)) as unknown[]) ?? [];
      const map = (n.map ?? {}) as Record<string, string>;
      const cards = arr.slice(0, typeof n.maxItems === "number" ? n.maxItems : 8).map((it) => {
        const title = esc(renderTemplate(String(map.title ?? ""), it));
        const sub = map.subtitle ? esc(renderTemplate(map.subtitle, it)) : "";
        const img = map.image ? renderTemplate(map.image, it) : "";
        const safeImg = /^https?:\/\//.test(img) ? img : "";
        return `<div class="card">${safeImg ? `<div class="cimg" style="background-image:url('${esc(safeImg)}')"></div>` : `<div class="cimg"></div>`}<div class="ct">${title}</div><div class="cs muted">${sub}</div></div>`;
      }).join("");
      return `<div class="carousel">${cards}</div>`;
    }
    case "row":
    case "column": {
      const gap = typeof n.gap === "number" ? n.gap : 8;
      const kids = Array.isArray(n.children) ? (n.children as unknown[]).map((c) => renderNode(c, ctx)).join("") : "";
      return `<div class="${type}" style="gap:${gap}px">${kids}</div>`;
    }
    default:
      return `<div class="txt muted">[unknown node: ${esc(String(type))}]</div>`;
  }
}

const CSS = `
:root{color-scheme:dark}
body{margin:0;background:#0b1220;font-family:ui-sans-serif,system-ui,sans-serif;color:#e5e7eb;padding:24px}
.tile{background:rgba(30,41,59,.55);backdrop-filter:blur(12px);border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:16px;box-shadow:0 8px 32px rgba(0,0,0,.35)}
.column{display:flex;flex-direction:column}.row{display:flex;align-items:center;justify-content:space-between}
.stats{display:grid;gap:10px}.stat{background:rgba(15,23,42,.5);border-radius:12px;padding:10px}
.sv{font-size:20px;font-weight:700}.sl{font-size:11px;color:#94a3b8;margin-top:2px}
.center{display:flex;flex-direction:column;align-items:center;gap:6px}
.gauge{border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative}
.gauge::after{content:"";position:absolute;inset:10px;border-radius:50%;background:#0f172a}
.gauge span{position:relative;z-index:1;font-weight:700;font-size:14px}
.prog-wrap{width:100%}.prog{height:8px;border-radius:6px;background:#334155;overflow:hidden}.prog>div{height:100%}
.spark{display:flex;align-items:flex-end;gap:2px;height:36px}.spark>span{flex:1;background:#38bdf8;border-radius:2px}
.txt{font-size:14px}.txt.title{font-size:18px;font-weight:700}.txt.subtitle{font-size:13px;color:#cbd5e1}.txt.muted{color:#94a3b8;font-size:12px}
.list{display:flex;flex-direction:column;gap:6px}.list .row{background:rgba(15,23,42,.4);border-radius:8px;padding:6px 10px;font-size:13px}
.muted{color:#94a3b8}
.carousel{display:flex;gap:10px;overflow-x:auto}.card{min-width:110px}.cimg{height:150px;border-radius:10px;background:#1e293b center/cover}
.ct{font-size:12px;margin-top:4px}.cs{font-size:11px}
.label{font-size:11px;color:#64748b;margin-bottom:8px;letter-spacing:.06em;text-transform:uppercase}
`;

const SIZE_PX: Record<string, string> = { "2x1": "width:320px", "2x2": "width:320px" };

export function registerPreviewTools(server: McpServer): void {
  server.tool(
    "preview_widget",
    "Render a declarative widget to a glass-dark HTML preview (approximation of the dashboard WidgetRenderer) and write it to disk. Supply the widget node JSON plus a sampleContext ({ stats:{items:[...]}, widgetData:{...}, config:{...} }) so bindings resolve. Great for a quick visual sanity check before packaging.",
    {
      widget: z.string().describe("widget node as JSON (the value under widgets['2x2'])"),
      size: z.enum(["2x1", "2x2"]).default("2x2"),
      sampleContext: z.string().describe("JSON: { stats:{items:[{label,value,unit?,color?}]}, widgetData:{...}, config:{...} }"),
      outputDir: z.string().describe("absolute directory to write the preview .html"),
      title: z.string().default("preview"),
    },
    async ({ widget, size, sampleContext, outputDir, title }) => {
      let node: unknown, ctx: Record<string, unknown>;
      try { node = JSON.parse(widget); } catch (err) { return error(`widget JSON invalid: ${(err as Error).message}`); }
      try { ctx = JSON.parse(sampleContext) as Record<string, unknown>; } catch (err) { return error(`sampleContext JSON invalid: ${(err as Error).message}`); }

      const bodyHtml = renderNode(node, ctx);
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="label">${esc(title)} · ${size} · glass-dark</div><div class="tile" style="${SIZE_PX[size]}">${bodyHtml}</div></body></html>`;

      try { fs.mkdirSync(outputDir, { recursive: true }); } catch (err) { return error(`Cannot create outputDir: ${(err as Error).message}`); }
      const outPath = path.join(outputDir, `${title.replace(/[^a-z0-9_-]/gi, "_")}.html`);
      try { fs.writeFileSync(outPath, html, "utf-8"); } catch (err) { return error(`Cannot write preview: ${(err as Error).message}`); }

      return json({ ok: true, htmlPath: outPath, note: "Approximation for layout/binding sanity — final rendering is done by the dashboard WidgetRenderer." });
    },
  );
}
