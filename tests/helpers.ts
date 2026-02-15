import { vi } from "vitest";

/**
 * Create a mock Response object simulating a raw API response.
 * Used for tools that call SDK methods with { requestOptions: { raw: true } }.
 */
export function mockRawResponse(
  body: unknown,
  rateLimitHeaders?: {
    remaining?: number;
    limit?: number;
    reset?: number;
  },
): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (rateLimitHeaders?.remaining !== undefined) {
    headers["x-rate-limit-remaining"] = String(rateLimitHeaders.remaining);
  }
  if (rateLimitHeaders?.limit !== undefined) {
    headers["x-rate-limit-limit"] = String(rateLimitHeaders.limit);
  }
  if (rateLimitHeaders?.reset !== undefined) {
    headers["x-rate-limit-reset"] = String(rateLimitHeaders.reset);
  }
  return new Response(JSON.stringify(body), { status: 200, headers });
}

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
      followUser: vi.fn(),
      unfollowUser: vi.fn(),
    },
    directMessages: {
      createByParticipantId: vi.fn(),
      createByConversationId: vi.fn(),
      createConversation: vi.fn(),
      getEventsByParticipantId: vi.fn(),
      getEventsByConversationId: vi.fn(),
      getEvents: vi.fn(),
      getEventsById: vi.fn(),
      deleteEvents: vi.fn(),
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
