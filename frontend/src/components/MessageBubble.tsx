// Renders one chat message as a sequence of segment bubbles (port of iOS segmentBubble).
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../api";
import { parseMessageSegments } from "../messageFormatting";
import { FormattedJson } from "./FormattedJson";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const segments = parseMessageSegments(message.text);
  const side = message.isFromUser ? "user" : "assistant";

  return (
    <div className="message-group">
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          if (!seg.value.trim()) return null;
          return (
            <div className={`bubble-row ${side}`} key={i}>
              <div className={`bubble ${side}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.value}</ReactMarkdown>
              </div>
            </div>
          );
        }
        return (
          <div className={`bubble-row ${side}`} key={i}>
            <div className={`bubble ${side} bubble-json`}>
              <FormattedJson value={seg.value} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
