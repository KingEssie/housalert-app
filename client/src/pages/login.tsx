import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Home } from "lucide-react";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoginLoading(false);
    if (error) {
      toast({ title: "Inloggen mislukt", description: error.message, variant: "destructive" });
    } else {
      navigate("/dashboard");
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
    });
    setSignupLoading(false);
    if (error) {
      toast({ title: "Aanmaken mislukt", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Account aangemaakt",
        description: "Controleer je e-mail om je account te bevestigen.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#EAEFF5]">
        <div className="max-w-5xl mx-auto px-6 h-[60px] flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0066FF] flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-[#1B2A4A] text-lg tracking-tight">Stekkies</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h1 className="text-[32px] font-[800] text-[#1B2A4A] tracking-[-0.03em] leading-[1.1] mb-4">
              Vind jouw perfecte huurwoning
            </h1>
            <p className="text-[15px] text-[#72839A]">
              Stel zoekopdrachten in en ontvang direct een melding als er iets beschikbaar komt.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <Tabs defaultValue="login">
              <TabsList className="w-full mb-6" data-testid="tabs-auth">
                <TabsTrigger value="login" className="flex-1" data-testid="tab-login">
                  Inloggen
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1" data-testid="tab-signup">
                  Account aanmaken
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="login-email" className="text-[14px] font-semibold text-[#1B2A4A]">E-mailadres</Label>
                    <input
                      id="login-email"
                      type="email"
                      placeholder="jouw@email.nl"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="h-[52px] px-4 rounded-xl border-0 bg-[#F3F4F8] text-[15px] font-medium text-[#1B2A4A] placeholder:text-[#7A8599] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0066FF]/15 focus:bg-[#FAFBFC] transition-all"
                      data-testid="input-login-email"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="login-password" className="text-[14px] font-semibold text-[#1B2A4A]">Wachtwoord</Label>
                    <input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="h-[52px] px-4 rounded-xl border-0 bg-[#F3F4F8] text-[15px] font-medium text-[#1B2A4A] placeholder:text-[#7A8599] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0066FF]/15 focus:bg-[#FAFBFC] transition-all"
                      data-testid="input-login-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-[56px] rounded-xl text-[16px] font-semibold bg-[#0066FF] hover:bg-[#0052CC]"
                    disabled={loginLoading}
                    data-testid="button-login-submit"
                  >
                    {loginLoading ? "Inloggen..." : "Inloggen"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="signup-email" className="text-[14px] font-semibold text-[#1B2A4A]">E-mailadres</Label>
                    <input
                      id="signup-email"
                      type="email"
                      placeholder="jouw@email.nl"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      className="h-[52px] px-4 rounded-xl border-0 bg-[#F3F4F8] text-[15px] font-medium text-[#1B2A4A] placeholder:text-[#7A8599] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0066FF]/15 focus:bg-[#FAFBFC] transition-all"
                      data-testid="input-signup-email"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="signup-password" className="text-[14px] font-semibold text-[#1B2A4A]">Wachtwoord</Label>
                    <input
                      id="signup-password"
                      type="password"
                      placeholder="Minimaal 6 tekens"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      className="h-[52px] px-4 rounded-xl border-0 bg-[#F3F4F8] text-[15px] font-medium text-[#1B2A4A] placeholder:text-[#7A8599] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0066FF]/15 focus:bg-[#FAFBFC] transition-all"
                      data-testid="input-signup-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-[56px] rounded-xl text-[16px] font-semibold bg-[#0066FF] hover:bg-[#0052CC]"
                    disabled={signupLoading}
                    data-testid="button-signup-submit"
                  >
                    {signupLoading ? "Account aanmaken..." : "Account aanmaken"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          <p className="text-center text-[13px] text-[#9BA5B7] mt-6">
            Door je aan te melden ga je akkoord met onze voorwaarden.
          </p>
        </div>
      </main>
    </div>
  );
}
