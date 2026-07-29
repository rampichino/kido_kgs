# Development Rules

These rules apply to all AI models and developers working on this project.

---

## Stack

- **React 16.5** — class components with Flow types. No hooks (hooks require 16.8+). Do not upgrade React without a full migration plan.
- **react-scripts 5.0.1** — upgraded CRA version. Webpack 5. `NODE_OPTIONS=--openssl-legacy-provider` is required to build.
- **Flow 0.129** — static type checker. Run with `npm run flow`.
- **Sass 1.77.8** — modern Dart Sass. Avoid deprecated `/` division syntax and mixed-decls ordering (CI treats warnings as errors).
- **lucide-react 1.17.0** — icon library. All icons use `<Icon name="..." />` from `src/ui/common/Icon.js`. No Font Awesome.
- **KGS JSON API** (`/json-cors/access`) — see `KGS_Protocol_Reference.md`
- **jdenticon 3.3** — user avatars
- **recharts 2.12.7** — user rank graphs

---

## Code Style

- Use **Flow types** on all components and functions
- Use **class components** (`PureComponent`) — do not introduce hooks or functional components (React 16.5 predates hooks)
- Keep imports at the top of the file — never after code
- No unused imports or variables — CI treats warnings as errors
- No comments unless the WHY is non-obvious
- No backwards-compatibility shims or dead code

---

## CSS / SCSS Rules

- All styles go in `src/css/` — never inline styles except for dynamic values (e.g. pixel positions from JS)
- Follow existing BEM-like naming: `ComponentName-element-modifier`
- Declarations must come **before** nested rules inside a block (Sass mixed-decls rule)
- Dark mode styles go inside `body.dark-mode { }` blocks in the relevant SCSS file
- Do not use `!important` unless overriding third-party or deeply nested styles
- Use existing SCSS variables (`$accent`, `$muted`, `$content-fg`, etc.) from `_common.scss`
- For the accent/UI color, always use `var(--ui-color)` and `rgba(var(--ui-color-rgb), X)` — never hardcode the accent hex directly
- For all design decisions (colors, zones, component styles) see **`DESIGN_RULES.md`**

---

## UI Conventions

