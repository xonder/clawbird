import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import clawbird from "../src/index.js";
import { resetCachedUserId } from "../src/client.js";
import { costTracker } from "../src/costs.js";

/**
 * Integration tests that exercise the full plugin flow:
 * register tools via clawbird() → invoke execute through the registered tool.
 *
 * These mock the underlying HTTP layer (Client) by patching the module,
 * but exercise all the wiring from entry point through tool execution.
 */

// We can't easily mock the Client constructor at the module level,
// so we test by calling the execute functions captured during registration
// and verify they produce valid tool results (the lazy client init will throw
// since there are no real credentials — so we test the wiring up to that point).

describe("Integration: plugin registration and tool invocation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetCachedUserId();
    costTracker.reset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("registered tools produce credential errors when invoked without config", async () => {
    // No credentials anywhere
    delete process.env.X_API_KEY;
    delete process.env.X_API_SECRET;
    delete process.env.X_ACCESS_TOKEN;
    delete process.env.X_ACCESS_SECRET;
    delete process.env.X_BEARER_TOKEN;

    const tools = new Map<string, { execute: Function }>();
    const api = {
      pluginConfig: undefined,
      registerTool: vi.fn((tool: { name: string; execute: Function }) => {
        tools.set(tool.name, tool);
      }),
    };

    clawbird(api);
    expect(tools.size).toBe(14);

    // Invoking any tool should fail with a credential error (lazy init fires)
    const postTweet = tools.get("x_post_tweet")!;
    const result = (await postTweet.execute("session1", { text: "hello" })) as {
      content: Array<{ text: string }>;
    };
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toContain("Missing required X API credentials");
  });

  it("all tool descriptions are non-empty and mention X/Twitter", () => {
    const tools: Array<{ name: string; description: string }> = [];
    const api = {
      pluginConfig: { apiKey: "k", apiSecret: "s", accessToken: "t", accessTokenSecret: "ts" },
      registerTool: vi.fn((tool: { name: string; description: string }) => {
        tools.push(tool);
      }),
    };

    clawbird(api);

    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.description.toLowerCase()).toMatch(/x\/twitter|x\//);
    }
  });

  it("tool names are unique", () => {
    const names: string[] = [];
    const api = {
      pluginConfig: { apiKey: "k", apiSecret: "s", accessToken: "t", accessTokenSecret: "ts" },
      registerTool: vi.fn((tool: { name: string }) => {
        names.push(tool.name);
      }),
    };

    clawbird(api);

    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("all tool parameters are TypeBox-compatible JSON Schema objects", () => {
    const schemas: Array<{ name: string; parameters: Record<string, unknown> }> = [];
    const api = {
      pluginConfig: { apiKey: "k", apiSecret: "s", accessToken: "t", accessTokenSecret: "ts" },
      registerTool: vi.fn(
        (tool: { name: string; parameters: Record<string, unknown> }) => {
          schemas.push(tool);
        },
      ),
    };

    clawbird(api);

    for (const { name, parameters } of schemas) {
      expect(parameters.type).toBe("object");
      expect(parameters.properties).toBeDefined();
      // Required should be an array (or undefined for all-optional params)
      if (parameters.required !== undefined) {
        expect(Array.isArray(parameters.required)).toBe(true);
      }
    }
  });
});
