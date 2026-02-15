import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, normalizeUsername } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";
import { getAuthenticatedUserId } from "../client.js";
import { parseRateLimitError } from "../rate-limit.js";

export const followUserSchema = Type.Object({
  username: Type.String({
    description: "X/Twitter username to follow (with or without leading @)",
  }),
});

export async function executeFollowUser(
  writeClient: Client,
  readClient: Client,
  params: { username: string },
) {
  const username = normalizeUsername(params.username);
  if (!username) {
    return err("Username cannot be empty");
  }

  try {
    // Resolve username to user ID
    const userResponse = await readClient.users.getByUsername(username);
    const targetUserId = userResponse?.data?.id;
    if (!targetUserId) {
      return err(`User @${username} not found`);
    }

    // Get authenticated user ID
    const sourceUserId = await getAuthenticatedUserId(writeClient);

    // Follow the user
    const response = await writeClient.users.followUser(sourceUserId, {
      body: { targetUserId },
    });

    const following =
      (response?.data as Record<string, unknown>)?.following ?? true;

    const cost = ACTION_COSTS.user_lookup;
    costTracker.track("follow", cost);

    return ok({
      following,
      user: { id: targetUserId, username },
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const rateLimitErr = parseRateLimitError(error);
    if (rateLimitErr) return ok(rateLimitErr);
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to follow user: ${message}`);
  }
}

export function registerFollowUser(
  api: { registerTool: Function },
  getWriteClient: () => Client,
  getReadClient: () => Client,
) {
  api.registerTool({
    name: "x_follow_user",
    description:
      "Follow a user on X/Twitter by username. Returns confirmation and the followed user's info.",
    parameters: followUserSchema,
    execute: async (_sessionId: string, params: { username: string }) => {
      try {
        return await executeFollowUser(getWriteClient(), getReadClient(), params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
      }
    },
  });
}
