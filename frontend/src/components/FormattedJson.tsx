// Renders parsed JSON in a readable layout (port of iOS FormattedJSONView).
import { HIDDEN_JSON_KEYS, formatKeyForDisplay } from "../messageFormatting";
import { StringValue } from "../linkRendering";

function primitive(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null) return "null";
  return String(value);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function KeyValueRow({ name, value }: { name: string; value: unknown }) {
  let body: React.ReactNode;
  if (isObject(value)) {
    body = (
      <div className="json-nested">
        <Dictionary dict={value} />
      </div>
    );
  } else if (Array.isArray(value)) {
    body = (
      <div className="json-nested">
        <JsonArray arr={value} />
      </div>
    );
  } else if (typeof value === "string") {
    body = <StringValue value={value} fieldKey={name} />;
  } else {
    body = <span className="json-value">{primitive(value)}</span>;
  }

  return (
    <div className="json-row">
      <div className="json-key">{formatKeyForDisplay(name)}</div>
      {body}
    </div>
  );
}

function Dictionary({ dict }: { dict: Record<string, unknown> }) {
  const keys = Object.keys(dict)
    .filter((k) => !HIDDEN_JSON_KEYS.has(k))
    .sort();
  return (
    <div className="json-dict">
      {keys.map((k) => (
        <KeyValueRow key={k} name={k} value={dict[k]} />
      ))}
    </div>
  );
}

function JsonArray({ arr }: { arr: unknown[] }) {
  return (
    <div className="json-array">
      {arr.map((item, i) => (
        <div className="json-array-item" key={i}>
          {isObject(item) ? (
            <Dictionary dict={item} />
          ) : Array.isArray(item) ? (
            <JsonArray arr={item} />
          ) : typeof item === "string" ? (
            <StringValue value={item} />
          ) : (
            <span className="json-value">{primitive(item)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function FormattedJson({ value }: { value: unknown }) {
  return (
    <div className="json-box">
      {isObject(value) ? (
        <Dictionary dict={value} />
      ) : Array.isArray(value) ? (
        <JsonArray arr={value} />
      ) : typeof value === "string" ? (
        <StringValue value={value} />
      ) : (
        <span className="json-value">{primitive(value)}</span>
      )}
    </div>
  );
}
