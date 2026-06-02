import type { Components } from "react-markdown";
import { parseEventNameWithDetails } from "./messageFormatting";

const HTTPS = /^https:\/\//i;

export function ExternalLink({
  href,
  children,
  className = "json-link",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a href={href} className={className || undefined} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** Markdown links open externally (event URLs, etc.). */
export const externalLinkMarkdownComponents: Components = {
  a: ({ href, children }) => (
    <ExternalLink href={href ?? "#"} className="">
      {children}
    </ExternalLink>
  ),
};

const URL_FIELD_KEYS = new Set(["url", "link", "event_url", "event_link", "details_url"]);

function isUrlField(key: string | undefined, value: string): boolean {
  return !!key && URL_FIELD_KEYS.has(key.toLowerCase()) && HTTPS.test(value.trim());
}

/** Render a string as an event link, plain https link, or plain text. */
export function StringValue({ value, fieldKey }: { value: string; fieldKey?: string }) {
  const trimmed = value.trim();

  if (isUrlField(fieldKey, value)) {
    return <ExternalLink href={trimmed}>{trimmed}</ExternalLink>;
  }

  const eventLink = parseEventNameWithDetails(value);
  if (eventLink) {
    return <ExternalLink href={eventLink.url}>{eventLink.name}</ExternalLink>;
  }

  if (HTTPS.test(trimmed)) {
    return <ExternalLink href={trimmed}>{trimmed}</ExternalLink>;
  }

  return <span className="json-value">{value}</span>;
}
