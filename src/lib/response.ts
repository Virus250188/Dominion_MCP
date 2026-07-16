// ─── Shared MCP Response Helpers ────────────────────────────────────────────

export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function text(t: string): ToolResponse {
  return { content: [{ type: "text" as const, text: t }] };
}

export function json(data: unknown): ToolResponse {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function error(t: string): ToolResponse {
  return { content: [{ type: "text" as const, text: t }], isError: true };
}

export function result(data: { ok: boolean; [k: string]: unknown }): ToolResponse {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    isError: !data.ok,
  };
}
