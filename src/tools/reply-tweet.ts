import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, tweetUrl, parseTweetId } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";
import { parseRateLimitError } from "../rate-limit.js";
import { interactionLog } from "../interaction-log.js";
import { uploadImage } from "../media.js";

export const replyTweetSchema = Type.Object({
  tweetId: Type.String({
    description:
      "The tweet ID or URL to reply to (e.g. '1234567890' or 'https://x.com/user/status/1234567890')",
  }),
  text: Type.String({ description: "The text content of the reply (max 280 characters)" }),
  mediaUrl: Type.Optional(
    Type.String({
      description:
        "Optional image URL or local file path to attach to the reply (supports jpg, png, gif, webp)",
    }),
  ),
});

export async function executeReplyTweet(
  writeClient: Client,
  params: { tweetId: string; text: string; mediaUrl?: string },
) {
  if (!params.text || params.text.trim().length === 0) {
    return err("Reply text cannot be empty");
  }

  const resolvedId = parseTweetId(params.tweetId);
  if (!resolvedId) {
    return err("Invalid tweet ID or URL");
  }

  try {
    // Upload image if provided
    let mediaIds: string[] | undefined;
    if (params.mediaUrl) {
      const mediaId = await uploadImage(writeClient, params.mediaUrl);
      mediaIds = [mediaId];
    }

    const body: Record<string, unknown> = {
      text: params.text,
      reply: { inReplyToTweetId: resolvedId },
    };
    if (mediaIds) {
      body.media = { mediaIds };
    }

    const response = await writeClient.posts.create(body);
    const id = response?.data?.id;
    const text = response?.data?.text ?? params.text;

    if (!id) {
      return err("Failed to create reply — no ID returned", response);
    }

    const cost = ACTION_COSTS.post;
    costTracker.track("post", cost);

    const url = tweetUrl(id);
    interactionLog.log({
      action: "x_reply_tweet",
      summary: `Replied to tweet ${resolvedId}: "${text.substring(0, 80)}${text.length > 80 ? "..." : ""}"${mediaIds ? " (with image)" : ""}`,
      details: { id, text, url, inReplyTo: resolvedId, ...(mediaIds ? { mediaIds } : {}) },
    });

    return ok({
      id,
      text,
      url,
      inReplyTo: resolvedId,
      ...(mediaIds ? { mediaIds } : {}),
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const rateLimitErr = parseRateLimitError(error);
    if (rateLimitErr) return ok(rateLimitErr);
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
      "Reply to a tweet on X/Twitter by its ID or URL, optionally with an image. Returns the reply tweet ID, text, URL, and the tweet being replied to.",
    parameters: replyTweetSchema,
    execute: async (
      _sessionId: string,
      params: { tweetId: string; text: string; mediaUrl?: string },
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
