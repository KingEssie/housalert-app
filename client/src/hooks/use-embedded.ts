import { useMemo } from "react";

export function useEmbedded() {
  const isEmbedded = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const containerClass = isEmbedded ? "max-w-4xl" : "max-w-xl";

  return { isEmbedded, containerClass };
}
