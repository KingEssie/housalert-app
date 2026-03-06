export interface ScoreInput {
  listing: {
    price: number;
    bedrooms: number;
    size_m2: number;
    city: string;
  };
  profile: {
    city: string;
    price_min: number;
    price_max: number;
    bedrooms_min: number;
    size_min: number;
  };
}

export interface MatchScore {
  score: number;
  label: string;
  details: {
    city: number;
    price: number;
    bedrooms: number;
    size: number;
  };
}

export function computeMatchScore(input: ScoreInput): MatchScore {
  const { listing, profile } = input;
  let cityScore = 0;
  let priceScore = 0;
  let bedroomsScore = 0;
  let sizeScore = 0;

  const lCity = listing.city.toLowerCase().trim();
  const pCity = profile.city.toLowerCase().trim();
  if (!pCity || !lCity) {
    cityScore = 15;
  } else if (lCity === pCity) {
    cityScore = 30;
  } else if (lCity.includes(pCity) || pCity.includes(lCity)) {
    cityScore = 22;
  } else {
    cityScore = 5;
  }

  const pMin = Math.min(profile.price_min, profile.price_max || Infinity);
  const pMax = Math.max(profile.price_min, profile.price_max);

  if (pMax > 0 && pMin >= 0) {
    const range = pMax - pMin;
    if (range > 0) {
      const midpoint = pMin + range * 0.4;
      const diff = Math.abs(listing.price - midpoint);
      const ratio = diff / range;
      if (listing.price >= pMin && listing.price <= pMax) {
        priceScore = Math.round(30 - ratio * 12);
        priceScore = Math.max(18, Math.min(30, priceScore));
      } else {
        const overshoot = listing.price > pMax
          ? (listing.price - pMax) / range
          : (pMin - listing.price) / range;
        priceScore = Math.max(0, Math.round(15 - overshoot * 30));
      }
    } else {
      priceScore = listing.price === pMax ? 30 : 10;
    }
  } else if (pMax > 0) {
    priceScore = listing.price <= pMax ? 25 : Math.max(0, 15 - Math.round((listing.price - pMax) / 100) * 3);
  } else {
    priceScore = 20;
  }

  if (profile.bedrooms_min > 0) {
    if (listing.bedrooms >= profile.bedrooms_min) {
      const extra = listing.bedrooms - profile.bedrooms_min;
      bedroomsScore = extra === 0 ? 20 : extra === 1 ? 18 : 15;
    } else {
      const deficit = profile.bedrooms_min - listing.bedrooms;
      bedroomsScore = Math.max(0, 10 - deficit * 5);
    }
  } else {
    bedroomsScore = listing.bedrooms > 0 ? 18 : 15;
  }

  if (profile.size_min > 0) {
    if (listing.size_m2 >= profile.size_min) {
      const extra = listing.size_m2 - profile.size_min;
      const ratio = extra / profile.size_min;
      sizeScore = ratio < 0.1 ? 20 : ratio < 0.3 ? 18 : 15;
    } else {
      const deficit = (profile.size_min - listing.size_m2) / profile.size_min;
      sizeScore = Math.max(0, Math.round(12 - deficit * 20));
    }
  } else {
    sizeScore = listing.size_m2 > 0 ? 17 : 15;
  }

  const score = Math.min(100, cityScore + priceScore + bedroomsScore + sizeScore);

  return {
    score,
    label: getScoreLabel(score),
    details: {
      city: cityScore,
      price: priceScore,
      bedrooms: bedroomsScore,
      size: sizeScore,
    },
  };
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "Perfecte match";
  if (score >= 75) return "Sterke match";
  if (score >= 60) return "Goede match";
  if (score >= 40) return "Mogelijke match";
  return "Lage match";
}

const REASON_LABELS: Record<string, string> = {
  city: "locatie",
  price: "prijs",
  bedrooms: "kamers",
  size: "grootte",
};

const REASON_MAX: Record<string, number> = {
  city: 30,
  price: 30,
  bedrooms: 20,
  size: 20,
};

export function getMatchReasons(details: MatchScore["details"]): string[] {
  const entries = Object.entries(details) as [keyof typeof REASON_MAX, number][];
  const strong = entries
    .filter(([key, val]) => val >= REASON_MAX[key] * 0.7)
    .sort((a, b) => {
      const ratioA = a[1] / REASON_MAX[a[0]];
      const ratioB = b[1] / REASON_MAX[b[0]];
      return ratioB - ratioA;
    })
    .slice(0, 3)
    .map(([key]) => REASON_LABELS[key]);
  return strong;
}
