import { useLocation } from "wouter";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-white">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#EAEFF5]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-9 h-9 rounded-xl bg-[#0066FF] flex items-center justify-center">
              <Home className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-extrabold text-[#1B2A4A] text-xl tracking-tight">Stekkies</span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0066FF] mb-6"
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar startpagina
        </button>

        <h1 className="text-[32px] font-[800] text-[#1B2A4A] tracking-[-0.03em] leading-[1.1] mb-10" data-testid="text-legal-title">
          {title}
        </h1>

        <div className="prose prose-sm max-w-none text-[#1B2A4A] space-y-6">
          {children}
        </div>
      </main>

      <footer className="border-t border-[#EAEFF5] py-8 px-6">
        <div className="max-w-xl mx-auto text-center text-[13px] text-[#72839A]">
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
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">Angaben gemäß § 5 TMG</h2>
        <p className="text-[15px] leading-relaxed" data-testid="text-impressum-company">
          [Firmenname einfügen]<br />
          [Straße und Hausnummer]<br />
          [PLZ und Ort]<br />
          Deutschland
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">Vertreten durch</h2>
        <p className="text-[15px] leading-relaxed">
          [Name des Geschäftsführers / Inhabers einfügen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">Kontakt</h2>
        <p className="text-[15px] leading-relaxed" data-testid="text-impressum-contact">
          E-Mail: [E-Mail-Adresse einfügen]<br />
          Telefon: [Telefonnummer einfügen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">Registereintrag</h2>
        <p className="text-[15px] leading-relaxed">
          Eintragung im Handelsregister.<br />
          Registergericht: [Registergericht einfügen]<br />
          Registernummer: [Registernummer einfügen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">Umsatzsteuer-ID</h2>
        <p className="text-[15px] leading-relaxed">
          Umsatzsteuer-Identifikationsnummer gemäß §27a Umsatzsteuergesetz:<br />
          [USt-IdNr. einfügen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">Streitschlichtung</h2>
        <p className="text-[15px] leading-relaxed">
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit.
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>
    </LegalLayout>
  );
}

export function DatenschutzPage() {
  return (
    <LegalLayout title="Datenschutzerklärung">
      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">1. Datenschutz auf einen Blick</h2>
        <h3 className="text-[15px] font-semibold text-[#1B2A4A] mb-1">Allgemeine Hinweise</h3>
        <p className="text-[15px] leading-relaxed" data-testid="text-datenschutz-intro">
          Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren
          personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten
          sind alle Daten, mit denen Sie persönlich identifiziert werden können.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">2. Verantwortliche Stelle</h2>
        <p className="text-[15px] leading-relaxed">
          [Firmenname einfügen]<br />
          [Straße und Hausnummer]<br />
          [PLZ und Ort]<br />
          E-Mail: [E-Mail-Adresse einfügen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">3. Datenerfassung auf dieser Website</h2>
        <h3 className="text-[15px] font-semibold text-[#1B2A4A] mb-1">Cookies</h3>
        <p className="text-[15px] leading-relaxed">
          Unsere Website verwendet Cookies. Dabei handelt es sich um kleine Textdateien, die Ihr
          Webbrowser auf Ihrem Endgerät speichert. Cookies helfen uns dabei, unser Angebot
          nutzerfreundlicher und sicherer zu machen.
        </p>

        <h3 className="text-[15px] font-semibold text-[#1B2A4A] mb-1 mt-4">Server-Log-Dateien</h3>
        <p className="text-[15px] leading-relaxed">
          Der Provider der Seiten erhebt und speichert automatisch Informationen in sogenannten
          Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">4. Analyse-Tools und Werbung</h2>
        <p className="text-[15px] leading-relaxed">
          [Beschreibung der eingesetzten Analyse-Tools einfügen, z.B. Google Analytics, Plausible, etc.]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">5. Ihre Rechte</h2>
        <p className="text-[15px] leading-relaxed">
          Sie haben jederzeit das Recht auf unentgeltliche Auskunft über Ihre gespeicherten
          personenbezogenen Daten, deren Herkunft und Empfänger und den Zweck der Datenverarbeitung
          sowie ein Recht auf Berichtigung oder Löschung dieser Daten. Hierzu sowie zu weiteren
          Fragen zum Thema Datenschutz können Sie sich jederzeit an uns wenden.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">6. Zahlungsdienstleister</h2>
        <p className="text-[15px] leading-relaxed">
          Wir nutzen Stripe als Zahlungsdienstleister. Ihre Zahlungsdaten werden direkt von Stripe
          verarbeitet. Weitere Informationen finden Sie in der Datenschutzerklärung von Stripe.
        </p>
      </section>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Allgemeine Geschäftsbedingungen">
      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">§ 1 Geltungsbereich</h2>
        <p className="text-[15px] leading-relaxed" data-testid="text-terms-scope">
          Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge, die zwischen
          [Firmenname einfügen] (nachfolgend "Anbieter") und dem Nutzer über die Plattform Stekkies
          geschlossen werden.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">§ 2 Leistungsbeschreibung</h2>
        <p className="text-[15px] leading-relaxed">
          Stekkies ist ein Dienst, der Mietwohnungsangebote von verschiedenen Websites aggregiert
          und Nutzer über neue, relevante Angebote benachrichtigt. Der Anbieter übernimmt keine
          Gewähr für die Vollständigkeit, Richtigkeit oder Aktualität der angezeigten Angebote.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">§ 3 Registrierung und Nutzerkonto</h2>
        <p className="text-[15px] leading-relaxed">
          Für die Nutzung des Dienstes ist eine Registrierung erforderlich. Der Nutzer ist
          verpflichtet, wahrheitsgemäße Angaben zu machen und seine Zugangsdaten vertraulich
          zu behandeln.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">§ 4 Preise und Zahlungsbedingungen</h2>
        <p className="text-[15px] leading-relaxed">
          Die aktuellen Preise sind auf der Website einsehbar. Alle Preise verstehen sich inklusive
          der gesetzlichen Mehrwertsteuer. Die Zahlung erfolgt über den Zahlungsdienstleister Stripe.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">§ 5 Probezeit und Kündigung</h2>
        <p className="text-[15px] leading-relaxed">
          Neue Nutzer erhalten eine kostenlose Probezeit. Nach Ablauf der Probezeit wird das
          Abonnement automatisch verlängert, sofern es nicht vor Ablauf gekündigt wird. Die
          Kündigung kann jederzeit über das Nutzerkonto erfolgen.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">§ 6 Haftungsbeschränkung</h2>
        <p className="text-[15px] leading-relaxed">
          Der Anbieter haftet nicht für die Verfügbarkeit oder Richtigkeit der aggregierten
          Wohnungsangebote. Die Nutzung der Plattform erfolgt auf eigenes Risiko des Nutzers.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[700] text-[#1B2A4A] tracking-[-0.01em] mb-3">§ 7 Schlussbestimmungen</h2>
        <p className="text-[15px] leading-relaxed">
          Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen dieser AGB
          unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
        </p>
      </section>
    </LegalLayout>
  );
}
