// Helpers for deciding which chat messages are sent to the agent as prior turns.
import type { ChatMessage } from "./api";

export const SCHEDULE_LOADING_TEXT = "Retrieving your schedule for today…";
export const SCHEDULE_HEADER = "**Today's Classes**";
export const NO_CLASSES_TEXT = "No Classes Today";
export const SCHEDULE_ERROR_PREFIX = "Couldn't load today's schedule:";

/** True for user/agent Q&A turns; excludes schedule system messages. */
export function isAgentTurn(message: ChatMessage): boolean {
  if (message.isFromUser) return true;
  const { text } = message;
  if (text === SCHEDULE_LOADING_TEXT) return false;
  if (text.startsWith(SCHEDULE_HEADER)) return false;
  if (text === NO_CLASSES_TEXT) return false;
  if (text.startsWith(SCHEDULE_ERROR_PREFIX)) return false;
  return true;
}

/** Map chat messages to agent prior turns, using agentText for preset prompts. */
export function toAgentTurns(messages: ChatMessage[]) {
  return messages.filter(isAgentTurn).map((m) => ({
    isFromUser: m.isFromUser,
    text: m.isFromUser ? (m.agentText ?? m.text) : m.text,
  }));
}
