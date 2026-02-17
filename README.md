# 🐦 Clawbird

**OpenClaw plugin for X/Twitter** — post, reply, delete, search, like, unlike, follow, DMs, mentions, and image attachments via the official X API v2.

Built on the official [`@xdevplatform/xdk`](https://github.com/xdevplatform/twitter-api-typescript-sdk) TypeScript SDK.

> **Requires Node.js 18+** — this is a Node/TypeScript plugin installed via npm.

## Installation

Install from npm:

```bash
openclaw plugins install @xonder/clawbird
```

Or from GitHub:

```bash
openclaw plugins install github:xonder/clawbird
```

Then restart the Gateway and configure your credentials (see below).

### Local Development

```bash
git clone https://github.com/xonder/clawbird.git
cd clawbird
npm install
npm run build
openclaw plugins install --link .
```

## Configuration

Add your X API credentials in `~/.openclaw/openclaw.json`:

```json5
{
  plugins: {
    entries: {
      clawbird: {
        config: {
          apiKey: "YOUR_X_API_KEY",
          apiSecret: "YOUR_X_API_SECRET",
          accessToken: "YOUR_X_ACCESS_TOKEN",
          accessTokenSecret: "YOUR_X_ACCESS_TOKEN_SECRET",
          bearerToken: "YOUR_X_BEARER_TOKEN" // optional — used for read-only operations
        }
      }
    }
  }
}
```

### Environment Variable Fallback

If plugin config is not set, Clawbird falls back to these environment variables:

| Variable | Description |
|----------|-------------|
| `X_API_KEY` | X API Key (OAuth 1.0a) |
| `X_API_SECRET` | X API Secret |
| `X_ACCESS_TOKEN` | X Access Token |
| `X_ACCESS_SECRET` | X Access Token Secret |
| `X_BEARER_TOKEN` | X Bearer Token (optional, read-only) |

### Getting API Credentials

1. Go to the [X Developer Portal](https://developer.x.com)
2. Create a project and app
3. Generate OAuth 1.0a keys (API Key, API Secret, Access Token, Access Token Secret)
4. Optionally generate a Bearer Token for read-only operations
5. Configure pay-per-usage credits at [console.x.com](https://console.x.com)

## Agent Tools

Clawbird registers 15 agent tools, all prefixed with `x_`:

| Tool | Description | Auth | Est. Cost |
|------|-------------|------|-----------|
| `x_post_tweet` | Post a tweet (optionally with image) | OAuth1 | $0.01 |
| `x_post_thread` | Post a multi-tweet thread | OAuth1 | $0.01/tweet |
| `x_reply_tweet` | Reply to a tweet (optionally with image) | OAuth1 | $0.01 |
| `x_delete_tweet` | Delete a tweet you posted | OAuth1 | $0.01 |
| `x_like_tweet` | Like a tweet by ID or URL | OAuth1 | $0.005 |
| `x_unlike_tweet` | Unlike a previously liked tweet | OAuth1 | $0.005 |
| `x_follow_user` | Follow a user by username | OAuth1 | $0.001 |
| `x_get_tweet` | Get a single tweet by ID or URL | Bearer | $0.005 |
| `x_search_tweets` | Search recent tweets (7 days) | Bearer | ~$0.005/result |
| `x_get_user_profile` | Get user profile by username | Bearer | $0.001 |
| `x_get_mentions` | Get mentions of your account | OAuth1 | ~$0.005/result |
| `x_send_dm` | Send a direct message to a user | OAuth1 | $0.01 |
| `x_get_dms` | Get recent direct messages | OAuth1 | ~$0.005/result |
| `x_get_interaction_log` | Get log of all write actions this session | — | Free |
| `x_get_cost_summary` | Get cumulative session API costs | — | Free |

### Tool Parameters

**`x_post_tweet`** — with optional image
```json
{ "text": "Hello from OpenClaw! 🦞", "mediaUrl": "https://example.com/photo.png" }
```

**`x_post_thread`**
```json
{ "tweets": ["Thread starts here 🧵", "Second tweet in thread", "Final tweet!"] }
```

**`x_reply_tweet`** — with optional image
```json
{ "tweetId": "1234567890", "text": "Great point!", "mediaUrl": "https://example.com/chart.png" }
```
Accepts tweet IDs or full URLs (`https://x.com/user/status/1234567890`).

**`x_delete_tweet`**
```json
{ "tweetId": "1234567890" }
```

**`x_like_tweet`**
```json
{ "tweetId": "1234567890" }
```

**`x_unlike_tweet`**
```json
{ "tweetId": "1234567890" }
```

**`x_follow_user`**
```json
{ "username": "@alice" }
```

**`x_get_tweet`**
```json
{ "tweetId": "https://x.com/Pauline_Cx/status/2022729815242215865" }
```

**`x_search_tweets`**
```json
{ "query": "#AI from:openai -is:retweet", "maxResults": 25 }
```

**`x_get_user_profile`**
```json
{ "username": "@openai" }
```

**`x_get_mentions`**
```json
{ "maxResults": 20 }
```

**`x_send_dm`**
```json
{ "username": "@alice", "text": "Hey, check out our latest release!" }
```

**`x_get_dms`**
```json
{ "username": "@alice", "maxResults": 20 }
```
Omit `username` to get all recent DMs.

**`x_get_interaction_log`** — review what actions have been taken
```json
{ "limit": 10 }
```

**`x_get_cost_summary`**
```json
{}
```

### Rate Limits & Cost Tracking

- **Rate limit info** is returned on every read tool response as `rateLimit: { remaining, limit, resetsAt }`
- **429 errors** are caught and returned as `{ rateLimited: true, retryAfterSeconds, resetsAt }`
- **Cost tracking** via `estimatedCost` on every response and `x_get_cost_summary` for session totals
- **Interaction log** tracks all write actions to `clawbird-interactions.jsonl` — query via `x_get_interaction_log`

### Image Support

`x_post_tweet` and `x_reply_tweet` accept an optional `mediaUrl` parameter:
- Supports image URLs (fetched automatically) and local file paths
- Formats: JPEG, PNG, WebP, BMP, TIFF (max 5MB)
- The image is uploaded via the X media API and attached to the tweet

## Skill

Clawbird ships a `SKILL.md` that teaches agents how to use all 15 tools effectively, including parameter docs, search query syntax, thread formatting, rate limit guidance, and cost awareness.

## Development

```bash
npm install       # Install dependencies
npm run typecheck  # Type check
npm test          # Run tests (240+ tests)
npm run build     # Build to dist/
npm run dev       # Watch mode
```

### Project Structure

```
clawbird/
├── openclaw.plugin.json     # Plugin manifest
├── SKILL.md                 # Agent skill instructions
├── src/
│   ├── index.ts             # Plugin entry point (15 tools)
│   ├── client.ts            # X API client factory
│   ├── costs.ts             # Cost tracking
│   ├── rate-limit.ts        # Rate limit header parsing
│   ├── media.ts             # Image upload helper
│   ├── interaction-log.ts   # Mutation action logger
│   ├── types.ts             # Shared types & helpers
│   └── tools/               # One file per tool (15 files)
└── tests/                   # Vitest test suite (240+ tests)
```

## License

MIT
