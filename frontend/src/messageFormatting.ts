// Port of the iOS MessageFormatting: split message text on ```json ... ``` fences
// into text and parsed-JSON segments.

export type MessageSegment =
  | { kind: "text"; value: string }
  | { kind: "json"; value: unknown };

export function parseMessageSegments(raw: string): MessageSegment[] {
  const marker = "```json";
  const close = "```";
  const segments: MessageSegment[] = [];
  let remaining = raw;

  while (true) {
    const start = remaining.toLowerCase().indexOf(marker);
    if (start === -1) break;

    const before = remaining.slice(0, start);
    if (before) segments.push({ kind: "text", value: before });

    remaining = remaining.slice(start + marker.length);
    const end = remaining.indexOf(close);
    if (end === -1) {
      segments.push({ kind: "text", value: marker + remaining });
      return segments;
    }

    const jsonString = remaining.slice(0, end).trim();
    remaining = remaining.slice(end + close.length);
    try {
      segments.push({ kind: "json", value: JSON.parse(jsonString) });
    } catch {
      segments.push({ kind: "text", value: `${marker}\n${jsonString}\n${close}` });
    }
  }

  if (remaining) segments.push({ kind: "text", value: remaining });
  return segments.length ? segments : [{ kind: "text", value: raw }];
}

/** Keys hidden from JSON display (matches iOS FormattedJSONView.hiddenKeys). */
export const HIDDEN_JSON_KEYS = new Set(["assignment_id", "event_details"]);

/** "event_name" -> "Event Name" (matches iOS formatKeyForDisplay). */
export function formatKeyForDisplay(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * If a string contains " [EventDetails] (https://...)" or " (https://...)", returns
 * { name, url } for use as a link (matches iOS parseEventNameWithDetails); else null.
 */
export function parseEventNameWithDetails(s: string): { name: string; url: string } | null {
  const markers = [" [EventDetails] (", " (https"];
  for (const marker of markers) {
    const idx = s.indexOf(marker);
    if (idx === -1) continue;
    const name = s.slice(0, idx).trim();
    let after = s.slice(idx + marker.length);
    if (marker === " [EventDetails] (") {
      const endParen = after.indexOf(")");
      if (endParen === -1) continue;
      after = after.slice(0, endParen);
    } else {
      const endParen = after.indexOf(")");
      if (endParen === -1) continue;
      after = "https" + after.slice(0, endParen);
    }
    const url = after.trim();
    if (url.toLowerCase().startsWith("https://")) return { name, url };
  }
  return null;
}

/** Number of missing-assignment notifications: counts JSON array elements (matches iOS notificationCount). */
export function notificationCount(text: string): number {
  if (!text) return 0;
  let count = 0;
  for (const seg of parseMessageSegments(text)) {
    if (seg.kind === "json") {
      count += Array.isArray(seg.value) ? seg.value.length : 1;
    }
  }
  return Math.min(count, 99);
}
