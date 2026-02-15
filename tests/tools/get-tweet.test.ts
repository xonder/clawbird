import { describe, it, expect, beforeEach } from "vitest";
import { executeGetTweet } from "../../src/tools/get-tweet.js";
import { createMockClient, parseToolResult, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";

describe("executeGetTweet", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
  });

  it("fetches a tweet by numeric ID", async () => {
    mockClient.posts.getById.mockResolvedValue({
      data: {
        id: "123456",
        text: "Hello world!",
        authorId: "a1",
        createdAt: "2026-02-15T00:00:00Z",
        publicMetrics: { likeCount: 42, retweetCount: 5 },
        conversationId: "123456",
        lang: "en",
      },
      includes: {
        users: [
          { id: "a1", name: "Alice", username: "alice", verified: true },
        ],
      },
    });

    const result = await executeGetTweet(mockClient as any, { tweetId: "123456" });
    const data = parseToolResult(result);

    expect(data.id).toBe("123456");
    expect(data.text).toBe("Hello world!");
    expect(data.authorId).toBe("a1");
    expect(data.author.username).toBe("alice");
    expect(data.author.verified).toBe(true);
    expect(data.url).toBe("https://x.com/alice/status/123456");
    expect(data.estimatedCost).toBeDefined();
  });

  it("extracts tweet ID from x.com URL", async () => {
    mockClient.posts.getById.mockResolvedValue({
      data: { id: "2022729815242215865", text: "A tweet" },
    });

    await executeGetTweet(mockClient as any, {
      tweetId: "https://x.com/Pauline_Cx/status/2022729815242215865",
    });

    expect(mockClient.posts.getById).toHaveBeenCalledWith(
      "2022729815242215865",
      expect.any(Object),
    );
  });

  it("extracts tweet ID from twitter.com URL", async () => {
    mockClient.posts.getById.mockResolvedValue({
      data: { id: "99999", text: "Old tweet" },
    });

    await executeGetTweet(mockClient as any, {
      tweetId: "https://twitter.com/user/status/99999",
    });

    expect(mockClient.posts.getById).toHaveBeenCalledWith("99999", expect.any(Object));
  });

  it("extracts tweet ID from URL with query params", async () => {
    mockClient.posts.getById.mockResolvedValue({
      data: { id: "55555", text: "Tweet" },
    });

    await executeGetTweet(mockClient as any, {
      tweetId: "https://x.com/user/status/55555?s=20&t=abc",
    });

    expect(mockClient.posts.getById).toHaveBeenCalledWith("55555", expect.any(Object));
  });

  it("requests tweet fields and author expansion", async () => {
    mockClient.posts.getById.mockResolvedValue({
      data: { id: "1", text: "t" },
    });

    await executeGetTweet(mockClient as any, { tweetId: "1" });

    expect(mockClient.posts.getById).toHaveBeenCalledWith("1", {
      tweetFields: expect.arrayContaining([
        "created_at",
        "author_id",
        "public_metrics",
      ]),
      expansions: ["author_id"],
      userFields: expect.arrayContaining(["name", "username", "verified"]),
    });
  });

  it("tracks cost on success", async () => {
    mockClient.posts.getById.mockResolvedValue({
      data: { id: "1", text: "t" },
    });

    await executeGetTweet(mockClient as any, { tweetId: "1" });

    expect(costTracker.totalCost).toBe(0.005);
  });

  it("handles tweet without author includes", async () => {
    mockClient.posts.getById.mockResolvedValue({
      data: { id: "1", text: "Orphan tweet", authorId: "unknown" },
      // No includes
    });

    const result = await executeGetTweet(mockClient as any, { tweetId: "1" });
    const data = parseToolResult(result);

    expect(data.id).toBe("1");
    expect(data.author).toBeNull();
    expect(data.url).toContain("/i/status/1");
  });

  it("returns error when tweet not found", async () => {
    mockClient.posts.getById.mockResolvedValue({ data: null });

    const result = await executeGetTweet(mockClient as any, { tweetId: "9999" });
    const data = parseToolResult(result);

    expect(data.error).toContain("Tweet 9999 not found");
  });

  it("returns error when API throws", async () => {
    mockClient.posts.getById.mockRejectedValue(new Error("Not Found"));

    const result = await executeGetTweet(mockClient as any, { tweetId: "1" });
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to get tweet");
    expect(data.error).toContain("Not Found");
  });

  it("does not track cost on failure", async () => {
    mockClient.posts.getById.mockRejectedValue(new Error("fail"));

    await executeGetTweet(mockClient as any, { tweetId: "1" });

    expect(costTracker.totalCost).toBe(0);
  });
});
