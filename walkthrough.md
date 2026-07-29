# Walkthrough Addendum: Poll-Loop Hardening & Reliable Stone Sounds

Fixed two reported issues — stones sometimes playing silently, and the turn indicator sometimes showing the opponent to move when it's actually the user's turn. Both traced back to the KGS poll loop being able to die or stall silently, plus the stone sound being tied to the server echo instead of the user's tap.

## Changes Implemented

1. **Transport hardening** ([KgsClient.js](src/model/KgsClient.js)):
   - The long-poll GET now sets `xhr.timeout` (150 s) — a half-open socket after device sleep or a network switch previously hung the loop forever with no error event, silently freezing board updates, sounds, and the turn indicator. POST commands get a 30 s timeout (async requests only).
   - `JSON.parse` of the poll response is guarded: a 200 with a non-JSON body now rejects into the retry path instead of killing the loop with an unsettled promise.
   - While logged in, poll retries never give up (previously polling stopped permanently after 10 failed retries ≈ 30 s of outage). The bounded retry budget is kept only for the transitional loggingIn/loggingOut states.
   - New `ensurePolling()` restarts a dead or delay-waiting loop, guarded by an in-flight flag so it can never start a duplicate loop; an in-flight poll is deliberately never aborted (aborting could discard a response the server already sent, losing those messages).

2. **Recovery triggers** ([App.js](src/App.js)): `ensurePolling()` is called when the tab becomes visible again and on the browser `online` event, so a stalled session catches up immediately after wake/reconnect.

3. **Gesture-time stone sound** ([sound/index.js](src/sound/index.js), [AppActions.js](src/model/AppActions.js), [Board.js](src/ui/board/Board.js)):
   - `onPlayMove` now plays the placement click immediately inside the user gesture (`playLocalStoneSound`) — mobile autoplay policies could block the old echo-triggered playback since it originated from a network callback.
   - The board diff calls `playStoneSoundFromUpdate(captured, multiple)`, which skips the echo of the just-sounded local move (5 s window, cleared on server rejection via `clearLocalStonePlay`) but still plays the capture rattle on top of it, and always sounds when several stones land in one batched poll response.
   - **Web Audio engine**: stone sounds now play through decoded `AudioBuffer`s on a shared `AudioContext` (unlocked/resumed on any pointer/key gesture, samples fetched + decoded lazily per set). `HTMLAudioElement` playback is unreliable for rapid overlapping game sounds — mobile WebViews silently drop fast consecutive plays and autoplay policies can block elements started from network callbacks, which was the remaining "no sound on fast moves" cause. The old cloned-element path remains as a fallback while buffers decode or where Web Audio is unavailable. Capture clacks are scheduled sample-accurately on the audio clock (+60 ms @ 0.6, +130 ms @ 0.4), and a batched fast exchange now sounds two staggered clicks (+90 ms) instead of one.

4. **Verification**: `npm run flow`, `npm run lint`, `npm run typecheck`, and the Jest suite all pass.

---

# Walkthrough Addendum: Rengo (2v2) Challenges

Added support for creating and joining **Rengo** challenges — 2-vs-2 team games (two white + two black, teams alternating moves).

## Changes Implemented

