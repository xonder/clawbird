import { describe, it, expect, beforeEach } from "vitest";
import { executeReplyTweet } from "../../src/tools/reply-tweet.js";
import { createMockClient, parseToolResult, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";

describe("executeReplyTweet", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
  });

  it("replies to a tweet by ID", async () => {
    mockClient.posts.create.mockResolvedValue({
      data: { id: "200", text: "My reply" },
    });

    const result = await executeReplyTweet(mockClient as any, {
      tweetId: "100",
      text: "My reply",
    });
    const data = parseToolResult(result);

    expect(data.id).toBe("200");
    expect(data.text).toBe("My reply");
    expect(data.inReplyTo).toBe("100");
    expect(data.url).toContain("200");
  });

  it("sends reply parameter to posts.create", async () => {
    mockClient.posts.create.mockResolvedValue({
      data: { id: "200", text: "reply" },
    });

    await executeReplyTweet(mockClient as any, {
      tweetId: "12345",
      text: "reply text",
    });

    expect(mockClient.posts.create).toHaveBeenCalledWith({
      text: "reply text",
      reply: { inReplyToTweetId: "12345" },
    });
  });

  it("extracts tweet ID from URL", async () => {
    mockClient.posts.create.mockResolvedValue({
      data: { id: "300", text: "reply" },
    });

    await executeReplyTweet(mockClient as any, {
      tweetId: "https://x.com/someuser/status/98765",
      text: "reply",
    });

    expect(mockClient.posts.create).toHaveBeenCalledWith({
      text: "reply",
      reply: { inReplyToTweetId: "98765" },
    });
  });

  it("extracts tweet ID from twitter.com URL", async () => {
    mockClient.posts.create.mockResolvedValue({
      data: { id: "300", text: "reply" },
    });

    await executeReplyTweet(mockClient as any, {
      tweetId: "https://twitter.com/user/status/55555",
      text: "reply",
    });

    expect(mockClient.posts.create).toHaveBeenCalledWith({
      text: "reply",
      reply: { inReplyToTweetId: "55555" },
    });
  });

  it("tracks cost on success", async () => {
    mockClient.posts.create.mockResolvedValue({
      data: { id: "1", text: "test" },
    });

    await executeReplyTweet(mockClient as any, { tweetId: "1", text: "test" });

    expect(costTracker.totalCost).toBe(0.01);
  });

  it("returns error for empty text", async () => {
    const result = await executeReplyTweet(mockClient as any, {
      tweetId: "123",
      text: "",
    });
    const data = parseToolResult(result);

    expect(data.error).toContain("Reply text cannot be empty");
  });

  it("returns error when API throws", async () => {
    mockClient.posts.create.mockRejectedValue(new Error("Not found"));

    const result = await executeReplyTweet(mockClient as any, {
      tweetId: "123",
      text: "test",
    });
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to reply");
    expect(data.error).toContain("Not found");
  });
});
