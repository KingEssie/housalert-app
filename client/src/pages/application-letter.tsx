import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { DEFAULT_TEMPLATE, PLACEHOLDERS } from "@/lib/application-letter";
import { Button } from "@/components/ui/button";
import { RotateCcw, Save, Info, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

interface ProfileData {
  application_template: string | null;
  occupation?: string | null;
  monthly_income?: number | null;
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
  const missingFields = !profileData?.occupation || profileData?.monthly_income == null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageHeader title="Aanmeldingsbrief" onBack={() => navigate("/dashboard?tab=profiel")} />

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-6 pb-32">
        <div className="flex flex-col gap-4">
          {missingFields && !isLoading && (
            <button
              onClick={() => navigate("/profile/details")}
              className="w-full bg-[#FFF8E1] dark:bg-[#3D3520] rounded-2xl p-5 flex gap-3 text-left"
              data-testid="banner-missing-fields"
            >
              <AlertTriangle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-semibold mb-0.5" style={{ color: "var(--yo-dark)" }}>Gegevens ontbreken</p>
                <p className="text-[13px]" style={{ color: "var(--yo-muted)" }}>
                  Vul eerst je beroep en inkomen in zodat je brief automatisch kan worden ingevuld.
                </p>
              </div>
            </button>
          )}

          <div className="rounded-2xl p-6 flex gap-3" style={{ backgroundColor: "var(--yo-teal-light)" }}>
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--yo-teal)" }} />
            <div>
              <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--yo-dark)" }}>Automatische invulling</p>
              <p className="text-[13px]" style={{ color: "var(--yo-muted)" }}>
                Gebruik onderstaande plaatsaanduidingen in je brief. Ze worden automatisch ingevuld wanneer je de brief kopieert vanuit een woning.
              </p>
            </div>
          </div>

          <div className="bg-card rounded-2xl shadow-sm p-6">
            <h3 className="text-[16px] font-[700] mb-3" style={{ color: "var(--yo-dark)" }}>Beschikbare plaatsaanduidingen</h3>
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
                  className="text-[11px] font-mono bg-muted px-2 py-1 rounded-md hover-elevate transition-colors"
                  style={{ color: "var(--yo-teal)" }}
                  title={p.label}
                  data-testid={`placeholder-${p.key.replace(/\[|\]/g, "")}`}
                >
                  {p.key}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="bg-card rounded-2xl shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-32 mb-4" />
              <div className="h-48 bg-muted rounded" />
            </div>
          ) : (
            <div className="bg-card rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between gap-4 mb-3">
                <h3 className="text-[16px] font-semibold" style={{ color: "var(--yo-dark)" }}>Je brief</h3>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-[13px] transition-colors"
                  style={{ color: "var(--yo-muted)" }}
                  data-testid="button-reset-template"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Standaard herstellen
                </button>
              </div>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full min-h-[300px] px-4 py-4 rounded-xl border-0 bg-muted text-[15px] font-medium text-foreground placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/15 focus:bg-background resize-y leading-relaxed transition-all"
                data-testid="input-template"
              />
              {!isLongEnough && (
                <p className="text-[12px] mt-2" style={{ color: "var(--yo-teal)" }}>Minimaal 20 tekens nodig.</p>
              )}
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-5 z-10" style={{ borderColor: "var(--yo-divider)" }}>
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          <Button
            onClick={() => saveMutation.mutate(template)}
            disabled={!isLongEnough || saveMutation.isPending}
            className="w-full h-[56px] rounded-xl text-[16px] font-semibold bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-2"
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
              className="w-full h-[48px] rounded-xl text-[15px] font-semibold"
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
