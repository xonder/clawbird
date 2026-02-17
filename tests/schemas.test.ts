import { describe, it, expect } from "vitest";
import { postTweetSchema } from "../src/tools/post-tweet.js";
import { postThreadSchema } from "../src/tools/post-thread.js";
import { replyTweetSchema } from "../src/tools/reply-tweet.js";
import { likeTweetSchema } from "../src/tools/like-tweet.js";
import { unlikeTweetSchema } from "../src/tools/unlike-tweet.js";
import { deleteTweetSchema } from "../src/tools/delete-tweet.js";
import { searchTweetsSchema } from "../src/tools/search-tweets.js";
import { getUserProfileSchema } from "../src/tools/get-user-profile.js";
import { getMentionsSchema } from "../src/tools/get-mentions.js";
import { sendDmSchema } from "../src/tools/send-dm.js";
import { getDmsSchema } from "../src/tools/get-dms.js";
import { followUserSchema } from "../src/tools/follow-user.js";
import { getTweetSchema } from "../src/tools/get-tweet.js";
import { getInteractionLogSchema } from "../src/tools/get-interaction-log.js";
import { getCostSummarySchema } from "../src/tools/get-cost-summary.js";

/**
 * Verify that all tool parameter schemas produce valid JSON Schema objects
 * suitable for LLM function-calling.
 */
describe("Tool parameter schemas", () => {
  const schemas = [
    { name: "x_post_tweet", schema: postTweetSchema },
    { name: "x_post_thread", schema: postThreadSchema },
    { name: "x_reply_tweet", schema: replyTweetSchema },
    { name: "x_like_tweet", schema: likeTweetSchema },
    { name: "x_unlike_tweet", schema: unlikeTweetSchema },
    { name: "x_delete_tweet", schema: deleteTweetSchema },
    { name: "x_search_tweets", schema: searchTweetsSchema },
    { name: "x_get_user_profile", schema: getUserProfileSchema },
    { name: "x_get_mentions", schema: getMentionsSchema },
    { name: "x_send_dm", schema: sendDmSchema },
    { name: "x_get_dms", schema: getDmsSchema },
    { name: "x_follow_user", schema: followUserSchema },
    { name: "x_get_tweet", schema: getTweetSchema },
    { name: "x_get_interaction_log", schema: getInteractionLogSchema },
    { name: "x_get_cost_summary", schema: getCostSummarySchema },
  ];

  for (const { name, schema } of schemas) {
    describe(name, () => {
      it("is a valid JSON Schema object", () => {
        expect(schema).toBeDefined();
        expect(schema.type).toBe("object");
        expect(schema.properties).toBeDefined();
        expect(typeof schema.properties).toBe("object");
      });

      it("has TypeBox metadata", () => {
        // TypeBox schemas include these standard fields
        expect(schema).toHaveProperty("type");
        expect(schema).toHaveProperty("properties");
      });
    });
  }

  describe("x_post_tweet schema details", () => {
    it("requires text parameter", () => {
      expect(postTweetSchema.required).toContain("text");
      expect(postTweetSchema.properties.text.type).toBe("string");
    });
  });

  describe("x_post_thread schema details", () => {
    it("requires tweets array", () => {
      expect(postThreadSchema.required).toContain("tweets");
      expect(postThreadSchema.properties.tweets.type).toBe("array");
    });

    it("tweets items are strings", () => {
      expect(postThreadSchema.properties.tweets.items.type).toBe("string");
    });
  });

  describe("x_reply_tweet schema details", () => {
    it("requires tweetId and text", () => {
      expect(replyTweetSchema.required).toContain("tweetId");
      expect(replyTweetSchema.required).toContain("text");
    });
  });

  describe("x_like_tweet schema details", () => {
    it("requires tweetId", () => {
      expect(likeTweetSchema.required).toContain("tweetId");
      expect(likeTweetSchema.properties.tweetId.type).toBe("string");
    });
  });

  describe("x_search_tweets schema details", () => {
    it("requires query, maxResults is optional", () => {
      expect(searchTweetsSchema.required).toContain("query");
      // maxResults should not be required
      expect(searchTweetsSchema.required).not.toContain("maxResults");
    });

    it("maxResults has min/max constraints", () => {
      const maxResultsProp = searchTweetsSchema.properties.maxResults;
      expect(maxResultsProp.minimum).toBe(10);
      expect(maxResultsProp.maximum).toBe(100);
    });
  });

  describe("x_get_user_profile schema details", () => {
    it("requires username", () => {
      expect(getUserProfileSchema.required).toContain("username");
      expect(getUserProfileSchema.properties.username.type).toBe("string");
    });
  });

  describe("x_send_dm schema details", () => {
    it("requires username and text", () => {
      expect(sendDmSchema.required).toContain("username");
      expect(sendDmSchema.required).toContain("text");
      expect(sendDmSchema.properties.username.type).toBe("string");
      expect(sendDmSchema.properties.text.type).toBe("string");
    });
  });

  describe("x_get_dms schema details", () => {
    it("has no required fields (all optional)", () => {
      expect(getDmsSchema.required ?? []).not.toContain("username");
      expect(getDmsSchema.required ?? []).not.toContain("maxResults");
    });
  });

  describe("x_get_mentions schema details", () => {
    it("has no required fields (maxResults is optional)", () => {
      expect(getMentionsSchema.required ?? []).not.toContain("maxResults");
    });

    it("maxResults has min/max constraints", () => {
      const maxResultsProp = getMentionsSchema.properties.maxResults;
      expect(maxResultsProp.minimum).toBe(5);
      expect(maxResultsProp.maximum).toBe(100);
    });
  });
});
