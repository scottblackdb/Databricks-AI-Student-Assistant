import type { PromptItem } from "./Header";

interface Props {
  items: PromptItem[];
  disabled: boolean;
  onSelect: (item: PromptItem) => void;
}

export function SuggestedQuestionsPanel({ items, disabled, onSelect }: Props) {
  return (
    <aside className="side-panel side-panel-right" aria-label="Suggested questions">
      <h2 className="side-panel-title">Suggested questions</h2>
      <ul className="suggested-questions-list">
        {items.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              className="suggested-question-button"
              disabled={disabled}
              onClick={() => onSelect(item)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
