import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { createSearchProfile } from "@/lib/search-profiles";
import { defaultCityNames } from "../../../config/market";
import { Bell, MapPin, Search, ChevronRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PROPERTY_TYPES = [
  { value: "studio", label: "Studio" },
  { value: "appartement", label: "Appartement" },
  { value: "kamer", label: "Kamer" },
  { value: "gedeeld", label: "Gedeeld appartement" },
  { value: "any", label: "Maakt niet uit" },
];

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 px-6 pt-6 pb-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-[4px] flex-1 rounded-full transition-colors duration-300"
          style={{ backgroundColor: i < step ? "#673DE5" : "#E5E7EB" }}
          data-testid={`progress-step-${i + 1}`}
        />
      ))}
      <span className="text-[13px] font-medium text-[#6B7280] ml-1 whitespace-nowrap">
        {step}/{total}
      </span>
    </div>
  );
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div
        className="w-[72px] h-[72px] rounded-[18px] bg-[#DCDBFA] flex items-center justify-center mb-8"
      >
        <Search className="w-8 h-8 text-[#673DE5]" />
      </div>

      <h1
        className="text-[28px] font-bold leading-tight text-[#111827] mb-4 max-w-[320px]"
        data-testid="text-welcome-title"
      >
        Vind huurwoningen sneller dan iedereen
      </h1>

      <p
        className="text-[16px] leading-relaxed text-[#6B7280] mb-10 max-w-[320px]"
        data-testid="text-welcome-subtitle"
      >
        Wij verzamelen woningen van meerdere websites en sturen je direct een match zodra er iets nieuws verschijnt.
      </p>

      <button
        onClick={onStart}
        className="w-full max-w-[320px] min-h-[52px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white font-semibold text-[16px] transition-colors flex items-center justify-center gap-2"
        data-testid="button-start-onboarding"
      >
        Start met zoeken
        <ChevronRight className="w-5 h-5" />
      </button>

      <p className="text-[13px] text-[#9CA3AF] mt-4" data-testid="text-duration-hint">
        Duurt minder dan 1 minuut
      </p>
    </div>
  );
}

