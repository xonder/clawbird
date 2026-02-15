import { describe, it, expect, beforeEach } from "vitest";
import { executeGetDms } from "../../src/tools/get-dms.js";
import { createMockClient, parseToolResult, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";

describe("executeGetDms", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
  });

  it("gets all recent DMs when no username provided", async () => {
    mockClient.directMessages.getEvents.mockResolvedValue({
      data: [
        {
          id: "dm1",
          text: "Hey there",
          senderId: "s1",
          createdAt: "2026-02-14T00:00:00Z",
          dmConversationId: "conv1",
          eventType: "MessageCreate",
        },
        {
          id: "dm2",
          text: "How are you?",
          senderId: "s2",
          createdAt: "2026-02-15T00:00:00Z",
          dmConversationId: "conv2",
          eventType: "MessageCreate",
        },
      ],
    });

    const result = await executeGetDms(mockClient as any, {});
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(2);
    expect(data.messages).toHaveLength(2);
    expect(data.messages[0].id).toBe("dm1");
    expect(data.messages[0].text).toBe("Hey there");
    expect(data.messages[0].senderId).toBe("s1");
    expect(data.messages[0].conversationId).toBe("conv1");
    expect(data.withUser).toBeUndefined();
  });

  it("gets DMs with specific user when username provided", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "u42", name: "Alice", username: "alice" },
    });
    mockClient.directMessages.getEventsByParticipantId.mockResolvedValue({
      data: [
        {
          id: "dm5",
          text: "Hello Alice",
          senderId: "me",
          createdAt: "2026-02-15T00:00:00Z",
          dmConversationId: "conv5",
          eventType: "MessageCreate",
        },
      ],
    });

    const result = await executeGetDms(mockClient as any, { username: "alice" });
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(1);
    expect(data.messages[0].id).toBe("dm5");
    expect(data.withUser).toBe("alice");
  });

  it("calls getEventsByParticipantId with correct user ID", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "u99", name: "Bob", username: "bob" },
    });
    mockClient.directMessages.getEventsByParticipantId.mockResolvedValue({
      data: [],
    });

    await executeGetDms(mockClient as any, { username: "@bob", maxResults: 25 });

    expect(mockClient.users.getByUsername).toHaveBeenCalledWith("bob");
    expect(mockClient.directMessages.getEventsByParticipantId).toHaveBeenCalledWith(
      "u99",
      expect.objectContaining({ maxResults: 25 }),
    );
  });

  it("calls getEvents with correct params when no username", async () => {
    mockClient.directMessages.getEvents.mockResolvedValue({ data: [] });

    await executeGetDms(mockClient as any, { maxResults: 50 });

    expect(mockClient.directMessages.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({ maxResults: 50 }),
    );
  });

  it("uses default maxResults of 10", async () => {
    mockClient.directMessages.getEvents.mockResolvedValue({ data: [] });

    await executeGetDms(mockClient as any, {});

    expect(mockClient.directMessages.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({ maxResults: 10 }),
    );
  });

  it("tracks cost based on result count", async () => {
    mockClient.directMessages.getEvents.mockResolvedValue({
      data: [
        { id: "1", eventType: "MessageCreate" },
        { id: "2", eventType: "MessageCreate" },
        { id: "3", eventType: "MessageCreate" },
      ],
    });

    await executeGetDms(mockClient as any, {});

    // 3 * $0.005 = $0.015
    expect(costTracker.totalCost).toBe(0.015);
  });

  it("handles empty results", async () => {
    mockClient.directMessages.getEvents.mockResolvedValue({ data: [] });

    const result = await executeGetDms(mockClient as any, {});
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(0);
    expect(data.messages).toHaveLength(0);
    expect(data.estimatedCost).toBe("$0.0000");
  });

  it("handles null data response", async () => {
    mockClient.directMessages.getEvents.mockResolvedValue({ data: null });

    const result = await executeGetDms(mockClient as any, {});
    const data = parseToolResult(result);

    expect(data.resultCount).toBe(0);
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
    expect(data.error).toContain("Forbidden");
  });
});
