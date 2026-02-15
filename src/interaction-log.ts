import { writeFileSync, appendFileSync, readFileSync, existsSync } from "node:fs";

/**
 * A single interaction log entry — records a mutation performed on the X account.
 */
export interface InteractionEntry {
  /** ISO timestamp of the action */
  timestamp: string;
  /** Tool name that performed the action */
  action: string;
  /** Summary of what was done */
  summary: string;
  /** Key details (tweet IDs, URLs, usernames, etc.) */
  details: Record<string, unknown>;
}

/**
 * Logs all mutation (write) actions to a JSONL file so the agent can
 * keep track of what it has done and avoid duplicating work.
 *
 * Only mutations are logged: posts, replies, threads, likes, follows, DMs.
 * Reads (search, get profile, get mentions, get DMs) are NOT logged.
 */
export class InteractionLogger {
  private logPath: string;

  constructor(logPath: string) {
    this.logPath = logPath;
  }

  /**
   * Append a mutation entry to the log file.
   */
  log(entry: Omit<InteractionEntry, "timestamp">): void {
    const full: InteractionEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };
    try {
      appendFileSync(this.logPath, JSON.stringify(full) + "\n", "utf-8");
    } catch {
      // Silently ignore write errors — logging should never break tool execution
    }
  }

  /**
   * Read all entries from the log file.
   */
  getEntries(): InteractionEntry[] {
    try {
      if (!existsSync(this.logPath)) return [];
      const content = readFileSync(this.logPath, "utf-8").trim();
      if (!content) return [];
      return content
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as InteractionEntry);
    } catch {
      return [];
    }
  }

  /**
   * Get the log file path.
   */
  getPath(): string {
    return this.logPath;
  }

  /**
   * Clear the log file.
   */
  clear(): void {
    try {
      writeFileSync(this.logPath, "", "utf-8");
    } catch {
      // Silently ignore
    }
  }
}

/**
 * Default log file path — in the current working directory.
 */
const DEFAULT_LOG_PATH = "clawbird-interactions.jsonl";

/** Singleton interaction logger for the plugin session. */
export const interactionLog = new InteractionLogger(DEFAULT_LOG_PATH);
