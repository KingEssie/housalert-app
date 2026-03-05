import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground text-lg tracking-tight">Stekkies</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-foreground mb-3">
              Vind jouw perfecte huurwoning
            </h1>
            <p className="text-muted-foreground text-base">
              Stel zoekopdrachten in en ontvang direct een melding als er iets beschikbaar komt.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
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
                      <Label htmlFor="login-email">E-mailadres</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="jouw@email.nl"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        data-testid="input-login-email"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="login-password">Wachtwoord</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        data-testid="input-login-password"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
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
                      <Label htmlFor="signup-email">E-mailadres</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="jouw@email.nl"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                        data-testid="input-signup-email"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="signup-password">Wachtwoord</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Minimaal 6 tekens"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        data-testid="input-signup-password"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={signupLoading}
                      data-testid="button-signup-submit"
                    >
                      {signupLoading ? "Account aanmaken..." : "Account aanmaken"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-muted-foreground text-sm mt-6">
            Door je aan te melden ga je akkoord met onze voorwaarden.
          </p>
        </div>
      </main>
    </div>
  );
}
