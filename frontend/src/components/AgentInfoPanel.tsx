export function AgentInfoPanel() {
  return (
    <aside className="side-panel side-panel-left" aria-label="How this app works">
      <h2 className="side-panel-title">Powered by Databricks Supervisor Agent</h2>
      <div className="side-panel-note">
        <p>
          This app has a simple job: send your question and show the response. It does not
          contain a large codebase of custom logic for every question you might ask.
        </p>
        <p>
          Behind the scenes, a <strong>Databricks Supervisor Agent</strong>, decides which tools and data sources to use, and returns
          an answer — whether you ask about grades, your schedule, campus events, or
          graduation requirements.
        </p>
        <p>
          New question types do not require new app code. The agent handles the reasoning;
          this UI just delivers the conversation.
        </p>
      </div>
    </aside>
  );
}
