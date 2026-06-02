// API client for the FastAPI backend. All Databricks calls are proxied server-side.

export interface Student {
  id: string;
  display_name: string;
  first_name: string;
}

export interface ChatMessage {
  id: string;
  isFromUser: boolean;
  text: string;
  /** Prompt sent to the agent when it differs from displayed text (preset menu items). */
  agentText?: string;
}

/** A chat turn as the agent expects it (subset of ChatMessage). */
export interface AgentTurn {
  isFromUser: boolean;
  text: string;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    let detail = `Server error ${resp.status}`;
    try {
      const data = await resp.json();
      if (data?.detail) detail = data.detail;
    } catch {
      // ignore parse failure; keep generic message
    }
    throw new Error(detail);
  }
  return resp.json() as Promise<T>;
}

export async function getStudents(): Promise<Student[]> {
  const resp = await fetch("/api/students");
  if (!resp.ok) throw new Error(`Could not load students (${resp.status})`);
  return resp.json();
}

export async function fetchTodaysSchedule(studentId: string): Promise<string> {
  const data = await postJSON<{ text: string }>("/api/schedule/today", { student_id: studentId });
  return data.text;
}

export async function fetchMissingAssignments(
  studentId: string,
  conversationId: string | null,
): Promise<{ text: string; conversation_id: string }> {
  return postJSON("/api/missing-assignments", {
    student_id: studentId,
    conversation_id: conversationId,
  });
}

export async function askQuestion(
  studentId: string,
  message: string,
  priorTurns: AgentTurn[],
  conversationId: string | null,
): Promise<{ text: string; conversation_id: string }> {
  return postJSON("/api/agent/ask", {
    student_id: studentId,
    message,
    prior_turns: priorTurns.map((t) => ({ isFromUser: t.isFromUser, text: t.text })),
    conversation_id: conversationId,
  });
}
