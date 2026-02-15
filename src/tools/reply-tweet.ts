import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, tweetUrl, parseTweetId } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";

export const replyTweetSchema = Type.Object({
  tweetId: Type.String({
    description:
      "The tweet ID or URL to reply to (e.g. '1234567890' or 'https://x.com/user/status/1234567890')",
  }),
  text: Type.String({ description: "The text content of the reply (max 280 characters)" }),
});

export async function executeReplyTweet(
  writeClient: Client,
  params: { tweetId: string; text: string },
) {
  if (!params.text || params.text.trim().length === 0) {
    return err("Reply text cannot be empty");
  }

  const resolvedId = parseTweetId(params.tweetId);
  if (!resolvedId) {
    return err("Invalid tweet ID or URL");
  }

  try {
    const response = await writeClient.posts.create({
      text: params.text,
      reply: { inReplyToTweetId: resolvedId },
    });

    const id = response?.data?.id;
    const text = response?.data?.text ?? params.text;

    if (!id) {
      return err("Failed to create reply — no ID returned", response);
    }

    const cost = ACTION_COSTS.post;
    costTracker.track("post", cost);

    return ok({
      id,
      text,
      url: tweetUrl(id),
      inReplyTo: resolvedId,
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to reply to tweet: ${message}`);
  }
}

export function registerReplyTweet(
  api: { registerTool: Function },
  getWriteClient: () => Client,
) {
  api.registerTool({
    name: "x_reply_tweet",
    description:
      "Reply to a tweet on X/Twitter by its ID or URL. Returns the reply tweet ID, text, URL, and the tweet being replied to.",
    parameters: replyTweetSchema,
    execute: async (
      _sessionId: string,
      params: { tweetId: string; text: string },
    ) => {
      try {
        return await executeReplyTweet(getWriteClient(), params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
      }
    },
  });
}
