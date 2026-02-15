import { describe, it, expect, beforeEach } from "vitest";
import { executeGetUserProfile } from "../../src/tools/get-user-profile.js";
import { createMockClient, parseToolResult, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";

describe("executeGetUserProfile", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
  });

  it("retrieves a user profile by username", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: {
        id: "u1",
        name: "Test User",
        username: "testuser",
        description: "A test user",
        verified: true,
        profileImageUrl: "https://pbs.twimg.com/test.jpg",
        url: "https://example.com",
        createdAt: "2020-01-01T00:00:00Z",
        location: "San Francisco",
        publicMetrics: {
          followers_count: 1000,
          following_count: 500,
          tweet_count: 2000,
        },
      },
    });

    const result = await executeGetUserProfile(mockClient as any, { username: "testuser" });
    const data = parseToolResult(result);

    expect(data.id).toBe("u1");
    expect(data.name).toBe("Test User");
    expect(data.username).toBe("testuser");
    expect(data.description).toBe("A test user");
    expect(data.followersCount).toBe(1000);
    expect(data.followingCount).toBe(500);
    expect(data.tweetCount).toBe(2000);
    expect(data.verified).toBe(true);
    expect(data.profileUrl).toBe("https://x.com/testuser");
    expect(data.estimatedCost).toBe("$0.0010");
  });

  it("strips leading @ from username", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "1", name: "User", username: "user" },
    });

    await executeGetUserProfile(mockClient as any, { username: "@user" });

    expect(mockClient.users.getByUsername).toHaveBeenCalledWith("user", expect.any(Object));
  });

  it("passes correct user fields", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "1", name: "User", username: "user" },
    });

    await executeGetUserProfile(mockClient as any, { username: "user" });

    expect(mockClient.users.getByUsername).toHaveBeenCalledWith("user", {
      userFields: expect.arrayContaining([
        "description",
        "public_metrics",
        "verified",
        "profile_image_url",
        "url",
        "created_at",
        "location",
        "pinned_tweet_id",
      ]),
    });
  });

  it("tracks cost on success", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: { id: "1", name: "User", username: "user" },
    });

    await executeGetUserProfile(mockClient as any, { username: "user" });

    expect(costTracker.totalCost).toBe(0.001);
  });

  it("returns error when user not found (null data)", async () => {
    mockClient.users.getByUsername.mockResolvedValue({ data: null });

    const result = await executeGetUserProfile(mockClient as any, { username: "noone" });
    const data = parseToolResult(result);

    expect(data.error).toContain("User @noone not found");
  });

  it("returns error for empty username", async () => {
    const result = await executeGetUserProfile(mockClient as any, { username: "" });
    const data = parseToolResult(result);

    expect(data.error).toContain("Username cannot be empty");
  });

  it("returns error for @-only input", async () => {
    const result = await executeGetUserProfile(mockClient as any, { username: "@" });
    const data = parseToolResult(result);

    expect(data.error).toContain("Username cannot be empty");
  });

  it("returns error when API throws", async () => {
    mockClient.users.getByUsername.mockRejectedValue(new Error("Forbidden"));

    const result = await executeGetUserProfile(mockClient as any, { username: "user" });
    const data = parseToolResult(result);

    expect(data.error).toContain("Failed to get user profile");
    expect(data.error).toContain("Forbidden");
  });

  it("handles missing optional fields gracefully", async () => {
    mockClient.users.getByUsername.mockResolvedValue({
      data: {
        id: "1",
        name: "Minimal User",
        username: "minimal",
        // no description, no metrics, no verified, etc.
      },
    });

    const result = await executeGetUserProfile(mockClient as any, { username: "minimal" });
    const data = parseToolResult(result);

    expect(data.description).toBeNull();
    expect(data.followersCount).toBeNull();
    expect(data.verified).toBeNull();
    expect(data.location).toBeNull();
  });
});
