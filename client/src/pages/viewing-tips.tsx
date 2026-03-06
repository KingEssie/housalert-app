import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ClipboardCheck,
  MessageSquare,
  FileCheck,
  Send,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const SECTIONS = [
  {
    icon: ClipboardCheck,
    title: "Voor de bezichtiging",
    items: [
      "Lees de advertentie aandachtig door — noteer bijzonderheden en openstaande vragen.",
      "Bereid 3–5 vragen voor over de woning, de buurt en het huurcontract.",
      "Check de buurt vooraf: reistijd, supermarkten, OV-verbindingen en geluidsoverlast.",
      "Verzamel je documenten en introductiebrief zodat je ze direct kunt overhandigen.",
      "Kom minimaal 10 minuten eerder — eerste indruk telt.",
    ],
  },
  {
    icon: MessageSquare,
    title: "Tijdens de bezichtiging",
    items: [
      "Wees vriendelijk, beleefd en professioneel — stel jezelf kort voor.",
      "Stel slimme vragen: bijkomende kosten (Nebenkosten), huisregels, opzegtermijn.",
      "Toon oprechte interesse zonder te overdrijven — verhuurders merken dat.",
      "Vraag naar de verdere procedure: wanneer wordt de beslissing genomen?",
      "Maak een betrouwbare indruk: rustig, voorbereid en serieus.",
    ],
  },
  {
    icon: FileCheck,
    title: "Wat neem je mee",
    items: [
      "Kopie van je identiteitsbewijs (paspoort of ID-kaart).",
      "Je voorbereide introductiebrief — print of digitaal.",
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
      "Lever gevraagde documenten zo snel mogelijk aan — snelheid maakt verschil.",
      "Gebruik je introductiebrief als basis voor je opvolgbericht.",
      "Blijf beleefd en bondig — vermijd lange berichten of herhaald contact.",
      "Houd een lijst bij van bezichtigingen en contactgegevens.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Rode vlaggen",
    items: [
      "Onduidelijke of wisselende huurprijs of bijkomende kosten.",
      "Druk om snel te betalen of een aanbetaling te doen vóór het contract.",
      "Vreemde communicatie: alleen WhatsApp, geen vast adres, geen echte naam.",
      "Onvolledige of verdachte advertentiegegevens — controleer altijd de bron.",
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
    <div className="min-h-screen bg-[#F6F8FA] flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-[#E8EDF2]">
        <div className="max-w-xl mx-auto flex items-center h-[56px] px-5">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-9 h-9 rounded-full bg-[#F2F4F7] flex items-center justify-center mr-3"
            data-testid="button-back-tips"
          >
            <ArrowLeft className="w-4 h-4 text-[#6B7280]" />
          </button>
          <h1 className="text-[17px] font-bold text-[#0B1F44]">Bezichtigingtips</h1>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-5 pb-32">
        <div className="mb-6">
          <h2 className="text-[20px] font-bold text-[#0B1F44] mb-2" data-testid="text-tips-heading">
            Goed voorbereid naar een bezichtiging
          </h2>
          <p className="text-[14px] text-[#6B7280] leading-relaxed">
            In de Duitse huurmarkt is voorbereiding alles. Met deze tips vergroot je je kans op de woning.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden"
                data-testid={`card-tips-section-${idx}`}
              >
                <div className="flex items-center gap-3 p-5 pb-3">
                  <div className="w-9 h-9 rounded-full bg-[#EBF2FD] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4.5 h-4.5 text-[#2D6CDF]" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-[#0B1F44]">{section.title}</h3>
                </div>
                <div className="px-5 pb-5">
                  <ul className="flex flex-col gap-2.5">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2D6CDF] mt-2 flex-shrink-0" />
                        <span className="text-[13px] text-[#6B7280] leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8EDF2] p-4 z-10">
        <div className="max-w-xl mx-auto">
          {markedDone ? (
            <div className="flex items-center justify-center gap-2 h-[52px] text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-[15px] font-semibold">Voltooid!</span>
            </div>
          ) : (
            <Button
              onClick={() => markDoneMutation.mutate()}
              disabled={markDoneMutation.isPending}
              className="w-full h-[52px] rounded-xl text-[16px] font-semibold bg-[#2D6CDF] hover:bg-[#2560C8] disabled:opacity-50"
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
