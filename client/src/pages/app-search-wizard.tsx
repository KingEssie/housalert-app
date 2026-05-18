import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { useGeocoderSearch } from "@/hooks/use-geocoder-search";
import { queryClient } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api-base";
import { supabase } from "@/lib/supabase";
import {
  createSearchProfile,
  updateSearchProfile,
  getSearchProfile,
  getSearchProfiles,
  deleteSearchProfile,
} from "@/lib/search-profiles";
import {
  matchEstimateQueryKey,
  fetchMatchEstimate,
  type MatchEstimateResult,
  type NormalizedFilters,
} from "@/lib/match-estimate";
import { OBW } from "@/components/onboarding-ui";
import { HousAlertLogo } from "@/components/housalert-logo";
import MapView from "@/components/map-view";
import { defaultCities, cityDistricts } from "../../../config/market";
import {
  X, ChevronLeft, Check, ChevronDown, Search, Bath, Sun, Trees, Leaf,
  Info, Loader2, AlertCircle, Plus, MoreVertical, Trash2,
} from "lucide-react";

const MAX_PROFILES = 4;
const RADIUS_OPTIONS = [2, 5, 10, 15, 25, 50];
const TOP_CITIES = defaultCities.slice(0, 5);

// ── Inline slider / toggle components (match filters.tsx website versions) ────

function DualRangeSlider({
  min, max, step, valueLow, valueHigh, onChangeLow, onChangeHigh, formatLabel, testId,
}: {
  min: number; max: number; step: number;
  valueLow: number; valueHigh: number;
  onChangeLow: (v: number) => void;
  onChangeHigh: (v: number) => void;
  formatLabel: (v: number) => string;
  testId: string;
}) {
  const inactive = "rgb(var(--ha-card-border))";
  const primary = "#bbadfb";
  const pL = ((valueLow - min) / (max - min)) * 100;
  const pH = ((valueHigh - min) / (max - min)) * 100;
  const bg = `linear-gradient(to right,${inactive} 0%,${inactive} ${pL}%,${primary} ${pL}%,${primary} ${pH}%,${inactive} ${pH}%,${inactive} 100%)`;
  return (
    <div data-testid={testId}>
      <div className="flex justify-between mb-2">
        <span className="text-[14px] font-semibold" style={{ color: "#111111" }}>{formatLabel(valueLow)}</span>
        <span className="text-[14px] font-semibold" style={{ color: "#111111" }}>{formatLabel(valueHigh)}</span>
      </div>
      <div className="relative h-[36px]">
        <input type="range" min={min} max={max} step={step} value={valueLow}
          onChange={(e) => { const v = Number(e.target.value); if (v <= valueHigh) onChangeLow(v); }}
          className="w-full absolute inset-0 dual-range-thumb"
          style={{ background: bg, zIndex: valueLow > max - step ? 3 : 1 }}
          data-testid="slider-min-price" />
        <input type="range" min={min} max={max} step={step} value={valueHigh}
          onChange={(e) => { const v = Number(e.target.value); if (v >= valueLow) onChangeHigh(v); }}
          className="w-full absolute inset-0 dual-range-thumb"
          style={{ background: "transparent", zIndex: 2 }}
          data-testid="slider-max-price" />
      </div>
    </div>
  );
}

function RangeSlider({
  min, max, step, value, onChange, formatLabel, testId,
}: {
  min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; formatLabel: (v: number) => string; testId: string;
}) {
  const primary = "#bbadfb";
  const inactive = "rgb(var(--ha-card-border))";
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div data-testid={testId}>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ background: `linear-gradient(to right,${primary} 0%,${primary} ${pct}%,${inactive} ${pct}%,${inactive} 100%)` }} />
      <div className="flex justify-between mt-1">
        <span className="text-[12px]" style={{ color: "#111111" }}>{formatLabel(min)}</span>
        <span className="text-[13px] font-semibold" style={{ color: "#111111" }}>{formatLabel(value)}</span>
        <span className="text-[12px]" style={{ color: "#111111" }}>{formatLabel(max)}</span>
      </div>
    </div>
  );
}

function WebToggle({ checked, onChange, label, testId }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; testId: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer h-[52px] px-4 rounded-[10px]"
      style={{ border: "1px solid rgb(var(--ha-card-border))" }} data-testid={testId}>
      <div className="w-[44px] h-[26px] rounded-full p-[3px] transition-colors shrink-0 flex items-center"
        style={{ backgroundColor: checked ? "#bbadfb" : "rgb(var(--ha-card-border))" }}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}>
        <div className="w-[20px] h-[20px] rounded-full bg-white transition-all"
          style={{ transform: checked ? "translateX(18px)" : "translateX(0)", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
      </div>
      <span className="text-[15px] leading-snug flex-1" style={{ color: OBW.text }}>{label}</span>
    </label>
  );
}

