interface SyncStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const CACHE_PREFIX = "cap_auth_";

function isNative(): boolean {
  return (window as any).Capacitor?.isNativePlatform?.() === true;
}

let preferencesModule: typeof import("@capacitor/preferences") | null = null;

async function getPreferences() {
  if (!preferencesModule) {
    preferencesModule = await import("@capacitor/preferences");
  }
  return preferencesModule.Preferences;
}

function syncToNative(key: string, value: string | null) {
  if (!isNative()) return;
  getPreferences().then((Preferences) => {
    if (value === null) {
      Preferences.remove({ key: CACHE_PREFIX + key });
    } else {
      Preferences.set({ key: CACHE_PREFIX + key, value });
    }
  }).catch(() => {});
}

export async function restoreAuthFromNative(): Promise<void> {
  if (!isNative()) return;
  try {
    const Preferences = await getPreferences();
    const { value } = await Preferences.get({ key: CACHE_PREFIX + "housalert-auth" });
    if (value && !localStorage.getItem("housalert-auth")) {
      localStorage.setItem("housalert-auth", value);
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