- **Rank chips** use tiers: `pro` (1p–9p, red), `dan` (1d–9d, amber), `sdk` (1k–9k, emerald), `ddk` (10k+, indigo). Unknown/`?`/unranked ranks also map to `ddk` (indigo). Tier logic is in `getRankTier()` in `src/ui/user/UserName.js`.
- **Bot detection**: check `flags.robot`, then `/bot/i` name pattern, then `KNOWN_BOTS` list. All bot names must query the centralized utility module `src/util/bot.js` via the `KNOWN_BOTS` export.
- **Game type badges**: "Rated" (was "Ranked"), "Free", "Rev", "Demo", "Teach" etc.
- **Icons**: use `<Icon name="..." />` from `src/ui/common/Icon.js`. Icons are rendered via the `lucide-react` package (https://lucide.dev/). To add a new icon: import the Lucide component at the top of `Icon.js` and add an entry to `ICON_MAP`. Import directly from `lucide-react`. Default icon size is `13`. Player profile modal icons use `17` via the `extraIconsSize` prop on `UserName`.
- **Close/dismiss icons**: always use `<Icon name="circle-x" />`. See `DESIGN_RULES.md` for hover colors.
- **Status dots**: use a small circle (`8–11px`). Always add a `title` attribute. Avatar-overlaid dots use `position: absolute; bottom: 0; right: 0`. For colors see `DESIGN_RULES.md`.
- **Notification badges**: All unread chat messages and header mail indicators must use `minorCount` in `<UnseenBadge>`. Do not use `majorCount` for incoming messages.
- **Tooltips**: use `position: fixed` + JS `getBoundingClientRect()` for tooltips inside `overflow: hidden` containers.
- **Modals**: use `ScreenModal` or `Modal` from `src/ui/common/`. Do not add Cancel buttons — use the close icon instead.

---

## Bot List

All KGS bot names must query the centralized utility module `src/util/bot.js` via the `KNOWN_BOTS` export. Do not hardcode lists in UI files.
The current known bots list includes:
- `"idiotbot"`, `"beginnerbot"`, `"weakbot50k"`, `"libertybot"`, `"gnugo2"`, `"basicsbot"`, `"weakbot9x9"`, `"swisspachi"`, `"handydandy"`, `"betaone"`, `"ondine"`, `"pachipachi"`.

---

## KGS Protocol

> 📄 Full protocol reference: **`KGS_Protocol_Reference.md`** — lists all server→client messages, client→server commands, implemented features, and unimplemented candidates.

- Do not invent server commands — only use documented ones in `KGS_Protocol_Reference.md`
- New filter fields on `GameFilter` type must be added to `src/model/types.js`
- Client→server commands are in `src/model/AppActions.js`
- Message handlers are in `src/model/session.js`, `src/model/game/message.js`, etc.
- Buddy, Fan, and Censored list operations must set `callbackKey` to `1` in the outgoing server payload (setting it to `0` or omitting it causes server/connection crashes).
- Guest accounts (`currentUser.flags.guest`) cannot modify buddy or social lists. Disable these actions in the UI.

---

## Network & Transport

- The app communicates with the server through an isolated transport module (`src/model/KgsClient.js`).
  All send/receive logic is encapsulated there — UI and game logic never call the network directly.
- For poll requests (GET messages), only HTTP `400` (Bad Request) and `404` (Not Found) responses should result in a session logout (mapped to `"noClient"`).
- For sending messages (POST commands), HTTP `400` represents a validation or bad request error (mapped to `"badRequest"`), which must NOT result in a session logout or display the network-offline alert.
- Other HTTP status codes (such as HTTP `500` server errors) must map to `"serverError"`, keeping the active session and polling flow alive.

---

## Turnstile CAPTCHA (web deployment only)

The extension and the Android app talk directly to KGS and skip Turnstile
entirely. If a web deployment is ever revived, the widget sitekey lives in
`src/ui/LoginScreen.js` (public by design) and the secret key must come from
the `TURNSTILE_SECRET_KEY` environment variable — never commit secret keys.

---

## Local Storage Keys

| Key | Purpose |
|---|---|
| `kido_dark_mode` | `"1"` = dark mode enabled |

---

## Build & Verification

- `npm start` — dev server at http://localhost:3000 (standard KGS)
- `npm run lint` — run ESLint and Prettier checks
- `npm run flow` — run the Flow compiler type-checks
- `npm run typecheck` — run TypeScript type checks locally
- `npm run build` — production build of the webapp (compiled in `/build`)
- `npm run build:web` — compiles standard webapp (compiled in `/build`)
- `npm run build:extension` — compiles Chrome Extension (compiled in `/chrome-extension`)
- `npm run build:all` — compiles both webapp and extension
- CI runs `npm run build` with `CI=true` — all ESLint warnings are treated as **errors**

---

## Documentation & Walkthrough

- A walkthrough of completed changes (`walkthrough.md`) must be updated in the repository root.
- The `walkthrough.md` file must be linked inside the `README.md` under the References section.
- All completed features from the "Features Not Yet Implemented" candidates list in `README.md` must be removed from `README.md` and moved to `CHANGELOG.md` under the appropriate release version (such as `0.1.0` for current tasks).

---

## Suggested Improvements

These are known technical debt items worth addressing in future work, ordered by priority.

### High Priority

| Item | Current | Target | Benefit |
|---|---|---|---|
| `react-scripts` | 5.0.1 (Done) | — | Upgraded to 5.0.1. Removes the CJS path workaround for `lucide-react`. |
| `react` + `react-dom` | 18.3.1 (Done) | — | Upgraded to 18.3.1. Adds concurrent rendering, hooks support, and uses createRoot. |
| `babel-eslint` | `@babel/eslint-parser` (Done) | — | Upgraded to `@babel/eslint-parser` for ESLint 8 / react-scripts v5 compatibility. |

### Medium Priority

| Item | Current | Target | Benefit |
|---|---|---|---|
| `flow-bin` | 0.129 (Retained) | 0.247 | Upgrade postponed. Modern Flow compiler versions throw 690+ type annotations warnings across the legacy codebase. |
| `date-fns` | 3.6.0 (Done) | — | Upgraded to 3.6.0. Migrated date-fns imports from 'date-fns/format' to named imports. |
| `prettier` | 3.5.0 (Done) | — | Upgraded to 3.5.0. Modern formatting defaults. |
| `rc-slider` | 10.6.2 (Done) | — | Upgraded to 10.6.2. Native React 18 support and layout fixes. |

### Low Priority

| Item | Note |
|---|---|
| `axios 0.19` | Appears unused in UI code — consider removing entirely |
| chartist 0.11 (Done) | Replaced with recharts for the user rank graph |
| fastclick (Done) | Deprecated — modern browsers handle touch delays natively, removed from dependencies |
| `jdenticon` | Minor update to 3.4 available |

### Architecture

- **Migrate from class components to functional + hooks** — only viable after React upgrade to 16.8+
- **Replace Flow with TypeScript** — better tooling, IDE support, larger community.
  * **Gradual Migration Strategy**: Run TypeScript and JavaScript/Flow side-by-side using a hybrid config (set `allowJs: true` and `checkJs: false` in `tsconfig.json`). Rename files to `.ts` / `.tsx` and convert them file-by-file.
  * **Automated Tooling**: Use `@khanacademy/flow-to-ts` to automatically convert ~90% of the Flow type syntax to TypeScript.
  * **Migration Steps**:
    1. Install `typescript`, `@types/react`, and `@types/react-dom` as devDependencies.
    2. Initialize `tsconfig.json` with `allowJs: true` to support legacy JS/Flow.
    3. Migrate core utilities and models first (proof of concept), then convert UI components file-by-file.


> ⚠️ Do not attempt dependency upgrades on the main branch. Always use a separate branch and test thoroughly — the old CRA version has quirks that may break with newer dependencies.

---

## Features Not Yet Implemented (Candidates for Development)

Features supported by the KGS server protocol but not yet built in the UI. For the full list of unimplemented messages see **`KGS_Protocol_Reference.md`** (❌ entries).

### High Priority

| Feature | Description | Messages / Commands | Access |
|---|---|---|---|
| **Beta-testing** | Find beta-tester to play casual games | — | All users |
| **Site styling** | Define the basic initial site restyling and color scheme | — | All users |
| **Direct messaging** | Message user separate from rooms | `CONVERSATION_CREATE`, `CONVERSATION_ADD`, `CHAT_SEND` (tx) · `CONVERSATION_LIST`, `CHAT_MSG` (rx) | All users |
| **Automatch** | Auto-find opponents by rank/time preference | `AUTOMATCH_PREFS`, `AUTOMATCH_STATUS` (rx) · `AUTOMATCH_CREATE`, `AUTOMATCH_SET_PREFS`, `AUTOMATCH_CANCEL` (tx) | All users |
| **Game time expiry** | Handle clock running out — currently ignored | `GAME_TIME_EXPIRED` (rx+tx) | All users |
| **Game Over handling** | Close game channels and update lists on game end | `GAME_OVER`, `GAME_CONTAINER_REMOVE_GAME` (rx) | All users |
| **In-app mailbox** | Leave/receive messages when user is offline | `MESSAGES`, `MESSAGE_CREATE_SUCCESS` (rx) · `MESSAGE_CREATE`, `MESSAGE_DELETE` (tx) | All users |
| **Game loading page** | Waiting page for game loading (optional) | — | All users |

### Medium Priority

| Feature | Description | Messages / Commands | Access |
|---|---|---|---|
| **Playback system** | Live game streaming/playback — all stubs | `PLAYBACK_ADD/DATA/SETUP/JOIN/SEEK_START/SEEK_COMPLETE/DELETE/ERROR` (rx) · `START_PLAYBACK`, `REQUEST_PLAYBACK_LIST`, `PLAYBACK_SET` (tx) | All users |
| **Advanced review tools** | Move tree, annotations, SGF editing in game review | `GAME_REVIEW` (rx) · `GAME_START_REVIEW`, `GAME_SET_ROLES`, `KGS_SGF_CHANGE` (tx) | All users |
| **Server-side friends** | KGS native friend/fan/censor lists | `FRIEND_ADD_SUCCESS`, `FRIEND_REMOVE_SUCCESS` (rx) · `FRIEND_ADD`, `FRIEND_REMOVE` (tx) | All users |
| **Friends list method** | Evaluation of a different method for friends list (currently cached on browser) | — | All users |
| **Rengo (team games)** | Two vs two go games | `GAME_JOIN` with rengo type | All users |
| **Simul exhibitions** | One player vs many simultaneously | `GAME_JOIN` with simul type | All users |
| **Chat moderation** | Teacher/moderator chat controls | `CHANNEL_NO_TALKING`, `CHANNEL_CHAT_ALLOWED` (rx) · `SET_CHAT_MODE`, `MODERATED_COMMENT` (tx) | 🔒 Teacher / Room owner |
| **Tournament notifications** | Alert when tournament game is ready | `TOURN_NOTIFY` (rx) | All users |
| **Challenge created event** | `CHALLENGE_CREATED` is currently ignored | `CHALLENGE_CREATED`, `CHALLENGE_NOT_CREATED` (rx) | All users |
| **Ko/loop warning** | Notify players of repeated position | `GAME_LOOP_WARNING` (rx) | All users |
| **Game tagging** | Tag games for personal archive organisation | `FETCH_TAGS_RESULT` (rx) · `TAG_GAME`, `FETCH_TAGS` (tx) | All users |

### Low Priority

| Feature | Description | Messages / Commands | Access |
|---|---|---|---|
| **User blocking** | Block/unblock users from contacting you | `KEEP_OUT_SUCCESS`, `KEEP_OUT_LOGIN_NOT_FOUND` (rx) · `KEEP_OUT_REQUEST`, `CLEAR_KEEP_OUT` (tx) | 🔒 Admin |
| **Server announcements** | Broadcast message to all channels | `ANNOUNCEMENT` (tx) | 🔒 Admin |
| **Tournament UI** | View and join tournaments | — | All users |
| **User avatar upload** | Allow users to upload their own avatar | `AVATAR` (rx) · `UPLOAD_AVATAR` (tx) | All users |
| **Account registration** | Create new KGS account from within the app | `REGISTER_SUCCESS`, `REGISTER_BAD_EMAIL` (rx) · `REGISTER` (tx) | All users |
| **Server stats display** | Show live server statistics | `SERVER_STATS` (rx) · `REQUEST_SERVER_STATS` (tx) | 🔒 Admin |
| **Room management** | Create/edit rooms, manage owners and access lists | `ROOM_CREATED` (rx) · `CREATE_ROOM_REQUEST`, `ROOM_EDIT`, `ROOM_ADD_OWNER` (tx) | 🔒 Admin / Room owner |
| **Channel deletion** | Delete a channel | `CHANNEL_DELETE` (tx) | 🔒 Admin |
| **Mobile native** | Electron/React Native wrapper | — | — |

### UI Improvements Backlog

- Message search within a conversation
- Compact vs comfortable message density toggle
- Game board preview thumbnails in the game list
- Notification sounds for new messages / game invites
- Keyboard shortcuts for common actions
- Full `@mention` support in game chat (currently room chat only)

---

## What NOT to do

- Do not compile or build the Chrome extension (`npm run build:extension`) on every change. The user will compile it themselves.
- Do not use `position: absolute` for tooltips inside `overflow: hidden` containers — use portals or `position: fixed`
- Do not add features, refactors, or abstractions beyond what is requested
- Do not create new files unless necessary — prefer editing existing ones
- Do not break dark mode when adding new UI — always add corresponding `body.dark-mode` styles
- Do not use `grid` or `flexbox` on elements that need to support the existing absolute-positioned chat layout
- Import `lucide-react` directly.
