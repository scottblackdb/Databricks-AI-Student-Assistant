// Renders message text split into markdown and formatted JSON segments.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseMessageSegments } from "../messageFormatting";
import { FormattedJson } from "./FormattedJson";

interface Props {
  text: string;
  /** Wrap each segment in bubble styling (chat) vs plain blocks (modal). */
  variant?: "bubble" | "plain";
  side?: "user" | "assistant";
}

export function MessageContent({ text, variant = "plain", side = "assistant" }: Props) {
  const segments = parseMessageSegments(text);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          if (!seg.value.trim()) return null;
          if (variant === "bubble") {
            return (
              <div className={`bubble-row ${side}`} key={i}>
                <div className={`bubble ${side}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.value}</ReactMarkdown>
                </div>
              </div>
            );
          }
          return (
            <div className="ma-text-block" key={i}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.value}</ReactMarkdown>
            </div>
          );
        }

        if (variant === "bubble") {
          return (
            <div className={`bubble-row ${side}`} key={i}>
              <div className={`bubble ${side} bubble-json`}>
                <FormattedJson value={seg.value} />
              </div>
            </div>
          );
        }
        return <FormattedJson value={seg.value} key={i} />;
      })}
    </>
  );
}