function CityStep({
  city,
  setCity,
  onNext,
}: {
  city: string;
  setCity: (v: string) => void;
  onNext: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return defaultCityNames;
    const q = query.toLowerCase();
    return defaultCityNames.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="flex flex-col min-h-screen px-6 pt-4">
      <div className="flex-1">
        <div className="w-[56px] h-[56px] rounded-[14px] bg-[#DCDBFA] flex items-center justify-center mb-6">
          <MapPin className="w-6 h-6 text-[#673DE5]" />
        </div>

        <h2 className="text-[24px] font-bold text-[#111827] mb-2" data-testid="text-city-title">
          Waar wil je wonen?
        </h2>
        <p className="text-[15px] text-[#6B7280] mb-6">
          Kies de stad waar je een woning zoekt.
        </p>

        <div className="relative">
          <input
            type="text"
            placeholder="Zoek een stad..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full min-h-[52px] rounded-[14px] bg-[#F3F4F6] border border-[#E5E7EB] px-4 text-[16px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#673DE5] focus:border-transparent"
            data-testid="input-city-search"
          />

          {open && filtered.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E5E7EB] rounded-[14px] shadow-lg max-h-[240px] overflow-y-auto z-10">
              {filtered.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCity(c);
                    setQuery(c);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-[15px] transition-colors first:rounded-t-[14px] last:rounded-b-[14px] ${
                    city === c
                      ? "bg-[#DCDBFA] text-[#673DE5] font-semibold"
                      : "text-[#111827] hover:bg-[#F8FAFC]"
                  }`}
                  data-testid={`option-city-${c}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {city && (
          <div className="mt-4 inline-flex items-center gap-2 bg-[#DCDBFA] text-[#673DE5] font-semibold text-[14px] px-4 py-2 rounded-full">
            <MapPin className="w-4 h-4" />
            {city}
          </div>
        )}
      </div>

      <div className="pb-8 pt-4">
        <button
          onClick={onNext}
          disabled={!city}
          className="w-full min-h-[52px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white font-semibold text-[16px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="button-city-next"
        >
          Volgende
        </button>
      </div>
    </div>
  );
}

function BudgetStep({
  minPrice,
  maxPrice,
  setMinPrice,
  setMaxPrice,
  onNext,
}: {
  minPrice: string;
  maxPrice: string;
  setMinPrice: (v: string) => void;
  setMaxPrice: (v: string) => void;
  onNext: () => void;
}) {
  const valid =
    maxPrice.trim() !== "" &&
    Number(maxPrice) > 0 &&
    (minPrice.trim() === "" || Number(minPrice) < Number(maxPrice));

  return (
    <div className="flex flex-col min-h-screen px-6 pt-4">
      <div className="flex-1">
        <div className="w-[56px] h-[56px] rounded-[14px] bg-[#DCDBFA] flex items-center justify-center mb-6">
          <span className="text-[24px] font-bold text-[#673DE5]">€</span>
        </div>

        <h2 className="text-[24px] font-bold text-[#111827] mb-2" data-testid="text-budget-title">
          Wat is je maandbudget?
        </h2>
        <p className="text-[15px] text-[#6B7280] mb-6">
          We zoeken alleen woningen binnen je prijsklasse.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#6B7280] mb-1.5">
              Minimale huurprijs (optioneel)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[15px]">€</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full min-h-[52px] rounded-[14px] bg-[#F3F4F6] border border-[#E5E7EB] pl-9 pr-4 text-[16px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#673DE5] focus:border-transparent"
                data-testid="input-min-price"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#6B7280] mb-1.5">
              Maximale huurprijs
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[15px]">€</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="1500"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full min-h-[52px] rounded-[14px] bg-[#F3F4F6] border border-[#E5E7EB] pl-9 pr-4 text-[16px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#673DE5] focus:border-transparent"
                data-testid="input-max-price"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pb-8 pt-4">
        <button
          onClick={onNext}
          disabled={!valid}
          className="w-full min-h-[52px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white font-semibold text-[16px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="button-budget-next"
        >
          Volgende
        </button>
      </div>
    </div>
  );
}

function PropertyTypeStep({
  propertyType,
  setPropertyType,
  onNext,
}: {
  propertyType: string;
  setPropertyType: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col min-h-screen px-6 pt-4">
      <div className="flex-1">
        <div className="w-[56px] h-[56px] rounded-[14px] bg-[#DCDBFA] flex items-center justify-center mb-6">
          <Search className="w-6 h-6 text-[#673DE5]" />
        </div>

        <h2 className="text-[24px] font-bold text-[#111827] mb-2" data-testid="text-property-title">
          Wat zoek je?
        </h2>
        <p className="text-[15px] text-[#6B7280] mb-6">
          Kies het type woning dat je zoekt.
        </p>

        <div className="space-y-3">
          {PROPERTY_TYPES.map((pt) => (
            <button
              key={pt.value}
              onClick={() => setPropertyType(pt.value)}
              className={`w-full min-h-[56px] rounded-[14px] border-2 px-5 text-left text-[16px] font-medium transition-all flex items-center justify-between ${
                propertyType === pt.value
                  ? "border-[#673DE5] bg-[#DCDBFA] text-[#673DE5]"
                  : "border-[#E5E7EB] bg-white text-[#111827] hover:border-[#673DE5]/40"
              }`}
              data-testid={`option-property-${pt.value}`}
            >
              {pt.label}
              {propertyType === pt.value && (
                <div className="w-6 h-6 rounded-full bg-[#673DE5] flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-8 pt-4">
        <button
          onClick={onNext}
          disabled={!propertyType}
          className="w-full min-h-[52px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white font-semibold text-[16px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="button-property-next"
        >
          Volgende
        </button>
      </div>
    </div>
  );
}

function AlertsStep({ onActivate, saving }: { onActivate: () => void; saving: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="w-[72px] h-[72px] rounded-[18px] bg-[#DCDBFA] flex items-center justify-center mb-8">
        <Bell className="w-8 h-8 text-[#673DE5]" />
      </div>

      <h2
        className="text-[24px] font-bold text-[#111827] mb-3 max-w-[300px]"
        data-testid="text-alerts-title"
      >
        Mis nooit een nieuwe woning
      </h2>

      <p className="text-[16px] text-[#6B7280] mb-10 max-w-[300px] leading-relaxed">
        Je krijgt direct een melding zodra er een nieuwe match verschijnt.
      </p>

      <button
        onClick={onActivate}
        disabled={saving}
        className="w-full max-w-[320px] min-h-[52px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white font-semibold text-[16px] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        data-testid="button-activate-alerts"
      >
        {saving ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            🔔 Zet meldingen aan
          </>
        )}
      </button>
    </div>
  );
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [city, setCity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleActivate() {
    if (!user) return;
    setSaving(true);
    try {
      await createSearchProfile({
        user_id: user.id,
        city,
        price_min: minPrice ? Number(minPrice) : 0,
        price_max: Number(maxPrice),
        bedrooms_min: 1,
        size_min: 0,
      });

      try {
        const session = await (await import("@/lib/supabase")).supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          await fetch("/api/notifications/settings", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              email_enabled: true,
              sms_enabled: false,
              whatsapp_enabled: false,
              phone_e164: null,
            }),
          });
        }
      } catch {
      }

      try {
        const session = await (await import("@/lib/supabase")).supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          await fetch("/api/search-profiles/backfill", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ city }),
          });
        }
      } catch {
      }

      navigate("/dashboard?tab=matches");
    } catch (err: any) {
      toast({
        title: "Er ging iets mis",
        description: err?.message ?? "Probeer het opnieuw.",
        variant: "destructive",
      });
      setSaving(false);
    }
  }

  if (step === 0) {
    return <WelcomeStep onStart={() => setStep(1)} />;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ProgressBar step={step} total={4} />

      {step === 1 && (
        <CityStep city={city} setCity={setCity} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <BudgetStep
          minPrice={minPrice}
          maxPrice={maxPrice}
          setMinPrice={setMinPrice}
          setMaxPrice={setMaxPrice}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <PropertyTypeStep
          propertyType={propertyType}
          setPropertyType={setPropertyType}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <AlertsStep onActivate={handleActivate} saving={saving} />
      )}
    </div>
  );
}
