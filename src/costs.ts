/**
 * Per-action cost estimates for X API v2 (pay-per-usage credits).
 * Values in USD.
 */
export const ACTION_COSTS = {
  post: 0.01,
  search_per_result: 0.005,
  like: 0.005,
  user_lookup: 0.001,
  mention_per_result: 0.005,
} as const;

export type ActionType = keyof typeof ACTION_COSTS;

interface CostEntry {
  calls: number;
  totalCost: number;
}

/**
 * In-memory cost tracker for a plugin session.
 */
export class CostTracker {
  private entries: Map<string, CostEntry> = new Map();

  /**
   * Record a cost for an action.
   * @param action - The action type (e.g., "post", "like")
   * @param cost - The cost in USD for this invocation
   */
  track(action: string, cost: number): void {
    const existing = this.entries.get(action) ?? { calls: 0, totalCost: 0 };
    existing.calls += 1;
    existing.totalCost += cost;
    this.entries.set(action, existing);
  }

  /**
   * Get the total cost across all actions.
   */
  get totalCost(): number {
    let sum = 0;
    for (const entry of this.entries.values()) {
      sum += entry.totalCost;
    }
    return Math.round(sum * 10000) / 10000; // avoid floating point noise
  }

  /**
   * Get a summary of all tracked costs.
   */
  getSummary(): {
    totalCost: number;
    breakdown: Record<string, { calls: number; totalCost: number }>;
  } {
    const breakdown: Record<string, { calls: number; totalCost: number }> = {};
    for (const [action, entry] of this.entries) {
      breakdown[action] = {
        calls: entry.calls,
        totalCost: Math.round(entry.totalCost * 10000) / 10000,
      };
    }
    return { totalCost: this.totalCost, breakdown };
  }

  /**
   * Reset all tracked costs.
   */
  reset(): void {
    this.entries.clear();
  }
}

/** Singleton cost tracker for the plugin session. */
export const costTracker = new CostTracker();
