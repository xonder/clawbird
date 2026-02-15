import { describe, it, expect, beforeEach } from "vitest";
import { executePostThread } from "../../src/tools/post-thread.js";
import { createMockClient, parseToolResult, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";

describe("executePostThread", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
  });

  it("posts a thread of 3 tweets chained as replies", async () => {
    mockClient.posts.create
      .mockResolvedValueOnce({ data: { id: "100", text: "Tweet 1" } })
      .mockResolvedValueOnce({ data: { id: "101", text: "Tweet 2" } })
      .mockResolvedValueOnce({ data: { id: "102", text: "Tweet 3" } });

    const result = await executePostThread(mockClient as any, {
      tweets: ["Tweet 1", "Tweet 2", "Tweet 3"],
    });
    const data = parseToolResult(result);

    expect(data.threadId).toBe("100");
    expect(data.tweetCount).toBe(3);
    expect(data.tweets).toHaveLength(3);
    expect(data.tweets[0].id).toBe("100");
    expect(data.tweets[1].id).toBe("101");
    expect(data.tweets[2].id).toBe("102");
  });

  it("first tweet has no reply, subsequent tweets are replies", async () => {
    mockClient.posts.create
      .mockResolvedValueOnce({ data: { id: "100", text: "Tweet 1" } })
      .mockResolvedValueOnce({ data: { id: "101", text: "Tweet 2" } })
      .mockResolvedValueOnce({ data: { id: "102", text: "Tweet 3" } });

    await executePostThread(mockClient as any, {
      tweets: ["Tweet 1", "Tweet 2", "Tweet 3"],
    });

    // First call: no reply
    expect(mockClient.posts.create.mock.calls[0][0]).toEqual({ text: "Tweet 1" });

    // Second call: reply to first
    expect(mockClient.posts.create.mock.calls[1][0]).toEqual({
      text: "Tweet 2",
      reply: { inReplyToTweetId: "100" },
    });

    // Third call: reply to second
    expect(mockClient.posts.create.mock.calls[2][0]).toEqual({
      text: "Tweet 3",
      reply: { inReplyToTweetId: "101" },
    });
  });

  it("tracks cost for all tweets in the thread", async () => {
    mockClient.posts.create
      .mockResolvedValueOnce({ data: { id: "1", text: "a" } })
      .mockResolvedValueOnce({ data: { id: "2", text: "b" } });

    await executePostThread(mockClient as any, { tweets: ["a", "b"] });

    expect(costTracker.totalCost).toBe(0.02);
  });

  it("returns error for empty tweets array", async () => {
    const result = await executePostThread(mockClient as any, { tweets: [] });
    const data = parseToolResult(result);

    expect(data.error).toContain("at least one tweet");
  });

  it("returns error for tweet with empty text", async () => {
    const result = await executePostThread(mockClient as any, {
      tweets: ["Good", "", "Bad"],
    });
    const data = parseToolResult(result);

    expect(data.error).toContain("index 1");
    expect(data.error).toContain("empty");
  });

  it("returns error when a mid-thread tweet fails", async () => {
    mockClient.posts.create
      .mockResolvedValueOnce({ data: { id: "100", text: "Tweet 1" } })
      .mockResolvedValueOnce({ data: {} }); // No ID

    const result = await executePostThread(mockClient as any, {
      tweets: ["Tweet 1", "Tweet 2"],
    });
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to create tweet in thread");
    expect(data.details.postedSoFar).toHaveLength(1);
  });

  it("returns error when API throws", async () => {
    mockClient.posts.create.mockRejectedValue(new Error("Server error"));

    const result = await executePostThread(mockClient as any, {
      tweets: ["test"],
    });
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to post thread");
    expect(data.error).toContain("Server error");
  });

  it("handles a single-tweet thread", async () => {
    mockClient.posts.create.mockResolvedValue({
      data: { id: "50", text: "Solo tweet" },
    });

    const result = await executePostThread(mockClient as any, {
      tweets: ["Solo tweet"],
    });
    const data = parseToolResult(result);

    expect(data.tweetCount).toBe(1);
    expect(data.threadId).toBe("50");
  });
});