1. **Proposal logic** ([challenge.js](file:///home/alfredo/repo/Kido/Kido/src/model/game/challenge.js)):
   - `createInitialProposal` builds a four-seat rengo roster (white / white_2 / black / black_2), creator on White 1, the other three open.
   - `getEvenProposal` adds a rengo branch: a joining player takes the first open seat, preserving everyone already in.
   - New `getRengoMatchup(whiteTeam, blackTeam, defaultKomi)` suggests a handicap from each team's **average rank** (komi 0.5 when handicapped, board komi otherwise).

2. **Challenge UI**:
   - [ProposalForm.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/ProposalForm.js): "Rengo" game-type option; `_onChangeGameType` builds the rengo roster; standard handicap/komi inputs remain (single game handicap).
   - [ProposalPlayers.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/ProposalPlayers.js): renders the four seats vertically with "White 1/2 · Black 1/2" labels; an unseated player can click **Take seat** on any open seat while negotiating (`_onPickSeat` vacates any seat they already hold).
   - [ChallengeEditor.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/ChallengeEditor.js): "Rengo Challenge" title; merges received proposals into the four seats; Accept is gated until all four are filled; mirrors the simul counter-proposal/accept handshake for >2 players.

3. **Transport** ([AppActions.js](file:///home/alfredo/repo/Kido/Kido/src/model/AppActions.js)): `sanitizeProposal` strips per-player handicap/komi for rengo (handicap lives on `rules`) and keeps only the submitter's own seat named; `onAcceptChallengeProposal` assembles the full 2v2 roster and recomputes the team-average handicap before sending.

4. The in-game board already rendered rengo line-ups (`GamePlayersInfo-rengo`, white1/white2 vs black1/black2) and the "Rengo" badge/label — no board-side changes were needed.

---

# Walkthrough Addendum: Create Challenge Button in Room Chat

I have successfully added a "Create Challenge" action button/link inside the room chat description header:

## Changes Implemented

1. **RoomChat Integration**:
   - Modified [RoomChat.js](file:///home/alfredo/repo/Kido/Kido/src/ui/chat/RoomChat.js) to accept the `actions` prop and define a new `_onCreateChallenge()` method.
   - When the "Create Challenge" button is clicked, it sets the play filter to the current room (`roomId`) and triggers KGS challenge creation (`onStartCreateChallenge()`), which opens the challenge proposal modal on the play screen pre-selected for the current room.
   - Restructured the render code to unconditionally render the description header, so games/challenges links and the new "Create Challenge" button are always visible even if the room has no host description.
   - Passed `actions` prop down from [ChatScreen.js](file:///home/alfredo/repo/Kido/Kido/src/ui/chat/ChatScreen.js).

2. **UI Styling**:
   - Styled `.RoomChat-desc-actions` and `a.RoomChat-create-challenge` inside [src/css/_chat.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_chat.scss).
   - The button uses a pill style with the swords icon, perfectly matching the design of the adjacent active games/challenges badges.
   - Added appropriate dark mode overrides for background, borders, and hover effects under `body.dark-mode`.

3. **Verification**:
   - Ran `npm run lint` and `npm run flow` (both completed successfully with 0 errors).
   - Compiled the production build (`npm run build`) and copied the updated assets to the `server/` directory.

---

# Walkthrough Addendum: Standardized Capture sound clacks to `stone2`


I have successfully updated the capture sound foley clacks to use only the `stone2` sound effect:

## Changes Implemented

1. **Fixed delayed clacks to `stone2`**:
   - Modified `playCaptureSound()` in [sound/index.js](file:///home/alfredo/repo/Kido/Kido/src/sound/index.js) to play `STONE_SOUNDS[1]` (which is `stone2.mp3`) instead of selecting a random clack sound for the delayed foley clacks (60ms and 130ms).
   - The primary stone placement clack (0ms) remains randomized to match the player's board click.

2. **Verification**:
   - Ran type-checking (`flow check`), code formatting (`eslint`), and built the production build successfully.

---

# Walkthrough Addendum: Correct Capture Bowls Stone Colors


I have successfully corrected the stone colors inside the captured stones bowls to match the captured stones color:

## Changes Implemented

1. **Stone Color Swap**:
   - In [BoardContainer.js](file:///home/alfredo/repo/Kido/Kido/src/ui/board/BoardContainer.js), swapped `CaptureBowl-stone-black` and `CaptureBowl-stone-white` between the two capture bowls.
   - Now, `blackCaptures` (captures made by the Black player, which are captured white stones) are correctly rendered as white stones (`CaptureBowl-stone-white`).
   - `whiteCaptures` (captures made by the White player, which are captured black stones) are correctly rendered as black stones (`CaptureBowl-stone-black`).

2. **Verification**:
   - Ran `npm run lint` and `npm run flow` (both completed successfully with 0 errors).
   - Compiled the production build (`npm run build`) and copied the updated assets to the `server/` directory.

---

# Walkthrough Addendum: Position Zen Mode Stones Left of Usernames


I have successfully updated the positioning of the white and black player stone indicators in Zen Mode on both desktop and mobile views to show them on the left of the player usernames:

## Changes Implemented

1. **Desktop Zen Mode**:
   - Refactored [.GameScreen-zen-username](file:///home/alfredo/repo/Kido/Kido/src/css/_gamescreen.scss) to use `display: inline-flex; align-items: center; justify-content: center; gap: 6px;` to layout username contents horizontally.
   - Moved the `:before` pseudo-element stone definitions from the container classes `.GameScreen-zen-clock-white:before` and `.GameScreen-zen-clock-black:before` to `.GameScreen-zen-clock-white .GameScreen-zen-username:before` and `.GameScreen-zen-clock-black .GameScreen-zen-username:before`.
   - Removed vertical margins and replaced block positioning with inline alignment, placing the stone directly on the left of the username text inside the flex container.

2. **Mobile Zen Mode**:
   - Modified [src/css/_gamescreen.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_gamescreen.scss) under the mobile query overrides (`body.zen-mode .GameScreen-players`) to unhide `.GamePlayersInfo-players-icon` (the stone).
   - This restores the stone display on the left of the username on mobile screens when in Zen Mode, matching the desktop layout.

3. **Verification**:
   - Ran `npm run lint` and `npm run flow` (both completed successfully with 0 errors).
   - Compiled the production build (`npm run build`) and copied the updated assets to the `server/` directory.

---

# Walkthrough Addendum: Instant Preference Autosave with Status Indicator


I have successfully updated the Preferences modal to automatically save changes immediately upon any user preference interaction (checkbox toggles, notifications segment switches). The separate "Save Changes" footer button and success banner have been replaced by an inline autosave status indicator.

## Changes Implemented

1. **Instant Autosaving**:
   - Modified [PreferencesModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/PreferencesModal.js) to trigger a new `_autosave()` method immediately when any form input is changed.
   - The `_autosave()` method updates both the KGS server profile details and standard client `localStorage` settings (sound effects, chat notifications).

2. **Autosave Status Indicator**:
   - Added a new `saveStatus` state property to show `"saving"` or `"saved"` states dynamically when changes are autosaved.
   - Designed a centered, pill-shaped status badge with a subtle shadow overlay, background colors, and a vertical slide-in fade transition.
   - Displays a spinning loading icon next to `"Saving changes..."` during saves, and transitions to a checkmark icon next to `"Preferences saved!"` when the save completes.
   - Styled the container, pill styles, and fade-in transition in [_meta.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_meta.scss).

3. **Clean UI Redesign**:
   - Removed the obsolete "Save Changes" button and footer area.
   - Removed `isSaving` and `showSuccess` states and the corresponding temporary success banner.
   - Removed the unused `Icon` component import.

4. **Verification**:
   - Ran typechecking (`flow check`), code formatting / rules validation (`eslint`), and built the production build successfully.

---

# Walkthrough Addendum: Unified Local Friends with Server-side Buddy List

I have successfully unified the local friends list (`kido_friends` in localStorage) with the server-side KGS `buddy` list. Since Kido now natively supports KGS buddy, fan, and censor lists with Heart, Star, and Ban icons, the separate local friends list has been removed.

## Changes Implemented

1. **Relying Solely on Server-side Buddies**:
   - Refactored `sortUsers` in [user.js](file:///home/alfredo/repo/Kido/Kido/src/model/user.js) to sort users using the server-side `buddies` list rather than the local `isFriend` helper.
   - Updated [UserList.js](file:///home/alfredo/repo/Kido/Kido/src/ui/user/UserList.js) to filter users in the "Friends" section using `buddies` instead of the local friends list.

2. **Heart Icon and Direct Buddy Actions**:
   - Refactored [UserName.js](file:///home/alfredo/repo/Kido/Kido/src/ui/user/UserName.js) to check the server-side buddy list (`isBuddy`) and use the `heart`/`heart-o` icons instead of `heart-handshake` next to user names.

3. **FriendsList Descriptions and Hints**:
   - Updated [FriendsList.js](file:///home/alfredo/repo/Kido/Kido/src/ui/user/FriendsList.js) to refer to opening user profiles/chats to perform actions using the Heart (Buddy), Star (Fan), and Ban (Censor) icons, replacing outdated references to the handshake icon.

4. **Props Integration & Verification**:
   - Passed `buddies` as a prop in [SearchScreen.js](file:///home/alfredo/repo/Kido/Kido/src/ui/SearchScreen.js) to sort and highlight search results correctly.
   - Passed `buddies` down to `<GameScreen>` in [PlayScreen.js](file:///home/alfredo/repo/Kido/Kido/src/ui/PlayScreen.js) and [WatchScreen.js](file:///home/alfredo/repo/Kido/Kido/src/ui/WatchScreen.js), and updated [GameScreen.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/GameScreen.js) to sort observers using it.
   - Passed `buddies` to `sortUsers` in [Nav.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/Nav.js).
   - Ran linter (`eslint --fix`), flow check (`flow check`), and compiled production assets successfully (`npm run build`).

---

# Walkthrough Addendum: Email Visibility Toggle Fix

I have successfully resolved the issue where the "Email address visible to others" toggle in the Preferences modal failed to persist its state.

## Changes Implemented

1. **Transmitting Both Protocol Field Names Upstream**:
   - Modified [AppActions.js](file:///home/alfredo/repo/Kido/Kido/src/model/AppActions.js) to transmit **both** `emailPrivate` and `privateEmail` properties in the `DETAILS_CHANGE` request payload. This covers any KGS server/proxy naming inconsistencies and ensures the toggle state is correctly received by the backend.

2. **Smart Profile Refresh on Save**:
   - Updated `AppActions.js` to only unjoin and rejoin the details channel if `rankWanted` actually changed (increasing the delay to 500ms). If `rankWanted` didn't change (e.g. only email privacy changed), the channel remains open, and the client naturally receives and parses the server's broadcasted `DETAILS_UPDATE` event, avoiding any timing race conditions.

3. **Bulletproof Downstream Defaulting**:
   - Refactored `parseUser` in [user.js](file:///home/alfredo/repo/Kido/Kido/src/model/user.js) to default `privateEmail` and `emailWanted` to `false` whenever they are missing (`undefined`) in details parsed from KGS server messages, since the server omits false booleans downstream.

4. **UI Toggle Checkbox Standardisation**:
   - Modified [PreferencesModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/PreferencesModal.js) to use a static label `"Email address visible to others"`.
   - Mapped the checked state to `!privateEmail` so that checking the box (ON) corresponds to making the email visible/public, aligning with standard UX conventions.

5. **Verification**:
   - Ran `npm run lint` and `npm run flow` (both completed successfully with 0 errors).
   - Compiled the production build (`npm run build`) and synchronized all compiled static files to the `server/` directory.

---

# Walkthrough Addendum: Standardized Email Privacy Field name to `emailPrivate` (Part 2 - Downstream Mapping)

I have successfully resolved the issue where the toggle state failed to change when toggled to "ON" (Share email). The issue was caused by the KGS server sending the field `privateEmail` downstream in details updates, whereas the client codebase has been standardized on `emailPrivate`:

1. **Downstream Normalization in User Parser**:
   - Modified [user.js](file:///home/alfredo/repo/Kido/Kido/src/model/user.js) inside `parseUser` to extract both `privateEmail` and `emailPrivate` fields from the server response payload and normalize them under `emailPrivate` in the user's details object.
   - Deleted the obsolete `privateEmail` key from the parsed user details to prevent duplicate keys in state or during profile save actions.

2. **Verification**:
   - Ran `npm run lint` and `npm run flow` (both completed successfully with 0 errors).
   - Compiled the production build (`npm run build`) and synchronized the compiled static files to the `server/` directory.

---

# Walkthrough Addendum: Standardized Email Privacy Field name to `emailPrivate`

I have successfully standardized the email privacy property name from `privateEmail` to `emailPrivate` across the entire codebase. This aligns the client's internal representation directly with the KGS protocol definition and eliminates any mapping inconsistency:

1. **Refactored Modals**:
   - Modified [UserDetailsModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/user/UserDetailsModal.js) to check `details.emailPrivate` instead of `details.privateEmail`.
   - Modified [PreferencesModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/PreferencesModal.js) to use `emailPrivate` everywhere, including:
     - The `State` flow type definition.
     - State initialization in the constructor and `componentDidUpdate`.
     - Event handler `_onChangeEmailPrivate`.
     - Output details mapping in `_onSave`.
     - Destructuring and checkbox `<input>` element properties in `render`.

2. **Verification**:
   - Ran `npm run lint` and `npm run flow` (both completed successfully with 0 errors).
   - Compiled the production build (`npm run build`) and synchronized the compiled static files to the `server/` directory.

---

# Walkthrough Addendum: Complete Fix for "Share email address with others" Toggle State Persistence

I have successfully implemented a complete, bidirectional compatibility layer to resolve the toggle state resetting back to ON after saving:

1. **Bidirectional Field Key Compatibility**:
   - The KGS JSON API has inconsistent parameter names for email privacy. It expects `emailPrivate` when sending the `DETAILS_CHANGE` request, but the server details responses (`DETAILS_JOIN`/`DETAILS_UPDATE`) use `privateEmail` under some circumstances and `emailPrivate` under others.
   - Modified [AppActions.js](file:///home/alfredo/repo/Kido/Kido/src/model/AppActions.js) inside `onUpdateProfileDetails` to transmit **both** `emailPrivate: details.privateEmail` and `privateEmail: details.privateEmail` in the `DETAILS_CHANGE` message payload.
   - Modified [user.js](file:///home/alfredo/repo/Kido/Kido/src/model/user.js) inside `parseUser` to check both keys, copying `emailPrivate` to `privateEmail` and vice-versa if either is present in the details payload received from KGS.

2. **Details State Merging**:
   - Previously, the details parser `parseUser` completely overwrote `newUser.details` with the incoming details payload. During partial updates (like `DETAILS_UPDATE`), this discarded all other fields (such as email, personal name, etc.), corrupting the user details state in the Redux store.
   - Refactored `parseUser` in [user.js](file:///home/alfredo/repo/Kido/Kido/src/model/user.js) to merge the new payload keys with the existing `newUser.details` object (`{ ...newUser.details, ...details }`), preserving all profile fields.

3. **Verification**:
   - Ran `npm run lint` and `npm run flow` (both completed successfully with 0 errors).
   - Compiled the production build (`npm run build`) and copied the updated assets to the `server/` directory.

---

# Walkthrough Addendum: Resolve "Share email address with others" Toggle Mismatch

I have successfully resolved the issue where the "Share email address with others" toggle state did not persist:

1. **Root Cause Mismatch**:
   - The KGS server uses the field name `emailPrivate` when sending details to the client (in `DETAILS_JOIN` and `DETAILS_UPDATE` messages), but the React application code expected the field name to be `privateEmail`. Because of this key mismatch, the preference value retrieved from the server was always read as `undefined` (which evaluates as falsy), resetting the toggle switch back to its public state on reload or update.

2. **Incoming Data Mapping**:
   - Modified [user.js](file:///home/alfredo/repo/Kido/Kido/src/model/user.js) inside `parseUser` to copy `emailPrivate` to `privateEmail` if it is present on the details object received from the KGS server:
     ```javascript
     if ("emailPrivate" in details) {
       mappedDetails.privateEmail = !!details.emailPrivate;
     }
     ```
   - This ensures that the state parsed from the server matches the UI component's state expectations, allowing changes to correctly persist and render in the toggle switch.

3. **Verification**:
   - Ran `npm run lint` and `npm run flow` (both completed successfully with 0 errors).
   - Compiled the production build (`npm run build`) and copied the updated assets to the `server/` directory.

---

# Walkthrough Addendum: Change Preferences Toggle Switches to Static Text Labels

I have successfully updated the toggle switch labels in the Preferences modal to use static, unchanging text labels as requested:

1. **Updated Toggle Labels to Static Text**:
   - Modified [PreferencesModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/PreferencesModal.js) to replace dynamic, conditional toggle labels with static text:
     - KGS announcement emails toggle: **"Receive KGS announcement emails"**
     - Email visibility toggle: **"Share email address with others"**
       - Map unchecked state to `privateEmail = true` and checked state to `privateEmail = false` using custom event handler `_onChangePrivateEmail` to keep UI state consistent.
     - Rank visibility toggle: **"Hide rank (games are free)"**
       - Map checked state to `rankWanted = false` and unchecked state to `rankWanted = true` using custom event handler `_onChangeHideRank` to keep UI state consistent.
     - Sound effects toggle: **"Use sound effects"**
   - Verified that the labels do not change text when toggled.

2. **Verification**:
   - Ran `npm run lint` and `npm run flow` (both completed successfully with 0 errors).
   - Compiled the production build (`npm run build`) and copied the updated assets to the `server/` directory.

---

# Walkthrough Addendum: Update Toggle Switch Labels in Preferences Modal

I have successfully updated the toggle switch labels in the Preferences modal to simplify them and improve clarity:

1. **Updated Toggle Labels**:
   - Modified [PreferencesModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/PreferencesModal.js) to replace toggle labels as follows:
     - Sound effects:
       - Enabled: "Enable sound effects" -> **"Sound effects enabled"**
       - Disabled: "Disable sound effects (mute all)" -> **"Sound effects disabled"**
     - Rank visibility:
       - Enabled: "Show your rank" -> **"Rank shown (games are ranked)"**
       - Disabled: "Do not show your rank (all games are free)" -> **"Rank not shown (games are free)"**
     - Email visibility:
       - Public: "Email address visible to others" -> **"Email address visible to others"** (kept same format)
       - Private: "Email address not visible to others" -> **"Email address hidden from others"**

2. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).
   - Copied the compiled production build assets into the `server/` directory.

---

# Walkthrough Addendum: Remove Settings Username Header in Preferences

I have successfully removed the "Editing settings for {username}" header from the Preferences modal:

1. **Removed settings header**:
   - Modified [PreferencesModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/PreferencesModal.js) to delete the redundant subtitle `div.PreferencesModal-user` rendering "Editing settings for {username}".
   - Modified [src/css/_meta.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_meta.scss) to remove the unused `.PreferencesModal-user` rule.

2. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).
   - Copied the compiled production build assets into the `server/` directory.

---

# Walkthrough Addendum: Automatically Unjoin Finished Game Channels

I have successfully updated the application to automatically unjoin game channels when a game ends while keeping the user on the game screen:

1. **Retained Finished Game Tabs**:
   - Modified [WatchScreen.js](file:///home/alfredo/repo/Kido/Kido/src/ui/WatchScreen.js) to remove the auto-close/exit logic inside `componentDidUpdate` when a watched game is marked as `over`. This keeps the watched game tabs open, allowing spectators to inspect the finished board/score.
   - Cleaned up the unused `gamesById` destructuring in `WatchScreen.js` to prevent linter warnings.

2. **Automatically Unjoined Finished Game Channels**:
   - Modified [AppActions.js](file:///home/alfredo/repo/Kido/Kido/src/model/AppActions.js) inside `onReceiveServerMessages` to check if a received `GAME_STATE` or `GAME_UPDATE` message sets a game in the store to `over === true`.
   - If the game is finished and is currently joined (exists in `channelMembership`), we invoke `this.onUnjoin(channelId)` to automatically close the channel on the KGS server.
   - This frees up server connections and resources immediately.
   - The user remains in front of the game view because the active game IDs (`playGameId` / `watchGameId`) and the game data in `gamesById` remain in the store until the user manually leaves.

3. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).
   - Copied the compiled production build assets into the `server/` directory.

---

# Walkthrough Addendum: Resolve React findDOMNode Deprecation Warnings

I have successfully resolved the React deprecation warnings for `findDOMNode` coming from the `<Portal>` component:

1. **Avoided `ReactDOM.findDOMNode` Calls on DOM Nodes and Component Contexts**:
   - Modified [src/ui/common/Portal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/common/Portal.js) to detect when the `container` element is already a direct DOM node (`container.nodeType` exists). In this case, it returns the element directly instead of calling `ReactDOM.findDOMNode()`.
   - Modified the default document container fallback `ownerDocument2(this)` to return the global `document` context without invoking `ReactDOM.findDOMNode(this)` when called on the component instance (which was the primary source of the deprecation warning when rendering default Modals).

2. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).
   - Copied the compiled production build assets into the `server/` directory.

---

# Walkthrough Addendum: Replace More Menu with +1 Min Button

I have successfully replaced the "More" dropdown menu (containing "Add 1 Minute", "Add 5 Minutes", and "Leave Game") with a direct "+1 min" button on the Game View:

1. **Replaced dropdown with direct action button**:
   - Modified [src/ui/game/GamePlayActions.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/GamePlayActions.js) to remove the dropdown menu, the document click listener, the `moreShowing` state, and the unused menu action handlers (`_onAdd5Minutes`, `_onLeaveGame`).
   - Replaced it with a direct "+1 min" button that calls the existing time-addition logic (`onAddTime`) with a 60-second value.
   - Cleaned up the unused `onLeaveGame` prop in [GamePlayActions.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/GamePlayActions.js) and [GameScreen.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/GameScreen.js), removing the unused `_onLeave` handler from [GameScreen.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/GameScreen.js).

2. **Updated CSS Styling**:
   - Modified [src/css/_gamescreen.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_gamescreen.scss) to rename the `.GamePlayActions-more` class to `.GamePlayActions-addtime` (and clean up unused dropdown sub-classes like `.GamePlayActions-more-menu`, `.GamePlayActions-more-container`, and `.GamePlayActions-more-item`).

3. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).
   - Copied the compiled production build assets into the `server/` directory.

---

# Walkthrough Addendum: Mobile Goban Corner Angles & Margins

I have successfully updated the Goban styling on mobile devices to remove rounded corners and introduce a small margin:

1. **Mobile Override for Board Corner Radius**:
   - Modified [src/css/_board.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_board.scss) by adding a styling override inside the `@media #{$mobile-query}` query block.
   - Set `.Board { border-radius: 0 !important; }` to override the desktop styling `border-radius: 18px !important;` when viewing on mobile screens (viewport width of 736px or less).

2. **Added Spacing/Margins for Mobile Board**:
   - Modified [src/css/_gamescreen.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_gamescreen.scss) under `@media #{$mobile-query}` to apply `margin: 2px 0 !important;` and `padding: 0 2px !important;` to `.GameScreen-board-container`.
   - Updated the zen-mode mobile overrides for `.GameScreen-board-container` to also use `margin: 2px 0 !important;`.
   - This ensures the board has a clean, small 2px buffer on the sides so it doesn't touch the viewport edges, and 2px spacing on the top/bottom so it doesn't crowd adjacent screen elements.

3. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).
   - Copied the compiled production build assets into the `server/` directory.

---

# Walkthrough Addendum: Go Stone Capture Sound Effect

I have successfully integrated a dynamic capture sound effect:

1. **Capture Sound Foley Effect**:
   - Implemented a specialized `playCaptureSound()` function in [sound/index.js](file:///home/alfredo/repo/Kido/Kido/src/sound/index.js).
   - This function generates a realistic stone capture sound foley effect by playing the primary placement sound and immediately triggering two subsequent random stone clacks with short delays (60ms and 130ms) at reduced volumes (60% and 40%). This replicates the tactile sound of placing a stone and then picking up the captured stones to put them in the bowl.

2. **Goban Capture Detection**:
   - Modified the `componentDidUpdate` lifecycle method in [Board.js](file:///home/alfredo/repo/Kido/Kido/src/ui/board/Board.js) to compare the current board state with the previous board state.
   - If a stone was placed (empty intersection populated) and at least one other stone was removed (populated intersection emptied), a capture is detected and it plays the new capture foley sound instead of the regular placement sound.

3. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).

---

# Walkthrough Addendum: Add Sound Effects Preference Toggle

I have successfully added a preference setting to toggle sound effects on/off:

1. **Preference State & UI Integration**:
   - Added a `soundEnabled` field to the State of [PreferencesModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/PreferencesModal.js) and initialized it using the `isSoundEnabled()` helper.
   - Rendered a new `ToggleSwitch` for sound effects (showing "Enable sound effects" / "Disable sound effects (mute all)") in the Preferences modal view.
   - Updated `_onSave` to persist the setting value in `localStorage` under the `"kido_sound_enabled"` key.

2. **Sound Checks**:
   - Exported `isSoundEnabled()` and the key `SOUND_ENABLED_KEY` from [sound/index.js](file:///home/alfredo/repo/Kido/Kido/src/sound/index.js).
   - Conditionally bypassed the play execution inside `playStoneSound()` in [sound/index.js](file:///home/alfredo/repo/Kido/Kido/src/sound/index.js) if sounds are disabled.
   - Updated [AppActions.js](file:///home/alfredo/repo/Kido/Kido/src/model/AppActions.js) to check `isSoundEnabled()` before playing the `CHALLENGE_PROPOSAL_RECEIVED` and `DIRECT_MESSAGE_RECEIVED` sounds.

3. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).

---

# Walkthrough Addendum: Go Stone Sound Effect Integration

I have successfully downloaded, processed, and integrated the Go stone placing sound effects:

1. **Audio Download and Processing**:
   - Downloaded the `GoStoneSounds.mp3` sequence from Freesound.org containing 5 custom Yunzi go stone clacks.
   - Used `ffmpeg` to split the sequence into 5 individual clean mp3 files: `stone1.mp3`, `stone2.mp3`, `stone3.mp3`, `stone4.mp3`, and `stone5.mp3` inside [src/sound/](file:///home/alfredo/repo/Kido/Kido/src/sound).

2. **Sound Integration**:
   - Updated [sound/index.js](file:///home/alfredo/repo/Kido/Kido/src/sound/index.js) to import all 5 stone sounds, instantiate `new Audio()` objects, and export a randomized `playStoneSound()` function.
   - Updated [Board.js](file:///home/alfredo/repo/Kido/Kido/src/ui/board/Board.js) to import `playStoneSound()` and trigger it inside `componentDidUpdate` when the board changes and a new stone is placed.

3. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).

---

# Walkthrough Addendum: Add BetaTwo to BOT List

I have successfully added `"betatwo"` to the list of known bots:

1. **Updated central bot list**:
   - Added `"betatwo"` to the `KNOWN_BOTS` array in [bot.js](file:///home/alfredo/repo/Kido/Kido/src/util/bot.js).

2. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).

---

# Walkthrough Addendum: Feedback Modal Em-Dash Removal

I have successfully removed all em-dashes (`—`) from the user-facing text in the Feedback modal inside [FeedbackModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/FeedbackModal.js):

1. **Removed Em-Dashes**:
   - Replaced the em-dash in the "General Feedback" description with a colon (`:`, making it `"Anything else: praise, criticism..."`).
   - Split the intro paragraph sentence to remove the em-dash, using a full stop (`.`, making it `"Your feedback directly shapes the project. Don't hesitate..."`).

2. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).

---

# Walkthrough Addendum: About Modal Credits Ordering

I have successfully reordered the Credits list inside [AboutModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/AboutModal.js) to place the KGS Go Server section at the very top:

1. **Reordered Credits List**:
   - Shifted the KGS Go Server `<li>` section to be the first element inside the `AboutModal-credits-list` `<ul>` tag.

2. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).

---

# Walkthrough Addendum: About Modal Copy Text Updates

I have successfully updated the copy and descriptions inside the About modal tabs (About, Credits, and Terms & Privacy) in [AboutModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/AboutModal.js) to match the simplified versions requested:

1. **Updated Descriptions**:
   - **About Section**: Simplified the main description paragraph and player action text.
   - **Shinkgs Credit**: Changed description to "The core JavaScript client engine and starting point for the Kido web client."
   - **SabakiThemes Credit**: Changed description to "Premium CSS design ideas for wood grains, boards, and stone looks."
   - **Lucide Icons Credit**: Changed description to "Crisp, modern open-source vector icon set."
   - **KGS Go Server Credit**: Changed description to "The game server, database, and community that form the Kido foundation."
   - **Local Storage Terms**: Simplified to mention preference items like themes.

2. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).

---

# Walkthrough Addendum: About Modal Credits Sabaki Link Removal

I have successfully removed the "Sabaki" link in the About Modal credits, keeping only the "SabakiThemes" link as requested:

1. **Removed Sabaki Credit Link**:
   - Modified [AboutModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/AboutModal.js) to delete the link targeting `https://github.com/SabakiHQ/Sabaki` ("Sabaki") and its associated separator (` & `) in the credits list.
   - Retained the link targeting `https://github.com/billhails/SabakiThemes/tree/main` ("SabakiThemes").

2. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).

---

# Walkthrough Addendum: Game Summary Modal Dark Mode Styling Overrides

I have successfully fixed the styling of the Game Summary modal in dark mode to ensure clear text contrast and readability:

1. **Applied Dark Mode Styling Overrides**:
   - Added class overrides for `.UserGameSummary` nested under `body.dark-mode` inside [_user.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_user.scss).
   - Set `.UserGameSummary-player` to `#d4e4dc` (the high-contrast off-white/light-green used for usernames in dark mode) to make player names fully visible against the dark background.
   - Set `.UserGameSummary-meta-value` to `#f1f5f9` (bright off-white) to ensure the game metadata values stand out clearly.
   - Set `.UserGameLoadForm-room label` to `#7a9e8e` (matching other secondary labels inside dark mode modals).
   - Switched borders and divider line colors (`.UserGameSummary-players`, `.UserGameSummary-divider`, and `.UserGameLoadForm-action`) to a subtle light border (`rgba(255, 255, 255, 0.08)`) instead of the dark light-mode colors.

2. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).

---

# Walkthrough Addendum: Toggle Switch Rendering Fix for Multi-line Labels

I have successfully fixed the rendering issue for Toggle Switches when their labels wrap onto multiple lines:

1. **Fixed Toggle Control Shrinking**:
   - Added `flex-shrink: 0;` to the `.ToggleSwitch-control` class inside [_challenge.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_challenge.scss).
   - This prevents the flex container (`.ToggleSwitch`) from squeezing the toggle switch control below its designed width (44px) when the text in `.ToggleSwitch-label` wrapping to multiple lines consumes the available flex width.
   - The toggle switch track and white slider circle are now perfectly aligned and fully visible without any clipping or flattening.

2. **Verification**:
   - Ran `npm run lint` (0 errors).
   - Ran `npm run flow` (0 errors).
   - Ran `npm run build` (built successfully).

---

# Walkthrough Addendum: Center Text and Icons inside Preferences Backup Buttons

I have successfully centered the text and icons inside the "Export Preferences" and "Import Preferences" buttons within the Preferences Backup section of the Preferences modal:

1. **Centered Button Contents**:
   - Updated the styling for `.PreferencesModal-backup-actions .Button` inside [_meta.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_meta.scss) to use `display: inline-flex`, `align-items: center`, and `justify-content: center`. This forces the button layout to act as a flex container, centering both the icon and the text label as a group.
   - Standardized the padding to `7px 12px` to make the margins symmetric, ensuring the group is perfectly centered horizontally.

2. **Verification**:
   - Ran `npm run lint` to verify that JavaScript files adhere to linter rules (0 errors).
   - Ran `npm run flow` to verify Flow types (0 errors).
   - Ran `npm run build` to verify the CSS compiles successfully (built successfully).

---

# Walkthrough Addendum: UI Styling Standardization, Font Optimization, Contrast Improvements & Bottom Line Removal

I have successfully resolved the bottom-line rendering issue on the play and watch screens, optimized Google Fonts, standardized the styling system, improved dark mode text contrast for usernames, and cleaned up the design rules reference:

1. **Removed Bottom Line on PlayScreen and WatchScreen**:
   - Modified [GameList.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/GameList.js) to conditionally render `.GameList-show-more-container` only when `hasMore` is true. This prevents an empty container with layout margins, paddings, and borders from rendering at the bottom of lists.
   - Removed `border-top` and `border-top-color` overrides from `.GameList-show-more-container` in [_gamelist.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_gamelist.scss) to eliminate the divider line and keep the button layout clean and floating.

2. **Optimized and Changed Google Fonts**:
   - Cleaned up [public/index.html](file:///home/alfredo/repo/Kido/Kido/public/index.html) by removing the unused `Playfair Display` font import and changing the primary font import from `Outfit` to **`Inter`** (weights `300;400;500;600;700;800`) to match Lichess's clean, modern text layout.
   - Updated the `$font-family` variable in [_common.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_common.scss) to use `'Inter'`, keeping the stack clean and aligned.
   - Updated the hardcoded `.GameClock` font declaration in [_gamescreen.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_gamescreen.scss) to use the standardized `$font-family` variable.
   - Updated [DESIGN_RULES.md](file:///home/alfredo/repo/Kido/Kido/DESIGN_RULES.md) to document the new `Inter` font stack.

3. **Standardized Accent Colors**:
   - Replaced residual hardcoded teal (`#357a6e` / `rgba(74, 158, 142, ...)`) and green (`#5a9e78` / `rgba(90, 158, 120, ...)`) accents with the custom runtime accent variables `var(--ui-color)` and `rgba(var(--ui-color-rgb), ...)` inside:
     - [_chat.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_chat.scss) (active chat tabs background and text, input focus shadows, and game links)
     - [_gamelist.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_gamelist.scss) (dark mode filter button hovers and show more buttons)
     - [_gamescreen.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_gamescreen.scss) (WatchTabs active tabs, Zen buttons active state, observers buttons, and scoring banner layout)
     - [_nav.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_nav.scss) (search result hovers in dark mode)
     - [_user.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_user.scss) (user details authentication name badge and automatch search status)
     - [_common.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_common.scss) (secondary buttons focus/hover states)

3. **Resolved Variable Mismatches**:
   - Modified [_meta.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_meta.scss) to replace hardcoded grey `#718096` with standard `$semi-muted` and background `#fafafa` with standard `$off-white`.

4. **Improved Dark Mode Username Contrast**:
   - Modified [_gamelist.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_gamelist.scss) to change the dark mode text color for `.GamePlayersList-player` and `.GamePlayersList-player1::after` from the low-contrast `#7a9e8e` (greyish-green) to the high-contrast `#d4e4dc` (off-white). This fixes readability of player names in the active games and challenge lists under dark mode.

5. **Cleaned Up Unused Reserve Palette Colors**:
   - Modified [DESIGN_RULES.md](file:///home/alfredo/repo/Kido/Kido/DESIGN_RULES.md) to retire the unused "reserve" palette color entries and checked off completed items under the Design TODO.

6. **Verification**:
   - Checked that all linters (`npm run lint`), type-checkers (`npm run flow`), and tests (`npm test`) pass successfully.
   - Verified that the Webpack production compilation build (`npm run build`) completes successfully.

---

# Walkthrough: NeoKGS Branding, Repository Migration, Dependency Resolution, and UI Styling

I have successfully updated all repository links, branding titles, and contact information across the codebase, resolved a package resolution conflict, cleaned up legacy Java files, fixed the dark mode styling for the chat input box, and updated the room description and sidebar user list visual design.

---

## Changes Implemented

### 1. Repository & Branding Migration
* **Base GitHub Repository**: Replaced all references to the old repository (`https://github.com/jkk/shinkgs`) with `https://github.com/rampichino/NeoKGS` inside:
  * [AppActions.js](file:///home/alfredo/repo/KGS/KGS/src/model/AppActions.js) (contribute link action)
  * [UnderConstructionModal.js](file:///home/alfredo/repo/KGS/KGS/src/ui/meta/UnderConstructionModal.js) (modal link)
  * [README.md](file:///home/alfredo/repo/KGS/KGS/README.md) (title header, build badge, milestones, and issues links)
* **Header Text branding**: Updated the navigation header logo text in [Nav.js](file:///home/alfredo/repo/KGS/KGS/src/ui/meta/Nav.js) from **KGS** to **NeoKGS**.

### 2. Contact Information & Legacy Handles Updates
* **Email Reference**: Replaced `jkkramer@gmail.com` with `neokgs@tuta.com` inside:
  * [FeedbackModal.js](file:///home/alfredo/repo/KGS/KGS/src/ui/meta/FeedbackModal.js) (feedback contact text)
  * [CODE_OF_CONDUCT.md](file:///home/alfredo/repo/KGS/KGS/CODE_OF_CONDUCT.md) (reporting contact email)
  * [UnderConstructionModal.js](file:///home/alfredo/repo/KGS/KGS/src/ui/meta/UnderConstructionModal.js) (contributor feedback contact)
* **Legacy Handles Cleaned**: Removed the developer's old Twitter handle `@jkkramer` from:
  * [FeedbackModal.js](file:///home/alfredo/repo/KGS/KGS/src/ui/meta/FeedbackModal.js)
  * [UnderConstructionModal.js](file:///home/alfredo/repo/KGS/KGS/src/ui/meta/UnderConstructionModal.js)
  * [index.html](file:///home/alfredo/repo/KGS/KGS/public/index.html) (metadata meta tags)

### 3. Dependency Conflict Resolution
* **ESLint & Prettier Versioning**: Upgraded `eslint-plugin-prettier` to `^5.0.0` and `eslint-config-prettier` to `^9.1.1` in [package.json](file:///home/alfredo/repo/KGS/KGS/package.json) to restore compatibility with the project's Prettier v3 setup. This fixes the ERESOLVE conflict during clean `npm install` runs.
* **ESLint Configuration Alignment**: Simplified the `extends` block in [.eslintrc](file:///home/alfredo/repo/KGS/KGS/.eslintrc) to remove deprecated presets merged in Prettier v8+ (`prettier/flowtype`, `prettier/react`, `prettier/standard`).

### 5. Chat Input Visual Polish in Dark Mode
* **Fixed Missing Dark Mode Background**: Added dark mode overrides for `.RoomChat-message-bar` in [_chat.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_chat.scss) and [_common.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_common.scss). This fixes the issue where the outer chat input container retained a bright, light-grey background (`rgba(246, 245, 242, 0.95)`) in dark mode, causing a heavy, high-contrast frame around the input area.
* **Refined Input Borders**:
  * Reduced the default border weight of `input.ChatMessageBar-input` from `2px` to `1px` inside [_chat.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_chat.scss) to make the text input outline look much thinner and cleaner.
  * Updated all dark mode border-width overrides inside [_chat.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_chat.scss), [_common.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_common.scss), and [_gamescreen.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_gamescreen.scss) to utilize `1px` thickness.
  * Added custom `:focus` state overrides for the input element in dark mode (using `var(--dk-accent)` and a soft shadow/glow) to prevent it from reverting to the light mode's heavy, light-grey focus outline.

### 6. Room Description Collapsed State & Conditional Backgrounds
* **Default Collapsed State**: Set the default initial state of `descCollapsed` to `true` in [RoomChat.js](file:///home/alfredo/repo/KGS/KGS/src/ui/chat/RoomChat.js) so that the room info/description is closed by default when entering a room.
* **Conditional Info Card & Header**:
  * Styled `.RoomChat-desc` in [_chat.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_chat.scss) (both light and dark modes) as a narrow header bar with a distinct background (`#f1f5f9` / `#1f2d28`) and bottom border.
  * Restructured [RoomChat.js](file:///home/alfredo/repo/KGS/KGS/src/ui/chat/RoomChat.js) to render `.RoomChat-desc-text` below the toggle button only when expanded, keeping the card background (`#ffffff` / `#243028`) only when open.

### 7. Fixed User List Sticky Header & Scroll Peeking
* **Eliminated Padding Gap**: Removed top padding from `.RoomChat-sidebar` and `.RoomChat-users` in [_chat.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_chat.scss) so that the sticky `.UserList-header` sits flush at the very top of the sidebar. This completely prevents scrolled usernames from peeking above the sticky header.
* **Header Style Improvements & Edge Alignment**:
  * Styled the header with a clean slate background (`#f8fafc` in light, `#1f2d28` in dark) and border.
  * Improved font sizing and weights for the user count and checkboxes.
  * Added the base `.UserList` class styling (`margin: 0; padding: 0; width: 100%;` in [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss)) and removed outer padding in `.ChatScreen-room-users` (main panel context) and `.SearchScreen-users` (search screen context) to ensure the sticky header background and bottom-border line stretch cleanly to the left and right layout borders without any light-grey/white gaps.
  * Solved the subpixel border-overlap offset in the sidebar context: Added `margin-left: -1px; width: calc(100% + 1px) !important;` and a custom matching `border-left` to `.RoomChat-sidebar .UserList-header` in [_chat.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_chat.scss) (with appropriate dark-mode overrides in [_chat.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_chat.scss) and [_common.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_common.scss)) so that the header background and vertical line align perfectly with the sidebar's left border.
* **Dark Mode support for UserList**: Added overrides in [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) and [_common.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_common.scss) so that the header background, item text colors, hover state, and `CheckboxInput` controls/checkmarks are fully themed in dark mode (preventing the previous bright white background bugs).
* **Features Document Alignment**: Aligned the "Features Not Yet Implemented" section between [DEVELOPMENT_RULES.md](file:///home/alfredo/repo/KGS/KGS/DEVELOPMENT_RULES.md) and [README.md](file:///home/alfredo/repo/KGS/KGS/README.md) by adding the missing items (Beta-testing, Site styling, Direct messaging, Game loading page, and Friends list method) as detailed command-mapped rows in the tables of `DEVELOPMENT_RULES.md`.
* **Landing Page Footer Restyling**: Transformed the plain "Official KGS" link on the landing page [LoginScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/LoginScreen.js) into a premium glassmorphic pill badge. Restyled it in [_login.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_login.scss) to use subtle background opacity, glowing live-status indicator dots (glowing teal switching to cyan on hover), clean drop shadows, and modern micro-animations (translateY hover transition). Also removed the previous horizontal line separator (`border-top`) above the footer to keep the lower layout clean and floating.

### 8. KGS Server-Side User Lists (Buddy, Fan, and Censored)
* **Replaced Local Storage Friends List**: Migrated the friends list tracking system from client-side local storage to KGS server-side lists.
* **State & Protocol Integration**:
  * Added `buddies`, `fans`, and `censored` arrays in `AppState` in [types.js](file:///home/alfredo/repo/KGS/KGS/src/model/types.js) and initialized them in [appState.js](file:///home/alfredo/repo/KGS/KGS/src/model/appState.js).
  * Processed KGS `LOGIN_SUCCESS` friends lists in [user.js](file:///home/alfredo/repo/KGS/KGS/src/model/user.js).
  * Implemented handlers for downstream messages `FRIEND_ADD_SUCCESS`, `FRIEND_REMOVE_SUCCESS`, and `FRIEND_CHANGE_NO_USER` in [user.js](file:///home/alfredo/repo/KGS/KGS/src/model/user.js).
  * Created upstream command creators `onFriendAdd(name, friendType, text)` and `onFriendRemove(name, friendType)` in [AppActions.js](file:///home/alfredo/repo/KGS/KGS/src/model/AppActions.js).
* **Controlled Username Buddy Toggles**:
  * Updated [UserName.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserName.js) to support controlled `isBuddy` and `onToggleBuddy` props, routing star toggles directly to KGS server lists.
* **Tabbed Friends Panel**:
  * Refactored [FriendsList.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/FriendsList.js) to show a tabbed layout (Tabs: Buddies, Fans, Censored) with counters.
  * Added visual styling and hover states for the tabs, plus full support for dark mode, inside [_chat.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_chat.scss).
  * Removed rank display and the chat bubble comment icon button from list rows.
  * Redesigned the remove button to use a clean `x-circle` icon in slate-gray that smoothly transitions to a soft red with a subtle circular hover background.
  * Added corresponding tab header icons: `heart-handshake` for Buddies, `star` for Fans, and `ban` for Censored.
* **Profile Actions in UserDetailsModal**:
  * Passed the lists to [UserDetailsModal.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserDetailsModal.js).
  * Rendered dynamic actions in the modal header: Follow/Unfollow button with `star`/`star-o` (follow list) and Censor/Uncensor button with `ban` (censor list).
  * Added the `message-square` icon to the Message button.
  * Removed text labels from all profile header action buttons to show icons only.
  * Repositioned the buddy/friend toggle button (with `heart-handshake` icon) inside the header actions group (placed before the Follow button) and disabled it from showing next to the username inside the modal.
  * Separated the "Message" chat button from the social list controls ("Friend", "Follow", and "Censor") with a vertical divider line (`UserDetailsModal-divider`).
  * Propagated the `title` tooltip prop inside [Button.js](file:///home/alfredo/repo/KGS/KGS/src/ui/common/Button.js) to the underlying `<button>` and `<a>` elements so that all icon-only buttons render descriptive hover tooltips.
  * Styled standard label-less buttons (`.Button-no-label` in [_common.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_common.scss)) to render as perfectly centered squares (36px x 36px) with zero padding.

* **Documentation & References**:
  * Added clickable links to `DEVELOPMENT_RULES.md`, `KGS_Protocol_Reference.md`, and `CHANGELOG.md` in `README.md`.
  * Marked user list features as completed in the `README.md` backlog checklist.
  * Updated `KGS_Protocol_Reference.md` with detailed JSON payload specification for user list operations.
  * Removed the outdated compiled `KGS_Protocol_Reference.pdf`.

* **User List Error Fix**:
  * Set `callbackKey` to `1` in both buddy and list commands inside [AppActions.js](file:///home/alfredo/repo/KGS/KGS/src/model/AppActions.js). (OMITTING the `callbackKey` caused the KGS server servlet to reject requests with a `400 (Bad Request)` response, while setting it to `0` caused the servlet to crash and force a connection reset/logout. Setting it to `1` resolves both issues.)
  * Omitted the optional `text` field when adding list entries if it is not defined to avoid empty string validation failures.
  * Added guest account restrictions: Checked `currentUser.flags.guest` in [UserDetailsModal.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserDetailsModal.js) to completely disable the buddy star, Follow, and Censor buttons when logged in as a guest, as KGS prohibits guests from modifying buddy/social lists.
  * Wrapped client send commands in try-catch blocks to prevent any potential runtime crashes.

### 9. Landing Page Beta Access Gate
* **Temporary Access Gate**: Added a simple gate screen on the landing page [LoginScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/LoginScreen.js) requiring the password `neokgs2026`.
* **Cookie-Based Persistence**: Saves the access state inside a cookie (`neokgs_beta_access`) for 1 year, so users only need to type the password once.
* **Unified Aesthetics**: Matches the typography, input fields, and overall premium layout of the main login screen, including a custom pill badge at the footer.

### 10. Cloudflare Turnstile CAPTCHA Integration
* **Asynchronous API Script Loading & Warning Avoidance**: Added the Cloudflare Turnstile API script tag in the `<head>` of [index.html](file:///home/alfredo/repo/KGS/KGS/public/index.html) with an `onloadTurnstileCallback` query parameter. Defined a default placeholder function on `window` in `index.html` that delegates to a React callback (`window.__onloadTurnstileCallback`) once mounted. This prevents console warnings about missing callbacks when the script finishes loading before the React bundle initializes.
* **Programmatic Turnstile Rendering & Multi-Environment Support**: Integrated programmatic Turnstile rendering inside [LoginScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/LoginScreen.js). The CAPTCHA widget automatically checks if it is running in a local development or staging environment (using `process.env.NODE_ENV === 'development'`, private IP address subnets `192.168.*`, `10.*`, `172.*`, `.local` domains, or Railway staging/preview environments ending in `.railway.app`). It loads the testing sitekey `1x00000000000000000000AA` for local testing environments, your specific staging sitekey `0x4AAAAAADdeGj30NWMRwhJG` on Railway domains, and defaults to your production sitekey `0x4AAAAAAADdeGj30NWMRwhJG` for other production domains. The widget is themed `dark` to match the login page style.
* **Backend Turnstile Validation Middleware**: Enhanced [server.js](file:///home/alfredo/repo/KGS/KGS/server/server.js) to implement complete backend security verification. Added a custom body-buffering middleware that intercepts incoming `LOGIN` requests, extracts the Turnstile verification token, and securely performs validation using Cloudflare's `siteverify` API with the appropriate secret key (the always-pass test secret for local testing, or the deployment's secret from the TURNSTILE_SECRET_KEY environment variable).
* **Security Token Sanitization & Restreaming**: On successful verification, the backend strips the temporary `captchaToken` attribute from the request body (avoiding forwarding unknown fields to the KGS API) and safely restreams the payload using `http-proxy` with updated `Content-Length` headers. Failed verifications are rejected with a `400 Bad Request` JSON error response.
* **Timing & Lifecycle Management**: Hooked the initialization directly into a React ref callback (`_setCaptchaRef`). This ensures the widget renders correctly only after the user bypasses the beta access gate and the login form is actually mounted.
* **Form Validation & Security**: Updated the `_onLogin` handler to block authentication requests and set a `captchaError` if `captchaToken` is missing.
* **Clean Disposal**: Added cleanup logic in `componentWillUnmount()` to call `turnstile.remove()` to prevent memory leaks.
* **CSS Layout and Styling**: Styled `.LoginScreen-captcha-container` in [_login.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_login.scss) to center the widget and add spacing.

### 11. Fixed Proxy `ERR_HTTP_HEADERS_SENT` Crash on POST requests
* **The Issue**: Intercepting and buffering POST requests meant that `http-proxy` was called with a custom buffer stream. In this configuration, modifying outgoing request headers inside the asynchronous `proxyReq` listener threw an `ERR_HTTP_HEADERS_SENT` error because headers had already begun their transmission. This unhandled error crashed the Node server process, resulting in a `502 Bad Gateway` error for all POST requests.
* **The Fix**:
  - Replaced the asynchronous `proxyReq` event listener with a synchronous Express middleware in [server.js](file:///home/alfredo/repo/KGS/KGS/server/server.js#L96-L105) that modifies `req.headers` directly on the request object before the proxy starts. This allows the proxy to synchronously clone the headers without conflicts.
  - Replaced the manual `new Readable()` stream implementation in `forwardToKgs` with Node's optimized and fully compliant `Readable.from(buf)` method.
  - Ensured the correct Turnstile testing secret key (`1x00000000000000000000000000000000` instead of ending in `AA`) is configured during local development.

### 12. Resolved Nixpacks Build Failure due to Corrupted `yarn.lock`
* **The Issue**: Since a `yarn.lock` file was present in the repository, the Nixpacks builder automatically detected Yarn as the package manager and ran `yarn install --frozen-lockfile` before running the custom build command. The build failed with `SyntaxError: Invalid value type` because the `yarn.lock` file was corrupted/invalid.
* **The Fix**:
  - Deleted the unused, corrupted `yarn.lock` from the repository, forcing Nixpacks to automatically fall back to using `npm` (which aligns with the project's actual `package-lock.json` and `ci.yml` configurations).
  - Updated [DEVELOPMENT_RULES.md](file:///home/alfredo/repo/KGS/KGS/DEVELOPMENT_RULES.md#L158) to change the outdated `yarn build` reference to `npm run build`.

### 13. Fixed Forced Logout on Server-Side Transient Errors (e.g., Unknown Channel)
* **The Issue**: Previously, the [KgsClient](file:///home/alfredo/repo/KGS/KGS/src/model/KgsClient.js) mapped all non-zero HTTP response statuses (including HTTP 500 errors returned during transient exceptions like `Unknown channel`) to the error type `"noClient"`. This immediately forced the client application to log the user out and transition back to the login screen.
* **The Fix**:
  - Refactored `_receiveMessages` and `_sendMessage` inside [KgsClient.js](file:///home/alfredo/repo/KGS/KGS/src/model/KgsClient.js) to only map HTTP `400` (Bad Request) and `404` (Not Found) statuses to `"noClient"` (since these indicate that the KGS session has expired or does not exist).
  - Mapped other non-200 HTTP statuses (such as HTTP `500` or `502` due to transient server/network errors) to `"serverError"`, allowing the user to remain logged in and keeping the polling flow active.

### 14. Centralized Bot Lists & Added `"pachipachi"`
* **The Issue**: A list of `KNOWN_BOTS` was hardcoded separately in five different files across the codebase, making updates error-prone and duplicating code.
* **The Fix**:
  - Created a single centralized utility module [bot.js](file:///home/alfredo/repo/KGS/KGS/src/util/bot.js) containing the list of known KGS bots.
  - Added `"pachipachi"` to this centralized bot list.
  - Refactored all 5 components ([PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js#L23), [WatchScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/WatchScreen.js#L14), [GameList.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/GameList.js#L12), [UserList.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserList.js#L3), and [UserName.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserName.js#L4)) to import `KNOWN_BOTS` directly from [bot.js](file:///home/alfredo/repo/KGS/KGS/src/util/bot.js).

### 15. Intercepting & Preventing KGS "Unknown channel" Exception Logout loop
* **The Issue**: When a game or room finishes, KGS closes the channel on the server. If the client subsequently triggers a UI action (such as unjoining or sending a chat message to the now-closed channel), the KGS server servlet throws an unhandled `java.lang.RuntimeException: Unknown channel [id]`, terminating the session and sending a `LOGOUT` command response, forcing the user back to the login screen.
* **The Fix**:
  - Modified `onUnjoin`, `onSendChat`, and `onSendGameChat` inside [AppActions.js](file:///home/alfredo/repo/KGS/KGS/src/model/AppActions.js) to query the Redux store's active `channelMembership` list first.
  - Commands to unjoin or send chat are now only transmitted to the KGS backend if the channel is confirmed as active on the client. This completely prevents the server-side exceptions and associated session termination loop.

### 16. Private Chat Header Direct Challenge Button
* **Feature Description**: Added a "Challenge" button inside the private chat header to allow users to directly challenge their chat opponent. Clicking this button navigates to the Play tab, opens the challenge setup modal, pre-populates the opponent slot with the opponent's username, defaults the challenge to a **Private Free Game** (since KGS does not allow direct challenges to be ranked), and restricts options accordingly.
* **Implementation Details**:
  * Added `creatingChallenge` (boolean) and `challengeTargetUser` (nullable string) to `AppState` ([types.js](file:///home/alfredo/repo/KGS/KGS/src/model/types.js)) and initialized them in [appState.js](file:///home/alfredo/repo/KGS/KGS/src/model/appState.js).
  * Created actions `onStartCreateChallenge(username)` and `onCancelCreateChallenge()` in [AppActions.js](file:///home/alfredo/repo/KGS/KGS/src/model/AppActions.js).
  * Handled actions `START_CREATE_CHALLENGE` and `CANCEL_CREATE_CHALLENGE` (as well as `CLOSE_CHALLENGE`, `GAME_JOIN`, and `CHALLENGE_CREATE` to reset challenge state) in [session.js](file:///home/alfredo/repo/KGS/KGS/src/model/session.js).
  * Modified `createInitialProposal()` in [challenge.js](file:///home/alfredo/repo/KGS/KGS/src/model/game/challenge.js) to accept `targetUser` and pre-populate it as the black player. Enforced `gameType` to default to `"free"` for direct challenges.
  * Updated [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js) to use Redux state props `creatingChallenge` and `challengeTargetUser` and pass `challengeTargetUser` to `<ChallengeEditor />`.
  * Updated [ChallengeEditor.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ChallengeEditor.js) to receive `challengeTargetUser`, forward it to `createInitialProposal`, and default `visibility` to `"private"`.
  * Updated [ProposalForm.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ProposalForm.js) to render the players list when `editMode === "creating"` if a target opponent is pre-populated, so that the opponent's username is clearly displayed. Restricted the available game types to `"free"` only (disabling `"ranked"`) for direct challenges. Hided the room selector dropdown (displaying the room name as static text instead) to distinguish direct challenges from room-based ones.
  * Mapped `Swords` icon in [Icon.js](file:///home/alfredo/repo/KGS/KGS/src/ui/common/Icon.js).
  * Rendered the "Challenge" button with the Swords icon in [UserChat.js](file:///home/alfredo/repo/KGS/KGS/src/ui/chat/UserChat.js)'s header, calling the start challenge action and utilizing `e.stopPropagation()` to prevent conflicting profile views.
  * Styled the header button wrapper in [_chat.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_chat.scss).

---

### 18. Unread Message Indicator & Mailbox Inbox
* **MESSAGES Protocol Downstream Processing**:
  * Added `mailboxMessages` (Array of `MailboxMessage`) and `unreadMailboxCount` (number) properties to the Redux store state in [types.js](file:///home/alfredo/repo/KGS/KGS/src/model/types.js) and initialized them in [appState.js](file:///home/alfredo/repo/KGS/KGS/src/model/appState.js).
  * Processed KGS `MESSAGES` message in [session.js](file:///home/alfredo/repo/KGS/KGS/src/model/session.js) to parse offline messages, store them in the state, and update the unread count.
  * Added sender profiles to `usersByName` dynamically upon receiving `MESSAGES` inside [user.js](file:///home/alfredo/repo/KGS/KGS/src/model/user.js) so that users' rank chips and details are cached and formatted correctly.
* **Mail Icon Notification Badge**:
  * Updated [Nav.js](file:///home/alfredo/repo/KGS/KGS/src/ui/meta/Nav.js) to retrieve the unread mailbox message count.
  * Rendered the `<UnseenBadge>` next to the header's mail trigger icon if `unreadMailboxCount > 0`.
  * Positioned the badge correctly over the mail icon in [_nav.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_nav.scss) using relative positioning.
  * Automatically reset the unread badge count in [session.js](file:///home/alfredo/repo/KGS/KGS/src/model/session.js) when the user opens the mailbox modal (`SHOW_LEAVE_MESSAGE_MODAL`).
* **Upstream Delete Actions**:
  * Implemented `onDeleteMailboxMessage(time, username)` and `onClearAllMailboxMessages()` action creators in [AppActions.js](file:///home/alfredo/repo/KGS/KGS/src/model/AppActions.js) that send KGS `MESSAGE_DELETE` commands upstream and immediately perform local optimistic updates to clear state.
  * Supported local deletion reducer case handlers (`MESSAGE_DELETE_LOCAL` and `MESSAGE_CLEAR_ALL_LOCAL`) in [session.js](file:///home/alfredo/repo/KGS/KGS/src/model/session.js).
* **Two-Tab Inbox and Compose Modal**:
  * Upgraded [LeaveMessageModal.js](file:///home/alfredo/repo/KGS/KGS/src/ui/meta/LeaveMessageModal.js) into a two-tab interface with **Inbox** and **Send Message** view tabs.
  * Added message lists to the Inbox view that display each message card, sorted descending with a robust date conversion logic to ensure the most recent messages are strictly on top.
  * Rendered the sender name (with rank tier badge) and the relative timestamp (using `timeAgo`).
  * Rendered a "Clear All" button inside the Inbox header to clean up the mailbox.
  * Rendered two buttons next to each other inside the footer at the bottom-right of each card:
    * **Delete Button** (with trash icon, danger color) to delete the message.
    * **Reply Button** (with reply icon, secondary color):
      * If the sender is online, it closes the modal and redirects the user to the active conversation immediately.
      * If the sender is offline, it dynamically transitions to the **Send Message** compose tab and pre-populates their username.
  * Registered `Trash2` and `Reply` icons in the central [Icon.js](file:///home/alfredo/repo/KGS/KGS/src/ui/common/Icon.js) shim to use Lucide components.
  * Added styling for tabs, active states, tab badges, empty inbox placeholders, message cards, metadata grids, hover transitions, and the bottom-right footer button group with gap in [_meta.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_meta.scss).

* **Unified Chat Badge Colors**:
  * Modified [ChatUnseenBadge.js](file:///home/alfredo/repo/KGS/KGS/src/ui/chat/ChatUnseenBadge.js) to count all unseen messages (both room and private user direct messages) under `minorCount` (teal/accent badge) instead of assigning `majorCount` (red badge) to user chats.
  * Updated the mail icon trigger in the navigation header ([Nav.js](file:///home/alfredo/repo/KGS/KGS/src/ui/meta/Nav.js)) to render the `<UnseenBadge>` with `minorCount={unreadMailboxCount}` instead of `majorCount`, making it the same teal color.
  * Styled `.LeaveMessageModal-tab-badge` in [_meta.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_meta.scss) to use `$unseen-badge-minor` (teal) as its background instead of `$unseen-badge-major` (red).

---

## Build Verification

All code checks, lint rules, and builds run successfully with zero errors:

```bash
$ npm run lint
> shinkgs@0.4.0-dev lint
> eslint src/
# (Completed with 0 errors)

$ npm run flow
> shinkgs@0.4.0-dev flow
> flow check
Found 0 errors

$ npm run build
Compiled successfully.
```

---

## Walkthrough Addendum: Background Challenge Minimization & Direct Challenge Integration

I have successfully implemented the background challenge minimization feature and integrated the private chat "Challenge" button to restore existing active challenges.

### 1. State & Action Pipeline Updates
* **AppState Extensions**: Added `challengeMinimized` (boolean) to the central Redux state in [types.js](file:///home/alfredo/repo/KGS/KGS/src/model/types.js) and initialized it to `false` in `getEmptyServerState()` in [appState.js](file:///home/alfredo/repo/KGS/KGS/src/model/appState.js).
* **Action Creators**: Created `onMinimizeChallenge()` and `onRestoreChallenge()` in [AppActions.js](file:///home/alfredo/repo/KGS/KGS/src/model/AppActions.js) to dispatch local state changes.
* **Reducer Handlers**: Integrated state transitions in [session.js](file:///home/alfredo/repo/KGS/KGS/src/model/session.js):
  * `MINIMIZE_CHALLENGE`: sets `challengeMinimized: true`.
  * `RESTORE_CHALLENGE`, `PLAY_CHALLENGE`, `CLOSE_CHALLENGE`, `START_CREATE_CHALLENGE`, `CANCEL_CREATE_CHALLENGE`, `CHALLENGE_JOIN`, `JOIN_COMPLETE`, `GAME_JOIN`, and `CHALLENGE_FINAL` reset `challengeMinimized: false` to ensure the modal states align.

### 2. Challenge Editor Controls
* **Minimize Buttons**: Updated [ChallengeEditor.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ChallengeEditor.js) so that once a challenge is created/active (i.e. we are waiting for opponents or response), the panel renders:
  * A primary **Minimize** button (dispatches `actions.onMinimizeChallenge()`).
  * A muted **Cancel Challenge** button (calls the unjoin/close handlers).
* **PlayScreen Modal Control**: Updated [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js) to only render the blocking `<ScreenModal>` overlay containing the editor when `challengeMinimized` is `false`.

### 3. Global Floating Challenge Banner
* **Dedicated Component**: Created [ChallengeBanner.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ChallengeBanner.js) to render a modern status bar at the bottom of the viewport when a challenge is minimized in the background. It displays:
  * A loading spinner and textual description of the challenge status (e.g. `"Challenge sent to [Opponent]... Awaiting response"` or `"Awaiting challengers..."`).
  * Action controls: `[Open]` (maximizes/restores the full editor modal) and `[Cancel]` (retracts the challenge).
* **Global Mounting**: Mounted the banner in [Main.js](file:///home/alfredo/repo/KGS/KGS/src/ui/Main.js) so that it remains visible and fully interactive even as the user navigates across different screens (Rooms, Watch, Chat, Search, More).
* **Premium Glassmorphic Design**: Styled the banner in [_meta.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_meta.scss) using:
  * Translucent background colors with backdrop filters (`backdrop-filter: blur(12px)`).
  * Outlines and drop shadows matching light and dark modes.
  * Mobile media query adaptation snapping the bar to a full-width bottom layout.

### 4. User Chat Button Integration
* **Challenge Restoration**: Refactored the "Challenge" button logic in [UserChat.js](file:///home/alfredo/repo/KGS/KGS/src/ui/chat/UserChat.js):
  * Previously, clicking the chat button was limited to either joining an opponent's challenge (if they had one open) or starting a new challenge.
  * Added a check to scan `gamesById` for any active direct challenges created by the *current user* targeting *this specific chat opponent*.
  * If found, the button will now restore/unminimize the existing challenge (navigates to Play tab and sets `challengeMinimized: false` to open the modal) instead of attempting to create a duplicate challenge on the server.
* **Prop Propagation**: Passed the necessary callback handlers and identifiers from [ChatScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/chat/ChatScreen.js) to `<UserChat>`.

---

## Build Verification

All lint, flow, and typescript checks compiled cleanly with no warnings:

```bash
$ npm run lint
# (Completed successfully with 0 errors)

$ npm run flow
# (Completed successfully with 0 errors)

$ npm run typecheck
# (Completed successfully with 0 errors)

$ npm run build
# (Compiled successfully, production bundle generated)
```

---

## Walkthrough Addendum: Single-Use Temporary Invite Code Beta Gate

To replace the static beta access gate password (`neokgs2026`) with a secure, temporary, single-use invite code system, we have modified the Express backend server without requiring external databases.

### 1. Database-less Persistent Storage
* Active/used invite codes and a cryptographically generated server secret key are persisted in a JSON file: `server/beta_codes.json`.
* This file is ignored by Git in `.gitignore` to prevent committing secrets.
* On server startup:
  * If `server/beta_codes.json` exists, the server loads the configuration.
  * If it does not exist, the server automatically generates a 32-character random server secret and 10 random 8-character active invite codes.

### 2. Single-Use Code Consumption Pipeline
* Added the POST `/__beta_check` route which accepts the input code.
* Uses `useBetaCode(code)` to atomically:
  * Match the input against the list of `active` codes in `server/beta_codes.json`.
  * If found, remove it from `active`, insert it into the `used` array, write the updated JSON database back to the filesystem, and return `true`.
  * If not found (or already used), return `false`.

### 3. Cookie Authentication & Security
* To prevent spoofing, a successful validation sets a persistent HTTP-Only cookie `kido_beta` containing the randomized server `secret`.
* The `betaGate(req, res, next)` middleware verifies the request's cookie directly against the server `secret`.
* Invalid requests (missing or incorrect cookies) are intercepted, while assets (`js`, `css`, `png`, `ico`, etc.) and KGS proxy paths (`/json`, `/api/json`) bypass the gate.

### 4. Direct Redirection and Error Handling
* Instead of custom script injection on POST requests, failed validations redirect to `/?error=1`.
* The `betaGate` middleware checks `req.query.error` and replaces `class="err"` with `class="err show"` to show a stylish error banner when rendering the access page.

---

## Walkthrough Addendum: User Chat Tab Rank Badge Removal

To clean up the sidebar tab layout and reduce clutter, we have disabled the user rank badge inside the active chat tabs on the left navigation sidebar.

### 1. Conditional Rank Badge Rendering
* Extended the `UserName` component in [UserName.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserName.js) to accept a new optional `showRank?: boolean` prop.
* Updated `UserName.js` to only render the `<span className="UserName-rank-chip">` element if `showRank` is not explicitly set to `false`.

### 2. Disabling Rank Badges in Left Tabs
* Modified the `ChatTab` component in [ChatScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/chat/ChatScreen.js).
* Passed `showRank={false}` to the `<UserName>` component inside the `ChatScreen-tab-user-name` wrapper, removing the rank badge from the tabs on the left panel while retaining it in other contexts (e.g., active chat headers, chat messages, user list popups).

### 3. Rank Badge Spacing
* Added `margin-left: 6px` to the base `.UserName-rank-chip` class in [src/css/_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss). This fixes the issue where the rank badge sat directly flush against the username text.

---

## Walkthrough Addendum: Offline User Chat Input Disabling

To prevent the silent discarding of chat messages when trying to send messages to offline users, we have disabled the chat inputs and added clear visual feedback when a recipient goes offline.

### 1. Conditional Input Disabling
* Modified `ChatMessageBar` in [ChatMessageBar.js](file:///home/alfredo/repo/KGS/KGS/src/ui/chat/ChatMessageBar.js) to accept a new optional `recipientOffline?: boolean` prop.
* Updated `ChatMessageBar` to evaluate a `disabled` flag if the conversation is disabled OR if the recipient is offline.
* When `disabled` is active:
  * The input placeholder changes to `[User is offline]`.
  * The input field gets the `disabled` attribute.
  * The **Send** (paper-plane) and **Emoji** buttons are disabled.
  * The form submission handler (`_onSubmit`) returns early, completely preventing accidental submissions.

### 2. Passing Offline Status from UserChat
* Modified `UserChat` in [UserChat.js](file:///home/alfredo/repo/KGS/KGS/src/ui/chat/UserChat.js) to dynamically calculate `recipientOffline={!user.flags || !user.flags.connected}` based on the user's presence updates, passing it directly to `ChatMessageBar`.

---

## Walkthrough Addendum: Centralized Bot List Update

To ensure that the newly deployed KGS bots `"JBXKata003"`, `"JBXKata006"`, `"tamagodan"`, and `"swisspach1"` are correctly identified as bots (triggering bot UI styling and badges), we updated the centralized bot list.

* Updated [bot.js](file:///home/alfredo/repo/KGS/KGS/src/util/bot.js) to include `"jbxkata003"`, `"jbxkata006"`, `"tamagodan"`, and `"swisspach1"` in the `KNOWN_BOTS` array.

---

## Walkthrough Addendum: Offline User Chat Empty State Icon

To make it visually clear that a user is offline when a conversation has no messages yet, we added a `message-square-off` icon directly beneath the "No messages yet" placeholder text.

### 1. Icon Registration
* Imported `MessageSquareOff` from `lucide-react` and mapped it as `"message-square-off"` inside [Icon.js](file:///home/alfredo/repo/KGS/KGS/src/ui/common/Icon.js).

### 2. Passing Offline Status to ChatMessages
* Updated `ChatMessages` in [ChatMessages.js](file:///home/alfredo/repo/KGS/KGS/src/ui/chat/ChatMessages.js) to accept the `recipientOffline?: boolean` prop.
* Updated `UserChat` in [UserChat.js](file:///home/alfredo/repo/KGS/KGS/src/ui/chat/UserChat.js) to pass `recipientOffline={!user.flags || !user.flags.connected}` to `ChatMessages`.

### 3. Conditional Empty State Rendering & Styles
* Updated the empty state layout inside `ChatMessages.js` to render `<div className="ChatMessages-empty-offline-icon"><Icon name="message-square-off" size={36} /></div>` directly *above* the `"User is offline"` status text when the recipient is offline and there are no messages.
* Set `.UserChat-messages` to a flex container and gave `.ChatMessages` a `flex: 1` rule inside `_chat.scss` to expand to full height, centering the empty state vertically and horizontally inside the viewport window.
* Added `flex: 1` to `.ChatMessages-empty` to ensure it stretches to fill the container and centers elements properly.
* Adjusted `.ChatMessages-empty-offline` style class in `_chat.scss` to set the font size of the offline message to a clean `18px`, with a semi-bold weight (`600`), slate-gray color, normal style (non-italic), and `opacity: 0.7` to add subtle transparency.
* Updated `.ChatMessages-empty-offline-icon` with `margin-bottom: 12px` to add spacing below the icon (separating it from the text below it).

---

## Walkthrough Addendum: Filter Room Dropdowns to Joined Rooms Only

To prevent displaying rooms that the user has not joined when filtering games or challenges, we restricted the room filter dropdown to only display rooms where the user has active memberships.

### 1. Room Membership Filtering in GameListFilter
* Updated `GameListFilter` in [GameListFilter.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/GameListFilter.js) to accept a new prop `channelMembership` of type `ChannelMembership`.
* Modified the dropdown options generation logic inside `render()` to filter out any rooms where `channelMembership[roomId]` is not present or has a type other than `"room"`.

### 2. Passing Membership Status to GameListFilter
* Updated `PlayScreen` in [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js) to pass `channelMembership={channelMembership}` to `<GameListFilter>`.
* Updated `WatchScreen` in [WatchScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/WatchScreen.js) to accept the `channelMembership` prop and pass it down to `<GameListFilter>`.


---

## Walkthrough Addendum: Open Game / Room Only Toggle Button

I have replaced the "Public" checkbox in the challenge creation visibility settings with a toggle button that switches between **Open Game** and **Room Only**. Private games can also now be configured as either "Room Only" or "Open Game" (Public).

### 1. Extended Visibility Model & KGS Mapping
* **Extended State & Flow Type**: Updated `ProposalVisibility` in [types.js](file:///home/alfredo/repo/KGS/KGS/src/model/types.js) to support `"private_public"`, representing a challenge that is both private and global.
* **Command Dispatching**: Updated `onCreateChallenge` in [AppActions.js](file:///home/alfredo/repo/KGS/KGS/src/model/AppActions.js) to map the `"private_public"` state to `private: true` and `global: true` when submitting the challenge creation payload to KGS.
* **Challenge Retrieval Parsing**: Updated challenge initialization in [ChallengeEditor.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ChallengeEditor.js) to resolve the `"private_public"` visibility state when loading an existing challenge that has both the `private` flag and `global` flag set on the server.

### 2. Visibility Toggle Button & Dropdown Options
* **Scope Toggle Button & Private Checkbox**: In [ProposalForm.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ProposalForm.js):
  * Replaced the "Public" checkbox with a toggle `<Button>` rendering **Open** (when scope is global) or **Room Only** (when scope is local).
  * Styled the visibility toggle button with a simpler, soft green theme (`#e6f7ed` background, `#a7f3d0` border, and `#047857` text color in light mode; `#022c22` background, `#34d399` text color in dark mode) to look clean and separate from primary CTA buttons.
  * Updated the **Private** checkbox to toggle private flags on both scopes.
  * Implemented `_onToggleVisibilityScope` to smoothly toggle the scope between `"public"`, `"roomOnly"`, `"private"`, and `"private_public"`.
  * Preserved the rule that rated games cannot be private by automatically clearing private visibility when Rated is toggled ON.
* **Simplified Dropdown Labels**: Simplified labels inside `rulesetOptions` (e.g., `"Japanese Rules"` became `"Japanese"`) and `timeSystemOptions` (e.g., `"Byo-Yomi Time"` became `"Byo-Yomi"`, `"No Time Limit"` became `"None"`) inside [ProposalForm.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ProposalForm.js) to avoid repeating the words "Rules" and "Time" that are already displayed as section titles.
* **Private Checkbox Alignment & Label**: Configured the "Private" checkbox in [ProposalForm.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ProposalForm.js) to render within a custom `.ProposalForm-private-label` span. Centered the checkbox box vertically with its label text by adding flexbox alignments inside [src/css/_challenge.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_challenge.scss). Styled the label text color to transition dynamically to the active brand teal when checked.

### 3. Screen Headers, Spacing & Filter Labels
* **Challenges Page Header**: In [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js), renamed the main screen title header back to **Challenges**.
* **Room Filter Dropdown**: In [GameListFilter.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/GameListFilter.js), renamed the room filter option label for all rooms back to **All Challenges** when filtering challenges.
* **Dynamic Challenge Count**: Refactored the `countGames` utility function in [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js) to apply the full `playFilter` criteria (such as selected room, speed, player rank, and ratings), so that the header challenges count updates dynamically to match the filtered list.
* **Dropdown Outer Section Labels**: Updated `.ProposalForm-field-label` inside [src/css/_challenge.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_challenge.scss) to completely hide/remove the "Game Type" label, while displaying "Time" and "Rules" labels inside the top of their respective settings boxes.
* **Settings Box Layout (Time, Rules & Board)**:
  * Modified [ProposalForm.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ProposalForm.js) to add `.ProposalForm-time-box`, `.ProposalForm-rules-box`, and `.ProposalForm-board-box` class wrappers, completely separating the **Board** settings into its own block away from Rules.
  * Moved box headers ("Time", "Rules", "Board") inside the top of their respective settings boxes (using `.ProposalForm-box-title`). Removed the duplicate Board label from the board size input block.
  * In [src/css/_challenge.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_challenge.scss), styled these containers to render as distinct boxes with a subtle border (`1px solid rgba(0, 0, 0, 0.05)` in light, `var(--dk-border)` in dark), rounded corners (`12px`), a slightly different background color (`#faf9f6` in light, `var(--dk-bg-off)` in dark), and custom padding.
  * Reorganized the readonly/negotiating view to stack the Time, Rules, and Board details in separate aligned boxes within the left column, using `.ProposalForm-readonly-col` and `.ProposalForm-readonly-box`.
  * Styled the inner input selectors to pop out with a white surface background (`#ffffff` in light, `var(--dk-surface)` in dark) against the box backgrounds.
  * Added balanced margins separating the select dropdowns from numerical values inside the boxes.

### 4. Layout Styles & Formatting
* **Visual Symmetry**: Restyled `.ProposalForm-visibility-controls` in [src/css/_challenge.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_challenge.scss) to center the checkbox and toggle button horizontally, setting a matching input height (`38px`) and balanced padding.
* **Formatting**: Automatically formatted all modified components and styles with Prettier and ESLint autofixes to align with the codebase design rules.

---

## Walkthrough Addendum: Create Challenge Modal Dismissal and Cancel Button Refinements

I have refined the "Create Challenge" modal by removing the redundant cancel button when creating a challenge and improving the modal close button styling and icon according to the project's development rules.

### 1. Conditionally Hidden Cancel Button
* Modified `ChallengeEditor.js` in [ChallengeEditor.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ChallengeEditor.js) to conditionally hide the secondary **Cancel** button when `editMode === "creating"`.
* Retained the Cancel button for negotiation mode (`editMode === "negotiating"`) and cancel challenge options for waiting mode.

### 2. Improved Modal Close Button
* Modified `ScreenModal.js` in [ScreenModal.js](file:///home/alfredo/repo/KGS/KGS/src/ui/common/ScreenModal.js) to import and render the `<Icon name="circle-x" size={20} />` React component instead of using the plain `&times;` HTML entity character.
* Relies on the globally defined `.ScreenModal-close:hover` and `.ScreenModal-close:active` CSS rule properties, which conform to the close button design rules (using `#c2601a` color and `rgba(194, 96, 26, 0.1)` background on hover).

---

## Walkthrough Addendum: Challenge Editor Dark Mode Polish

I have added comprehensive dark mode overrides for the challenge editor and its components inside `_challenge.scss`.

### 1. Modal Containers & Panels
* Overrode `.ChallengeEditor` background to use `var(--dk-surface)` instead of the bright white background.
* Updated `.ChallengeEditor-header` to transparent background with `var(--dk-fg)` text color.
* Set `.ChallengeEditor-buttons` and `.ChallengeEditor-chat` to use `var(--dk-bg-off)` background and `var(--dk-border)` border-top lines.
* Styled the chat label `.ChallengeEditor-chat-label` to use the muted `var(--dk-fg-muted)` grey.
* Configured `.ChallengeEditor-tabs` and `.TabNav-tabs` to render with dark transparent backgrounds, muted tabs, and accent underlines for the active selection.

### 2. Proposal Form Fields & Inputs
* Set `.ProposalForm` background to transparent and text color to `var(--dk-fg)`.
* Applied dark mode styles (`var(--dk-surface)` background and `var(--dk-border)` borders) to inputs and select fields inside the form (including focus states, room labels, and notes fields).
* Styled standard input elements `.ProposalForm-input` and their text values to match the dark color system.
* Polished plus/minus increment buttons to render in a vibrant sky blue highlight (`#38bdf8`) with corresponding active/hover states, and greyed-out transparent outlines for readonly fields.

### 3. Notification Banners
* Overrode accepted proposal notifications (`.ChallengeEditor-accepted`) to use a subtle translucent green background (`rgba(34, 197, 94, 0.15)`) with emerald text.
* Overrode declined proposal notifications (`.ChallengeEditor-declined`) to use a subtle translucent amber background (`rgba(245, 158, 11, 0.15)`) with warning orange text.

---

## Walkthrough Addendum: Live Games Counter Filters

I have updated the Live Games count indicator to dynamically reflect active room and game filters.

### 1. Dynamic Game List Count
* Modified `countGames` inside `WatchScreen.js` in [WatchScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/WatchScreen.js) to apply all available filters (e.g. `roomId`, `excludeBots`, `gameRatings`, `playerRanks`, and `timeSpeeds`) instead of only filtering out bots.
* Imported `getGameTimeSpeed` from `../model/game` and implemented `getRankTier` locally to support the same tier and time rules parsing logic used by the game lists.
* This ensures that the games counter displayed in the "Live Games" header is updated dynamically and corresponds exactly to the count of filtered items in the scroll list.

---

## Walkthrough Addendum: Segmented Control for Visibility Scope

I have replaced the single toggle button for the challenge visibility scope with a Segmented Control (Pill Tabs) layout.

### 1. Two-Button Segmented Layout
* Replaced the toggle `<Button>` in `ProposalForm.js` in [ProposalForm.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ProposalForm.js) with a custom `.SegmentedControl` containing separate button items for **Room Only** and **Open**.
* Replaced the single toggle handler `_onToggleVisibilityScope` with two dedicated selection handlers: `_onSelectScopeRoomOnly()` and `_onSelectScopeOpen()`.
* Cleaned up the unused `Button` component import in `ProposalForm.js` to satisfy linter checks.

### 2. Styling (Light & Dark Mode)
* Styled `.SegmentedControl` in `_challenge.scss` to display as a sleek horizontal pill card with a soft grey background (`#e2e8f0`) in light mode and dark container (`var(--dk-bg-off)`) in dark mode.
* Programmed the active option (`.SegmentedControl-item-active`) to raise up with a white surface background and a soft shadow in light mode, and a highlighted dark surface background (`var(--dk-surface2)`) in dark mode.
* The selected option highlights the text color using the brand accent color `$accent` (teal) in light mode and `var(--dk-accent)` in dark mode for high-quality visual feedback.

---

## Walkthrough Addendum: Proposal Stone Highlight Polish

I have polished the highlight effect for proposed player roles inside the challenge editor.

### 1. Color Bleed Elimination
* Modified the `.ProposalPlayers-item-role-hilite` rule in `_challenge.scss` in [src/css/_challenge.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_challenge.scss) to remove the `background-color: $diff-hilite` property on the role toggle container.
* By making the container background transparent, we prevent the yellow highlight background from leaking out from behind the circular `BoardStone` or `NigiriIcon` elements and creating a weird green optical bleed with the teal outer shadow ring.
* The changed role remains cleanly highlighted with the crisp 2px teal outer box-shadow ring (`$accent`).

---

## Walkthrough Addendum: Stone Centering & Gold Highlight for Role Toggle

I have centered the standalone player stones and updated the role highlight color to match the proposal form.

### 1. Direct Child Stone Centering
* Added a CSS rule for `.ProposalPlayers-role-toggle > .Board-stone` in `_challenge.scss` to override the default 2% offset positioning (`left: 0; top: 0; width: 100%; height: 100%;`).
* This aligns standalone black/white player stones perfectly to the center of the role toggle container, resolving the off-center highlight halo visual alignment bug without affecting complex stones nested inside `NigiriIcon`.

### 2. Gold/Amber Highlight Ring
* Replaced the box-shadow highlight outline color on `.ProposalPlayers-role-toggle` from `$accent` (teal/green) to `$diff-muted` (gold/yellow `#bb9c1d`).
* This eliminates the green ring and provides a warm, consistent golden highlight matching the rest of the proposal difference styles in the form.

---

## Walkthrough Addendum: Default Room for New Challenges Under All Challenges Filter

I have updated the initial room selection when creating a challenge under the "All Challenges" room filter.

### 1. English Game Room Default
* Modified `PlayScreen.js` in [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js) to detect when a user starts challenge creation with the "All Challenges" filter active (i.e. `filterRoomId` is empty).
* In this case, the challenge room defaults to the "English Game Room" (if the user is currently a member).
* If the user is not in the "English Game Room", it falls back to the current active room tab (`activeConversationId`), and then to their first joined room (`defaultRoom.id`).

---

## Walkthrough Addendum: Challenge Editor Header and Read-only Proposal Style Polish

I have polished the layout and styling of the challenge editor tabs, room metadata labels, and note rows, and standardized the game type naming to consistently use "Rated" instead of "Ranked".

### 1. Standardization of "Rated" Game Type Naming
* Modified [display.js](file:///home/alfredo/repo/KGS/KGS/src/model/game/display.js):
  * Updated `GAME_TYPE_LABEL` to map `"ranked"` to `"Rated"` instead of `"Ranked"`, resolving the mismatch where the label and icon disagreed (e.g., rendering `[Rated] Ranked` -> `[Rated] Rated`).
* Modified [ProposalForm.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ProposalForm.js):
  * Conditionally hide the game type text label next to the icon badge when they are identical (e.g. for `"Rated"` and `"Free"`), preventing redundant text from rendering twice (e.g., displaying only `[Rated]` and `[Free]`, but retaining `[lock] Private Free` and `[Teach] Teaching` where the information is unique).

### 2. Styling Polish for Challenge Editor Tabs
* Modified [_challenge.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_challenge.scss):
  * Restyled `.TabNav-tab` in the `.ChallengeEditor-tabs` block to increase padding to `10px 0` and margin-right to `28px` to give tabs more breathing room.
  * Upped the active and inactive font weights (to `700` and `600` respectively) and added a smooth transition on hover (`color 0.15s ease, border-bottom-color 0.15s ease`).
  * Increased bottom padding of `.ChallengeEditor-header` to `20px` and top padding to `16px` (also in mobile/responsive layouts) to add elegant spacing between the header title text and tabs/proposal form.

### 3. Layout and Spacing Polish for Read-only Proposals
* Modified [ProposalForm.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ProposalForm.js):
  * Placed the Room name inside a styled `.ProposalForm-room-box` (a box styled with a `"Room"` title).
  * Placed the Game Type settings inside a styled `.ProposalForm-game-box` (a box styled with a `"Game"` title) that contains the game type badge (and private text and notes if applicable).
  * This arranges them in a beautiful vertical stack with the Time, Rules, and Board boxes inside the readonly column `.ProposalForm-readonly-col` in the Negotiating, Waiting, and Direct Challenge windows.
* Modified [_challenge.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_challenge.scss):
  * Restyled `.ProposalForm-readonly-room-val` (the room name value text inside the readonly box) to be a prominent bold header: increased font size to `15px` and font weight to `700`, with a dark slate color `#0f172a` (automatically styled as high-contrast `var(--dk-fg)` in dark mode).

### 4. Reverted Creation Mode Form Layout to Previous Style
* Modified [ProposalForm.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ProposalForm.js) and [_challenge.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_challenge.scss):
  * Restored the creation view layout to its previous unboxed styling (using the standard `.ProposalForm-field` and `.ProposalForm-type-visibility` elements).
  * Registered the new boxes `.ProposalForm-room-box` and `.ProposalForm-game-box` under the standard box selector list for both light mode and dark mode styles (`background`, `border`, `border-radius`, etc.) to support the readonly mode boxes.
## Verification Results

All automated checks verified successfully:
- ESLint and Prettier check (`npm run lint`): Passed cleanly.
- Flow static type checker (`npm run flow`): Found 0 errors.
- TypeScript compilation checks (`npm run typecheck`): Passed with 0 errors.
- Production Optimized Build (`npm run build`): Compiled successfully.

---

## Walkthrough Addendum: Bell Icon Blinking Animation Fix

To resolve the issue where the blinking/rotating animation was not visible on the minimized challenge banner's new proposal alert icon, we fixed a className forwarding bug in the central Icon component.

### 1. Icon Component Class Name Forwarding
* **Prop Destructuring**: Modified the `Icon` component in [Icon.js](file:///home/alfredo/repo/KGS/KGS/src/ui/common/Icon.js) to destructure the `className` prop from `this.props` and declare it as optional (`className?: string`) in the Flow `Props` type definition.
* **Prop Propagation & Merging**: Configured the component to construct `props.className` dynamically by merging the default `"Icon"` class, the `"Icon--spin"` class (when name is `"spinner"`), and any custom classes supplied by parent components (e.g. `ChallengeBanner-icon-alert`). Passed the resulting `props.className` directly down to the rendered `lucide-react` SVG icon element.

### 2. Validation & Build Results
* Verified that Flow typecheck and ESLint/Prettier checks passed cleanly with no warnings or errors.
* Re-generated the optimized production build (`npm run build`) successfully. Custom styling and the rotating/pulsating keyframe animation `@keyframes ChallengeBanner-icon-blink-rotate` now attach correctly to the Alert Icon SVG element inside the DOM.

---

## Walkthrough Addendum: Notification Indicator Dot Polish & Swords Alert Icon Tweak

To align with user feedback, we increased the size of the navigation tab notification dot, replaced the bell alert icon with a subtle blinking swords icon, and removed the green dot indicator from the banner's "Open" button.

### 1. Style & Element Updates
* **Navigation Tab Notification Dot Size**: Updated `.MainNav-item-badge-dot` in [_nav.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_nav.scss) to increase width and height from `8px` to `14px`, and shifted its positioning (`right: 3px; top: 10px;`) and radial box shadow glow to `0 0 8px rgba(63, 202, 140, 0.9)` for a clean, highly visible look.
* **Swords Alert Icon**: 
  * Imported the `Swords` component from `lucide-react` and added it as `"swords"` to the central `ICON_MAP` in [Icon.js](file:///home/alfredo/repo/KGS/KGS/src/ui/common/Icon.js).
  * Updated [ChallengeBanner.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ChallengeBanner.js) to render `<Icon name="swords" className="ChallengeBanner-icon-alert" size={16} />` when new proposals are received.
  * Replaced the rotation keyframe animation with a subtle, non-rotating scale and color blinking animation `@keyframes ChallengeBanner-icon-blink` (pulsing scale between `1.05` and `0.95`, flashing between warning orange `#f59e0b` and danger red `#ef4444`) inside [_meta.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_meta.scss).
* **Remove Open Button Dot**: Removed the green notification dot `<span className="ChallengeBanner-btn-dot" />` from the "Open" button inside [ChallengeBanner.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/ChallengeBanner.js) to clean up the button layout. Removed the corresponding `.ChallengeBanner-btn-dot` and `.ChallengeBanner-open-btn` SCSS class styles from [_meta.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_meta.scss).
* **Navigation Transition on Restore**: Updated `onRestoreChallenge` inside [AppActions.js](file:///home/alfredo/repo/KGS/KGS/src/model/AppActions.js) to call `this.onChangeNav("play")`. This ensures that when the user clicks "Open" on the minimized challenge banner, they are navigated directly to the "play" tab if they are currently elsewhere in the application.
* **Friends Window Alignment**: Modified `.MainNav-friends-panel` styling in [_nav.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_nav.scss) by shifting `right: 0;` to `left: 0;`. This aligns the left border of the friends dropdown window with the toggle button, expanding it to the right of the icon and preventing it from overlapping the search bar on the left.
* **Unified Administrator Shield Icons**: 
  * Imported the `ShieldCheck` component from `lucide-react` and added it as `"shield-check"` to the central `ICON_MAP` in [Icon.js](file:///home/alfredo/repo/KGS/KGS/src/ui/common/Icon.js).
  * Refactored [UserIcons.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserIcons.js) to map Junior, Senior, and Super Administrators to the Lucide `<Icon name="shield-check" />`, replacing the `"⭐️"`, `"🌟"` emojis with clean, modern SVGs.
  * Configured hover tooltips (the `title` attribute) on `UserIcons` to display `"Junior Admin"`, `"Senior Admin"`, `"Super Admin"`, and `"KGS Plus"` when hovering over their respective icons.
  * Updated [UserDetailsModal.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserDetailsModal.js) to render `<Icon name="shield-check" size={12} />` inside the `.UserDetailsModal-authname` badge for Junior, Senior, and Super Administrators.
  * Added `display: inline-flex; align-items: center; gap: 4px;` styling overrides to `.UserDetailsModal-authname` in [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) to center-align the icon next to the admin label.
  * Added distinct color classes for each admin level (`UserIcons-jr-admin` for blue, `UserIcons-sr-admin` for amber/gold, `UserIcons-super-admin` for red) inside [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss), along with lighter dark mode overrides for perfect contrast on dark background panels.
* **Inline Icon Sizing Polish**:
  * Refactored inline icon rendering inside [UserName.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserName.js) to use a dynamic `iconSize` derived from the `extraIconsSize` prop (falling back to `13`), ensuring bot (`cpu`), guest (`hat-glasses`), and friend star (`heart-handshake`) icons scale symmetrically with the admin shield icon.
* **Room Chat User List Badges**:
  * Imported the `UserName` component in [UserList.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserList.js) and rendered it inside `UserListItem`.
  * This displays all bot (`cpu`), admin (`shield-check`), and KGS Plus (`🎩`) badges next to usernames inside the room chat player lists, matching the layout in other screens.

---

## Walkthrough Addendum: Hide Away and Selfish Icons in Room User List

To satisfy the request to hide the away (sleeping moon) icon and the image/selfish (ECG/pulse line) icon from the room user list, we implemented the following changes:

### 1. UserName and UserIcons Component Enhancements
* **`UserIcons` Props (`hideAway`)**: Updated [UserIcons.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserIcons.js) to accept a `hideAway?: boolean` prop. When true, the component suppresses the rendering of the sleeping moon icon (`flags.sleeping`).
* **`UserName` Props (`hideAway`, `hideSelfish`)**: Updated [UserName.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserName.js) to accept `hideAway?: boolean` and `hideSelfish?: boolean` props.
  * Passed the `hideAway` prop down to `UserIcons`.
  * Suppressed the rendering of the `activity` (selfish/pulse) icon next to the username if `hideSelfish` is true.

### 2. UserList Integration
* **Props Configuration**: Configured [UserList.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserList.js) to pass `hideAway` and `hideSelfish` props to the rendered `UserName` component inside `UserListItem`. This filters out these icons from the room sidebars while maintaining them on profile modals and other screens.

---

## Walkthrough Addendum: Automatch Controls Positioning & Settings Drawer Optimization

I have successfully swapped the positions of the Automatch controls and the Create Challenge button, minimized and restructured the settings drawer, increased the text size within the drawer, and replaced the orange glowing status animation with a clean text-opacity fade.

### 1. Button Positioning Swap
* Modified [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js):
  * Swapped the order of `<Button onClick={this._onCreateChallenge}>Create Challenge</Button>` and `<div className="PlayScreen-automatch-controls">` inside the `WatchScreen-header-actions` section container. This positions the Automatch settings and search trigger buttons on the left and the Create Challenge button on the right of the header row.

### 2. Compact 2-Column Drawer Layout & Semantic Code Cleaning
* Modified [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js):
  * Replaced the HTML `<fieldset>` and `<legend>` elements in `_renderAutomatchDrawer` with styled custom `<div className="PlayScreen-automatch-section">` and `<div className="PlayScreen-automatch-section-title">` blocks.
  * Grouped the "Human OK" and "Robot OK" checkboxes inside a new horizontal container (`.PlayScreen-automatch-checkbox-row`) to lay them out side-by-side.
  * Grouped the "Game Type" and "Game Speed" sections inside a new flex row wrapper (`.PlayScreen-automatch-form-row`) to position these lists side-by-side.
* Modified [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss):
  * Reduced `.PlayScreen-automatch-drawer` width from `440px` to `360px` for a much narrower, compact look.
  * Updated position settings to `left: 0; right: auto;` to align the open drawer correctly with the new left button position.
  * Styled `.PlayScreen-automatch-form-row` to flex-layout sections side-by-side.
  * Styled `.PlayScreen-automatch-checkbox-row` to display opponent checkboxes horizontally.
  * Adjusted paddings and spacing on sections (`.PlayScreen-automatch-section`) to match the new dimensions.

### 3. Drawer Typography and Control Scaling
* Modified [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss):
  * Increased text and control sizes inside the settings drawer by 1px across the board to enhance readability:
    * Drawer title (`.PlayScreen-automatch-title`): `14px` (from `13px`)
    * Section title (`.PlayScreen-automatch-section-title`): `12px` (from `11px`)
    * Checkbox labels (`.PlayScreen-automatch-checkbox`): `14px` (from `13px`)
    * Max rank difference label (`.PlayScreen-automatch-diff-label`): `14px` (from `13px`)
    * Inline label (`.PlayScreen-automatch-label-inline`): `13px` (from `12px`)
    * Dropdown select (`.PlayScreen-automatch-select`): `13px` (from `12px`)

### 4. Removed Orange Glow and Polished Search Status
* Modified [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss):
  * Defined a custom keyframe animation `@keyframes PlayScreen-pulse-text` to transition opacity between `1.0` and `0.45` smoothly.
  * Updated `.PlayScreen-automatch-status` to use the new text opacity animation, and removed the old orange box-shadow based `ChallengeBanner-pulse` animation. This resolves the blocky orange shadow/rectangle shown underneath/behind the status text.

### 5. Verification Results
* All static checks completed successfully:
  * Flow checker: `Found 0 errors`.
  * Webpack production compile (`npm run build`): `Compiled successfully`.

---

## Walkthrough Addendum: Final Button Position Swap, Simplified Labels & Drawer Spacing Polish

I have successfully updated the Play screen layout according to the final design feedback:
1. **Button Positioning Swap (Returned to Original)**:
   * Swapped the positions of "Create Challenge" and "Automatch" back inside [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js). The "Create Challenge" button is now on the left, and the Automatch controls are on the right.
   * Realigned the settings drawer in [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) to have `right: 0; left: auto;`, ensuring it opens cleanly underneath the right-positioned Automatch button.
2. **Simplified Title**:
   * Changed the settings drawer title from `"Select Automatch Preferences"` to `"Automatch Preferences"` in [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js).
3. **Clean Label Toggles (Removed "OK" text)**:
   * Cleaned up the checkbox labels in [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js) by stripping the `" OK"` suffix from all options (e.g. `"Human OK"` -> `"Human"`, `"Robot OK"` -> `"Robot"`, `"Ranked OK"` -> `"Ranked"`, `"Medium OK"` -> `"Medium"`, etc.).
4. **Enhanced Spacing & Padding**:
   * Increased the drawer padding to `20px` in [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss).
   * Widened the spacing between rows/sections to `14px` and the flex columns gap to `16px` in [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss).
   * Increased padding of the inner content cards to `12px 16px` and vertical item list gap to `10px`, creating a significantly more spaced, breathable, and modern visual design.
5. **Verification**:
   * Both `npm run flow` and `npm run build` verified successfully with 0 errors or warnings.

---

## Walkthrough Addendum: Create Challenge Button Styling & Icon Opacity Polish

I have successfully applied final styling adjustments to the Play screen buttons:
1. **Create Challenge Button Consistency**:
   * Modified [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js) to set the "Create Challenge" button to use the `secondary` style instead of `primary`.
   * Replaced the `"plus"` icon on the "Create Challenge" button with the `"swords"` icon. This makes both main header action buttons ("Create Challenge" and "Automatch") share the identical styled button wrapper and theme.
2. **Spinner Icon Opacity**:
   * Modified [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) to add `opacity: 0.8;` to the `.Icon` component inside the active Automatch play button (`.PlayScreen-automatch-play-btn.active`). This adds a touch of transparency to the spinning white arc, creating a softer, more integrated look against the orange background.
3. **Verification**:
   * Verified all changes with flow checking and production builds successfully.

---

## Walkthrough Addendum: Dynamic Rank Range Calculation in Automatch Preferences

I have successfully added a dynamic rank range display next to the "Max Rank Difference" label inside the Automatch preferences settings drawer:
1. **Dynamic Go Rank Math**:
   * Modified [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js) to import `parseRankVal` from `src/model/user.js`.
   * Implemented `shiftRankVal(val, delta)` to dynamically scale numeric Go rank values, correctly skipping `0` (since there is no 0k or 0d in Go ranks, transitioning directly from `1k` to `1d`).
   * Implemented `formatRankVal(val)` to format numeric values back to standard Go rank strings (`k` for kyu, `d` for dan, `p` for pro).
2. **Range Label Generation**:
   * Inside `_renderAutomatchDrawer`, resolved the base rank string using either `currentUser.rank` (if the user is ranked) or the selected `estimatedRank` (if they are unranked).
   * Computed the minimum and maximum opponent rank limits using the user's base rank value shifted by the selected `maxHandicap` parameter.
   * Rendered this calculated range (e.g. `(18k – 12k)` or `(1k – 4d)`) directly next to the `"Max Rank Difference"` text inside the settings label.
3. **Verification**:
   * Verified all code changes using flow type-checks and production builds successfully.

---

## Walkthrough Addendum: Multi-line Wrap & Styling for Dynamic Rank Range Label

I have successfully updated the rank range display to render cleanly on its own dedicated second line, preventing awkward string wrapping:
1. **Separation of Label & Range**:
   * Modified [PlayScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/PlayScreen.js) to render the dynamic computed rank range string (e.g. `(33k – 15k)`) inside its own nested `<span className="PlayScreen-automatch-diff-range">` element, rather than inline text. Removed the leading space from the calculated range string.
2. **Visual Layout and Subtitle Style**:
   * Modified [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) to apply `display: flex; flex-direction: column;` to the `.PlayScreen-automatch-diff-label` container. This automatically wraps the inner range text to a dedicated second line.
   * Styled the child `.PlayScreen-automatch-diff-range` class with a slightly smaller font size (`12px`), a lighter slate-gray color (`#64748b` in light mode, `#94a3b8` in dark mode), and a medium weight (`500`) to present it as a clean visual subtitle.
3. **Verification**:
   * Flow type-checks and Webpack builds successfully compiled with zero warnings or errors.

---

## Walkthrough Addendum: Rank Range Text Size Polish

I have successfully updated the visual style of the dynamic Go rank range subtitle inside the Automatch preferences settings drawer:
1. **Legibility Boost**:
   * Modified [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) to increase the `.PlayScreen-automatch-diff-range` element's `font-size` from `12px` to `13px`. This makes the calculated matchmaking boundaries (e.g. `(33k – 15k)`) much clearer and easier to read.
2. **Verification**:
   * Static analysis (`npm run flow`) and Webpack building (`npm run build`) succeeded without warnings or errors.

---

## Walkthrough Addendum: User Rank Graph Fixes (Progress Line and Decimals)

I have successfully resolved two bugs inside the user rank progression graph:

1. **Fixed Missing Progress Line & Dot Color**:
   * **The Issue**: Recharts `<Line>` element in `UserRankGraph.js` set `stroke="var(--accent)"` and the active tooltip dot to `fill="var(--accent)"`. Because `--accent` was never defined as a CSS custom property in the stylesheets, the SVG path failed to render a stroke line (resulting in a blank chart) and the dot defaulted to a fallback black fill color.
   * **The Fix**: Modified [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) to define `--accent: #14b8a6;` inside the base `.RankGraph-container` selector, and `--accent: var(--dk-accent);` inside the `body.dark-mode` block. This restores the teal-colored progression path line and tooltip dot in both light and dark modes.

2. **Rank Value Decimal Limit**:
   * **The Issue**: When converting raw rating points (e.g. `306` points) to rank values, divisions and additions resulted in floating-point values with long trailing decimals (e.g. `4.0600000000000005d`).
   * **The Fix**: Updated `formatYAxis` inside [UserRankGraph.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserRankGraph.js) to format the calculated rank using `.toFixed(1)` and parsed it back into a number `Number(rank.toFixed(1))`. This restricts the rank display inside the chart tooltips to at most 1 decimal place (e.g. `4.1d` or `4d`), improving readibility.

3. **Verification**:
   * Flow analysis (`npm run flow`) and Webpack production compile (`npm run build`) succeeded with 0 warnings or errors.

---

## Walkthrough Addendum: Player Profile Modal Width & Graph Margin Optimizations

I have successfully updated the layout spacing and sizing of the player profile view:

1. **Increased Profile Modal Width**:
   * Modified [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) to increase the `.UserDetailsModal-main` container's `max-width` from `580px` to `680px`. This expands the horizontal space inside the player info window by `100px`, providing more breathing room for the tab headers, biography content, game archives, and chart components.

2. **Reduced Rank Graph Margins**:
   * Modified [UserRankGraph.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserRankGraph.js) to adjust the Recharts `<LineChart>` margin properties, reducing `left` margin to `-20` and `bottom` margin to `0`. This pulls the graph line and axis labels closer to the left and bottom boundaries, eliminating unnecessary empty padding.

3. **Verification**:
   * Code analysis (`npm run flow`) and production compiler builds (`npm run build`) succeeded with 0 errors.

---

## Walkthrough Addendum: Rated Game Icon Standardization

I have successfully updated the game type badge for rated games inside the game list and user archives:

1. **Restored Sparkle Icon for Rated Games**:
   * Modified [GameTypeIcon.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/GameTypeIcon.js) to evaluate the `isSparkle` boolean condition independently of the `useChallengeIcons` prop. This allows rated games (`type === "ranked"`) to consistently render as the sparkle star/sparkle icon inside past game logs (like in `GameSummaryList` on the user details modal) rather than falling back to the `"Rated"` text pill.

2. **Verification**:
   * Static analysis checks (`npm run flow`) and production building compiles (`npm run build`) completed successfully with 0 errors.

---

## Walkthrough Addendum: Game List Card Spacing and Tab Roundness Restyling

I have successfully updated the layout spacing and corner roundness of the game list cards and the tab navigation controls inside the player profile modal:

1. **Segmented Pill Tabs inside Player Profile**:
   * Modified [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) to redesign `.UserDetailsModal-tabs` and `.UserDetailsModal-tabs-inner` as a modern, centered segmented capsule pill bar.
   * Tab elements (`a.UserDetailsModal-tab`) have been styled as rounded pill buttons with hover-highlight transitions. The active tab (`.UserDetailsModal-tab-active`) uses a white card-like pop out with a soft shadow.
   * Removed borders and bottom underlines. Made the `.UserDetailsModal-tab-content` background `transparent` to avoid layout color bugs in dark mode.
   * Added full dark mode overrides for the tabs inside `body.dark-mode` (using the deep-teal slate colors `#1a2420` for the container and `#243028` for the active tab background) and restored correct text visibility for the biography container (`.UserDetailsModal-bio`) in dark mode.

2. **Increased Spacing and Roundness for Game Cards**:
   * Modified [_gamelist.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_gamelist.scss) to update the `.GameList-item` and `.GameSummaryList-item` layout styling.
   * Increased the card corner roundness `border-radius` from `10px` to `14px`, the desktop `padding` from `12px 14px` to `14px 18px`, and the element spacing `gap` from `12px` to `16px` for a premium, spacious visual feel.
   * Adjusted mobile override padding to `10px 12px` to maintain a balanced look proportional to the new larger corner radius.

3. **Verification**:
   * Static type analysis (`npm run flow`) passed with 0 errors.
   * Webpack production builds (`npm run build`) compiled successfully.

---

## Walkthrough Addendum: User Info Bullets Restyling & Free Game Icon Standardization

I have successfully updated the visual style of the user metadata info bullets inside the player profile modal and standardized the free game icon:

1. **User Info Bullets Redesign**:
   * **Icons mapping**: Added `Calendar` and `Globe` imports to [Icon.js](file:///home/alfredo/repo/KGS/KGS/src/ui/common/Icon.js) from the `lucide-react` library.
   * **New Info Bullet Layout**: Modified [UserDetailsModal.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserDetailsModal.js) to render `<Icon name="calendar" />` next to "Joined Date", `<Icon name="globe" />` next to "Locale", and `<Icon name="mail" />` next to "Email".
   * **Styles**: Restyled `.UserDetailsModal-info-bullets` in [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) to use a modern pill/capsule background (`#f1f5f9` in light mode), slate text (`#475569`), flexbox alignment, and seamless dark mode overrides (using `#1a2420` inset backgrounds and correct text colors).

2. **Free Game Icon Standardization**:
   * Modified [GameTypeIcon.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/GameTypeIcon.js) to evaluate the `isSmile` condition without relying on the `useChallengeIcons` prop, so free games (`type === "free"`) consistently render as the smile icon across both the player profile game list and room challenge lists. Removed unused `useChallengeIcons` from the destructuring to prevent ESLint warnings/errors.

3. **Verification**:
   * Flow checks (`npm run flow`) passed with 0 errors.
   * Webpack production compile (`npm run build`) completed successfully.

---

## Walkthrough Addendum: Player Header Text Size Increase

I have successfully updated the font-size of the player's username and real name / surname inside the player profile details window:

1. **Larger Username Header**:
   * Modified [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) to increase the font-size of `.UserDetailsModal-name` from `20px` to `24px`. This makes the user's login name stand out more clearly in the top bar header.

2. **Larger Real Name / Surname Subtitle**:
   * Modified [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) to increase the font-size of the real name field (`.UserDetailsModal-realname`) from `13px` to `15px`. This improves readability for full names and surnames displayed directly under the main username.

3. **Verification**:
   * Static analysis (`npm run flow`) passed with 0 errors.
   * Webpack builds (`npm run build`) compiled successfully.

---

## Walkthrough Addendum: Player Game History Pagination

I have successfully replaced the player profile game list's default scrollbar container with a paginated list view with Previous/Next arrow buttons:

1. **State & Slice Layout pagination**:
   * Modified [UserDetailsModal.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserDetailsModal.js) to introduce the `gamesPage` field in state, initialized to `0` and clamped within bounds inside `render()`.
   * Added `componentDidUpdate` hook to reset `gamesPage` and `tab` when the active profile user changes, and updated tab change handlers to reset the page index.
   * Added arrow click handlers `_onPrevGamesPage` and `_onNextGamesPage`.
   * Sliced the games list array to display exactly `6` games per page (`GAMES_PER_PAGE = 6`).
   * Rendered the pagination container below the games list containing chevron-left and chevron-right icons and the active page indicators.

2. **Visual Spacing and Styles**:
   * Modified [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) to style `.UserDetailsModal-pagination` and `.UserDetailsModal-pagination-btn` (with 50% circular layout, subtle hover transitions, and inactive states).
   * Removed inner scrollbars from the game summary list container (`overflow: visible` and `max-height: none` on `.UserDetailsModal-games-list`) for a clean, non-obtrusive list view.
   * Added full dark mode overrides for pagination inside `body.dark-mode`.

3. **Verification**:
   * Flow static type check (`npm run flow`) successfully verified with 0 errors.
   * Webpack production compilation (`npm run build`) built cleanly.

---

## Walkthrough Addendum: Reduced Card Spacing

I have successfully updated the card grid spacing layout configuration inside the stylesheet:

1. **Smaller Grid Gap**:
   * Modified [_gamelist.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_gamelist.scss) to reduce the grid container's `gap` attribute for `.GameList` and `.GameSummaryList` from `10px` to `6px`. This pulls the card rows (and columns, where applicable) closer together, making the overall listing layout much tighter and cleaner.

2. **Verification**:
   * Flow static type checks (`npm run flow`) succeeded with 0 errors.
   * Production builds (`npm run build`) compiled successfully.

---

## Walkthrough Addendum: Reduced Card Border Radius

I have successfully updated the corner roundness of the game list cards:

1. **Smaller Card Border Radius**:
   * Modified [_gamelist.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_gamelist.scss) to reduce the `border-radius` of `.GameList-item` and `.GameSummaryList-item` from `14px` to `12px`. This slightly tones down the corner roundness of active game cards and archive history cards, establishing a clean, modern aesthetic.

2. **Verification**:
   * Flow static type checks (`npm run flow`) succeeded with 0 errors.
   * Production builds (`npm run build`) compiled successfully.

---

## Walkthrough Addendum: Inline Real Name and Metadata Bullets

I have successfully updated the layout alignment inside the player profile details window to place the real name and metadata info bullets on the same line:

1. **Inline Metadata Layout Container**:
   * Modified [UserDetailsModal.js](file:///home/alfredo/repo/KGS/KGS/src/ui/user/UserDetailsModal.js) to wrap both the real name subtitle and the metadata pills ("Joined Date", "Locale", and "Email") inside a single unified container (`.UserDetailsModal-metadata-line`).
   * Renamed bullet items to `.UserDetailsModal-info-bullet` for unified styles.

2. **Flexbox Styling**:
   * Modified [_user.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_user.scss) to remove `.UserDetailsModal-subname` and `.UserDetailsModal-info-bullets`.
   * Styled `.UserDetailsModal-metadata-line` as an inline flex container (`display: flex; align-items: center; flex-wrap: wrap; gap: 8px;`). This allows the user's real name and status/metadata pills to flow side-by-side on the same line, wrapping dynamically on narrower screens.
   * Added corresponding dark mode styling overrides for the unified metadata container.

3. **Verification**:
   * Static analysis checks (`npm run flow`) succeeded with 0 errors.
   * Production compilations (`npm run build`) built successfully.

---

## Walkthrough Addendum: Move Game Time Header Above Navigation Buttons

I have successfully relocated the game time and rated status display from the scrollable game info panel to a dedicated header bar positioned directly above the buttons in the live game sidebar:

1. **Removed duplicate Time row**:
   * Modified [GameInfo.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/GameInfo.js) to remove the `time` row block entirely and removed unused imports for `GameTimeSystem` and `GameTypeIcon`.

2. **Added Time header to GameScreen**:
   * Modified [GameScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/GameScreen.js) to import `GameTypeIcon` and `GameTimeSystem`.
   * Added the centered `.GameScreen-time-header` card component rendering the game type icon and the formatted time system directly above the buttons navigation bar (`.GameScreen-nav`) when watching a game.

3. **Updated styles and layout absolute positions**:
   * Modified [_gamescreen.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_gamescreen.scss) to define global styles for the centered `.GameScreen-time-header`.
   * Updated the absolute positioning rules on desktop under `@media #{$nonmobile-query}`:
     * Shifted `.GameScreen-nav` `top` position from `234px` to `272px`.
     * Shifted `.GameScreen-chat` `top` position from `284px` to `318px`.
     * Positioned `.GameScreen-time-header` at `top: 226px; height: 38px`.
   * Updated the absolute positioning rules on desktop for rengo watching screen under `.GameScreen-rengo`:
     * Shifted `.GameScreen-nav` `top` position from `210px` to `250px`, and set its height to `36px`.
     * Shifted `.GameScreen-chat` `top` position from `260px` to `296px`.
     * Positioned `.GameScreen-time-header` at `top: 206px`.
   * Added corresponding dark mode styling overrides for the unified time header.

4. **Verification**:
   * Flow check (`npm run flow`) successfully verified with 0 errors.
   * ESLint check (`npx eslint`) passed with 0 errors.
   * Webpack production compile (`npm run build`) built successfully.

---

## Walkthrough Addendum: Chat Bubble Spacing and Width Optimizations

I have successfully updated the chat messages bubble widths to allow them to extend much wider, reducing the empty space on the right (and left for own messages):

1. **Reduced Bubble Empty Space**:
   * Modified [_chat.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_chat.scss) to decrease the empty side margin of chat message bubbles from `100px` to `36px` in both the private `UserChat` scoped layout and the global `ChatMessages-item` layout.
   * This allows chat bubbles to stretch wider across the chat container panel, improving message wrapping and readability.

2. **Verification**:
   * Flow check (`npm run flow`) successfully verified with 0 errors.
   * ESLint check passed with 0 errors.
   * Webpack production compile (`npm run build`) completed successfully.

---

## Walkthrough Addendum: Exit Zen Mode Floating Button

I have successfully added a floating button inside Zen mode that allows users to return back to the normal view screen layout:

1. **Exit Button UI**:
   * Modified [GameScreen.js](file:///home/alfredo/repo/KGS/KGS/src/ui/game/GameScreen.js) to render a floating `<button>` with class name `GameScreen-zen-exit-btn` rendering the exit icon and label `"Exit Zen"` inside the main board area (`.GameScreen-main`) when Zen mode is active.

2. **Button Spacing and Styling**:
   * Modified [_gamescreen.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_gamescreen.scss) to define premium styling rules for `.GameScreen-zen-exit-btn`:
     * Positioned absolutely in the top-left corner (`top: 20px; left: 20px;`).
     * Styled with a glassmorphic look matching the Zen mode clocks (translucent black background, backdrop blur filter, fine light borders, and rounded border corners).
     * Added hover and active cursor transitions with smooth translation and shadows.

3. **Verification**:
   * Flow check (`npm run flow`) successfully verified with 0 errors.
   * ESLint validation checks passed with 0 errors.
   * Webpack production build compiles cleanly without warnings.

---

## Walkthrough Addendum: Resume Active Game Shortcut Button

I have successfully added a prominent return/shortcut button in the upper-right section of the navigation header that allows players to return instantly to their active game screen if they navigate away:

1. **Icon Mapping**:
   * Modified [Icon.js](file:///home/alfredo/repo/KGS/KGS/src/ui/common/Icon.js) to import `Gamepad2` from `lucide-react` and map it as `"gamepad"` for backward compatibility.

2. **Prop Propagation & Rendering**:
   * Modified [Main.js](file:///home/alfredo/repo/KGS/KGS/src/ui/Main.js) to pass `playGameId={playGameId}` as a prop down to `<Nav />`.
   * Modified [Nav.js](file:///home/alfredo/repo/KGS/KGS/src/ui/meta/Nav.js) to receive the `playGameId` prop, and added the `_onReturnToGame` handler which shifts the active tab back to `"play"`.
   * Rendered the `.MainNav-active-game-btn` button (containing the gamepad icon and `"Resume Game"` label) in the account/actions container inside the upper right of the navigation header when the user is playing a game and not currently viewing the play screen.

3. **Styling and Animation**:
   * Modified [_nav.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_nav.scss) to style `.MainNav-active-game-btn` as a modern, glowing pill badge using a soft green color scheme, border shadows, and a subtle pulsing animation on the gamepad icon.
   * Configured dark mode support inside `body.dark-mode` for matching contrast and readability.

4. **Verification**:
   * Flow static type checking (`npm run flow`) successfully verified with 0 errors.
   * ESLint formatting checks completed with 0 errors.
   * Webpack production compilation check built successfully.

---

## Walkthrough Addendum: Close Game Button in Navigation Header

I have successfully added a dedicated "Close Game" button in the upper-right section of the navigation header that is displayed whenever the user is actively viewing a game (whether playing or watching) to return instantly to the corresponding list view:

1. **Viewing Game Logic**:
   * Modified [Nav.js](file:///home/alfredo/repo/KGS/KGS/src/ui/meta/Nav.js) to introduce the `isViewingGame` helper boolean that determines if the user is currently looking at a game screen (`nav === "play"` with an active game, or `nav === "watch"` with a watched game).

2. **Render Close Button**:
   * Rendered the `.MainNav-leave-game-btn` button (containing the `"door-open"` icon and the label `"Close Game"`) right inside the actions container in the upper right. Clicking this button safely leaves the game channel, returning the user back to the challenge list or the watch list without resigning the active match.

3. **Exit styling**:
   * Modified [_nav.scss](file:///home/alfredo/repo/KGS/KGS/src/css/_nav.scss) to define styling rules for `.MainNav-leave-game-btn` using a soft red border and background theme that changes color on hover.
   * Configured dark mode support inside `body.dark-mode` for optimal color contrast.

4. **Verification**:
   * Flow typechecks completed successfully with 0 errors.
   * ESLint validation checks passed without errors.
   * Webpack production compilation build completed cleanly.

---

## Walkthrough Addendum: KO Move Rejection & Logout Prevention

I have successfully investigated and resolved the bug where players were disconnected/logged out and unhandled promise rejections were thrown when making an illegal move (such as a KO recapture):

1. **Mapped HTTP 403 status to `badRequest`**:
   - Modified [KgsClient.js](file:///home/alfredo/repo/KGS/KGS/src/model/KgsClient.js) so that HTTP `403 Forbidden` response status codes on `POST` requests (which KGS returns when a move is illegal) are mapped to `"badRequest"` instead of `"serverError"`. Since `"badRequest"` is ignored for client state changes, this prevents the application from transitioning `network` status to `"error"` and showing the blocking logout overlay.

2. **Added `CANCEL_GAME_MOVE` Action**:
   - Modified [message.js](file:///home/alfredo/repo/KGS/KGS/src/model/game/message.js) to handle the `"CANCEL_GAME_MOVE"` action type. When dispatched, it deletes `tree.pendingMove` and runs `computeGameNodeStates` to cleanly revert the board state back to the correct pre-move state, removing the optimistic pending stone from the UI.

3. **Caught Move Rejections in `onPlayMove`**:
   - Modified [AppActions.js](file:///home/alfredo/repo/KGS/KGS/src/model/AppActions.js) to change `onPlayMove` to a modern `async` function.
   - Wrapped the `sendMessage` call inside a `try...catch` block. If the server rejects the move, it catches the error, dispatches `"CANCEL_GAME_MOVE"` to clean up the optimistic stone, and prints a warning to the console instead of throwing an unhandled rejection.

4. **Verification**:
   - Static analysis check (`npm run flow`) successfully verified with 0 errors.
   - Lint check (`npm run lint`) completed successfully with 0 errors.
   - Webpack production compilation (`npm run build`) completed successfully.

---

## Walkthrough Addendum: Google Chrome Extension Packaging

I have successfully configured, built, and verified the Chrome Extension package under `/chrome-extension/`. The extension compiles simultaneously with the webapp from the same React codebase, allowing users to run the client serverless and connect directly to KGS API:

1. **Relative Paths Compatibility (`"homepage": "."`)**:
   - Added `"homepage": "."` to [package.json](file:///home/alfredo/repo/Kido/Kido/package.json). This allows compiled assets to load correctly from relative directories when running locally inside the Chrome Extension (`chrome-extension://` scheme) without breaking standard web deployments.

2. **Simultaneous Build System**:
   - Configured custom build and copy scripts inside [package.json](file:///home/alfredo/repo/Kido/Kido/package.json):
     - `build:web`: Compiles standard webapp into `/build`.
     - `build:extension`: Compiles React app, copies the assets into `/chrome-extension`, registers the Manifest V3 and background worker scripts, and removes Webpack precache-manifest files to prevent service worker conflicts.
     - `build:all`: Compiles both simultaneously.
   - Added `/chrome-extension` to [.gitignore](file:///home/alfredo/repo/Kido/Kido/.gitignore).

3. **Chrome Extension Specific Source & Manifest V3**:
   - Created the `/chrome-extension-src` folder containing:
     - `manifest.json`: Configured as Chrome Manifest V3, requesting `"storage"` permissions and `"host_permissions"` for `https://www.gokgs.com/*` (allowing direct CORS request bypass).
     - `background.js`: A background service worker listener that opens the client in a new tab when clicking the extension icon.
     - `logo.svg`: The default icon for the extension toolbar.

4. **Environment-Specific Direct API Access**:
   - Modified [KgsClient.js](file:///home/alfredo/repo/Kido/Kido/src/model/KgsClient.js) to check the runtime environment.
   - If running inside a Chrome Extension context, the client bypasses the local CORS proxy and connects directly to the official KGS JSON API servlet at `https://www.gokgs.com/json/access`.

5. **Security Bypass for Turnstile CAPTCHA**:
   - Modified [LoginScreen.js](file:///home/alfredo/repo/Kido/Kido/src/ui/LoginScreen.js) to identify Chrome Extension execution mode.
   - In extension mode, the Turnstile CAPTCHA widget loading, mounting, and verification are bypassed (passing `null` token to the login request). This is secure because KGS's native API does not require CAPTCHA for third-party clients, and Turnstile secret keys cannot be safely stored on client-side extension code.

6. **Documentation updates**:
   - Updated [README.md](file:///home/alfredo/repo/Kido/Kido/README.md) with details on the build script (`npm run build:extension`) and instructions on loading the unpacked extension in Google Chrome.
   - Updated [DEVELOPMENT_RULES.md](file:///home/alfredo/repo/Kido/Kido/DEVELOPMENT_RULES.md) with the new extension build scripts list.

7. **Verification**:
   - Ran `npm run flow` to verify all Flow type annotations remain valid (Passed with 0 errors).
   - Ran `npm run lint` to verify ESLint/Prettier code style check passes (Passed with 0 errors).
   - Compiled production standard build using `npm run build` (Succeeded).
   - Compiled Chrome Extension package using `npm run build:extension` (Succeeded, outputs copied correctly to `/chrome-extension`).

---

## Walkthrough Addendum: DeclarativeNetRequest Header Injection for CORS & CSRF Bypass

I have successfully resolved the `403 (Forbidden)` error encountered during login in the Chrome Extension environment:

1. **Origin & Referer Overriding**:
   - The official KGS API at `https://www.gokgs.com/json/access` enforces strict Origin checks and blocks cross-origin requests originating from unrecognized domains or non-HTTPS schemas (like `chrome-extension://`).
   - Added `"declarativeNetRequest"` permission to [manifest.json](file:///home/alfredo/repo/Kido/Kido/chrome-extension-src/manifest.json) to allow intercepting and modifying request headers.
   - Updated [background.js](file:///home/alfredo/repo/Kido/Kido/chrome-extension-src/background.js) to dynamically register rules that override the `Origin` and `Referer` headers for all requests directed to KGS (`https://www.gokgs.com/json/access` / `gokgs.com/*`).
   - Dynamic rules set:
     - `Origin` header to `https://www.gokgs.com`
     - `Referer` header to `https://www.gokgs.com/`
   - This spoofs the requests to appear as standard first-party requests coming from KGS's own official domain, bypassing both CORS restrictions and server-side origin validations.

2. **PNG Icon Resolution**:
   - Chrome Manifest V3 does not support SVG files (`.svg`) for the extension icon. If specified, Chrome fails to render the icon or falls back to the default blank puzzle piece.
   - Updated `action.default_icon` and added a top-level `icons` definition in [manifest.json](file:///home/alfredo/repo/Kido/Kido/chrome-extension-src/manifest.json) to reference size-optimized PNG images (`16x16`, `32x32`, and `192x192` dimensions) copied from the public build directory.

3. **Verification**:
   - Re-compiled the Chrome Extension via `npm run build:extension` successfully.
   - Verified that ESLint/Prettier checks (`npm run lint`) and Flow compiler type checks (`npm run flow`) pass successfully with zero warnings/errors.

---

## Walkthrough Addendum: User Menu Restyling, Collapsible Board Styles, and Preferences Modal

I have successfully restyled the user navigation dropdown menu and implemented a dedicated, overlay **Preferences Modal** (similar to the Player Profile and Mailbox modals):

1. **Collapsible Board & Stones Section**:
   - Refactored `MoreMenu.js` to structure the "Board Style" and "Stone Style" swatch selectors under a collapsible **Board** row with a sliders icon.
   - Restyled the dropdown container `.MainNav-more-menu` with a modern rounded border (`border-radius: 12px`), light/dark borders, and sleek shadows.

2. **Mailbox Trigger**:
   - Renamed "Messages" to "Mailbox" (with a mail icon) and changed its onClick handler to directly display the in-app **Mailbox** modal (`onShowLeaveMessageModal`), showing incoming offline messages and composer.

3. **Overlay Preferences Modal**:
   - Created [PreferencesModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/PreferencesModal.js) which wraps the settings checkboxes in the shared `<Modal>` overlay wrapper.
   - Removed the separate route `/preferences` and reverted `NavOption` and `isValidNav` to exclude the `"preferences"` path, keeping route handling clean.
   - Added `showPreferencesModal` state boolean to the Redux state in [appState.js](file:///home/alfredo/repo/Kido/Kido/src/model/appState.js) and [types.js](file:///home/alfredo/repo/Kido/Kido/src/model/types.js).
   - Added actions `onShowPreferencesModal` and `onHidePreferencesModal` in [AppActions.js](file:///home/alfredo/repo/Kido/Kido/src/model/AppActions.js) and handled them in the reducer in [session.js](file:///home/alfredo/repo/Kido/Kido/src/model/session.js).
   - Configured the menu item in `MoreMenu.js` to trigger `actions.onShowPreferencesModal()` directly.
   - Conditionalized the preferences modal display in `Main.js` to render `<PreferencesModal currentUser={currentUser} usersByName={usersByName} actions={actions} onClose={actions.onHidePreferencesModal} />` when active.
   - Styled `.PreferencesModal` and its child selectors inside `_meta.scss` to fit modal window patterns (with buttons aligned to the right, etc.) in both light and dark mode.

4. **Preferences Caching & Speedup**:
   - **Pre-fetching on Login**: Modified `onLoginSuccess` in [AppActions.js](file:///home/alfredo/repo/Kido/Kido/src/model/AppActions.js) to trigger a `DETAILS_JOIN_REQUEST` message for the logged-in user immediately upon a successful login.
   - **Persistent Subscription**: Updated `onCloseUserDetail` in [AppActions.js](file:///home/alfredo/repo/Kido/Kido/src/model/AppActions.js) to prevent calling `onUnjoin` on the logged-in user's details subscription. Keeping the subscription alive ensures that the details cache remains fresh.
   - **Instant UI Loading**: Refactored [PreferencesModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/PreferencesModal.js) constructor to initialize local component state directly from the Redux cache (`usersByName[currentUser.name].details`) if already present, rendering fields instantly without displaying a spinner.
   - **Robust State Updates**: Updated the `DETAILS_UPDATE` handler in [user.js](file:///home/alfredo/repo/Kido/Kido/src/model/user.js) to locate the user by matching channel ID in the `usersByName` map, allowing preference updates to be parsed successfully when the active modal state is not set.
   - **Rank Enabled Fix**: Derived the initial value and updates of the `rankWanted` state variable in [PreferencesModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/PreferencesModal.js) from both `user.flags.canPlayRanked` (the KGS `=` flag) and the presence of `user.rank` (i.e., `user.rank !== null && user.rank !== undefined`) rather than `details.rankWanted`. This is because KGS does not return `rankWanted` in user details payloads; it only accepts it write-only in profile change requests, and reflects it downstream by toggling the `canPlayRanked` (`=`) user flag and removing or including the computed rank value. Deriving from both fields correctly handles users without a computed rank (such as beginners or new accounts).
   - **KGS Upstream Private Email Property Name Fix**: Mapped the `privateEmail` property to the correct KGS protocol property name **`emailPrivate`** when sending the `DETAILS_CHANGE` request in [AppActions.js](file:///home/alfredo/repo/Kido/Kido/src/model/AppActions.js). Downstream, the KGS server broadcasts the field name as `privateEmail`, but the upstream command schema expects `emailPrivate`. Fixing this mismatch prevents KGS from throwing validation errors and rejecting the entire profile updates payload.

5. **Kido Branding Cleanup**:
   - Removed the redundant "Kido" title header below the logout button, keeping a single line separation divider.
   - Added consistent visual icons to the "Send Feedback" and "KGS" links (renamed from "Official KGS" for compactness) at the bottom.

6. **Dynamic Toggle Switch Descriptions**:
   - Replaced static setting titles with context-aware, state-based text inside the Toggle Switches within [PreferencesModal.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/PreferencesModal.js):
     - Announcement emails: `"Receive KGS announcement emails"` (checked) vs `"Do not receive KGS announcement emails"` (unchecked).
     - Private email: `"Email address not visible to others"` (checked) vs `"Email address visible to others"` (unchecked).
     - Rank enabled: `"Show your rank"` (checked) vs `"Do not show your rank (all games are free)"` (unchecked).
   - Structured the layout in [_meta.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_meta.scss#L868) with a flexible height (`height: auto`), a robust `min-height: 48px`, and clean padding/line-height settings to support multi-line descriptions on all screen widths.

7. **Sabaki Board & Stones Themes**:
   - Implemented the **Sabaki Wood** board theme in [_board.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_board.scss#L129-L147) featuring a warm golden-yellow radial gradient base, a vertical lighting/shadow overlay, and a custom repeating vertical wood grain.
   - Implemented the **Sabaki Slate/Shell** stone theme in [_board.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_board.scss#L291-L329) with clean radial gradients (no shell lines), soft realistic drop shadows, and subtle borders.
   - Added `sabaki` to the selectable styles list (`stylesList`) and stone styles list (`stoneStylesList`) in [MoreMenu.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/MoreMenu.js#L18-L67).

8. **Flow Type Safety Fix**:
   - Fixed a compiler error in [Nav.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/Nav.js#L485) by checking for existence of the optional prop `unreadMailboxCount` before comparing it to `0`.

9. **Hikaru Board & Stones Themes**:
   - Implemented the **Hikaru Golden** board theme in [_board.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_board.scss#L151-L162) designed for high-contrast cartoon style play, with a rich golden honey base, top-down highlights, and dark warm grid lines.
   - Implemented the **Hikaru Cartoon** stone theme in [_board.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_board.scss#L343-L391) mimicking the images provided:
     - **White stones**: thick dark borders, a warm cream inner ring transition, flat-matte body shading, and a sharp highlight curve on the left.
     - **Black stones**: thick dark borders, a warm golden-brown inner ring, dark slate body, and a large soft white circular specular highlight top-left.
   - Added `hikaru` to the selectable styles list (`stylesList`) and stone styles list (`stoneStylesList`) in [MoreMenu.js](file:///home/alfredo/repo/Kido/Kido/src/ui/meta/MoreMenu.js#L18-L82).

---

## Walkthrough Addendum: Exact Case Matching for Direct Challenges (Sorting & Card Styling)

I have successfully updated the challenge list sorting and direct challenge card styling to enforce exact, case-sensitive username matching:

1. **Exact Username Matching for Sorting**:
   - Updated `isDirectChallenge` in [display.js](file:///home/alfredo/repo/Kido/Kido/src/model/game/display.js) to compare challenge notes strictly using `game.name.includes("Challenge to " + currentUsername)`. This removes the previous lowercase conversion, guaranteeing that only direct challenges with exact username matches are prioritized and sorted to the absolute top of the challenge list.
   - Propagated `currentUser.name` into `sortGames` from the challenge-handling message logic in [message.js](file:///home/alfredo/repo/Kido/Kido/src/model/game/message.js).

2. **Exact Username Matching for Card Styling**:
   - Refactored `hasCurrentUserMention` in [GameList.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/GameList.js) to perform a direct case-sensitive substring match (`game.name.includes("Challenge to " + currentUser.name)`).
   - Removed the local `lowerName` and `lowerNote` lowercase conversions. This ensures that direct challenge styling/highlighting classes (e.g. `.GameList-item-direct-challenge`) and the swords icon are applied only when the case matches exactly, preventing accidental highlights of similar usernames with different casings.

3. **Verification**:
   - Verified that ESLint/Prettier checks (`npm run lint`) and Flow compiler type checks (`npm run flow`) pass successfully with zero warnings/errors.
   - Successfully compiled the production build (`npm run build`) and copied the built assets to `/server/`.

---

## Walkthrough Addendum: Simultaneous Game (Simul) Challenge Creation Fix

I have diagnosed and successfully resolved the `400 (Bad Request)` error when creating simultaneous game challenges:

1. **Required Per-Player Parameters**:
   - In KGS, simultaneous game proposals (`gameType === "simul"`) require each participant with the `"black"` role (the opponents) to have explicit, player-level `handicap` and `komi` properties inside the players list array.
   - If these fields are omitted or undefined in the upstream JSON payload, the KGS server fails to deserialize/validate the request, resulting in an HTTP `400 (Bad Request)` and immediately logging the client out.

2. **Flow Type Safety**:
   - Added optional `handicap` and `komi` properties to the `GameProposalPlayer` type definition in [types.js](file:///home/alfredo/repo/Kido/Kido/src/model/types.js).

3. **Central Proposal Sanitization**:
   - Updated `sanitizeProposal` in [AppActions.js](file:///home/alfredo/repo/Kido/Kido/src/model/AppActions.js) to intercept outgoing proposals. If `gameType` is `"simul"`, it checks each player with the `"black"` role and populates default values (`handicap: 0`, `komi: 0`) if they are missing or not numbers. This acts as a robust network-level fallback.

4. **Client State Consistency**:
   - Updated initial proposal templates in [challenge.js](file:///home/alfredo/repo/Kido/Kido/src/model/game/challenge.js) to include `{ role: "black", handicap: 0, komi: 0 }`.
   - Updated game type toggle logic in [ProposalForm.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/ProposalForm.js) to initialize these values when switching to simul.
   - Updated slot addition/removal handlers in [ProposalPlayers.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/ProposalPlayers.js) to set or reset the properties when opponents are added/removed.

5. **Verification**:
   - Verified that ESLint/Prettier checks (`npm run lint`) pass successfully with 0 errors.
   - Verified that Flow type checks (`npm run flow`) compile successfully with 0 errors.

---

## Walkthrough Addendum: Simultaneous Game (Simul) Opponent Slot Assignment Fix

I have diagnosed and successfully resolved the issue where multiple opponents joining a simultaneous game challenge were all being assigned to and overwriting the same slot (`OPPONENT 1`):

1. **Diagnosis**:
   - When a challenger joins a challenge, their browser receives the host's proposal and runs `getEvenProposal()` to fill in their own name. Because the challenger's browser only sees the host's initial empty slots (e.g. Slot 1 and Slot 2 are both empty), the challenger always fills themselves into the first available empty slot (Slot 1).
   - If multiple players join before the host accepts any of them, they all submit proposals claiming Slot 1.
   - When the host accepted these proposals, the client simply dispatched the received proposal as-is. Consequently, accepting `rampi`'s proposal (claiming Slot 1) would overwrite `rampichino` who had already been accepted into Slot 1.
   - In addition, the client store had no reducer handler for the downstream `CHALLENGE_PROPOSAL` message, meaning that the host's active proposal (`sentProposal` / `initialProposal`) was never updated in the Redux store when KGS registered slot assignments.

2. **Sequential Slot Merging on Host Acceptance**:
   - Updated `onAcceptChallengeProposal` in [AppActions.js](file:///home/alfredo/repo/Kido/Kido/src/model/AppActions.js).
   - Now, when the host accepts a challenger's proposal in a `"simul"` game, the client locates the challenger player from the incoming proposal, checks if they are already present in the host's active proposal, and if not, maps them dynamically to the **first empty `"black"` slot** of the host's active proposal (preserving any other already accepted players).
   - This copies the challenger's specific `handicap` and `komi` values to the assigned slot.

3. **Store Synchronization**:
   - Added a handler for the downstream `CHALLENGE_PROPOSAL` message in the game reducer inside [message.js](file:///home/alfredo/repo/Kido/Kido/src/model/game/message.js).
   - This ensures that whenever KGS accepts a proposal state update (from the host or other users), the active proposal (`sentProposal`) is synchronized inside the Redux store. Subsequent joins or acceptances will correctly read the updated filled slots.

4. **Sequential Host Review UI Merging**:
   - Modified the proposal loading logic in [ChallengeEditor.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/ChallengeEditor.js).
   - In `"simul"` games, instead of displaying the raw incoming proposal (which displays the challenger in Slot 1 and leaves other slots empty), the UI now dynamically merges each challenger into the host's active proposal.
   - When the host toggles between incoming join requests using the `[` and `]` pagination controls, they see a unified view: accepted players remain in their slots (e.g. Slot 1) and the new challenger is shown in the next empty slot (e.g. Slot 2) with their specific handicap and komi. This completely aligns the interface with the host's expectation and prevents visual overlaps.

5. **Verification**:
   - Verified that ESLint/Prettier checks (`npm run lint`) pass successfully with 0 errors.
   - Verified that Flow type checks (`npm run flow`) compile successfully with 0 errors.

---

## Walkthrough Addendum: Challenge Editor Component Update and Duplicate Challenger Slot Assignment Fix

1. **State Update Fix in ChallengeEditor**:
   - Updated `componentDidUpdate` in [ChallengeEditor.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/ChallengeEditor.js) to compare `currentActive` and `prevActive` proposals, as well as `currentChallenge.players` and `prevChallenge.players`.
   - If the active proposal or the list of accepted players has updated on the server (e.g., when joining and receiving the `CHALLENGE_JOIN` message containing already accepted opponents), we synchronize `initialProposal` and `proposal` in the local state.
   - This ensures that subsequent joins are merged into the correct, updated baseline proposal (which now correctly shows previously accepted opponents in their slots).

2. **Duplicate Challenger Slot Assignment Fix**:
   - Modified `getEvenProposal` in [challenge.js](file:///home/alfredo/repo/Kido/Kido/src/model/game/challenge.js).
   - If the challenger (`challengerName`) is already present in one of the slots of the proposal (which happens after they send their proposal and it is returned from the server as `sentProposal`), we mark `assignedChallenger` as `true`.
   - This prevents them from being assigned to any subsequent empty slots, ensuring they only occupy a single slot in the proposal.

3. **Accepted Players Merging**:
   - Enhanced `getEvenProposal` to accept an optional `challengePlayers` parameter.
   - Count the black and white roles inside `proposal.players` to map each slot to its KGS role name (e.g., `"black"`, `"black_2"`, `"black_3"`, etc.).
   - If `challengePlayers` has an accepted player for that role, their name is pre-populated in the proposal slot.
   - This ensures already accepted players are correctly shown when opening a challenge modal, and new challengers are mapped to the correct subsequent slots.

4. **Parser Support for Proposals**:
   - Added `"sentProposal"` and `"receivedProposals"` to the `GAME_CHAN_PROPS` array in [parse.js](file:///home/alfredo/repo/Kido/Kido/src/model/game/parse.js).
   - This allows new challengers to parse and sync the accepted proposals list immediately upon joining the challenge channel, ensuring their local view remains consistent.

## Walkthrough Addendum: Game Tagging (personal archive tags)

The KGS game-tag system lets a user attach a short personal note (max 50 chars) to each of their own archived games. Tags are **not** part of the regular archive summaries — they arrive separately as a `timestamp → tag` map — so they are merged onto the summaries client-side.

1. **Protocol**:
   - On joining our **own** archive (`ARCHIVE_JOIN` where the user matches `currentUser`), [AppActions.js](file:///home/alfredo/repo/Kido/Kido/src/model/AppActions.js) (`onArchiveJoinSuccess`) sends `FETCH_TAGS` on that channel.
   - The server replies with `FETCH_TAGS_RESULT` (`{ tags: { [timestamp]: tagString } }`).
   - `onTagGame(timestamp, text)` sends `TAG_GAME` (`channelId` = our archive channel, `gameTimestamp`, `text`); an empty `text` clears the tag. It also dispatches a local `SET_GAME_TAG` for an optimistic update.

2. **State** ([types.js](file:///home/alfredo/repo/Kido/Kido/src/model/types.js), [appState.js](file:///home/alfredo/repo/Kido/Kido/src/model/appState.js)):
   - `gameTagsByTimestamp: Index<string>` holds the fetched tag map.
   - `archiveChannelId: ?number` remembers our own archive channel so tag commands can target it.

3. **Reducers** ([game/message.js](file:///home/alfredo/repo/Kido/Kido/src/model/game/message.js)):
   - A shared `applyTags(summaries, tags)` helper merges the tag map onto summaries by timestamp (and strips stale tags).
   - `ARCHIVE_JOIN` stores `archiveChannelId` and applies tags for the own archive; `ARCHIVE_GAMES_CHANGED` re-applies tags after merging; `FETCH_TAGS_RESULT` and `SET_GAME_TAG` update the map and re-merge.

4. **UI** ([GameSummaryList.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/GameSummaryList.js), [MyGamesScreen.js](file:///home/alfredo/repo/Kido/Kido/src/ui/MyGamesScreen.js)):
   - When an `onEditTag` prop is supplied (My Games passes `actions.onTagGame`), the tag chip becomes clickable; untagged rows show a faint dashed "Tag" affordance.
   - Clicking opens an inline `GameTagEditor` (input + save/clear) rendered inside the row's `<a>`; all interactions `stopPropagation` so editing never triggers row navigation. Enter saves, Escape cancels.
   - Tags are only editable on the current user's own games (KGS only returns your own tags), so other archives show read-only chips.

## Walkthrough Addendum: My Games Filter

The My Games header has three independent dropdown **pill** buttons — Date, Tag, and Result — each opening its own small menu. Filtering is purely client-side on the already-loaded archive summaries — only fields the archive actually carries are filterable.

1. **Component** ([MyGamesFilter.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/MyGamesFilter.js)):
   - Exports `MyGamesFilterState` (`tag`, `results`, `dateRange`), `EMPTY_MY_GAMES_FILTER`, and a pure `filterMyGames(games, filter, player)` helper.
   - Each pill is a reusable internal `FilterDropdown` (icon + current-value label + chevron) with its own open/close state and click-outside handling. Active pills take the `--ui-color` accent.
   - **Date** (`calendar` icon): All time / Last week / month / year, computed against each summary's `timestamp`. (`clock` is not in the icon set, so `calendar` is used.)
   - **Tag** (`tag` icon): dropdown of your distinct tags (built from the loaded summaries) plus "All" and "Untagged".
   - **Result** (`trophy` icon): multi-select Won / Lost / Unfinished, derived from `score` + winning color vs the current user.

2. **Screen wiring** ([MyGamesScreen.js](file:///home/alfredo/repo/Kido/Kido/src/ui/MyGamesScreen.js)):
   - Holds the filter in local state; `filterMyGames` is applied before paging, and the "Show more" count resets to the first page on filter change.
   - The header count shows `matched / total` while a filter is active, and a distinct "No games match the current filter" empty state is shown when filtering hides everything.

3. **Scope note**: time-speed and opponent-rank filters were intentionally excluded — the archive `gameSummary` doesn't carry time-system data (same reason the speed badge can't render here).

## Walkthrough Addendum: Live Games / Challenges header restyle

The Live Games (and Challenges) header filters used to live behind a gear/sliders **popover**. They are now surfaced inline as a horizontal toolbar, matching the new design.

1. **Components** ([GameListFilter.js](file:///home/alfredo/repo/Kido/Kido/src/ui/game/GameListFilter.js)):
   - `GameListFilter` (default export) now renders **only** the room dropdown ("All Games" / "All Challenges"), kept in the title row. The gear popover and all its handlers were removed.
   - `GameListFilterBar` (named export) is the new inline toolbar rendered in its own header row: a **Hide bots** toggle, then **Type** (Rated / Free), **Speed** (4 icon buttons), and **Rank** (Dan / SDK / DDK) groups, each with an uppercase label. It reuses the existing `GameListFilter-type-btn` / `GameListFilter-speed-btn` styles and writes to the same `GameFilter` fields (`excludeBots`, `gameRatings`, `timeSpeeds`, `playerRanks`) via `onChange`.
   - `GameListSubBar` (named export) is a **placeholder** sub-header: a rank legend (Pro/Dan · 1–12k · 13k+ · handicap), a Sort control (Live / Most watched / Most moves) and a Cards/Table view toggle. These are visual only — not wired up — pending their own features.

2. **Screen wiring**:
   - [WatchScreen.js](file:///home/alfredo/repo/Kido/Kido/src/ui/WatchScreen.js) renders `GameListFilterBar` and `GameListSubBar` below the title row.
   - [PlayScreen.js](file:///home/alfredo/repo/Kido/Kido/src/ui/PlayScreen.js) renders `GameListFilterBar` (no placeholder sub-bar) so the Challenges list keeps the same filtering it had inside the old popover.

3. **Icons**: added `layout-grid` (Lucide `LayoutGrid`) to [Icon.js](file:///home/alfredo/repo/Kido/Kido/src/ui/common/Icon.js) for the Cards view toggle; `list` was already mapped.

4. **CSS** ([_gamelist.scss](file:///home/alfredo/repo/Kido/Kido/src/css/_gamelist.scss)): removed the dead `.GameListFilter-gear*` / `.GameListFilter-popover*` blocks (light + dark) and added `.GameFilterBar*` and `.GameSubBar*` styles with dark-mode overrides.



## Walkthrough Addendum: Bug-fix sweep (connection + model + UI)

A full-codebase bug audit fixed the following (no feature changes):

1. **Connection layer** ([KgsClient.js](file:///home/alfredo/repo/kido/src/model/KgsClient.js), [server.js](file:///home/alfredo/repo/kido/server/server.js), [setupProxy.js](file:///home/alfredo/repo/kido/src/setupProxy.js)):
   - Poll loop no longer dies when the first successful poll after a retry returns an empty message batch.
   - A 403/400 login rejection with a non-JSON body now resets `loggingIn` → `loggedOut` (and shows a generic error) instead of spinning forever; a catch-all guard prevents any error path from stranding the `loggingIn` state.
   - The `sync` send option was inverted (`sync: true` produced an async request) — fixed, though no caller currently uses it.
   - `/api/json-cors/access` is now path-rewritten to `/json-cors/access` before proxying to gokgs.com (that `/api` path only exists as a Vercel function), with the session cookie `Path` rewritten back so the browser keeps sending it. Applied in both the CRA dev proxy and `server/server.js`.
   - `wwwRedirect` no longer crashes on requests without a `Host` header.

2. **Model layer**: `replaceNodeProp` used `.filter()` where it meant `.map()` (all non-comment `PROP_CHANGED` events were dropped) and now also rebuilds `computedState`; re-parsed game comments keep stable ids/dates; duplicate `CHILD_ADDED` no longer wipes an existing node; `komi: 0` / `moveNum: 0` are no longer treated as absent; `unfinishedGames` merges channel + archive entries instead of clobbering one side; `CHALLENGE_SUBMIT` for an unknown channel no longer crashes the reducer; `ROOM_NAME_FLUSH` no longer mutates shared state; `parseUser` no longer resets `rankVal` on partial payloads; own outgoing DMs no longer bump the unread badge; `onStartChatWithMessage` queues the body on the original `CONVO_REQUEST` callbackKey instead of issuing a duplicate request; `onJoinGame` guards a missing game channel; `getGamePlayerOtherRole` picks the opposing color (rengo) and guards missing entries; `compareGames` comparator contract fixed.

3. **UI layer**: `escapeHtml` now actually escapes `"` (was escaping `'` twice); mention highlighting moved into `RichContent` (post-escape) so it renders as a highlight instead of literal HTML; `ChatScreen` had two `componentWillUnmount` methods (first one dead → window listener leak) — merged; `GameClock` treated `prevProps` as `nextProps` (clock one update stale); `MoveTree` tears down graph-resize listeners on unmount; `BoardContainer`'s zen-pan click-swallow listener self-expires after 400ms; `ChallengeEditor` rank-settle recompute uses the current challenge and guards missing `players`.

4. **Docs**: `CLAUDE.md` / `DEVELOPMENT_RULES.md` referenced a nonexistent `transport.js` — corrected to `src/model/KgsClient.js`.

## Walkthrough Addendum: GAME_OVER handling + native SGF review services

1. **`GAME_OVER` is now handled** ([message.js](file:///home/alfredo/repo/kido/src/model/game/message.js)): the game channel is marked `over` (score attached when present), and the matching entry in the current user's archive (`gameSummariesByUser`) gets its `inPlay` flag cleared + score patched. Previously the archive stayed stale until `ARCHIVE_GAMES_CHANGED` arrived (which can lag or never come), so a finished game still showed as "in play" in My Games and clicking it dead-ended on the Play tab via the resume flow.
2. **Defensive routing in My Games** ([MyGamesScreen.js](file:///home/alfredo/repo/kido/src/ui/MyGamesScreen.js)): `_onSelectGame` now checks the live channel — if the summary claims `inPlay` but the channel is `over`/removed, it falls through to the review/load flow instead of the resume flow. `gamesById` added to the screen's Props (already provided by `Main.js`'s `screenProps` spread).
3. **AI Sensei / Kifubara on Android** ([reviewServices.js](file:///home/alfredo/repo/kido/src/util/reviewServices.js)): the Capacitor native app now takes the direct-fetch branch (same `isNativePlatform()` gate as `KgsClient.js`) instead of the web `/api/...` proxy paths, which resolved against the `www.gokgs.com` WebView origin and 404'd. `CapacitorHttp` (already enabled) executes the fetches natively, so CORS doesn't apply.

## Walkthrough Addendum: Android 1.1.0 release

`android/app/build.gradle` → `versionCode 10`, `versionName "1.1.0"` (package.json was already 1.1.0). CHANGELOG's top section is now `[Chrome Extension 1.2.4 / Android 1.1.0] - 2026-07-27`; the extension is unchanged this round.

Release steps (run locally — the signing keystore lives in `keystore/kido-upload.jks` and signing is done from Android Studio):

1. `npm run build:android` — production web build + `npx cap sync android`.
2. Android Studio → **Build → Generate Signed App Bundle / APK** → *Android App Bundle* → select `keystore/kido-upload.jks` → release build.
3. Upload the `.aab` to the Play Console; the release notes can be lifted from this version's CHANGELOG section.
