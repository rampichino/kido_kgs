// @flow
// External game-review integrations (AI Sensei, Kifubara).
//
// Both services need the raw SGF *content*, but the app only knows the KGS
// download URL (https://files.gokgs.com/.../game.sgf). We fetch the SGF and
// hand it to each service:
//   - web app: fetch through our own server proxy (avoids the CORS block on
//     files.gokgs.com / kifubara.app).
//   - Chrome extension (MV3): fetch directly — the extension's host_permissions
//     grant cross-origin access, so no proxy exists or is needed.
//   - Capacitor native (Android/iOS): fetch directly too — the app is
//     serverless (a relative /api/... URL would resolve against the
//     www.gokgs.com WebView origin and 404), and CapacitorHttp executes
//     fetches natively so CORS doesn't apply.

const isExtension = !!(
  window.chrome &&
  window.chrome.runtime &&
  window.chrome.runtime.id
);

// Same native gate as KgsClient.js: window.Capacitor exists on the web build
// too, so presence alone must not count — only isNativePlatform().
const cap = typeof window !== "undefined" ? (window: any).Capacitor : null;
const isNative =
  !!cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform();

const isDirectFetch = isExtension || isNative;

// The CapacitorHttp fetch patch hands the body back base64-encoded when it
// doesn't recognize the content-type as text — and KGS serves SGFs as
// application/x-go-sgf. Normalize: accept plain SGF, otherwise try decoding
// base64 (as UTF-8, so non-ASCII chat comments survive). Anything else —
// including a proxy error body that arrived with HTTP 200 — is rejected here,
// so both services get the same guard.
function normalizeSgf(raw: string): string {
  let text = (raw || "").trim();
  if (text[0] === "(") {
    return text;
  }
  try {
    let binary = atob(text);
    let bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    let decoded = new TextDecoder("utf-8").decode(bytes).trim();
    if (decoded[0] === "(") {
      return decoded;
    }
  } catch (e) {
    // fall through
  }
  throw new Error("Could not retrieve SGF data from source.");
}

// Fetch the raw SGF text for a KGS SGF URL. Extension/native hit the URL
// directly; the web app routes through /api/sgf so the server fetches it.
export async function fetchSgf(sgfUrl: string): Promise<string> {
  let target = isDirectFetch
    ? sgfUrl
    : "/api/sgf?url=" + encodeURIComponent(sgfUrl);
  let res = await fetch(target);
  if (!res.ok) {
    throw new Error("Failed to fetch SGF (" + res.status + ")");
  }
  return normalizeSgf(await res.text());
}

// AI Sensei: upload page takes the SGF URL-encoded in the query string.
export async function openAiSensei(sgfUrl: string): Promise<void> {
  let sgf = await fetchSgf(sgfUrl);
  let url = "https://ai-sensei.com/upload?sgf=" + encodeURIComponent(sgf);
  window.open(url, "_blank", "noopener,noreferrer");
}

// Kifubara: POST the SGF to its import API, then open the imported review. The
// POST is proxied on web (CORS) and sent directly in the extension. The import
// responds with { review_url, review_path, game_id }; we open review_url (or
// build one from review_path / game_id).
export async function openKifubara(sgfUrl: string): Promise<void> {
  let sgf = await fetchSgf(sgfUrl);
  let endpoint = isDirectFetch
    ? "https://kifubara.app/api/import"
    : "/api/kifubara/import";
  let res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sgf, source: "kido", platform: "kgs" }),
  });
  if (!res.ok) {
    // Surface Kifubara's error detail to aid debugging. A hard server crash can
    // return HTML/text rather than JSON, so branch on the content type before
    // parsing (the JSON error field name varies).
    let detail = "Unknown error";
    let contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      let errData = await res.json().catch(() => ({}));
      detail =
        errData.message ||
        errData.error ||
        errData.detail ||
        JSON.stringify(errData);
    } else {
      detail = await res.text().catch(() => "No response body");
    }
    throw new Error(
      "Kifubara import failed (" + res.status + "): " + detail.slice(0, 100)
    );
  }
  let data = await res.json().catch(() => null);
  let openUrl = "https://kifubara.app";
  if (data && typeof data.review_url === "string") {
    openUrl = data.review_url;
  } else if (data && typeof data.review_path === "string") {
    openUrl = "https://kifubara.app" + data.review_path;
  } else if (data && data.game_id) {
    openUrl = "https://kifubara.app/review/" + data.game_id;
  }
  window.open(openUrl, "_blank", "noopener,noreferrer");
}
