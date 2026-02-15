import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, tweetUrl } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";

export const postThreadSchema = Type.Object({
  tweets: Type.Array(Type.String({ description: "Text content of each tweet in the thread" }), {
    description: "Array of tweet texts to post as a thread (in order)",
    minItems: 1,
  }),
});

export async function executePostThread(
  writeClient: Client,
  params: { tweets: string[] },
) {
  if (!params.tweets || params.tweets.length === 0) {
    return err("Thread must contain at least one tweet");
  }

  for (let i = 0; i < params.tweets.length; i++) {
    if (!params.tweets[i] || params.tweets[i].trim().length === 0) {
      return err(`Tweet at index ${i} is empty`);
    }
  }

  try {
    const results: Array<{ id: string; text: string; url: string }> = [];
    let previousTweetId: string | null = null;

    for (const tweetText of params.tweets) {
      const body: Record<string, unknown> = { text: tweetText };
      if (previousTweetId) {
        body.reply = { inReplyToTweetId: previousTweetId };
      }

      const response = await writeClient.posts.create(body);
      const id = response?.data?.id;
      const text = response?.data?.text ?? tweetText;

      if (!id) {
        return err(
          `Failed to create tweet in thread — no ID returned after ${results.length} tweets`,
          { response, postedSoFar: results },
        );
      }

      results.push({ id, text, url: tweetUrl(id) });
      previousTweetId = id;
    }

    const cost = ACTION_COSTS.post * results.length;
    costTracker.track("post", cost);

    return ok({
      threadId: results[0].id,
      tweetCount: results.length,
      tweets: results,
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to post thread: ${message}`);
  }
}

export function registerPostThread(
  api: { registerTool: Function },
  getWriteClient: () => Client,
) {
  api.registerTool({
    name: "x_post_thread",
    description:
      "Post a thread (multi-tweet sequence) to X/Twitter. Each tweet is posted as a reply to the previous one. Returns all tweet IDs, texts, and URLs.",
    parameters: postThreadSchema,
    execute: async (_sessionId: string, params: { tweets: string[] }) =>
      executePostThread(getWriteClient(), params),
  });
}
