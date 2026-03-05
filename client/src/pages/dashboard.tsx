import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, Bell, Plus, Search, LogOut, MapPin } from "lucide-react";

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
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
          <h1 className="text-2xl font-bold text-foreground mb-1">Goedendag!</h1>
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
                  <Badge
                    variant="secondary"
                    data-testid="badge-searches-count"
                  >
                    0 van 4 actief
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Je kunt maximaal 4 zoekopdrachten tegelijk actief hebben.
                </p>
              </div>
              <Button
                size="sm"
                data-testid="button-add-search"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Zoekopdracht toevoegen
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <Search className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">Geen zoekopdrachten</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Voeg een zoekopdracht toe om automatisch op de hoogte te worden gebracht van nieuwe huurwoningen.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-add-search-empty"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Eerste zoekopdracht aanmaken
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section data-testid="section-matches">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base font-semibold">Nieuwe matches</CardTitle>
                  <Badge
                    variant="secondary"
                    data-testid="badge-matches-count"
                  >
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
