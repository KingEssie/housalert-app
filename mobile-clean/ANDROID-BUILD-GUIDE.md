# HousAlert — Android Build Guide

## Prerequisites

1. **Expo account**: You must be logged in via `eas login` (owner: `kingessie`)
2. **EAS CLI**: Already installed (`eas-cli/18.3.0`)
3. **Expo project**: Linked to project ID `23f0e358-86b0-41c6-8eb5-457ece076a21`

## Build Commands

All commands run from the `mobile-clean/` directory.

### Internal Testing (AAB for Play Console)

```bash
cd mobile-clean
eas build --platform android --profile internal-testing
```

This produces an `.aab` file (Android App Bundle) that you can upload to Google Play Console under **Internal Testing**.

### Preview Build (APK for sideloading)

```bash
eas build --platform android --profile preview
```

This produces an `.apk` you can install directly on a device for quick testing.

### Production Build

```bash
eas build --platform android --profile production
```

This produces a signed `.aab` for production release on Google Play.

## Google Play Console Setup

1. Go to [Google Play Console](https://play.google.com/console)
2. Create a new app:
   - App name: **HousAlert**
   - Default language: **Dutch (Netherlands)**
   - App type: **App**
   - Free or Paid: your choice
3. Complete the **Store listing** (screenshots, description, etc.)
4. Go to **Internal testing** → **Create a new release**
5. Upload the `.aab` from the EAS build
6. Add testers by email
7. Review and roll out

## App Signing

EAS Build manages app signing automatically. On first build:
- EAS generates a keystore and stores it securely
- Google Play App Signing is recommended (upload key + signing key)
- To use Google Play App Signing, download the upload certificate from EAS and register it in Play Console

To view your keystore:
```bash
eas credentials --platform android
```

## Submit to Play Console (automated)

To automate upload to Play Console:
1. Create a Google Play service account with appropriate permissions
2. Download the JSON key file
3. Place it at `mobile-clean/play-store-key.json`
4. Run:
```bash
eas submit --platform android --profile production
```

## Adding Push Notifications (FCM)

When ready to enable push notifications:
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add an Android app with package name `com.housalert.app`
3. Download `google-services.json` and place it in `mobile-clean/`
4. Add back to `app.json` under `android`:
   ```json
   "googleServicesFile": "./google-services.json"
   ```
5. Upload your FCM server key to Expo:
   ```bash
   eas credentials --platform android
   ```
   Choose "Push Notifications" and upload the FCM V1 service account key.

## Adding a High-Resolution Icon

The current icon is 200x200px. For production:
1. Create a 1024x1024px `icon.png` (full bleed, with some padding)
2. Create a 1024x1024px `adaptive-icon-foreground.png` (centered logo on transparent background, keep ~30% safe zone margin)
3. Replace both files in `mobile-clean/assets/`

## Current Configuration

- **Package name**: `com.housalert.app`
- **Version**: 1.0.0 (versionCode: 1)
- **Target SDK**: Managed by Expo (SDK 34+ compliant)
- **Deep links**: `https://app.housalert.com` and `housalert://` scheme
- **Web app URL**: `https://app.housalert.com`
- **Push**: Expo Push Tokens (FCM not configured yet)
