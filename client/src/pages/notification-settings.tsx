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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground text-lg tracking-tight">Stekkies</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-user-email">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {userInitial}
              </div>
              <span className="hidden sm:inline">{user?.email}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
              Meldingsinstellingen
            </h1>
            <p className="text-muted-foreground text-sm">
              Kies hoe je op de hoogte gehouden wilt worden van nieuwe matches.
            </p>
          </div>
        </div>

        {loadingSettings ? (
          <div className="flex items-center justify-center py-20" data-testid="loading-settings">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bell className="w-5 h-5" />
                  Kanalen
                </CardTitle>
                <CardDescription>
                  Schakel meldingen in of uit per kanaal.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex items-center justify-between gap-4" data-testid="setting-email">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">E-mail</Label>
                      <p className="text-xs text-muted-foreground">Ontvang matches via e-mail</p>
                    </div>
                  </div>
                  <Switch
                    checked={emailEnabled}
                    onCheckedChange={setEmailEnabled}
                    data-testid="toggle-email"
                  />
                </div>

                <div className="border-t border-border" />

                <div className="flex items-center justify-between gap-4" data-testid="setting-sms">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">SMS</Label>
                      <p className="text-xs text-muted-foreground">Ontvang matches via SMS</p>
                    </div>
                  </div>
                  <Switch
                    checked={smsEnabled}
                    onCheckedChange={setSmsEnabled}
                    data-testid="toggle-sms"
                  />
                </div>

                <div className="border-t border-border" />

                <div className="flex items-center justify-between gap-4" data-testid="setting-whatsapp">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">WhatsApp</Label>
                      <p className="text-xs text-muted-foreground">Ontvang matches via WhatsApp</p>
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
              <Card data-testid="card-phone">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Phone className="w-5 h-5" />
                    Telefoonnummer
                  </CardTitle>
                  <CardDescription>
                    Nodig voor SMS en WhatsApp meldingen. Gebruik internationaal formaat.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2 max-w-sm">
                    <Label htmlFor="phone">Telefoonnummer (E.164)</Label>
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
                data-testid="button-save"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Opslaan
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard")}
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
