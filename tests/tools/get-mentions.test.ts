import { describe, it, expect, beforeEach } from "vitest";
import { executeGetMentions } from "../../src/tools/get-mentions.js";
import { createMockClient, parseToolResult, mockRawResponse, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";
import { resetCachedUserId } from "../../src/client.js";

describe("executeGetMentions", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
    resetCachedUserId();
  });

  it("retrieves mentions with rate limit info", async () => {
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "me1", name: "Me", username: "me" },
    });
    mockClient.users.getMentions.mockResolvedValue(
      mockRawResponse(
        {
          data: [
            { id: "m1", text: "Hey @me check this out", author_id: "a1", created_at: "2026-02-14T00:00:00Z" },
            { id: "m2", text: "@me great work!", author_id: "a2", created_at: "2026-02-15T00:00:00Z" },
          ],
        },
        { remaining: 178, limit: 180, reset: 1739600000 },
      ),
    );

    const result = await executeGetMentions(mockClient as any, mockClient as any, {});
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(2);
    expect(data.mentions).toHaveLength(2);
    expect(data.rateLimit).toBeDefined();
    expect(data.rateLimit.remaining).toBe(178);
  });

  it("uses default maxResults of 10", async () => {
    mockClient.users.getMe.mockResolvedValue({ data: { id: "me1", name: "Me", username: "me" } });
    mockClient.users.getMentions.mockResolvedValue(mockRawResponse({ data: [] }));

    await executeGetMentions(mockClient as any, mockClient as any, {});

    expect(mockClient.users.getMentions).toHaveBeenCalledWith("me1", expect.objectContaining({ maxResults: 10 }));
  });

  it("tracks cost based on result count", async () => {
    mockClient.users.getMe.mockResolvedValue({ data: { id: "me1", name: "Me", username: "me" } });
    mockClient.users.getMentions.mockResolvedValue(
      mockRawResponse({ data: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }] }),
    );

    await executeGetMentions(mockClient as any, mockClient as any, {});
    expect(costTracker.totalCost).toBe(0.02);
  });

  it("handles empty mentions", async () => {
    mockClient.users.getMe.mockResolvedValue({ data: { id: "me1", name: "Me", username: "me" } });
    mockClient.users.getMentions.mockResolvedValue(mockRawResponse({ data: [] }));

    const result = await executeGetMentions(mockClient as any, mockClient as any, {});
    const data = parseToolResult(result);
    expect(data.resultCount).toBe(0);
  });

  it("returns error when getMe fails", async () => {
    mockClient.users.getMe.mockRejectedValue(new Error("Unauthorized"));

    const result = await executeGetMentions(mockClient as any, mockClient as any, {});
    const data = parseToolResult(result);
    expect(data.error).toContain("Failed to get mentions");
  });

  it("returns structured error on 429", async () => {
    mockClient.users.getMe.mockResolvedValue({ data: { id: "me1", name: "Me", username: "me" } });
    mockClient.users.getMentions.mockRejectedValue({
      status: 429,
      headers: new Headers({ "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 60) }),
    });

    const result = await executeGetMentions(mockClient as any, mockClient as any, {});
    const data = parseToolResult(result);
    expect(data.rateLimited).toBe(true);
  });
});
