# <img src="./design/logo.svg" width="32" valign="middle"> Kido

[![Build Status](https://github.com/rampichino/Kido/actions/workflows/ci.yml/badge.svg)](https://github.com/rampichino/Kido/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, fast, and feature-rich JavaScript web client for the **KGS Go Server** (Kiseido Go Server). Designed with rich aesthetics, responsiveness, and a first-class mobile and desktop gaming experience in mind.

---

## 🚀 Key Features

* **Modern React & UI Layout**: A streamlined visual layout designed to maximize the visible board space and provide seamless navigation on both web and mobile viewports.
* **Classic & Custom Aesthetics**:
  * **Themes**: Supports standard, Tenuki (light & dark mode), and classic CGoban themes.
  * **Interactive Custom Board Styles**: Toggle between flat and 3D glossy Go stones with curved shell-grain lines.
  * **Dynamic Avatars**: Client-side Jdenticon avatar fallbacks when custom player profile photos are unavailable.
* **Go Room & Game Interactions**:
  * Active games watch lists and lobbies.
  * Real-time game spectating, direct user messaging, and room chats.
  * In-game analysis tools with move navigation sliders, Go-to-Start/End options, and auto-play toggles.
  * Interactive Go Rank graphs built on modern SVG charts using **Recharts**.
* **Modern Tech Stack**:
  * Hybrid **React 18** frontend with **TypeScript** type checking.
  * Clean styling using vanilla CSS/SCSS modules.
  * Ships as a Chrome extension (MV3) and an Android app (Capacitor), both talking directly to the KGS JSON API.

---

## 📋 Features Not Yet Implemented (Candidates for Development)

These are features supported by the KGS server protocol or planned for the UI but not yet implemented:

### High Priority (ordered)
- ⬜ **Add preselected settings for create challenges that can be stored in cache**.
- ⬜ **For the live game and challenges list add a table list version**.
- ⬜ **Add the FUN game list or make first on the list or something else to highlight them**.
- ⬜ **Allow guest login**.
- ⬜ **Game Ended**: Audio feedback and graphical icons should be implemented when the game concludes..
- ⬜ **Game time expiry - visually or countdown**: Handle clock running out.
- ⬜ **Chat history**: Implement a cached chat history (maybe 1 month timestamp deletion??).

### Medium Priority (ordered)
- ⬜ **Advanced review tools**: Move tree, annotations, SGF editing in game review.
- ⬜ **Audio Streaming & Commentary** [from CGoban]: Listen/stream live game commentary audio during watched matches or lessons.

### Low Priority (ordered)
- ⬜ **Tournament notifications**: Alert when tournament game is ready.
- ⬜ **Negative margins**: Check negative margins.
- ⬜ **Tournament UI**: View and join tournaments.
- ⬜ **Server announcements**: Broadcast message to all channels.
- ⬜ **User avatar upload**: Allow users to upload their own avatar.
- ⬜ **Account registration**: Create new KGS account from within the app.
- ⬜ **Server stats display**: Show live server statistics.
- ⬜ **Game board preview** thumbnails in the game list.
- ⬜ **Keyboard shortcuts** for common actions.
- ⬜ **Full `@mention`** support in game chat (currently room chat only).

### Admins tools (ordered)
- ⬜ **Chat moderation**: Teacher/moderator chat controls.
- ⬜ **Room management**: Create/edit rooms, manage owners and access lists.
- ⬜ **Account Deletion** [from CGoban]: Trigger account deletion via the `DELETE_ACCOUNT` command.

---

## 📋 Features Candidate for Reviewing

These are existing features in Kido that show logic or mathematical discrepancies when compared to the official CGoban reference client implementation and should be reviewed:

### High Priority
- 🔍 **Handicap & Komi Scaling by Board Size**:
  - *Description*: Handicap and Komi calculation inside [challenge.js](src/model/game/challenge.js) (`getMatchupInfo`) does not consider board size (assuming standard 19x19 rules).
  - *Official client behavior*: handicap values are scaled down for smaller boards (9x9 and 13x13) proportionally to the point count, and default Komi is adjusted accordingly.
- 🔍 **Pro Ranks and Special Matchups Capping**:
  - *Description*: Rank differences are calculated simply using a linear subtraction.
  - *Official client behavior*: pro-level ranks cap rank-difference calculations differently, and reverse-handicap matches apply a scaled negative Komi.

### Medium Priority
- 🔍 **Game Time Speed Classification**:
  - *Description*: Categorizes game speed purely using main time boundaries.
  - *Official client behavior*: uses an expected-time estimator accounting for board size, Canadian stones, and Byo-yomi periods, with explicit Blitz / Ultra Blitz tiers.
- 🔍 **Validation Limits for User Submissions**:
  - *Description*: Input fields allow arbitrary lengths.
  - *Official limits (per the KGS JSON API docs)*: challenge names 80 chars, profile biography 1500, friend notes 50, chat text 1000.

### Low Priority
- 🔍 **User Search Casing**:
  - *Description*: Sidebar user searches are case-insensitive.
  - *Official client behavior*: KGS login usernames and direct challenge note matching are strictly case-sensitive.

---

## 🛠️ Tech Stack & Architecture

* **Frontend**: React 18 (using the updated `createRoot` API), TypeScript, and JavaScript (Flow typing).
* **Styles**: Vanilla SCSS / SASS modules.
* **Charts & Visuals**: Recharts (interactive SVG graphs) and Jdenticon.
* **State Management**: Redux-like unidirectional state flow. Actions are dispatched cleanly through central stores without implicit context.

---

## 📦 Local Development Setup

### Prerequisites
* [Node.js](https://nodejs.org/) (v16+ recommended)
* [NPM](https://www.npmjs.com/)

### 1. Installation
Clone the repository and install all local dependencies:
```bash
npm install
```

### 2. Run local Development Server
Start the Webpack development server at `http://localhost:3000`:
```bash
npm start
```
*Note: Requests are automatically proxied to the official KGS API through the local server configuration.*

### 3. Verification Scripts
Verify code quality, typings, and builds using these local utility scripts:
* **Linting**: Run ESLint and Prettier checks:
  ```bash
  npm run lint
  ```
  *(To auto-fix style issues, run `npm run lint -- --fix`)*
* **Flow Checks**: Run the Flow type checker:
  ```bash
  npm run flow
  ```
* **TypeScript Checks**: Run TypeScript type checking on `.ts`/`.tsx` files:
  ```bash
  npm run typecheck
  ```
* **Production Build**: Compile and minify the assets:
  ```bash
  npm run build
  ```
* **Chrome Extension Build**: Compile and package the Chrome Extension into the `/chrome-extension` directory:
  ```bash
  npm run build:extension
  ```
  *To load the extension locally in Google Chrome, navigate to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the `/chrome-extension` output folder.*
  *(Note for AI models: Do NOT compile or build the Chrome Extension on every change. The user will run the build manually.)*

### 4. Android Build
Sync the production build into the Capacitor Android project (then build/sign from Android Studio):
```bash
npm run build:android
```

---

## 🤝 Contributing

Contributions are very welcome! Please coordinate your work through our issues list:
* Review outstanding tasks on the [Milestones Page](https://github.com/rampichino/Kido/milestones).
* Browse coordinate efforts on the [Issues Tracker](https://github.com/rampichino/Kido/issues).

### Code Style Guidelines
* All file modifications must conform to Prettier and ESLint rules. 
* Keep Flow and TypeScript type annotations clean and comprehensive.

---

## 📚 References & Resources

* [Walkthrough](walkthrough.md)
* [Design Rules](DESIGN_RULES.md)
* [Development Rules](DEVELOPMENT_RULES.md)
* [KGS Protocol Reference](KGS_Protocol_Reference.md)
* [Changelog](CHANGELOG.md)
* [Android App Plan (Postponed)](ANDROID_APP.md)

---

## ⚖️ Credits & License

* Navigation icons by [Lucide](https://lucide.dev/) — ISC License.
* Code released under the **MIT License**.
