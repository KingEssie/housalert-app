import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-base";
import { logoSrc } from "@/components/housalert-logo";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  CheckCircle,
  Send,
  Tag,
  ChevronDown,
  BookOpen,
  FileText,
  Shield,
  Pencil,
} from "lucide-react";

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1.5px solid #111111",
  color: "#111111",
};
const INPUT_FOCUS_STYLE: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1.5px solid #bbadfb",
  color: "#111111",
  outline: "none",
};

const SUBJECT_OPTIONS = [
  "Mijn profiel",
  "Meldingen ontvangen",
  "Abonnement & betaling",
  "Technisch probleem",
  "Overig",
];

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: "#ede7ff" }}
    >
      {children}
    </div>
  );
}

function HeroIllustration() {
  return (
    <svg width="120" height="110" viewBox="0 0 120 110" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* sparkle top-left */}
      <path d="M14 18 L16 14 L18 18 L22 20 L18 22 L16 26 L14 22 L10 20 Z" fill="#bbadfb" opacity="0.5" />
      {/* sparkle top-right */}
      <path d="M96 8 L97.5 5 L99 8 L102 9.5 L99 11 L97.5 14 L96 11 L93 9.5 Z" fill="#bbadfb" opacity="0.4" />
      {/* main bubble */}
      <ellipse cx="68" cy="48" rx="46" ry="42" fill="#d3c4ff" opacity="0.25" />
      <rect x="24" y="10" width="88" height="72" rx="28" fill="#c4b2f7" opacity="0.55" />
      <rect x="24" y="10" width="88" height="72" rx="28" fill="url(#bubbleGrad)" />
      {/* three dots */}
      <circle cx="52" cy="48" r="5" fill="white" opacity="0.9" />
      <circle cx="68" cy="48" r="5" fill="white" opacity="0.9" />
      <circle cx="84" cy="48" r="5" fill="white" opacity="0.9" />
      {/* bubble tail */}
      <path d="M44 78 L36 96 L60 82 Z" fill="#c4b2f7" opacity="0.7" />
      {/* mini house */}
      <rect x="50" y="88" width="20" height="16" rx="3" fill="#e8e0ff" opacity="0.9" />
      <polygon points="50,88 60,78 70,88" fill="#d0c0ff" opacity="0.9" />
      <rect x="56" y="96" width="8" height="8" rx="1.5" fill="#bbadfb" opacity="0.7" />
      <defs>
        <linearGradient id="bubbleGrad" x1="24" y1="10" x2="112" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c4b2f7" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#a693f0" stopOpacity="0.65" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function SupportPage() {
  const [, navigate] = useLocation();
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const MAX_CHARS = 1000;
  const effectiveSubject = subject === "Overig" ? customSubject : subject;

  async function handleSend() {
    if (!effectiveSubject.trim() || !message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await apiFetch("/api/support/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ subject: effectiveSubject.trim(), message: message.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed");
      }
      setSent(true);
    } catch {
      setError("Er is iets misgegaan. Probeer het opnieuw.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f6f6f6" }}>

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-20 flex items-center h-[60px] px-5 gap-3"
        style={{ backgroundColor: "#f6f6f6" }}
      >
        <button
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate("/settings"); }}
          className="w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ backgroundColor: "#ffffff", border: "1px solid #e8e8e8" }}
          data-testid="button-back"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "#111111" }} />
        </button>

        <img
          src={logoSrc}
          alt="HousAlert"
          className="object-contain"
          style={{ height: 18, width: "auto", filter: "brightness(0)", mixBlendMode: "multiply" }}
        />

        <span
          className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide"
          style={{ backgroundColor: "#ede7ff", color: "#7c5cbf" }}
        >
          SUPPORT
        </span>
      </div>

      <div className="max-w-[480px] mx-auto px-5 pb-20 space-y-5">

        {/* ── Hero ── */}
        <div className="flex items-center justify-between pt-2 pb-1">
          <div className="flex-1 pr-2">
            <h1 className="text-[32px] font-bold leading-tight" style={{ color: "#111111" }}>
              Hoe kunnen we<br />
              <span style={{ color: "#bbadfb" }}>je helpen?</span>
            </h1>
            <p className="text-[15px] mt-2" style={{ color: "#7d7d7d" }}>We staan voor je klaar.</p>
          </div>
          <div className="flex-shrink-0 -mr-1">
            <HeroIllustration />
          </div>
        </div>

        {/* ── Support ticket card ── */}
        <div
          className="bg-white rounded-[28px] p-6"
          style={{ border: "1px solid #eeeeee" }}
        >
          <div className="flex items-center gap-3.5 mb-5">
            <IconBox>
              <MessageSquare className="w-5 h-5" style={{ color: "#111111" }} />
            </IconBox>
            <div>
              <p className="text-[17px] font-bold" style={{ color: "#111111" }}>Stuur ons een bericht</p>
              <p className="text-[13px] mt-0.5" style={{ color: "#7d7d7d" }}>Ons team helpt je zo snel mogelijk verder.</p>
            </div>
          </div>

          {sent ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#edfbf0" }}
              >
                <CheckCircle className="w-8 h-8" style={{ color: "#16a34a" }} />
              </div>
              <p className="text-[18px] font-bold text-center" style={{ color: "#111111" }}>Bericht verzonden!</p>
              <p className="text-[14px] text-center leading-relaxed" style={{ color: "#7d7d7d" }}>
                Ons team helpt je zo snel mogelijk verder.
              </p>
              <button
                onClick={() => { setSent(false); setSubject(""); setCustomSubject(""); setMessage(""); }}
                className="text-[14px] font-semibold mt-2"
                style={{ color: "#bbadfb" }}
                data-testid="button-send-another"
              >
                Nog een bericht sturen
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">

              {/* Subject select */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Tag className="w-4 h-4" style={{ color: "#aaaaaa" }} />
                </div>
                <select
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  onFocus={() => setFocusedField("subject")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full appearance-none pl-10 pr-10 py-3.5 rounded-[18px] text-[14px]"
                  style={{
                    ...(focusedField === "subject" ? INPUT_FOCUS_STYLE : INPUT_STYLE),
                    color: subject ? "#111111" : "#aaaaaa",
                  }}
                  data-testid="select-subject"
                >
                  <option value="" disabled>Onderwerp</option>
                  {SUBJECT_OPTIONS.map(o => (
                    <option key={o} value={o} style={{ color: "#111111" }}>{o}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-4 h-4" style={{ color: "#aaaaaa" }} />
                </div>
              </div>

              {/* Custom subject when "Overig" */}
              {subject === "Overig" && (
                <input
                  type="text"
                  placeholder="Typ je onderwerp..."
                  value={customSubject}
                  onChange={e => setCustomSubject(e.target.value)}
                  onFocus={() => setFocusedField("custom")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full px-4 py-3.5 rounded-[18px] text-[14px]"
                  style={focusedField === "custom" ? INPUT_FOCUS_STYLE : INPUT_STYLE}
                  data-testid="input-subject-custom"
                />
              )}

              {/* Textarea with icon + char count */}
              <div className="relative">
                <div className="absolute left-4 top-4 pointer-events-none">
                  <Pencil className="w-4 h-4" style={{ color: "#aaaaaa" }} />
                </div>
                <textarea
                  placeholder="Vertel ons wat er aan de hand is..."
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, MAX_CHARS))}
                  onFocus={() => setFocusedField("message")}
                  onBlur={() => setFocusedField(null)}
                  rows={5}
                  className="w-full pl-10 pr-4 pt-4 pb-8 rounded-[18px] text-[14px] resize-none"
                  style={focusedField === "message" ? INPUT_FOCUS_STYLE : INPUT_STYLE}
                  data-testid="input-message"
                />
                <span
                  className="absolute bottom-3 right-4 text-[11px]"
                  style={{ color: "#cccccc" }}
                >
                  {message.length} / {MAX_CHARS}
                </span>
              </div>

              {error && (
                <p className="text-[12px]" style={{ color: "#e11d48" }} data-testid="text-error">
                  {error}
                </p>
              )}

              <button
                onClick={handleSend}
                disabled={sending || !effectiveSubject.trim() || !message.trim()}
                className="w-full py-4 rounded-full text-[15px] font-bold transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 mt-1"
                style={{ backgroundColor: "#85fb8c", color: "#111111" }}
                data-testid="button-send"
              >
                <Send className="w-4 h-4" />
                {sending ? "Verzenden..." : "Verstuur bericht"}
              </button>
            </div>
          )}
        </div>

        {/* ── FAQ card ── */}
        <button
          onClick={() => window.open("https://www.housalert.com/faq", "_blank")}
          className="w-full bg-white rounded-[28px] px-5 py-5 flex items-center gap-4 text-left active:opacity-80 transition-opacity"
          style={{ border: "1px solid #eeeeee" }}
          data-testid="button-faq"
        >
          <IconBox>
            <BookOpen className="w-5 h-5" style={{ color: "#111111" }} />
          </IconBox>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold" style={{ color: "#111111" }}>Hoe werkt HousAlert</p>
            <p className="text-[13px] mt-0.5" style={{ color: "#7d7d7d" }}>Bekijk veelgestelde vragen en uitleg</p>
          </div>
          <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: "#cccccc" }} />
        </button>

        {/* ── WhatsApp — secondary ── */}
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-widest mb-2.5 px-1"
            style={{ color: "#aaaaaa" }}
          >
            Liever WhatsApp?
          </p>
          <button
            onClick={() => window.open("https://wa.me/", "_blank")}
            className="w-full bg-white rounded-[28px] px-5 py-5 flex items-center gap-4 text-left active:opacity-80 transition-opacity"
            style={{ border: "1px solid #eeeeee" }}
            data-testid="button-whatsapp"
          >
            <IconBox>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#111111">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M11.984 2C6.465 2 2 6.465 2 11.984a9.96 9.96 0 001.376 5.022L2 22l5.12-1.345A9.964 9.964 0 0011.984 22C17.503 22 22 17.535 22 12.016 22 6.497 17.503 2 11.984 2zm0 18.125a8.14 8.14 0 01-4.134-1.126l-.296-.175-3.04.798.812-2.96-.193-.305A8.14 8.14 0 013.875 12c0-4.472 3.637-8.109 8.109-8.109 4.471 0 8.109 3.637 8.109 8.109 0 4.471-3.638 8.125-8.109 8.125z" />
              </svg>
            </IconBox>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold" style={{ color: "#111111" }}>Liever WhatsApp?</p>
              <p className="text-[13px] mt-0.5" style={{ color: "#7d7d7d" }}>Stuur ons snel een bericht via WhatsApp</p>
            </div>
            <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: "#cccccc" }} />
          </button>
        </div>

        {/* ── Legal links ── */}
        <div
          className="bg-white rounded-[28px] overflow-hidden"
          style={{ border: "1px solid #eeeeee" }}
        >
          {[
            { label: "Algemene voorwaarden", sub: "Lees onze voorwaarden", url: "https://www.housalert.com/terms-of-service", Icon: FileText },
            { label: "Privacybeleid", sub: "Lees hoe wij met je gegevens omgaan", url: "https://www.housalert.com/privacy", Icon: Shield },
          ].map(({ label, sub, url, Icon }, i) => (
            <div key={i}>
              {i > 0 && <div className="h-px mx-5" style={{ backgroundColor: "#f2f2f2" }} />}
              <button
                onClick={() => window.open(url, "_blank")}
                className="w-full flex items-center gap-4 px-5 py-4.5 text-left transition-opacity active:opacity-70"
                style={{ paddingTop: "18px", paddingBottom: "18px" }}
                data-testid={`button-legal-${i}`}
              >
                <IconBox>
                  <Icon className="w-5 h-5" style={{ color: "#111111" }} />
                </IconBox>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold" style={{ color: "#111111" }}>{label}</p>
                  <p className="text-[13px] mt-0.5" style={{ color: "#7d7d7d" }}>{sub}</p>
                </div>
                <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: "#cccccc" }} />
              </button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
