import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, normalizeUsername } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";

export const getUserProfileSchema = Type.Object({
  username: Type.String({
    description: "X/Twitter username (with or without leading @)",
  }),
});

export async function executeGetUserProfile(
  readClient: Client,
  params: { username: string },
) {
  const username = normalizeUsername(params.username);
  if (!username) {
    return err("Username cannot be empty");
  }

  try {
    const response = await readClient.users.getByUsername(username, {
      userFields: [
        "description",
        "public_metrics",
        "verified",
        "profile_image_url",
        "url",
        "created_at",
        "location",
        "pinned_tweet_id",
      ],
    });

    const user = response?.data;
    if (!user) {
      return err(`User @${username} not found`);
    }

    const metrics = user.publicMetrics as
      | Record<string, number>
      | undefined;

    const cost = ACTION_COSTS.user_lookup;
    costTracker.track("user_lookup", cost);

    return ok({
      id: user.id,
      name: user.name,
      username: user.username,
      description: user.description ?? null,
      followersCount: metrics?.followers_count ?? metrics?.followersCount ?? null,
      followingCount: metrics?.following_count ?? metrics?.followingCount ?? null,
      tweetCount: metrics?.tweet_count ?? metrics?.tweetCount ?? null,
      verified: user.verified ?? null,
      profileImageUrl: user.profileImageUrl ?? null,
      url: user.url ?? null,
      createdAt: user.createdAt ?? null,
      location: user.location ?? null,
      profileUrl: `https://x.com/${user.username}`,
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to get user profile: ${message}`);
  }
}

export function registerGetUserProfile(
  api: { registerTool: Function },
  getReadClient: () => Client,
) {
  api.registerTool({
    name: "x_get_user_profile",
    description:
      "Get a user's profile information on X/Twitter by username. Returns bio, follower/following counts, tweet count, verification status, and more.",
    parameters: getUserProfileSchema,
    execute: async (_sessionId: string, params: { username: string }) =>
      executeGetUserProfile(getReadClient(), params),
  });
}
