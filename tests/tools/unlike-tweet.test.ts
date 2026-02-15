import { describe, it, expect, beforeEach } from "vitest";
import { executeUnlikeTweet } from "../../src/tools/unlike-tweet.js";
import { createMockClient, parseToolResult, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";
import { resetCachedUserId } from "../../src/client.js";

describe("executeUnlikeTweet", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
    resetCachedUserId();
  });

  it("unlikes a tweet by ID", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "user1", name: "Test User", username: "test" },
    });
    mockClient.users.unlikePost.mockResolvedValue({
      data: { liked: false },
    });

    const result = await executeUnlikeTweet(mockClient as any, { tweetId: "tweet1" });
    const data = parseToolResult(result);

    expect(data.unliked).toBe(true);
    expect(data.tweetId).toBe("tweet1");
    expect(data.estimatedCost).toBe("$0.0050");
  });

  it("resolves user ID and calls unlikePost with correct params", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "myuser123", name: "Me", username: "me" },
    });
    mockClient.users.unlikePost.mockResolvedValue({ data: { liked: false } });

    await executeUnlikeTweet(mockClient as any, { tweetId: "abc123" });

    expect(mockClient.users.getMe).toHaveBeenCalled();
    expect(mockClient.users.unlikePost).toHaveBeenCalledWith("myuser123", "abc123");
  });

  it("extracts tweet ID from URL", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "user1", name: "Me", username: "me" },
    });
    mockClient.users.unlikePost.mockResolvedValue({ data: { liked: false } });

    await executeUnlikeTweet(mockClient as any, {
      tweetId: "https://x.com/someone/status/99999",
    });

    expect(mockClient.users.unlikePost).toHaveBeenCalledWith("user1", "99999");
  });

  it("tracks cost on success", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "user1", name: "Me", username: "me" },
    });
    mockClient.users.unlikePost.mockResolvedValue({ data: { liked: false } });

    await executeUnlikeTweet(mockClient as any, { tweetId: "1" });
    expect(costTracker.totalCost).toBe(0.005);
  });

  it("returns error when getMe fails", async () => {
    mockClient.users.getMe.mockRejectedValue(new Error("Auth failed"));

    const result = await executeUnlikeTweet(mockClient as any, { tweetId: "1" });
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to unlike tweet");
    expect(data.error).toContain("Auth failed");
  });

  it("returns error when unlikePost fails", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "user1", name: "Me", username: "me" },
    });
    mockClient.users.unlikePost.mockRejectedValue(new Error("Not liked"));

    const result = await executeUnlikeTweet(mockClient as any, { tweetId: "1" });
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to unlike tweet");
    expect(data.error).toContain("Not liked");
  });

  it("returns structured error on 429", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "user1", name: "Me", username: "me" },
    });
    mockClient.users.unlikePost.mockRejectedValue({
      status: 429,
      headers: new Headers({ "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 60) }),
    });

    const result = await executeUnlikeTweet(mockClient as any, { tweetId: "1" });
    const data = parseToolResult(result);
    expect(data.rateLimited).toBe(true);
  });
});
