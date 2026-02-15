import { describe, it, expect, beforeEach } from "vitest";
import { executeLikeTweet } from "../../src/tools/like-tweet.js";
import { createMockClient, parseToolResult, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";
import { resetCachedUserId } from "../../src/client.js";

describe("executeLikeTweet", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
    resetCachedUserId();
  });

  it("likes a tweet by ID", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "user1", name: "Test User", username: "test" },
    });
    mockClient.users.likePost.mockResolvedValue({
      data: { liked: true },
    });

    const result = await executeLikeTweet(mockClient as any, { tweetId: "tweet1" });
    const data = parseToolResult(result);

    expect(data.liked).toBe(true);
    expect(data.tweetId).toBe("tweet1");
    expect(data.estimatedCost).toBe("$0.0050");
  });

  it("resolves user ID and calls likePost with correct params", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "myuser123", name: "Me", username: "me" },
    });
    mockClient.users.likePost.mockResolvedValue({ data: { liked: true } });

    await executeLikeTweet(mockClient as any, { tweetId: "abc123" });

    expect(mockClient.users.getMe).toHaveBeenCalled();
    expect(mockClient.users.likePost).toHaveBeenCalledWith("myuser123", {
      body: { tweetId: "abc123" },
    });
  });

  it("extracts tweet ID from URL", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "user1", name: "Me", username: "me" },
    });
    mockClient.users.likePost.mockResolvedValue({ data: { liked: true } });

    await executeLikeTweet(mockClient as any, {
      tweetId: "https://x.com/someone/status/99999",
    });

    expect(mockClient.users.likePost).toHaveBeenCalledWith("user1", {
      body: { tweetId: "99999" },
    });
  });

  it("tracks cost on success", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "user1", name: "Me", username: "me" },
    });
    mockClient.users.likePost.mockResolvedValue({ data: { liked: true } });

    await executeLikeTweet(mockClient as any, { tweetId: "1" });

    expect(costTracker.totalCost).toBe(0.005);
  });

  it("caches user ID on second call", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "user1", name: "Me", username: "me" },
    });
    mockClient.users.likePost.mockResolvedValue({ data: { liked: true } });

    await executeLikeTweet(mockClient as any, { tweetId: "1" });
    await executeLikeTweet(mockClient as any, { tweetId: "2" });

    // getMe should only be called once due to caching
    expect(mockClient.users.getMe).toHaveBeenCalledTimes(1);
  });

  it("returns error when getMe fails", async () => {
    mockClient.users.getMe.mockRejectedValue(new Error("Auth failed"));

    const result = await executeLikeTweet(mockClient as any, { tweetId: "1" });
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to like tweet");
    expect(data.error).toContain("Auth failed");
  });

  it("returns error when likePost fails", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "user1", name: "Me", username: "me" },
    });
    mockClient.users.likePost.mockRejectedValue(new Error("Already liked"));

    const result = await executeLikeTweet(mockClient as any, { tweetId: "1" });
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to like tweet");
    expect(data.error).toContain("Already liked");
  });
});
