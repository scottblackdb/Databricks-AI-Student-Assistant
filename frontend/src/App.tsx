import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { errorMessage, newMessageId } from "./utils";
import { AgentInfoPanel } from "./components/AgentInfoPanel";
import { Header, type PromptItem } from "./components/Header";
import { MessageBubble } from "./components/MessageBubble";
import { SettingsModal } from "./components/SettingsModal";
import { SuggestedQuestionsPanel } from "./components/SuggestedQuestionsPanel";
import {
  MissingAssignmentsModal,
  type MissingAssignmentsState,
} from "./components/MissingAssignmentsModal";

const MENU_PROMPTS: PromptItem[] = [
  { label: "Recommend Me Events", prompt: "Based on my interests recommend me upcoming events" },
];

const SUGGESTED_QUESTIONS: PromptItem[] = [
  { label: "What are my grades?", prompt: "What are my grades?" },
  { label: "What sporting events are coming up?", prompt: "What sporting events are coming up?" },
  { label: "What community events are coming up?", prompt: "What community events are coming up?" },
  {
    label: "What classes do I need to take to graduate?",
    prompt: "What classes do I need to take to graduate?",
  },
  {
    label: "Suggest what classes and when the classes are taught for next semester",
    prompt: "Suggest what classes and when the classes are taught for next semester",
  },
];

const EMPTY_MISSING_STATE: MissingAssignmentsState = {
  loading: false,
  text: null,
  error: null,
};

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

function isStaleGeneration(generation: number, current: number): boolean {
  return generation !== current;
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
  const [missingState, setMissingState] = useState<MissingAssignmentsState>(EMPTY_MISSING_STATE);

  const chatConversationIdRef = useRef<string | null>(null);
  const missingConversationIdRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const firstName =
    students.find((s) => s.id === selectedStudentId)?.first_name ?? "Eagle";

  const notifCount = useMemo(
    () => (missingState.text ? notificationCount(missingState.text) : 0),
    [missingState.text],
  );

  const fetchSchedule = useCallback(async (studentId: string, generation: number) => {
    setChatMessages((msgs) => [
      ...msgs,
      { id: newMessageId(), isFromUser: false, text: SCHEDULE_LOADING_TEXT },
    ]);
    try {
      const text = await fetchTodaysSchedule(studentId);
      if (isStaleGeneration(generation, loadGenerationRef.current)) return;
      setChatMessages((msgs) => [
        ...msgs.filter((m) => m.text !== SCHEDULE_LOADING_TEXT),
        { id: newMessageId(), isFromUser: false, text },
      ]);
    } catch (e) {
      if (isStaleGeneration(generation, loadGenerationRef.current)) return;
      setChatMessages((msgs) => [
        ...msgs.filter((m) => m.text !== SCHEDULE_LOADING_TEXT),
        {
          id: newMessageId(),
          isFromUser: false,
          text: `Couldn't load today's schedule: ${errorMessage(e)}`,
        },
      ]);
    }
  }, []);

  const fetchMissing = useCallback(async (studentId: string, generation: number) => {
    setMissingState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetchMissingAssignments(studentId, missingConversationIdRef.current);
      if (isStaleGeneration(generation, loadGenerationRef.current)) return;
      missingConversationIdRef.current = res.conversation_id;
      setMissingState({ loading: false, text: res.text, error: null });
    } catch (e) {
      if (isStaleGeneration(generation, loadGenerationRef.current)) return;
      setMissingState({ loading: false, text: null, error: errorMessage(e) });
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
    setMissingState(EMPTY_MISSING_STATE);

    const generation = ++loadGenerationRef.current;
    fetchSchedule(selectedStudentId, generation);
    fetchMissing(selectedStudentId, generation);
  }, [studentsLoaded, selectedStudentId, fetchSchedule, fetchMissing]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages]);

  useEffect(() => {
    document.title = notifCount > 0 ? `(${Math.min(notifCount, 99)}) myUNT` : "myUNT";
  }, [notifCount]);

  const sendToAgent = useCallback(
    async (displayLabel: string, prompt: string) => {
      const priorTurns = toAgentTurns(chatMessages);
      const userMessage: ChatMessage = {
        id: newMessageId(),
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
        setChatMessages((msgs) => [
          ...msgs,
          { id: newMessageId(), isFromUser: false, text: res.text },
        ]);
      } catch (e) {
        setChatMessages((msgs) => [
          ...msgs,
          { id: newMessageId(), isFromUser: false, text: `Error: ${errorMessage(e)}` },
        ]);
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

  const handleSelectPrompt = useCallback(
    (item: PromptItem) => {
      if (!isSending) void sendToAgent(item.label, item.prompt);
    },
    [isSending, sendToAgent],
  );

  return (
    <div className="app-shell">
      <div className="app-container">
        <AgentInfoPanel />

        <div className="app">
          <Header
            promptItems={MENU_PROMPTS}
            notificationCount={notifCount}
            onSelectPrompt={handleSelectPrompt}
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
              onRefresh={() => void fetchMissing(selectedStudentId, loadGenerationRef.current)}
              onClose={() => setShowMissingAssignments(false)}
            />
          )}
        </div>

        <SuggestedQuestionsPanel
          items={SUGGESTED_QUESTIONS}
          disabled={isSending}
          onSelect={handleSelectPrompt}
        />
      </div>
    </div>
  );
}
