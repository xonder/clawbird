/**
 * Plugin configuration interface matching the configSchema in openclaw.plugin.json.
 */
export interface ClawbirdConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken?: string;
}

/**
 * Standard return type for OpenClaw agent tool execute functions.
 */
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}

/**
 * Helper to create a successful tool result with JSON-serialized data.
 */
export function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/**
 * Helper to create an error tool result.
 */
export function err(message: string, details?: unknown): ToolResult {
  const payload: Record<string, unknown> = { error: message };
  if (details !== undefined) {
    payload.details = details;
  }
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

/**
 * Construct a tweet URL from its ID and optional author username.
 */
export function tweetUrl(tweetId: string, username?: string): string {
  const user = username ?? "i";
  return `https://x.com/${user}/status/${tweetId}`;
}

/**
 * Extract a tweet ID from a URL or return the input if it already looks like an ID.
 */
export function parseTweetId(input: string): string {
  const match = input.match(/status\/(\d+)/);
  if (match) return match[1];
  // If it's all digits, assume it's already an ID
  if (/^\d+$/.test(input.trim())) return input.trim();
  return input.trim();
}

/**
 * Strip leading @ from a username if present.
 */
export function normalizeUsername(username: string): string {
  return username.replace(/^@/, "").trim();
}

/**
 * Environment variable names for fallback credential resolution.
 */
export const ENV_KEYS = {
  apiKey: "X_API_KEY",
  apiSecret: "X_API_SECRET",
  accessToken: "X_ACCESS_TOKEN",
  accessTokenSecret: "X_ACCESS_SECRET",
  bearerToken: "X_BEARER_TOKEN",
} as const;
