import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, normalizeUsername } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";
import { parseRawResponse, formatRateLimit, parseRateLimitError } from "../rate-limit.js";

export const getDmsSchema = Type.Object({
  username: Type.Optional(
    Type.String({
      description:
        "X/Twitter username to get DM history with (optional — omit to get all recent DMs)",
    }),
  ),
  maxResults: Type.Optional(
    Type.Number({
      description: "Maximum number of DM events to retrieve (1-100, default 10)",
      minimum: 1,
      maximum: 100,
    }),
  ),
});

export async function executeGetDms(
  readClient: Client,
  params: { username?: string; maxResults?: number },
) {
  const maxResults = params.maxResults ?? 10;

  try {
    let rawResponse: Response;

    if (params.username) {
      const username = normalizeUsername(params.username);
      if (!username) {
        return err("Username cannot be empty");
      }

      // Resolve username to user ID
      const userResponse = await readClient.users.getByUsername(username);
      const userId = userResponse?.data?.id;
      if (!userId) {
        return err(`User @${username} not found`);
      }

      rawResponse = await readClient.directMessages.getEventsByParticipantId(
        userId,
        {
          maxResults,
          dmEventFields: ["created_at", "sender_id", "dm_conversation_id", "text"],
          eventTypes: ["MessageCreate"],
          requestOptions: { raw: true },
        },
      ) as unknown as Response;
    } else {
      rawResponse = await readClient.directMessages.getEvents({
        maxResults,
        dmEventFields: ["created_at", "sender_id", "dm_conversation_id", "text"],
        eventTypes: ["MessageCreate"],
        requestOptions: { raw: true },
      }) as unknown as Response;
    }

    const { data: response, rateLimit } = await parseRawResponse<Record<string, unknown>>(rawResponse);

    const eventsData = (response?.data ?? []) as Array<Record<string, unknown>>;
    const messages = eventsData.map((event) => ({
      id: event.id,
      text: event.text,
      senderId: event.sender_id,
      createdAt: event.created_at,
      conversationId: event.dm_conversation_id,
      eventType: event.event_type,
    }));

    const resultCount = messages.length;
    const cost = ACTION_COSTS.dm_read_per_result * resultCount;
    costTracker.track("dm_read", cost);

    return ok({
      resultCount,
      messages,
      ...(params.username ? { withUser: normalizeUsername(params.username) } : {}),
      rateLimit: formatRateLimit(rateLimit),
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const rateLimitErr = parseRateLimitError(error);
    if (rateLimitErr) return ok(rateLimitErr);
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to get DMs: ${message}`);
  }
}

export function registerGetDms(
  api: { registerTool: Function },
  getReadClient: () => Client,
) {
  api.registerTool({
    name: "x_get_dms",
    description:
      "Get recent direct messages on X/Twitter. Optionally filter by username to get DM history with a specific user. Returns message events with metadata and estimated API cost.",
    parameters: getDmsSchema,
    execute: async (
      _sessionId: string,
      params: { username?: string; maxResults?: number },
    ) => {
      try {
        return await executeGetDms(getReadClient(), params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
      }
    },
  });
}
