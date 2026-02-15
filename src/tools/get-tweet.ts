import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, tweetUrl, parseTweetId } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";
import { parseRawResponse, formatRateLimit, parseRateLimitError } from "../rate-limit.js";

export const getTweetSchema = Type.Object({
  tweetId: Type.String({
    description:
      "The tweet ID or URL to fetch (e.g. '1234567890' or 'https://x.com/user/status/1234567890')",
  }),
});

export async function executeGetTweet(
  readClient: Client,
  params: { tweetId: string },
) {
  const resolvedId = parseTweetId(params.tweetId);
  if (!resolvedId) {
    return err("Invalid tweet ID or URL");
  }

  try {
    const rawResponse = await readClient.posts.getById(resolvedId, {
      tweetFields: [
        "created_at",
        "author_id",
        "public_metrics",
        "conversation_id",
        "in_reply_to_user_id",
        "lang",
        "source",
      ],
      expansions: ["author_id"],
      userFields: ["name", "username", "verified", "profile_image_url"],
      requestOptions: { raw: true },
    }) as unknown as Response;

    const { data: response, rateLimit } = await parseRawResponse<Record<string, unknown>>(rawResponse);

    const tweet = response?.data as Record<string, unknown> | undefined;
    if (!tweet) {
      return err(`Tweet ${resolvedId} not found`);
    }

    // Extract author info from includes if available
    const includes = response?.includes as Record<string, unknown[]> | undefined;
    const users = includes?.users as Array<Record<string, unknown>> | undefined;
    const author = users?.[0];

    const cost = ACTION_COSTS.search_per_result;
    costTracker.track("get_tweet", cost);

    return ok({
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      createdAt: tweet.created_at,
      metrics: tweet.public_metrics,
      conversationId: tweet.conversation_id,
      inReplyToUserId: tweet.in_reply_to_user_id,
      lang: tweet.lang,
      url: tweetUrl(tweet.id as string, author?.username as string | undefined),
      author: author
        ? {
            id: author.id,
            name: author.name,
            username: author.username,
            verified: author.verified,
            profileImageUrl: author.profile_image_url,
          }
        : null,
      rateLimit: formatRateLimit(rateLimit),
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const rateLimitErr = parseRateLimitError(error);
    if (rateLimitErr) return ok(rateLimitErr);
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to get tweet: ${message}`);
  }
}

export function registerGetTweet(
  api: { registerTool: Function },
  getReadClient: () => Client,
) {
  api.registerTool({
    name: "x_get_tweet",
    description:
      "Get a single tweet/post from X/Twitter by its ID or URL. Returns the full tweet text, author info, metrics, and metadata.",
    parameters: getTweetSchema,
    execute: async (_sessionId: string, params: { tweetId: string }) => {
      try {
        return await executeGetTweet(getReadClient(), params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
      }
    },
  });
}
