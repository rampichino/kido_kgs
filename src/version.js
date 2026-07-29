// @flow
// The version shown in the More menu footer. Only the Chrome extension and the
// Android app are delivered artifacts, and each ships under its own version
// number (the Chrome Web Store and Play Store each require their own monotonic
// sequence), so the footer reports whichever one is actually running:
//
//   extension → chrome.runtime.getManifest().version  (manifest.json)
//   native    → App.getInfo().version                 (build.gradle versionName)
//   web       → none — the web build isn't released, so it has no version and
//               the footer omits the line entirely.

function getExtensionVersion(): ?string {
  try {
    const chrome = (window: any).chrome;
    if (
      chrome &&
      chrome.runtime &&
      chrome.runtime.id &&
      chrome.runtime.getManifest
    ) {
      const manifest = chrome.runtime.getManifest();
      return manifest && manifest.version ? manifest.version : null;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function isNativeApp(): boolean {
  const cap = typeof window !== "undefined" ? (window: any).Capacitor : null;
  return (
    !!cap &&
    typeof cap.isNativePlatform === "function" &&
    cap.isNativePlatform()
  );
}

// Synchronous value: the extension's version, or null on web and (until
// resolveNativeVersion settles) on native.
export const KIDO_VERSION: ?string = getExtensionVersion();

// Resolve the native app's versionName (from build.gradle). Returns null on
// non-native platforms or if the plugin call fails, so callers keep the
// synchronous KIDO_VERSION in that case.
export async function resolveNativeVersion(): Promise<?string> {
  if (!isNativeApp()) {
    return null;
  }
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return info && info.version ? info.version : null;
  } catch (e) {
    return null;
  }
}
