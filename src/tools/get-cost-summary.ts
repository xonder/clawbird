import { Type } from "@sinclair/typebox";
import { ok } from "../types.js";
import { costTracker } from "../costs.js";

export const getCostSummarySchema = Type.Object({});

export async function executeGetCostSummary() {
  const summary = costTracker.getSummary();

  return ok({
    totalCost: `$${summary.totalCost.toFixed(4)}`,
    breakdown: Object.fromEntries(
      Object.entries(summary.breakdown).map(([action, entry]) => [
        action,
        {
          calls: entry.calls,
          totalCost: `$${entry.totalCost.toFixed(4)}`,
        },
      ]),
    ),
  });
}

export function registerGetCostSummary(
  api: { registerTool: Function },
) {
  api.registerTool({
    name: "x_get_cost_summary",
    description:
      "Get a summary of estimated X/Twitter API costs for this session. Shows total cost and per-action breakdown (posts, searches, likes, etc.).",
    parameters: getCostSummarySchema,
    execute: async () => executeGetCostSummary(),
  });
}
