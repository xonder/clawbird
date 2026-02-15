import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, tweetUrl } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";
import { parseRateLimitError } from "../rate-limit.js";
import { interactionLog } from "../interaction-log.js";

export const postTweetSchema = Type.Object({
  text: Type.String({ description: "The text content of the tweet (max 280 characters)" }),
});

export async function executePostTweet(
  writeClient: Client,
  params: { text: string },
) {
  if (!params.text || params.text.trim().length === 0) {
    return err("Tweet text cannot be empty");
  }

  try {
    const response = await writeClient.posts.create({ text: params.text });
    const id = response?.data?.id;
    const text = response?.data?.text ?? params.text;

    if (!id) {
      return err("Failed to create tweet — no ID returned", response);
    }

    const cost = ACTION_COSTS.post;
    costTracker.track("post", cost);

    const url = tweetUrl(id);
    interactionLog.log({
      action: "x_post_tweet",
      summary: `Posted tweet: "${text.substring(0, 80)}${text.length > 80 ? "..." : ""}"`,
      details: { id, text, url },
    });

    return ok({
      id,
      text,
      url,
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const rateLimitErr = parseRateLimitError(error);
    if (rateLimitErr) return ok(rateLimitErr);
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to post tweet: ${message}`);
  }
}

export function registerPostTweet(
  api: { registerTool: Function },
  getWriteClient: () => Client,
) {
  api.registerTool({
    name: "x_post_tweet",
    description:
      "Post a tweet to X/Twitter. Returns the tweet ID, text, URL, and estimated API cost.",
    parameters: postTweetSchema,
    execute: async (_sessionId: string, params: { text: string }) => {
      try {
        return await executePostTweet(getWriteClient(), params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
      }
    },
  });
}
