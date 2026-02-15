import { describe, it, expect, beforeEach } from "vitest";
import { executeGetDms } from "../../src/tools/get-dms.js";
import { createMockClient, parseToolResult, mockRawResponse, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";

describe("executeGetDms", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
  });

  it("gets all recent DMs with rate limit info", async () => {
    mockClient.directMessages.getEvents.mockResolvedValue(
      mockRawResponse(
        {
          data: [
            { id: "dm1", text: "Hey there", sender_id: "s1", created_at: "2026-02-14T00:00:00Z", dm_conversation_id: "conv1", event_type: "MessageCreate" },
            { id: "dm2", text: "How are you?", sender_id: "s2", created_at: "2026-02-15T00:00:00Z", dm_conversation_id: "conv2", event_type: "MessageCreate" },
          ],
        },
        { remaining: 98, limit: 100, reset: 1739600000 },
      ),
    );

    const result = await executeGetDms(mockClient as any, {});
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(2);
    expect(data.messages).toHaveLength(2);
    expect(data.messages[0].id).toBe("dm1");
    expect(data.rateLimit).toBeDefined();
    expect(data.rateLimit.remaining).toBe(98);
    expect(data.withUser).toBeUndefined();
  });

  it("gets DMs with specific user when username provided", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "u42", name: "Alice", username: "alice" },
    });
    mockClient.directMessages.getEventsByParticipantId.mockResolvedValue(
      mockRawResponse({
        data: [{ id: "dm5", text: "Hello Alice", sender_id: "me", created_at: "2026-02-15T00:00:00Z", dm_conversation_id: "conv5", event_type: "MessageCreate" }],
      }),
    );

    const result = await executeGetDms(mockClient as any, { username: "alice" });
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(1);
    expect(data.withUser).toBe("alice");
  });

  it("uses default maxResults of 10", async () => {
    mockClient.directMessages.getEvents.mockResolvedValue(mockRawResponse({ data: [] }));

    await executeGetDms(mockClient as any, {});
    expect(mockClient.directMessages.getEvents).toHaveBeenCalledWith(expect.objectContaining({ maxResults: 10 }));
  });

  it("tracks cost based on result count", async () => {
    mockClient.directMessages.getEvents.mockResolvedValue(
      mockRawResponse({ data: [{ id: "1" }, { id: "2" }, { id: "3" }] }),
    );

    await executeGetDms(mockClient as any, {});
    expect(costTracker.totalCost).toBe(0.015);
  });

  it("handles empty results", async () => {
    mockClient.directMessages.getEvents.mockResolvedValue(mockRawResponse({ data: [] }));

    const result = await executeGetDms(mockClient as any, {});
    const data = parseToolResult(result);
    expect(data.resultCount).toBe(0);
    expect(data.estimatedCost).toBe("$0.0000");
  });

  it("returns error when user not found", async () => {
    mockClient.users.getByUsername.mockResolvedValue({ data: null });

    const result = await executeGetDms(mockClient as any, { username: "nobody" });
    const data = parseToolResult(result);
    expect(data.error).toContain("User @nobody not found");
  });

  it("returns error when API throws", async () => {
    mockClient.directMessages.getEvents.mockRejectedValue(new Error("Forbidden"));

    const result = await executeGetDms(mockClient as any, {});
    const data = parseToolResult(result);
    expect(data.error).toContain("Failed to get DMs");
  });

  it("returns structured error on 429", async () => {
    mockClient.directMessages.getEvents.mockRejectedValue({
      status: 429,
      headers: new Headers({ "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 60) }),
    });

    const result = await executeGetDms(mockClient as any, {});
    const data = parseToolResult(result);
    expect(data.rateLimited).toBe(true);
  });
});
