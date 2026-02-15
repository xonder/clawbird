# 🐦 Clawbird

**OpenClaw plugin for X/Twitter** — post tweets, threads, replies, search, like, and monitor mentions.

Built on the official [`@xdevplatform/xdk`](https://github.com/xdevplatform/twitter-api-typescript-sdk) TypeScript SDK.

## Installation

```bash
openclaw plugins install github:xonder/clawbird
```

Or install locally for development:

```bash
git clone https://github.com/xonder/clawbird.git
cd clawbird
npm install
npm run build
openclaw plugins install --link .
```

Then restart the Gateway and configure your credentials (see below).

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

Clawbird registers 7 agent tools, all prefixed with `x_`:

| Tool | Description | Auth | Est. Cost |
|------|-------------|------|-----------|
| `x_post_tweet` | Post a single tweet | OAuth1 | $0.01 |
| `x_post_thread` | Post a multi-tweet thread | OAuth1 | $0.01/tweet |
| `x_reply_tweet` | Reply to a tweet by ID or URL | OAuth1 | $0.01 |
| `x_like_tweet` | Like a tweet by ID or URL | OAuth1 | $0.005 |
| `x_search_tweets` | Search recent tweets (7 days) | Bearer | ~$0.005/result |
| `x_get_user_profile` | Get user profile by username | Bearer | $0.001 |
| `x_get_mentions` | Get mentions of your account | OAuth1 | ~$0.005/result |

### Tool Parameters

**`x_post_tweet`**
```json
{ "text": "Hello from OpenClaw! 🦞" }
```

**`x_post_thread`**
```json
{ "tweets": ["Thread starts here 🧵", "Second tweet in thread", "Final tweet!"] }
```

**`x_reply_tweet`**
```json
{ "tweetId": "1234567890", "text": "Great point!" }
```
Accepts tweet IDs or full URLs (`https://x.com/user/status/1234567890`).

**`x_like_tweet`**
```json
{ "tweetId": "1234567890" }
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

### Cost Tracking

Every tool response includes an `estimatedCost` field showing the approximate X API cost for that operation. This helps agents and users stay aware of API spending.

## Skill

Clawbird ships a `SKILL.md` that teaches agents how to use the tools effectively, including:
- Parameter documentation for all 7 tools
- Search query syntax (operators, hashtags, filters)
- Thread formatting best practices
- Rate limit guidance
- Cost awareness tips

## Development

```bash
# Install dependencies
npm install

# Typecheck
npm run typecheck

# Run tests
npm test

# Build
npm run build

# Watch mode
npm run dev
```

### Project Structure

```
clawbird/
├── openclaw.plugin.json    # Plugin manifest
├── src/
│   ├── index.ts            # Plugin entry point
│   ├── client.ts           # X API client factory
│   ├── costs.ts            # Cost tracking
│   ├── types.ts            # Shared types & helpers
│   └── tools/              # One file per tool
│       ├── post-tweet.ts
│       ├── post-thread.ts
│       ├── reply-tweet.ts
│       ├── like-tweet.ts
│       ├── search-tweets.ts
│       ├── get-user-profile.ts
│       └── get-mentions.ts
├── skills/clawbird/
│   └── SKILL.md            # Agent instructions
└── tests/                  # Vitest test suite (96 tests)
```

## License

MIT
