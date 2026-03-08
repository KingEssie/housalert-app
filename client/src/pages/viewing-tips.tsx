import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  MessageSquare,
  FileCheck,
  Send,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

const SECTIONS = [
  {
    icon: ClipboardCheck,
    title: "Voor de bezichtiging",
    items: [
      "Lees de advertentie aandachtig door \u2014 noteer bijzonderheden en openstaande vragen.",
      "Bereid 3\u20135 vragen voor over de woning, de buurt en het huurcontract.",
      "Check de buurt vooraf: reistijd, supermarkten, OV-verbindingen en geluidsoverlast.",
      "Verzamel je documenten en introductiebrief zodat je ze direct kunt overhandigen.",
      "Kom minimaal 10 minuten eerder \u2014 eerste indruk telt.",
    ],
  },
  {
    icon: MessageSquare,
    title: "Tijdens de bezichtiging",
    items: [
      "Wees vriendelijk, beleefd en professioneel \u2014 stel jezelf kort voor.",
      "Stel slimme vragen: bijkomende kosten (Nebenkosten), huisregels, opzegtermijn.",
      "Toon oprechte interesse zonder te overdrijven \u2014 verhuurders merken dat.",
      "Vraag naar de verdere procedure: wanneer wordt de beslissing genomen?",
      "Maak een betrouwbare indruk: rustig, voorbereid en serieus.",
    ],
  },
  {
    icon: FileCheck,
    title: "Wat neem je mee",
    items: [
      "Kopie van je identiteitsbewijs (paspoort of ID-kaart).",
      "Je voorbereide introductiebrief \u2014 print of digitaal.",
      "Inkomensbewijzen: loonstroken, arbeidsovereenkomst of belastingaangifte.",
      "SCHUFA-rapport of vergelijkbare kredietwaardigheidsverklaring.",
      "Je telefoon met contactgegevens van de verhuurder bij de hand.",
    ],
  },
  {
    icon: Send,
    title: "Na de bezichtiging",
    items: [
      "Stuur dezelfde dag nog een korte bedankmail naar de verhuurder.",
      "Lever gevraagde documenten zo snel mogelijk aan \u2014 snelheid maakt verschil.",
      "Gebruik je introductiebrief als basis voor je opvolgbericht.",
      "Blijf beleefd en bondig \u2014 vermijd lange berichten of herhaald contact.",
      "Houd een lijst bij van bezichtigingen en contactgegevens.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Rode vlaggen",
    items: [
      "Onduidelijke of wisselende huurprijs of bijkomende kosten.",
      "Druk om snel te betalen of een aanbetaling te doen v\u00F3\u00F3r het contract.",
      "Vreemde communicatie: alleen WhatsApp, geen vast adres, geen echte naam.",
      "Onvolledige of verdachte advertentiegegevens \u2014 controleer altijd de bron.",
      "De verhuurder weigert een bezichtiging of wil geen contract tonen.",
    ],
  },
];

export default function ViewingTipsPage() {
  const [, navigate] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const [markedDone, setMarkedDone] = useState(false);

  const markDoneMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/profile-data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ viewing_tips_done: true }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      setMarkedDone(true);
      toast({ title: "Afgerond!", description: "Bezichtigingtips als voltooid gemarkeerd." });
    },
    onError: () => {
      toast({ title: "Fout", description: "Kon niet opslaan. Probeer het opnieuw.", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageHeader title="Bezichtigingtips" onBack={() => navigate("/dashboard?tab=boost")} />

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-6 pb-32">
        <div className="mb-6">
          <h2 className="text-[32px] font-[800] tracking-[-0.03em] leading-[1.1] mb-3" style={{ color: "var(--yo-dark)" }} data-testid="text-tips-heading">
            Goed voorbereid naar een bezichtiging
          </h2>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            In de Duitse huurmarkt is voorbereiding alles. Met deze tips vergroot je je kans op de woning.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            return (
              <div
                key={idx}
                className="bg-card rounded-2xl shadow-sm overflow-hidden"
                data-testid={`card-tips-section-${idx}`}
              >
                <div className="flex items-center gap-3 p-6 pb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--yo-teal-light)" }}>
                    <Icon className="w-4.5 h-4.5" style={{ color: "var(--yo-teal)" }} />
                  </div>
                  <h3 className="text-[16px] font-semibold" style={{ color: "var(--yo-dark)" }}>{section.title}</h3>
                </div>
                <div className="px-6 pb-6">
                  <ul className="flex flex-col gap-2.5">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "var(--yo-teal)" }} />
                        <span className="text-[13px] text-muted-foreground leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-5 z-10" style={{ borderColor: "var(--yo-divider)" }}>
        <div className="max-w-xl mx-auto">
          {markedDone ? (
            <div className="flex items-center justify-center gap-2 h-[56px]" style={{ color: "var(--yo-teal)" }}>
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-[16px] font-semibold">Voltooid!</span>
            </div>
          ) : (
            <Button
              onClick={() => markDoneMutation.mutate()}
              disabled={markDoneMutation.isPending}
              className="w-full h-[56px] rounded-xl text-[16px] font-semibold bg-primary text-primary-foreground disabled:opacity-50"
              data-testid="button-mark-tips-done"
            >
              {markDoneMutation.isPending ? "Opslaan..." : "Markeer als voltooid"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
