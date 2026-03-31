import { useState, useRef, useCallback, useEffect } from "react";
import type { LocationResult } from "@/lib/location-types";
import { geocoderSearch, type PlaceSearchOptions } from "@/lib/place-search-service";

interface UseGeocoderSearchOptions {
  debounceMs?: number;
  minChars?: number;
  countryCodes?: string[];
  limit?: number;
  language?: string;
}

export function useGeocoderSearch(options: UseGeocoderSearchOptions = {}) {
  const {
    debounceMs = 300,
    minChars = 2,
    countryCodes = ["de"],
    limit = 6,
    language = "de",
  } = options;

  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(0);

  const searchImmediate = useCallback(async (query: string) => {
    if (query.trim().length < minChars) {
      setResults([]);
      return;
    }
    const id = ++abortRef.current;
    setLoading(true);
    try {
      const searchOpts: PlaceSearchOptions = { countryCodes, limit, language };
      const r = await geocoderSearch(query, searchOpts);
      if (abortRef.current === id) {
        setResults(r);
      }
    } catch {
      if (abortRef.current === id) setResults([]);
    } finally {
      if (abortRef.current === id) setLoading(false);
    }
  }, [minChars, countryCodes, limit, language]);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < minChars) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => searchImmediate(query), debounceMs);
  }, [debounceMs, minChars, searchImmediate]);

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current++;
    setResults([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current++;
    };
  }, []);

  return { results, loading, search, searchImmediate, clear };
}
