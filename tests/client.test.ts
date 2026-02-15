import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveConfig, createClients, resetCachedUserId, getAuthenticatedUserId } from "../src/client.js";
import { createMockClient, type MockClient } from "./helpers.js";

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

describe("getAuthenticatedUserId", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    resetCachedUserId();
  });

  it("returns user ID from getMe response", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "user123", name: "Test", username: "test" },
    });

    const id = await getAuthenticatedUserId(mockClient as any);
    expect(id).toBe("user123");
  });

  it("caches user ID across calls", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "cached1", name: "Cached", username: "cached" },
    });

    await getAuthenticatedUserId(mockClient as any);
    await getAuthenticatedUserId(mockClient as any);
    await getAuthenticatedUserId(mockClient as any);

    expect(mockClient.users.getMe).toHaveBeenCalledTimes(1);
  });

  it("throws when getMe returns no data", async () => {
    mockClient.users.getMe.mockResolvedValue({ data: null });

    await expect(getAuthenticatedUserId(mockClient as any)).rejects.toThrow(
      "Could not retrieve authenticated user ID",
    );
  });

  it("throws when getMe returns data without id", async () => {
    mockClient.users.getMe.mockResolvedValue({ data: {} });

    await expect(getAuthenticatedUserId(mockClient as any)).rejects.toThrow(
      "Could not retrieve authenticated user ID",
    );
  });

  it("cache resets after resetCachedUserId", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "first", name: "First", username: "first" },
    });

    const first = await getAuthenticatedUserId(mockClient as any);
    expect(first).toBe("first");

    resetCachedUserId();

    mockClient.users.getMe.mockResolvedValue({
      data: { id: "second", name: "Second", username: "second" },
    });

    const second = await getAuthenticatedUserId(mockClient as any);
    expect(second).toBe("second");
    expect(mockClient.users.getMe).toHaveBeenCalledTimes(2);
  });
});

describe("resetCachedUserId", () => {
  it("is callable without error", () => {
    expect(() => resetCachedUserId()).not.toThrow();
  });
});
