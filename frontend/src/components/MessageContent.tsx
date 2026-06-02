// Renders message text split into markdown and formatted JSON segments.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { externalLinkMarkdownComponents } from "../linkRendering";
import { parseMessageSegments } from "../messageFormatting";
import { FormattedJson } from "./FormattedJson";

const remarkPlugins = [remarkGfm];

interface Props {
  text: string;
  /** Wrap each segment in bubble styling (chat) vs plain blocks (modal). */
  variant?: "bubble" | "plain";
  side?: "user" | "assistant";
}

function TextSegment({
  value,
  variant,
  side,
}: {
  value: string;
  variant: "bubble" | "plain";
  side: "user" | "assistant";
}) {
  const markdown = (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={externalLinkMarkdownComponents}>
      {value}
    </ReactMarkdown>
  );

  if (variant === "bubble") {
    return (
      <div className={`bubble-row ${side}`}>
        <div className={`bubble ${side}`}>{markdown}</div>
      </div>
    );
  }

  return <div className="ma-text-block">{markdown}</div>;
}

function JsonSegment({
  value,
  variant,
  side,
}: {
  value: unknown;
  variant: "bubble" | "plain";
  side: "user" | "assistant";
}) {
  if (variant === "bubble") {
    return (
      <div className={`bubble-row ${side}`}>
        <div className={`bubble ${side} bubble-json`}>
          <FormattedJson value={value} />
        </div>
      </div>
    );
  }

  return <FormattedJson value={value} />;
}

export function MessageContent({ text, variant = "plain", side = "assistant" }: Props) {
  const segments = parseMessageSegments(text);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          if (!seg.value.trim()) return null;
          return <TextSegment key={i} value={seg.value} variant={variant} side={side} />;
        }
        return <JsonSegment key={i} value={seg.value} variant={variant} side={side} />;
      })}
    </>
  );
}
