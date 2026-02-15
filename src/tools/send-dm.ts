import { Type } from "@sinclair/typebox";
import type { Client } from "@xdevplatform/xdk";
import { ok, err, normalizeUsername } from "../types.js";
import { ACTION_COSTS, costTracker } from "../costs.js";
import { parseRateLimitError } from "../rate-limit.js";
import { interactionLog } from "../interaction-log.js";

export const sendDmSchema = Type.Object({
  username: Type.String({
    description:
      "X/Twitter username of the recipient (with or without leading @)",
  }),
  text: Type.String({ description: "The text content of the direct message" }),
});

export async function executeSendDm(
  writeClient: Client,
  readClient: Client,
  params: { username: string; text: string },
) {
  if (!params.text || params.text.trim().length === 0) {
    return err("DM text cannot be empty");
  }

  const username = normalizeUsername(params.username);
  if (!username) {
    return err("Recipient username cannot be empty");
  }

  try {
    // Resolve username to user ID
    const userResponse = await readClient.users.getByUsername(username);
    const recipientId = userResponse?.data?.id;
    if (!recipientId) {
      return err(`User @${username} not found`);
    }

    // Send the DM
    const response = await writeClient.directMessages.createByParticipantId(
      recipientId,
      { body: { text: params.text } },
    );

    const eventId =
      (response?.data as Record<string, unknown>)?.dm_event_id ??
      (response?.data as Record<string, unknown>)?.dmEventId ??
      null;
    const conversationId =
      (response?.data as Record<string, unknown>)?.dm_conversation_id ??
      (response?.data as Record<string, unknown>)?.dmConversationId ??
      null;

    const cost = ACTION_COSTS.dm_send;
    costTracker.track("dm_send", cost);

    interactionLog.log({
      action: "x_send_dm",
      summary: `Sent DM to @${username}: "${params.text.substring(0, 80)}${params.text.length > 80 ? "..." : ""}"`,
      details: { eventId, conversationId, recipientId, recipientUsername: username },
    });

    return ok({
      sent: true,
      eventId,
      conversationId,
      recipient: { id: recipientId, username },
      estimatedCost: `$${cost.toFixed(4)}`,
    });
  } catch (error: unknown) {
    const rateLimitErr = parseRateLimitError(error);
    if (rateLimitErr) return ok(rateLimitErr);
    const message = error instanceof Error ? error.message : String(error);
    return err(`Failed to send DM: ${message}`);
  }
}

export function registerSendDm(
  api: { registerTool: Function },
  getWriteClient: () => Client,
  getReadClient: () => Client,
) {
  api.registerTool({
    name: "x_send_dm",
    description:
      "Send a direct message to a user on X/Twitter by username. Returns confirmation, conversation ID, and estimated API cost.",
    parameters: sendDmSchema,
    execute: async (
      _sessionId: string,
      params: { username: string; text: string },
    ) => {
      try {
        return await executeSendDm(getWriteClient(), getReadClient(), params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
      }
    },
  });
}
