import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, tweetUrl } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";
import { getAuthenticatedUserId } from "../client.js";
import { parseRawResponse, formatRateLimit, parseRateLimitError } from "../rate-limit.js";

export const getMentionsSchema = Type.Object({
  maxResults: Type.Optional(
    Type.Number({
      description: "Maximum number of mentions to retrieve (5-100, default 10)",
      minimum: 5,
      maximum: 100,
    }),
  ),
});

export async function executeGetMentions(
  readClient: Client,
  writeClient: Client,
  params: { maxResults?: number },
) {
  const maxResults = params.maxResults ?? 10;

  try {
    // Need user ID — use writeClient (OAuth1) to get authenticated user
    const userId = await getAuthenticatedUserId(writeClient);

    const rawResponse = await readClient.users.getMentions(userId, {
      maxResults,
      tweetFields: ["created_at", "author_id", "public_metrics", "conversation_id"],
      requestOptions: { raw: true },
    }) as unknown as Response;

    const { data: response, rateLimit } = await parseRawResponse<Record<string, unknown>>(rawResponse);

    const mentionsData = (response?.data ?? []) as Array<Record<string, unknown>>;
    const mentions = mentionsData.map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      createdAt: tweet.created_at,
      metrics: tweet.public_metrics,
      url: tweetUrl(tweet.id as string),
    }));

    const resultCount = mentions.length;
    const cost = ACTION_COSTS.mention_per_result * resultCount;
    costTracker.track("mentions", cost);

    return ok({
      resultCount,
      mentions,
      rateLimit: formatRateLimit(rateLimit),
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const rateLimitErr = parseRateLimitError(error);
    if (rateLimitErr) return ok(rateLimitErr);
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to get mentions: ${message}`);
  }
}

export function registerGetMentions(
  api: { registerTool: Function },
  getReadClient: () => Client,
  getWriteClient: () => Client,
) {
  api.registerTool({
    name: "x_get_mentions",
    description:
      "Get recent mentions of your authenticated X/Twitter account. Returns tweets mentioning you with metadata and estimated API cost.",
    parameters: getMentionsSchema,
    execute: async (_sessionId: string, params: { maxResults?: number }) => {
      try {
        return await executeGetMentions(getReadClient(), getWriteClient(), params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
      }
    },
  });
}
