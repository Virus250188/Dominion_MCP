import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validationResponse, type ValidationIssue } from "./_response.js";

// ─── Types ────────────────────────────────────────────────────────────────

interface CheckItem {
  check: string;
  passed: boolean;
  detail: string;
}

// ─── test_typescript_syntax ──────────────────────────────────────────────
// Basic TypeScript syntax validation via regex. Checks bracket balance,
// import format, and common mistakes. No compiler needed.

function testTypescriptSyntax(params: {
  pluginCode: string;
  widgetCode?: string;
}): { checks: CheckItem[]; allPassed: boolean } {
  const checks: CheckItem[] = [];

  function checkCode(code: string, label: string): void {
    // 1. Bracket balance
    let braceDepth = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let inString = false;
    let stringChar = "";
    let inTemplateString = false;

    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      const prev = i > 0 ? code[i - 1] : "";

      if (inString) {
        if (ch === stringChar && prev !== "\\") inString = false;
        continue;
      }
      if (inTemplateString) {
        if (ch === "`" && prev !== "\\") inTemplateString = false;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (ch === "`") {
        inTemplateString = true;
        continue;
      }
      // Skip line comments
      if (ch === "/" && i + 1 < code.length && code[i + 1] === "/") {
        const newline = code.indexOf("\n", i);
        i = newline === -1 ? code.length : newline;
        continue;
      }

      if (ch === "{") braceDepth++;
      if (ch === "}") braceDepth--;
      if (ch === "(") parenDepth++;
      if (ch === ")") parenDepth--;
      if (ch === "[") bracketDepth++;
      if (ch === "]") bracketDepth--;
    }

    const balanced = braceDepth === 0 && parenDepth === 0 && bracketDepth === 0;
    checks.push({
      check: `${label}: Klammern balanciert`,
      passed: balanced,
      detail: balanced
        ? "Alle Klammern korrekt geschlossen"
        : `Unbalanciert: { ${braceDepth > 0 ? `+${braceDepth}` : braceDepth} } ( ${parenDepth > 0 ? `+${parenDepth}` : parenDepth} ) [ ${bracketDepth > 0 ? `+${bracketDepth}` : bracketDepth} ]`,
    });

    // 2. Import paths check (should use relative paths for plugin utils)
    const absoluteImports = [...code.matchAll(/from\s+["']([^"']+)["']/g)];
    const badImports: string[] = [];
    for (const match of absoluteImports) {
      const importPath = match[1];
      if (importPath.startsWith("/") && !importPath.startsWith("//")) {
        badImports.push(importPath);
      }
    }
    checks.push({
      check: `${label}: Keine absoluten Import-Pfade`,
      passed: badImports.length === 0,
      detail:
        badImports.length === 0
          ? "Alle Imports verwenden relative Pfade oder @/ Alias"
          : `Absolute Pfade gefunden: ${badImports.join(", ")}`,
    });

    // 3. No console.log (warning)
    const hasConsoleLog = /console\.(log|debug|info)\s*\(/.test(code);
    checks.push({
      check: `${label}: Kein console.log (Production)`,
      passed: !hasConsoleLog,
      detail: hasConsoleLog
        ? "console.log/debug/info gefunden. Sollte fuer Production entfernt werden."
        : "Keine console.log Aufrufe. Gut.",
    });
  }

  checkCode(params.pluginCode, "index.ts");

  if (params.widgetCode) {
    checkCode(params.widgetCode, "Widget");
  }

  return {
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}

// ─── Registration ─────────────────────────────────────────────────────────

export function registerTestTools(server: McpServer): void {
  server.tool(
    "test_typescript_syntax",
    "[Phase 4: Validieren] Checks TypeScript syntax: bracket balance, import paths, console.log. No compiler needed. Call alongside validate_plugin.",
    {
      pluginCode: z.string().describe("Full TypeScript source code of index.ts."),
      widgetCode: z.string().optional().describe("Full source code of the widget .tsx file (if applicable)."),
    },
    async ({ pluginCode, widgetCode }) => {
      const syntaxResult = testTypescriptSyntax({ pluginCode, widgetCode });

      // Convert CheckItem[] to ValidationIssue[] format
      const errors: ValidationIssue[] = [];
      const warnings: ValidationIssue[] = [];

      for (const check of syntaxResult.checks) {
        if (!check.passed) {
          // console.log checks are warnings, everything else is error
          if (check.check.includes("console.log")) {
            warnings.push({ message: `${check.check}: ${check.detail}` });
          } else {
            errors.push({ message: `${check.check}: ${check.detail}` });
          }
        }
      }

      return validationResponse({
        passed: errors.length === 0,
        errors,
        warnings,
        checks: syntaxResult.checks,
      });
    },
  );
}
