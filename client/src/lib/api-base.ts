const PROD_API_BASE = "https://app.housalert.com";

function isNative(): boolean {
  return (window as any).Capacitor?.isNativePlatform?.() === true;
}

export function getApiBase(): string {
  return isNative() ? PROD_API_BASE : "";
}

export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = input.startsWith("/api") ? getApiBase() + input : input;
  const merged: RequestInit = { credentials: "include", ...init };
  return fetch(url, merged);
}
