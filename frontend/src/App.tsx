import { useCallback, useEffect, useRef, useState } from "react";
import {
  askQuestion,
  fetchMissingAssignments,
  fetchTodaysSchedule,
  getStudents,
  type ChatMessage,
  type Student,
} from "./api";
import { SCHEDULE_LOADING_TEXT, toAgentTurns } from "./chatTurns";
import { notificationCount } from "./messageFormatting";
import { Header, type PromptItem } from "./components/Header";
import { MessageBubble } from "./components/MessageBubble";
import { SettingsModal } from "./components/SettingsModal";
import {
  MissingAssignmentsModal,
  type MissingAssignmentsState,
} from "./components/MissingAssignmentsModal";

const DEFAULT_PROMPT_ITEMS: PromptItem[] = [
  { label: "Recommend Me Events", prompt: "Based on my interests recommend me upcoming events" },
];

function uid(): string {
  return crypto.randomUUID();
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function resolveStudentId(stored: string | null, students: Student[]): string {
  if (stored && students.some((s) => s.id === stored)) return stored;
  return students[0]?.id ?? "";
}

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(
    () => localStorage.getItem("SelectedStudentID") || "",
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMissingAssignments, setShowMissingAssignments] = useState(false);
  const [missingState, setMissingState] = useState<MissingAssignmentsState>({
    loading: false,
    text: null,
    error: null,
  });

  const chatConversationIdRef = useRef<string | null>(null);
  const missingConversationIdRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const firstName =
    students.find((s) => s.id === selectedStudentId)?.first_name ?? "Eagle";

  const fetchSchedule = useCallback(async (studentId: string, generation: number) => {
    setChatMessages((msgs) => [
      ...msgs,
      { id: uid(), isFromUser: false, text: SCHEDULE_LOADING_TEXT },
    ]);
    try {
      const text = await fetchTodaysSchedule(studentId);
      if (generation !== loadGenerationRef.current) return;
      setChatMessages((msgs) => [
        ...msgs.filter((m) => m.text !== SCHEDULE_LOADING_TEXT),
        { id: uid(), isFromUser: false, text },
      ]);
    } catch (e) {
      if (generation !== loadGenerationRef.current) return;
      const message = e instanceof Error ? e.message : String(e);
      setChatMessages((msgs) => [
        ...msgs.filter((m) => m.text !== SCHEDULE_LOADING_TEXT),
        { id: uid(), isFromUser: false, text: `Couldn't load today's schedule: ${message}` },
      ]);
    }
  }, []);

  const fetchMissing = useCallback(async (studentId: string, generation: number) => {
    setMissingState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetchMissingAssignments(studentId, missingConversationIdRef.current);
      if (generation !== loadGenerationRef.current) return;
      missingConversationIdRef.current = res.conversation_id;
      setMissingState({ loading: false, text: res.text, error: null });
    } catch (e) {
      if (generation !== loadGenerationRef.current) return;
      const message = e instanceof Error ? e.message : String(e);
      setMissingState({ loading: false, text: null, error: message });
    }
  }, []);

  useEffect(() => {
    getStudents()
      .then((list) => {
        setStudents(list);
        setSelectedStudentId((current) => resolveStudentId(current, list));
      })
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoaded(true));
  }, []);

  useEffect(() => {
    if (!studentsLoaded || !selectedStudentId) return;

    localStorage.setItem("SelectedStudentID", selectedStudentId);
    chatConversationIdRef.current = null;
    missingConversationIdRef.current = null;
    setChatMessages([]);
    setQuestionText("");
    setShowMissingAssignments(false);
    setMissingState({ loading: false, text: null, error: null });

    const generation = ++loadGenerationRef.current;
    fetchSchedule(selectedStudentId, generation);
    fetchMissing(selectedStudentId, generation);
  }, [studentsLoaded, selectedStudentId, fetchSchedule, fetchMissing]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages]);

  useEffect(() => {
    const count = missingState.text ? notificationCount(missingState.text) : 0;
    document.title = count > 0 ? `(${Math.min(count, 99)}) myUNT` : "myUNT";
  }, [missingState.text]);

  const sendToAgent = useCallback(
    async (displayLabel: string, prompt: string) => {
      const priorTurns = toAgentTurns(chatMessages);
      const userMessage: ChatMessage = {
        id: uid(),
        isFromUser: true,
        text: displayLabel,
        agentText: displayLabel === prompt ? undefined : prompt,
      };
      setChatMessages((msgs) => [...msgs, userMessage]);
      setIsSending(true);
      try {
        const res = await askQuestion(
          selectedStudentId,
          prompt,
          priorTurns,
          chatConversationIdRef.current,
        );
        chatConversationIdRef.current = res.conversation_id;
        setChatMessages((msgs) => [...msgs, { id: uid(), isFromUser: false, text: res.text }]);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setChatMessages((msgs) => [...msgs, { id: uid(), isFromUser: false, text: `Error: ${message}` }]);
      } finally {
        setIsSending(false);
      }
    },
    [chatMessages, selectedStudentId],
  );

  const handleSend = useCallback(() => {
    const question = questionText.trim();
    if (!question || isSending) return;
    setQuestionText("");
    void sendToAgent(question, question);
  }, [questionText, isSending, sendToAgent]);

  const notifCount = missingState.text ? notificationCount(missingState.text) : 0;

  return (
    <div className="app">
      <Header
        promptItems={DEFAULT_PROMPT_ITEMS}
        notificationCount={notifCount}
        onSelectPrompt={(item) => {
          if (!isSending) void sendToAgent(item.label, item.prompt);
        }}
        onOpenSettings={() => setShowSettings(true)}
        onOpenMissingAssignments={() => setShowMissingAssignments(true)}
      />

      <main className="chat-area">
        <div className="chat-inner">
          <div className="bubble-row assistant">
            <div className="bubble assistant greeting">
              {timeOfDayGreeting()}, {firstName}!
            </div>
          </div>
          {chatMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={chatEndRef} />
        </div>
      </main>

      <footer className="question-bar">
        <textarea
          className="question-input"
          placeholder="Ask a question…"
          value={questionText}
          rows={1}
          disabled={isSending}
          onChange={(e) => setQuestionText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          className="send-button"
          aria-label="Send"
          onClick={handleSend}
          disabled={!questionText.trim() || isSending}
        >
          {isSending ? <span className="spinner" /> : "↑"}
        </button>
      </footer>

      {showSettings && (
        <SettingsModal
          students={students}
          selectedStudentId={selectedStudentId}
          onSelect={setSelectedStudentId}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showMissingAssignments && (
        <MissingAssignmentsModal
          state={missingState}
          onRefresh={() => {
            const generation = loadGenerationRef.current;
            void fetchMissing(selectedStudentId, generation);
          }}
          onClose={() => setShowMissingAssignments(false)}
        />
      )}
    </div>
  );
}
