import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InteractionLogger } from "../src/interaction-log.js";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const TEST_LOG_PATH = join(process.cwd(), "test-interactions.jsonl");

describe("InteractionLogger", () => {
  let logger: InteractionLogger;

  beforeEach(() => {
    logger = new InteractionLogger(TEST_LOG_PATH);
    logger.clear();
  });

  afterEach(() => {
    try {
      if (existsSync(TEST_LOG_PATH)) unlinkSync(TEST_LOG_PATH);
    } catch {
      // ignore
    }
  });

  it("starts with empty entries", () => {
    expect(logger.getEntries()).toEqual([]);
  });

  it("logs a single entry", () => {
    logger.log({
      action: "x_post_tweet",
      summary: 'Posted tweet: "Hello"',
      details: { id: "123", text: "Hello" },
    });

    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("x_post_tweet");
    expect(entries[0].summary).toBe('Posted tweet: "Hello"');
    expect(entries[0].details.id).toBe("123");
    expect(entries[0].timestamp).toBeTruthy();
  });

  it("logs multiple entries in order", () => {
    logger.log({ action: "x_post_tweet", summary: "Tweet 1", details: { id: "1" } });
    logger.log({ action: "x_like_tweet", summary: "Liked 2", details: { tweetId: "2" } });
    logger.log({ action: "x_follow_user", summary: "Followed @alice", details: { username: "alice" } });

    const entries = logger.getEntries();
    expect(entries).toHaveLength(3);
    expect(entries[0].action).toBe("x_post_tweet");
    expect(entries[1].action).toBe("x_like_tweet");
    expect(entries[2].action).toBe("x_follow_user");
  });

  it("adds timestamp to each entry", () => {
    const before = new Date().toISOString();
    logger.log({ action: "test", summary: "test", details: {} });
    const after = new Date().toISOString();

    const entries = logger.getEntries();
    expect(entries[0].timestamp >= before).toBe(true);
    expect(entries[0].timestamp <= after).toBe(true);
  });

  it("clears all entries", () => {
    logger.log({ action: "x_post_tweet", summary: "test", details: {} });
    logger.log({ action: "x_like_tweet", summary: "test", details: {} });
    expect(logger.getEntries()).toHaveLength(2);

    logger.clear();
    expect(logger.getEntries()).toEqual([]);
  });

  it("returns correct log path", () => {
    expect(logger.getPath()).toBe(TEST_LOG_PATH);
  });

  it("handles non-existent log file gracefully", () => {
    const nonExistent = new InteractionLogger("/tmp/clawbird-test-nonexistent.jsonl");
    expect(nonExistent.getEntries()).toEqual([]);
  });

  it("persists entries across logger instances", () => {
    logger.log({ action: "x_post_tweet", summary: "test", details: { id: "1" } });

    const logger2 = new InteractionLogger(TEST_LOG_PATH);
    const entries = logger2.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].details.id).toBe("1");
  });
});
