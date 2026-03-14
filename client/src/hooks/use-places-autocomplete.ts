import { useState, useRef, useCallback } from "react";

export interface PlaceSuggestion {
  place_id: string;
  display_name: string;
  city_name: string;
  state?: string;
  country_code: string;
  latitude?: number;
  longitude?: number;
}

interface UsePlacesAutocompleteOptions {
  debounceMs?: number;
  minChars?: number;
}

function generateSessionToken(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function usePlacesAutocomplete(options: UsePlacesAutocompleteOptions = {}) {
  const { debounceMs = 300, minChars = 2 } = options;
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<string>(generateSessionToken());
  const abortRef = useRef<AbortController | null>(null);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = generateSessionToken();
  }, []);

  const search = useCallback(async (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (query.trim().length < minChars) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const params = new URLSearchParams({
          input: query,
          session_token: sessionTokenRef.current,
        });
        const res = await fetch(`/api/places/autocomplete?${params}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          if (res.status === 503) {
            setIsAvailable(false);
          }
          setSuggestions([]);
          return;
        }

        const data = await res.json();
        setIsAvailable(true);
        setSuggestions(data.suggestions ?? []);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, debounceMs);
  }, [debounceMs, minChars]);

  const getDetails = useCallback(async (placeId: string): Promise<PlaceSuggestion | null> => {
    try {
      const params = new URLSearchParams({
        place_id: placeId,
        session_token: sessionTokenRef.current,
      });
      const res = await fetch(`/api/places/details?${params}`);

      resetSession();

      if (!res.ok) return null;
      const data = await res.json();
      return data.place ?? null;
    } catch {
      return null;
    }
  }, [resetSession]);

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    loading,
    isAvailable,
    search,
    getDetails,
    clear,
    resetSession,
  };
}
