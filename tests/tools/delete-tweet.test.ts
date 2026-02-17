import { describe, it, expect, beforeEach } from "vitest";
import { executeDeleteTweet } from "../../src/tools/delete-tweet.js";
import { createMockClient, parseToolResult, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";

describe("executeDeleteTweet", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
  });

  it("deletes a tweet by ID", async () => {
    mockClient.posts.delete.mockResolvedValue({
      data: { deleted: true },
    });

    const result = await executeDeleteTweet(mockClient as any, { tweetId: "123456" });
    const data = parseToolResult(result);

    expect(data.deleted).toBe(true);
    expect(data.tweetId).toBe("123456");
    expect(data.estimatedCost).toBeDefined();
  });

  it("calls posts.delete with correct ID", async () => {
    mockClient.posts.delete.mockResolvedValue({ data: { deleted: true } });

    await executeDeleteTweet(mockClient as any, { tweetId: "99999" });

    expect(mockClient.posts.delete).toHaveBeenCalledWith("99999");
  });

  it("extracts tweet ID from URL", async () => {
    mockClient.posts.delete.mockResolvedValue({ data: { deleted: true } });

    await executeDeleteTweet(mockClient as any, {
      tweetId: "https://x.com/myuser/status/55555",
    });

    expect(mockClient.posts.delete).toHaveBeenCalledWith("55555");
  });

  it("tracks cost on success", async () => {
    mockClient.posts.delete.mockResolvedValue({ data: { deleted: true } });

    await executeDeleteTweet(mockClient as any, { tweetId: "1" });
    expect(costTracker.totalCost).toBe(0.01);
  });

  it("returns error when API throws", async () => {
    mockClient.posts.delete.mockRejectedValue(new Error("Not found"));

    const result = await executeDeleteTweet(mockClient as any, { tweetId: "1" });
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to delete tweet");
    expect(data.error).toContain("Not found");
  });

  it("returns error when not authorized to delete", async () => {
    mockClient.posts.delete.mockRejectedValue(new Error("Forbidden"));

    const result = await executeDeleteTweet(mockClient as any, { tweetId: "1" });
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to delete tweet");
  });

  it("returns structured error on 429", async () => {
    mockClient.posts.delete.mockRejectedValue({
      status: 429,
      headers: new Headers({ "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 60) }),
    });

    const result = await executeDeleteTweet(mockClient as any, { tweetId: "1" });
    const data = parseToolResult(result);
    expect(data.rateLimited).toBe(true);
  });
});
