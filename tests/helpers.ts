import { vi } from "vitest";

/**
 * Create a mock OpenClaw plugin API object that captures tool registrations.
 */
export function createMockApi() {
  const tools: Map<
    string,
    {
      name: string;
      description: string;
      parameters: unknown;
      execute: (sessionId: string, params: unknown) => Promise<unknown>;
    }
  > = new Map();

  const api = {
    pluginConfig: {
      apiKey: "test-api-key",
      apiSecret: "test-api-secret",
      accessToken: "test-access-token",
      accessTokenSecret: "test-access-token-secret",
      bearerToken: "test-bearer-token",
    },
    registerTool: vi.fn((tool: { name: string; description: string; parameters: unknown; execute: Function }) => {
      tools.set(tool.name, tool as any);
    }),
    tools,
  };

  return api;
}

/**
 * Create a mock X Client with all needed sub-clients.
 */
export function createMockClient() {
  const client = {
    posts: {
      create: vi.fn(),
      searchRecent: vi.fn(),
      getById: vi.fn(),
      delete: vi.fn(),
    },
    users: {
      getMe: vi.fn(),
      getByUsername: vi.fn(),
      getMentions: vi.fn(),
      likePost: vi.fn(),
      unlikePost: vi.fn(),
      getPosts: vi.fn(),
      getFollowers: vi.fn(),
      getFollowing: vi.fn(),
    },
  };

  return client;
}

/**
 * Parse the JSON text from a tool result.
 */
export function parseToolResult(result: { content: Array<{ type: string; text: string }> }) {
  return JSON.parse(result.content[0].text);
}

/**
 * Type alias for the mock client.
 */
export type MockClient = ReturnType<typeof createMockClient>;
