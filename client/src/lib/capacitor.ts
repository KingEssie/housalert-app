import { Capacitor } from '@capacitor/core';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): string {
  return Capacitor.getPlatform();
}

export async function initCapacitorPlugins(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#1A1A1A' });
  } catch {}

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {}
}

export async function registerNativePush(): Promise<string | null> {
  if (!isNativePlatform()) return null;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return null;

    await PushNotifications.register();

    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token) => {
        resolve(token.value);
      });
      PushNotifications.addListener('registrationError', () => {
        resolve(null);
      });
      setTimeout(() => resolve(null), 5000);
    });
  } catch {
    return null;
  }
}
