const isEmbedded = new URLSearchParams(window.location.search).get("embed") === "true";
const containerClass = isEmbedded ? "max-w-4xl" : "max-w-xl";

export function useEmbedded() {
  return { isEmbedded, containerClass };
}
