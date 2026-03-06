import { useLocation } from "wouter";
import { Home, Search, Bell, Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-white">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E8EDF2]">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2D6CDF] flex items-center justify-center">
              <Home className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-extrabold text-[#0B1F44] text-xl tracking-tight" data-testid="text-logo">Stekkies</span>
          </div>
          <Button
            variant="ghost"
            className="text-[#6B7280] font-semibold text-sm hover:bg-[#F2F4F7]"
            onClick={() => navigate("/login")}
            data-testid="button-login-nav"
          >
            Inloggen
          </Button>
        </div>
      </header>

      <main>
        <section className="bg-white">
          <div className="max-w-2xl mx-auto px-5 pt-16 pb-20 md:pt-24 md:pb-28 text-center">
            <h1
              className="text-[36px] md:text-[48px] font-extrabold text-[#0B1F44] leading-[1.15] tracking-[-0.02em] mb-5"
              data-testid="text-headline"
            >
              Vind nieuwe huurwoningen voordat anderen ze zien
            </h1>
            <p
              className="text-lg md:text-xl text-[#6B7280] leading-relaxed mb-10 max-w-lg mx-auto"
              data-testid="text-subheadline"
            >
              Wij zoeken nieuwe huurwoningen op meerdere websites en sturen ze direct naar jou.
            </p>
            <Button
              size="lg"
              className="h-14 px-10 rounded-xl text-[17px] font-semibold shadow-[0_6px_20px_rgba(29,111,232,0.25)] bg-[#2D6CDF] hover:bg-[#2560C8]"
              onClick={() => navigate("/onboarding/location")}
              data-testid="button-start-search"
            >
              Start zoeken
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            <div className="flex items-center justify-center gap-6 mt-8 text-sm text-[#6B7280]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Gratis starten
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Direct meldingen
              </span>
            </div>
          </div>
        </section>

        <section className="px-5 py-16 md:py-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#0B1F44] text-center mb-12" data-testid="text-features-heading">
              Alles om sneller je droomwoning te vinden
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white rounded-2xl p-7 shadow-[0_6px_20px_rgba(0,0,0,0.06)]" data-testid="card-feature-search">
                <div className="w-12 h-12 rounded-xl bg-[#EBF2FE] flex items-center justify-center mb-5">
                  <Search className="w-6 h-6 text-[#2D6CDF]" />
                </div>
                <h3 className="text-lg font-bold text-[#0B1F44] mb-2">Slim zoeken</h3>
                <p className="text-[15px] text-[#6B7280] leading-relaxed">
                  Stel je filters in en wij doorzoeken meerdere websites tegelijk voor jou.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-7 shadow-[0_6px_20px_rgba(0,0,0,0.06)]" data-testid="card-feature-alerts">
                <div className="w-12 h-12 rounded-xl bg-[#ECFDF5] flex items-center justify-center mb-5">
                  <Bell className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-[#0B1F44] mb-2">Direct meldingen</h3>
                <p className="text-[15px] text-[#6B7280] leading-relaxed">
                  Ontvang een melding via e-mail, SMS of WhatsApp zodra er iets nieuws is.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-7 shadow-[0_6px_20px_rgba(0,0,0,0.06)]" data-testid="card-feature-fast">
                <div className="w-12 h-12 rounded-xl bg-[#FEF3F2] flex items-center justify-center mb-5">
                  <Zap className="w-6 h-6 text-rose-500" />
                </div>
                <h3 className="text-lg font-bold text-[#0B1F44] mb-2">Sneller dan de rest</h3>
                <p className="text-[15px] text-[#6B7280] leading-relaxed">
                  Reageer als eerste op nieuwe woningen voordat anderen ze zien.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 pb-16 md:pb-24">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#0B1F44] text-center mb-12" data-testid="text-how-it-works">
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
                    <div className="w-11 h-11 rounded-full bg-[#2D6CDF] flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">{item.step}</span>
                    </div>
                    {i < 2 && <div className="w-0.5 h-10 bg-[#E8EDF2] mt-2" />}
                  </div>
                  <div className="pt-2 pb-6">
                    <h3 className="text-lg font-bold text-[#0B1F44] mb-1">{item.title}</h3>
                    <p className="text-[15px] text-[#6B7280]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 md:pb-28">
          <div className="max-w-xl mx-auto bg-white rounded-2xl p-8 md:p-12 text-center shadow-[0_6px_20px_rgba(0,0,0,0.06)]">
            <h2 className="text-2xl font-extrabold text-[#0B1F44] mb-3" data-testid="text-cta-bottom">
              Klaar om te beginnen?
            </h2>
            <p className="text-[15px] text-[#6B7280] mb-8">
              Maak een account aan en ontvang direct woningmeldingen.
            </p>
            <Button
              size="lg"
              className="h-14 px-10 rounded-xl text-[17px] font-semibold shadow-[0_6px_20px_rgba(29,111,232,0.25)] bg-[#2D6CDF] hover:bg-[#2560C8]"
              onClick={() => navigate("/onboarding/location")}
              data-testid="button-start-search-bottom"
            >
              Start zoeken
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E8EDF2] py-8 px-5">
        <div className="max-w-5xl mx-auto text-center text-sm text-[#6B7280]">
          &copy; {new Date().getFullYear()} Stekkies. Alle rechten voorbehouden.
        </div>
      </footer>
    </div>
  );
}
