import { useSyncExternalStore } from "react";

const isNative = (window as any).Capacitor?.isNativePlatform?.() === true;

const listeners: Array<() => void> = [];

function subscribe(cb: () => void) {
  listeners.push(cb);
  if (listeners.length === 1) {
    window.addEventListener("hashchange", notify);
    window.addEventListener("popstate", notify);
  }
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx >= 0) listeners.splice(idx, 1);
    if (listeners.length === 0) {
      window.removeEventListener("hashchange", notify);
      window.removeEventListener("popstate", notify);
    }
  };
}

function notify() {
  listeners.forEach((cb) => cb());
}

function getSearch(): string {
  if (isNative) {
    const hash = window.location.hash;
    const qIdx = hash.indexOf("?");
    return qIdx >= 0 ? hash.slice(qIdx) : "";
  }
  return window.location.search;
}

export function useHashSearch(): string {
  return useSyncExternalStore(subscribe, getSearch, () => "");
}
