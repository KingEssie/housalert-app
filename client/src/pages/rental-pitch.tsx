import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Sparkles, Copy, RefreshCw, Loader2, Check } from "lucide-react";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";

export default function RentalPitchPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState("");
  const [age, setAge] = useState("");
  const [job, setJob] = useState("");
  const [income, setIncome] = useState("");
  const [city, setCity] = useState("");
  const [motivation, setMotivation] = useState("");

  const [generatedText, setGeneratedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const accessToken = (window as any).__supabaseAccessToken || localStorage.getItem("sb-access-token") || "";

  const canGenerate = firstName.trim() && age.trim() && job.trim() && income.trim() && city.trim();

  async function handleGenerate() {
    if (!canGenerate) return;
    setIsGenerating(true);
    setGeneratedText("");
    setCopied(false);

    try {
      const res = await apiFetch("/api/generate-rental-pitch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ firstName, age, job, income, city, motivation }),
      });

      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setGeneratedText(data.text);
    } catch {
      toast({ title: "Er ging iets mis", description: "Probeer het opnieuw.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      toast({ title: "Gekopieerd!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Kopiëren mislukt", variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col" data-testid="page-rental-pitch">
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3 px-5 h-[56px]">
          <button
            onClick={() => navigate("/home")}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F4F4F5] transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 text-[#111111]" />
          </button>
          <h1 className="text-[17px] font-semibold text-[#111111]" data-testid="text-page-title">Huurpitch Generator</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-6">

          {!generatedText && (
            <>
              <div className="text-center">
                <div className="mb-4">
                  <Sparkles className="w-10 h-10 text-ha-primary mx-auto" strokeWidth={1.5} />
                </div>
                <h2 className="text-[20px] font-semibold text-[#111111] mb-2" data-testid="text-pitch-heading">Genereer je huurpitch</h2>
                <p className="text-[14px] text-[#6B7280] leading-relaxed max-w-[320px] mx-auto">
                  Vul je gegevens in en wij maken een sterke Mietbewerbung die je direct kunt gebruiken.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <InputField label="Voornaam" value={firstName} onChange={setFirstName} placeholder="Jan" testId="input-first-name" />
                <InputField label="Leeftijd" value={age} onChange={setAge} placeholder="28" type="number" testId="input-age" />
                <InputField label="Beroep" value={job} onChange={setJob} placeholder="Software Engineer" testId="input-job" />
                <InputField label="Netto maandinkomen" value={income} onChange={setIncome} placeholder="€3.200" testId="input-income" />
                <InputField label="Stad" value={city} onChange={setCity} placeholder="München" testId="input-city" />
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Motivatie (optioneel)</label>
                  <textarea
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    placeholder="Ik zoek een rustige woning dicht bij mijn werk..."
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-[15px] text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-ha-primary/20 focus:border-ha-primary transition-all resize-none"
                    rows={3}
                    data-testid="input-motivation"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
                className="w-full h-[52px] rounded-full bg-ha-primary text-white text-[15px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(217,26,104,0.18)]"
                data-testid="button-generate"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Bezig met genereren...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Genereer mijn huurpitch
                  </>
                )}
              </button>
            </>
          )}

          {generatedText && (
            <>
              <div className="text-center">
                <h2 className="text-[20px] font-semibold text-[#111111] mb-1" data-testid="text-result-heading">Je huurpitch is klaar</h2>
                <p className="text-[14px] text-[#6B7280]">Kopieer de tekst en gebruik hem bij je volgende reactie.</p>
              </div>

              <div className="rounded-2xl bg-white border border-[#E5E7EB] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5" data-testid="card-generated-pitch">
                <p className="text-[15px] text-[#111111] leading-relaxed whitespace-pre-wrap">{generatedText}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 h-[48px] rounded-full bg-[#111111] text-white text-[14px] font-semibold hover:bg-[#333333] active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                  data-testid="button-copy"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Gekopieerd!" : "Kopieer tekst"}
                </button>
                <button
                  onClick={() => { setGeneratedText(""); setCopied(false); }}
                  className="h-[48px] px-5 rounded-full border border-[#E5E7EB] text-[14px] font-semibold text-[#111111] hover:bg-[#F9FAFB] active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                  data-testid="button-regenerate"
                >
                  <RefreshCw className="w-4 h-4" />
                  Opnieuw
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text", testId }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  testId: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[#374151] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-[48px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-ha-primary/20 focus:border-ha-primary transition-all"
        data-testid={testId}
      />
    </div>
  );
}