function PrefsToggle({ checked, onChange, label, info, testId }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; info?: boolean; testId: string;
}) {
  return (
    <button onClick={() => onChange(!checked)}
      className="w-full flex items-start justify-between gap-3 py-[11px] text-left transition-colors"
      data-testid={testId}>
      <span className="text-[14px] leading-[1.45] flex-1" style={{ color: "rgb(var(--ha-text))" }}>
        {label}
        {info && <Info className="inline-block ml-1 relative" style={{ width: 12, height: 12, color: "rgb(var(--ha-text-placeholder))", top: -1, verticalAlign: "middle" }} />}
      </span>
      <div className="w-[44px] h-[26px] rounded-full p-[3px] transition-colors shrink-0 flex items-center mt-[1px]"
        style={{ backgroundColor: checked ? "#bbadfb" : "rgb(var(--ha-card-border))" }}>
        <div className="w-[20px] h-[20px] rounded-full bg-white transition-all"
          style={{ transform: checked ? "translateX(18px)" : "translateX(0)", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
      </div>
    </button>
  );
}

// ── Data types ────────────────────────────────────────────────────────────────

interface CityState {
  name: string;
  lat: number;
  lng: number;
}

interface LocState {
  mode: "city" | "districts" | "radius";
  districts: string[];
  radiusKm: number;
}

interface FilterState {
  minPrice: number;
  maxPrice: number;
  priceFlexible: boolean;
  propertyType: string;
  includeRooms: boolean;
  minRooms: string;
  minSize: number;
  sizeNA: boolean;
  furnished: string;
  amenities: string[];
  sendUnclear: boolean;
}

interface PrefState {
  searchName: string;
  suitableFor: string[];
  vrijeSector: boolean;
  payToReply: boolean;
  loting: boolean;
}

const INIT_FILTERS: FilterState = {
  minPrice: 0, maxPrice: 1500, priceFlexible: false,
  propertyType: "any", includeRooms: false,
  minRooms: "any", minSize: 30, sizeNA: false,
  furnished: "any", amenities: [], sendUnclear: true,
};

const INIT_PREFS: PrefState = {
  searchName: "", suitableFor: [],
  vrijeSector: true, payToReply: true, loting: true,
};

// ── Page header shared across all steps ──────────────────────────────────────

function StepHeader({ step, total = 4, onClose }: { step: number; total?: number; onClose: () => void }) {
  const progress = total > 0 ? (step / total) * 100 : 0;
  return (
    <div className="sticky top-0 z-20 w-full bg-white" style={{ borderBottom: `1px solid ${OBW.headerBorder}` }}>
      <div className="max-w-[480px] mx-auto px-5 h-[52px] flex items-center justify-between">
        <HousAlertLogo size={24} />
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full tabular-nums"
            style={{ backgroundColor: "#bbadfb", color: "#171429" }}
            data-testid="badge-step"
          >
            {step}/{total}
          </span>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-ha-surface hover:bg-ha-card-border transition-colors"
            data-testid="button-step-close"
          >
            <X className="w-[18px] h-[18px] text-ha-text-secondary" />
          </button>
        </div>
      </div>
      <div className="h-[4px] bg-ha-card-border overflow-hidden">
        <div
          className="h-full bg-ha-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── Edit-mode top bar (Rentbird style) ───────────────────────────────────────

function EditHeader({ cityName, onBack, onMenu }: { cityName: string; onBack: () => void; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 w-full bg-white">
      <div className="max-w-[480px] mx-auto px-3.5 h-[52px] flex items-center gap-2">
        <button
          onClick={onBack}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-ha-card-border hover:bg-ha-border-input active:bg-ha-border-input transition-colors"
          data-testid="button-edit-back"
        >
          <ChevronLeft className="w-[18px] h-[18px] text-ha-text-secondary" />
        </button>
        <span className="flex-1 text-[17px] font-semibold truncate" style={{ color: OBW.text }} data-testid="text-edit-city">
          {cityName}
        </span>
        <button
          onClick={onMenu}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-ha-card-border hover:bg-ha-border-input active:bg-ha-border-input transition-colors"
          data-testid="button-edit-menu"
        >
          <MoreVertical className="w-[18px] h-[18px] text-ha-text-secondary" />
        </button>
      </div>
    </header>
  );
}

// ── Edit-mode tab navigation (Locatie / Woonwensen / Zoekfilters) ─────────────

function EditTabBar({ activeStep, onStep }: { activeStep: number; onStep: (s: number) => void }) {
  const tabs = [
    { step: 2, label: "Locatie" },
    { step: 3, label: "Woonwensen" },
    { step: 4, label: "Zoekfilters" },
  ];
  return (
    <div className="sticky top-[52px] z-10 bg-white border-b border-ha-card-border pt-1">
      <div className="max-w-[480px] mx-auto flex">
        {tabs.map(({ step, label }) => {
          const active = activeStep === step;
          return (
            <button
              key={step}
              onClick={() => onStep(step)}
              className="relative flex-1 text-center pt-3 pb-2.5 text-[14px] transition-colors whitespace-nowrap"
              style={{
                color: active ? "rgb(var(--ha-text))" : "rgb(var(--ha-text-secondary))",
                fontWeight: active ? 600 : 500,
              }}
              data-testid={`tab-edit-section-${step}`}
            >
              {label}
              {active && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                  style={{ backgroundColor: "rgb(var(--ha-primary))" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared footer with match count ────────────────────────────────────────────

function StepFooter({
  estimate, fetching, onBack, onNext, nextLabel, nextDisabled, saving,
  showCount = true, editMode = false,
}: {
  estimate: MatchEstimateResult | null | undefined;
  fetching: boolean;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  saving?: boolean;
  showCount?: boolean;
  editMode?: boolean;
}) {
  const { t } = useTranslation();
  const count = estimate?.matchesLast7Days ?? null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30"
      style={{
        backgroundColor: OBW.footerBg,
        borderTop: `1px solid ${OBW.footerBorder}`,
        paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))",
      }}
    >
      <div className={`max-w-[480px] mx-auto px-5 ${editMode ? "py-2" : "py-2.5"} flex items-center gap-3`}>
        {showCount && (
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.06em]" style={{ color: OBW.textMuted }}>
              {t("onboardingUI.estimatedMatches")}
            </p>
            <p className="text-[16px] font-semibold flex items-center gap-1" style={{ color: OBW.text }}>
              {fetching ? (
                <span style={{ opacity: 0.5 }}>…</span>
              ) : count != null ? (
                <>{Math.max(1, count)} {t("onboardingUI.perWeek")}{Math.max(1, count) > 10 ? " 🔥" : ""}</>
              ) : (
                <>— {t("onboardingUI.perWeek")}</>
              )}
            </p>
          </div>
        )}
        {!showCount && <div className="flex-1" />}
        {editMode ? (
          <button
            onClick={onBack}
            className="h-[44px] px-5 rounded-full text-[14px] font-semibold flex items-center justify-center gap-1 shrink-0 active:scale-95 transition-transform"
            style={{ border: `1.5px solid ${OBW.backBtnBorder}`, color: OBW.text, backgroundColor: "transparent" }}
            data-testid="button-step-back"
          >
            <ChevronLeft className="w-[16px] h-[16px]" />
            {t("common.back")}
          </button>
        ) : (
          <button
            onClick={onBack}
            className="w-[44px] h-[44px] rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            style={{ border: `1.5px solid ${OBW.backBtnBorder}`, backgroundColor: "transparent" }}
            data-testid="button-step-back"
          >
            <ChevronLeft className="w-[17px] h-[17px]" style={{ color: OBW.backBtnColor }} />
          </button>
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled || saving}
          className={`${editMode ? "min-w-[120px]" : "min-w-[120px]"} px-6 h-[44px] rounded-full text-[14px] font-semibold transition-all active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-1.5 shrink-0`}
          style={{ background: OBW.primary, color: "#223546", boxShadow: (nextDisabled || saving) ? "none" : "0 4px 14px rgb(var(--ha-primary) / 0.2)" }}
          data-testid="button-step-next"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

// ── Main wizard component ─────────────────────────────────────────────────────

export default function AppSearchWizard() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [, params] = useRoute("/dashboard/searches/edit/:id");
  const editId = params?.id ?? null;
  const isEdit = !!editId;

  // ── Global wizard state ──
  const [step, setStep] = useState(1);
  const [editLoaded, setEditLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Step 1: city ──
  const [search, setSearch] = useState("");
  const [city, setCity] = useState<CityState | null>(null);
  const geocoder = useGeocoderSearch({ debounceMs: 300, minChars: 3, limit: 5 });

  // ── Step 2: location ──
  const [loc, setLoc] = useState<LocState>({ mode: "city", districts: [], radiusKm: 5 });
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);

  // ── Step 3: filters ──
  const [f, setF] = useState<FilterState>(INIT_FILTERS);
  const [debouncedF, setDebouncedF] = useState<FilterState>(INIT_FILTERS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPriceInfo, setShowPriceInfo] = useState(false);

  // ── Step 4: prefs ──
  const [pref, setPref] = useState<PrefState>(INIT_PREFS);

  // ── Profile count check for create mode ──
  const profilesQuery = useQuery({
    queryKey: ["/search-profiles"],
    queryFn: getSearchProfiles,
    enabled: !!user,
  });
  const atLimit = !isEdit && (profilesQuery.data?.length ?? 0) >= MAX_PROFILES;

  // ── Load existing profile for edit mode ──
  useEffect(() => {
    if (!editId || editLoaded) return;
    getSearchProfile(editId).then((profile) => {
      if (!profile) {
        toast({ title: t("newSearch.toasts.notFound"), variant: "destructive" });
        navigate("/home");
        return;
      }
      setCity({
        name: profile.city_name || profile.city || "",
        lat: profile.latitude || 52.52,
        lng: profile.longitude || 13.405,
      });
      const rawMode = profile.location_mode;
      const mode: LocState["mode"] =
        rawMode === "radius" ? "radius"
        : rawMode === "districts" ? "districts"
        : "city";
      setLoc({
        mode,
        districts: profile.districts || [],
        radiusKm: profile.radius_km || 5,
      });
      const rawMinSize = profile.size_min || 0;
      const rawMinRooms = profile.bedrooms_min || 0;
      setF({
        minPrice: profile.price_min || 0,
        maxPrice: profile.price_max || 1500,
        priceFlexible: profile.price_flexible === true,
        propertyType: profile.property_types?.[0] || "any",
        includeRooms: false,
        minRooms: rawMinRooms === 0 ? "any" : String(rawMinRooms),
        minSize: rawMinSize,
        sizeNA: rawMinSize === 0,
        furnished: profile.furnished || "any",
        amenities: profile.extra_features || [],
        sendUnclear: profile.send_unclear !== false,
      });
      setPref({
        searchName: profile.search_name || "",
        suitableFor: profile.target_categories || [],
        vrijeSector: true,
        payToReply: true,
        loting: true,
      });
      setSearch(profile.city_name || profile.city || "");
      setEditLoaded(true);
      setStep(2);
    });
  }, [editId, editLoaded, navigate, toast, t]);

  // ── Debounce filters for estimate ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedF(f), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [f]);

  // ── Debounce loc for estimate (loc step) ──
  const [debouncedLoc, setDebouncedLoc] = useState(loc);
  const locDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (locDebounceRef.current) clearTimeout(locDebounceRef.current);
    locDebounceRef.current = setTimeout(() => setDebouncedLoc(loc), 600);
    return () => { if (locDebounceRef.current) clearTimeout(locDebounceRef.current); };
  }, [loc]);

  // ── Match estimate (steps 2 & 3) ──
  const estimateFilters: NormalizedFilters = {
    city: city?.name || "",
    location_mode: debouncedLoc.mode === "radius" ? "radius"
      : debouncedLoc.mode === "districts" && debouncedLoc.districts.length > 0 ? "districts"
      : "city",
    latitude: city?.lat,
    longitude: city?.lng,
    radius_km: debouncedLoc.mode === "radius" ? debouncedLoc.radiusKm : undefined,
    districts: debouncedLoc.mode === "districts" && debouncedLoc.districts.length > 0 ? debouncedLoc.districts : undefined,
    price_min: step >= 3 ? debouncedF.minPrice : 0,
    price_max: step >= 3 ? debouncedF.maxPrice : 0,
    bedrooms_min: step >= 3 ? (debouncedF.minRooms === "any" ? 0 : parseInt(debouncedF.minRooms, 10)) : 0,
    size_min: step >= 3 ? (debouncedF.sizeNA ? 0 : debouncedF.minSize) : 0,
    furnished: step >= 3 && debouncedF.furnished !== "any" ? debouncedF.furnished : undefined,
    property_types: step >= 3 && debouncedF.propertyType !== "any" ? [debouncedF.propertyType] : undefined,
    extra_features: step >= 3 && debouncedF.amenities.length > 0 ? debouncedF.amenities : undefined,
    send_unclear: step >= 3 ? debouncedF.sendUnclear : true,
    price_flexible: step >= 3 ? debouncedF.priceFlexible : false,
    include_rooms: step >= 3 ? debouncedF.includeRooms : undefined,
  };
  const { data: estimate, isFetching: estimateFetching } = useQuery<MatchEstimateResult>({
    queryKey: matchEstimateQueryKey(estimateFilters),
    queryFn: () => fetchMatchEstimate(estimateFilters),
    enabled: !!city?.name && step >= 2,
    staleTime: 2 * 60 * 1000,
  });

  // ── Navigation helpers ──
  function goClose() {
    if (window.history.length > 1) window.history.back();
    else navigate("/home");
  }
  function goBack() {
    if (step === 1 || (isEdit && step === 2)) goClose();
    else setStep((s) => s - 1);
  }

  // ── Delete handler ──
  async function handleDelete() {
    if (!editId) return;
    setDeleting(true);
    try {
      await deleteSearchProfile(editId);
      queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      toast({ title: t("filters.deleted") });
      navigate("/home");
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  // ── Submit (step 4) ──
  async function handleSave() {
    if (!user || !city) return;
    setSubmitting(true);
    try {
      const locationMode = loc.mode === "districts" && loc.districts.length > 0 ? "districts"
        : loc.mode === "radius" ? "radius"
        : "city";

      const payload: Parameters<typeof createSearchProfile>[0] = {
        user_id: user.id,
        city_name: city.name,
        country_code: "DE",
        latitude: city.lat,
        longitude: city.lng,
        place_id: city.name.toLowerCase().replace(/\s+/g, "_") + "_de",
        price_min: f.minPrice,
        price_max: f.maxPrice,
        bedrooms_min: f.minRooms === "any" ? 0 : parseInt(f.minRooms, 10),
        size_min: f.sizeNA ? 0 : f.minSize,
        location_mode: locationMode,
        districts: locationMode === "districts" ? loc.districts : undefined,
        radius_km: locationMode === "radius" ? loc.radiusKm : undefined,
        furnished: f.furnished !== "any" ? f.furnished : undefined,
        property_types: f.propertyType !== "any" ? [f.propertyType] : undefined,
        extra_features: f.amenities.length > 0 ? f.amenities : undefined,
        target_categories: pref.suitableFor.length > 0 ? pref.suitableFor : undefined,
        send_unclear: f.sendUnclear,
        price_flexible: f.priceFlexible,
        search_name: pref.searchName.trim() || undefined,
      };

      if (isEdit && editId) {
        await updateSearchProfile(editId, payload);
        const { data: sd } = await supabase.auth.getSession();
        if (sd?.session?.access_token) {
          apiFetch("/api/search-profiles/backfill", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sd.session.access_token}` },
            body: JSON.stringify({ searchProfileId: editId }),
          }).catch(() => {});
        }
        queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
        queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
        toast({ title: t("newSearch.toasts.updated"), description: t("newSearch.toasts.updatedDesc") });
      } else {
        const created = await createSearchProfile(payload);
        if (created?.id) {
          const { data: sd } = await supabase.auth.getSession();
          if (sd?.session?.access_token) {
            apiFetch("/api/search-profiles/backfill", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${sd.session.access_token}` },
              body: JSON.stringify({ searchProfileId: created.id }),
            }).catch(() => {});
          }
        }
        queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
        queryClient.invalidateQueries({ queryKey: ["/api/activation-status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
        toast({ title: t("newSearch.toasts.created"), description: t("newSearch.toasts.createdDesc") });
      }

      if (window.history.length > 1) window.history.back();
      else navigate("/home");
    } catch (err: any) {
      toast({ title: t("common.error"), description: err?.message || t("newSearch.toasts.saveFailedDesc"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading state ──
  if (loading || (isEdit && !editLoaded)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: "rgb(var(--ha-bg))" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "rgb(var(--ha-primary))" }} />
      </div>
    );
  }

  if (!user) { navigate("/"); return null; }

  // ── Profile limit screen ──
  if (atLimit) {
    return (
      <div className="min-h-[100dvh] flex flex-col" style={{ background: "rgb(var(--ha-bg))" }}>
        <StepHeader step={1} onClose={goClose} />
        <div className="flex-1 flex items-center justify-center px-5 pb-10">
          <div className="text-center max-w-sm w-full">
            <div className="w-16 h-16 rounded-2xl bg-ha-surface flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-7 h-7" style={{ color: "rgb(var(--ha-primary))" }} />
            </div>
            <h2 className="text-[26px] font-bold mb-2" style={{ color: "rgb(var(--ha-text))" }}>{t("newSearch.limitTitle")}</h2>
            <p className="text-[16px] leading-relaxed mb-7" style={{ color: OBW.textSecondary }}>
              {t("newSearch.limitDesc", { max: MAX_PROFILES })}
            </p>
            <button onClick={goClose}
              className="w-full h-[48px] rounded-[10px] text-white text-[15px] font-semibold"
              style={{ background: OBW.primary }}>
              {t("newSearch.backToDashboard")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1 — CITY
  // ═══════════════════════════════════════════════════════════════════
  if (step === 1) {
    const presetMatches = search.trim().length > 0
      ? TOP_CITIES.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      : TOP_CITIES;

    function selectCity(name: string, lat: number, lng: number) {
      setCity({ name, lat, lng });
      setSearch(name);
      const districtList = cityDistricts[name] || [];
      setLoc((prev) => ({ ...prev, mode: districtList.length > 0 ? "districts" : "city" }));
      if (!pref.searchName) setPref((p) => ({ ...p, searchName: name }));
      setStep(2);
    }

    return (
      <div className="min-h-[100dvh] flex flex-col" style={{ background: "rgb(var(--ha-bg))" }}
        data-testid="screen-wizard-city">
        <StepHeader step={1} onClose={goClose} />

        <main className="flex-1 max-w-[480px] mx-auto w-full px-5 pt-6 pb-[100px] overflow-y-auto">
          {/* Search input */}
          <div className="relative mb-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] pointer-events-none" style={{ color: OBW.textMuted }} />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); if (e.target.value.length >= 3) geocoder.search(e.target.value); }}
              placeholder={t("onboarding.city.searchPlaceholder")}
              className="w-full ha-field-web pr-4"
              style={{ borderColor: OBW.inputBorder, color: OBW.text, paddingLeft: "44px" }}
              autoFocus
              data-testid="input-city-search"
            />
          </div>

          {/* Geocoder results */}
          {geocoder.results.length > 0 && search.length >= 3 && (
            <div className="mb-5 rounded-[12px] overflow-hidden border" style={{ borderColor: "rgb(var(--ha-divider))" }}>
              {geocoder.results.map((r, i) => (
                <button key={i}
                  onClick={() => selectCity(r.city_name, r.latitude, r.longitude)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ha-surface transition-colors text-left"
                  style={{ borderBottom: i < geocoder.results.length - 1 ? "1px solid rgb(var(--ha-divider))" : "none" }}
                  data-testid={`geocoder-result-${i}`}>
                  <span className="text-[15px] font-medium" style={{ color: OBW.text }}>{r.city_name}</span>
                  {r.country_code && <span className="text-[13px]" style={{ color: OBW.textMuted }}>{r.country_code}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Top city presets */}
          <p className="text-[13px] font-semibold mb-3" style={{ color: OBW.textMuted }}>
            {t("onboarding.city.topCities")}
          </p>
          <div className="flex flex-col gap-2">
            {presetMatches.map((c) => (
              <button key={c.name}
                onClick={() => selectCity(c.name, c.lat, c.lng)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-[10px] border text-left transition-all active:scale-[0.98]"
                style={{
                  borderColor: "rgb(var(--ha-card-border))",
                  backgroundColor: city?.name === c.name ? "var(--ha-primary-light)" : "rgb(var(--ha-surface))",
                }}
                data-testid={`city-preset-${c.name}`}>
                <span className="text-[15px] font-medium flex-1" style={{ color: OBW.text }}>{c.name}</span>
                {city?.name === c.name && <Check className="w-4 h-4" style={{ color: "rgb(var(--ha-primary))" }} />}
              </button>
            ))}
          </div>
        </main>

        {/* No footer with match count on step 1 — city not yet confirmed */}
        <div
          className="fixed bottom-0 left-0 right-0 z-30"
          style={{ backgroundColor: OBW.footerBg, borderTop: `1px solid ${OBW.footerBorder}`, paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))" }}
        >
          <div className="max-w-[480px] mx-auto px-5 py-2.5 flex justify-end">
            <button
              onClick={() => { if (city) setStep(2); }}
              disabled={!city}
              className="min-w-[120px] px-6 h-[44px] rounded-full text-[14px] font-semibold disabled:opacity-40 flex items-center justify-center"
              style={{ background: OBW.primary, color: "#223546", boxShadow: city ? "0 4px 14px rgb(var(--ha-primary) / 0.2)" : "none" }}
              data-testid="button-city-next"
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2 — LOCATION MODE
  // ═══════════════════════════════════════════════════════════════════
  if (step === 2) {
    const districtList = cityDistricts[city?.name || ""] || [];
    const hasDistricts = districtList.length > 0;
    const n = loc.districts.length;
    const districtSummary =
      n === 0 || n === districtList.length
        ? t("onboarding.location.allNeighborhoodsSelected")
        : n === 1
          ? t("onboarding.location.neighborhoodsSelected").replace("{n}", String(n))
          : t("onboarding.location.neighborhoodsPluralSelected").replace("{n}", String(n));

    const tabs: { value: LocState["mode"]; label: string }[] = [
      ...(hasDistricts ? [{ value: "districts" as const, label: t("onboarding.location.neighborhoodsTab") }] : []),
      { value: "radius", label: t("onboarding.location.radiusTab") },
      { value: "city", label: t("onboarding.location.wholePlaceTab") },
    ];

    function toggleDistrict(d: string) {
      setLoc((prev) => ({
        ...prev,
        districts: prev.districts.includes(d) ? prev.districts.filter((x) => x !== d) : [...prev.districts, d],
      }));
    }

    const lat = city?.lat ?? 52.52;
    const lng = city?.lng ?? 13.405;

    return (
      <div className="min-h-[100dvh] flex flex-col" style={{ background: "rgb(var(--ha-bg))" }}
        data-testid="screen-wizard-location">
        {isEdit ? (
          <EditHeader cityName={city?.name || ""} onBack={goBack} onMenu={() => setShowDeleteSheet(true)} />
        ) : (
          <StepHeader step={2} onClose={goClose} />
        )}
        {isEdit && <EditTabBar activeStep={2} onStep={setStep} />}

        <main className="flex-1 max-w-[480px] mx-auto w-full px-4 pt-3.5 pb-[110px] overflow-y-auto">
          {/* City display — editable in create mode, read-only in edit mode */}
          {!isEdit ? (
            <>
              <label className="text-[15px] font-bold mb-2 block" style={{ color: "rgb(var(--ha-text))" }}>
                {t("onboarding.location.cityLabel")}
              </label>
              <button onClick={() => setStep(1)}
                className="w-full flex items-center gap-3 mb-4 ha-field-web text-left"
                style={{ backgroundColor: OBW.inputBg, borderColor: "rgb(var(--ha-border-input))", color: OBW.text }}
                data-testid="field-city-display">
                <Search className="w-[17px] h-[17px] shrink-0" style={{ color: OBW.textMuted }} />
                <span className="flex-1 text-[15px] font-medium" style={{ color: OBW.text }}>{city?.name}</span>
                <X className="w-[15px] h-[15px] shrink-0" style={{ color: OBW.textMuted }} />
              </button>
            </>
          ) : (
            <>
              <label className="text-[15px] font-bold mb-2 block" style={{ color: "rgb(var(--ha-text))" }}>
                {t("onboarding.location.cityLabel")}
              </label>
            <div className="w-full flex items-center gap-3 mb-3 ha-field-web cursor-not-allowed"
              style={{ backgroundColor: "rgb(var(--ha-surface))", borderColor: "rgb(var(--ha-card-border))", opacity: 0.72 }}
              data-testid="field-city-display-readonly">
              <Search className="w-[17px] h-[17px] shrink-0" style={{ color: OBW.textMuted }} />
              <span className="flex-1 text-[15px] font-medium" style={{ color: OBW.textSecondary }}>{city?.name}</span>
            </div>
            </>
          )}

          {/* Mode segmented control — pill-style, left-aligned */}
          <div className="mb-4" data-testid="location-tabs">
            <div className="inline-flex rounded-full p-[3px]" style={{ backgroundColor: "#f3f4f6" }}>
              {tabs.map((tab) => {
                const isActive = loc.mode === tab.value;
                return (
                  <button key={tab.value} onClick={() => setLoc((prev) => ({ ...prev, mode: tab.value }))}
                    className="px-3.5 py-[9px] text-[12.5px] rounded-full text-center transition-all whitespace-nowrap"
                    style={{
                      backgroundColor: isActive ? "#bbadfb" : "transparent",
                      color: "#111111",
                      fontWeight: isActive ? 600 : 500,
                      boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                    }}
                    data-testid={`tab-${tab.value}`}>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Districts mode */}
          {loc.mode === "districts" && (
            <div data-testid="section-districts">
              <p className="text-[14px] font-bold mb-2.5" style={{ color: "rgb(var(--ha-text))" }}>
                {t("onboarding.location.neighborhoodsTab")}
              </p>
              <button onClick={() => setShowDistrictPicker((v) => !v)}
                className="w-full flex items-center justify-between ha-field-web text-left mb-3"
                style={{ backgroundColor: OBW.inputBg, borderColor: "rgb(var(--ha-border-input))" }}
                data-testid="dropdown-districts">
                <span className="text-[15px] font-medium" style={{ color: OBW.text }}>{districtSummary}</span>
                <ChevronDown className="w-[17px] h-[17px] shrink-0 transition-transform duration-200"
                  style={{ color: OBW.textMuted, transform: showDistrictPicker ? "rotate(180deg)" : "none" }} />
              </button>
              {showDistrictPicker && hasDistricts && (
                <div className="rounded-[10px] overflow-hidden border mb-3"
                  style={{ borderColor: "rgb(var(--ha-divider))", maxHeight: "180px", overflowY: "auto" }}
                  data-testid="district-list">
                  {districtList.map((d, i) => {
                    const active = loc.districts.includes(d);
                    return (
                      <button key={d} onClick={() => toggleDistrict(d)}
                        className="w-full flex items-center justify-between hover:bg-ha-hover-bg transition-colors"
                        style={{ padding: "10px 14px", borderBottom: i < districtList.length - 1 ? "1px solid rgb(var(--ha-divider))" : "none" }}
                        data-testid={`district-${d}`}>
                        <span className="text-[13.5px] font-medium" style={{ color: active ? OBW.text : OBW.textSecondary }}>{d}</span>
                        {active && <Check className="w-3.5 h-3.5" style={{ color: "rgb(var(--ha-primary))" }} />}
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ aspectRatio: "1/1" }} className="rounded-[10px] overflow-hidden w-full">
                <MapView lat={lat} lng={lng} zoom={13} markers={[{ lat, lng, type: "primary" }]}
                  circles={[{ lat, lng, radiusMeters: 1500 }]} height="100%" className="" />
              </div>
            </div>
          )}

          {/* Radius mode */}
          {loc.mode === "radius" && (
            <div data-testid="section-radius">
              <style>{`
                .ha-radius-slider{-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer;width:100%;height:4px}
                .ha-radius-slider::-webkit-slider-runnable-track{background:linear-gradient(to right,#bbadfb 0%,#bbadfb var(--sl-pct,0%),rgb(var(--ha-card-border)) var(--sl-pct,0%),rgb(var(--ha-card-border)) 100%);border-radius:9999px;height:4px}
                .ha-radius-slider::-moz-range-track{background:rgb(var(--ha-card-border));border-radius:9999px;height:4px}
                .ha-radius-slider::-moz-range-progress{background:#bbadfb;border-radius:9999px;height:4px}
                .ha-radius-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;border-radius:50%;background:white;box-shadow:0 1px 6px rgba(0,0,0,.18),0 0 0 1.5px rgba(0,0,0,.07);margin-top:-8px;cursor:pointer}
                .ha-radius-slider::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:white;box-shadow:0 1px 6px rgba(0,0,0,.18),0 0 0 1.5px rgba(0,0,0,.07);border:none;cursor:pointer}
              `}</style>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13.5px] font-semibold" style={{ color: OBW.textSecondary }}>{t("onboarding.location.distanceLabel")}</span>
                <span className="text-[13px] font-medium" style={{ color: OBW.textMuted }}>{city?.name}</span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <input type="range" min={1} max={50} step={1} value={loc.radiusKm}
                  onChange={(e) => setLoc((prev) => ({ ...prev, radiusKm: parseInt(e.target.value) }))}
                  className="ha-radius-slider flex-1"
                  style={{ "--sl-pct": `${((loc.radiusKm - 1) / 49) * 100}%` } as React.CSSProperties}
                  data-testid="slider-radius" />
                <span className="text-[14px] font-semibold shrink-0 w-[48px] text-right" style={{ color: "#111111" }}>
                  {loc.radiusKm} km
                </span>
              </div>
              <div style={{ aspectRatio: "1/1" }} className="rounded-[10px] overflow-hidden w-full">
                <MapView lat={lat} lng={lng} zoom={10} markers={[{ lat, lng, type: "primary" }]}
                  circles={[{ lat, lng, radiusMeters: loc.radiusKm * 1000 }]} height="100%" className="" />
              </div>
            </div>
          )}

          {/* City mode */}
          {loc.mode === "city" && (
            <div data-testid="section-city">
              <div style={{ aspectRatio: "1/1" }} className="rounded-[10px] overflow-hidden w-full">
                <MapView lat={lat} lng={lng} zoom={10} markers={[{ lat, lng, type: "primary" }]} height="100%" className="" />
              </div>
            </div>
          )}
        </main>

        <StepFooter estimate={estimate} fetching={estimateFetching}
          onBack={goBack} onNext={() => setStep(3)}
          nextLabel={t("common.next")}
          editMode={isEdit} />

        {/* Delete action sheet */}
        {showDeleteSheet && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end" data-testid="sheet-delete-action">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteSheet(false)} />
            <div className="relative bg-white rounded-t-[20px] max-w-[480px] mx-auto w-full" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
              <div className="w-[32px] h-[3px] rounded-full bg-ha-card-border mx-auto mt-3 mb-4" />
              <button
                onClick={() => { setShowDeleteSheet(false); setShowDeleteConfirm(true); }}
                className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-ha-surface active:bg-ha-surface"
                data-testid="button-delete-action"
              >
                <span className="text-[15px] font-bold text-[#111111]">Verwijder deze zoekopdracht</span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#223546" }}>
                  <Trash2 className="w-[15px] h-[15px] text-white" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Delete confirmation sheet */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end" data-testid="sheet-delete-confirm">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
            <div className="relative bg-white rounded-t-[20px] max-w-[480px] mx-auto w-full px-5 pt-5" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
              <div className="w-[32px] h-[3px] rounded-full bg-ha-card-border mx-auto mb-5" />
              <h2 className="text-[20px] font-bold text-ha-text mb-2" data-testid="text-delete-confirm-title">
                Deze zoekopdracht verwijderen?
              </h2>
              <p className="text-[14.5px] text-ha-text leading-relaxed mb-7" data-testid="text-delete-confirm-body">
                Weet je het zeker? Ook alle woningmatches die bij deze zoekopdracht horen worden definitief verwijderd.
              </p>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full h-[56px] rounded-[8px] text-[#111111] text-[15px] font-semibold flex items-center justify-center gap-2 mb-4 disabled:opacity-50 active:scale-[0.98] transition-transform"
                style={{ backgroundColor: "rgb(var(--ha-primary))" }}
                data-testid="button-confirm-delete"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Ja, definitief verwijderen
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full h-[56px] rounded-[8px] border-2 text-[15px] font-semibold flex items-center justify-center active:opacity-70 transition-opacity"
                style={{ borderColor: "rgb(var(--ha-primary))", color: "rgb(var(--ha-text))" }}
                data-testid="button-cancel-delete"
              >
                Zoekopdracht behouden
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3 — FILTERS
  // ═══════════════════════════════════════════════════════════════════
  if (step === 3) {
    function update(partial: Partial<FilterState>) { setF((prev) => ({ ...prev, ...partial })); }
    function toggleAmenity(a: string) {
      setF((prev) => ({
        ...prev,
        amenities: prev.amenities.includes(a) ? prev.amenities.filter((x) => x !== a) : [...prev.amenities, a],
      }));
    }

    const ROOM_OPTIONS = [
      { value: "any", label: t("onboarding.filters.doesntMatter") },
      { value: "1", label: "1+" }, { value: "2", label: "2+" },
      { value: "3", label: "3+" }, { value: "4", label: "4+" }, { value: "5", label: "5+" },
    ];
    const PROPERTY_OPTIONS = [
      { value: "any", label: t("onboarding.filters.doesntMatter") },
      { value: "apartment", label: t("onboarding.propertyType.apartment") },
      { value: "house", label: t("onboarding.filters.house") },
    ];
    const FURNISHED_OPTIONS = [
      { value: "any", label: t("onboarding.filters.furnishedAny") },
      { value: "furnished", label: t("onboarding.filters.furnishedYes") },
      { value: "unfurnished", label: t("onboarding.filters.furnishedNo") },
    ];
    const AMENITY_OPTIONS = [
      { value: "bath", labelKey: "amenities.bath", fallback: "Bad", icon: Bath },
      { value: "balcony", labelKey: "amenities.balcony", fallback: "Balkon", icon: Sun },
      { value: "garden", labelKey: "amenities.garden", fallback: "Garten", icon: Trees },
      { value: "rooftop", labelKey: "amenities.rooftop", fallback: "Dachterrasse", icon: Sun },
      { value: "energy_c", labelKey: "amenities.energyC", fallback: "Energieklasse C+", icon: Leaf },
    ];

    function PillSegment({ options, value, onChange, testId }: {
      options: { value: string; label: string }[];
      value: string; onChange: (v: string) => void; testId: string;
    }) {
      return (
        <div className="flex items-center gap-[4px] p-[4px] rounded-full" style={{ backgroundColor: "#f3f4f6" }} data-testid={testId}>
          {options.map((opt) => {
            const isActive = value === opt.value;
            return (
              <button key={opt.value} onClick={() => onChange(opt.value)}
                className="flex-1 py-[9px] text-[12px] font-semibold rounded-full text-center transition-all whitespace-nowrap overflow-hidden"
                style={{ backgroundColor: isActive ? "#bbadfb" : "transparent", color: "#111111", boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}
                data-testid={`${testId}-${opt.value}`}>
                {opt.label}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="min-h-[100dvh] flex flex-col" style={{ background: "rgb(var(--ha-bg))" }}
        data-testid="screen-wizard-filters">
        {isEdit ? (
          <EditHeader cityName={city?.name || ""} onBack={goBack} onMenu={() => setShowDeleteSheet(true)} />
        ) : (
          <StepHeader step={3} onClose={goClose} />
        )}
        {isEdit && <EditTabBar activeStep={3} onStep={setStep} />}

        <main className="flex-1 max-w-[480px] mx-auto w-full px-4 pt-3.5 pb-[110px] overflow-y-auto">
          <div className="flex flex-col gap-4">

            {/* Rent price */}
            <section>
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="text-[14px] font-semibold" style={{ color: OBW.text }}>{t("onboarding.filters.rentLabel")}</span>
                <div className="relative">
                  <button onClick={() => setShowPriceInfo((v) => !v)}
                    className="flex items-center justify-center w-[18px] h-[18px]"
                    style={{ color: OBW.textMuted }} data-testid="button-price-info">
                    <Info className="w-[14px] h-[14px]" />
                  </button>
                  {showPriceInfo && (
                    <div className="absolute left-0 top-[22px] z-20 w-[210px] rounded-[10px] px-3 py-2.5"
                      style={{ backgroundColor: "rgb(var(--ha-card))", border: `1px solid ${OBW.cardBorder}`, boxShadow: "0 4px 14px rgba(0,0,0,0.09)" }}
                      data-testid="tooltip-price-info">
                      <p className="text-[12px] leading-relaxed" style={{ color: OBW.textSecondary }}>
                        {t("onboarding.filters.priceTooltip")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <DualRangeSlider min={0} max={3000} step={50}
                valueLow={f.minPrice} valueHigh={f.maxPrice}
                onChangeLow={(v) => update({ minPrice: v })}
                onChangeHigh={(v) => update({ maxPrice: v })}
                formatLabel={(v) => `€${v}`} testId="slider-rent-price" />
              <div className="mt-3">
                <WebToggle checked={f.priceFlexible} onChange={(v) => update({ priceFlexible: v })}
                  label={t("onboarding.filters.priceFlexible")} testId="toggle-price-flexible" />
              </div>
            </section>

            <div className="h-px bg-ha-divider" />

            {/* Property type */}
            <section>
              <label className="text-[14px] font-semibold mb-2 block" style={{ color: OBW.text }}>
                {t("onboarding.filters.propertyTypeLabel")}
              </label>
              <PillSegment options={PROPERTY_OPTIONS} value={f.propertyType}
                onChange={(v) => update({ propertyType: v })} testId="property-type" />
              <div className="mt-3">
                <WebToggle checked={f.includeRooms} onChange={(v) => update({ includeRooms: v })}
                  label={t("onboarding.filters.includeRooms")} testId="toggle-include-rooms" />
              </div>
            </section>

            <div className="h-px bg-ha-divider" />

            {/* Bedrooms */}
            <section>
              <label className="text-[14px] font-semibold mb-2 block" style={{ color: OBW.text }}>
                {t("onboarding.filters.bedroomsLabel")}
              </label>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar" data-testid="rooms-selector">
                {ROOM_OPTIONS.map((opt) => {
                  const active = f.minRooms === opt.value;
                  return (
                    <button key={opt.value} onClick={() => update({ minRooms: opt.value })}
                      className="py-[9px] px-4 text-[12px] font-semibold rounded-full whitespace-nowrap shrink-0 transition-all active:scale-[0.96]"
                      style={{ backgroundColor: active ? "#bbadfb" : "#f3f4f6", color: "#111111", boxShadow: "none" }}
                      data-testid={`rooms-${opt.value}`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="h-px bg-ha-divider" />

            {/* Min size */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[14px] font-semibold" style={{ color: OBW.text }}>
                  {t("onboarding.filters.minSizeLabel")}
                </label>
                <button onClick={() => update({ sizeNA: !f.sizeNA, minSize: f.sizeNA ? 30 : 0 })}
                  className="text-[12px] font-semibold px-3 py-[5px] rounded-full border transition-all"
                  style={{
                    borderColor: "rgb(var(--ha-card-border))",
                    backgroundColor: f.sizeNA ? "var(--ha-primary-light)" : "transparent",
                    color: f.sizeNA ? "rgb(var(--ha-primary))" : OBW.textSecondary,
                  }}
                  data-testid="button-size-na">
                  {t("common.na")}
                </button>
              </div>
              {!f.sizeNA && (
                <RangeSlider min={0} max={200} step={5} value={f.minSize}
                  onChange={(v) => update({ minSize: v })}
                  formatLabel={(v) => `${v} m²`} testId="slider-min-size" />
              )}
            </section>

            <div className="h-px bg-ha-divider" />

            {/* Furnished */}
            <section>
              <label className="text-[14px] font-semibold mb-2 block" style={{ color: OBW.text }}>
                {t("onboarding.filters.furnishedLabel")}
              </label>
              <PillSegment options={FURNISHED_OPTIONS} value={f.furnished}
                onChange={(v) => update({ furnished: v })} testId="furnished-selector" />
            </section>

            <div className="h-px bg-ha-divider" />

            {/* Amenities */}
            <section>
              <label className="text-[14px] font-semibold mb-2 block" style={{ color: OBW.text }}>
                {t("onboarding.filters.amenitiesLabel")}
              </label>
              <div className="flex flex-wrap gap-2" data-testid="amenity-chips">
                {AMENITY_OPTIONS.map(({ value, labelKey, fallback, icon: Icon }) => {
                  const active = f.amenities.includes(value);
                  return (
                    <button key={value} onClick={() => toggleAmenity(value)}
                      className="flex items-center gap-1.5 h-[36px] px-3.5 rounded-full text-[13px] font-medium border transition-all active:scale-[0.96]"
                      style={{
                        backgroundColor: active ? "#bbadfb" : "transparent",
                        borderColor: active ? "#bbadfb" : OBW.chipBorder,
                        color: "#111111",
                      }}
                      data-testid={`amenity-${value}`}>
                      {active ? <Check className="w-3 h-3 shrink-0" /> : <Icon className="w-3.5 h-3.5 shrink-0" />}
                      <span>{t(labelKey) || fallback}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="h-px bg-ha-divider" />

            {/* Send unclear */}
            <section>
              <WebToggle checked={f.sendUnclear} onChange={(v) => update({ sendUnclear: v })}
                label={t("onboarding.filters.sendUnclear")} testId="toggle-send-unclear" />
            </section>
          </div>
        </main>

        <StepFooter estimate={estimate} fetching={estimateFetching}
          onBack={goBack} onNext={() => setStep(4)}
          nextLabel={t("common.next")}
          editMode={isEdit} />

        {showDeleteSheet && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end" data-testid="sheet-delete-action">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteSheet(false)} />
            <div className="relative bg-white rounded-t-[20px] max-w-[480px] mx-auto w-full" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
              <div className="w-[32px] h-[3px] rounded-full bg-ha-card-border mx-auto mt-3 mb-4" />
              <button
                onClick={() => { setShowDeleteSheet(false); setShowDeleteConfirm(true); }}
                className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-ha-surface active:bg-ha-surface transition-colors"
                data-testid="button-delete-action"
              >
                <span className="text-[15px] font-bold text-[#111111]">Verwijder deze zoekopdracht</span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#223546" }}>
                  <Trash2 className="w-[15px] h-[15px] text-white" />
                </div>
              </button>
            </div>
          </div>
        )}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end" data-testid="sheet-delete-confirm">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
            <div className="relative bg-white rounded-t-[20px] max-w-[480px] mx-auto w-full px-5 pt-5" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
              <div className="w-[32px] h-[3px] rounded-full bg-ha-card-border mx-auto mb-5" />
              <h2 className="text-[20px] font-bold text-ha-text mb-2">Deze zoekopdracht verwijderen?</h2>
              <p className="text-[13.5px] text-ha-text-secondary leading-relaxed mb-5">
                Weet je het zeker? Ook alle woningmatches die bij deze zoekopdracht horen worden definitief verwijderd.
              </p>
              <button onClick={handleDelete} disabled={deleting}
                className="w-full h-[48px] rounded-[8px] bg-ha-danger text-white text-[15px] font-semibold flex items-center justify-center gap-2 mb-3 disabled:opacity-50 active:scale-[0.98] transition-transform"
                data-testid="button-confirm-delete">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Ja, definitief verwijderen
              </button>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-2.5 text-ha-text-muted text-[14px] font-medium active:opacity-70 transition-opacity"
                data-testid="button-cancel-delete">
                Zoekopdracht behouden
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4 — PREFERENCES & SAVE
  // ═══════════════════════════════════════════════════════════════════
  const SUITABLE_OPTIONS = [
    { value: "studenten", label: t("onboardingWebPreferences.suitableStudents") },
    { value: "woningdelers", label: t("onboardingWebPreferences.suitableRoommates") },
    { value: "huisdieren", label: t("onboardingWebPreferences.suitablePets") },
  ];

  const sLabel = "text-[13.5px] font-semibold mb-2 block";

  function toggleSuitable(v: string) {
    setPref((prev) => ({
      ...prev,
      suitableFor: prev.suitableFor.includes(v) ? prev.suitableFor.filter((x) => x !== v) : [...prev.suitableFor, v],
    }));
  }

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "rgb(var(--ha-bg))" }}
      data-testid="screen-wizard-preferences">
      {isEdit ? (
        <EditHeader cityName={city?.name || ""} onBack={goBack} onMenu={() => setShowDeleteSheet(true)} />
      ) : (
        <StepHeader step={4} onClose={goClose} />
      )}
      {isEdit && <EditTabBar activeStep={4} onStep={setStep} />}

      <main className="flex-1 max-w-[480px] mx-auto w-full px-4 pt-3.5 pb-[110px] overflow-y-auto">

        {/* Search name */}
        <div className="mb-5">
          <label className="block text-[13.5px] font-semibold mb-2" style={{ color: OBW.text }}
            htmlFor="input-search-name">
            {t("onboardingWebPreferences.searchNameLabel")}
          </label>
          <input id="input-search-name" type="text"
            value={pref.searchName}
            onChange={(e) => setPref((p) => ({ ...p, searchName: e.target.value }))}
            className="w-full ha-field-web"
            style={{ backgroundColor: "rgb(var(--ha-card))", borderColor: OBW.inputBorder, borderRadius: 6, color: "rgb(var(--ha-text))" }}
            placeholder={city?.name || ""}
            data-testid="input-search-name" />
        </div>

        {/* Suitable for */}
        <section className="mb-5">
          <label className={sLabel} style={{ color: "rgb(var(--ha-text))" }}>
            {t("onboardingWebPreferences.suitableForLabel")}
          </label>
          <div className="flex gap-1.5 flex-wrap" data-testid="suitable-for-chips">
            {SUITABLE_OPTIONS.map((opt) => {
              const active = pref.suitableFor.includes(opt.value);
              return (
                <button key={opt.value} onClick={() => toggleSuitable(opt.value)}
                  className="h-[36px] px-3 rounded-full text-[13px] font-medium border transition-all active:scale-[0.96] flex items-center gap-[4px] shrink-0"
                  style={{
                    backgroundColor: active ? "#bbadfb" : "rgb(var(--ha-surface))",
                    borderColor: active ? "#bbadfb" : "rgb(var(--ha-border-input))",
                    color: "#111111",
                  }}
                  data-testid={`chip-suitable-${opt.value}`}>
                  {!active && <Plus className="w-[11px] h-[11px] shrink-0" style={{ color: "rgb(var(--ha-text-muted))" }} />}
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 rounded-[8px] flex items-start gap-2.5" style={{ backgroundColor: "rgb(var(--ha-hover-bg))", padding: "11px 13px" }}>
            <Info className="w-[13px] h-[13px] shrink-0 mt-[2px]" style={{ color: "rgb(var(--ha-text-placeholder))" }} />
            <p className="text-[12.5px] leading-[1.55]" style={{ color: "rgb(var(--ha-text-secondary))" }}>
              {t("onboardingWebPreferences.suitableForInfo")}
            </p>
          </div>
        </section>

        {/* Search filters */}
        <section className="mb-5">
          <label className={sLabel} style={{ color: "rgb(var(--ha-text))" }}>
            {t("onboardingWebPreferences.filterLabel")}
          </label>
          <div className="flex flex-col" data-testid="search-filter-rows">
            <PrefsToggle checked={pref.vrijeSector} onChange={(v) => setPref((p) => ({ ...p, vrijeSector: v }))}
              label={t("onboardingWebPreferences.filterVrijeSector")} testId="toggle-filter-vrijeSector" />
            <PrefsToggle checked={pref.payToReply} onChange={(v) => setPref((p) => ({ ...p, payToReply: v }))}
              label={t("onboardingWebPreferences.filterPayToReply")} info testId="toggle-filter-payToReply" />
            <PrefsToggle checked={pref.loting} onChange={(v) => setPref((p) => ({ ...p, loting: v }))}
              label={t("onboardingWebPreferences.filterLoting")} info testId="toggle-filter-loting" />
          </div>
        </section>

      </main>

      {/* Footer */}
      <StepFooter estimate={null} fetching={false} showCount={false}
        onBack={goBack} onNext={handleSave}
        nextLabel={t("common.save")}
        saving={submitting} editMode={isEdit} />

      {showDeleteSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" data-testid="sheet-delete-action">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteSheet(false)} />
          <div className="relative bg-white rounded-t-[20px] max-w-[480px] mx-auto w-full" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
            <div className="w-[32px] h-[3px] rounded-full bg-ha-card-border mx-auto mt-3 mb-4" />
            <button
              onClick={() => { setShowDeleteSheet(false); setShowDeleteConfirm(true); }}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-ha-surface active:bg-ha-surface transition-colors"
              data-testid="button-delete-action"
            >
              <span className="text-[15px] font-semibold text-[#111111]">Verwijder deze zoekopdracht</span>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#223546" }}>
                <Trash2 className="w-[15px] h-[15px] text-white" />
              </div>
            </button>
          </div>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" data-testid="sheet-delete-confirm">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-t-[20px] max-w-[480px] mx-auto w-full px-5 pt-5" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
            <div className="w-[32px] h-[3px] rounded-full bg-ha-card-border mx-auto mb-5" />
            <h2 className="text-[20px] font-bold text-ha-text mb-2">Deze zoekopdracht verwijderen?</h2>
            <p className="text-[13.5px] text-ha-text-secondary leading-relaxed mb-5">
              Weet je het zeker? Ook alle woningmatches die bij deze zoekopdracht horen worden definitief verwijderd.
            </p>
            <button onClick={handleDelete} disabled={deleting}
              className="w-full h-[48px] rounded-[8px] bg-ha-danger text-white text-[15px] font-semibold flex items-center justify-center gap-2 mb-3 disabled:opacity-50 active:scale-[0.98] transition-transform"
              data-testid="button-confirm-delete">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Ja, definitief verwijderen
            </button>
            <button onClick={() => setShowDeleteConfirm(false)}
              className="w-full py-2.5 text-ha-text-muted text-[14px] font-medium active:opacity-70 transition-opacity"
              data-testid="button-cancel-delete">
              Zoekopdracht behouden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
