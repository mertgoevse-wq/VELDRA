/**
 * Pure helpers for turning a real AI SDK tool call/result into the real tool.* and file.*
 * WorkflowEvent data subagentService.ts emits from its generateText() onStepFinish
 * callback. Kept separate and dependency-free so the classification logic (which tool
 * names/args honestly look like a file operation) is unit-testable without mocking the
 * event emitter or the AI SDK.
 *
 * File-operation detection is a conservative heuristic, not a certainty: MCP tools are
 * registered dynamically from whatever servers are connected (see mcpService.ts), so
 * there is no fixed tool-name registry to check against. A tool is only classified as a
 * file operation when BOTH its name matches a read/write naming convention AND its args
 * carry a recognizable string path field -- if either signal is missing, no file.* event
 * is emitted (no guessing). tool.completed/tool.failed are unaffected by this and always
 * reflect the real tool call.
 */

const FILE_READ_NAME_PATTERN = /(^|[-_])(read|get|view|cat|open)([-_]?file)?($|[-_])|file[-_]?read/i;
const FILE_WRITE_NAME_PATTERN =
  /(^|[-_])(write|edit|create|update|save|patch|delete)([-_]?file)?($|[-_])|file[-_]?(write|edit|create)/i;
const PATH_ARG_KEYS = ['path', 'filePath', 'file_path', 'filename', 'file', 'relPath'];

export type FileEventKind = 'file.read' | 'file.changed';

/** Extracts a real file path from a tool call's args, or undefined if none is present. */
export function extractFilePath(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') {
    return undefined;
  }

  for (const key of PATH_ARG_KEYS) {
    const value = (args as Record<string, unknown>)[key];

    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

/**
 * Classifies a real tool call as a file read/write, or undefined if it doesn't
 * confidently look like one. Requires both a matching name and a real path arg.
 */
export function classifyFileToolCall(toolName: string, args: unknown): FileEventKind | undefined {
  const path = extractFilePath(args);

  if (!path) {
    return undefined;
  }

  if (FILE_WRITE_NAME_PATTERN.test(toolName)) {
    return 'file.changed';
  }

  if (FILE_READ_NAME_PATTERN.test(toolName)) {
    return 'file.read';
  }

  return undefined;
}

/*
 * Defense-in-depth redaction, not a fix for a specific known leak: MCP tools are
 * dynamically registered from arbitrary third-party servers (see this file's own doc
 * comment above) whose implementation VELDRA has no visibility into or control over -- if
 * one embeds a credential in its own thrown error text (e.g. an HTTP client that includes
 * request headers in a "request failed" message), that text reaches tool.failed's
 * displayed error field verbatim. VELDRA cannot fix a third-party tool's own bug, but can
 * cheaply reduce the blast radius of the common, recognizable secret shapes before display.
 * Found and scoped during a security review, 2026-08-16 -- see DECISIONS.md.
 *
 * Each entry owns its own replacer so there's no ambiguity between "this regex has a
 * prefix-to-keep capture group" and "String.replace's callback offset argument" -- both
 * are the 2nd positional callback argument when a pattern has zero groups, and conflating
 * them was a real bug caught by this file's own tests (an offset number like "31" leaking
 * into the "redacted" text for group-less patterns).
 */
const SECRET_PATTERNS: Array<{ pattern: RegExp; replace: (...match: string[]) => string }> = [
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replace: () => '[redacted]' },

  // GitHub tokens use '_' (ghp_xxx); OpenAI/Slack-style keys use '-' (sk-xxx) -- both accepted.
  { pattern: /\b(sk|ghp|gho|ghu|ghs|ghr|xox[baprs])[_-][A-Za-z0-9-]{10,}\b/gi, replace: () => '[redacted]' },
  { pattern: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, replace: () => '[redacted]' },
  {
    pattern:
      /(["']?(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password|client[_-]?secret)["']?\s*[:=]\s*["']?)[^\s"',}]{6,}/gi,
    replace: (_match: string, prefix: string) => `${prefix}[redacted]`,
  },
];

/** Replaces recognizable secret-shaped substrings with a redaction marker. */
export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((result, { pattern, replace }) => result.replace(pattern, replace), text);
}

/** Bounded, safe stringification for event payloads -- never throws, never unbounded. */
export function summarizeForEvent(value: unknown, maxLen = 300): string {
  let text: string;

  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }

  if (text === undefined) {
    return '';
  }

  text = redactSecrets(text);

  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}
