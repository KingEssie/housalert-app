import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { Info } from "lucide-react";
import { OBW, OBWebHeader, OBWebFooter, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
import { useTranslation } from "@/i18n";

interface SearchFilters {
  vrijeSector: boolean;
  payToReply: boolean;
  loting: boolean;
}

export default function OnboardingPreferences() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const searchString = useHashSearch();
  const w = useWebsiteMode();
  const params = new URLSearchParams(searchString);

  const city = params.get("city") || "";

  const [searchName, setSearchName] = useState(() => {
    return params.get("searchName") || city;
  });

  const [suitableFor, setSuitableFor] = useState<string[]>(() => {
    const s = params.get("suitableFor");
    return s ? s.split(",").filter(Boolean) : [];
  });

  const [searchFilters, setSearchFilters] = useState<SearchFilters>(() => ({
    vrijeSector: params.get("filterVrijeSector") !== "false",
    payToReply: params.get("filterPayToReply") !== "false",
    loting: params.get("filterLoting") !== "false",
  }));

  const [applyToAllProfiles, setApplyToAllProfiles] = useState(() => {
    return params.get("applyToAllProfiles") === "true";
  });

  if (!city) return <Redirect to="/onboarding/filters" />;

  function toggleSuitableFor(value: string) {
    setSuitableFor((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );
  }

  function updateFilter(key: keyof SearchFilters, value: boolean) {
    setSearchFilters((prev) => ({ ...prev, [key]: value }));
  }

  function buildOutParams(base: URLSearchParams) {
    base.delete("source");
    base.delete("theme");
    base.set("searchName", searchName.trim() || city);
    if (suitableFor.length > 0) {
      base.set("suitableFor", suitableFor.join(","));
    } else {
      base.delete("suitableFor");
    }
    base.set("filterVrijeSector", String(searchFilters.vrijeSector));
    base.set("filterPayToReply", String(searchFilters.payToReply));
    base.set("filterLoting", String(searchFilters.loting));
    base.set("applyToAllProfiles", String(applyToAllProfiles));
    return base;
  }

  function handleNext() {
    const outParams = buildOutParams(new URLSearchParams(searchString));

    if (w) {
      const appBase = import.meta.env.VITE_APP_URL || window.location.origin;
      const accountUrl = new URL(`${appBase}/onboarding/password`);
      accountUrl.searchParams.set("source", "website");
      accountUrl.searchParams.set("theme", "light");
      outParams.forEach((value, key) => {
        accountUrl.searchParams.set(key, value);
      });
      try {
        window.top!.location.href = accountUrl.toString();
      } catch {
        window.location.href = accountUrl.toString();
      }
      return;
    }

    navigate(appendWebsiteParams(`/onboarding/password?${outParams.toString()}`, searchString));
  }

  function handleBack() {
    const backParams = buildOutParams(new URLSearchParams(searchString));
    navigate(appendWebsiteParams(`/onboarding/filters?${backParams.toString()}`, searchString));
  }

  function handleClose() {
    navigate("/");
  }

  if (!w) {
    navigate("/onboarding/filters");
    return null;
  }

  const sLabel = "text-[15px] font-semibold mb-3 block";

  const SUITABLE_FOR_OPTIONS = [
    { value: "studenten", label: "Studenten" },
    { value: "woningdelers", label: "Woningdelers" },
    { value: "huisdieren", label: "Huisdieren" },
  ];

  const ZOEKFILTER_ROWS: { key: keyof SearchFilters; label: string; info?: boolean }[] = [
    { key: "vrijeSector", label: "Vrije sectorwoningen van woningcorporaties" },
    { key: "payToReply", label: "Woningen op websites waar je moet betalen om te reageren", info: true },
    { key: "loting", label: "Lotingwoningen (sociale huur)", info: true },
  ];

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "#ffffff" }}
      data-testid="screen-onboarding-preferences"
    >
      <OBWebHeader step={4} totalSteps={4} onClose={handleClose} />

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-[100px] overflow-y-auto">

        {/* Naam zoekopdracht */}
        <div className="mb-6">
          <label
            className="block text-[15px] font-semibold mb-2"
            style={{ color: OBW.text }}
            htmlFor="input-search-name"
          >
            Naam zoekopdracht
          </label>
          <input
            id="input-search-name"
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="w-full ha-field-web"
            style={{
              height: 48,
              backgroundColor: "#FAFAFA",
              borderColor: "#E5E7EB",
              color: OBW.text,
            }}
            placeholder={city}
            data-testid="input-search-name"
          />
        </div>

        <div className="h-px mb-6" style={{ backgroundColor: "rgba(0,0,0,0.07)" }} />

        {/* Woningen geschikt voor */}
        <section className="mb-6">
          <label className={sLabel} style={{ color: OBW.text }}>
            Woningen geschikt voor
          </label>
          <div className="flex flex-wrap gap-2" data-testid="suitable-for-chips">
            {SUITABLE_FOR_OPTIONS.map((opt) => {
              const active = suitableFor.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleSuitableFor(opt.value)}
                  className="h-[40px] px-5 rounded-full text-[14px] font-medium border transition-all active:scale-[0.96]"
                  style={{
                    backgroundColor: active ? "rgb(var(--ha-primary))" : "#F9FAFB",
                    borderColor: active ? "rgb(var(--ha-primary))" : "#E5E7EB",
                    color: active ? "#fff" : "#334855",
                  }}
                  data-testid={`chip-suitable-${opt.value}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Grey info box */}
          <div
            className="mt-4 rounded-[8px] flex items-center gap-3"
            style={{ backgroundColor: "#F3F4F6", padding: "14px 16px" }}
          >
            <Info className="w-[15px] h-[15px] shrink-0" style={{ color: "#6B7280" }} />
            <p className="text-[13px] leading-[1.6]" style={{ color: "#6B7280" }}>
              Selecteer welk type bewoner het beste bij de woning past. Laat leeg als dit niet uitmaakt.
            </p>
          </div>
        </section>

        <div className="h-px mb-6" style={{ backgroundColor: "rgba(0,0,0,0.07)" }} />

        {/* Zoekfilter */}
        <section className="mb-6">
          <label className={sLabel} style={{ color: OBW.text }}>
            Zoekfilter
          </label>
          <div className="flex flex-col" data-testid="search-filter-rows">
            {ZOEKFILTER_ROWS.map((row, i) => {
              const checked = searchFilters[row.key];
              return (
                <button
                  key={row.key}
                  onClick={() => updateFilter(row.key, !checked)}
                  className="w-full flex items-center justify-between py-[16px] text-left transition-colors"
                  style={{
                    borderBottom: i < ZOEKFILTER_ROWS.length - 1 ? "1px solid rgba(0,0,0,0.07)" : "none",
                  }}
                  data-testid={`toggle-filter-${row.key}`}
                >
                  <span className="flex items-center gap-1.5 text-[14px] leading-snug pr-4 flex-1" style={{ color: OBW.text }}>
                    {row.label}
                    {row.info && (
                      <Info className="w-[13px] h-[13px] shrink-0 inline-block" style={{ color: "#9CA3AF" }} />
                    )}
                  </span>
                  <div
                    className="w-[44px] h-[26px] rounded-full p-[3px] transition-colors shrink-0 flex items-center"
                    style={{ backgroundColor: checked ? "rgb(var(--ha-primary))" : "#E5E7EB" }}
                  >
                    <div
                      className="w-[20px] h-[20px] rounded-full bg-white transition-all"
                      style={{
                        transform: checked ? "translateX(18px)" : "translateX(0)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="h-px mb-6" style={{ backgroundColor: "rgba(0,0,0,0.07)" }} />

        {/* Instellingen opslaan */}
        <section className="mb-2">
          <label className={sLabel} style={{ color: OBW.text }}>
            Instellingen opslaan
          </label>
          <button
            onClick={() => setApplyToAllProfiles(!applyToAllProfiles)}
            className="w-full flex items-center justify-between py-[16px] text-left transition-colors"
            data-testid="toggle-apply-to-all"
          >
            <span className="text-[14px] leading-snug pr-4 flex-1" style={{ color: OBW.text }}>
              Bovenstaande zoekinstellingen toepassen op alle zoekprofielen
            </span>
            <div
              className="w-[44px] h-[26px] rounded-full p-[3px] transition-colors shrink-0 flex items-center"
              style={{ backgroundColor: applyToAllProfiles ? "rgb(var(--ha-primary))" : "#E5E7EB" }}
            >
              <div
                className="w-[20px] h-[20px] rounded-full bg-white transition-all"
                style={{
                  transform: applyToAllProfiles ? "translateX(18px)" : "translateX(0)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                }}
              />
            </div>
          </button>
        </section>

      </main>

      <OBWebFooter
        onBack={handleBack}
        onNext={handleNext}
        nextLabel={t("common.next")}
        backTestId="button-preferences-back"
        nextTestId="button-preferences-next"
      />
    </div>
  );
}
