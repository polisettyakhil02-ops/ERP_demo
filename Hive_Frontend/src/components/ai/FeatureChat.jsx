import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  RotateCcw,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { featureRequestApi } from "@/api/api";
import FeatureDraftDetails from "@/components/ai/FeatureDraftDetails";
import {
  OPEN_FEATURE_CHAT_EVENT,
  PRIORITY_STYLES,
  apiErrorMessage,
  requestRef,
} from "@/lib/featureRequests";

// Matches the backend's cap on turns per chat (featureRequestController).
const MAX_TURNS = 40;

const GREETING =
  "Hi! What would make your work in the ERP easier? Describe a feature or a change you'd like, and I'll help turn it into a request for the development team.";

function DraftCard({ draft, canSubmit, submitting, onSubmit }) {
  return (
    <div className="mt-2 rounded-xl border border-indigo-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
            Draft request
          </p>
          <p className="text-sm font-semibold text-slate-800">{draft.title}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            PRIORITY_STYLES[draft.priority] || PRIORITY_STYLES.Medium
          }`}
        >
          {draft.priority}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{draft.summary}</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-indigo-600">
          Show details
        </summary>
        <div className="mt-2">
          <FeatureDraftDetails draft={draft} />
        </div>
      </details>
      {canSubmit && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
          <span className="text-xs text-slate-400">
            or tell me what to change
          </span>
        </div>
      )}
    </div>
  );
}

// Floating "Suggest a feature" assistant, rendered once in RoleLayout so a
// conversation survives moving between pages. The AI only drafts a request
// - submitting it just records it for the development team to review.
export default function FeatureChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // [{ role, content, draft? }]
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_FEATURE_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_FEATURE_CHAT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, submitted, error, open]);

  useEffect(() => {
    if (open && !submitted) inputRef.current?.focus();
  }, [open, submitted]);

  let latestDraftIndex = -1;
  messages.forEach((m, i) => {
    if (m.draft) latestDraftIndex = i;
  });

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    // A user turn plus the reply to it must still fit under the cap.
    if (messages.length + 2 > MAX_TURNS) {
      setError(
        "This chat is getting long. Submit the draft or start a new chat.",
      );
      return;
    }
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError("");
    setSending(true);
    try {
      const { reply, draft } = await featureRequestApi.chat(next);
      setMessages([
        ...next,
        { role: "assistant", content: reply, ...(draft ? { draft } : {}) },
      ]);
    } catch (err) {
      // Put things back so the user can simply try again.
      setMessages(messages);
      setInput(text);
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const submitDraft = async (draft) => {
    setSubmitting(true);
    setError("");
    try {
      const created = await featureRequestApi.create({
        ...draft,
        conversation: messages.map(({ role, content }) => ({ role, content })),
      });
      setSubmitted(created);
      toast.success(`Request ${requestRef(created._id)} submitted`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setInput("");
    setError("");
    setSubmitted(null);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Suggest a feature"
          className="fixed bottom-20 right-4 z-50 flex h-[min(600px,calc(100vh-7rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4" />
                Suggest a feature
              </p>
              <p className="text-xs text-indigo-100">
                The AI helps you write it up. The development team reviews
                every request.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={reset}
                title="Start a new chat"
                className="rounded-lg p-1.5 text-indigo-100 hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
                className="rounded-lg p-1.5 text-indigo-100 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-1.5 text-xs">
            <span className="text-slate-400">
              Don't include students' or parents' personal details.
            </span>
            <Link
              to="/feature-requests"
              onClick={() => setOpen(false)}
              className="shrink-0 font-medium text-indigo-600 hover:underline"
            >
              My requests
            </Link>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {GREETING}
            </div>

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-tr-sm bg-indigo-600 px-3 py-2 text-sm text-white">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i}>
                  <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 text-sm text-slate-700">
                    {m.content}
                  </div>
                  {m.draft && (
                    <DraftCard
                      draft={m.draft}
                      canSubmit={i === latestDraftIndex && !submitted}
                      submitting={submitting}
                      onSubmit={() => submitDraft(m.draft)}
                    />
                  )}
                </div>
              ),
            )}

            {sending && (
              <div className="flex w-fit items-center gap-2 rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 text-sm text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking…
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}

            {submitted && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <p className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  Submitted as {requestRef(submitted._id)}
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  The development team will review it. You can follow its
                  status under My requests.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={reset}>
                    Suggest another idea
                  </Button>
                </div>
              </div>
            )}
          </div>

          {!submitted && (
            <div className="border-t border-slate-100 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={2}
                  maxLength={4000}
                  placeholder="Describe your idea…"
                  disabled={sending}
                  className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                />
                <Button
                  size="icon-lg"
                  onClick={send}
                  disabled={sending || !input.trim()}
                  title="Send"
                  className="rounded-xl"
                >
                  <SendHorizontal />
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Enter to send, Shift+Enter for a new line
              </p>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close feature chat" : "Suggest a feature"}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:shadow-xl"
      >
        {open ? <X className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        <span className="hidden sm:inline">
          {open ? "Close" : "Suggest a feature"}
        </span>
      </button>
    </>
  );
}
