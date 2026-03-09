import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Mail, Bell, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ListSection, ListRow, ListDivider } from "@/components/list-section";

interface NotificationSettings {
  user_id: string;
  email_enabled: boolean;
}

export default function NotificationSettingsPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    if (!session?.access_token) return;
    setLoadingSettings(true);
    fetch("/api/notifications/settings", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then((data: NotificationSettings) => {
        setEmailEnabled(data.email_enabled);
      })
      .catch(() => {
        toast({
          title: "Fout bij laden",
          description: "Kon instellingen niet laden. Probeer het opnieuw.",
          variant: "destructive",
        });
      })
      .finally(() => setLoadingSettings(false));
  }, [session?.access_token]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/notifications/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_enabled: emailEnabled,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Opslaan mislukt");
      }

      toast({
        title: "Opgeslagen",
        description: "Je meldingsinstellingen zijn bijgewerkt.",
      });
    } catch (err: any) {
      toast({
        title: "Fout",
        description: err.message || "Kon instellingen niet opslaan.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageHeader title="Meldingsinstellingen" onBack={() => navigate("/dashboard?tab=profiel&sub=account")} />

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pb-6 flex flex-col gap-6">
        <div>
          <p className="text-subtitle">
            Kies hoe je op de hoogte gehouden wilt worden van nieuwe matches.
          </p>
        </div>

        {loadingSettings ? (
          <div className="flex items-center justify-center py-20" data-testid="loading-settings">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <ListSection title="Kanalen">
              <ListRow
                title="E-mail"
                subtitle="Ontvang matches via e-mail"
                icon={<div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--yo-chip-bg)" }}><Mail className="w-[18px] h-[18px]" style={{ color: "var(--yo-dark)" }} /></div>}
                trailing={
                  <Switch
                    checked={emailEnabled}
                    onCheckedChange={setEmailEnabled}
                    data-testid="toggle-email"
                  />
                }
                testId="setting-email"
              />
              <ListDivider />
              <ListRow
                title="Pushmeldingen"
                subtitle="Binnenkort beschikbaar"
                icon={<div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--yo-chip-bg)" }}><Bell className="w-[18px] h-[18px]" style={{ color: "var(--yo-dark)" }} /></div>}
                trailing={
                  <Switch
                    checked={pushEnabled}
                    onCheckedChange={setPushEnabled}
                    disabled={true}
                    data-testid="toggle-push"
                  />
                }
                testId="setting-push"
              />
            </ListSection>

            <div className="flex items-center gap-3 px-5">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="h-[52px] rounded-lg bg-primary text-primary-foreground text-[15px] font-semibold px-8"
                data-testid="button-save"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Opslaan
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard?tab=profiel&sub=account")}
                className="h-[48px] rounded-lg text-[15px] font-semibold"
                data-testid="button-cancel"
              >
                Annuleren
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
