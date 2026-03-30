import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { Check } from "lucide-react";
import { OBW, OBWebHeader, OBWebFooter, OBInfoBox, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";

const PREFERENCE_OPTIONS = [
  { value: "balcony", label: "Balkon" },
  { value: "garden", label: "Tuin" },
  { value: "bath", label: "Badkuip / bad" },
  { value: "energy_c", label: "Energielabel C of beter" },
  { value: "rooftop", label: "Dakterras" },
];

export default function OnboardingPreferences() {
  const [, navigate] = useLocation();
  const searchString = useHashSearch();
  const w = useWebsiteMode();
  const params = new URLSearchParams(searchString);

  const [amenities, setAmenities] = useState<string[]>(() => {
    const a = params.get("amenities");
    return a ? a.split(",").filter(Boolean) : [];
  });
  const [sendUnclear, setSendUnclear] = useState(() => {
    return params.get("sendUnclear") !== "false";
  });

  function toggleAmenity(a: string) {
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  function handleNext() {
    const outParams = new URLSearchParams(searchString);
    outParams.delete("source");
    outParams.delete("theme");

    if (amenities.length > 0) {
      outParams.set("amenities", amenities.join(","));
    } else {
      outParams.delete("amenities");
    }
    outParams.set("sendUnclear", String(sendUnclear));

    navigate(appendWebsiteParams(`/onboarding/password?${outParams.toString()}`, searchString));
  }

  function handleBack() {
    const backParams = new URLSearchParams(searchString);
    backParams.delete("source");
    backParams.delete("theme");
    if (amenities.length > 0) {
      backParams.set("amenities", amenities.join(","));
    } else {
      backParams.delete("amenities");
    }
    backParams.set("sendUnclear", String(sendUnclear));
    navigate(appendWebsiteParams(`/onboarding/filters?${backParams.toString()}`, searchString));
  }

  function handleClose() {
    navigate("/");
  }

  if (!w) {
    navigate("/onboarding/filters");
    return null;
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "#ffffff" }}
      data-testid="screen-onboarding-preferences"
    >
      <OBWebHeader step={3} onClose={handleClose} />

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-6 pb-[100px] overflow-y-auto">
        <h2
          className="text-[22px] font-bold tracking-[-0.02em] mb-1"
          style={{ color: OBW.text }}
          data-testid="text-preferences-title"
        >
          Specifieke woonwensen
        </h2>
        <p className="text-[13px] mb-4 leading-relaxed" style={{ color: OBW.textSecondary }}>
          Optioneel: geef aan welke extra's je belangrijk vindt.
        </p>

        <div className="mb-4">
          <OBInfoBox>
            Hoe meer wensen je selecteert, hoe minder resultaten je ontvangt. Selecteer alleen wat echt belangrijk is.
          </OBInfoBox>
        </div>

        <div className="flex flex-col gap-2" data-testid="preference-options">
          {PREFERENCE_OPTIONS.map((opt) => {
            const active = amenities.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleAmenity(opt.value)}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-[4px] text-left transition-all"
                style={{
                  border: active ? "1.5px solid #e91e63" : `1.5px solid ${OBW.cardBorder}`,
                  backgroundColor: active ? OBW.selectedBg : "#ffffff",
                }}
                data-testid={`preference-${opt.value}`}
              >
                <span className="text-[14px] font-medium" style={{ color: OBW.text }}>
                  {opt.label}
                </span>
                <div
                  className="w-[20px] h-[20px] rounded-[4px] flex items-center justify-center shrink-0"
                  style={{
                    border: active ? "none" : `1.5px solid ${OBW.chipBorder}`,
                    backgroundColor: active ? "#e91e63" : "transparent",
                  }}
                >
                  {active && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="h-px my-4" style={{ backgroundColor: OBW.divider }} />

        <button
          onClick={() => setSendUnclear(!sendUnclear)}
          className="w-full flex items-center justify-between px-3.5 py-3 rounded-[4px] text-left transition-all"
          style={{
            border: sendUnclear ? "1.5px solid #e91e63" : `1.5px solid ${OBW.cardBorder}`,
            backgroundColor: sendUnclear ? OBW.selectedBg : "#ffffff",
          }}
          data-testid="toggle-send-unclear"
        >
          <span className="text-[13px] leading-snug" style={{ color: OBW.text }}>
            Stuur ook woningen waarvan mijn criteria niet duidelijk zijn
          </span>
          <div
            className="w-[20px] h-[20px] rounded-[4px] flex items-center justify-center shrink-0 ml-3"
            style={{
              border: sendUnclear ? "none" : `1.5px solid ${OBW.chipBorder}`,
              backgroundColor: sendUnclear ? "#e91e63" : "transparent",
            }}
          >
            {sendUnclear && <Check className="w-3 h-3 text-white" />}
          </div>
        </button>
      </main>

      <OBWebFooter
        onBack={handleBack}
        onNext={handleNext}
        nextLabel="Volgende"
        backTestId="button-preferences-back"
        nextTestId="button-preferences-next"
      />
    </div>
  );
}
