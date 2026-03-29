import { describe, it, expect } from "vitest";
import {
  explainMatchInternal,
  normalizeCity,
  citiesMatch,
  getCitySearchTerms,
  type FilterCheck,
  type MatchExplanation,
} from "../../matching/engine";

interface SearchProfile {
  id: string;
  user_id: string;
  city: string;
  city_name?: string;
  price_min: number;
  price_max: number;
  bedrooms_min: number;
  size_min: number;
  furnished?: string | null;
  extra_features?: string[] | null;
  target_categories?: string[] | null;
  districts?: string[] | null;
  property_types?: string[] | null;
  location_mode?: string | null;
  send_unclear?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number | null;
}

interface DbListing {
  id: string;
  source: string;
  url: string | null;
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  image_url?: string | null;
  furnished?: boolean | null;
  pets_allowed?: boolean | null;
  balcony?: boolean | null;
  elevator?: boolean | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  extra_features?: string[] | null;
  target_categories?: string[] | null;
  garden?: boolean | null;
  bath?: boolean | null;
  roof_terrace?: boolean | null;
  energy_label?: string | null;
  property_type?: string | null;
  parking?: boolean | null;
}

function makeProfile(overrides: Partial<SearchProfile> = {}): SearchProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    city: "berlin",
    price_min: 0,
    price_max: 1500,
    bedrooms_min: 2,
    size_min: 50,
    ...overrides,
  };
}

function makeListing(overrides: Partial<DbListing> = {}): DbListing {
  return {
    id: "listing-1",
    source: "wg-gesucht",
    url: "https://example.com/listing/1",
    title: "Schöne 2-Zimmer Wohnung",
    city: "Berlin",
    price: 900,
    bedrooms: 2,
    size_m2: 65,
    ...overrides,
  };
}

function explain(listing: Partial<DbListing>, profile: Partial<SearchProfile>): MatchExplanation {
  return explainMatchInternal(makeListing(listing) as any, makeProfile(profile) as any);
}

function findCheck(explanation: MatchExplanation, filter: string): FilterCheck | undefined {
  return explanation.checks.find(c => c.filter === filter);
}

