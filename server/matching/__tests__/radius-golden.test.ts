import { explainMatchInternal, haversineDistanceKm } from "../engine";

const BASE_LISTING = {
  id: "L-BASE",
  source: "wg-gesucht",
  url: null,
  title: "Test Listing",
  city: "Berlin",
  price: 1000,
  bedrooms: 2,
  size_m2: 50,
};

const BASE_PROFILE = {
  id: "P-BASE",
  user_id: "u1",
  city: "Berlin",
  city_name: "Berlin",
  price_min: 0,
  price_max: 2000,
  bedrooms_min: 1,
  size_min: 30,
};

const BERLIN_MITTE = { latitude: 52.5200, longitude: 13.4050 };
const LISTING_3KM = { latitude: 52.5400, longitude: 13.3800 };
const LISTING_8KM = { latitude: 52.5900, longitude: 13.3200 };

describe("haversineDistanceKm", () => {
  it("calculates Berlin Mitte to ~3km point correctly", () => {
    const d = haversineDistanceKm(
      BERLIN_MITTE.latitude, BERLIN_MITTE.longitude,
      LISTING_3KM.latitude, LISTING_3KM.longitude
    );
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(4);
  });

  it("calculates Berlin Mitte to ~8km point correctly", () => {
    const d = haversineDistanceKm(
      BERLIN_MITTE.latitude, BERLIN_MITTE.longitude,
      LISTING_8KM.latitude, LISTING_8KM.longitude
    );
    expect(d).toBeGreaterThan(6);
    expect(d).toBeLessThan(10);
  });

  it("returns 0 for same coordinates", () => {
    const d = haversineDistanceKm(52.52, 13.405, 52.52, 13.405);
    expect(d).toBe(0);
  });

  it("calculates known large distance correctly", () => {
    const d = haversineDistanceKm(52.52, 13.405, 48.1351, 11.5820);
    expect(d).toBeGreaterThan(450);
    expect(d).toBeLessThan(520);
  });
});

describe("Radius filtering — CASE 1: listing inside radius", () => {
  it("matches when listing distance (3.2km) < radius (5km)", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING, ...LISTING_3KM },
      {
        ...BASE_PROFILE,
        location_mode: "radius",
        ...BERLIN_MITTE,
        radius_km: 5,
      }
    );
    expect(result.matched).toBe(true);
    const radiusCheck = result.checks.find(c => c.filter === "radius");
    expect(radiusCheck).toBeDefined();
    expect(radiusCheck!.passed).toBe(true);
    expect(radiusCheck!.listingValue).toContain("distance=");
  });
});

describe("Radius filtering — CASE 2: listing outside radius", () => {
  it("rejects when listing distance (~8km) > radius (5km)", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING, ...LISTING_8KM },
      {
        ...BASE_PROFILE,
        location_mode: "radius",
        ...BERLIN_MITTE,
        radius_km: 5,
      }
    );
    expect(result.matched).toBe(false);
    const radiusCheck = result.checks.find(c => c.filter === "radius");
    expect(radiusCheck).toBeDefined();
    expect(radiusCheck!.passed).toBe(false);
    expect(result.reason).toContain("Radius:");
  });
});

describe("Radius filtering — CASE 3: listing missing coordinates", () => {
  it("rejects when listing has no lat/lng in radius mode", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING },
      {
        ...BASE_PROFILE,
        location_mode: "radius",
        ...BERLIN_MITTE,
        radius_km: 5,
      }
    );
    expect(result.matched).toBe(false);
    const radiusCheck = result.checks.find(c => c.filter === "radius");
    expect(radiusCheck).toBeDefined();
    expect(radiusCheck!.passed).toBe(false);
    expect(radiusCheck!.rule).toContain("send_unclear does NOT override");
  });

  it("rejects even when send_unclear is ON", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING },
      {
        ...BASE_PROFILE,
        location_mode: "radius",
        ...BERLIN_MITTE,
        radius_km: 5,
        send_unclear: true,
      }
    );
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("no coordinates");
  });
});

describe("Radius filtering — CASE 4: whole city mode", () => {
  it("uses city matching, not radius", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING },
      {
        ...BASE_PROFILE,
        location_mode: "city",
      }
    );
    expect(result.matched).toBe(true);
    expect(result.checks.find(c => c.filter === "city")).toBeDefined();
    expect(result.checks.find(c => c.filter === "radius")).toBeUndefined();
  });

  it("city mode: city mismatch fails", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING, city: "München" },
      {
        ...BASE_PROFILE,
        location_mode: "city",
      }
    );
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("City mismatch");
  });
});

