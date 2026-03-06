import { useLocation } from "wouter";
import { Home, Search, Bell, Zap, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-white">
      <header className="w-full bg-white/90 backdrop-blur-sm sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Home className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-xl tracking-tight" data-testid="text-logo">Stekkies</span>
          </div>
          <Button
            variant="ghost"
            className="text-gray-600 font-medium"
            onClick={() => navigate("/login")}
            data-testid="button-login-nav"
          >
            Inloggen
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-5 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="max-w-2xl mx-auto text-center">
            <h1
              className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight mb-5"
              data-testid="text-headline"
            >
              Vind nieuwe huurwoningen voordat anderen ze zien
            </h1>
            <p
              className="text-lg md:text-xl text-gray-500 leading-relaxed mb-10 max-w-lg mx-auto"
              data-testid="text-subheadline"
            >
              Wij zoeken nieuwe huurwoningen op meerdere websites en sturen ze direct naar jou.
            </p>
            <Button
              size="lg"
              className="h-14 px-10 rounded-xl text-lg font-semibold shadow-none"
              onClick={() => navigate("/onboarding/location")}
              data-testid="button-start-search"
            >
              Start zoeken
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </section>

        <section className="px-5 pb-20 md:pb-28">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-2xl p-7" data-testid="card-feature-search">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-5">
                  <Search className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Slim zoeken</h3>
                <p className="text-gray-500 leading-relaxed">
                  Stel je filters in en wij doorzoeken meerdere websites tegelijk voor jou.
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-7" data-testid="card-feature-alerts">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-5">
                  <Bell className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Direct meldingen</h3>
                <p className="text-gray-500 leading-relaxed">
                  Ontvang een melding via e-mail, SMS of WhatsApp zodra er iets nieuws is.
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-7" data-testid="card-feature-fast">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-5">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Sneller dan de rest</h3>
                <p className="text-gray-500 leading-relaxed">
                  Reageer als eerste op nieuwe woningen voordat anderen ze zien.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 md:pb-28">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-10" data-testid="text-how-it-works">
              Hoe werkt het?
            </h2>
            <div className="flex flex-col gap-8">
              {[
                { step: "1", title: "Kies je stad en filters", desc: "Vertel ons waar je zoekt en wat je wilt." },
                { step: "2", title: "Wij zoeken voor jou", desc: "Onze zoekmachine checkt continu meerdere websites." },
                { step: "3", title: "Ontvang meldingen", desc: "Krijg direct bericht als er een match is." },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-5 text-left" data-testid={`step-${item.step}`}>
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{item.step}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{item.title}</h3>
                    <p className="text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 md:pb-28">
          <div className="max-w-xl mx-auto bg-gray-50 rounded-2xl p-8 md:p-12 text-center">
            <Shield className="w-10 h-10 text-primary mx-auto mb-5" />
            <h2 className="text-2xl font-bold text-gray-900 mb-3" data-testid="text-cta-bottom">
              Klaar om te beginnen?
            </h2>
            <p className="text-gray-500 mb-8">
              Maak een gratis account aan en ontvang direct woningmeldingen.
            </p>
            <Button
              size="lg"
              className="h-14 px-10 rounded-xl text-lg font-semibold shadow-none"
              onClick={() => navigate("/onboarding/location")}
              data-testid="button-start-search-bottom"
            >
              Start zoeken
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-8 px-5">
        <div className="max-w-5xl mx-auto text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Stekkies. Alle rechten voorbehouden.
        </div>
      </footer>
    </div>
  );
}
