import { describe, it, expect, beforeEach } from "vitest";
import { executeGetUserProfile } from "../../src/tools/get-user-profile.js";
import { createMockClient, parseToolResult, mockRawResponse, type MockClient } from "../helpers.js";
import { costTracker } from "../../src/costs.js";

describe("executeGetUserProfile", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    costTracker.reset();
  });

  it("retrieves a user profile with rate limit info", async () => {
    mockClient.users.getByUsername.mockResolvedValue(
      mockRawResponse(
        {
          data: {
            id: "u1",
            name: "Test User",
            username: "testuser",
            description: "A test user",
            verified: true,
            profile_image_url: "https://pbs.twimg.com/test.jpg",
            url: "https://example.com",
            created_at: "2020-01-01T00:00:00Z",
            location: "San Francisco",
            public_metrics: { followers_count: 1000, following_count: 500, tweet_count: 2000 },
          },
        },
        { remaining: 898, limit: 900, reset: 1739600000 },
      ),
    );

    const result = await executeGetUserProfile(mockClient as any, { username: "testuser" });
    const data = parseToolResult(result);

    expect(data.id).toBe("u1");
    expect(data.name).toBe("Test User");
    expect(data.followersCount).toBe(1000);
    expect(data.rateLimit).toBeDefined();
    expect(data.rateLimit.remaining).toBe(898);
    expect(data.profileUrl).toBe("https://x.com/testuser");
  });

  it("strips leading @ from username", async () => {
    mockClient.users.getByUsername.mockResolvedValue(
      mockRawResponse({ data: { id: "1", name: "User", username: "user" } }),
    );

    await executeGetUserProfile(mockClient as any, { username: "@user" });
    expect(mockClient.users.getByUsername).toHaveBeenCalledWith("user", expect.any(Object));
  });

  it("tracks cost on success", async () => {
    mockClient.users.getByUsername.mockResolvedValue(
      mockRawResponse({ data: { id: "1", name: "User", username: "user" } }),
    );

    await executeGetUserProfile(mockClient as any, { username: "user" });
    expect(costTracker.totalCost).toBe(0.001);
  });

  it("returns error when user not found", async () => {
    mockClient.users.getByUsername.mockResolvedValue(
      mockRawResponse({ data: null }),
    );

    const result = await executeGetUserProfile(mockClient as any, { username: "noone" });
    const data = parseToolResult(result);
    expect(data.error).toContain("User @noone not found");
  });

  it("returns error for empty username", async () => {
    const result = await executeGetUserProfile(mockClient as any, { username: "" });
    const data = parseToolResult(result);
    expect(data.error).toContain("Username cannot be empty");
  });

  it("returns error when API throws", async () => {
    mockClient.users.getByUsername.mockRejectedValue(new Error("Forbidden"));

    const result = await executeGetUserProfile(mockClient as any, { username: "user" });
    const data = parseToolResult(result);
    expect(data.error).toContain("Failed to get user profile");
  });

  it("handles missing optional fields gracefully", async () => {
    mockClient.users.getByUsername.mockResolvedValue(
      mockRawResponse({ data: { id: "1", name: "Minimal User", username: "minimal" } }),
    );

    const result = await executeGetUserProfile(mockClient as any, { username: "minimal" });
    const data = parseToolResult(result);

    expect(data.description).toBeNull();
    expect(data.followersCount).toBeNull();
    expect(data.verified).toBeNull();
  });

  it("returns structured error on 429", async () => {
    mockClient.users.getByUsername.mockRejectedValue({
      status: 429,
      headers: new Headers({ "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 120) }),
    });

    const result = await executeGetUserProfile(mockClient as any, { username: "user" });
    const data = parseToolResult(result);
    expect(data.rateLimited).toBe(true);
  });
});
