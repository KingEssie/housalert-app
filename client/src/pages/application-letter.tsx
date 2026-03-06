import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { DEFAULT_TEMPLATE, PLACEHOLDERS } from "@/lib/application-letter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw, Save, Info } from "lucide-react";

interface ProfileData {
  application_template: string | null;
}

export default function ApplicationLetterPage() {
  const [, navigate] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const [template, setTemplate] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { data: profileData, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const res = await fetch("/api/profile-data", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!session?.access_token,
  });

  useEffect(() => {
    if (profileData && !initialized) {
      setTemplate(profileData.application_template || DEFAULT_TEMPLATE);
      setInitialized(true);
    }
  }, [profileData, initialized]);

  const saveMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/profile-data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ application_template: text }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      toast({ title: "Opgeslagen!", description: "Je aanmeldingsbrief is opgeslagen." });
    },
    onError: () => {
      toast({ title: "Fout", description: "Kon brief niet opslaan. Probeer het opnieuw.", variant: "destructive" });
    },
  });

  const handleReset = () => {
    setTemplate(DEFAULT_TEMPLATE);
    toast({ title: "Standaard brief hersteld", description: "Je kunt de brief nog aanpassen voor het opslaan." });
  };

  const isModified = template !== (profileData?.application_template || DEFAULT_TEMPLATE);
  const isLongEnough = template.trim().length >= 20;

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#EAEFF5]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-10 h-10 rounded-full bg-[#F2F5F8] flex items-center justify-center hover:bg-[#EAEFF5] transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 text-[#72839A]" />
          </button>
          <h1 className="text-[16px] font-semibold text-[#1B2A4A]">Aanmeldingsbrief</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-6 pb-32">
        <div className="flex flex-col gap-4">
          <div className="bg-[#EDF2FF] rounded-2xl p-6 flex gap-3">
            <Info className="w-5 h-5 text-[#0066FF] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] text-[#1B2A4A] font-semibold mb-1">Automatische invulling</p>
              <p className="text-[13px] text-[#72839A]">
                Gebruik onderstaande plaatsaanduidingen in je brief. Ze worden automatisch ingevuld wanneer je de brief kopieert vanuit een woning.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <h3 className="text-[14px] font-semibold text-[#1B2A4A] mb-3">Beschikbare plaatsaanduidingen</h3>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    const textarea = document.querySelector("[data-testid='input-template']") as HTMLTextAreaElement;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const before = template.slice(0, start);
                      const after = template.slice(end);
                      setTemplate(before + p.key + after);
                      setTimeout(() => {
                        textarea.focus();
                        textarea.setSelectionRange(start + p.key.length, start + p.key.length);
                      }, 0);
                    } else {
                      setTemplate(template + p.key);
                    }
                  }}
                  className="text-[11px] font-mono bg-[#F2F5F8] text-[#0066FF] px-2 py-1 rounded-md hover:bg-[#EDF2FF] transition-colors"
                  title={p.label}
                  data-testid={`placeholder-${p.key.replace(/\[|\]/g, "")}`}
                >
                  {p.key}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 animate-pulse">
              <div className="h-4 bg-[#F2F5F8] rounded w-32 mb-4" />
              <div className="h-48 bg-[#F2F5F8] rounded" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
              <div className="flex items-center justify-between gap-4 mb-3">
                <h3 className="text-[16px] font-semibold text-[#1B2A4A]">Je brief</h3>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-[13px] text-[#72839A] hover:text-[#0066FF] transition-colors"
                  data-testid="button-reset-template"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Standaard herstellen
                </button>
              </div>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full min-h-[300px] px-4 py-3 rounded-xl border border-[#EAEFF5] bg-[#F7F8FA] text-[15px] text-[#1B2A4A] placeholder:text-[#9BA5B7] focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF] focus:bg-white resize-y leading-relaxed transition-all"
                data-testid="input-template"
              />
              {!isLongEnough && (
                <p className="text-[12px] text-amber-600 mt-2">Minimaal 20 tekens nodig.</p>
              )}
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EAEFF5] p-5 z-10">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          <Button
            onClick={() => saveMutation.mutate(template)}
            disabled={!isLongEnough || saveMutation.isPending}
            className="w-full h-[56px] rounded-xl text-[16px] font-semibold bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-50 flex items-center gap-2"
            data-testid="button-save-template"
          >
            <Save className="w-4.5 h-4.5" />
            {saveMutation.isPending ? "Opslaan..." : "Brief opslaan"}
          </Button>
          {!profileData?.application_template && (
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate(DEFAULT_TEMPLATE)}
              disabled={saveMutation.isPending}
              className="w-full h-[48px] rounded-xl text-[15px] font-semibold border-[#EAEFF5] text-[#72839A]"
              data-testid="button-use-default"
            >
              Standaardbrief bevestigen en gebruiken
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
