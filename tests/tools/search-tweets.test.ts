import { describe, it, expect, beforeEach } from "vitest";
import { executeSearchTweets } from "../../src/tools/search-tweets.js";
import { createMockClient, parseToolResult, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";

describe("executeSearchTweets", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
  });

  it("searches tweets and returns results", async () => {
    mockClient.posts.searchRecent.mockResolvedValue({
      data: [
        {
          id: "t1",
          text: "Hello AI",
          authorId: "a1",
          createdAt: "2026-02-10T00:00:00Z",
          publicMetrics: { likeCount: 5, retweetCount: 2 },
        },
        {
          id: "t2",
          text: "AI is cool",
          authorId: "a2",
          createdAt: "2026-02-11T00:00:00Z",
          publicMetrics: { likeCount: 10, retweetCount: 3 },
        },
      ],
    });

    const result = await executeSearchTweets(mockClient as any, { query: "AI" });
    const data = parseToolResult(result);

    expect(data.query).toBe("AI");
    expect(data.resultCount).toBe(2);
    expect(data.tweets).toHaveLength(2);
    expect(data.tweets[0].id).toBe("t1");
    expect(data.tweets[0].text).toBe("Hello AI");
    expect(data.tweets[0].url).toContain("t1");
    expect(data.estimatedCost).toBe("$0.0100");
  });

  it("passes query and maxResults to searchRecent", async () => {
    mockClient.posts.searchRecent.mockResolvedValue({ data: [] });

    await executeSearchTweets(mockClient as any, { query: "#test", maxResults: 50 });

    expect(mockClient.posts.searchRecent).toHaveBeenCalledWith("#test", {
      maxResults: 50,
      tweetFields: ["created_at", "author_id", "public_metrics", "conversation_id"],
    });
  });

  it("uses default maxResults of 10", async () => {
    mockClient.posts.searchRecent.mockResolvedValue({ data: [] });

    await executeSearchTweets(mockClient as any, { query: "test" });

    expect(mockClient.posts.searchRecent).toHaveBeenCalledWith("test", {
      maxResults: 10,
      tweetFields: expect.any(Array),
    });
  });

  it("tracks cost based on result count", async () => {
    mockClient.posts.searchRecent.mockResolvedValue({
      data: [
        { id: "1", text: "a" },
        { id: "2", text: "b" },
        { id: "3", text: "c" },
      ],
    });

    await executeSearchTweets(mockClient as any, { query: "test" });

    // 3 results * $0.005 = $0.015
    expect(costTracker.totalCost).toBe(0.015);
  });

  it("handles empty results", async () => {
    mockClient.posts.searchRecent.mockResolvedValue({ data: [] });

    const result = await executeSearchTweets(mockClient as any, { query: "nothing" });
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(0);
    expect(data.tweets).toHaveLength(0);
    expect(data.estimatedCost).toBe("$0.0000");
  });

  it("handles null data response", async () => {
    mockClient.posts.searchRecent.mockResolvedValue({ data: null });

    const result = await executeSearchTweets(mockClient as any, { query: "nothing" });
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(0);
    expect(data.tweets).toHaveLength(0);
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
    expect(data.error).toContain("Rate limited");
  });
});
