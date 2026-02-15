import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, parseTweetId } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";
import { getAuthenticatedUserId } from "../client.js";

export const likeTweetSchema = Type.Object({
  tweetId: Type.String({
    description:
      "The tweet ID or URL to like (e.g. '1234567890' or 'https://x.com/user/status/1234567890')",
  }),
});

export async function executeLikeTweet(
  writeClient: Client,
  params: { tweetId: string },
) {
  const resolvedId = parseTweetId(params.tweetId);
  if (!resolvedId) {
    return err("Invalid tweet ID or URL");
  }

  try {
    const userId = await getAuthenticatedUserId(writeClient);

    await writeClient.users.likePost(userId, {
      body: { tweetId: resolvedId },
    });

    const cost = ACTION_COSTS.like;
    costTracker.track("like", cost);

    return ok({
      liked: true,
      tweetId: resolvedId,
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to like tweet: ${message}`);
  }
}

export function registerLikeTweet(
  api: { registerTool: Function },
  getWriteClient: () => Client,
) {
  api.registerTool({
    name: "x_like_tweet",
    description:
      "Like a tweet on X/Twitter by its ID or URL. Returns confirmation and estimated API cost.",
    parameters: likeTweetSchema,
    execute: async (_sessionId: string, params: { tweetId: string }) => {
      try {
        return await executeLikeTweet(getWriteClient(), params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
      }
    },
  });
}
