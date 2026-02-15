/**
 * Rate limit information extracted from X API response headers.
 */
export interface RateLimitInfo {
  /** Requests remaining in the current rate limit window. */
  remaining: number;
  /** Total request limit for this endpoint in the current window. */
  limit: number;
  /** ISO timestamp when the rate limit window resets. */
  resetsAt: string;
}

/**
 * Extract rate limit headers from a fetch Response.
 */
export function extractRateLimit(headers: Headers): RateLimitInfo | null {
  const remaining = headers.get("x-rate-limit-remaining");
  const limit = headers.get("x-rate-limit-limit");
  const reset = headers.get("x-rate-limit-reset");

  if (remaining === null && limit === null && reset === null) {
    return null;
  }

  return {
    remaining: remaining !== null ? parseInt(remaining, 10) : -1,
    limit: limit !== null ? parseInt(limit, 10) : -1,
    resetsAt: reset
      ? new Date(parseInt(reset, 10) * 1000).toISOString()
      : "",
  };
}

/**
 * Parse a raw Response into JSON data + rate limit info.
 * Used when calling SDK methods with `{ requestOptions: { raw: true } }`.
 */
export async function parseRawResponse<T = unknown>(
  response: Response,
): Promise<{ data: T; rateLimit: RateLimitInfo | null }> {
  const rateLimit = extractRateLimit(response.headers);
  const data = (await response.json()) as T;
  // Transform snake_case keys to camelCase at top level
  return { data, rateLimit };
}

/**
 * Serialize rate limit info for inclusion in tool responses.
 * Returns undefined if no rate limit info available.
 */
export function formatRateLimit(
  rateLimit: RateLimitInfo | null,
): Record<string, unknown> | undefined {
  if (!rateLimit) return undefined;
  return {
    remaining: rateLimit.remaining,
    limit: rateLimit.limit,
    resetsAt: rateLimit.resetsAt,
  };
}

/**
 * Structured rate limit error info for 429 responses.
 */
export interface RateLimitError {
  error: string;
  rateLimited: true;
  retryAfterSeconds: number;
  resetsAt: string;
}

/**
 * Check if an error is an ApiError with status 429 and extract rate limit info.
 * Returns null if it's not a rate limit error.
 */
export function parseRateLimitError(
  error: unknown,
): RateLimitError | null {
  // Check for ApiError shape: { status, headers, message }
  if (
    typeof error !== "object" ||
    error === null ||
    !("status" in error)
  ) {
    return null;
  }

  const apiErr = error as { status: number; headers?: Headers; message?: string };
  if (apiErr.status !== 429) {
    return null;
  }

  let resetsAt = "";
  let retryAfterSeconds = 60; // default fallback

  if (apiErr.headers) {
    const reset = apiErr.headers.get?.("x-rate-limit-reset");
    if (reset) {
      const resetEpoch = parseInt(reset, 10);
      resetsAt = new Date(resetEpoch * 1000).toISOString();
      retryAfterSeconds = Math.max(
        0,
        Math.ceil(resetEpoch - Date.now() / 1000),
      );
    }
  }

  return {
    error: `Rate limit exceeded. Retry after ${retryAfterSeconds}s (resets at ${resetsAt || "unknown"}).`,
    rateLimited: true,
    retryAfterSeconds,
    resetsAt,
  };
}
