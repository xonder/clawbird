import { describe, it, expect, beforeEach } from "vitest";
import { executeSearchTweets } from "../../src/tools/search-tweets.js";
import { createMockClient, parseToolResult, mockRawResponse, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";

describe("executeSearchTweets", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
  });

  it("searches tweets and returns results with rate limit info", async () => {
    mockClient.posts.searchRecent.mockResolvedValue(
      mockRawResponse(
        {
          data: [
            { id: "t1", text: "Hello AI", author_id: "a1", created_at: "2026-02-10T00:00:00Z", public_metrics: { like_count: 5 } },
            { id: "t2", text: "AI is cool", author_id: "a2", created_at: "2026-02-11T00:00:00Z", public_metrics: { like_count: 10 } },
          ],
        },
        { remaining: 178, limit: 180, reset: 1739600000 },
      ),
    );

    const result = await executeSearchTweets(mockClient as any, { query: "AI" });
    const data = parseToolResult(result);

    expect(data.query).toBe("AI");
    expect(data.resultCount).toBe(2);
    expect(data.tweets).toHaveLength(2);
    expect(data.tweets[0].id).toBe("t1");
    expect(data.rateLimit).toBeDefined();
    expect(data.rateLimit.remaining).toBe(178);
    expect(data.rateLimit.limit).toBe(180);
    expect(data.estimatedCost).toBe("$0.0100");
  });

  it("passes query and maxResults to searchRecent", async () => {
    mockClient.posts.searchRecent.mockResolvedValue(
      mockRawResponse({ data: [] }),
    );

    await executeSearchTweets(mockClient as any, { query: "#test", maxResults: 50 });

    expect(mockClient.posts.searchRecent).toHaveBeenCalledWith("#test", {
      maxResults: 50,
      tweetFields: ["created_at", "author_id", "public_metrics", "conversation_id"],
      requestOptions: { raw: true },
    });
  });

  it("uses default maxResults of 10", async () => {
    mockClient.posts.searchRecent.mockResolvedValue(
      mockRawResponse({ data: [] }),
    );

    await executeSearchTweets(mockClient as any, { query: "test" });

    expect(mockClient.posts.searchRecent).toHaveBeenCalledWith("test", expect.objectContaining({ maxResults: 10 }));
  });

  it("tracks cost based on result count", async () => {
    mockClient.posts.searchRecent.mockResolvedValue(
      mockRawResponse({ data: [{ id: "1" }, { id: "2" }, { id: "3" }] }),
    );

    await executeSearchTweets(mockClient as any, { query: "test" });
    expect(costTracker.totalCost).toBe(0.015);
  });

  it("handles empty results", async () => {
    mockClient.posts.searchRecent.mockResolvedValue(
      mockRawResponse({ data: [] }),
    );

    const result = await executeSearchTweets(mockClient as any, { query: "nothing" });
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(0);
    expect(data.tweets).toHaveLength(0);
  });

  it("handles null data response", async () => {
    mockClient.posts.searchRecent.mockResolvedValue(
      mockRawResponse({ data: null }),
    );

    const result = await executeSearchTweets(mockClient as any, { query: "nothing" });
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(0);
  });

  it("returns error for empty query", async () => {
    const result = await executeSearchTweets(mockClient as any, { query: "" });
    const data = parseToolResult(result);
    expect(data.error).toContain("Search query cannot be empty");
  });

  it("returns error when API throws", async () => {
    mockClient.posts.searchRecent.mockRejectedValue(new Error("Rate limited"));

    const result = await executeSearchTweets(mockClient as any, { query: "test" });
    const data = parseToolResult(result);
    expect(data.error).toContain("Failed to search tweets");
  });

  it("returns structured error on 429 rate limit", async () => {
    const apiError = {
      status: 429,
      statusText: "Too Many Requests",
      headers: new Headers({
        "x-rate-limit-remaining": "0",
        "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 300),
      }),
      message: "Too Many Requests",
    };
    mockClient.posts.searchRecent.mockRejectedValue(apiError);

    const result = await executeSearchTweets(mockClient as any, { query: "test" });
    const data = parseToolResult(result);

    expect(data.rateLimited).toBe(true);
    expect(data.retryAfterSeconds).toBeGreaterThan(0);
    expect(data.resetsAt).toBeTruthy();
  });
});
