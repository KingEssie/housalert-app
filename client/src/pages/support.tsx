import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-base";
import { logoSrc } from "@/components/housalert-logo";
import { ChevronLeft, ExternalLink, MessageSquare, CheckCircle, Send, ChevronRight } from "lucide-react";

const HELP_LINKS = [
  { label: "Hoe werkt HousAlert", url: "https://www.housalert.com/faq" },
];

const LEGAL_LINKS = [
  { label: "Algemene voorwaarden", url: "https://www.housalert.com/terms-of-service" },
  { label: "Privacybeleid", url: "https://www.housalert.com/privacy" },
];

export default function SupportPage() {
  const [, navigate] = useLocation();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!subject.trim() || !message.trim()) return;
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
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
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
      <div
        className="sticky top-0 z-20 flex items-center h-[60px] px-4"
        style={{ backgroundColor: "#f6f6f6", borderBottom: "1px solid #ebebeb" }}
      >
        <button
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate("/settings"); }}
          className="w-10 h-10 flex items-center justify-center rounded-full mr-3 flex-shrink-0"
          style={{ backgroundColor: "#ebebeb" }}
          data-testid="button-back"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "#111111" }} />
        </button>
        <img
          src={logoSrc}
          alt="HousAlert"
          className="object-contain"
          style={{ height: 20, width: "auto", filter: "brightness(0)" }}
        />
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-6 space-y-4 pb-16">
        <div className="pb-1">
          <h1 className="text-[26px] font-bold" style={{ color: "#111111" }}>Hoe kunnen we je helpen?</h1>
          <p className="text-[14px] mt-1" style={{ color: "#888888" }}>We staan voor je klaar.</p>
        </div>

        {/* Main support card */}
        <div
          className="bg-white rounded-[24px] p-5"
          style={{ border: "1px solid #e8e8e8", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#f0edfb" }}
            >
              <MessageSquare className="w-5 h-5" style={{ color: "#bbadfb" }} />
            </div>
            <div>
              <p className="text-[16px] font-bold" style={{ color: "#111111" }}>Stuur ons een bericht</p>
              <p className="text-[13px]" style={{ color: "#888888" }}>Ons team helpt je zo snel mogelijk verder.</p>
            </div>
          </div>

          {sent ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#edfbf0" }}
              >
                <CheckCircle className="w-7 h-7" style={{ color: "#16a34a" }} />
              </div>
              <p className="text-[16px] font-bold text-center" style={{ color: "#111111" }}>Bericht verzonden!</p>
              <p className="text-[13px] text-center" style={{ color: "#888888" }}>
                Ons team helpt je zo snel mogelijk verder.
              </p>
              <button
                onClick={() => { setSent(false); setSubject(""); setMessage(""); }}
                className="text-[13px] font-medium mt-1"
                style={{ color: "#bbadfb" }}
                data-testid="button-send-another"
              >
                Nog een bericht sturen
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Onderwerp"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-[14px] text-[14px] outline-none"
                style={{ backgroundColor: "#f6f6f6", border: "1px solid #e8e8e8", color: "#111111" }}
                data-testid="input-subject"
              />
              <textarea
                placeholder="Vertel ons wat er aan de hand is..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-[14px] text-[14px] outline-none resize-none"
                style={{ backgroundColor: "#f6f6f6", border: "1px solid #e8e8e8", color: "#111111" }}
                data-testid="input-message"
              />
              {error && (
                <p className="text-[12px]" style={{ color: "#e11d48" }} data-testid="text-error">
                  {error}
                </p>
              )}
              <button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !message.trim()}
                className="w-full py-3.5 rounded-full text-[15px] font-bold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#85fb8c", color: "#111111" }}
                data-testid="button-send"
              >
                <Send className="w-4 h-4" />
                {sending ? "Verzenden..." : "Verstuur bericht"}
              </button>
            </div>
          )}
        </div>

        {/* Help links */}
        <div
          className="bg-white rounded-[24px] overflow-hidden"
          style={{ border: "1px solid #e8e8e8", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          {HELP_LINKS.map((link, i) => (
            <button
              key={i}
              onClick={() => window.open(link.url, "_blank")}
              className="w-full flex items-center gap-3 py-[15px] px-5 text-left transition-colors"
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "")}
              data-testid={`button-help-${i}`}
            >
              <p className="text-[15px] font-semibold flex-1" style={{ color: "#111111" }}>{link.label}</p>
              <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: "#aaaaaa" }} />
            </button>
          ))}
        </div>

        {/* WhatsApp — secondary/fallback */}
        <div className="px-1 pt-1">
          <p className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#aaaaaa" }}>
            Liever WhatsApp?
          </p>
          <button
            onClick={() => window.open("https://wa.me/", "_blank")}
            className="w-full bg-white rounded-[24px] px-5 py-4 flex items-center gap-3 text-left active:opacity-80 transition-opacity"
            style={{ border: "1px solid #e8e8e8", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            data-testid="button-whatsapp"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#e8f8ef" }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M11.984 2C6.465 2 2 6.465 2 11.984a9.96 9.96 0 001.376 5.022L2 22l5.12-1.345A9.964 9.964 0 0011.984 22C17.503 22 22 17.535 22 12.016 22 6.497 17.503 2 11.984 2zm0 18.125a8.14 8.14 0 01-4.134-1.126l-.296-.175-3.04.798.812-2.96-.193-.305A8.14 8.14 0 013.875 12c0-4.472 3.637-8.109 8.109-8.109 4.471 0 8.109 3.637 8.109 8.109 0 4.471-3.638 8.125-8.109 8.125z" />
              </svg>
            </div>
            <p className="text-[14px] font-semibold flex-1" style={{ color: "#111111" }}>
              Stuur ons een bericht
            </p>
            <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: "#aaaaaa" }} />
          </button>
        </div>

        {/* Legal links — bottom */}
        <div
          className="bg-white rounded-[24px] overflow-hidden"
          style={{ border: "1px solid #e8e8e8", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          {LEGAL_LINKS.map((link, i) => (
            <div key={i}>
              {i > 0 && <div className="h-px mx-5" style={{ backgroundColor: "#f0f0f0" }} />}
              <button
                onClick={() => window.open(link.url, "_blank")}
                className="w-full flex items-center gap-3 py-[14px] px-5 text-left transition-colors"
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "")}
                data-testid={`button-legal-${i}`}
              >
                <p className="text-[14px] flex-1" style={{ color: "#555555" }}>{link.label}</p>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#cccccc" }} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
