import { useLocation } from "wouter";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full bg-background sticky top-0 z-20 border-b" style={{ borderColor: "var(--yo-divider)" }}>
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Home className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-extrabold text-xl tracking-tight" style={{ color: "var(--yo-dark)" }}>Stekkies</span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-[13px] font-semibold mb-6"
          style={{ color: "var(--yo-teal)" }}
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar startpagina
        </button>

        <h1 className="text-[32px] font-[800] tracking-[-0.03em] leading-[1.1] mb-10" style={{ color: "var(--yo-dark)" }} data-testid="text-legal-title">
          {title}
        </h1>

        <div className="prose prose-sm max-w-none space-y-6" style={{ color: "var(--yo-dark)" }}>
          {children}
        </div>
      </main>

      <footer className="border-t py-8 px-6" style={{ borderColor: "var(--yo-divider)" }}>
        <div className="max-w-xl mx-auto text-center text-[13px] text-muted-foreground">
          &copy; {new Date().getFullYear()} Stekkies. Alle rechten voorbehouden.
        </div>
      </footer>
    </div>
  );
}

export function ImpressumPage() {
  return (
    <LegalLayout title="Impressum">
      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>Angaben gem\u00E4\u00DF \u00A7 5 TMG</h2>
        <p className="text-[15px] leading-relaxed" data-testid="text-impressum-company">
          [Firmenname einf\u00FCgen]<br />
          [Stra\u00DFe und Hausnummer]<br />
          [PLZ und Ort]<br />
          Deutschland
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>Vertreten durch</h2>
        <p className="text-[15px] leading-relaxed">
          [Name des Gesch\u00E4ftsf\u00FChrers / Inhabers einf\u00FCgen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>Kontakt</h2>
        <p className="text-[15px] leading-relaxed" data-testid="text-impressum-contact">
          E-Mail: [E-Mail-Adresse einf\u00FCgen]<br />
          Telefon: [Telefonnummer einf\u00FCgen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>Registereintrag</h2>
        <p className="text-[15px] leading-relaxed">
          Eintragung im Handelsregister.<br />
          Registergericht: [Registergericht einf\u00FCgen]<br />
          Registernummer: [Registernummer einf\u00FCgen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>Umsatzsteuer-ID</h2>
        <p className="text-[15px] leading-relaxed">
          Umsatzsteuer-Identifikationsnummer gem\u00E4\u00DF \u00A727a Umsatzsteuergesetz:<br />
          [USt-IdNr. einf\u00FCgen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>Streitschlichtung</h2>
        <p className="text-[15px] leading-relaxed">
          Die Europ\u00E4ische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit.
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>
    </LegalLayout>
  );
}

export function DatenschutzPage() {
  return (
    <LegalLayout title="Datenschutzerkl\u00E4rung">
      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>1. Datenschutz auf einen Blick</h2>
        <h3 className="text-[15px] font-semibold mb-1" style={{ color: "var(--yo-dark)" }}>Allgemeine Hinweise</h3>
        <p className="text-[15px] leading-relaxed" data-testid="text-datenschutz-intro">
          Die folgenden Hinweise geben einen einfachen \u00DCberblick dar\u00FCber, was mit Ihren
          personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten
          sind alle Daten, mit denen Sie pers\u00F6nlich identifiziert werden k\u00F6nnen.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>2. Verantwortliche Stelle</h2>
        <p className="text-[15px] leading-relaxed">
          [Firmenname einf\u00FCgen]<br />
          [Stra\u00DFe und Hausnummer]<br />
          [PLZ und Ort]<br />
          E-Mail: [E-Mail-Adresse einf\u00FCgen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>3. Datenerfassung auf dieser Website</h2>
        <h3 className="text-[15px] font-semibold mb-1" style={{ color: "var(--yo-dark)" }}>Cookies</h3>
        <p className="text-[15px] leading-relaxed">
          Unsere Website verwendet Cookies. Dabei handelt es sich um kleine Textdateien, die Ihr
          Webbrowser auf Ihrem Endger\u00E4t speichert. Cookies helfen uns dabei, unser Angebot
          nutzerfreundlicher und sicherer zu machen.
        </p>

        <h3 className="text-[15px] font-semibold mb-1 mt-4" style={{ color: "var(--yo-dark)" }}>Server-Log-Dateien</h3>
        <p className="text-[15px] leading-relaxed">
          Der Provider der Seiten erhebt und speichert automatisch Informationen in sogenannten
          Server-Log-Dateien, die Ihr Browser automatisch an uns \u00FCbermittelt.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>4. Analyse-Tools und Werbung</h2>
        <p className="text-[15px] leading-relaxed">
          [Beschreibung der eingesetzten Analyse-Tools einf\u00FCgen, z.B. Google Analytics, Plausible, etc.]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>5. Ihre Rechte</h2>
        <p className="text-[15px] leading-relaxed">
          Sie haben jederzeit das Recht auf unentgeltliche Auskunft \u00FCber Ihre gespeicherten
          personenbezogenen Daten, deren Herkunft und Empf\u00E4nger und den Zweck der Datenverarbeitung
          sowie ein Recht auf Berichtigung oder L\u00F6schung dieser Daten. Hierzu sowie zu weiteren
          Fragen zum Thema Datenschutz k\u00F6nnen Sie sich jederzeit an uns wenden.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>6. Zahlungsdienstleister</h2>
        <p className="text-[15px] leading-relaxed">
          Wir nutzen Stripe als Zahlungsdienstleister. Ihre Zahlungsdaten werden direkt von Stripe
          verarbeitet. Weitere Informationen finden Sie in der Datenschutzerkl\u00E4rung von Stripe.
        </p>
      </section>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Allgemeine Gesch\u00E4ftsbedingungen">
      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>\u00A7 1 Geltungsbereich</h2>
        <p className="text-[15px] leading-relaxed" data-testid="text-terms-scope">
          Diese Allgemeinen Gesch\u00E4ftsbedingungen (AGB) gelten f\u00FCr alle Vertr\u00E4ge, die zwischen
          [Firmenname einf\u00FCgen] (nachfolgend "Anbieter") und dem Nutzer \u00FCber die Plattform Stekkies
          geschlossen werden.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>\u00A7 2 Leistungsbeschreibung</h2>
        <p className="text-[15px] leading-relaxed">
          Stekkies ist ein Dienst, der Mietwohnungsangebote von verschiedenen Websites aggregiert
          und Nutzer \u00FCber neue, relevante Angebote benachrichtigt. Der Anbieter \u00FCbernimmt keine
          Gew\u00E4hr f\u00FCr die Vollst\u00E4ndigkeit, Richtigkeit oder Aktualit\u00E4t der angezeigten Angebote.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>\u00A7 3 Registrierung und Nutzerkonto</h2>
        <p className="text-[15px] leading-relaxed">
          F\u00FCr die Nutzung des Dienstes ist eine Registrierung erforderlich. Der Nutzer ist
          verpflichtet, wahrheitsgem\u00E4\u00DFe Angaben zu machen und seine Zugangsdaten vertraulich
          zu behandeln.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>\u00A7 4 Preise und Zahlungsbedingungen</h2>
        <p className="text-[15px] leading-relaxed">
          Die aktuellen Preise sind auf der Website einsehbar. Alle Preise verstehen sich inklusive
          der gesetzlichen Mehrwertsteuer. Die Zahlung erfolgt \u00FCber den Zahlungsdienstleister Stripe.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>\u00A7 5 Probezeit und K\u00FCndigung</h2>
        <p className="text-[15px] leading-relaxed">
          Neue Nutzer erhalten eine kostenlose Probezeit. Nach Ablauf der Probezeit wird das
          Abonnement automatisch verl\u00E4ngert, sofern es nicht vor Ablauf gek\u00FCndigt wird. Die
          K\u00FCndigung kann jederzeit \u00FCber das Nutzerkonto erfolgen.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>\u00A7 6 Haftungsbeschr\u00E4nkung</h2>
        <p className="text-[15px] leading-relaxed">
          Der Anbieter haftet nicht f\u00FCr die Verf\u00FCgbarkeit oder Richtigkeit der aggregierten
          Wohnungsangebote. Die Nutzung der Plattform erfolgt auf eigenes Risiko des Nutzers.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] tracking-[-0.01em] mb-3" style={{ color: "var(--yo-dark)" }}>\u00A7 7 Schlussbestimmungen</h2>
        <p className="text-[15px] leading-relaxed">
          Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen dieser AGB
          unwirksam sein, bleibt die Wirksamkeit der \u00FCbrigen Bestimmungen unber\u00FChrt.
        </p>
      </section>
    </LegalLayout>
  );
}
