import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const FIELD_CONFIG: Record<string, { question: string; label: string; type: string; placeholder: string; source: string }> = {
  first_name: { question: "Wat is je voornaam?", label: "Voornaam", type: "text", placeholder: "Bijv. Max", source: "profile" },
  last_name: { question: "Wat is je achternaam?", label: "Achternaam", type: "text", placeholder: "Bijv. Mustermann", source: "profile" },
  date_of_birth: { question: "Wat is je geboortedatum?", label: "Geboortedatum", type: "date", placeholder: "DD-MM-JJJJ", source: "profile" },
  phone: { question: "Wat is je telefoonnummer?", label: "Mobiele nummer", type: "tel", placeholder: "+49 170 1234567", source: "phone" },
};

export default function ProfileEditPage() {
  const [, params] = useRoute("/profile/edit/:field");
  const field = params?.field ?? "";
  const config = FIELD_CONFIG[field];

  const { session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.access_token || !config) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    if (config.source === "phone") {
      fetch("/api/notifications/settings", { headers })
        .then(r => r.json())
        .then(d => { setValue(d?.phone_e164 ?? ""); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      fetch("/api/profile-data", { headers })
        .then(r => r.json())
        .then(d => { setValue(d?.[field] ?? ""); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [session?.access_token, field]);

  if (!config) {
    navigate("/profile/details");
    return null;
  }

  async function handleSave() {
    if (!session?.access_token) return;
    setSaving(true);

    try {
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };

      if (config.source === "phone") {
        const res = await fetch("/api/notifications/settings", {
          method: "PUT",
          headers,
          body: JSON.stringify({ phone_e164: value.trim() || null }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Fout bij opslaan");
        }
        queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
      } else {
        const res = await fetch("/api/profile-data", {
          method: "PUT",
          headers,
          body: JSON.stringify({ [field]: value.trim() || null }),
        });
        if (!res.ok) throw new Error("Fout bij opslaan");
        queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      }

      toast({ title: "Opgeslagen" });
      navigate("/profile/details");
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white">
        <div className="max-w-lg mx-auto flex items-center h-14 px-5">
          <button
            onClick={() => navigate("/profile/details")}
            className="w-9 h-9 rounded-full flex items-center justify-center -ml-1"
            data-testid="button-close-edit"
          >
            <X className="w-5 h-5 text-[#111827]" />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <h1 className="text-[24px] font-bold text-[#111827] leading-tight" data-testid="heading-edit-field">
              {config.question}
            </h1>

            <input
              type={config.type}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={config.placeholder}
              className="w-full bg-[#F3F4F6] rounded-xl px-4 py-3.5 text-[16px] text-[#111827] placeholder:text-[#9CA3AF] border-0 outline-none focus:ring-2 focus:ring-[#673DE5] h-[52px]"
              data-testid="input-edit-field"
            />

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-[52px] rounded-xl bg-[#673DE5] hover:bg-[#5B30D6] text-white text-[15px] font-semibold"
              data-testid="button-save-field"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Opslaan"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
