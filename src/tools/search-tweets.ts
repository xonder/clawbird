import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, tweetUrl } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";

export const searchTweetsSchema = Type.Object({
  query: Type.String({
    description:
      "Search query (supports X search operators, e.g. 'from:user', '#hashtag', keywords)",
  }),
  maxResults: Type.Optional(
    Type.Number({
      description: "Maximum number of results (10-100, default 10)",
      minimum: 10,
      maximum: 100,
    }),
  ),
});

export async function executeSearchTweets(
  readClient: Client,
  params: { query: string; maxResults?: number },
) {
  if (!params.query || params.query.trim().length === 0) {
    return err("Search query cannot be empty");
  }

  const maxResults = params.maxResults ?? 10;

  try {
    const response = await readClient.posts.searchRecent(params.query, {
      maxResults,
      tweetFields: [
        "created_at",
        "author_id",
        "public_metrics",
        "conversation_id",
      ],
    });

    const tweets =
      response?.data?.map((tweet) => ({
        id: tweet.id,
        text: tweet.text,
        authorId: tweet.authorId,
        createdAt: tweet.createdAt,
        metrics: tweet.publicMetrics,
        url: tweetUrl(tweet.id as string),
      })) ?? [];

    const resultCount = tweets.length;
    const cost = ACTION_COSTS.search_per_result * resultCount;
    costTracker.track("search", cost);

    return ok({
      query: params.query,
      resultCount,
      tweets,
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to search tweets: ${message}`);
  }
}

export function registerSearchTweets(
  api: { registerTool: Function },
  getReadClient: () => Client,
) {
  api.registerTool({
    name: "x_search_tweets",
    description:
      "Search recent tweets on X/Twitter (last 7 days). Supports X search operators like 'from:user', '#hashtag', keyword phrases. Returns matching tweets with metadata and estimated API cost.",
    parameters: searchTweetsSchema,
    execute: async (
      _sessionId: string,
      params: { query: string; maxResults?: number },
    ) => executeSearchTweets(getReadClient(), params),
  });
}
