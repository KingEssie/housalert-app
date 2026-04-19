import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { Info, Plus, X } from "lucide-react";
import { OBW, OBWebFooter, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
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

  const sLabel = "text-[15px] font-bold mb-3 block";

  const SUITABLE_FOR_OPTIONS = [
    { value: "studenten", label: t("onboardingWebPreferences.suitableStudents") },
    { value: "woningdelers", label: t("onboardingWebPreferences.suitableRoommates") },
    { value: "huisdieren", label: t("onboardingWebPreferences.suitablePets") },
  ];

  const ZOEKFILTER_ROWS: { key: keyof SearchFilters; label: string; info?: boolean }[] = [
    { key: "vrijeSector", label: t("onboardingWebPreferences.filterVrijeSector") },
    { key: "payToReply", label: t("onboardingWebPreferences.filterPayToReply"), info: true },
    { key: "loting", label: t("onboardingWebPreferences.filterLoting"), info: true },
  ];

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "#ffffff" }}
      data-testid="screen-onboarding-preferences"
    >
      {/* Header — matches 3/4 exactly: left badge | centered title | right X */}
      <header
        className="sticky top-0 z-20 w-full"
        style={{ backgroundColor: "#ffffff", borderBottom: `1px solid ${OBW.headerBorder}` }}
      >
        <div className="relative max-w-[480px] mx-auto px-4 h-[56px] flex items-center justify-between">
          <span
            className="text-[14px] font-bold rounded-[10px] shrink-0 flex items-center px-3.5"
            style={{ height: "32px", backgroundColor: "rgb(var(--ha-primary))", color: "#ffffff" }}
            data-testid="badge-step"
          >
            4/4
          </span>
          <span
            className="absolute inset-0 flex items-center justify-center text-[19px] font-bold pointer-events-none"
            style={{ color: OBW.text }}
          >
            {t("onboardingWebPreferences.headerTitle")}
          </span>
          <button
            onClick={handleClose}
            className="w-[36px] h-[36px] shrink-0 flex items-center justify-center rounded-full transition-opacity hover:opacity-70 active:opacity-50"
            style={{ backgroundColor: "#F2F2F2", color: "#444444" }}
            data-testid="button-preferences-close"
          >
            <X className="w-[22px] h-[22px]" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-6 pb-[100px] overflow-y-auto">

        {/* Search name */}
        <div className="mb-7">
          <label
            className="block text-[15px] font-semibold mb-2"
            style={{ color: OBW.text }}
            htmlFor="input-search-name"
          >
            {t("onboardingWebPreferences.searchNameLabel")}
          </label>
          <input
            id="input-search-name"
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="w-full ha-field-web"
            style={{
              backgroundColor: "#ffffff",
              borderColor: OBW.inputBorder,
              borderRadius: 6,
              color: "#111111",
            }}
            placeholder={city}
            data-testid="input-search-name"
          />
        </div>

        {/* Suitable for */}
        <section className="mb-7">
          <label className={sLabel} style={{ color: "#111111" }}>
            {t("onboardingWebPreferences.suitableForLabel")}
          </label>
          <div className="flex gap-1.5" data-testid="suitable-for-chips">
            {SUITABLE_FOR_OPTIONS.map((opt) => {
              const active = suitableFor.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleSuitableFor(opt.value)}
                  className="h-[36px] px-3 rounded-full text-[13px] font-medium border transition-all active:scale-[0.96] flex items-center gap-[4px] shrink-0"
                  style={{
                    backgroundColor: active ? "rgb(var(--ha-primary))" : "#F9FAFB",
                    borderColor: active ? "rgb(var(--ha-primary))" : "#D1D5DB",
                    color: active ? "#ffffff" : "#111111",
                  }}
                  data-testid={`chip-suitable-${opt.value}`}
                >
                  {!active && <Plus className="w-[11px] h-[11px] shrink-0" style={{ color: "#6B7280" }} />}
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Grey info box */}
          <div
            className="mt-4 rounded-[8px] flex items-start gap-2.5"
            style={{
              backgroundColor: "#F7F8F9",
              padding: "11px 13px",
            }}
          >
            <Info className="w-[13px] h-[13px] shrink-0 mt-[2px]" style={{ color: "#9CA3AF" }} />
            <p className="text-[12.5px] leading-[1.55]" style={{ color: "#374151" }}>
              {t("onboardingWebPreferences.suitableForInfo")}
            </p>
          </div>
        </section>

        {/* Search filter */}
        <section className="mb-7">
          <label className={sLabel} style={{ color: "#111111" }}>
            {t("onboardingWebPreferences.filterLabel")}
          </label>
          <div className="flex flex-col" data-testid="search-filter-rows">
            {ZOEKFILTER_ROWS.map((row) => {
              const checked = searchFilters[row.key];
              return (
                <button
                  key={row.key}
                  onClick={() => updateFilter(row.key, !checked)}
                  className="w-full flex items-start justify-between gap-3 py-[11px] text-left transition-colors"
                  data-testid={`toggle-filter-${row.key}`}
                >
                  <span className="text-[14px] leading-[1.45] flex-1" style={{ color: "#111111" }}>
                    {row.label}
                    {row.info && (
                      <Info
                        className="inline-block ml-1 relative"
                        style={{ width: 12, height: 12, color: "#9CA3AF", top: -1, verticalAlign: "middle" }}
                      />
                    )}
                  </span>
                  <div
                    className="w-[44px] h-[26px] rounded-full p-[3px] transition-colors shrink-0 flex items-center mt-[1px]"
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

        {/* Save settings */}
        <section className="mb-2">
          <label className={sLabel} style={{ color: "#111111" }}>
            {t("onboardingWebPreferences.settingsLabel")}
          </label>
          <button
            onClick={() => setApplyToAllProfiles(!applyToAllProfiles)}
            className="w-full flex items-start justify-between gap-3 py-[11px] text-left transition-colors"
            data-testid="toggle-apply-to-all"
          >
            <span className="text-[14px] leading-[1.45] flex-1" style={{ color: "#111111" }}>
              {t("onboardingWebPreferences.applyToAllLabel")}
            </span>
            <div
              className="w-[44px] h-[26px] rounded-full p-[3px] transition-colors shrink-0 flex items-center mt-[1px]"
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
