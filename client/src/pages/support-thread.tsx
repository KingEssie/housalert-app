import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-base";
import { HousAlertLogo } from "@/components/housalert-logo";
import {
  ChevronLeft,
  Send,
  Loader2,
  BookOpen,
  ExternalLink,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface TicketMessage {
  id: number;
  ticket_id: number;
  sender_type: "user" | "admin" | "system";
  sender_user_id?: string;
  message: string;
  display_body?: string;
  original_body?: string;
  translated?: boolean;
  translation_status?: string;
  original_language?: string;
  faq_title?: string;
  faq_url?: string;
  created_at: string;
}

interface TicketThread {
  id: number;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In behandeling",
  resolved: "Opgelost",
  closed: "Gesloten",
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  open:        { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  in_progress: { bg: "#bbadfb", text: "#171429", border: "#bbadfb" },
  resolved:    { bg: "#85fb8c", text: "#223546", border: "#85fb8c" },
  closed:      { bg: "#f5f5f7", text: "#888888", border: "#e0e0e0" },
};

const STATUS_MESSAGES: Record<string, string> = {
  open:        "We hebben je bericht ontvangen.",
  in_progress: "We kijken met je mee.",
  resolved:    "Deze supportvraag is gemarkeerd als opgelost.",
  closed:      "Deze supportvraag is gesloten.",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function FaqCard({ title, url }: { title: string; url: string }) {
  return (
    <button
      onClick={() => window.open(url || "https://www.housalert.com/faq", "_blank")}
      className="w-full text-left rounded-[18px] px-4 py-3.5 flex items-start gap-3 active:opacity-70 transition-opacity mt-2"
      style={{ backgroundColor: "#f9f8ff", border: "1px solid #ede7ff" }}
    >
      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "#bbadfb" }}>
        <BookOpen className="w-4 h-4" style={{ color: "#171429" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold leading-snug" style={{ color: "#111111" }}>{title}</p>
        <p className="text-[12px] font-semibold mt-1 flex items-center gap-1" style={{ color: "#bbadfb" }}>
          Bekijk uitleg <ExternalLink className="w-3 h-3" />
        </p>
      </div>
    </button>
  );
}

function MessageBubble({ msg }: { msg: TicketMessage }) {
  const [showOriginal, setShowOriginal] = useState(false);

  if (msg.sender_type === "system") {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] italic px-3 py-1 rounded-full" style={{ color: "#aaaaaa", backgroundColor: "#f0f0f0" }}>
          {msg.message}
        </span>
      </div>
    );
  }

  const isUser = msg.sender_type === "user";
  const bodyToShow = showOriginal
    ? (msg.original_body || msg.message)
    : (msg.display_body || msg.message);
  const canToggle = msg.translated && msg.original_body && msg.original_body !== bodyToShow;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-auto mb-5" style={{ backgroundColor: "#bbadfb" }}>
          <span className="text-[10px] font-bold" style={{ color: "#171429" }}>HA</span>
        </div>
      )}
      <div className="max-w-[82%]">
        <div
          className="px-4 py-3 rounded-[20px] text-[14px] leading-relaxed"
          style={isUser
            ? { backgroundColor: "#edfbf0", color: "#111111", borderBottomRightRadius: "6px" }
            : { backgroundColor: "#ffffff", color: "#111111", border: "1px solid #eeeeee", borderBottomLeftRadius: "6px" }
          }
        >
          {bodyToShow}
        </div>
        {msg.faq_title && msg.faq_url && (
          <FaqCard title={msg.faq_title} url={msg.faq_url} />
        )}
        {msg.translated && (
          <div className={`flex items-center gap-2 mt-1 ${isUser ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#f0ecff", color: "#8b68e0" }}>
              Automatisch vertaald
            </span>
            {canToggle && (
              <button
                onClick={() => setShowOriginal(v => !v)}
                className="text-[10px] font-medium underline-offset-2"
                style={{ color: "#bbbbbb" }}
              >
                {showOriginal ? "Vertaling bekijken" : "Origineel bekijken"}
              </button>
            )}
          </div>
        )}
        {msg.translation_status === "failed" && (
          <p className={`text-[10px] mt-1 ${isUser ? "text-right" : "text-left"}`} style={{ color: "#f59e0b" }}>
            Vertaling niet beschikbaar
          </p>
        )}
        <p className={`text-[10px] mt-1 ${isUser ? "text-right" : "text-left"}`} style={{ color: "#bbbbbb" }}>
          {formatTime(msg.created_at)}
        </p>
      </div>
    </div>
  );
}

export default function SupportThreadPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/support/:id");
  const ticketId = params?.id;

  const [thread, setThread] = useState<TicketThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [focusReply, setFocusReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ticketId) loadThread();
  }, [ticketId]);

  useEffect(() => {
    if (thread?.messages.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread?.messages.length]);

  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} as Record<string, string>;
  }

  async function loadThread() {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch(`/api/support/tickets/${ticketId}/thread`, { headers });
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setThread(data);
    } catch {
      setError("Kon het gesprek niet laden.");
    } finally {
      setLoading(false);
    }
  }

  async function sendReply() {
    if (!reply.trim() || sending) return;
    setSending(true);
    setReplyError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch(`/api/support/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ message: reply.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setReply("");
      setThread(prev => prev ? {
        ...prev,
        status: data.new_status || prev.status,
        messages: [...prev.messages, data.message],
      } : prev);
    } catch {
      setReplyError("Versturen mislukt. Probeer opnieuw.");
    } finally {
      setSending(false);
    }
  }

  const sc = STATUS_COLORS[thread?.status || "open"] || STATUS_COLORS.open;
  const canReply = thread && thread.status !== "closed";
  const willReopen = thread?.status === "resolved";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f6f6f6" }}>

      {/* ── Sticky Header ── */}
      <div
        className="sticky top-0 z-20 flex items-center h-[60px] px-4 gap-3"
        style={{ backgroundColor: "#f6f6f6" }}
      >
        <button
          onClick={() => navigate("/support")}
          className="w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ backgroundColor: "#ffffff", border: "1px solid #e8e8e8" }}
          data-testid="button-back"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "#111111" }} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold truncate leading-tight" style={{ color: "#111111" }}>
            {thread ? thread.subject : "Supportvraag"}
          </p>
        </div>
        {thread && (
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0"
            style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.border }}
          >
            {STATUS_LABELS[thread.status] || thread.status}
          </span>
        )}
        <button
          onClick={loadThread}
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ backgroundColor: "#f0f0f0" }}
          data-testid="button-refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "#888" }} />
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">

        {loading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#bbadfb" }} />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <AlertCircle className="w-8 h-8" style={{ color: "#e11d48" }} />
            <p className="text-[14px]" style={{ color: "#666" }}>{error}</p>
            <button onClick={loadThread} className="text-[13px] font-semibold" style={{ color: "#bbadfb" }}>
              Opnieuw proberen
            </button>
          </div>
        )}

        {thread && !loading && (
          <div className="max-w-[520px] mx-auto space-y-4 pt-2 pb-6">

            {/* Status bar */}
            <div
              className="rounded-[16px] px-4 py-3 text-center"
              style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}` }}
            >
              <p className="text-[13px] font-semibold" style={{ color: sc.text }}>
                {STATUS_MESSAGES[thread.status] || ""}
              </p>
            </div>

            {/* Messages */}
            <div className="space-y-3">
              {thread.messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* ── Reply box (sticky bottom) ── */}
      {thread && canReply && (
        <div
          className="sticky bottom-0 px-4 pb-6 pt-3"
          style={{ backgroundColor: "#f6f6f6", borderTop: "1px solid #eeeeee" }}
        >
          <div className="max-w-[520px] mx-auto">
            {willReopen && (
              <p className="text-[11px] mb-1.5 text-center font-medium" style={{ color: "#bbadfb" }}>
                Je antwoord heropent dit ticket
              </p>
            )}
            {replyError && (
              <p className="text-[12px] mb-2 text-center" style={{ color: "#e11d48" }}>{replyError}</p>
            )}
            <div className="flex gap-2">
              <textarea
                placeholder="Schrijf je antwoord..."
                value={reply}
                onChange={e => setReply(e.target.value.slice(0, 1000))}
                onFocus={() => setFocusReply(true)}
                onBlur={() => setFocusReply(false)}
                rows={2}
                className="flex-1 px-4 py-3 rounded-[18px] text-[14px] resize-none"
                style={{
                  backgroundColor: "#ffffff",
                  border: focusReply ? "1.5px solid #bbadfb" : "1.5px solid #dddddd",
                  color: "#111111",
                  outline: "none",
                }}
                data-testid="input-reply"
              />
              <button
                onClick={sendReply}
                disabled={!reply.trim() || sending}
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 self-end transition-all active:scale-95 disabled:opacity-40"
                style={{ backgroundColor: "#85fb8c" }}
                data-testid="button-send-reply"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#223546" }} /> : <Send className="w-4 h-4" style={{ color: "#223546" }} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Closed notice */}
      {thread && !canReply && (
        <div className="sticky bottom-0 px-4 pb-6 pt-3" style={{ backgroundColor: "#f6f6f6", borderTop: "1px solid #eeeeee" }}>
          <div className="max-w-[520px] mx-auto">
            <p className="text-[13px] text-center" style={{ color: "#aaaaaa" }}>
              Dit ticket is gesloten. Stuur een nieuw bericht via de Support-pagina.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
