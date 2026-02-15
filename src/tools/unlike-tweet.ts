import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, parseTweetId } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";
import { getAuthenticatedUserId } from "../client.js";
import { parseRateLimitError } from "../rate-limit.js";
import { interactionLog } from "../interaction-log.js";

export const unlikeTweetSchema = Type.Object({
  tweetId: Type.String({
    description:
      "The tweet ID or URL to unlike (e.g. '1234567890' or 'https://x.com/user/status/1234567890')",
  }),
});

export async function executeUnlikeTweet(
  writeClient: Client,
  params: { tweetId: string },
) {
  const resolvedId = parseTweetId(params.tweetId);
  if (!resolvedId) {
    return err("Invalid tweet ID or URL");
  }

  try {
    const userId = await getAuthenticatedUserId(writeClient);

    await writeClient.users.unlikePost(userId, resolvedId);

    const cost = ACTION_COSTS.like;
    costTracker.track("unlike", cost);

    interactionLog.log({
      action: "x_unlike_tweet",
      summary: `Unliked tweet ${resolvedId}`,
      details: { tweetId: resolvedId },
    });

    return ok({
      unliked: true,
      tweetId: resolvedId,
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const rateLimitErr = parseRateLimitError(error);
    if (rateLimitErr) return ok(rateLimitErr);
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to unlike tweet: ${message}`);
  }
}

export function registerUnlikeTweet(
  api: { registerTool: Function },
  getWriteClient: () => Client,
) {
  api.registerTool({
    name: "x_unlike_tweet",
    description:
      "Unlike a previously liked tweet on X/Twitter by its ID or URL. Returns confirmation and estimated API cost.",
    parameters: unlikeTweetSchema,
    execute: async (_sessionId: string, params: { tweetId: string }) => {
      try {
        return await executeUnlikeTweet(getWriteClient(), params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
      }
    },
  });
}
