import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full bg-background sticky top-0 z-20 border-b" style={{ borderColor: "#E5E7EB" }}>
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => navigate("/")}>
            <HousAlertLogo size={36} textClassName="font-medium text-xl tracking-tight text-[#222222]" />
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-[13px] font-medium mb-6"
          style={{ color: "#F97316" }}
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("legal.backToHome")}
        </button>

        <h1 className="text-[32px] font-[600] tracking-[-0.03em] leading-[1.1] mb-10" style={{ color: "#222222" }} data-testid="text-legal-title">
          {title}
        </h1>

        <div className="prose prose-sm max-w-none space-y-6" style={{ color: "#222222" }}>
          {children}
        </div>
      </main>

      <footer className="border-t py-8 px-6" style={{ borderColor: "#E5E7EB" }}>
        <div className="max-w-xl mx-auto text-center text-[13px] text-muted-foreground">
          {t("legal.copyright", { year: String(new Date().getFullYear()) })}
        </div>
      </footer>
    </div>
  );
}

export function ImpressumPage() {
  return (
    <LegalLayout title="Impressum">
      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>Angaben gemäß § 5 TMG</h2>
        <p className="text-[15px] leading-relaxed" data-testid="text-impressum-company">
          [Firmenname einfügen]<br />
          [Straße und Hausnummer]<br />
          [PLZ und Ort]<br />
          Deutschland
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>Vertreten durch</h2>
        <p className="text-[15px] leading-relaxed">
          [Name des Geschäftsführers / Inhabers einfügen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>Kontakt</h2>
        <p className="text-[15px] leading-relaxed" data-testid="text-impressum-contact">
          E-Mail: [E-Mail-Adresse einfügen]<br />
          Telefon: [Telefonnummer einfügen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>Registereintrag</h2>
        <p className="text-[15px] leading-relaxed">
          Eintragung im Handelsregister.<br />
          Registergericht: [Registergericht einfügen]<br />
          Registernummer: [Registernummer einfügen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>Umsatzsteuer-ID</h2>
        <p className="text-[15px] leading-relaxed">
          Umsatzsteuer-Identifikationsnummer gemäß §27a Umsatzsteuergesetz:<br />
          [USt-IdNr. einfügen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>Streitschlichtung</h2>
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
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>1. Datenschutz auf einen Blick</h2>
        <h3 className="text-[15px] font-medium mb-1" style={{ color: "#222222" }}>Allgemeine Hinweise</h3>
        <p className="text-[15px] leading-relaxed" data-testid="text-datenschutz-intro">
          Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren
          personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten
          sind alle Daten, mit denen Sie persönlich identifiziert werden können.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>2. Verantwortliche Stelle</h2>
        <p className="text-[15px] leading-relaxed">
          [Firmenname einfügen]<br />
          [Straße und Hausnummer]<br />
          [PLZ und Ort]<br />
          E-Mail: [E-Mail-Adresse einfügen]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>3. Datenerfassung auf dieser Website</h2>
        <h3 className="text-[15px] font-medium mb-1" style={{ color: "#222222" }}>Cookies</h3>
        <p className="text-[15px] leading-relaxed">
          Unsere Website verwendet Cookies. Dabei handelt es sich um kleine Textdateien, die Ihr
          Webbrowser auf Ihrem Endgerät speichert. Cookies helfen uns dabei, unser Angebot
          nutzerfreundlicher und sicherer zu machen.
        </p>

        <h3 className="text-[15px] font-medium mb-1 mt-4" style={{ color: "#222222" }}>Server-Log-Dateien</h3>
        <p className="text-[15px] leading-relaxed">
          Der Provider der Seiten erhebt und speichert automatisch Informationen in sogenannten
          Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>4. Analyse-Tools und Werbung</h2>
        <p className="text-[15px] leading-relaxed">
          [Beschreibung der eingesetzten Analyse-Tools einfügen, z.B. Google Analytics, Plausible, etc.]
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>5. Ihre Rechte</h2>
        <p className="text-[15px] leading-relaxed">
          Sie haben jederzeit das Recht auf unentgeltliche Auskunft über Ihre gespeicherten
          personenbezogenen Daten, deren Herkunft und Empfänger und den Zweck der Datenverarbeitung
          sowie ein Recht auf Berichtigung oder Löschung dieser Daten. Hierzu sowie zu weiteren
          Fragen zum Thema Datenschutz können Sie sich jederzeit an uns wenden.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>6. Zahlungsdienstleister</h2>
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
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>§ 1 Geltungsbereich</h2>
        <p className="text-[15px] leading-relaxed" data-testid="text-terms-scope">
          Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge, die zwischen
          [Firmenname einfügen] (nachfolgend "Anbieter") und dem Nutzer über die Plattform HousAlert
          geschlossen werden.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>§ 2 Leistungsbeschreibung</h2>
        <p className="text-[15px] leading-relaxed">
          HousAlert ist ein Dienst, der Mietwohnungsangebote von verschiedenen Websites aggregiert
          und Nutzer über neue, relevante Angebote benachrichtigt. Der Anbieter übernimmt keine
          Gewähr für die Vollständigkeit, Richtigkeit oder Aktualität der angezeigten Angebote.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>§ 3 Registrierung und Nutzerkonto</h2>
        <p className="text-[15px] leading-relaxed">
          Für die Nutzung des Dienstes ist eine Registrierung erforderlich. Der Nutzer ist
          verpflichtet, wahrheitsgemäße Angaben zu machen und seine Zugangsdaten vertraulich
          zu behandeln.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>§ 4 Preise und Zahlungsbedingungen</h2>
        <p className="text-[15px] leading-relaxed">
          Die aktuellen Preise sind auf der Website einsehbar. Alle Preise verstehen sich inklusive
          der gesetzlichen Mehrwertsteuer. Die Zahlung erfolgt über den Zahlungsdienstleister Stripe.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>§ 5 Probezeit und Kündigung</h2>
        <p className="text-[15px] leading-relaxed">
          Neue Nutzer erhalten eine kostenlose Probezeit. Nach Ablauf der Probezeit wird das
          Abonnement automatisch verlängert, sofern es nicht vor Ablauf gekündigt wird. Die
          Kündigung kann jederzeit über das Nutzerkonto erfolgen.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>§ 6 Haftungsbeschränkung</h2>
        <p className="text-[15px] leading-relaxed">
          Der Anbieter haftet nicht für die Verfügbarkeit oder Richtigkeit der aggregierten
          Wohnungsangebote. Die Nutzung der Plattform erfolgt auf eigenes Risiko des Nutzers.
        </p>
      </section>

      <section>
        <h2 className="text-[18px] font-[600] tracking-[-0.01em] mb-3" style={{ color: "#222222" }}>§ 7 Schlussbestimmungen</h2>
        <p className="text-[15px] leading-relaxed">
          Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen dieser AGB
          unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
        </p>
      </section>
    </LegalLayout>
  );
}
