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

  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}
