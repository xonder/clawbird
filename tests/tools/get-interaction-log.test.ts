import { describe, it, expect, beforeEach } from "vitest";
import { executeGetInteractionLog } from "../../src/tools/get-interaction-log.js";
import { interactionLog } from "../../src/interaction-log.js";
import { parseToolResult } from "../helpers.js";

describe("executeGetInteractionLog", () => {
  beforeEach(() => {
    interactionLog.clear();
  });

  it("returns empty log when no actions taken", async () => {
    const result = await executeGetInteractionLog({});
    const data = parseToolResult(result);

    expect(data.totalEntries).toBe(0);
    expect(data.returned).toBe(0);
    expect(data.entries).toEqual([]);
    expect(data.logFile).toBeTruthy();
  });

  it("returns all entries", async () => {
    interactionLog.log({ action: "x_post_tweet", summary: "Tweet 1", details: { id: "1" } });
    interactionLog.log({ action: "x_like_tweet", summary: "Liked 2", details: { tweetId: "2" } });

    const result = await executeGetInteractionLog({});
    const data = parseToolResult(result);

    expect(data.totalEntries).toBe(2);
    expect(data.returned).toBe(2);
    expect(data.entries).toHaveLength(2);
    expect(data.entries[0].action).toBe("x_post_tweet");
    expect(data.entries[1].action).toBe("x_like_tweet");
  });

  it("limits returned entries to most recent", async () => {
    interactionLog.log({ action: "x_post_tweet", summary: "1", details: {} });
    interactionLog.log({ action: "x_like_tweet", summary: "2", details: {} });
    interactionLog.log({ action: "x_follow_user", summary: "3", details: {} });

    const result = await executeGetInteractionLog({ limit: 2 });
    const data = parseToolResult(result);

    expect(data.totalEntries).toBe(3);
    expect(data.returned).toBe(2);
    expect(data.entries).toHaveLength(2);
    // Should return the last 2 entries
    expect(data.entries[0].action).toBe("x_like_tweet");
    expect(data.entries[1].action).toBe("x_follow_user");
  });

  it("returns all entries when limit exceeds total", async () => {
    interactionLog.log({ action: "x_post_tweet", summary: "1", details: {} });

    const result = await executeGetInteractionLog({ limit: 100 });
    const data = parseToolResult(result);

    expect(data.totalEntries).toBe(1);
    expect(data.returned).toBe(1);
  });
});
