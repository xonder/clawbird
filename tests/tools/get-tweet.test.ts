import { describe, it, expect, beforeEach } from "vitest";
import { executeGetTweet } from "../../src/tools/get-tweet.js";
import { createMockClient, parseToolResult, mockRawResponse, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";

describe("executeGetTweet", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
  });

  it("fetches a tweet by numeric ID with rate limit info", async () => {
    mockClient.posts.getById.mockResolvedValue(
      mockRawResponse(
        {
          data: {
            id: "123456",
            text: "Hello world!",
            author_id: "a1",
            created_at: "2026-02-15T00:00:00Z",
            public_metrics: { like_count: 42, retweet_count: 5 },
            conversation_id: "123456",
            lang: "en",
          },
          includes: {
            users: [{ id: "a1", name: "Alice", username: "alice", verified: true }],
          },
        },
        { remaining: 899, limit: 900, reset: 1739600000 },
      ),
    );

    const result = await executeGetTweet(mockClient as any, { tweetId: "123456" });
    const data = parseToolResult(result);

    expect(data.id).toBe("123456");
    expect(data.text).toBe("Hello world!");
    expect(data.author.username).toBe("alice");
    expect(data.url).toBe("https://x.com/alice/status/123456");
    expect(data.rateLimit).toBeDefined();
    expect(data.rateLimit.remaining).toBe(899);
  });

  it("extracts tweet ID from x.com URL", async () => {
    mockClient.posts.getById.mockResolvedValue(
      mockRawResponse({ data: { id: "2022729815242215865", text: "A tweet" } }),
    );

    await executeGetTweet(mockClient as any, {
      tweetId: "https://x.com/Pauline_Cx/status/2022729815242215865",
    });

    expect(mockClient.posts.getById).toHaveBeenCalledWith("2022729815242215865", expect.any(Object));
  });

  it("extracts tweet ID from twitter.com URL", async () => {
    mockClient.posts.getById.mockResolvedValue(
      mockRawResponse({ data: { id: "99999", text: "Old tweet" } }),
    );

    await executeGetTweet(mockClient as any, { tweetId: "https://twitter.com/user/status/99999" });
    expect(mockClient.posts.getById).toHaveBeenCalledWith("99999", expect.any(Object));
  });

  it("extracts tweet ID from URL with query params", async () => {
    mockClient.posts.getById.mockResolvedValue(
      mockRawResponse({ data: { id: "55555", text: "Tweet" } }),
    );

    await executeGetTweet(mockClient as any, { tweetId: "https://x.com/user/status/55555?s=20&t=abc" });
    expect(mockClient.posts.getById).toHaveBeenCalledWith("55555", expect.any(Object));
  });

  it("tracks cost on success", async () => {
    mockClient.posts.getById.mockResolvedValue(
      mockRawResponse({ data: { id: "1", text: "t" } }),
    );

    await executeGetTweet(mockClient as any, { tweetId: "1" });
    expect(costTracker.totalCost).toBe(0.005);
  });

  it("handles tweet without author includes", async () => {
    mockClient.posts.getById.mockResolvedValue(
      mockRawResponse({ data: { id: "1", text: "Orphan tweet", author_id: "unknown" } }),
    );

    const result = await executeGetTweet(mockClient as any, { tweetId: "1" });
    const data = parseToolResult(result);

    expect(data.author).toBeNull();
    expect(data.url).toContain("/i/status/1");
  });

  it("returns error when tweet not found", async () => {
    mockClient.posts.getById.mockResolvedValue(
      mockRawResponse({ data: null }),
    );

    const result = await executeGetTweet(mockClient as any, { tweetId: "9999" });
    const data = parseToolResult(result);
    expect(data.error).toContain("Tweet 9999 not found");
  });

  it("returns error when API throws", async () => {
    mockClient.posts.getById.mockRejectedValue(new Error("Not Found"));

    const result = await executeGetTweet(mockClient as any, { tweetId: "1" });
    const data = parseToolResult(result);
    expect(data.error).toContain("Failed to get tweet");
  });

  it("returns structured error on 429", async () => {
    mockClient.posts.getById.mockRejectedValue({
      status: 429,
      headers: new Headers({ "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 60) }),
    });

    const result = await executeGetTweet(mockClient as any, { tweetId: "1" });
    const data = parseToolResult(result);
    expect(data.rateLimited).toBe(true);
    expect(data.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("does not track cost on failure", async () => {
    mockClient.posts.getById.mockRejectedValue(new Error("fail"));
    await executeGetTweet(mockClient as any, { tweetId: "1" });
    expect(costTracker.totalCost).toBe(0);
  });
});
