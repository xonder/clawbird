import { Client, OAuth1 } from "@xdevplatform/xdk";
import type { ClawbirdConfig } from "./types.js";
import { ENV_KEYS } from "./types.js";

export interface XClients {
  /** Client authenticated with OAuth1 — required for write operations. */
  writeClient: Client;
  /** Client for read operations — uses Bearer token if available, else OAuth1. */
  readClient: Client;
}

/**
 * Resolve plugin config with environment variable fallback.
 */
export function resolveConfig(
  pluginConfig?: Partial<ClawbirdConfig>,
): ClawbirdConfig {
  const cfg: ClawbirdConfig = {
    apiKey:
      pluginConfig?.apiKey ?? process.env[ENV_KEYS.apiKey] ?? "",
    apiSecret:
      pluginConfig?.apiSecret ?? process.env[ENV_KEYS.apiSecret] ?? "",
    accessToken:
      pluginConfig?.accessToken ?? process.env[ENV_KEYS.accessToken] ?? "",
    accessTokenSecret:
      pluginConfig?.accessTokenSecret ??
      process.env[ENV_KEYS.accessTokenSecret] ??
      "",
    bearerToken:
      pluginConfig?.bearerToken ?? process.env[ENV_KEYS.bearerToken],
  };

  if (!cfg.apiKey || !cfg.apiSecret || !cfg.accessToken || !cfg.accessTokenSecret) {
    throw new Error(
      "Clawbird: Missing required X API credentials. " +
        "Set them in plugins.entries.clawbird.config or via environment variables: " +
        `${ENV_KEYS.apiKey}, ${ENV_KEYS.apiSecret}, ${ENV_KEYS.accessToken}, ${ENV_KEYS.accessTokenSecret}`,
    );
  }

  return cfg;
}

/**
 * Create X API clients from resolved config.
 */
export function createClients(config: ClawbirdConfig): XClients {
  const oauth1 = new OAuth1({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    accessToken: config.accessToken,
    accessTokenSecret: config.accessTokenSecret,
    callback: "oob", // out-of-band; not used when tokens are already provided
  });

  const writeClient = new Client({ oauth1 });

  const readClient = config.bearerToken
    ? new Client({ bearerToken: config.bearerToken })
    : writeClient;

  return { writeClient, readClient };
}

/**
 * Cached authenticated user ID to avoid repeated API calls.
 */
let cachedUserId: string | null = null;

/**
 * Get the authenticated user's ID (cached after first call).
 */
export async function getAuthenticatedUserId(
  client: Client,
): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const response = await client.users.getMe();
  const id = response?.data?.id;
  if (!id) {
    throw new Error("Clawbird: Could not retrieve authenticated user ID");
  }
  cachedUserId = id;
  return id;
}

/**
 * Reset the cached user ID (useful for testing).
 */
export function resetCachedUserId(): void {
  cachedUserId = null;
}
