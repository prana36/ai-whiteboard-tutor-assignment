"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  GraduationCap,
  HelpCircle,
  Layers3,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Whiteboard } from "./whiteboard";
import { usePlayer } from "@/hooks/use-player";
import { formatTime, lessonSchema, type ChatMessage, type Lesson } from "@/lib/lesson";
import { sampleLesson } from "@/lib/sample";
import { downloadFile, post } from "@/lib/client";

const TOPICS = [
  {
    icon: "∿",
    title: "How neural networks learn",
    area: "Artificial intelligence",
    color: "purple",
  },
  { icon: "☀", title: "How photosynthesis works", area: "Science & nature", color: "green" },
  { icon: "ƒ", title: "Derivatives, made simple", area: "Mathematics", color: "orange" },
];

function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? "small" : ""}`} aria-hidden="true">
      ✳
    </span>
  );
}

function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-label={title}
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="modal-title">
        <h2>{title}</h2>
        <button className="icon-button" onClick={close} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Tutor() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [history, setHistory] = useState<Lesson[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [accessRequired, setAccessRequired] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [modal, setModal] = useState<"settings" | "help" | null>(null);
  const [view, setView] = useState<"workspace" | "library">("workspace");
  const [boardTab, setBoardTab] = useState<"board" | "transcript">("board");
  const [mobileTab, setMobileTab] = useState<"chat" | "board">("chat");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const player = usePlayer(lesson);

  useEffect(() => {
    void fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        setConfigured(data.configured);
        setAccessRequired(data.accessCodeRequired);
      })
      .catch(() => setConfigured(false));
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("lumio-lessons") || "[]");
      if (Array.isArray(stored))
        setHistory(
          stored.slice(0, 12).flatMap((value) => {
            const result = lessonSchema.safeParse(value);
            return result.success ? [result.data] : [];
          }),
        );
      setAccessCode(sessionStorage.getItem("lumio-access-code") || "");
    } catch {
      /* A blocked or full storage area must not prevent learning. */
    }
    return () => request.current?.abort();
  }, []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, asking, loading]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timeout);
  }, [notice]);

  function saveLesson(next: Lesson) {
    setHistory((previous) => {
      const list = [next, ...previous.filter((item) => item.id !== next.id)].slice(0, 12);
      try {
        localStorage.setItem("lumio-lessons", JSON.stringify(list));
      } catch {
        setNotice("Lesson opened. Browser storage is full or unavailable, so it won't be saved.");
      }
      return list;
    });
  }

  function openLesson(next: Lesson) {
    request.current?.abort();
    setLoading(false);
    setAsking(false);
    setLesson(next);
    setMessages([]);
    setInput("");
    setError("");
    setQuizAnswer(null);
    setQuizOpen(false);
    setBoardTab("board");
    setView("workspace");
    setMobileTab("board");
  }

  function newLesson() {
    request.current?.abort();
    setLoading(false);
    setAsking(false);
    setLesson(null);
    setMessages([]);
    setInput("");
    setError("");
    setView("workspace");
    setMobileTab("chat");
    setQuizOpen(false);
    setQuizAnswer(null);
    setTimeout(() => composer.current?.focus(), 50);
  }

  async function generate(topic: string) {
    if (loading || asking) return;
    if (topic.trim().length < 3) {
      setError("Tell me a little more — enter a topic with at least 3 characters.");
      return;
    }
    player.pause();
    setError("");
    setLoading(true);
    setView("workspace");
    const abort = new AbortController();
    request.current = abort;
    try {
      const next = lessonSchema.parse(
        await post<Lesson>("/api/lesson", { topic: topic.trim() }, abort.signal),
      );
      if (abort.signal.aborted) return;
      openLesson(next);
      saveLesson(next);
    } catch (error) {
      if (!abort.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Couldn't create your lesson. Try again.",
        );
    } finally {
      if (request.current === abort) setLoading(false);
    }
  }

  async function ask(question: string) {
    if (!lesson || asking || loading) return;
    if (question.trim().length < 2) {
      setError("Please enter a question with at least 2 characters.");
      return;
    }
    player.pause();
    setError("");
    setAsking(true);
    const abort = new AbortController();
    request.current = abort;
    const previous = messages;
    setMessages([...messages, { role: "user", content: question.trim() }]);
    setInput("");
    try {
      const context = `${lesson.title}\n${lesson.summary}\n${lesson.scenes.map((scene, i) => `${i + 1}. ${scene.title}: ${scene.narration}`).join("\n")}\nCurrently viewing scene ${player.index + 1}: ${player.scene?.title}`;
      const data = await post<{ answer: string }>(
        "/api/chat",
        { question: question.trim(), context, messages: previous.slice(-12) },
        abort.signal,
      );
      if (!abort.signal.aborted)
        setMessages((messages) => [...messages, { role: "assistant", content: data.answer }]);
    } catch (error) {
      if (!abort.signal.aborted) {
        setError(error instanceof Error ? error.message : "Couldn't answer your question.");
        setMessages(previous);
        setInput(question);
      }
    } finally {
      if (request.current === abort) setAsking(false);
    }
  }

  function submit() {
    if (lesson) void ask(input);
    else void generate(input);
  }
  function focusQuestion(question: string) {
    player.pause();
    setInput(question);
    setMobileTab("chat");
    composer.current?.focus();
  }
  const currentScene = player.scene || sampleLesson.scenes[2];
  const isFinished = lesson && player.position >= player.total - 0.1;
  const pending = loading || asking;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={newLesson} aria-label="Lumio home">
          <Mark />
          <span>
            lumio<span className="brand-dot">.</span>
          </span>
        </button>
        <p className="brand-caption">A little light. A lot of learning.</p>
        <button className="new-lesson" onClick={newLesson}>
          <Plus size={18} /> New lesson <span>↗</span>
        </button>
        <div className="nav-label">YOUR SPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={`nav-item ${view === "workspace" ? "active" : ""}`}
            onClick={() => setView("workspace")}
          >
            <Layers3 size={18} /> Learning studio <span className="nav-active-dot" />
          </button>
          <button
            className={`nav-item ${view === "library" ? "active" : ""}`}
            onClick={() => setView("library")}
          >
            <BookOpen size={18} /> My lessons <span className="count-badge">{history.length}</span>
          </button>
        </nav>
        <div className="recent-heading">
          <span className="nav-label">RECENT LESSONS</span>
          <Clock3 size={13} />
        </div>
        <div className="recent-list">
          {history.length ? (
            history.slice(0, 5).map((item) => (
              <button
                key={item.id}
                onClick={() => openLesson(item)}
                className={`recent-item ${lesson?.id === item.id ? "current" : ""}`}
              >
                <MessageCircle size={14} />
                <span>{item.title}</span>
              </button>
            ))
          ) : (
            <p className="empty-history">
              Your next discovery will
              <br />
              find a home here.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="curiosity-card">
            <span className="curiosity-spark">✧</span>
            <strong>Stay curious.</strong>
            <p>
              Big ideas start with
              <br />
              small questions.
            </p>
            <span className="card-doodle">✺</span>
          </div>
          <button className="nav-item" onClick={() => setModal("help")}>
            <HelpCircle size={18} /> How it works <ArrowRight size={14} />
          </button>
          <button className="profile" onClick={() => setModal("settings")}>
            <span className="avatar">P</span>
            <span>
              <strong>Personal workspace</strong>
              <small>Your space to understand</small>
            </span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button className="mobile-brand" onClick={newLesson} aria-label="Start a new lesson">
            ✳ <span>lumio.</span>
          </button>
          <div className="breadcrumb">
            <GraduationCap size={18} />
            <span>Your workspace</span>
            <ChevronRight size={14} />
            <strong>{view === "library" ? "My lessons" : "Learning studio"}</strong>
          </div>
          <div className="topbar-right">
            <span className="private-label">
              <span /> Made for your curious mind
            </span>
            <button
              className="icon-button mobile-nav-button"
              onClick={() => setView("library")}
              title="My lessons"
              aria-label="Open saved lessons"
            >
              <BookOpen size={19} />
            </button>
            <button
              className="icon-button mobile-nav-button"
              onClick={newLesson}
              title="New lesson"
              aria-label="New lesson"
            >
              <Plus size={19} />
            </button>
            <button
              className="icon-button"
              onClick={() => setModal("settings")}
              title="Settings"
              aria-label="Open settings"
            >
              <Settings2 size={19} />
            </button>
            <span className="avatar small-avatar">P</span>
          </div>
        </header>

        {view === "library" ? (
          <main className="library-page">
            <div className="eyebrow">YOUR LEARNING JOURNEY</div>
            <h1>A shelf full of discoveries.</h1>
            <p className="page-subtitle">
              Pick up where your curiosity left off. Lessons are saved in this browser.
            </p>
            <label className="library-search">
              <Search size={18} />
              <input
                placeholder="Find a lesson…"
                value={libraryQuery}
                onChange={(e) => setLibraryQuery(e.target.value)}
                aria-label="Search saved lessons"
              />
            </label>
            <div className="library-grid">
              {history
                .filter((item) => item.title.toLowerCase().includes(libraryQuery.toLowerCase()))
                .map((item) => (
                  <button className="library-card" key={item.id} onClick={() => openLesson(item)}>
                    <span className="library-icon">
                      <BookOpen size={25} />
                    </span>
                    <span className="mini-label">
                      {item.source === "sample" ? "SAMPLE LESSON" : "AI LESSON"}
                    </span>
                    <h2>{item.title}</h2>
                    <p>{item.summary}</p>
                    <span className="library-card-footer">
                      {item.scenes.length} chapters <ArrowRight size={17} />
                    </span>
                  </button>
                ))}
            </div>
            {!history.length && (
              <div className="library-empty">
                <BookOpen size={38} />
                <h2>Good questions belong here.</h2>
                <p>Create your first lesson and we'll save it for later.</p>
                <button className="primary-button" onClick={newLesson}>
                  Start learning <ArrowRight size={16} />
                </button>
              </div>
            )}
            {history.length > 0 &&
              !history.some((item) =>
                item.title.toLowerCase().includes(libraryQuery.toLowerCase()),
              ) && <p className="library-empty">No lessons match your search.</p>}
          </main>
        ) : (
          <main className="studio-page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  <span className="tiny-spark">✦</span> LESS SCROLLING. MORE UNDERSTANDING.
                </div>
                <h1>{lesson ? "Let's connect the dots." : "What will you understand today?"}</h1>
                <p className="page-subtitle">Bring your curiosity. We'll bring the whiteboard.</p>
              </div>
              <span className="session-badge">
                <span /> Your personal AI tutor
              </span>
            </div>
            <div className="mobile-switch">
              <button
                className={mobileTab === "chat" ? "active" : ""}
                onClick={() => setMobileTab("chat")}
              >
                <MessageCircle size={16} /> Conversation
              </button>
              <button
                className={mobileTab === "board" ? "active" : ""}
                onClick={() => setMobileTab("board")}
              >
                <Layers3 size={16} /> Whiteboard
              </button>
            </div>

            <div className="studio-grid">
              <section
                className={`chat-panel ${mobileTab === "chat" ? "mobile-visible" : ""}`}
                aria-label="Tutor conversation"
              >
                <div className="panel-heading">
                  <span className="panel-title">
                    <span className="tutor-symbol">
                      <Sparkles size={17} />
                    </span>{" "}
                    Meet your tutor
                  </span>
                  <span className="online-indicator">
                    <i /> Let's learn
                  </span>
                </div>
                <div className="chat-scroll" aria-live="polite" aria-busy={pending}>
                  <div className="tutor-intro">
                    <div className="message-name">
                      <Mark small /> Lumio <span>YOUR AI TUTOR</span>
                    </div>
                    <h2>
                      {lesson ? "One idea, a little clearer." : "Hey, curious mind!"}{" "}
                      <span className="wave">{lesson ? "✧" : "✦"}</span>
                    </h2>
                    <p>
                      {lesson
                        ? lesson.summary
                        : "What's something you've always wanted to understand? Let's make it click, one sketch at a time."}
                    </p>
                    {!lesson && (
                      <div className="intro-features">
                        <span>
                          <Clock3 size={13} /> 2-minute lessons
                        </span>
                        <span>
                          <AudioLines size={14} /> See it. Hear it. Get it.
                        </span>
                      </div>
                    )}
                  </div>
                  {!lesson && !loading && (
                    <div className="topic-suggestions">
                      <div className="small-heading">A LITTLE INSPIRATION</div>
                      {TOPICS.map((topic) => (
                        <button
                          className={`topic-card topic-${topic.color}`}
                          key={topic.title}
                          onClick={() => {
                            setInput(topic.title);
                            void generate(topic.title);
                          }}
                        >
                          <span className="topic-icon">{topic.icon}</span>
                          <span>
                            <strong>{topic.title}</strong>
                            <small>{topic.area}</small>
                          </span>
                          <ArrowRight size={15} />
                        </button>
                      ))}
                      <button
                        className="sample-link"
                        onClick={() => {
                          openLesson(sampleLesson);
                          saveLesson(sampleLesson);
                        }}
                      >
                        Or explore a sample lesson <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                  {lesson && (
                    <div className="lesson-receipt">
                      <span className="receipt-check">
                        <Check size={16} />
                      </span>
                      <div>
                        <strong>Your whiteboard is ready.</strong>
                        <p>
                          {lesson.scenes.length} chapters ·{" "}
                          {lesson.source === "sample"
                            ? "Pre-written sample · browser voice"
                            : "AI-generated lesson & narration"}
                        </p>
                      </div>
                    </div>
                  )}
                  {lesson?.source === "sample" && (
                    <div className="sample-note">
                      This is a pre-written sample to explore playback. New lessons and follow-up
                      answers use live AI when configured.
                    </div>
                  )}
                  {messages.map((message, i) => (
                    <div key={i} className={`chat-message ${message.role}`}>
                      <div className="message-name">
                        {message.role === "assistant" ? (
                          <Mark small />
                        ) : (
                          <span className="mini-avatar">P</span>
                        )}
                        {message.role === "assistant" ? "Lumio" : "You"}
                      </div>
                      <p>{message.content}</p>
                    </div>
                  ))}
                  {loading && (
                    <div className="generation-state">
                      <div className="thinking-orbit">
                        <Sparkles size={24} />
                      </div>
                      <strong>A little thinking. A little sketching.</strong>
                      <p>Turning “{input}” into a visual lesson.</p>
                      <div className="thinking-dots">
                        <i />
                        <i />
                        <i />
                      </div>
                      <button
                        className="text-button"
                        onClick={() => {
                          request.current?.abort();
                          setLoading(false);
                        }}
                      >
                        Cancel generation
                      </button>
                    </div>
                  )}
                  {asking && (
                    <div className="answer-loading">
                      <Mark small />
                      <span>
                        Lumio is thinking<span className="animated-ellipsis">…</span>
                      </span>
                    </div>
                  )}
                  {lesson && !messages.length && !asking && (
                    <div className="followup-inspiration">
                      <div className="small-heading">KEEP YOUR CURIOSITY GOING</div>
                      {lesson.suggestions.map((question) => (
                        <button key={question} onClick={() => focusQuestion(question)}>
                          {question}
                          <ArrowRight size={13} />
                        </button>
                      ))}
                    </div>
                  )}
                  <div ref={chatEnd} />
                </div>
                <div className="composer-area">
                  {error && (
                    <div className="error-message" role="alert">
                      {error}
                      <button onClick={() => setError("")} aria-label="Dismiss error">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <form
                    className="composer"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submit();
                    }}
                  >
                    <textarea
                      ref={composer}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder={
                        lesson ? "Ask a follow-up question…" : "What would you like to learn?"
                      }
                      rows={2}
                      maxLength={lesson ? 1000 : 240}
                      disabled={pending}
                      aria-label={lesson ? "Follow-up question" : "Lesson topic"}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          submit();
                        }
                      }}
                    />
                    <div className="composer-footer">
                      <span>
                        <Sparkles size={12} />{" "}
                        {lesson ? "Follow your curiosity" : "Any topic. Your pace."}
                      </span>
                      <button
                        className="send-button"
                        type="submit"
                        disabled={pending || !input.trim()}
                        aria-label={lesson ? "Send question" : "Generate lesson"}
                      >
                        {pending ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : (
                          <ArrowRight size={19} />
                        )}
                      </button>
                    </div>
                  </form>
                  <div className="composer-hint">
                    <span className={`status-dot ${configured ? "connected" : ""}`} />
                    {configured === null
                      ? "Checking tutor connection…"
                      : configured
                        ? "AI connected · can make mistakes"
                        : "Sample available · connect AI in settings"}
                    <span>↵ to send</span>
                  </div>
                </div>
              </section>

              <section
                className={`board-panel ${mobileTab === "board" ? "mobile-visible" : ""}`}
                aria-label="Lesson whiteboard and playback"
              >
                <div className="panel-heading board-heading">
                  <div className="board-tabs">
                    <button
                      onClick={() => setBoardTab("board")}
                      className={boardTab === "board" ? "active" : ""}
                    >
                      <Layers3 size={16} /> Whiteboard
                    </button>
                    <button
                      onClick={() => setBoardTab("transcript")}
                      className={boardTab === "transcript" ? "active" : ""}
                    >
                      <BookOpen size={15} /> Transcript
                    </button>
                  </div>
                  <div className="board-header-right">
                    <span className="mini-label">
                      {lesson
                        ? `${player.index + 1} / ${lesson.scenes.length} CHAPTERS`
                        : "LEARN VISUALLY"}
                    </span>
                    {lesson && (
                      <button
                        className="icon-button"
                        title="Download lesson and transcript"
                        aria-label="Download lesson"
                        onClick={() =>
                          downloadFile(
                            "lumio-lesson.json",
                            JSON.stringify(lesson, null, 2),
                            "application/json",
                          )
                        }
                      >
                        <Download size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="lesson-titlebar">
                  <div>
                    <span className="mini-label">
                      {lesson
                        ? lesson.source === "ai"
                          ? "YOUR CURIOSITY, EXPLAINED"
                          : "EXPLORE A SAMPLE"
                        : "COMPLEX IDEAS. SIMPLE SKETCHES."}
                    </span>
                    <h2>{lesson?.title || "Everything is easier when you see it."}</h2>
                  </div>
                  <span className="lesson-type">
                    <AudioLines size={14} /> {lesson ? "Visual lesson" : "Show, don't just tell"}
                  </span>
                </div>
                {boardTab === "board" ? (
                  <div className="canvas-wrap">
                    <Whiteboard
                      key={lesson?.id || "preview"}
                      scene={currentScene}
                      progress={lesson ? player.progress : 1}
                      sceneKey={`${lesson?.id || "preview"}-${player.index}`}
                      preview={!lesson}
                      onAsk={focusQuestion}
                    />
                    {!lesson && (
                      <div className="preview-caption">
                        <span>✦</span> A glimpse inside a neural network. Your next “aha!” is one
                        question away.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="transcript-pane">
                    {lesson ? (
                      lesson.scenes.map((scene, i) => (
                        <button
                          key={i}
                          className={`transcript-scene ${i === player.index ? "active" : ""}`}
                          onClick={() => {
                            player.seek(player.starts[i]);
                            setMobileTab("board");
                          }}
                        >
                          <span className="transcript-time">{formatTime(player.starts[i])}</span>
                          <div>
                            <h3>{scene.title}</h3>
                            <p>{scene.narration}</p>
                          </div>
                          {i === player.index && <AudioLines size={16} />}
                        </button>
                      ))
                    ) : (
                      <div className="transcript-empty">
                        <BookOpen size={30} />
                        <h3>Every word, at your pace.</h3>
                        <p>
                          Your lesson's transcript will appear here.
                          <br />
                          Choose a topic or explore the sample to begin.
                        </p>
                        <button
                          className="secondary-button"
                          onClick={() => {
                            openLesson(sampleLesson);
                            saveLesson(sampleLesson);
                          }}
                        >
                          Explore sample <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="board-underlay">
                  {lesson ? (
                    <div className="takeaway">
                      <span className="takeaway-icon">
                        <Lightbulb size={18} />
                      </span>
                      <div>
                        <span className="mini-label">THE LITTLE LIGHTBULB MOMENT</span>
                        <p>{currentScene.takeaway}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-takeaway">
                      <span className="takeaway-icon">
                        <Lightbulb size={18} />
                      </span>
                      <p>
                        Some things just need a whiteboard.
                        <br />
                        <strong>Pick a topic, press play, and let it click.</strong>
                      </p>
                      <span className="handwritten">
                        aha! <span>↗</span>
                      </span>
                    </div>
                  )}
                  {lesson && (
                    <div className="chapter-markers" aria-label="Lesson chapters">
                      {lesson.scenes.map((scene, i) => (
                        <button
                          key={i}
                          className={`${i === player.index ? "active" : ""} ${i < player.index ? "completed" : ""}`}
                          onClick={() => player.seek(player.starts[i])}
                          title={scene.title}
                        >
                          <span>
                            {i < player.index ? (
                              <Check size={12} />
                            ) : (
                              String(i + 1).padStart(2, "0")
                            )}
                          </span>
                          <span>{scene.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={`playback ${!lesson ? "inactive" : ""}`}>
                    <div className="timeline-line">
                      <span>{formatTime(player.position)}</span>
                      <input
                        type="range"
                        min={0}
                        max={player.total}
                        step="0.05"
                        value={player.position}
                        disabled={!lesson || player.preparing}
                        onChange={(event) => player.seek(Number(event.target.value))}
                        aria-label="Seek lesson"
                        aria-valuetext={`${formatTime(player.position)} of ${formatTime(player.total)}`}
                        style={
                          {
                            "--progress": `${(player.position / player.total) * 100}%`,
                          } as React.CSSProperties
                        }
                      />
                      <span>{lesson ? formatTime(player.total) : "~2:00"}</span>
                    </div>
                    <div className="playback-controls">
                      <div className="playback-left">
                        <button
                          className="icon-button"
                          title="Restart lesson"
                          aria-label="Restart lesson"
                          disabled={!lesson || player.preparing}
                          onClick={player.restart}
                        >
                          <RotateCcw size={17} />
                        </button>
                        <button
                          className="icon-button"
                          title="Previous chapter"
                          aria-label="Previous chapter"
                          disabled={!lesson || player.preparing || player.index === 0}
                          onClick={() => player.seek(player.starts[Math.max(0, player.index - 1)])}
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <button
                          className={`play-button ${lesson && !player.audioReady && !player.browserVoice ? "prepare-button" : ""}`}
                          title={player.playing ? "Pause" : "Play lesson"}
                          aria-label={
                            player.playing
                              ? "Pause lesson"
                              : !player.audioReady && !player.browserVoice
                                ? "Prepare AI voice"
                                : "Play lesson"
                          }
                          disabled={!lesson || player.preparing}
                          onClick={player.toggle}
                        >
                          {player.preparing ? (
                            <LoaderCircle size={18} className="spin" />
                          ) : player.playing ? (
                            <Pause size={18} fill="currentColor" />
                          ) : (
                            <Play size={18} fill="currentColor" />
                          )}
                          {player.preparing
                            ? `${player.preparedCount}/${lesson?.scenes.length}`
                            : lesson && !player.audioReady && !player.browserVoice
                              ? "Prepare voice"
                              : null}
                        </button>
                        <button
                          className="icon-button"
                          title="Next chapter"
                          aria-label="Next chapter"
                          disabled={
                            !lesson || player.preparing || player.index === lesson.scenes.length - 1
                          }
                          onClick={() => player.seek(player.starts[player.index + 1])}
                        >
                          <ChevronRight size={20} />
                        </button>
                        <span className="play-status">
                          {player.preparing
                            ? "Creating AI narration…"
                            : player.playing
                              ? "A little clearer, every second"
                              : !lesson
                                ? "Your next discovery awaits"
                                : isFinished
                                  ? "A little wiser. Replay?"
                                  : player.audioReady || player.browserVoice
                                    ? "Ready when you are"
                                    : "Bring your lesson to life"}
                        </span>
                      </div>
                      <div className="playback-right">
                        <select
                          aria-label="Playback speed"
                          value={player.rate}
                          onChange={(e) => player.setRate(Number(e.target.value))}
                          disabled={!lesson}
                        >
                          <option value={0.75}>0.75×</option>
                          <option value={1}>1×</option>
                          <option value={1.25}>1.25×</option>
                          <option value={1.5}>1.5×</option>
                        </select>
                        <button
                          className="icon-button"
                          aria-label={player.muted ? "Unmute narration" : "Mute narration"}
                          title={player.muted ? "Unmute" : "Mute"}
                          disabled={!lesson}
                          onClick={() => player.setMuted(!player.muted)}
                        >
                          {player.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  {player.error && (
                    <div className="audio-error" role="alert">
                      {player.error}
                      {!player.browserVoice && player.speechSupported && (
                        <button onClick={() => player.useBrowserVoice(true)}>
                          Use browser voice instead
                        </button>
                      )}
                    </div>
                  )}
                  {lesson && (
                    <div className="voice-footer">
                      <span>
                        <AudioLines size={12} />{" "}
                        {player.browserVoice
                          ? "Browser voice · estimated timeline"
                          : "AI-generated voice · audio-synced canvas"}
                      </span>
                      <button
                        onClick={() => player.useBrowserVoice(!player.browserVoice)}
                        disabled={
                          player.preparing || (!player.browserVoice && !player.speechSupported)
                        }
                      >
                        {player.browserVoice ? "Use AI voice" : "Use browser voice"}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {lesson ? (
              <div className="lesson-bottom">
                <div>
                  <span className="bottom-spark">✦</span>
                  <span>
                    Understanding is a conversation.
                    <strong> Ask a follow-up or put it to the test.</strong>
                  </span>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => {
                    player.pause();
                    setQuizOpen(!quizOpen);
                  }}
                >
                  {quizOpen ? "Hide concept check" : "Check my understanding"}
                  <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <div className="studio-footer">
                <span>
                  <span className="bottom-spark">✦</span> Not just an answer. A way to understand.
                </span>
                <span>Made for “wait, now I get it.”</span>
              </div>
            )}
            {quizOpen && lesson && (
              <section className="quiz-panel">
                <div className="eyebrow">A QUICK LIGHTBULB CHECK</div>
                <h2>{lesson.quiz.question}</h2>
                <div className="quiz-options">
                  {lesson.quiz.options.map((option, i) => (
                    <button
                      key={i}
                      className={`${quizAnswer === i ? "chosen" : ""} ${quizAnswer !== null && i === lesson.quiz.answerIndex ? "correct" : ""}`}
                      onClick={() => setQuizAnswer(i)}
                      disabled={quizAnswer !== null}
                    >
                      <span>{String.fromCharCode(65 + i)}</span>
                      {option}
                      {quizAnswer !== null && i === lesson.quiz.answerIndex && <Check size={18} />}
                    </button>
                  ))}
                </div>
                {quizAnswer !== null && (
                  <div className="quiz-feedback" role="status">
                    <strong>
                      {quizAnswer === lesson.quiz.answerIndex
                        ? "That's it. You've connected the dots!"
                        : "You're learning — let's connect that dot."}
                    </strong>
                    <p>{lesson.quiz.explanation}</p>
                    <button className="text-button" onClick={() => setQuizAnswer(null)}>
                      Try again
                    </button>
                  </div>
                )}
              </section>
            )}
          </main>
        )}
      </div>

      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {modal === "settings" && (
        <Modal title="Make yourself at home." close={() => setModal(null)}>
          <p className="modal-description">
            Your tutor, your pace. Lessons stay in this browser; the AI receives the topic and
            conversation you send.
          </p>
          <div className="settings-section">
            <h3>
              <span className={`status-dot ${configured ? "connected" : ""}`} />{" "}
              {configured ? "AI tutor connected" : "Connect your AI tutor"}
            </h3>
            <p>
              {configured ? (
                "Live lesson generation, follow-up answers, and AI voice are available."
              ) : (
                <>
                  Create <code>.env.local</code> using <code>.env.example</code>, add your{" "}
                  <code>OPENAI_API_KEY</code>, and restart the server. On Vercel, add the key in
                  your project's environment settings and redeploy.
                </>
              )}
            </p>
          </div>
          {accessRequired && (
            <form
              className="access-form"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  sessionStorage.setItem("lumio-access-code", accessCode);
                  setNotice("Access code saved for this browser session.");
                  setModal(null);
                } catch {
                  setNotice(
                    "Session storage is unavailable. Enable browser storage to save the access code.",
                  );
                }
              }}
            >
              <label htmlFor="access-code">Demo access code</label>
              <input
                id="access-code"
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                autoComplete="off"
              />
              <button className="primary-button">Save access code</button>
            </form>
          )}
          <div className="settings-section">
            <h3>Voice & playback</h3>
            <p>
              AI voice uses generated audio for accurate playback and seeking. Browser voice is a
              free alternative with an estimated timeline and word-level seeking. All narration is
              synthesized.
            </p>
          </div>
          <div className="settings-section">
            <h3>Saved lessons</h3>
            <p>
              {history.length} of 12 lesson slots used. Oldest lessons are replaced automatically.
              Whiteboard annotations and conversation aren't saved.
            </p>
            <button
              className="secondary-button"
              disabled={!history.length}
              onClick={() => {
                try {
                  localStorage.removeItem("lumio-lessons");
                  setHistory([]);
                  setNotice("Saved lesson history cleared.");
                } catch {
                  setNotice("Browser storage is unavailable.");
                }
              }}
            >
              Clear saved history
            </button>
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="A small guide to big ideas." close={() => setModal(null)}>
          <div className="guide-steps">
            <div>
              <span>01</span>
              <section>
                <h3>Start with a question</h3>
                <p>
                  Enter any educational topic. Lumio creates a short lesson with narration,
                  diagrams, and a concept check.
                </p>
              </section>
            </div>
            <div>
              <span>02</span>
              <section>
                <h3>Watch it come together</h3>
                <p>
                  Prepare the AI voice, then press Play. The whiteboard follows the narration.
                  Pause, change speed, or jump to any chapter.
                </p>
              </section>
            </div>
            <div>
              <span>03</span>
              <section>
                <h3>Make it yours</h3>
                <p>
                  Draw or highlight on the canvas. With the select tool, click a diagram label to
                  ask about it. Export the board or lesson to keep a copy.
                </p>
              </section>
            </div>
            <div>
              <span>04</span>
              <section>
                <h3>Follow the next question</h3>
                <p>
                  Ask for a different example, dig into a tricky idea, or check your understanding.
                  There's always another dot to connect.
                </p>
              </section>
            </div>
          </div>
          <button className="primary-button" onClick={() => setModal(null)}>
            Let's make it click <ArrowRight size={16} />
          </button>
        </Modal>
      )}
    </div>
  );
}
