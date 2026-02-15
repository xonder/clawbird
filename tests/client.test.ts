import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveConfig, createClients, resetCachedUserId } from "../src/client.js";

describe("resolveConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it("returns config from pluginConfig when all fields provided", () => {
    const config = resolveConfig({
      apiKey: "key1",
      apiSecret: "secret1",
      accessToken: "token1",
      accessTokenSecret: "tokenSecret1",
      bearerToken: "bearer1",
    });

    expect(config.apiKey).toBe("key1");
    expect(config.apiSecret).toBe("secret1");
    expect(config.accessToken).toBe("token1");
    expect(config.accessTokenSecret).toBe("tokenSecret1");
    expect(config.bearerToken).toBe("bearer1");
  });

  it("falls back to environment variables", () => {
    process.env.X_API_KEY = "env-key";
    process.env.X_API_SECRET = "env-secret";
    process.env.X_ACCESS_TOKEN = "env-token";
    process.env.X_ACCESS_SECRET = "env-token-secret";
    process.env.X_BEARER_TOKEN = "env-bearer";

    const config = resolveConfig({});

    expect(config.apiKey).toBe("env-key");
    expect(config.apiSecret).toBe("env-secret");
    expect(config.accessToken).toBe("env-token");
    expect(config.accessTokenSecret).toBe("env-token-secret");
    expect(config.bearerToken).toBe("env-bearer");
  });

  it("prefers pluginConfig over environment variables", () => {
    process.env.X_API_KEY = "env-key";

    const config = resolveConfig({
      apiKey: "plugin-key",
      apiSecret: "secret",
      accessToken: "token",
      accessTokenSecret: "tokenSecret",
    });

    expect(config.apiKey).toBe("plugin-key");
  });

  it("throws when required credentials are missing", () => {
    delete process.env.X_API_KEY;
    delete process.env.X_API_SECRET;
    delete process.env.X_ACCESS_TOKEN;
    delete process.env.X_ACCESS_SECRET;

    expect(() => resolveConfig({})).toThrow("Missing required X API credentials");
  });

  it("throws when apiKey is missing", () => {
    expect(() =>
      resolveConfig({
        apiSecret: "secret",
        accessToken: "token",
        accessTokenSecret: "tokenSecret",
      }),
    ).toThrow("Missing required X API credentials");
  });

  it("allows bearerToken to be optional", () => {
    const config = resolveConfig({
      apiKey: "key",
      apiSecret: "secret",
      accessToken: "token",
      accessTokenSecret: "tokenSecret",
    });

    expect(config.bearerToken).toBeUndefined();
  });
});

describe("createClients", () => {
  it("creates write and read clients", () => {
    const clients = createClients({
      apiKey: "key",
      apiSecret: "secret",
      accessToken: "token",
      accessTokenSecret: "tokenSecret",
    });

    expect(clients.writeClient).toBeDefined();
    expect(clients.readClient).toBeDefined();
  });

  it("uses same client for read/write when no bearer token", () => {
    const clients = createClients({
      apiKey: "key",
      apiSecret: "secret",
      accessToken: "token",
      accessTokenSecret: "tokenSecret",
    });

    expect(clients.readClient).toBe(clients.writeClient);
  });

  it("uses separate bearer client for reads when bearer token provided", () => {
    const clients = createClients({
      apiKey: "key",
      apiSecret: "secret",
      accessToken: "token",
      accessTokenSecret: "tokenSecret",
      bearerToken: "bearer",
    });

    expect(clients.readClient).not.toBe(clients.writeClient);
  });
});

describe("resetCachedUserId", () => {
  it("is callable without error", () => {
    expect(() => resetCachedUserId()).not.toThrow();
  });
});
