import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getSearchProfiles, deleteSearchProfile, type SearchProfile } from "@/lib/search-profiles";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Home, Bell, Plus, Search, LogOut, MapPin, Trash2, Euro, BedDouble, Ruler } from "lucide-react";

const MAX_PROFILES = 4;

function bedroomLabel(min: number) {
  if (min === 0) return "Studio+";
  return `${min}+`;
}

function ProfileCard({
  profile,
  onDelete,
  deleting,
}: {
  profile: SearchProfile;
  onDelete: () => void;
  deleting: boolean;
}) {
  const filters: string[] = [];
  if (profile.price_min || profile.price_max) {
    const parts = [];
    if (profile.price_min) parts.push(`\u20AC${profile.price_min}`);
    if (profile.price_max) parts.push(`\u20AC${profile.price_max}`);
    filters.push(parts.join(" \u2013 "));
  }

  return (
    <div
      className="border border-border rounded-md p-4 flex flex-col gap-3"
      data-testid={`card-profile-${profile.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold text-foreground">{profile.city}</p>
          <p className="text-xs text-muted-foreground">
            Aangemaakt op{" "}
            {new Date(profile.created_at).toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={deleting}
          data-testid={`button-delete-${profile.id}`}
        >
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(profile.price_min > 0 || profile.price_max > 0) && (
          <Badge variant="secondary">
            <Euro className="w-3 h-3 mr-1" />
            {profile.price_min > 0 && profile.price_max > 0
              ? `${profile.price_min} \u2013 ${profile.price_max}`
              : profile.price_min > 0
              ? `Vanaf ${profile.price_min}`
              : `Tot ${profile.price_max}`}
          </Badge>
        )}
        <Badge variant="secondary">
          <BedDouble className="w-3 h-3 mr-1" />
          {bedroomLabel(profile.bedrooms_min)}
        </Badge>
        {profile.size_min > 0 && (
          <Badge variant="secondary">
            <Ruler className="w-3 h-3 mr-1" />
            {profile.size_min}+ m&sup2;
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  const profilesQuery = useQuery<SearchProfile[]>({
    queryKey: ["/search-profiles"],
    queryFn: getSearchProfiles,
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSearchProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
      toast({ title: "Zoekopdracht verwijderd" });
    },
    onError: (err: any) => {
      toast({
        title: "Verwijderen mislukt",
        description: err?.message ?? "Probeer het opnieuw.",
        variant: "destructive",
      });
    },
    onSettled: () => setDeletingId(null),
  });

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    deleteMutation.mutate(id);
  }

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

  if (!user) return null;

  const userInitial = user.email?.[0]?.toUpperCase() ?? "?";
  const profiles = profilesQuery.data ?? [];
  const profileCount = profiles.length;
  const atLimit = profileCount >= MAX_PROFILES;

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
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              data-testid="text-user-email"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {userInitial}
              </div>
              <span className="hidden sm:inline">{user.email}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              Uitloggen
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1" data-testid="text-greeting">
            Goedendag!
          </h1>
          <p className="text-muted-foreground">
            Hier vind je al je zoekopdrachten en nieuwe matches.
          </p>
        </div>

        <section data-testid="section-searches">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base font-semibold">Zoekopdrachten</CardTitle>
                  <Badge variant="secondary" data-testid="badge-searches-count">
                    {profileCount} van {MAX_PROFILES} actief
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Je kunt maximaal {MAX_PROFILES} zoekopdrachten tegelijk actief hebben.
                </p>
              </div>
              <Button
                size="sm"
                disabled={atLimit}
                onClick={() => navigate("/dashboard/searches/new")}
                data-testid="button-add-search"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Zoekopdracht toevoegen
              </Button>
            </CardHeader>
            <CardContent>
              {profilesQuery.isLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="border border-border rounded-md p-4 animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                      <div className="flex gap-2">
                        <div className="h-5 bg-muted rounded w-20" />
                        <div className="h-5 bg-muted rounded w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : profilesQuery.isError ? (
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                    <Search className="w-6 h-6 text-destructive" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">Kon zoekopdrachten niet laden</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Er is iets misgegaan. Controleer je verbinding en probeer het opnieuw.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => profilesQuery.refetch()}
                    data-testid="button-retry-profiles"
                  >
                    Opnieuw proberen
                  </Button>
                </div>
              ) : profiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <Search className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">Geen zoekopdrachten</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Voeg een zoekopdracht toe om automatisch op de hoogte te worden gebracht van
                      nieuwe huurwoningen.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/dashboard/searches/new")}
                    data-testid="button-add-search-empty"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Eerste zoekopdracht aanmaken
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {profiles.map((p) => (
                    <ProfileCard
                      key={p.id}
                      profile={p}
                      onDelete={() => handleDelete(p.id)}
                      deleting={deletingId === p.id}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section data-testid="section-matches">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base font-semibold">Nieuwe matches</CardTitle>
                  <Badge variant="secondary" data-testid="badge-matches-count">
                    0 nieuw
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Woningen die overeenkomen met jouw zoekcriteria.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">Nog geen matches</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Zodra we iets vinden dat bij jouw zoekopdracht past, krijg je direct een melding.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
