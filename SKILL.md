---
name: clawbird
description: "X/Twitter integration — post, reply, search, like, unlike, delete, follow, DMs, mentions, and media via the official X API v2"
homepage: https://github.com/xonder/clawbird
metadata:
  openclaw:
    emoji: "🐦"
    requires:
      plugins: ["clawbird"]
      env: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"]
    primaryEnv: "X_API_KEY"
    install:
      - id: "npm"
        kind: "node"
        package: "@xonder/clawbird"
        label: "Install clawbird plugin (npm)"
---

# Clawbird — X/Twitter Tools

You have access to 15 tools for interacting with X (Twitter) via the official X API v2. All tools return JSON with results, estimated API cost, and rate limit information.

## Authentication & Credentials

This plugin authenticates to the X API using **OAuth 1.0a User Context** for write operations (posting, liking, following, DMs) and optionally a **Bearer Token** for read-only operations (search, user lookup).

**Where credentials come from:** You must generate them at the [X Developer Portal](https://developer.x.com):
1. Create a Project and App at developer.x.com
2. Generate OAuth 1.0a keys: API Key, API Secret, Access Token, Access Token Secret
3. Optionally generate a Bearer Token for read-only operations

**How credentials are stored:** Credentials are configured in OpenClaw's plugin config at `plugins.entries.clawbird.config` in `~/.openclaw/openclaw.json`. They are never written to disk by the plugin itself. Fallback: environment variables `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `X_BEARER_TOKEN`.

**No credentials are hardcoded or bundled.** The plugin will return a clear error if credentials are missing.

## External Endpoints

All network requests go exclusively to the official X API v2. No other hosts are contacted (except user-provided image URLs when using `mediaUrl`).

| Endpoint | Method | Tool(s) | Data Sent |
|----------|--------|---------|-----------|
| `https://api.x.com/2/tweets` | POST | x_post_tweet, x_post_thread, x_reply_tweet | Tweet text, reply/media metadata |
| `https://api.x.com/2/tweets/:id` | GET | x_get_tweet | Tweet ID |
| `https://api.x.com/2/tweets/:id` | DELETE | x_delete_tweet | Tweet ID |
| `https://api.x.com/2/tweets/search/recent` | GET | x_search_tweets | Search query string |
| `https://api.x.com/2/media/upload` | POST | x_post_tweet, x_reply_tweet (with mediaUrl) | Base64-encoded image data |
| `https://api.x.com/2/users/me` | GET | x_like_tweet, x_unlike_tweet, x_get_mentions, x_follow_user | (auth headers only) |
| `https://api.x.com/2/users/by/username/:username` | GET | x_get_user_profile, x_send_dm, x_follow_user | Username |
| `https://api.x.com/2/users/:id/likes` | POST | x_like_tweet | Tweet ID |
| `https://api.x.com/2/users/:id/likes/:tweet_id` | DELETE | x_unlike_tweet | Tweet ID |
| `https://api.x.com/2/users/:id/mentions` | GET | x_get_mentions | User ID, pagination params |
| `https://api.x.com/2/users/:id/following` | POST | x_follow_user | Target user ID |
| `https://api.x.com/2/dm_conversations/with/:id/messages` | POST | x_send_dm | Message text, recipient ID |
| `https://api.x.com/2/dm_conversations/with/:id/dm_events` | GET | x_get_dms (filtered) | Participant ID |
| `https://api.x.com/2/dm_events` | GET | x_get_dms (all) | Pagination params |

## Security & Privacy

- **Network access:** Only `api.x.com` (official X API) plus any user-provided image URLs when `mediaUrl` is used. No other domains are contacted.
- **Local file access:** The interaction log (`clawbird-interactions.jsonl`) is the only file written. Images from local file paths are read when `mediaUrl` points to a local file.
- **Credential handling:** OAuth tokens are read from plugin config or env vars at runtime and passed to the X API via signed HTTP headers. They are never logged, cached to disk, or transmitted to any third party.
- **Data sent to X:** Only the data you explicitly provide in tool parameters (tweet text, search queries, usernames, message text, images). No additional user data is collected or sent.
- **Data received from X:** Tweet content, user profiles, DM messages, and engagement metrics as returned by the X API. This data is returned to the agent as JSON and not stored persistently.

## Trust Statement

Clawbird is open-source (MIT) at https://github.com/xonder/clawbird. All source code is auditable. The plugin:
- Makes **no network requests** other than to `api.x.com` (plus user-provided image URLs)
- Writes only the **interaction log** to disk (no other filesystem writes)
- Has **zero transitive dependencies** beyond the official `@xdevplatform/xdk` SDK and `@sinclair/typebox`
- Includes a comprehensive test suite (240+ tests) verifiable via `npm test`

## Write Actions & Autonomous Use

The following tools **modify remote state** on your X account:

| Tool | Action | Reversible? |
|------|--------|-------------|
| x_post_tweet | Posts a tweet (optionally with image) | Use x_delete_tweet |
| x_post_thread | Posts multiple tweets | Use x_delete_tweet per tweet |
| x_reply_tweet | Posts a reply (optionally with image) | Use x_delete_tweet |
| x_like_tweet | Likes a tweet | Use x_unlike_tweet |
| x_unlike_tweet | Removes a like | Re-like with x_like_tweet |
| x_delete_tweet | Deletes a tweet | Cannot undo |
| x_follow_user | Follows a user | Unfollow manually |
| x_send_dm | Sends a direct message | Cannot unsend |

All write actions are logged to `clawbird-interactions.jsonl` and can be reviewed via `x_get_interaction_log`.

**Recommendation:** If running autonomously, consider requiring explicit user confirmation before write actions by configuring agent-level tool policies. Read-only tools (x_get_tweet, x_search_tweets, x_get_user_profile, x_get_mentions, x_get_dms, x_get_cost_summary, x_get_interaction_log) are safe for autonomous use.

## Rate Limit Handling

- **Read tools** return a `rateLimit` field on every response: `{ remaining, limit, resetsAt }`
- **All tools** detect HTTP 429 rate limit errors and return structured info: `{ rateLimited: true, retryAfterSeconds, resetsAt }`
- When you see `rateLimited: true`, wait the indicated seconds before retrying

## Available Tools

### Posting

**`x_post_tweet`** — Post a tweet, optionally with an image.
- `text` (required): Tweet content (max 280 chars)
- `mediaUrl` (optional): Image URL or local file path to attach (supports jpg, png, webp, bmp, tiff)
- Returns: `{ id, text, url, mediaIds?, estimatedCost }`

**`x_post_thread`** — Post a multi-tweet thread.
- `tweets` (required): Array of tweet texts (posted in order, each as a reply to the previous)
- Returns: `{ threadId, tweetCount, tweets: [{ id, text, url }], estimatedCost }`

**`x_reply_tweet`** — Reply to an existing tweet, optionally with an image.
- `tweetId` (required): Tweet ID or full URL (e.g. `https://x.com/user/status/123456`)
- `text` (required): Reply content (max 280 chars)
- `mediaUrl` (optional): Image URL or local file path to attach
- Returns: `{ id, text, url, inReplyTo, mediaIds?, estimatedCost }`

**`x_delete_tweet`** — Delete a tweet you posted.
- `tweetId` (required): Tweet ID or full URL
- Returns: `{ deleted, tweetId, estimatedCost }`

### Engagement

**`x_like_tweet`** — Like a tweet.
- `tweetId` (required): Tweet ID or full URL
- Returns: `{ liked, tweetId, estimatedCost }`

**`x_unlike_tweet`** — Unlike a previously liked tweet.
- `tweetId` (required): Tweet ID or full URL
- Returns: `{ unliked, tweetId, estimatedCost }`

### Social

**`x_follow_user`** — Follow a user.
- `username` (required): Username to follow (with or without `@`)
- Returns: `{ following, user: { id, username }, estimatedCost }`

### Research

**`x_get_tweet`** — Get a single tweet by ID or URL.
- `tweetId` (required): Tweet ID or full URL (e.g. `https://x.com/user/status/123456`)
- Returns: `{ id, text, authorId, createdAt, metrics, conversationId, lang, url, author, rateLimit, estimatedCost }`

**`x_search_tweets`** — Search recent tweets (last 7 days).
- `query` (required): Search query — supports X operators like `from:user`, `#hashtag`, `"exact phrase"`, `-exclude`, `lang:en`
- `maxResults` (optional): 10–100, default 10
- Returns: `{ query, resultCount, tweets: [...], rateLimit, estimatedCost }`

**`x_get_user_profile`** — Get a user's profile.
- `username` (required): Username with or without `@`
- Returns: `{ id, name, username, description, followersCount, followingCount, tweetCount, verified, profileImageUrl, url, createdAt, location, profileUrl, rateLimit, estimatedCost }`

**`x_get_mentions`** — Get recent mentions of the authenticated account.
- `maxResults` (optional): 5–100, default 10
- Returns: `{ resultCount, mentions: [...], rateLimit, estimatedCost }`

### Direct Messages

**`x_send_dm`** — Send a direct message to a user.
- `username` (required): Recipient's username (with or without `@`)
- `text` (required): Message content
- Returns: `{ sent, eventId, conversationId, recipient: { id, username }, estimatedCost }`

**`x_get_dms`** — Get recent direct messages.
- `username` (optional): Filter DMs to a specific user's conversation
- `maxResults` (optional): 1–100, default 10
- Returns: `{ resultCount, messages: [...], rateLimit, estimatedCost }`

### Utility

**`x_get_interaction_log`** — Get log of all write actions performed this session.
- `limit` (optional): Max number of recent entries to return (default: all)
- Returns: `{ totalEntries, returned, logFile, entries: [{ timestamp, action, summary, details }] }`

Use this to review what has already been done and avoid duplicating actions.

**`x_get_cost_summary`** — Get cumulative API cost for this session.
- No parameters required
- Returns: `{ totalCost, breakdown: { [action]: { calls, totalCost } } }`

## Best Practices

### Image Tweets
- Pass `mediaUrl` with a URL or local file path to attach an image
- Supported formats: JPEG, PNG, WebP, BMP, TIFF (max 5MB)
- GIFs and videos require chunked upload (not currently supported)
- The image is fetched, base64 encoded, and uploaded before the tweet is posted

### Search Queries
- Use `from:username` to search a specific user's tweets
- Use `#hashtag` for hashtag search
- Use `"exact phrase"` for exact matches
- Combine operators: `#AI from:openai -is:retweet lang:en`
- Use `-is:retweet` to filter out retweets

### Thread Formatting
- Keep each tweet under 280 characters
- Start with a strong hook in tweet 1
- Number tweets (1/N) for long threads
- End with a call to action or summary

### Cost Awareness
Every tool response includes an `estimatedCost` field. Approximate costs:
- Post/Reply/Delete: ~$0.01 per tweet
- Like/Unlike: ~$0.005
- Search: ~$0.005 per result
- User lookup: ~$0.001
- Mentions: ~$0.005 per result
- Send DM: ~$0.01
- Read DMs: ~$0.005 per result
- Get tweet: ~$0.005

Use `x_get_cost_summary` to check cumulative session spend before expensive operations.

### Rate Limits
- Posting/Deleting: 200 tweets per 15 minutes
- Search: 180 requests per 15 minutes (user), 450 (app)
- Likes/Unlikes: 50 per 15 minutes
- User lookup: 900 per 15 minutes
- Mentions: 180 per 15 minutes
- DMs: 200 messages per 15 minutes, 1000 per 24 hours
- Following: 400 per 24 hours

### Error Handling
All tools return errors as `{ error: "message", details?: ... }`. Common issues:
- Rate limiting — returns `{ rateLimited: true, retryAfterSeconds, resetsAt }`, wait before retrying
- Authentication errors — check API credentials
- Tweet not found — verify ID/URL
- Empty text — provide non-empty content
