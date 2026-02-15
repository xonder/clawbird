import { Type } from "@sinclair/typebox";
import { ok } from "../types.js";
import { interactionLog } from "../interaction-log.js";

export const getInteractionLogSchema = Type.Object({
  limit: Type.Optional(
    Type.Number({
      description: "Maximum number of recent entries to return (default: all)",
      minimum: 1,
    }),
  ),
});

export async function executeGetInteractionLog(params: { limit?: number }) {
  const entries = interactionLog.getEntries();
  const limited = params.limit ? entries.slice(-params.limit) : entries;

  return ok({
    totalEntries: entries.length,
    returned: limited.length,
    logFile: interactionLog.getPath(),
    entries: limited,
  });
}

export function registerGetInteractionLog(
  api: { registerTool: Function },
) {
  api.registerTool({
    name: "x_get_interaction_log",
    description:
      "Get the interaction log of all write actions performed on X/Twitter this session (posts, replies, likes, follows, DMs). Useful to review what has already been done and avoid duplicating actions.",
    parameters: getInteractionLogSchema,
    execute: async (_sessionId: string, params: { limit?: number }) =>
      executeGetInteractionLog(params),
  });
}
