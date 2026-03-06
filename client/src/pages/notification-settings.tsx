import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Home, Bell, Mail, MessageSquare, Phone, Loader2 } from "lucide-react";

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

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#EAEFF5]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-10 h-10 rounded-full bg-[#F2F5F8] flex items-center justify-center hover:bg-[#EAEFF5] transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0066FF] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#1B2A4A] text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-[32px] font-[800] text-[#1B2A4A] tracking-[-0.03em] leading-[1.1]" data-testid="text-page-title">
            Meldingsinstellingen
          </h1>
          <p className="text-[15px] text-[#6B7280] mt-1">
            Kies hoe je op de hoogte gehouden wilt worden van nieuwe matches.
          </p>
        </div>

        {loadingSettings ? (
          <div className="flex items-center justify-center py-20" data-testid="loading-settings">
            <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <Card className="rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border-[#EAEFF5]">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="flex items-center gap-2 text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em]">
                  <Bell className="w-5 h-5" />
                  Kanalen
                </CardTitle>
                <CardDescription className="text-[15px] text-[#6B7280]">
                  Schakel meldingen in of uit per kanaal.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 p-6 pt-0">
                <div className="flex items-center justify-between gap-4" data-testid="setting-email">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#EDF2FF] flex items-center justify-center">
                      <Mail className="w-5 h-5 text-[#0066FF]" />
                    </div>
                    <div>
                      <Label className="text-[14px] font-semibold text-[#1B2A4A]">E-mail</Label>
                      <p className="text-[13px] text-[#6B7280]">Ontvang matches via e-mail</p>
                    </div>
                  </div>
                  <Switch
                    checked={emailEnabled}
                    onCheckedChange={setEmailEnabled}
                    data-testid="toggle-email"
                  />
                </div>

                <div className="border-t border-[#EAEFF5]" />

                <div className="flex items-center justify-between gap-4" data-testid="setting-sms">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <Label className="text-[14px] font-semibold text-[#1B2A4A]">SMS</Label>
                      <p className="text-[13px] text-[#6B7280]">Ontvang matches via SMS</p>
                    </div>
                  </div>
                  <Switch
                    checked={smsEnabled}
                    onCheckedChange={setSmsEnabled}
                    data-testid="toggle-sms"
                  />
                </div>

                <div className="border-t border-[#EAEFF5]" />

                <div className="flex items-center justify-between gap-4" data-testid="setting-whatsapp">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <Label className="text-[14px] font-semibold text-[#1B2A4A]">WhatsApp</Label>
                      <p className="text-[13px] text-[#6B7280]">Ontvang matches via WhatsApp</p>
                    </div>
                  </div>
                  <Switch
                    checked={whatsappEnabled}
                    onCheckedChange={setWhatsappEnabled}
                    data-testid="toggle-whatsapp"
                  />
                </div>
              </CardContent>
            </Card>

            {(smsEnabled || whatsappEnabled) && (
              <Card className="rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border-[#EAEFF5]" data-testid="card-phone">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="flex items-center gap-2 text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em]">
                    <Phone className="w-5 h-5" />
                    Telefoonnummer
                  </CardTitle>
                  <CardDescription className="text-[15px] text-[#6B7280]">
                    Nodig voor SMS en WhatsApp meldingen. Gebruik internationaal formaat.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="flex flex-col gap-2 max-w-sm">
                    <Label htmlFor="phone" className="text-[14px] font-semibold text-[#1B2A4A]">Telefoonnummer (E.164)</Label>
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
                      className="h-[52px] px-4 rounded-xl border-0 bg-[#F3F4F8] text-[15px] font-medium text-[#1B2A4A] placeholder:text-[#7A8599] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0066FF]/15 focus:bg-[#FAFBFC] transition-all"
                      data-testid="input-phone"
                    />
                    {phoneError && (
                      <p className="text-xs text-destructive" data-testid="text-phone-error">
                        {phoneError}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="h-[56px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[16px] font-semibold px-8"
                data-testid="button-save"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Opslaan
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="h-[48px] rounded-xl border-[#EAEFF5] text-[#1B2A4A] text-[15px] font-semibold"
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
