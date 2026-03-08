import { useLocation } from "wouter";
import { Home, Search, Bell, Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full bg-background sticky top-0 z-20 border-b" style={{ borderColor: "var(--yo-divider)" }}>
        <div className="max-w-5xl mx-auto px-6 h-[60px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Home className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-extrabold text-xl tracking-tight" style={{ color: "var(--yo-dark)" }} data-testid="text-logo">Stekkies</span>
          </div>
          <Button
            variant="ghost"
            className="text-muted-foreground font-semibold text-sm"
            onClick={() => navigate("/login")}
            data-testid="button-login-nav"
          >
            Inloggen
          </Button>
        </div>
      </header>

      <main>
        <section className="bg-background">
          <div className="max-w-2xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
            <h1
              className="text-[40px] md:text-[56px] font-[800] leading-[1.05] tracking-[-0.03em] mb-6"
              style={{ color: "var(--yo-dark)" }}
              data-testid="text-headline"
            >
              Vind nieuwe huurwoningen voordat anderen ze zien
            </h1>
            <p
              className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-12 max-w-lg mx-auto"
              data-testid="text-subheadline"
            >
              Wij zoeken nieuwe huurwoningen op meerdere websites en sturen ze direct naar jou.
            </p>
            <Button
              size="lg"
              className="h-[56px] px-10 rounded-xl text-[16px] font-semibold bg-primary text-primary-foreground"
              onClick={() => navigate("/onboarding/location")}
              data-testid="button-start-search"
            >
              Start zoeken
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            <div className="flex items-center justify-center gap-6 mt-10 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" style={{ color: "var(--yo-teal)" }} />
                Gratis starten
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" style={{ color: "var(--yo-teal)" }} />
                Direct meldingen
              </span>
            </div>
          </div>
        </section>

        <section className="px-6 py-20 md:py-28">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-[30px] md:text-[36px] font-[800] text-center tracking-[-0.03em] leading-[1.1] mb-14" style={{ color: "var(--yo-dark)" }} data-testid="text-features-heading">
              Alles om sneller je droomwoning te vinden
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card rounded-2xl p-6 shadow-sm" data-testid="card-feature-search">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: "var(--yo-teal-light)" }}>
                  <Search className="w-6 h-6" style={{ color: "var(--yo-teal)" }} />
                </div>
                <h3 className="text-[18px] font-bold mb-2" style={{ color: "var(--yo-dark)" }}>Slim zoeken</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  Stel je filters in en wij doorzoeken meerdere websites tegelijk voor jou.
                </p>
              </div>

              <div className="bg-card rounded-2xl p-6 shadow-sm" data-testid="card-feature-alerts">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: "var(--yo-teal-light)" }}>
                  <Bell className="w-6 h-6" style={{ color: "var(--yo-teal)" }} />
                </div>
                <h3 className="text-[18px] font-bold mb-2" style={{ color: "var(--yo-dark)" }}>Direct meldingen</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  Ontvang een melding via e-mail, SMS of WhatsApp zodra er iets nieuws is.
                </p>
              </div>

              <div className="bg-card rounded-2xl p-6 shadow-sm" data-testid="card-feature-fast">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: "var(--yo-teal-light)" }}>
                  <Zap className="w-6 h-6" style={{ color: "var(--yo-teal)" }} />
                </div>
                <h3 className="text-[18px] font-bold mb-2" style={{ color: "var(--yo-dark)" }}>Sneller dan de rest</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  Reageer als eerste op nieuwe woningen voordat anderen ze zien.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-20 md:pb-28">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-[30px] md:text-[36px] font-[800] text-center tracking-[-0.03em] leading-[1.1] mb-14" style={{ color: "var(--yo-dark)" }} data-testid="text-how-it-works">
              Hoe werkt het?
            </h2>
            <div className="space-y-0">
              {[
                { step: "1", title: "Kies je stad en filters", desc: "Vertel ons waar je zoekt en wat je wilt." },
                { step: "2", title: "Wij zoeken voor jou", desc: "Onze zoekmachine checkt continu meerdere websites." },
                { step: "3", title: "Ontvang meldingen", desc: "Krijg direct bericht als er een match is." },
              ].map((item, i) => (
                <div key={item.step} className="flex items-start gap-5" data-testid={`step-${item.step}`}>
                  <div className="flex flex-col items-center">
                    <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-foreground font-bold text-sm">{item.step}</span>
                    </div>
                    {i < 2 && <div className="w-0.5 h-10 mt-2" style={{ backgroundColor: "var(--yo-divider)" }} />}
                  </div>
                  <div className="pt-2 pb-6">
                    <h3 className="text-[18px] font-bold mb-1" style={{ color: "var(--yo-dark)" }}>{item.title}</h3>
                    <p className="text-[15px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24 md:pb-32">
          <div className="max-w-xl mx-auto bg-card rounded-2xl p-8 md:p-12 text-center shadow-sm">
            <h2 className="text-[32px] font-[800] tracking-[-0.03em] leading-[1.1] mb-4" style={{ color: "var(--yo-dark)" }} data-testid="text-cta-bottom">
              Klaar om te beginnen?
            </h2>
            <p className="text-[15px] text-muted-foreground mb-8">
              Maak een account aan en ontvang direct woningmeldingen.
            </p>
            <Button
              size="lg"
              className="h-[56px] px-10 rounded-xl text-[16px] font-semibold bg-primary text-primary-foreground"
              onClick={() => navigate("/onboarding/location")}
              data-testid="button-start-search-bottom"
            >
              Start zoeken
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-6 bg-background" style={{ borderColor: "var(--yo-divider)" }}>
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-3">
          <div className="flex items-center gap-4 flex-wrap justify-center text-sm text-muted-foreground">
            <a href="/impressum" className="hover:text-foreground transition-colors" data-testid="link-impressum">Impressum</a>
            <a href="/datenschutz" className="hover:text-foreground transition-colors" data-testid="link-datenschutz">Datenschutz</a>
            <a href="/terms" className="hover:text-foreground transition-colors" data-testid="link-terms">AGB</a>
          </div>
          <p className="text-[13px] text-muted-foreground">
            &copy; {new Date().getFullYear()} Stekkies. Alle rechten voorbehouden.
          </p>
        </div>
      </footer>
    </div>
  );
}
