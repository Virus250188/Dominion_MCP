// ─── Shared MCP Response Helpers ─────────────────────────────────────────
// Provides a consistent response format across all tool groups.
// - success(): normal text response
// - error(): sets isError: true so agents can detect failures
// - validationResult(): structured validation output with isError when !passed

export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface ValidationIssue {
  message: string;
  fix?: string;
}

export type ValidationData = {
  passed: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  [key: string]: unknown;
};

export function success(text: string): ToolResponse {
  return { content: [{ type: "text" as const, text }] };
}

export function error(text: string): ToolResponse {
  return { content: [{ type: "text" as const, text }], isError: true };
}

export function validationResponse(data: ValidationData): ToolResponse {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    isError: !data.passed,
  };
}
