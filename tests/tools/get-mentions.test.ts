import { describe, it, expect, beforeEach } from "vitest";
import { executeGetMentions } from "../../src/tools/get-mentions.js";
import { createMockClient, parseToolResult, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";
import { resetCachedUserId } from "../../src/client.js";

describe("executeGetMentions", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
    resetCachedUserId();
  });

  it("retrieves mentions for authenticated user", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "me1", name: "Me", username: "me" },
    });
    mockClient.users.getMentions.mockResolvedValue({
      data: [
        {
          id: "m1",
          text: "Hey @me check this out",
          authorId: "a1",
          createdAt: "2026-02-14T00:00:00Z",
          publicMetrics: { likeCount: 3 },
        },
        {
          id: "m2",
          text: "@me great work!",
          authorId: "a2",
          createdAt: "2026-02-15T00:00:00Z",
        },
      ],
    });

    const result = await executeGetMentions(
      mockClient as any,
      mockClient as any,
      {},
    );
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(2);
    expect(data.mentions).toHaveLength(2);
    expect(data.mentions[0].id).toBe("m1");
    expect(data.mentions[0].text).toContain("Hey @me");
    expect(data.mentions[0].url).toContain("m1");
  });

  it("passes correct parameters to getMentions", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "me1", name: "Me", username: "me" },
    });
    mockClient.users.getMentions.mockResolvedValue({ data: [] });

    await executeGetMentions(mockClient as any, mockClient as any, { maxResults: 25 });

    expect(mockClient.users.getMentions).toHaveBeenCalledWith("me1", {
      maxResults: 25,
      tweetFields: ["created_at", "author_id", "public_metrics", "conversation_id"],
    });
  });

  it("uses default maxResults of 10", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "me1", name: "Me", username: "me" },
    });
    mockClient.users.getMentions.mockResolvedValue({ data: [] });

    await executeGetMentions(mockClient as any, mockClient as any, {});

    expect(mockClient.users.getMentions).toHaveBeenCalledWith("me1", {
      maxResults: 10,
      tweetFields: expect.any(Array),
    });
  });

  it("tracks cost based on result count", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "me1", name: "Me", username: "me" },
    });
    mockClient.users.getMentions.mockResolvedValue({
      data: [
        { id: "1", text: "a" },
        { id: "2", text: "b" },
        { id: "3", text: "c" },
        { id: "4", text: "d" },
      ],
    });

    await executeGetMentions(mockClient as any, mockClient as any, {});

    // 4 * $0.005 = $0.02
    expect(costTracker.totalCost).toBe(0.02);
  });

  it("handles empty mentions", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "me1", name: "Me", username: "me" },
    });
    mockClient.users.getMentions.mockResolvedValue({ data: [] });

    const result = await executeGetMentions(
      mockClient as any,
      mockClient as any,
      {},
    );
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(0);
    expect(data.mentions).toHaveLength(0);
  });

  it("handles null data response", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "me1", name: "Me", username: "me" },
    });
    mockClient.users.getMentions.mockResolvedValue({ data: null });

    const result = await executeGetMentions(
      mockClient as any,
      mockClient as any,
      {},
    );
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(0);
  });

  it("returns error when getMe fails", async () => {
    mockClient.users.getMe.mockRejectedValue(new Error("Unauthorized"));

    const result = await executeGetMentions(
      mockClient as any,
      mockClient as any,
      {},
    );
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to get mentions");
    expect(data.error).toContain("Unauthorized");
  });

  it("returns error when getMentions fails", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "me1", name: "Me", username: "me" },
    });
    mockClient.users.getMentions.mockRejectedValue(new Error("Rate limited"));

    const result = await executeGetMentions(
      mockClient as any,
      mockClient as any,
      {},
    );
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to get mentions");
    expect(data.error).toContain("Rate limited");
  });
});
