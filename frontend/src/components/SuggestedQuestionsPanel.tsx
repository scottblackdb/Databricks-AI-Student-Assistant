interface Props {
  questions: string[];
  disabled: boolean;
  onSelect: (question: string) => void;
}

export function SuggestedQuestionsPanel({ questions, disabled, onSelect }: Props) {
  return (
    <aside className="suggested-questions-panel" aria-label="Suggested questions">
      <h2 className="suggested-questions-title">Suggested questions</h2>
      <ul className="suggested-questions-list">
        {questions.map((question) => (
          <li key={question}>
            <button
              type="button"
              className="suggested-question-button"
              disabled={disabled}
              onClick={() => onSelect(question)}
            >
              {question}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
