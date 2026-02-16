import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, tweetUrl } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";
import { parseRateLimitError } from "../rate-limit.js";
import { interactionLog } from "../interaction-log.js";
import { uploadImage } from "../media.js";

export const postTweetSchema = Type.Object({
  text: Type.String({ description: "The text content of the tweet (max 280 characters)" }),
  mediaUrl: Type.Optional(
    Type.String({
      description:
        "Optional image URL or local file path to attach to the tweet (supports jpg, png, gif, webp)",
    }),
  ),
});

export async function executePostTweet(
  writeClient: Client,
  params: { text: string; mediaUrl?: string },
) {
  if (!params.text || params.text.trim().length === 0) {
    return err("Tweet text cannot be empty");
  }

  try {
    // Upload image if provided
    let mediaIds: string[] | undefined;
    if (params.mediaUrl) {
      const mediaId = await uploadImage(writeClient, params.mediaUrl);
      mediaIds = [mediaId];
    }

    const body: Record<string, unknown> = { text: params.text };
    if (mediaIds) {
      body.media = { mediaIds };
    }

    const response = await writeClient.posts.create(body);
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
      summary: `Posted tweet: "${text.substring(0, 80)}${text.length > 80 ? "..." : ""}"${mediaIds ? " (with image)" : ""}`,
      details: { id, text, url, ...(mediaIds ? { mediaIds } : {}) },
    });

    return ok({
      id,
      text,
      url,
      ...(mediaIds ? { mediaIds } : {}),
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
      "Post a tweet to X/Twitter, optionally with an image. Returns the tweet ID, text, URL, and estimated API cost.",
    parameters: postTweetSchema,
    execute: async (
      _sessionId: string,
      params: { text: string; mediaUrl?: string },
    ) => {
      try {
        return await executePostTweet(getWriteClient(), params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
      }
    },
  });
}
