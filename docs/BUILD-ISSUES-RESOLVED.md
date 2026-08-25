# Mobile Build Issues — Root Causes & Fixes

**Date**: 2026-08-24 / 2026-08-25
**Context**: Play Store review reported "Service Unavailable" on app open. Investigation while setting up local iOS/Android builds surfaced several stacked build-config bugs.

---

## 1. Production app showed "Service Unavailable" on every screen

**Symptom**: Both the Play Store review build and a fresh local test hit a "Service Unavailable — check your internet connection" screen immediately after login, even though the backend was healthy.

**Root cause**: The shipped Android build (v1, built 2026-08-01) never had `EXPO_PUBLIC_API_URL` baked in at build time. `src/services/api.ts` falls back to `http://localhost:3002/api/v1` when the env var is unset:

```ts
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';
```

On a real device, `localhost` resolves to the phone itself, not a server — every request fails.

Confirmed by downloading the shipped `.aab` from EAS (`eas build:view <id>` → Application Archive URL), extracting the Hermes bundle, and checking for the production URL string — it wasn't present.

**Fix**: `eas.json`'s `production` build profile already had the correct env block:
```json
"env": {
  "EXPO_PUBLIC_API_URL": "https://api.thewileyfox.com/api/v1",
  ...
}
```
This existed but the Aug 1 build predated it (or ran before it was added). Triggering a fresh build under the current `eas.json` re-injects the correct URL — confirmed via the EAS build log's explicit line: `Environment variables loaded from the "production" build profile "env" configuration: EXPO_PUBLIC_API_URL, ...`.

**Verification**: Built new `.aab` locally, converted to installable APK via `bundletool`, ran on emulator — app loaded past login into the map screen with live data, no "Service Unavailable" screen.

---

## 2. Local iOS build (`eas build --local`) failed: distribution cert import

**Symptom**: `eas build --platform ios --profile production --local` failed at the credentials phase:
```
Error: Distribution certificate with fingerprint ... hasn't been imported successfully
```
Reproduced across CLI versions (18.5.0 and 22.3.0) and after re-generating the provisioning profile.

**Root cause** (two layered bugs):
1. Fastlane's `import_certificate` action runs `security import` silently (`log_output` defaults to `false`), so the real failure/success detail never printed — only a generic "not imported" error surfaced.
2. Once verbose output was forced, `security import` actually **succeeded** ("1 identity imported"). The real problem: `security find-identity -v` on the temp keychain reported "0 valid identities found" because the **Apple WWDR intermediate + root CA certificates** were never added to that temp keychain. Without the full trust chain present in the keychain being queried, `find-identity` treats the cert as untrusted/invalid even though it's physically present.