describe("Radius filtering — CASE 5: districts mode", () => {
  it("uses district matching, not radius", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING, district: "Mitte" },
      {
        ...BASE_PROFILE,
        location_mode: "districts",
        districts: ["Mitte", "Kreuzberg"],
      }
    );
    expect(result.matched).toBe(true);
    expect(result.checks.find(c => c.filter === "district")).toBeDefined();
    expect(result.checks.find(c => c.filter === "radius")).toBeUndefined();
  });

  it("districts mode: non-matching district fails", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING, district: "Spandau" },
      {
        ...BASE_PROFILE,
        location_mode: "districts",
        districts: ["Mitte", "Kreuzberg"],
      }
    );
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("District");
  });
});

describe("Radius filtering — CASE 6: profile missing coordinates in radius mode", () => {
  it("rejects when profile lat is null", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING, ...LISTING_3KM },
      {
        ...BASE_PROFILE,
        location_mode: "radius",
        latitude: null,
        longitude: 13.405,
        radius_km: 5,
      }
    );
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("profile missing center coordinates");
  });

  it("rejects when profile lng is null", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING, ...LISTING_3KM },
      {
        ...BASE_PROFILE,
        location_mode: "radius",
        latitude: 52.52,
        longitude: null,
        radius_km: 5,
      }
    );
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("profile missing center coordinates");
  });

  it("rejects when radius_km is null", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING, ...LISTING_3KM },
      {
        ...BASE_PROFILE,
        location_mode: "radius",
        ...BERLIN_MITTE,
        radius_km: null,
      }
    );
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("profile missing center coordinates");
  });

  it("rejects when radius_km is 0", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING, ...LISTING_3KM },
      {
        ...BASE_PROFILE,
        location_mode: "radius",
        ...BERLIN_MITTE,
        radius_km: 0,
      }
    );
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("profile missing center coordinates");
  });
});

describe("Radius filtering — default/no location mode", () => {
  it("defaults to city matching when location_mode is undefined", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING },
      { ...BASE_PROFILE }
    );
    expect(result.matched).toBe(true);
    expect(result.checks.find(c => c.filter === "city")).toBeDefined();
    expect(result.checks.find(c => c.filter === "radius")).toBeUndefined();
  });

  it("defaults to city matching when location_mode is null", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING },
      { ...BASE_PROFILE, location_mode: null }
    );
    expect(result.matched).toBe(true);
    expect(result.checks.find(c => c.filter === "city")).toBeDefined();
  });
});

describe("Radius filtering — edge cases", () => {
  it("listing exactly at radius boundary passes", () => {
    const d = haversineDistanceKm(
      BERLIN_MITTE.latitude, BERLIN_MITTE.longitude,
      LISTING_3KM.latitude, LISTING_3KM.longitude
    );
    const result = explainMatchInternal(
      { ...BASE_LISTING, ...LISTING_3KM },
      {
        ...BASE_PROFILE,
        location_mode: "radius",
        ...BERLIN_MITTE,
        radius_km: Math.ceil(d),
      }
    );
    expect(result.matched).toBe(true);
  });

  it("radius mode does not require city match (cross-city)", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING, city: "Potsdam", ...LISTING_3KM },
      {
        ...BASE_PROFILE,
        city: "Berlin",
        city_name: "Berlin",
        location_mode: "radius",
        ...BERLIN_MITTE,
        radius_km: 5,
      }
    );
    expect(result.matched).toBe(true);
    expect(result.checks.find(c => c.filter === "city")).toBeUndefined();
    expect(result.checks.find(c => c.filter === "radius")!.passed).toBe(true);
  });

  it("large radius captures distant but in-range listing", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING, ...LISTING_8KM },
      {
        ...BASE_PROFILE,
        location_mode: "radius",
        ...BERLIN_MITTE,
        radius_km: 20,
      }
    );
    expect(result.matched).toBe(true);
  });

  it("other filters still apply in radius mode", () => {
    const result = explainMatchInternal(
      { ...BASE_LISTING, ...LISTING_3KM, price: 5000 },
      {
        ...BASE_PROFILE,
        location_mode: "radius",
        ...BERLIN_MITTE,
        radius_km: 5,
        price_max: 2000,
      }
    );
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("Price");
  });
});
