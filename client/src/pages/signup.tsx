import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Home, ChevronLeft, User, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);

  const city = params.get("city") || "";
  const minPrice = params.get("minPrice") || "";
  const maxPrice = params.get("maxPrice") || "";
  const minRooms = params.get("minRooms") || "";
  const minSize = params.get("minSize") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
        },
      });

      if (error) {
        toast({ title: "Aanmaken mislukt", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (data.user && city) {
        try {
          await supabase.from("search_profiles").insert({
            user_id: data.user.id,
            city,
            price_min: minPrice ? parseInt(minPrice) : 0,
            price_max: maxPrice ? parseInt(maxPrice) : 0,
            bedrooms_min: minRooms && minRooms !== "any" ? parseInt(minRooms) : 0,
            size_min: minSize ? parseInt(minSize) : 0,
          });
        } catch {
        }
      }

      const p = new URLSearchParams(searchString);
      navigate(`/paywall?${p.toString()}`);
    } catch (err: any) {
      toast({ title: "Er ging iets mis", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    const p = new URLSearchParams();
    p.set("city", city);
    if (minPrice) p.set("minPrice", minPrice);
    if (maxPrice) p.set("maxPrice", maxPrice);
    if (minRooms) p.set("minRooms", minRooms);
    if (minSize) p.set("minSize", minSize);
    navigate(`/onboarding/estimate?${p.toString()}`);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[#F2F4F7] transition-colors"
            data-testid="button-back-estimate"
          >
            <ChevronLeft className="w-5 h-5 text-[#6B7280]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1D6FE8] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#0B1F44] text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-10 pb-12">
        <div className="text-center mb-8">
          <h1 className="text-[26px] font-extrabold text-[#0B1F44] mb-2" data-testid="text-signup-title">
            Maak je account aan
          </h1>
          <p className="text-[15px] text-[#6B7280]">
            Ontvang direct meldingen voor nieuwe woningen{city ? <> in <span className="font-semibold text-[#0B1F44]">{city}</span></> : ""}.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.06)] p-6">
          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#0B1F44]">Naam</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#6B7280]" />
                <Input
                  type="text"
                  placeholder="Je volledige naam"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-13 pl-11 rounded-xl text-[15px] bg-[#F2F4F7] border-transparent focus:border-[#1D6FE8] focus:bg-white transition-colors"
                  data-testid="input-signup-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#0B1F44]">E-mailadres</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#6B7280]" />
                <Input
                  type="email"
                  placeholder="jouw@email.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-13 pl-11 rounded-xl text-[15px] bg-[#F2F4F7] border-transparent focus:border-[#1D6FE8] focus:bg-white transition-colors"
                  data-testid="input-signup-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#0B1F44]">Wachtwoord</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#6B7280]" />
                <Input
                  type="password"
                  placeholder="Minimaal 6 tekens"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-13 pl-11 rounded-xl text-[15px] bg-[#F2F4F7] border-transparent focus:border-[#1D6FE8] focus:bg-white transition-colors"
                  data-testid="input-signup-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-[52px] rounded-xl text-[16px] font-semibold shadow-none bg-[#1D6FE8] hover:bg-[#165DD0] mt-1"
              disabled={loading || !email || !password}
              data-testid="button-signup-submit"
            >
              {loading ? "Account aanmaken..." : "Stuur me alle woningen"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-[#6B7280] mt-6">
          Heb je al een account?{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-[#1D6FE8] font-semibold hover:underline"
            data-testid="link-login"
          >
            Inloggen
          </button>
        </p>

        <p className="text-center text-xs text-[#6B7280] mt-4 opacity-60">
          Door je aan te melden ga je akkoord met onze voorwaarden.
        </p>
      </main>
    </div>
  );
}
