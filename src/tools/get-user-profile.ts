import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, normalizeUsername } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";
import { parseRawResponse, formatRateLimit, parseRateLimitError } from "../rate-limit.js";

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
    const rawResponse = await readClient.users.getByUsername(username, {
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
      requestOptions: { raw: true },
    }) as unknown as Response;

    const { data: response, rateLimit } = await parseRawResponse<Record<string, unknown>>(rawResponse);

    const user = response?.data as Record<string, unknown> | undefined;
    if (!user) {
      return err(`User @${username} not found`);
    }

    const metrics = user.public_metrics as Record<string, number> | undefined;

    const cost = ACTION_COSTS.user_lookup;
    costTracker.track("user_lookup", cost);

    return ok({
      id: user.id,
      name: user.name,
      username: user.username,
      description: user.description ?? null,
      followersCount: metrics?.followers_count ?? null,
      followingCount: metrics?.following_count ?? null,
      tweetCount: metrics?.tweet_count ?? null,
      verified: user.verified ?? null,
      profileImageUrl: user.profile_image_url ?? null,
      url: user.url ?? null,
      createdAt: user.created_at ?? null,
      location: user.location ?? null,
      profileUrl: `https://x.com/${user.username}`,
      rateLimit: formatRateLimit(rateLimit),
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const rateLimitErr = parseRateLimitError(error);
    if (rateLimitErr) return ok(rateLimitErr);
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
    execute: async (_sessionId: string, params: { username: string }) => {
      try {
        return await executeGetUserProfile(getReadClient(), params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
      }
    },
  });
}
