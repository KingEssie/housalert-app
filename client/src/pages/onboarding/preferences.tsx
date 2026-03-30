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
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-[10px] text-left transition-all"
                style={{
                  border: active ? "1.5px solid #e91e63" : `1.5px solid ${OBW.cardBorder}`,
                  backgroundColor: active ? OBW.selectedBg : "#ffffff",
                }}
                data-testid={`preference-${opt.value}`}
              >
                <div
                  className="w-[20px] h-[20px] rounded-[5px] flex items-center justify-center shrink-0"
                  style={{
                    border: active ? "none" : `1.5px solid ${OBW.chipBorder}`,
                    backgroundColor: active ? "#e91e63" : "transparent",
                  }}
                >
                  {active && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-[14px] font-medium" style={{ color: OBW.text }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="h-px my-4" style={{ backgroundColor: OBW.divider }} />

        <label className="flex items-center gap-3 cursor-pointer" data-testid="toggle-send-unclear">
          <div
            className="w-[42px] h-[24px] rounded-full p-[2px] transition-colors shrink-0 cursor-pointer"
            style={{ backgroundColor: sendUnclear ? "#e91e63" : "#d1d5db" }}
            onClick={() => setSendUnclear(!sendUnclear)}
          >
            <div
              className="w-[20px] h-[20px] rounded-full bg-white transition-transform shadow-sm"
              style={{ transform: sendUnclear ? "translateX(18px)" : "translateX(0)" }}
            />
          </div>
          <span className="text-[13px] leading-snug" style={{ color: OBW.text }}>
            Stuur ook woningen waarvan mijn criteria niet duidelijk zijn
          </span>
        </label>
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
