import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getSearchProfiles, deleteSearchProfile, type SearchProfile } from "@/lib/search-profiles";
import { createListing, matchListingForUser, getMatchesForUser, type MatchWithListing } from "@/lib/listings";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Home,
  Bell,
  Plus,
  Search,
  LogOut,
  MapPin,
  Trash2,
  Euro,
  BedDouble,
  Ruler,
  ExternalLink,
  FlaskConical,
} from "lucide-react";

const MAX_PROFILES = 4;
const NEW_THRESHOLD_MS = 60 * 60 * 1000;

function bedroomLabel(min: number) {
  if (min === 0) return "Studio+";
  return `${min}+`;
}

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "zojuist";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "dag" : "dagen"} geleden`;
}

function isNew(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < NEW_THRESHOLD_MS;
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

function MatchCard({ match }: { match: MatchWithListing }) {
  const listing = match.listing;
  const firstSeen = listing.first_seen_at || listing.created_at;
  const matchedAt = match.matched_at || match.created_at;
  const listingIsNew = isNew(firstSeen);

  return (
    <div
      className="border border-border rounded-md p-4 flex flex-col gap-3"
      data-testid={`card-match-${match.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">{listing.title}</p>
            {listingIsNew && (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5 py-0" data-testid={`badge-new-${match.id}`}>
                Nieuw
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{listing.city}</span>
            <span data-testid={`text-time-${match.id}`}>{relativeTime(matchedAt)}</span>
          </div>
        </div>
        {listing.url && (
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`link-listing-${match.id}`}
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Bekijk
            </Button>
          </a>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {listing.price > 0 && (
          <Badge variant="secondary">
            <Euro className="w-3 h-3 mr-1" />
            {listing.price}
          </Badge>
        )}
        {listing.bedrooms > 0 && (
          <Badge variant="secondary">
            <BedDouble className="w-3 h-3 mr-1" />
            {listing.bedrooms}
          </Badge>
        )}
        {listing.size_m2 > 0 && (
          <Badge variant="secondary">
            <Ruler className="w-3 h-3 mr-1" />
            {listing.size_m2} m&sup2;
          </Badge>
        )}
      </div>
    </div>
  );
}

function TestListingModal({
  open,
  onOpenChange,
  userId,
  userEmail,
  profiles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  profiles: SearchProfile[];
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [sizeM2, setSizeM2] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle("");
    setCity("");
    setPrice("");
    setBedrooms("");
    setSizeM2("");
    setUrl("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !city.trim()) {
      toast({ title: "Titel en stad zijn verplicht", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      const listing = await createListing({
        title: title.trim(),
        city: city.trim(),
        price: parseInt(price) || 0,
        bedrooms: parseInt(bedrooms) || 0,
        size_m2: parseInt(sizeM2) || 0,
        url: url.trim() || undefined,
        source: "manual",
      });

      const matchCount = await matchListingForUser(listing, userId, profiles, userEmail);

      queryClient.invalidateQueries({ queryKey: ["/matches", userId] });

      toast({
        title: "Test listing aangemaakt",
        description:
          matchCount > 0
            ? `${matchCount} match${matchCount > 1 ? "es" : ""} gevonden!`
            : "Geen matches met je huidige zoekopdrachten.",
      });

      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Aanmaken mislukt",
        description: err?.message ?? "Probeer het opnieuw.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test listing toevoegen</DialogTitle>
          <DialogDescription>
            Voeg een test woning toe om je zoekopdrachten te testen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="listing-title">Titel</Label>
            <Input
              id="listing-title"
              placeholder="Bijv. Ruim appartement centrum"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              data-testid="input-listing-title"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="listing-city">Stad</Label>
              <Input
                id="listing-city"
                placeholder="Bijv. Amsterdam"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                data-testid="input-listing-city"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="listing-price">Prijs (&euro;/mnd)</Label>
              <Input
                id="listing-price"
                type="number"
                placeholder="1200"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                data-testid="input-listing-price"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="listing-bedrooms">Slaapkamers</Label>
              <Input
                id="listing-bedrooms"
                type="number"
                placeholder="2"
                min="0"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                data-testid="input-listing-bedrooms"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="listing-size">Oppervlakte (m&sup2;)</Label>
              <Input
                id="listing-size"
                type="number"
                placeholder="65"
                min="0"
                value={sizeM2}
                onChange={(e) => setSizeM2(e.target.value)}
                data-testid="input-listing-size"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="listing-url">URL (optioneel)</Label>
            <Input
              id="listing-url"
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="input-listing-url"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-listing"
            >
              Annuleren
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting}
              data-testid="button-save-listing"
            >
              {submitting ? "Opslaan..." : "Opslaan & matchen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);

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

  const matchesQuery = useQuery<MatchWithListing[]>({
    queryKey: ["/matches", user?.id],
    queryFn: () => getMatchesForUser(user!.id),
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
  const matches = matchesQuery.data ?? [];
  const matchCount = matches.length;

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
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1" data-testid="text-greeting">
              Goedendag!
            </h1>
            <p className="text-muted-foreground">
              Hier vind je al je zoekopdrachten en nieuwe matches.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTestModalOpen(true)}
            data-testid="button-add-test-listing"
          >
            <FlaskConical className="w-4 h-4 mr-1.5" />
            Test listing toevoegen
          </Button>
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
                  <CardTitle className="text-base font-semibold">Matches</CardTitle>
                  <Badge variant="secondary" data-testid="badge-matches-count">
                    {matchCount} {matchCount === 1 ? "match" : "matches"}
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
              {matchesQuery.isLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="border border-border rounded-md p-4 animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                      <div className="flex gap-2">
                        <div className="h-5 bg-muted rounded w-16" />
                        <div className="h-5 bg-muted rounded w-12" />
                        <div className="h-5 bg-muted rounded w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : matchesQuery.isError ? (
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-destructive" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">Kon matches niet laden</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Er is iets misgegaan. Controleer je verbinding en probeer het opnieuw.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => matchesQuery.refetch()}
                    data-testid="button-retry-matches"
                  >
                    Opnieuw proberen
                  </Button>
                </div>
              ) : matches.length === 0 ? (
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
              ) : (
                <div className="flex flex-col gap-3">
                  {matches.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <TestListingModal
        open={testModalOpen}
        onOpenChange={setTestModalOpen}
        userId={user.id}
        userEmail={user.email ?? ""}
        profiles={profiles}
      />
    </div>
  );
}
