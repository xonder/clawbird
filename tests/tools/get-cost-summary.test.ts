import { describe, it, expect, beforeEach } from "vitest";
import { executeGetCostSummary } from "../../src/tools/get-cost-summary.js";
import { costTracker, ACTION_COSTS } from "../../src/costs.js";
import { parseToolResult } from "../helpers.js";

describe("executeGetCostSummary", () => {
  beforeEach(() => {
    costTracker.reset();
  });

  it("returns zero cost when no actions tracked", async () => {
    const result = await executeGetCostSummary();
    const data = parseToolResult(result);

    expect(data.totalCost).toBe("$0.0000");
    expect(data.breakdown).toEqual({});
  });

  it("returns correct totals after tracking actions", async () => {
    costTracker.track("post", ACTION_COSTS.post);
    costTracker.track("post", ACTION_COSTS.post);
    costTracker.track("like", ACTION_COSTS.like);
    costTracker.track("search", ACTION_COSTS.search_per_result * 5);

    const result = await executeGetCostSummary();
    const data = parseToolResult(result);

    // 0.01 + 0.01 + 0.005 + 0.025 = 0.05
    expect(data.totalCost).toBe("$0.0500");
    expect(data.breakdown.post.calls).toBe(2);
    expect(data.breakdown.post.totalCost).toBe("$0.0200");
    expect(data.breakdown.like.calls).toBe(1);
    expect(data.breakdown.like.totalCost).toBe("$0.0050");
    expect(data.breakdown.search.calls).toBe(1);
    expect(data.breakdown.search.totalCost).toBe("$0.0250");
  });

  it("formats costs as dollar strings", async () => {
    costTracker.track("user_lookup", ACTION_COSTS.user_lookup);

    const result = await executeGetCostSummary();
    const data = parseToolResult(result);

    expect(data.totalCost).toMatch(/^\$\d+\.\d{4}$/);
    expect(data.breakdown.user_lookup.totalCost).toMatch(/^\$\d+\.\d{4}$/);
  });

  it("reflects ongoing session accumulation", async () => {
    costTracker.track("post", ACTION_COSTS.post);

    const result1 = await executeGetCostSummary();
    const data1 = parseToolResult(result1);
    expect(data1.totalCost).toBe("$0.0100");

    costTracker.track("post", ACTION_COSTS.post);

    const result2 = await executeGetCostSummary();
    const data2 = parseToolResult(result2);
    expect(data2.totalCost).toBe("$0.0200");
    expect(data2.breakdown.post.calls).toBe(2);
  });
});
