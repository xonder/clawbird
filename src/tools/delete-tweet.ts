import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, parseTweetId } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";
import { parseRateLimitError } from "../rate-limit.js";
import { interactionLog } from "../interaction-log.js";

export const deleteTweetSchema = Type.Object({
  tweetId: Type.String({
    description:
      "The tweet ID or URL to delete (e.g. '1234567890' or 'https://x.com/user/status/1234567890')",
  }),
});

export async function executeDeleteTweet(
  writeClient: Client,
  params: { tweetId: string },
) {
  const resolvedId = parseTweetId(params.tweetId);
  if (!resolvedId) {
    return err("Invalid tweet ID or URL");
  }

  try {
    const response = await writeClient.posts.delete(resolvedId);

    const deleted =
      (response?.data as Record<string, unknown>)?.deleted ?? true;

    const cost = ACTION_COSTS.post;
    costTracker.track("delete", cost);

    interactionLog.log({
      action: "x_delete_tweet",
      summary: `Deleted tweet ${resolvedId}`,
      details: { tweetId: resolvedId },
    });

    return ok({
      deleted,
      tweetId: resolvedId,
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const rateLimitErr = parseRateLimitError(error);
    if (rateLimitErr) return ok(rateLimitErr);
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to delete tweet: ${message}`);
  }
}

export function registerDeleteTweet(
  api: { registerTool: Function },
  getWriteClient: () => Client,
) {
  api.registerTool({
    name: "x_delete_tweet",
    description:
      "Delete a tweet on X/Twitter by its ID or URL. Only works for tweets posted by the authenticated user.",
    parameters: deleteTweetSchema,
    execute: async (_sessionId: string, params: { tweetId: string }) => {
      try {
        return await executeDeleteTweet(getWriteClient(), params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
      }
    },
  });
}
