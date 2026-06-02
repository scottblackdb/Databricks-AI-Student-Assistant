// Renders one chat message as a sequence of segment bubbles (port of iOS segmentBubble).
import type { ChatMessage } from "../api";
import { MessageContent } from "./MessageContent";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const side = message.isFromUser ? "user" : "assistant";

  return (
    <div className="message-group">
      <MessageContent text={message.text} variant="bubble" side={side} />
    </div>
  );
}
