import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { createSearchProfile, getSearchProfiles } from "@/lib/search-profiles";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Home, AlertCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

const MAX_PROFILES = 4;

const BEDROOM_OPTIONS = [
  { value: "0", label: "Studio+" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
];

export default function NewSearchPage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [city, setCity] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [bedroomsMin, setBedroomsMin] = useState("0");
  const [sizeMin, setSizeMin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const profilesQuery = useQuery({
    queryKey: ["/search-profiles"],
    queryFn: getSearchProfiles,
    enabled: !!user,
  });

  const profileCount = profilesQuery.data?.length ?? 0;
  const atLimit = profileCount >= MAX_PROFILES;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary animate-pulse" />
          <p className="text-muted-foreground text-sm">Laden...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (atLimit) {
      toast({
        title: "Limiet bereikt",
        description: `Je kunt maximaal ${MAX_PROFILES} zoekopdrachten hebben.`,
        variant: "destructive",
      });
      return;
    }

    if (!city.trim()) {
      toast({ title: "Stad is verplicht", variant: "destructive" });
      return;
    }

    const parsedPriceMin = parseInt(priceMin) || 0;
    const parsedPriceMax = parseInt(priceMax) || 0;
    const parsedSizeMin = parseInt(sizeMin) || 0;

    if (parsedPriceMax > 0 && parsedPriceMin > parsedPriceMax) {
      toast({ title: "Min prijs kan niet hoger zijn dan max prijs", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      const profile = await createSearchProfile({
        user_id: user!.id,
        city: city.trim(),
        price_min: parsedPriceMin,
        price_max: parsedPriceMax,
        bedrooms_min: parseInt(bedroomsMin),
        size_min: parsedSizeMin,
      });

      if (profile?.id) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          fetch("/api/search-profiles/backfill", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ searchProfileId: profile.id }),
          }).catch(() => {});
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });

      toast({ title: "Zoekopdracht aangemaakt" });
      navigate("/dashboard");
    } catch (err: any) {
      toast({
        title: "Opslaan mislukt",
        description: err?.message ?? "Probeer het opnieuw.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground text-lg tracking-tight">Stekkies</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 py-10">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 hover-elevate active-elevate-2 rounded-md px-2 py-1 -ml-2"
          data-testid="button-back-dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar dashboard
        </button>

        {atLimit ? (
          <Card>
            <CardContent className="py-10">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">Limiet bereikt</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Je hebt al {MAX_PROFILES} zoekopdrachten. Verwijder eerst een bestaande
                    zoekopdracht om een nieuwe aan te maken.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                  data-testid="button-back-to-dashboard-limit"
                >
                  Terug naar dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Nieuwe zoekopdracht</CardTitle>
              <CardDescription>
                Stel je zoekcriteria in. Je krijgt een melding zodra er een match is.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="city">Stad</Label>
                  <Input
                    id="city"
                    placeholder="Bijv. Amsterdam, Utrecht, Rotterdam"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    data-testid="input-city"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="price-min">Min prijs (&euro;)</Label>
                    <Input
                      id="price-min"
                      type="number"
                      placeholder="0"
                      min="0"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      data-testid="input-price-min"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="price-max">Max prijs (&euro;)</Label>
                    <Input
                      id="price-max"
                      type="number"
                      placeholder="2000"
                      min="0"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      data-testid="input-price-max"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="bedrooms-min">Min slaapkamers</Label>
                    <Select value={bedroomsMin} onValueChange={setBedroomsMin}>
                      <SelectTrigger id="bedrooms-min" data-testid="select-bedrooms-min">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BEDROOM_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="size-min">Min oppervlakte (m&sup2;)</Label>
                    <Input
                      id="size-min"
                      type="number"
                      placeholder="0"
                      min="0"
                      value={sizeMin}
                      onChange={(e) => setSizeMin(e.target.value)}
                      data-testid="input-size-min"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate("/dashboard")}
                    data-testid="button-cancel"
                  >
                    Annuleren
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={submitting}
                    data-testid="button-save-search"
                  >
                    {submitting ? "Opslaan..." : "Opslaan"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
