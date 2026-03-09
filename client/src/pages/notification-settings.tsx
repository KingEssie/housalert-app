import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MessageSquare, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ListSection, ListRow, ListDivider } from "@/components/list-section";

interface NotificationSettings {
  user_id: string;
  phone_e164: string | null;
  whatsapp_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
}

export default function NotificationSettingsPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);

  const [phoneInput, setPhoneInput] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [phoneError, setPhoneError] = useState("");

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
        setSettings(data);
        setPhoneInput(data.phone_e164 ?? "");
        setEmailEnabled(data.email_enabled);
        setSmsEnabled(data.sms_enabled);
        setWhatsappEnabled(data.whatsapp_enabled);
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

  const e164Regex = /^\+[1-9]\d{1,14}$/;

  function validatePhone(value: string): boolean {
    if (!value.trim()) {
      setPhoneError("");
      return true;
    }
    if (!e164Regex.test(value.trim())) {
      setPhoneError("Gebruik E.164 formaat, bijv. +31612345678");
      return false;
    }
    setPhoneError("");
    return true;
  }

  async function handleSave() {
    const phone = phoneInput.trim() || null;

    if (phone && !validatePhone(phone)) return;

    if ((smsEnabled || whatsappEnabled) && !phone) {
      setPhoneError("Telefoonnummer is verplicht voor SMS of WhatsApp");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/notifications/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_e164: phone,
          email_enabled: emailEnabled,
          sms_enabled: smsEnabled,
          whatsapp_enabled: whatsappEnabled,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Opslaan mislukt");
      }

      const updated = await res.json();
      setSettings(updated);
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
                title="SMS"
                subtitle="Ontvang matches via SMS"
                icon={<div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--yo-chip-bg)" }}><Phone className="w-[18px] h-[18px]" style={{ color: "var(--yo-dark)" }} /></div>}
                trailing={
                  <Switch
                    checked={smsEnabled}
                    onCheckedChange={setSmsEnabled}
                    data-testid="toggle-sms"
                  />
                }
                testId="setting-sms"
              />
              <ListDivider />
              <ListRow
                title="WhatsApp"
                subtitle="Ontvang matches via WhatsApp"
                icon={<div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--yo-chip-bg)" }}><MessageSquare className="w-[18px] h-[18px]" style={{ color: "var(--yo-dark)" }} /></div>}
                trailing={
                  <Switch
                    checked={whatsappEnabled}
                    onCheckedChange={setWhatsappEnabled}
                    data-testid="toggle-whatsapp"
                  />
                }
                testId="setting-whatsapp"
              />
            </ListSection>

            {(smsEnabled || whatsappEnabled) && (
              <ListSection title="Telefoonnummer">
                <div className="px-5 py-4" data-testid="card-phone">
                  <p className="text-row-subtitle mb-3">
                    Nodig voor SMS en WhatsApp meldingen. Gebruik internationaal formaat.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="phone" className="text-[14px] font-semibold" style={{ color: "var(--yo-dark)" }}>Telefoonnummer (E.164)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+31612345678"
                      value={phoneInput}
                      onChange={(e) => {
                        setPhoneInput(e.target.value);
                        if (phoneError) validatePhone(e.target.value);
                      }}
                      onBlur={() => validatePhone(phoneInput)}
                      className="h-[52px] px-4 rounded-lg border-0 bg-muted text-[15px] font-medium text-foreground placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/15 focus:bg-background transition-all"
                      data-testid="input-phone"
                    />
                    {phoneError && (
                      <p className="text-xs text-destructive" data-testid="text-phone-error">
                        {phoneError}
                      </p>
                    )}
                  </div>
                </div>
              </ListSection>
            )}

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
