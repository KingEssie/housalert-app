interface SyncStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const CACHE_PREFIX = "cap_auth_";

function isNative(): boolean {
  return (window as any).Capacitor?.isNativePlatform?.() === true;
}

async function preferencesSet(key: string, value: string) {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({ key, value });
}

async function preferencesGet(key: string): Promise<string | null> {
  const { Preferences } = await import("@capacitor/preferences");
  const result = await Preferences.get({ key });
  return result.value;
}

async function preferencesRemove(key: string) {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.remove({ key });
}

function syncToNative(key: string, value: string | null) {
  if (!isNative()) return;
  const fullKey = CACHE_PREFIX + key;
  if (value === null) {
    preferencesRemove(fullKey).catch(() => {});
  } else {
    preferencesSet(fullKey, value).catch(() => {});
  }
}

export async function restoreAuthFromNative(): Promise<void> {
  if (!isNative()) return;
  try {
    const stored = await preferencesGet(CACHE_PREFIX + "housalert-auth");
    if (stored && !localStorage.getItem("housalert-auth")) {
      localStorage.setItem("housalert-auth", stored);
    }
  } catch {}
}

export function createCapacitorStorage(): SyncStorage {
  return {
    getItem(key: string): string | null {
      return localStorage.getItem(key);
    },
    setItem(key: string, value: string): void {
      localStorage.setItem(key, value);
      syncToNative(key, value);
    },
    removeItem(key: string): void {
      localStorage.removeItem(key);
      syncToNative(key, null);
    },
  };
}
