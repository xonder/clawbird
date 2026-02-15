import { describe, it, expect, beforeEach } from "vitest";
import { executePostTweet } from "../../src/tools/post-tweet.js";
import { createMockClient, parseToolResult, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";

describe("executePostTweet", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
  });

  it("posts a tweet and returns id, text, url", async () => {
    mockClient.posts.create.mockResolvedValue({
      data: { id: "123456789", text: "Hello world!" },
    });

    const result = await executePostTweet(mockClient as any, { text: "Hello world!" });
    const data = parseToolResult(result);

    expect(data.id).toBe("123456789");
    expect(data.text).toBe("Hello world!");
    expect(data.url).toBe("https://x.com/i/status/123456789");
    expect(data.estimatedCost).toBe("$0.0100");
  });

  it("calls posts.create with correct text", async () => {
    mockClient.posts.create.mockResolvedValue({ data: { id: "1", text: "test" } });
    await executePostTweet(mockClient as any, { text: "My tweet" });
    expect(mockClient.posts.create).toHaveBeenCalledWith({ text: "My tweet" });
  });

  it("tracks cost after successful post", async () => {
    mockClient.posts.create.mockResolvedValue({ data: { id: "1", text: "test" } });
    await executePostTweet(mockClient as any, { text: "test" });
    expect(costTracker.totalCost).toBe(0.01);
  });

  it("returns error for empty text", async () => {
    const result = await executePostTweet(mockClient as any, { text: "" });
    const data = parseToolResult(result);
    expect(data.error).toBe("Tweet text cannot be empty");
    expect(mockClient.posts.create).not.toHaveBeenCalled();
  });

  it("returns error for whitespace-only text", async () => {
    const result = await executePostTweet(mockClient as any, { text: "   " });
    const data = parseToolResult(result);
    expect(data.error).toBe("Tweet text cannot be empty");
  });

  it("returns error when API returns no id", async () => {
    mockClient.posts.create.mockResolvedValue({ data: {} });
    const result = await executePostTweet(mockClient as any, { text: "test" });
    const data = parseToolResult(result);
    expect(data.error).toContain("Failed to create tweet");
  });

  it("returns error when API throws", async () => {
    mockClient.posts.create.mockRejectedValue(new Error("Rate limited"));
    const result = await executePostTweet(mockClient as any, { text: "test" });
    const data = parseToolResult(result);
    expect(data.error).toContain("Failed to post tweet");
  });

  it("does not track cost on failure", async () => {
    mockClient.posts.create.mockRejectedValue(new Error("fail"));
    await executePostTweet(mockClient as any, { text: "test" });
    expect(costTracker.totalCost).toBe(0);
  });

  it("handles non-Error thrown objects", async () => {
    mockClient.posts.create.mockRejectedValue("string error");
    const result = await executePostTweet(mockClient as any, { text: "test" });
    const data = parseToolResult(result);
    expect(data.error).toContain("Failed to post tweet");
  });

  it("returns structured error on 429 rate limit", async () => {
    mockClient.posts.create.mockRejectedValue({
      status: 429,
      statusText: "Too Many Requests",
      headers: new Headers({
        "x-rate-limit-remaining": "0",
        "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 300),
      }),
      message: "Too Many Requests",
    });

    const result = await executePostTweet(mockClient as any, { text: "test" });
    const data = parseToolResult(result);

    expect(data.rateLimited).toBe(true);
    expect(data.retryAfterSeconds).toBeGreaterThan(0);
    expect(data.resetsAt).toBeTruthy();
    expect(data.error).toContain("Rate limit exceeded");
  });
});