describe("Match Engine Unit Tests", () => {

  describe("normalizeCity", () => {
    it("lowercases and trims", () => {
      expect(normalizeCity("  Berlin  ")).toBe("berlin");
    });

    it("collapses multiple spaces", () => {
      expect(normalizeCity("Frankfurt  am   Main")).toBe("frankfurt am main");
    });

    it("handles empty string", () => {
      expect(normalizeCity("")).toBe("");
    });
  });

  describe("citiesMatch — exact matches", () => {
    it("matches identical cities", () => {
      expect(citiesMatch("Berlin", "Berlin")).toBe(true);
    });

    it("matches case-insensitively", () => {
      expect(citiesMatch("berlin", "BERLIN")).toBe(true);
    });

    it("matches with whitespace differences", () => {
      expect(citiesMatch("  Berlin ", "berlin")).toBe(true);
    });

    it("rejects different cities", () => {
      expect(citiesMatch("Berlin", "Hamburg")).toBe(false);
    });

    it("rejects empty strings", () => {
      expect(citiesMatch("", "Berlin")).toBe(false);
      expect(citiesMatch("Berlin", "")).toBe(false);
    });
  });

  describe("citiesMatch — German aliases", () => {
    it("München ↔ Munich", () => {
      expect(citiesMatch("München", "Munich")).toBe(true);
    });

    it("München ↔ Muenchen", () => {
      expect(citiesMatch("München", "Muenchen")).toBe(true);
    });

    it("Köln ↔ Cologne", () => {
      expect(citiesMatch("Köln", "Cologne")).toBe(true);
    });

    it("Köln ↔ Koeln", () => {
      expect(citiesMatch("Köln", "Koeln")).toBe(true);
    });

    it("Nürnberg ↔ Nuremberg", () => {
      expect(citiesMatch("Nürnberg", "Nuremberg")).toBe(true);
    });

    it("Hannover ↔ Hanover", () => {
      expect(citiesMatch("Hannover", "Hanover")).toBe(true);
    });

    it("Düsseldorf ↔ Duesseldorf", () => {
      expect(citiesMatch("Düsseldorf", "Duesseldorf")).toBe(true);
    });

    it("Braunschweig ↔ Brunswick", () => {
      expect(citiesMatch("Braunschweig", "Brunswick")).toBe(true);
    });

    it("Frankfurt am Main ↔ Frankfurt (prefix match)", () => {
      expect(citiesMatch("Frankfurt am Main", "Frankfurt")).toBe(true);
    });

    it("Freiburg im Breisgau ↔ Freiburg (prefix match)", () => {
      expect(citiesMatch("Freiburg im Breisgau", "Freiburg")).toBe(true);
    });
  });

  describe("citiesMatch — false positive prevention", () => {
    it("Berlin does NOT match Berlingen", () => {
      expect(citiesMatch("Berlin", "Berlingen")).toBe(false);
    });

    it("Hamburg does NOT match Hamburger", () => {
      expect(citiesMatch("Hamburg", "Hamburger")).toBe(false);
    });

    it("Bonn does NOT match Bonneville", () => {
      expect(citiesMatch("Bonn", "Bonneville")).toBe(false);
    });

    it("Essen does NOT match Essenz", () => {
      expect(citiesMatch("Essen", "Essenz")).toBe(false);
    });

    it("Köln does NOT match Kölnbrein", () => {
      expect(citiesMatch("Köln", "Kölnbrein")).toBe(false);
    });
  });

  describe("City filter in explainMatchInternal", () => {
    it("passes when cities match exactly", () => {
      const result = explain({ city: "Berlin" }, { city: "berlin" });
      expect(result.matched).toBe(true);
      expect(findCheck(result, "city")?.passed).toBe(true);
    });

    it("fails when cities differ", () => {
      const result = explain({ city: "Hamburg" }, { city: "berlin" });
      expect(result.matched).toBe(false);
      expect(result.reason).toContain("City mismatch");
    });

    it("fails when profile city is empty", () => {
      const result = explain({ city: "Berlin" }, { city: "", city_name: "" });
      expect(result.matched).toBe(false);
    });

    it("uses city_name over city when available", () => {
      const result = explain({ city: "München" }, { city: "some-slug", city_name: "Munich" });
      expect(result.matched).toBe(true);
    });
  });

  describe("Price filter — price_max", () => {
    it("passes when listing price <= max", () => {
      const result = explain({ price: 1000 }, { price_max: 1500 });
      expect(result.matched).toBe(true);
      expect(findCheck(result, "price_max")?.passed).toBe(true);
    });

    it("passes when listing price equals max exactly", () => {
      const result = explain({ price: 1500 }, { price_max: 1500 });
      expect(result.matched).toBe(true);
    });

    it("fails when listing price > max", () => {
      const result = explain({ price: 2000 }, { price_max: 1500 });
      expect(result.matched).toBe(false);
      expect(result.reason).toContain("Price 2000 > max 1500");
    });

    it("skips price_max check when profile price_max=0", () => {
      const result = explain({ price: 5000 }, { price_max: 0 });
      expect(result.matched).toBe(true);
    });

    it("hybrid-passes when listing price=0 (unknown) and profile has max", () => {
      const result = explain({ price: 0 }, { price_max: 1500 });
      expect(result.matched).toBe(true);
      const check = findCheck(result, "price_max");
      expect(check?.passed).toBe(true);
      expect(check?.hybridPass).toBe(true);
    });
  });

  describe("Price filter — price_min", () => {
    it("passes when listing price >= min", () => {
      const result = explain({ price: 800 }, { price_min: 500 });
      expect(result.matched).toBe(true);
    });

    it("fails when listing price < min", () => {
      const result = explain({ price: 300 }, { price_min: 500, price_max: 0 });
      expect(result.matched).toBe(false);
      expect(result.reason).toContain("Price 300 < min 500");
    });

    it("skips price_min check when profile price_min=0", () => {
      const result = explain({ price: 100 }, { price_min: 0 });
      expect(result.matched).toBe(true);
    });

    it("hybrid-passes when listing price=0 (unknown) and profile has min", () => {
      const result = explain({ price: 0 }, { price_min: 500, price_max: 0 });
      expect(result.matched).toBe(true);
      const check = findCheck(result, "price_min");
      expect(check?.passed).toBe(true);
      expect(check?.hybridPass).toBe(true);
    });
  });

  describe("Bedrooms filter", () => {
    it("passes when listing bedrooms >= min", () => {
      const result = explain({ bedrooms: 3 }, { bedrooms_min: 2 });
      expect(result.matched).toBe(true);
    });

    it("passes when bedrooms equal exactly", () => {
      const result = explain({ bedrooms: 2 }, { bedrooms_min: 2 });
      expect(result.matched).toBe(true);
    });

    it("fails when listing bedrooms < min", () => {
      const result = explain({ bedrooms: 1 }, { bedrooms_min: 2 });
      expect(result.matched).toBe(false);
      expect(result.reason).toContain("Bedrooms 1 < min 2");
    });

    it("skips check when profile bedrooms_min=0", () => {
      const result = explain({ bedrooms: 1 }, { bedrooms_min: 0 });
      expect(result.matched).toBe(true);
    });

    it("hybrid-passes when listing bedrooms=0 (unknown) and profile requires bedrooms", () => {
      const result = explain({ bedrooms: 0 }, { bedrooms_min: 2 });
      expect(result.matched).toBe(true);
      const check = findCheck(result, "bedrooms_min");
      expect(check?.passed).toBe(true);
      expect(check?.hybridPass).toBe(true);
    });
  });

  describe("Size filter", () => {
    it("passes when listing size >= min", () => {
      const result = explain({ size_m2: 70 }, { size_min: 50 });
      expect(result.matched).toBe(true);
    });

    it("fails when listing size < min", () => {
      const result = explain({ size_m2: 30 }, { size_min: 50 });
      expect(result.matched).toBe(false);
      expect(result.reason).toContain("Size 30m² < min 50m²");
    });

    it("skips check when profile size_min=0", () => {
      const result = explain({ size_m2: 10 }, { size_min: 0 });
      expect(result.matched).toBe(true);
    });

    it("hybrid-passes when listing size_m2=0 (unknown) and profile requires size", () => {
      const result = explain({ size_m2: 0 }, { size_min: 50 });
      expect(result.matched).toBe(true);
      const check = findCheck(result, "size_min");
      expect(check?.passed).toBe(true);
      expect(check?.hybridPass).toBe(true);
    });
  });

  describe("Furnished filter", () => {
    it("skips when profile has no preference (any)", () => {
      const result = explain({ furnished: false }, { furnished: "any" });
      expect(result.matched).toBe(true);
      expect(findCheck(result, "furnished")).toBeUndefined();
    });

    it("skips when profile has no preference (no_preference)", () => {
      const result = explain({ furnished: false }, { furnished: "no_preference" });
      expect(result.matched).toBe(true);
    });

    it("skips when profile furnished is null", () => {
      const result = explain({ furnished: false }, { furnished: null });
      expect(result.matched).toBe(true);
    });

    it("passes when profile wants furnished and listing is furnished", () => {
      const result = explain({ furnished: true }, { furnished: "furnished" });
      expect(result.matched).toBe(true);
      expect(findCheck(result, "furnished")?.passed).toBe(true);
    });

    it("fails when profile wants furnished but listing is unfurnished", () => {
      const result = explain({ furnished: false }, { furnished: "furnished" });
      expect(result.matched).toBe(false);
      expect(result.reason).toContain("Furnished filter");
    });

    it("passes when profile wants unfurnished and listing is unfurnished", () => {
      const result = explain({ furnished: false }, { furnished: "unfurnished" });
      expect(result.matched).toBe(true);
    });

    it("fails when profile wants unfurnished but listing is furnished", () => {
      const result = explain({ furnished: true }, { furnished: "unfurnished" });
      expect(result.matched).toBe(false);
    });

    it("hybrid-passes when listing furnished is null (unknown) and profile wants furnished", () => {
      const result = explain({ furnished: null }, { furnished: "furnished" });
      expect(result.matched).toBe(true);
      const check = findCheck(result, "furnished");
      expect(check?.passed).toBe(true);
      expect(check?.hybridPass).toBe(true);
    });

    it("hybrid-passes when listing furnished is undefined and profile wants unfurnished", () => {
      const result = explain({}, { furnished: "unfurnished" });
      expect(result.matched).toBe(true);
      const check = findCheck(result, "furnished");
      expect(check?.hybridPass).toBe(true);
    });
  });

  describe("Pets filter (extra_features hybrid)", () => {
    it("passes when profile requires pets and listing allows pets", () => {
      const result = explain({ pets_allowed: true }, { extra_features: ["pets_allowed"] });
      expect(result.matched).toBe(true);
    });

    it("fails when profile requires pets but listing disallows pets", () => {
      const result = explain({ pets_allowed: false }, { extra_features: ["pets_allowed"] });
      expect(result.matched).toBe(false);
    });

    it("hybrid-passes when profile requires pets but listing pets is null (unknown)", () => {
      const result = explain({ pets_allowed: null }, { extra_features: ["pets_allowed"] });
      expect(result.matched).toBe(true);
      const check = explanation => explanation.checks.find((c: any) => c.filter === "extra_feature:pets_allowed");
      expect(check(result)?.hybridPass).toBe(true);
    });

    it("also works with Dutch key huisdieren", () => {
      const result = explain({ pets_allowed: true }, { extra_features: ["huisdieren"] });
      expect(result.matched).toBe(true);
    });
  });

  describe("Balcony filter (extra_features strict)", () => {
    it("passes when profile requires balcony and listing has balcony", () => {
      const result = explain({ balcony: true }, { extra_features: ["balcony"] });
      expect(result.matched).toBe(true);
    });

    it("fails when profile requires balcony but listing balcony is false", () => {
      const result = explain({ balcony: false }, { extra_features: ["balcony"] });
      expect(result.matched).toBe(false);
    });

    it("passes when listing balcony is null with send_unclear=ON (default)", () => {
      const result = explain({ balcony: null }, { extra_features: ["balcony"] });
      expect(result.matched).toBe(true);
      const check = findCheck(result, "extra_feature:balcony");
      expect(check?.hybridPass).toBe(true);
    });

    it("fails when listing balcony is null with send_unclear=OFF", () => {
      const result = explain({ balcony: null }, { extra_features: ["balcony"], send_unclear: false });
      expect(result.matched).toBe(false);
    });
  });

  describe("Elevator filter (extra_features strict)", () => {
    it("passes when listing has elevator", () => {
      const result = explain({ elevator: true }, { extra_features: ["elevator"] });
      expect(result.matched).toBe(true);
    });

    it("passes when listing elevator is null with send_unclear=ON (default)", () => {
      const result = explain({ elevator: null }, { extra_features: ["elevator"] });
      expect(result.matched).toBe(true);
      const check = findCheck(result, "extra_feature:elevator");
      expect(check?.hybridPass).toBe(true);
    });

    it("fails when listing elevator is null with send_unclear=OFF", () => {
      const result = explain({ elevator: null }, { extra_features: ["elevator"], send_unclear: false });
      expect(result.matched).toBe(false);
    });

    it("works with Dutch key lift", () => {
      const result = explain({ elevator: true }, { extra_features: ["lift"] });
      expect(result.matched).toBe(true);
    });
  });

  describe("District filter", () => {
    it("passes when listing district matches one of profile districts", () => {
      const result = explain(
        { district: "Mitte" },
        { districts: ["Mitte", "Kreuzberg"], location_mode: "districts" }
      );
      expect(result.matched).toBe(true);
    });

    it("fails when listing district is known but not in profile districts", () => {
      const result = explain(
        { district: "Spandau" },
        { districts: ["Mitte", "Kreuzberg"], location_mode: "districts" }
      );
      expect(result.matched).toBe(false);
      expect(result.reason).toContain("District");
    });

    it("hybrid-passes when listing district is null (unknown)", () => {
      const result = explain(
        { district: null },
        { districts: ["Mitte", "Kreuzberg"], location_mode: "districts" }
      );
      expect(result.matched).toBe(true);
      const check = findCheck(result, "district");
      expect(check?.hybridPass).toBe(true);
    });

    it("hybrid-passes when listing district is empty string", () => {
      const result = explain(
        { district: "" },
        { districts: ["Mitte"], location_mode: "districts" }
      );
      expect(result.matched).toBe(true);
    });

    it("skips district check when location_mode is city", () => {
      const result = explain(
        { district: "Spandau" },
        { districts: ["Mitte"], location_mode: "city" }
      );
      expect(result.matched).toBe(true);
      expect(findCheck(result, "district")).toBeUndefined();
    });

    it("skips district check when location_mode is radius", () => {
      const result = explain(
        { district: "Spandau", city: "berlin", latitude: 52.52, longitude: 13.405 },
        { districts: ["Mitte"], location_mode: "radius", latitude: 52.52, longitude: 13.405, radius_km: 10 }
      );
      expect(result.matched).toBe(true);
      expect(findCheck(result, "district")).toBeUndefined();
    });

    it("skips district check when districts array is empty", () => {
      const result = explain(
        { district: "Spandau" },
        { districts: [], location_mode: "districts" }
      );
      expect(result.matched).toBe(true);
    });

    it("matches district case-insensitively", () => {
      const result = explain(
        { district: "kreuzberg" },
        { districts: ["Kreuzberg"], location_mode: "districts" }
      );
      expect(result.matched).toBe(true);
    });

    it("matches district with substring (district part of profile district)", () => {
      const result = explain(
        { district: "mitte" },
        { districts: ["Berlin-Mitte"], location_mode: "districts" }
      );
      expect(result.matched).toBe(true);
    });
  });

  describe("Multiple filters combined", () => {
    it("listing matches when all filters pass", () => {
      const result = explain(
        { city: "Berlin", price: 1000, bedrooms: 3, size_m2: 70 },
        { city: "berlin", price_max: 1200, bedrooms_min: 2, size_min: 50 }
      );
      expect(result.matched).toBe(true);
      expect(result.reason).toBe("All active filters passed");
    });

    it("listing fails on first failing filter (city)", () => {
      const result = explain(
        { city: "Hamburg", price: 500, bedrooms: 5, size_m2: 100 },
        { city: "berlin", price_max: 1200, bedrooms_min: 2, size_min: 50 }
      );
      expect(result.matched).toBe(false);
      expect(result.checks.length).toBe(1);
      expect(result.checks[0].filter).toBe("city");
    });

    it("listing fails on price after passing city", () => {
      const result = explain(
        { city: "Berlin", price: 2000 },
        { city: "berlin", price_max: 1500 }
      );
      expect(result.matched).toBe(false);
      expect(result.checks.length).toBe(3);
    });
  });

  describe("MatchExplanation structure", () => {
    it("returns matched=true with all checks for a full match", () => {
      const result = explain({}, {});
      expect(result.matched).toBe(true);
      expect(result.checks.length).toBeGreaterThanOrEqual(5);
      expect(result.reason).toBe("All active filters passed");
    });

    it("each check has required fields", () => {
      const result = explain({}, {});
      for (const check of result.checks) {
        expect(check).toHaveProperty("filter");
        expect(check).toHaveProperty("profileField");
        expect(check).toHaveProperty("profileValue");
        expect(check).toHaveProperty("listingField");
        expect(check).toHaveProperty("listingValue");
        expect(check).toHaveProperty("rule");
        expect(check).toHaveProperty("passed");
      }
    });

    it("hybridPass is set only for hybrid-passed checks", () => {
      const result = explain(
        { price: 0, bedrooms: 0, size_m2: 0, furnished: null },
        { price_max: 1000, bedrooms_min: 2, size_min: 40, furnished: "furnished" }
      );
      const hybridChecks = result.checks.filter(c => c.hybridPass === true);
      expect(hybridChecks.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Edge cases — missing fields", () => {
    it("listing with all zeros matches when profile has no strict filters", () => {
      const result = explain(
        { price: 0, bedrooms: 0, size_m2: 0 },
        { price_min: 0, price_max: 0, bedrooms_min: 0, size_min: 0 }
      );
      expect(result.matched).toBe(true);
    });

    it("listing with all zeros hybrid-passes when profile has strict filters", () => {
      const result = explain(
        { price: 0, bedrooms: 0, size_m2: 0 },
        { price_max: 1000, bedrooms_min: 2, size_min: 50 }
      );
      expect(result.matched).toBe(true);
      expect(findCheck(result, "price_max")?.hybridPass).toBe(true);
      expect(findCheck(result, "bedrooms_min")?.hybridPass).toBe(true);
      expect(findCheck(result, "size_min")?.hybridPass).toBe(true);
    });

    it("listing with known price that exceeds max still fails even if other fields are unknown", () => {
      const result = explain(
        { price: 5000, bedrooms: 0, size_m2: 0 },
        { price_max: 1000, bedrooms_min: 2, size_min: 50 }
      );
      expect(result.matched).toBe(false);
      expect(result.reason).toContain("Price 5000 > max 1000");
    });
  });

  describe("Extra features — supported features with null listing data", () => {
    it("passes listing when garden=null with send_unclear=ON (default)", () => {
      const result = explain(
        {},
        { extra_features: ["garden"] }
      );
      expect(result.matched).toBe(true);
      const check = findCheck(result, "extra_feature:garden");
      expect(check?.hybridPass).toBe(true);
    });

    it("passes listing when parking=null with send_unclear=ON (default)", () => {
      const result = explain(
        {},
        { extra_features: ["parking"] }
      );
      expect(result.matched).toBe(true);
      const check = findCheck(result, "extra_feature:parking");
      expect(check?.hybridPass).toBe(true);
    });

    it("rejects listing when garden=null with send_unclear=OFF", () => {
      const result = explain(
        {},
        { extra_features: ["garden"], send_unclear: false }
      );
      expect(result.matched).toBe(false);
    });

    it("rejects listing when parking=null with send_unclear=OFF", () => {
      const result = explain(
        {},
        { extra_features: ["parking"], send_unclear: false }
      );
      expect(result.matched).toBe(false);
    });

    it("rejects listing when profile requires truly unknown feature (basement)", () => {
      const result = explain(
        {},
        { extra_features: ["basement"] }
      );
      expect(result.matched).toBe(true);
      const check = findCheck(result, "extra_feature:basement");
      expect(check?.skipped).toBe(true);
      expect(check?.unsupported).toBe(true);
    });
  });

  describe("Multiple extra features", () => {
    it("passes when all required features are present", () => {
      const result = explain(
        { pets_allowed: true, balcony: true, elevator: true },
        { extra_features: ["pets_allowed", "balcony", "elevator"] }
      );
      expect(result.matched).toBe(true);
    });

    it("fails when one required feature is missing", () => {
      const result = explain(
        { pets_allowed: true, balcony: true, elevator: false },
        { extra_features: ["pets_allowed", "balcony", "elevator"] }
      );
      expect(result.matched).toBe(false);
    });

    it("no extra_features check when profile has empty array", () => {
      const result = explain(
        { pets_allowed: false, balcony: false },
        { extra_features: [] }
      );
      expect(result.matched).toBe(true);
    });

    it("no extra_features check when profile has null", () => {
      const result = explain(
        { pets_allowed: false },
        { extra_features: null }
      );
      expect(result.matched).toBe(true);
    });
  });

  describe("getCitySearchTerms — SQL prefilter expansion", () => {
    it("returns the normalized city for a simple city", () => {
      const terms = getCitySearchTerms("Berlin");
      expect(terms).toContain("berlin");
    });

    it("returns alias variants for München", () => {
      const terms = getCitySearchTerms("München");
      expect(terms).toContain("münchen");
      expect(terms).toContain("munich");
      expect(terms).toContain("muenchen");
    });

    it("returns alias variants for Köln", () => {
      const terms = getCitySearchTerms("Köln");
      expect(terms).toContain("köln");
      expect(terms).toContain("cologne");
      expect(terms).toContain("koeln");
    });

    it("returns alias variants for reverse lookup (Munich → München)", () => {
      const terms = getCitySearchTerms("Munich");
      expect(terms).toContain("münchen");
      expect(terms).toContain("munich");
    });

    it("returns empty array for empty string", () => {
      expect(getCitySearchTerms("")).toEqual([]);
    });

    it("filters out terms shorter than 3 characters", () => {
      const terms = getCitySearchTerms("Berlin");
      expect(terms.every(t => t.length >= 3)).toBe(true);
    });

    it("strips SQL-unsafe characters", () => {
      const terms = getCitySearchTerms("Frankfurt (Main)");
      for (const t of terms) {
        expect(t).not.toContain("(");
        expect(t).not.toContain(")");
      }
    });
  });
});

describe("Dry-Run Simulation", () => {
  const profiles: SearchProfile[] = [
    makeProfile({
      id: "p-berlin-strict",
      user_id: "u1",
      city: "berlin",
      price_max: 1200,
      bedrooms_min: 2,
      size_min: 50,
      furnished: "furnished",
    }),
    makeProfile({
      id: "p-munich-relaxed",
      user_id: "u2",
      city: "munich",
      city_name: "Munich",
      price_max: 2000,
      bedrooms_min: 1,
      size_min: 0,
    }),
    makeProfile({
      id: "p-koeln-pets",
      user_id: "u3",
      city: "köln",
      price_max: 1000,
      bedrooms_min: 0,
      size_min: 30,
      extra_features: ["pets_allowed"],
    }),
    makeProfile({
      id: "p-hamburg-districts",
      user_id: "u4",
      city: "hamburg",
      price_max: 1500,
      bedrooms_min: 2,
      size_min: 60,
      districts: ["Eimsbüttel", "Altona"],
      location_mode: "districts",
    }),
  ];

  const listings: DbListing[] = [
    makeListing({
      id: "l-berlin-match",
      city: "Berlin",
      price: 1100,
      bedrooms: 3,
      size_m2: 75,
      furnished: true,
    }),
    makeListing({
      id: "l-berlin-too-expensive",
      city: "Berlin",
      price: 1800,
      bedrooms: 3,
      size_m2: 80,
      furnished: true,
    }),
    makeListing({
      id: "l-munich-match",
      city: "München",
      price: 1500,
      bedrooms: 2,
      size_m2: 55,
    }),
    makeListing({
      id: "l-koeln-pets-yes",
      city: "Cologne",
      price: 800,
      bedrooms: 1,
      size_m2: 40,
      pets_allowed: true,
    }),
    makeListing({
      id: "l-koeln-pets-no",
      city: "Köln",
      price: 700,
      bedrooms: 1,
      size_m2: 35,
      pets_allowed: false,
    }),
    makeListing({
      id: "l-koeln-pets-unknown",
      city: "Koeln",
      price: 900,
      bedrooms: 2,
      size_m2: 50,
      pets_allowed: null,
    }),
    makeListing({
      id: "l-hamburg-eimsbuettel",
      city: "Hamburg",
      price: 1300,
      bedrooms: 3,
      size_m2: 70,
      district: "Eimsbüttel",
    }),
    makeListing({
      id: "l-hamburg-spandau",
      city: "Hamburg",
      price: 1000,
      bedrooms: 2,
      size_m2: 65,
      district: "Wandsbek",
    }),
    makeListing({
      id: "l-hamburg-no-district",
      city: "Hamburg",
      price: 1100,
      bedrooms: 2,
      size_m2: 62,
      district: null,
    }),
    makeListing({
      id: "l-unknown-price",
      city: "Berlin",
      price: 0,
      bedrooms: 0,
      size_m2: 0,
    }),
  ];

  type SimResult = { listingId: string; profileId: string; matched: boolean; reason: string };

  const simResults: SimResult[] = [];

  for (const listing of listings) {
    for (const profile of profiles) {
      const result = explainMatchInternal(listing as any, profile as any);
      simResults.push({
        listingId: listing.id,
        profileId: profile.id,
        matched: result.matched,
        reason: result.reason,
      });
    }
  }

  it("Berlin listing matches Berlin strict profile", () => {
    const r = simResults.find(r => r.listingId === "l-berlin-match" && r.profileId === "p-berlin-strict");
    expect(r?.matched).toBe(true);
  });

  it("Berlin too-expensive listing does NOT match Berlin strict profile", () => {
    const r = simResults.find(r => r.listingId === "l-berlin-too-expensive" && r.profileId === "p-berlin-strict");
    expect(r?.matched).toBe(false);
    expect(r?.reason).toContain("Price");
  });

  it("München listing matches Munich profile (alias)", () => {
    const r = simResults.find(r => r.listingId === "l-munich-match" && r.profileId === "p-munich-relaxed");
    expect(r?.matched).toBe(true);
  });

  it("Cologne listing matches Köln profile (alias)", () => {
    const r = simResults.find(r => r.listingId === "l-koeln-pets-yes" && r.profileId === "p-koeln-pets");
    expect(r?.matched).toBe(true);
  });

  it("Köln listing with pets=false does NOT match pets profile", () => {
    const r = simResults.find(r => r.listingId === "l-koeln-pets-no" && r.profileId === "p-koeln-pets");
    expect(r?.matched).toBe(false);
  });

  it("Koeln listing with pets=null hybrid-matches pets profile", () => {
    const r = simResults.find(r => r.listingId === "l-koeln-pets-unknown" && r.profileId === "p-koeln-pets");
    expect(r?.matched).toBe(true);
  });

  it("Hamburg Eimsbüttel listing matches districts profile", () => {
    const r = simResults.find(r => r.listingId === "l-hamburg-eimsbuettel" && r.profileId === "p-hamburg-districts");
    expect(r?.matched).toBe(true);
  });

  it("Hamburg Wandsbek listing does NOT match districts profile", () => {
    const r = simResults.find(r => r.listingId === "l-hamburg-spandau" && r.profileId === "p-hamburg-districts");
    expect(r?.matched).toBe(false);
  });

  it("Hamburg listing with no district hybrid-matches districts profile", () => {
    const r = simResults.find(r => r.listingId === "l-hamburg-no-district" && r.profileId === "p-hamburg-districts");
    expect(r?.matched).toBe(true);
  });

  it("Unknown-price Berlin listing hybrid-matches Berlin profile", () => {
    const r = simResults.find(r => r.listingId === "l-unknown-price" && r.profileId === "p-berlin-strict");
    expect(r?.matched).toBe(true);
  });

  it("cross-city listings do NOT match", () => {
    const crossCity = simResults.filter(r =>
      r.listingId.startsWith("l-hamburg") && r.profileId === "p-berlin-strict"
    );
    expect(crossCity.every(r => !r.matched)).toBe(true);
  });

  it("simulation summary: outputs profile×listing match grid", () => {
    const matchCount = simResults.filter(r => r.matched).length;
    const rejectCount = simResults.filter(r => !r.matched).length;
    expect(matchCount).toBeGreaterThan(0);
    expect(rejectCount).toBeGreaterThan(0);
    expect(matchCount + rejectCount).toBe(listings.length * profiles.length);

    console.log("\n=== DRY-RUN SIMULATION SUMMARY ===");
    console.log(`Total combinations: ${simResults.length}`);
    console.log(`Matches: ${matchCount}, Rejections: ${rejectCount}\n`);

    for (const profile of profiles) {
      const profileResults = simResults.filter(r => r.profileId === profile.id);
      const matches = profileResults.filter(r => r.matched);
      console.log(`Profile [${profile.id}] (city=${profile.city_name || profile.city}, max=€${profile.price_max}):`);
      if (matches.length === 0) {
        console.log("  No matches");
      } else {
        for (const m of matches) {
          console.log(`  ✓ ${m.listingId}`);
        }
      }
      const rejections = profileResults.filter(r => !r.matched);
      for (const r of rejections) {
        console.log(`  ✗ ${r.listingId}: ${r.reason}`);
      }
      console.log("");
    }
  });
});
