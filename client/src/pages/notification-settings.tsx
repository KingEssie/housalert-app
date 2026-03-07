import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Home, Mail, Phone, MessageSquare, Loader2 } from "lucide-react";
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
      .then((res) => res.json())
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
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto px-5 h-[56px] flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard?tab=profiel")}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] flex items-center justify-center active:bg-[#E5E7EB] transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#673DE5] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#111827] text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-page-title" data-testid="text-page-title">
            Meldingsinstellingen
          </h1>
          <p className="text-subtitle mt-1">
            Kies hoe je op de hoogte gehouden wilt worden van nieuwe matches.
          </p>
        </div>

        {loadingSettings ? (
          <div className="flex items-center justify-center py-20" data-testid="loading-settings">
            <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <ListSection title="Kanalen">
              <ListRow
                title="E-mail"
                subtitle="Ontvang matches via e-mail"
                icon={<div className="w-10 h-10 rounded-full bg-[#DCDBFA] flex items-center justify-center"><Mail className="w-[18px] h-[18px] text-[#673DE5]" /></div>}
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
                icon={<div className="w-10 h-10 rounded-full bg-[#DCDBFA] flex items-center justify-center"><Phone className="w-[18px] h-[18px] text-[#673DE5]" /></div>}
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
                icon={<div className="w-10 h-10 rounded-full bg-[#DCDBFA] flex items-center justify-center"><MessageSquare className="w-[18px] h-[18px] text-[#673DE5]" /></div>}
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
                    <Label htmlFor="phone" className="text-[14px] font-semibold text-[#111827]">Telefoonnummer (E.164)</Label>
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
                      className="h-[52px] px-4 rounded-xl border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#111827] placeholder:text-[#9CA3AF] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#673DE5]/15 focus:bg-[#F8FAFC] transition-all"
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
                className="h-[52px] rounded-xl bg-[#673DE5] hover:bg-[#5B30D6] text-white text-[15px] font-semibold px-8"
                data-testid="button-save"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Opslaan
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard?tab=profiel")}
                className="h-[48px] rounded-xl border-[#E5E7EB] text-[#111827] text-[15px] font-semibold"
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
