// @flow
// Platform detection shared by the transport, the login screen and the
// auto-reconnect logic. Kept in one place because the three copies that
// existed before had drifted (one treated the web build as native, because
// @capacitor/core defines window.Capacitor there too).

export const isExtension =
  typeof window !== "undefined" &&
  !!(window.chrome && window.chrome.runtime && window.chrome.runtime.id);

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const cap = (window: any).Capacitor;
  return (
    !!cap &&
    typeof cap.isNativePlatform === "function" &&
    cap.isNativePlatform()
  );
}

// Builds that talk to the KGS servlet directly (no CORS proxy, and no
// Turnstile CAPTCHA on login — which is what makes a silent re-login possible).
export function isDirectApi(): boolean {
  return isExtension || isNativePlatform();
}
