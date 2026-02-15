import { describe, it, expect, beforeEach } from "vitest";
import { executeFollowUser } from "../../src/tools/follow-user.js";
import { createMockClient, parseToolResult, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";
import { resetCachedUserId } from "../../src/client.js";

describe("executeFollowUser", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
    resetCachedUserId();
  });

  it("follows a user by username", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "target1", name: "Alice", username: "alice" },
    });
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "me1", name: "Me", username: "me" },
    });
    mockClient.users.followUser.mockResolvedValue({
      data: { following: true },
    });

    const result = await executeFollowUser(
      mockClient as any,
      mockClient as any,
      { username: "alice" },
    );
    const data = parseToolResult(result);

    expect(data.following).toBe(true);
    expect(data.user.id).toBe("target1");
    expect(data.user.username).toBe("alice");
    expect(data.estimatedCost).toBeDefined();
  });

  it("resolves username and calls followUser with correct params", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "t99", name: "Bob", username: "bob" },
    });
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "me1", name: "Me", username: "me" },
    });
    mockClient.users.followUser.mockResolvedValue({
      data: { following: true },
    });

    await executeFollowUser(mockClient as any, mockClient as any, {
      username: "@bob",
    });

    expect(mockClient.users.getByUsername).toHaveBeenCalledWith("bob");
    expect(mockClient.users.followUser).toHaveBeenCalledWith("me1", {
      body: { targetUserId: "t99" },
    });
  });

  it("strips @ from username", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "u1", name: "Test", username: "test" },
    });
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "me1", name: "Me", username: "me" },
    });
    mockClient.users.followUser.mockResolvedValue({
      data: { following: true },
    });

    await executeFollowUser(mockClient as any, mockClient as any, {
      username: "@test",
    });

    expect(mockClient.users.getByUsername).toHaveBeenCalledWith("test");
  });

  it("tracks cost on success", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "u1", name: "Test", username: "test" },
    });
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "me1", name: "Me", username: "me" },
    });
    mockClient.users.followUser.mockResolvedValue({
      data: { following: true },
    });

    await executeFollowUser(mockClient as any, mockClient as any, {
      username: "test",
    });

    expect(costTracker.totalCost).toBeGreaterThan(0);
  });

  it("returns error for empty username", async () => {
    const result = await executeFollowUser(
      mockClient as any,
      mockClient as any,
      { username: "" },
    );
    const data = parseToolResult(result);

    expect(data.error).toContain("Username cannot be empty");
  });

  it("returns error when user not found", async () => {
    mockClient.users.getByUsername.mockResolvedValue({ data: null });

    const result = await executeFollowUser(
      mockClient as any,
      mockClient as any,
      { username: "nonexistent" },
    );
    const data = parseToolResult(result);

    expect(data.error).toContain("User @nonexistent not found");
  });

  it("returns error when getMe fails", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "u1", name: "Test", username: "test" },
    });
    mockClient.users.getMe.mockRejectedValue(new Error("Auth failed"));

    const result = await executeFollowUser(
      mockClient as any,
      mockClient as any,
      { username: "test" },
    );
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to follow user");
    expect(data.error).toContain("Auth failed");
  });

  it("returns error when followUser API fails", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "u1", name: "Test", username: "test" },
    });
    mockClient.users.getMe.mockResolvedValue({
      data: { id: "me1", name: "Me", username: "me" },
    });
    mockClient.users.followUser.mockRejectedValue(
      new Error("Already following"),
    );

    const result = await executeFollowUser(
      mockClient as any,
      mockClient as any,
      { username: "test" },
    );
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to follow user");
    expect(data.error).toContain("Already following");
  });
});
