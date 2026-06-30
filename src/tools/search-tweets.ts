import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, tweetUrl } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";
import { parseRawResponse, formatRateLimit, parseRateLimitError } from "../rate-limit.js";

const XQUIK_SEARCH_URL = "https://xquik.com/api/v1/x/tweets/search";

interface XquikSearchConfig {
  apiKey?: string;
  provider?: "x" | "xquik";
}

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

async function executeXquikSearchTweets(
  config: XquikSearchConfig,
  params: { query: string; maxResults?: number },
) {
  if (!config.apiKey) {
    return err("XQUIK_API_KEY is required when X_READ_PROVIDER=xquik");
  }

  const maxResults = params.maxResults ?? 10;
  const url = new URL(XQUIK_SEARCH_URL);
  url.searchParams.set("q", params.query);
  url.searchParams.set("queryType", "Latest");
  url.searchParams.set("limit", String(maxResults));

  const response = await fetch(url, {
    headers: { "X-API-Key": config.apiKey },
  });

  if (!response.ok) {
    const text = await response.text();
    return err(`Xquik search failed: ${response.status}`, text.slice(0, 200));
  }

  const payload = await response.json() as {
    tweets?: Array<Record<string, unknown>>;
    has_next_page?: boolean;
    next_cursor?: string;
  };
  const tweetsData = payload.tweets ?? [];
  const tweets = tweetsData.map((tweet) => {
    const author = tweet.author as Record<string, unknown> | undefined;
    const username = author?.username ?? author?.userName ?? "i";
    return {
      id: tweet.id,
      text: tweet.text,
      authorId: author?.id,
      authorUsername: username,
      createdAt: tweet.createdAt,
      metrics: {
        likes: tweet.likeCount,
        retweets: tweet.retweetCount,
        replies: tweet.replyCount,
        quotes: tweet.quoteCount,
      },
      url: tweet.url ?? tweetUrl(String(tweet.id), String(username)),
    };
  });

  return ok({
    query: params.query,
    resultCount: tweets.length,
    tweets,
    hasNextPage: Boolean(payload.has_next_page),
    nextCursor: payload.next_cursor,
    provider: "xquik",
  });
}

export async function executeSearchTweets(
  readClient: Client | undefined,
  params: { query: string; maxResults?: number },
  xquikConfig: XquikSearchConfig = {},
) {
  if (!params.query || params.query.trim().length === 0) {
    return err("Search query cannot be empty");
  }

  if (xquikConfig.provider === "xquik") {
    return executeXquikSearchTweets(xquikConfig, params);
  }

  if (!readClient) {
    return err("X read client is required when X_READ_PROVIDER is not xquik");
  }

  const maxResults = params.maxResults ?? 10;

  try {
    const rawResponse = await readClient.posts.searchRecent(params.query, {
      maxResults,
      tweetFields: [
        "created_at",
        "author_id",
        "public_metrics",
        "conversation_id",
      ],
      requestOptions: { raw: true },
    }) as unknown as Response;

    const { data: response, rateLimit } = await parseRawResponse<Record<string, unknown>>(rawResponse);

    const tweetsData = (response?.data ?? []) as Array<Record<string, unknown>>;
    const tweets = tweetsData.map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      createdAt: tweet.created_at,
      metrics: tweet.public_metrics,
      url: tweetUrl(tweet.id as string),
    }));

    const resultCount = tweets.length;
    const cost = ACTION_COSTS.search_per_result * resultCount;
    costTracker.track("search", cost);

    return ok({
      query: params.query,
      resultCount,
      tweets,
      rateLimit: formatRateLimit(rateLimit),
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const rateLimitErr = parseRateLimitError(error);
    if (rateLimitErr) return ok(rateLimitErr);
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to search tweets: ${message}`);
  }
}

export function registerSearchTweets(
  api: { registerTool: Function },
  getReadClient: () => Client,
  getXquikConfig: () => XquikSearchConfig = () => ({}),
) {
  api.registerTool({
    name: "x_search_tweets",
    description:
      "Search recent tweets on X/Twitter (last 7 days). Supports X search operators like 'from:user', '#hashtag', keyword phrases. Returns matching tweets with metadata and estimated API cost.",
    parameters: searchTweetsSchema,
    execute: async (
      _sessionId: string,
      params: { query: string; maxResults?: number },
    ) => {
      try {
        const xquikConfig = getXquikConfig();
        const readClient =
          xquikConfig.provider === "xquik" ? undefined : getReadClient();
        return await executeSearchTweets(readClient, params, xquikConfig);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
      }
    },
  });
}
