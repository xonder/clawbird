import { describe, it, expect } from "vitest";
import { ok, err, tweetUrl, parseTweetId, normalizeUsername } from "../src/types.js";

describe("ok", () => {
  it("wraps data in tool result format", () => {
    const result = ok({ foo: "bar" });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.foo).toBe("bar");
  });

  it("formats JSON with indentation", () => {
    const result = ok({ a: 1 });
    expect(result.content[0].text).toContain("\n");
  });
});

describe("err", () => {
  it("creates error tool result", () => {
    const result = err("Something went wrong");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("Something went wrong");
  });

  it("includes details when provided", () => {
    const result = err("fail", { code: 403 });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("fail");
    expect(parsed.details.code).toBe(403);
  });

  it("omits details when not provided", () => {
    const result = err("fail");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.details).toBeUndefined();
  });
});

describe("tweetUrl", () => {
  it("builds URL with default user", () => {
    expect(tweetUrl("123")).toBe("https://x.com/i/status/123");
  });

  it("builds URL with specific username", () => {
    expect(tweetUrl("123", "alice")).toBe("https://x.com/alice/status/123");
  });
});

describe("parseTweetId", () => {
  it("returns numeric ID as-is", () => {
    expect(parseTweetId("1234567890")).toBe("1234567890");
  });

  it("extracts ID from x.com URL", () => {
    expect(parseTweetId("https://x.com/user/status/98765")).toBe("98765");
  });

  it("extracts ID from twitter.com URL", () => {
    expect(parseTweetId("https://twitter.com/user/status/55555")).toBe("55555");
  });

  it("extracts ID from URL with query params", () => {
    expect(parseTweetId("https://x.com/user/status/11111?s=20")).toBe("11111");
  });

  it("handles ID with whitespace", () => {
    expect(parseTweetId("  42  ")).toBe("42");
  });

  it("returns non-numeric input trimmed", () => {
    expect(parseTweetId("  abc  ")).toBe("abc");
  });
});

describe("normalizeUsername", () => {
  it("strips leading @", () => {
    expect(normalizeUsername("@alice")).toBe("alice");
  });

  it("returns username without @ unchanged", () => {
    expect(normalizeUsername("bob")).toBe("bob");
  });

  it("trims whitespace", () => {
    expect(normalizeUsername("  carol  ")).toBe("carol");
  });

  it("handles @ with whitespace", () => {
    expect(normalizeUsername(" @dave ")).toBe("dave");
  });
});
