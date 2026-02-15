import { describe, it, expect } from "vitest";
import {
  extractRateLimit,
  parseRawResponse,
  formatRateLimit,
  parseRateLimitError,
} from "../src/rate-limit.js";

describe("extractRateLimit", () => {
  it("extracts rate limit headers", () => {
    const headers = new Headers({
      "x-rate-limit-remaining": "42",
      "x-rate-limit-limit": "100",
      "x-rate-limit-reset": "1739600000",
    });

    const result = extractRateLimit(headers);
    expect(result).not.toBeNull();
    expect(result!.remaining).toBe(42);
    expect(result!.limit).toBe(100);
    expect(result!.resetsAt).toBe(new Date(1739600000 * 1000).toISOString());
  });

  it("returns null when no rate limit headers present", () => {
    const headers = new Headers({ "content-type": "application/json" });
    expect(extractRateLimit(headers)).toBeNull();
  });

  it("handles partial headers", () => {
    const headers = new Headers({ "x-rate-limit-remaining": "5" });
    const result = extractRateLimit(headers);
    expect(result).not.toBeNull();
    expect(result!.remaining).toBe(5);
    expect(result!.limit).toBe(-1);
  });
});

describe("parseRawResponse", () => {
  it("parses JSON body and extracts rate limit headers", async () => {
    const body = JSON.stringify({ data: { id: "123", text: "hello" } });
    const response = new Response(body, {
      headers: {
        "content-type": "application/json",
        "x-rate-limit-remaining": "99",
        "x-rate-limit-limit": "100",
        "x-rate-limit-reset": "1739600000",
      },
    });

    const { data, rateLimit } = await parseRawResponse(response);
    expect(data).toEqual({ data: { id: "123", text: "hello" } });
    expect(rateLimit).not.toBeNull();
    expect(rateLimit!.remaining).toBe(99);
  });

  it("returns null rateLimit when no headers", async () => {
    const body = JSON.stringify({ data: [] });
    const response = new Response(body, {
      headers: { "content-type": "application/json" },
    });

    const { data, rateLimit } = await parseRawResponse(response);
    expect(data).toEqual({ data: [] });
    expect(rateLimit).toBeNull();
  });
});

describe("formatRateLimit", () => {
  it("formats rate limit info", () => {
    const result = formatRateLimit({
      remaining: 42,
      limit: 100,
      resetsAt: "2026-02-15T00:00:00.000Z",
    });
    expect(result).toEqual({
      remaining: 42,
      limit: 100,
      resetsAt: "2026-02-15T00:00:00.000Z",
    });
  });

  it("returns undefined for null input", () => {
    expect(formatRateLimit(null)).toBeUndefined();
  });
});

describe("parseRateLimitError", () => {
  it("returns structured error for 429 ApiError", () => {
    const error = {
      status: 429,
      statusText: "Too Many Requests",
      headers: new Headers({
        "x-rate-limit-remaining": "0",
        "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 300),
      }),
      message: "Rate limited",
    };

    const result = parseRateLimitError(error);
    expect(result).not.toBeNull();
    expect(result!.rateLimited).toBe(true);
    expect(result!.retryAfterSeconds).toBeGreaterThan(0);
    expect(result!.retryAfterSeconds).toBeLessThanOrEqual(300);
    expect(result!.resetsAt).toBeTruthy();
    expect(result!.error).toContain("Rate limit exceeded");
  });

  it("returns null for non-429 errors", () => {
    const error = { status: 500, message: "Server error" };
    expect(parseRateLimitError(error)).toBeNull();
  });

  it("returns null for non-object errors", () => {
    expect(parseRateLimitError("string error")).toBeNull();
    expect(parseRateLimitError(null)).toBeNull();
    expect(parseRateLimitError(42)).toBeNull();
  });

  it("returns null for regular Error objects", () => {
    expect(parseRateLimitError(new Error("fail"))).toBeNull();
  });

  it("provides default 60s retry when no reset header", () => {
    const error = {
      status: 429,
      headers: new Headers(),
      message: "Rate limited",
    };

    const result = parseRateLimitError(error);
    expect(result).not.toBeNull();
    expect(result!.retryAfterSeconds).toBe(60);
  });
});
