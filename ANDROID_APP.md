# Standalone Android App Packaging Plan (Capacitor Layout)

This document preserves the setup and architecture plan to compile the Kido React web client as a native, self-contained Android application using **Capacitor** for future development.

The Android app will run serverless, loading all HTML/JS/CSS assets locally from the device's storage, and connecting directly to the official KGS API servlet without relying on a backend website proxy.

---

## Technical Approach

### 1. Standalone Native Assets
Capacitor integrates directly into the existing repository, generating a native Android Studio project folder (`/android`):
* `capacitor.config.json`: Core configuration file in the project root specifying the app ID (`com.kido.kgs`), name (`Kido`), build directory (`build`), and local server hostname.
* `/android/`: The full Gradle-based Android project. This folder is committed to the repository so developers can open it in Android Studio, configure permissions, add launcher icons, and compile the final `.apk` / `.aab`.

### 2. CORS & Origin Verification Bypass
By default, the Android WebView blocks requests due to CORS, and KGS servlet requires origin headers from `https://www.gokgs.com`. We can solve this natively inside the WebView using Capacitor's local server configuration:
```json
"server": {
  "androidScheme": "https",
  "hostname": "www.gokgs.com"
}
```
This forces the Android WebView to host the local React assets under the origin `https://www.gokgs.com` on the device. Any network requests to `https://www.gokgs.com/json/access` will be treated as same-origin requests by the webview, ensuring that:
1. CORS preflight blocks are bypassed.
2. The `Origin` and `Referer` headers are automatically set by the WebView to the correct values required by the KGS servlet.

### 3. Build & Sync Pipeline
Dedicated scripts will be added to `package.json` to compile the app and push assets into the Android native folder:
* `npm run build:android`: Compiles the production build and runs `npx cap sync android` to copy assets.
* `npm run build:all`: Compiles webapp, extension, and Android packages simultaneously.

---

## Proposed Code Changes

### 1. Configuration Changes

#### `package.json`
Add new build and sync scripts to the existing script block:
```json
"scripts": {
  "build:android": "npm run build && npx cap sync android",
  "build:all": "npm run build && npm run build:extension && npm run build:android"
}
```

#### `capacitor.config.json`
Create the Capacitor config file in the repository root:
```json
{
  "appId": "com.kido.kgs",
  "appName": "Kido",
  "webDir": "build",
  "bundledWebRuntime": false,
  "server": {
    "androidScheme": "https",
    "hostname": "www.gokgs.com"
  }
}
```

### 2. Environment Adaptation

#### `src/model/KgsClient.js`
Extend the direct API check to detect Capacitor native execution mode:
```javascript
const isExtension = !!(
  window.chrome &&
  window.chrome.runtime &&
  window.chrome.runtime.id
);
const isNative = typeof window !== "undefined" && !!window.Capacitor;
const isDirectApi = isExtension || isNative;

if (isDirectApi) {
  this._apiUrl = "https://www.gokgs.com/json/access";
}
```

#### `src/ui/LoginScreen.js`
Update Turnstile CAPTCHA checks to evaluate `isDirectApi` (bypassing Turnstile loading and validation since the native application runs serverless and communicates directly with KGS):
```javascript
const isNative = typeof window !== "undefined" && !!window.Capacitor;
const isDirectApi = isExtension || isNative;
```
Replace checks for `isExtension` with `isDirectApi` throughout the component's render and login validation handlers.

---

## Verification Plan

### Automated Checks
* Run Flow typecheck: `npm run flow`.
* Run ESLint/Prettier code style check: `npm run lint`.
* Compile webapp: `npm run build`.
* Compile and sync Android assets: `npm run build:android`.

### Manual Native Verification
1. Run `npm run build:android`.
2. Open the `/android` folder in **Android Studio**.
3. Select an emulator or connect a physical Android device.
4. Run the app directly from Android Studio.
5. Verify you can log in, view rooms, and spectate/play matches directly on KGS.
