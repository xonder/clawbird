import type { Client } from "@xdevplatform/xdk";
import type { ClawbirdConfig } from "./types.js";
import { resolveConfig, createClients, type XClients } from "./client.js";
import { registerPostTweet } from "./tools/post-tweet.js";
import { registerPostThread } from "./tools/post-thread.js";
import { registerReplyTweet } from "./tools/reply-tweet.js";
import { registerLikeTweet } from "./tools/like-tweet.js";
import { registerSearchTweets } from "./tools/search-tweets.js";
import { registerGetUserProfile } from "./tools/get-user-profile.js";
import { registerGetMentions } from "./tools/get-mentions.js";
import { registerGetCostSummary } from "./tools/get-cost-summary.js";
import { registerSendDm } from "./tools/send-dm.js";
import { registerGetDms } from "./tools/get-dms.js";
import { registerFollowUser } from "./tools/follow-user.js";
import { registerGetTweet } from "./tools/get-tweet.js";
import { registerGetInteractionLog } from "./tools/get-interaction-log.js";

/**
 * OpenClaw plugin entry point.
 *
 * Registers 13 agent tools for interacting with X/Twitter:
 *   - x_post_tweet       — Post a single tweet
 *   - x_post_thread      — Post a multi-tweet thread
 *   - x_reply_tweet      — Reply to a tweet by ID/URL
 *   - x_like_tweet       — Like a tweet
 *   - x_search_tweets    — Search recent tweets
 *   - x_get_user_profile — Get user profile by username
 *   - x_get_mentions     — Get mentions of your account
 *   - x_send_dm          — Send a direct message
 *   - x_get_dms          — Get recent direct messages
 *   - x_follow_user      — Follow a user
 *   - x_get_tweet        — Get a single tweet by ID/URL
 *   - x_get_interaction_log — Get log of all write actions performed
 *   - x_get_cost_summary — Get cumulative API cost summary
 */
export default function clawbird(api: {
  pluginConfig?: Partial<ClawbirdConfig>;
  registerTool: Function;
}) {
  // Lazy client initialization — created on first tool call
  let clients: XClients | null = null;

  function ensureClients(): XClients {
    if (!clients) {
      const config = resolveConfig(api.pluginConfig);
      clients = createClients(config);
    }
    return clients;
  }

  function getWriteClient(): Client {
    return ensureClients().writeClient;
  }

  function getReadClient(): Client {
    return ensureClients().readClient;
  }

  // Register all tools
  registerPostTweet(api, getWriteClient);
  registerPostThread(api, getWriteClient);
  registerReplyTweet(api, getWriteClient);
  registerLikeTweet(api, getWriteClient);
  registerSearchTweets(api, getReadClient);
  registerGetUserProfile(api, getReadClient);
  registerGetMentions(api, getReadClient, getWriteClient);
  registerSendDm(api, getWriteClient, getReadClient);
  registerGetDms(api, getReadClient);
  registerFollowUser(api, getWriteClient, getReadClient);
  registerGetTweet(api, getReadClient);
  registerGetInteractionLog(api);
  registerGetCostSummary(api);
}
