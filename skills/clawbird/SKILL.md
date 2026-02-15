---
name: clawbird
description: Interact with X/Twitter — post tweets, threads, replies, search, like, and monitor mentions
---

# Clawbird — X/Twitter Tools

You have access to 10 tools for interacting with X (Twitter). All tools return JSON with results and estimated API cost.

## Available Tools

### Posting

**`x_post_tweet`** — Post a single tweet.
- `text` (required): Tweet content (max 280 chars)
- Returns: `{ id, text, url, estimatedCost }`

**`x_post_thread`** — Post a multi-tweet thread.
- `tweets` (required): Array of tweet texts (posted in order, each as a reply to the previous)
- Returns: `{ threadId, tweetCount, tweets: [{ id, text, url }], estimatedCost }`

**`x_reply_tweet`** — Reply to an existing tweet.
- `tweetId` (required): Tweet ID or full URL (e.g. `https://x.com/user/status/123456`)
- `text` (required): Reply content (max 280 chars)
- Returns: `{ id, text, url, inReplyTo, estimatedCost }`

### Engagement

**`x_like_tweet`** — Like a tweet.
- `tweetId` (required): Tweet ID or full URL
- Returns: `{ liked, tweetId, estimatedCost }`

### Research

**`x_search_tweets`** — Search recent tweets (last 7 days).
- `query` (required): Search query — supports X operators like `from:user`, `#hashtag`, `"exact phrase"`, `-exclude`, `lang:en`
- `maxResults` (optional): 10–100, default 10
- Returns: `{ query, resultCount, tweets: [{ id, text, authorId, createdAt, metrics, url }], estimatedCost }`

**`x_get_user_profile`** — Get a user's profile.
- `username` (required): Username with or without `@`
- Returns: `{ id, name, username, description, followersCount, followingCount, tweetCount, verified, profileImageUrl, url, createdAt, location, profileUrl, estimatedCost }`

**`x_get_mentions`** — Get recent mentions of our account.
- `maxResults` (optional): 5–100, default 10
- Returns: `{ resultCount, mentions: [{ id, text, authorId, createdAt, metrics, url }], estimatedCost }`

## Best Practices

### Thread Formatting
- Keep each tweet under 280 characters
- Start with a strong hook in tweet 1
- Number tweets (1/N) for long threads
- End with a call to action or summary

### Search Queries
- Use `from:username` to search a specific user's tweets
- Use `#hashtag` for hashtag search
- Use `"exact phrase"` for exact matches
- Combine operators: `#AI from:openai -is:retweet lang:en`
- Use `-is:retweet` to filter out retweets

### Direct Messages

**`x_send_dm`** — Send a direct message to a user.
- `username` (required): Recipient's username (with or without `@`)
- `text` (required): Message content
- Returns: `{ sent, eventId, conversationId, recipient: { id, username }, estimatedCost }`

**`x_get_dms`** — Get recent direct messages.
- `username` (optional): Filter DMs to a specific user's conversation
- `maxResults` (optional): 1–100, default 10
- Returns: `{ resultCount, messages: [{ id, text, senderId, createdAt, conversationId, eventType }], estimatedCost }`

### Cost Summary

**`x_get_cost_summary`** — Get cumulative API cost for this session.
- No parameters required
- Returns: `{ totalCost, breakdown: { [action]: { calls, totalCost } } }`

Use this to check how much the current session has spent before performing more expensive operations.

### Cost Awareness
Every tool response includes an `estimatedCost` field. Approximate costs:
- Post/Reply: ~$0.01 per tweet
- Like: ~$0.005
- Search: ~$0.005 per result
- User lookup: ~$0.001
- Mentions: ~$0.005 per result
- Send DM: ~$0.01
- Read DMs: ~$0.005 per result

### Rate Limits
- Posting: 200 tweets per 15 minutes
- Search: 180 requests per 15 minutes (user), 450 (app)
- Likes: 50 per 15 minutes
- User lookup: 900 per 15 minutes
- Mentions: 180 per 15 minutes
- DMs: 200 messages per 15 minutes, 1000 per 24 hours

### Error Handling
All tools return errors as `{ error: "message", details?: ... }`. Common issues:
- Rate limiting (wait and retry)
- Authentication errors (check API credentials)
- Tweet not found (verify ID/URL)
- Empty text (provide non-empty content)
