import { describe, it, expect, beforeEach } from "vitest";
import { CostTracker, ACTION_COSTS } from "../src/costs.js";

describe("CostTracker", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it("starts with zero total cost", () => {
    expect(tracker.totalCost).toBe(0);
  });

  it("tracks a single action cost", () => {
    tracker.track("post", ACTION_COSTS.post);
    expect(tracker.totalCost).toBe(0.01);
  });

  it("tracks multiple actions of the same type", () => {
    tracker.track("post", ACTION_COSTS.post);
    tracker.track("post", ACTION_COSTS.post);
    tracker.track("post", ACTION_COSTS.post);
    expect(tracker.totalCost).toBe(0.03);
  });

  it("tracks multiple action types", () => {
    tracker.track("post", ACTION_COSTS.post);
    tracker.track("like", ACTION_COSTS.like);
    tracker.track("search", ACTION_COSTS.search_per_result * 5);
    tracker.track("user_lookup", ACTION_COSTS.user_lookup);

    // 0.01 + 0.005 + 0.025 + 0.001 = 0.041
    expect(tracker.totalCost).toBe(0.041);
  });

  it("returns a summary with breakdown", () => {
    tracker.track("post", ACTION_COSTS.post);
    tracker.track("post", ACTION_COSTS.post);
    tracker.track("like", ACTION_COSTS.like);

    const summary = tracker.getSummary();
    expect(summary.totalCost).toBe(0.025);
    expect(summary.breakdown.post).toEqual({ calls: 2, totalCost: 0.02 });
    expect(summary.breakdown.like).toEqual({ calls: 1, totalCost: 0.005 });
  });

  it("returns empty breakdown when no costs tracked", () => {
    const summary = tracker.getSummary();
    expect(summary.totalCost).toBe(0);
    expect(summary.breakdown).toEqual({});
  });

  it("resets all tracked costs", () => {
    tracker.track("post", ACTION_COSTS.post);
    tracker.track("like", ACTION_COSTS.like);
    tracker.reset();

    expect(tracker.totalCost).toBe(0);
    expect(tracker.getSummary().breakdown).toEqual({});
  });

  it("avoids floating point noise", () => {
    // Track many small costs that could cause floating point issues
    for (let i = 0; i < 100; i++) {
      tracker.track("search", ACTION_COSTS.search_per_result);
    }
    // 100 * 0.005 = 0.5 exactly
    expect(tracker.totalCost).toBe(0.5);
  });
});

describe("ACTION_COSTS constants", () => {
  it("has expected cost values", () => {
    expect(ACTION_COSTS.post).toBe(0.01);
    expect(ACTION_COSTS.search_per_result).toBe(0.005);
    expect(ACTION_COSTS.like).toBe(0.005);
    expect(ACTION_COSTS.user_lookup).toBe(0.001);
    expect(ACTION_COSTS.mention_per_result).toBe(0.005);
  });
});
