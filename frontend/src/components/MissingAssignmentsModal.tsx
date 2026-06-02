// Sheet shown when tapping the bell (port of iOS MissingAssignmentsView).
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseMessageSegments } from "../messageFormatting";
import { FormattedJson } from "./FormattedJson";

export interface MissingAssignmentsState {
  loading: boolean;
  text: string | null;
  error: string | null;
}

interface Props {
  state: MissingAssignmentsState;
  onRefresh: () => void;
  onClose: () => void;
}

export function MissingAssignmentsModal({ state, onRefresh, onClose }: Props) {
  const { loading, text, error } = state;

  let content: React.ReactNode;
  if (loading && text === null && !error) {
    content = (
      <div className="ma-loading">
        <div className="spinner large" />
        <div className="ma-loading-icon">🧠</div>
        <div className="ma-loading-title">Checking missing assignments…</div>
        <div className="ma-loading-sub">Waiting for response…</div>
      </div>
    );
  } else if (error) {
    content = (
      <div className="ma-error">
        <div className="ma-error-title">⚠️ Error</div>
        <div className="ma-error-message">{error}</div>
        <button className="primary-button" onClick={onRefresh}>
          Try Again
        </button>
      </div>
    );
  } else if (text !== null) {
    const segments = parseMessageSegments(text);
    content = (
      <div className="ma-result">
        {segments.map((seg, i) =>
          seg.kind === "text" ? (
            seg.value.trim() ? (
              <div className="ma-text-block" key={i}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.value}</ReactMarkdown>
              </div>
            ) : null
          ) : (
            <FormattedJson value={seg.value} key={i} />
          ),
        )}
      </div>
    );
  } else {
    content = <div className="ma-empty">No cached data. Tap Refresh to load missing assignments.</div>;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <button className="text-button" onClick={onClose}>
            Done
          </button>
          <h2>Missing Assignments</h2>
          <button className="text-button" onClick={onRefresh} disabled={loading}>
            Refresh
          </button>
        </div>
        <div className="modal-body scroll">{content}</div>
      </div>
    </div>
  );
}
