import { describe, it, expect, beforeEach } from "vitest";
import { executeSendDm } from "../../src/tools/send-dm.js";
import { createMockClient, parseToolResult, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";

describe("executeSendDm", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
  });

  it("sends a DM to a user by username", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "user1", name: "Alice", username: "alice" },
    });
    mockClient.directMessages.createByParticipantId.mockResolvedValue({
      data: { dm_event_id: "evt1", dm_conversation_id: "conv1" },
    });

    const result = await executeSendDm(
      mockClient as any,
      mockClient as any,
      { username: "alice", text: "Hello!" },
    );
    const data = parseToolResult(result);

    expect(data.sent).toBe(true);
    expect(data.eventId).toBe("evt1");
    expect(data.conversationId).toBe("conv1");
    expect(data.recipient.id).toBe("user1");
    expect(data.recipient.username).toBe("alice");
    expect(data.estimatedCost).toBe("$0.0100");
  });

  it("resolves username and calls createByParticipantId", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "u99", name: "Bob", username: "bob" },
    });
    mockClient.directMessages.createByParticipantId.mockResolvedValue({
      data: { dm_event_id: "e1" },
    });

    await executeSendDm(mockClient as any, mockClient as any, {
      username: "@bob",
      text: "Hey Bob",
    });

    expect(mockClient.users.getByUsername).toHaveBeenCalledWith("bob");
    expect(mockClient.directMessages.createByParticipantId).toHaveBeenCalledWith(
      "u99",
      { body: { text: "Hey Bob" } },
    );
  });

  it("strips @ from username", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "u1", name: "Test", username: "test" },
    });
    mockClient.directMessages.createByParticipantId.mockResolvedValue({
      data: {},
    });

    await executeSendDm(mockClient as any, mockClient as any, {
      username: "@test",
      text: "hi",
    });

    expect(mockClient.users.getByUsername).toHaveBeenCalledWith("test");
  });

  it("tracks cost on success", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "u1", name: "Test", username: "test" },
    });
    mockClient.directMessages.createByParticipantId.mockResolvedValue({
      data: { dm_event_id: "e1" },
    });

    await executeSendDm(mockClient as any, mockClient as any, {
      username: "test",
      text: "hello",
    });

    expect(costTracker.totalCost).toBe(0.01);
  });

  it("returns error for empty text", async () => {
    const result = await executeSendDm(mockClient as any, mockClient as any, {
      username: "alice",
      text: "",
    });
    const data = parseToolResult(result);

    expect(data.error).toContain("DM text cannot be empty");
  });

  it("returns error for empty username", async () => {
    const result = await executeSendDm(mockClient as any, mockClient as any, {
      username: "",
      text: "hello",
    });
    const data = parseToolResult(result);

    expect(data.error).toContain("Recipient username cannot be empty");
  });

  it("returns error when user not found", async () => {
    mockClient.users.getByUsername.mockResolvedValue({ data: null });

    const result = await executeSendDm(mockClient as any, mockClient as any, {
      username: "nonexistent",
      text: "hello",
    });
    const data = parseToolResult(result);

    expect(data.error).toContain("User @nonexistent not found");
  });

  it("returns error when API throws", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "u1", name: "Test", username: "test" },
    });
    mockClient.directMessages.createByParticipantId.mockRejectedValue(
      new Error("DM sending disabled"),
    );

    const result = await executeSendDm(mockClient as any, mockClient as any, {
      username: "test",
      text: "hello",
    });
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to send DM");
    expect(data.error).toContain("DM sending disabled");
  });

  it("handles camelCase response fields", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "u1", name: "Test", username: "test" },
    });
    mockClient.directMessages.createByParticipantId.mockResolvedValue({
      data: { dmEventId: "evt2", dmConversationId: "conv2" },
    });

    const result = await executeSendDm(mockClient as any, mockClient as any, {
      username: "test",
      text: "hello",
    });
    const data = parseToolResult(result);

    expect(data.eventId).toBe("evt2");
    expect(data.conversationId).toBe("conv2");
  });
});
