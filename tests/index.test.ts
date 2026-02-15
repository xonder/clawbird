import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import clawbird from "../src/index.js";

describe("clawbird plugin entry point", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set env vars so resolveConfig doesn't throw during lazy init
    process.env.X_API_KEY = "test-key";
    process.env.X_API_SECRET = "test-secret";
    process.env.X_ACCESS_TOKEN = "test-token";
    process.env.X_ACCESS_SECRET = "test-token-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("registers all 7 tools", () => {
    const registeredTools: string[] = [];
    const api = {
      pluginConfig: {
        apiKey: "k",
        apiSecret: "s",
        accessToken: "t",
        accessTokenSecret: "ts",
      },
      registerTool: vi.fn((tool: { name: string }) => {
        registeredTools.push(tool.name);
      }),
    };

    clawbird(api);

    expect(registeredTools).toHaveLength(8);
    expect(registeredTools).toContain("x_post_tweet");
    expect(registeredTools).toContain("x_post_thread");
    expect(registeredTools).toContain("x_reply_tweet");
    expect(registeredTools).toContain("x_like_tweet");
    expect(registeredTools).toContain("x_search_tweets");
    expect(registeredTools).toContain("x_get_user_profile");
    expect(registeredTools).toContain("x_get_mentions");
    expect(registeredTools).toContain("x_get_cost_summary");
  });

  it("all registered tools have name, description, parameters, and execute", () => {
    const tools: Array<Record<string, unknown>> = [];
    const api = {
      pluginConfig: {
        apiKey: "k",
        apiSecret: "s",
        accessToken: "t",
        accessTokenSecret: "ts",
      },
      registerTool: vi.fn((tool: Record<string, unknown>) => {
        tools.push(tool);
      }),
    };

    clawbird(api);

    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });

  it("tool names start with x_ prefix", () => {
    const toolNames: string[] = [];
    const api = {
      pluginConfig: {
        apiKey: "k",
        apiSecret: "s",
        accessToken: "t",
        accessTokenSecret: "ts",
      },
      registerTool: vi.fn((tool: { name: string }) => {
        toolNames.push(tool.name);
      }),
    };

    clawbird(api);

    for (const name of toolNames) {
      expect(name).toMatch(/^x_/);
    }
  });

  it("does not create clients at registration time (lazy init)", () => {
    // If clients were created eagerly, this would fail without valid credentials
    const api = {
      pluginConfig: undefined, // no config at all
      registerTool: vi.fn(),
    };

    // Should not throw — clients are created lazily on first tool execution
    expect(() => clawbird(api)).not.toThrow();
    expect(api.registerTool).toHaveBeenCalledTimes(8);
  });
});