**Fix**: Patched the EAS build-tools' `Keychain.importCertificate()` (in the cached `@expo/build-tools` npm package) to:
- Call `security import` directly (bypassing fastlane's silent wrapper) with `-T /usr/bin/codesign -T /usr/bin/security -A`
- Run `security set-key-partition-list` after import
- Import Apple's `AppleWWDRCAG3.cer`, `AppleWWDRCAG2.cer`, and `AppleRootCA-G2.cer` into the same temp keychain right after the distribution cert

This is a workaround patched into a cached npx-installed package, not a repo change — it will need to be reapplied if the npx cache is cleared or a different machine runs local iOS builds. Cloud builds (`eas build` without `--local`) are unaffected since Expo's build servers already have the correct trust chain configured.

**Result**: Local iOS build succeeded, produced a valid signed `.ipa`. Verified bundle ID, team ID, provisioning profile expiry, and codesign details all correct via `codesign -dv` and `security cms -D`.

---

## 3. Local Android build failed: `sentry.gradle.kts` not found

**Symptom**:
```
Could not read script '.../node_modules/@sentry/react-native/sentry.gradle.kts' as it does not exist.
```

**Root cause**: `@sentry/react-native` had been downgraded from 8.21.0 to 6.10.0 (see #6 below) to fix an iOS CocoaPods conflict. Version 6.x ships `sentry.gradle` (Groovy), not `sentry.gradle.kts` (Kotlin script) — that filename only exists in 8.x. `android/app/build.gradle` still referenced the `.kts` filename from before the downgrade.

**Fix**: Changed the `apply from:` reference in `android/app/build.gradle` from `sentry.gradle.kts` to `sentry.gradle`.

---

## 4. Local Android build failed: Sentry auth token missing

**Symptom**:
```
error: Auth token is required for this request. Please run `sentry-cli login` and try again!
```
during the `createBundleReleaseJsAndAssets_SentryUpload` Gradle task.

**Root cause**: `android/sentry.properties` relies on the `SENTRY_AUTH_TOKEN` environment variable being present in the shell running Gradle. The token exists in `.env.local`, but that file is loaded by Expo/Metro's env system — Gradle (a separate JVM process) never sees it unless explicitly exported into the shell.

**Fix**: Export the token into the shell before running the local build:
```bash
export SENTRY_AUTH_TOKEN=$(grep "SENTRY_AUTH_TOKEN" .env.local | cut -d= -f2-)
eas build --platform android --profile production --local
```

---

## 5. Local Android build failed: `google-services.json` missing

**Symptom**:
```
Execution failed for task ':app:processReleaseGoogleServices'.
File google-services.json is missing.
```
File was present on disk at `apps/mobile/google-services.json`.

**Root cause** (two layered issues):
1. `apps/mobile/.gitignore` excludes `google-services.json` from git tracking.
2. **`.easignore` only works when placed at the git repository root** (`safetag/`), not in the subdirectory being built (`apps/mobile/`). This is documented in the EAS CLI source (`vcs/local.js`): *"if `.easignore` exists, `.gitignore` files are not used"* — but it only checks for `.easignore` at the repo root. Since one didn't exist there, the CLI fell back to `.gitignore`-based exclusion (including the nested `apps/mobile/.gitignore` rule), and the file was dropped from the local build archive.

**Fix**:
- Created `.easignore` at `safetag/.easignore` (repo root, not `apps/mobile/`)
- Force-added `apps/mobile/google-services.json` to git (`git add -f`) since it's a public Firebase app config file, not a secret, and EAS's local build archiver is git-tracking-aware

---

## 6. iOS local build: CocoaPods dependency conflict (cloud build too)

**Symptom**: Cloud build failed:
```
🍏 iOS build failed:
Compatible versions of some pods could not be resolved.
```

**Root cause**: `@sentry/react-native@8.21.0` was installed, but the project's Expo SDK (52) expects `~6.10.0`. The newer Sentry version pulls different native pod dependency versions that conflict with other pods in the Podfile.

**Fix**: `npx expo install @sentry/react-native --fix` — pinned to the SDK-compatible version (`6.10.0`). Confirmed via `pod install` locally afterward: 106 pods resolved cleanly with no conflicts.

*(This downgrade is what caused issue #3 above — the two are linked.)*

---

## 7. Android release build: map showed "Map unavailable in this runtime"

**Symptom**: App loaded and authenticated correctly (confirming fixes #1–#6 worked), but the map screen showed:
> Map unavailable in this runtime
> Open the app using the installed development build instead of Expo Go.

This message text is misleading/generic — the app was a production build, not Expo Go.

**Root cause**: `app/(app)/map.tsx` tries to load `@rnmapbox/maps` at runtime and gates rendering on `HAS_MAPBOX_TOKEN` (whether `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` resolved to a non-empty string) **and** the native Mapbox module loading successfully. `eas.json`'s `production` build profile `env` block did not include `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` — so the token was empty at build time, `HAS_MAPBOX_TOKEN` was `false`, and the app fell through to its no-map fallback UI.

**Fix**: Added `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` to the `production` profile's `env` block in `eas.json`, matching the value already used in local `.env`.

**Verification**: Rebuilt, reinstalled on emulator — map rendered correctly with Mapbox tiles (streets, labels, highway shields all visible).

**Follow-up not yet done**: The `preview` build profile in `eas.json` has the same gap (no Mapbox token) — internal testers using preview builds would hit the same blank map.

---

## Summary of file changes

| File | Change |
|---|---|
| `safetag/apps/mobile/eas.json` | Added `ios.simulator: true` to `development` profile; added `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` to `production` profile env |
| `safetag/apps/mobile/android/app/build.gradle` | Fixed `sentry.gradle.kts` → `sentry.gradle` |
| `safetag/apps/mobile/package.json` (via `expo install`) | `@sentry/react-native` 8.21.0 → 6.10.0 |
| `safetag/.easignore` | Created at repo root (previously mistakenly placed in `apps/mobile/`) |
| `apps/mobile/google-services.json` | Force-added to git tracking (was gitignored) |
| `apps/mobile/expo-dev-client` | Installed (required for `development` build profile) |

## Known workaround not in repo

The Apple WWDR/Root CA keychain patch (issue #2) is applied directly to the cached `@expo/build-tools` npm package under `~/.npm/_npx/`, not committed to the repo. It only affects `eas build --local` on this machine. If local iOS builds are needed on another machine, or the npx cache is cleared, the same patch needs to be reapplied — or use cloud builds (`eas build` without `--local`), which don't hit this issue.

## `apps/mobile/eas.json` is gitignored — manual setup required

`eas.json` is **not tracked in git** (see `apps/mobile/.gitignore`). It was originally excluded for this reason; it got force-tracked briefly during this session's fixes and had to be removed after GitHub's push protection blocked the commit for containing the Mapbox `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` value (a `pk.*` public token — safe to expose in a shipped app, but still matched GitHub's secret-scanning pattern for Mapbox tokens).

**Anyone setting up this repo fresh, or running local builds, needs to recreate `apps/mobile/eas.json` manually** with this content:

```json
{
  "cli": {
    "version": ">= 13.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {},
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.thewileyfox.com/api/v1",
        "EXPO_PUBLIC_WEB_URL": "https://thewileyfox.com"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "channel": "production",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.thewileyfox.com/api/v1",
        "EXPO_PUBLIC_WEB_URL": "https://thewileyfox.com",
        "EXPO_PUBLIC_SENTRY_DSN": "https://0f0aaf2c7c07f43d3195d07a81626d0d@o4511754670964736.ingest.de.sentry.io/4511754832379984",
        "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN": "<get from Mapbox dashboard or another teammate — same pk.* token used in apps/mobile/.env>"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

Note the `preview` profile still lacks `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` — add it there too if internal testers need working maps on preview builds (not yet done as of this writing).

**Also recreate `apps/mobile/.easignore`** (also gitignored, copy of the repo's `.gitignore` rules minus the `apps/mobile/eas.json` line) **at the git repo root** (`safetag/.easignore`), not inside `apps/mobile/` — see issue #5 above for why the location matters for local builds.
