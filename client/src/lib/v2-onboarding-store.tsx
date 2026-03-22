import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface V2OnboardingData {
  language: string;
  city: string;
  lat: number;
  lng: number;
  radius: number;
  locationMode: "city" | "custom";
  minPrice: number;
  maxPrice: number;
  minSize: number;
  maxSize: number;
  minRooms: number;
  maxRooms: number;
  propertyTypes: string[];
  furnished: string;
  moveInDate: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  whatsappNotifications: boolean;
  notificationFrequency: string;
  [key: string]: any;
}

const DEFAULT_DATA: V2OnboardingData = {
  language: "de",
  city: "",
  lat: 52.52,
  lng: 13.405,
  radius: 5,
  locationMode: "city",
  minPrice: 0,
  maxPrice: 2000,
  minSize: 0,
  maxSize: 200,
  minRooms: 1,
  maxRooms: 5,
  propertyTypes: [],
  furnished: "any",
  moveInDate: "",
  emailNotifications: true,
  pushNotifications: true,
  whatsappNotifications: false,
  notificationFrequency: "instant",
};

interface V2OnboardingContextType {
  data: V2OnboardingData;
  update: (partial: Partial<V2OnboardingData>) => void;
  reset: () => void;
}

const V2OnboardingContext = createContext<V2OnboardingContextType>({
  data: DEFAULT_DATA,
  update: () => {},
  reset: () => {},
});

export function V2OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<V2OnboardingData>({ ...DEFAULT_DATA });

  const update = useCallback((partial: Partial<V2OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setData({ ...DEFAULT_DATA });
  }, []);

  return (
    <V2OnboardingContext.Provider value={{ data, update, reset }}>
      {children}
    </V2OnboardingContext.Provider>
  );
}

export function useV2Onboarding() {
  return useContext(V2OnboardingContext);
}
