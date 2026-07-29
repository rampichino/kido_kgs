# Changelog

All notable changes to this project will be documented in this file.

## [Chrome Extension 1.2.4 / Android 1.1.0] - 2026-07-27
### Added
- Silent reconnect on the native app / extension: a session that dies on its own (typically KGS reaping it while the app is backgrounded) is restored by logging back in from the saved credentials, showing "Reconnecting…" instead of the login form. Opt-in via "Stay signed in", on by default there.
- `GAME_OVER` is now handled: a finished game is marked over and its archive entry updated immediately, so My Games shows the result instead of still offering to resume — and clicking it opens the review rather than dead-ending on the Play tab.
- Move aids (tap-to-confirm / zoom) now apply to 17×17 as well as 19×19, and tap-to-confirm is the default for new installs.
- Board-size filter covers 19×19, 17×17, 13×13 and 9×9.

### Changed
- Rated/free games are marked with a shield / coffee icon (in the game lists, the filters, and inside the challenge list's time pill).
- Android back button never exits the app: it closes a modal, leaves a viewed game, returns to Play, then stops.
- Mobile polish across the player profile (action row, metadata in the Bio tab, presence dot, wider names in the game list), the chat list (draggable Rooms/Players split with a visible grip, one room per row in Explore Rooms, full-screen Explore/mailbox/load-game sheets), and the game filters (icon-only rated/free, compact size chips, Filters pill with the clear button beside it).

### Fixed
- AI Sensei / Kifubara SGF import now works in the Android app: it fetched through web-only proxy paths that 404 against the WebView's gokgs.com origin, and CapacitorHttp hands back base64 bodies for `application/x-go-sgf`, which both services rejected.
- A failed move no longer always reports "Server rejected move" — the message now distinguishes a dead session, a network failure, and an actual server rejection.
- Poll retries back off (3s → 30s) instead of hammering KGS during a 502 burst.
- Stone placement sounds no longer drop on fast moves: stone audio now plays through the Web Audio API (samples decoded once into buffers, context unlocked on any user gesture) instead of `HTMLAudioElement`, which silently dropped rapid consecutive plays in mobile WebViews and could be blocked by autoplay policies when triggered from a network callback. The element-based path remains as a fallback while buffers decode.
- Your own move now clicks immediately at tap time (inside the user gesture) rather than when the server echo arrives; the echo of that placement is suppressed so it doesn't double-sound.
- A fast exchange that lands several stones in one polled update now plays two staggered clicks instead of a single one.
- Turn indicator could show the opponent to move when it was actually your turn: the KGS long-poll had no timeout, so a half-open socket (device sleep, network switch) hung the poll loop indefinitely with no error, silently freezing board, clock, and turn state. The poll GET now times out (150s), POSTs time out (30s), and a non-JSON 200 response rejects into the retry path instead of killing the loop.
- Poll retries no longer give up permanently while logged in (previously polling stopped for good after ~30s of outage); polling also restarts when the tab becomes visible again or the browser reports the network is back.
- Crash on the Play screen (`Cannot read properties of undefined (reading 'id')`) when no room channel was joined yet — `getDefaultRoom()` returns undefined during fresh login/reconnect and was dereferenced unguarded.
- Mid (dune) theme: chat input pill border was invisible against the cream surface; it now uses a stronger warm outline, with the focus ring moved to the pill itself.
- After waking from sleep or a network switch, the app now probes the session (a `SYNC_REQUEST` on tab-visible / browser-online) so a dead session shows the login screen within seconds instead of freezing the UI for up to 150s until the hung long-poll times out — or until a played move failed as "move rejected".
- Idle sessions are no longer disconnected by the server: every `IDLE_WARNING` is now answered with `WAKE_UP` (the JSON API has no `PING`, so this is the only keep-alive), and a deliberately idle client immediately re-asserts `IDLE_ON` afterwards — staying connected while still showing the idle dot to others. Previously the warning was deliberately ignored while idle-flagged, which let KGS kill live sessions — including mid-game during an opponent's long think, surfacing as "move rejected" + logout on the next move.
- Returning to the Android app after it had been backgrounded no longer drops you on the login screen: the OS suspends the WebView, so the long-poll stops and KGS reaps the session. When a session ends on its own (and "Stay signed in" is set, the default on the native app / extension), the app now logs back in silently, showing "Reconnecting…" instead of the login form. A deliberate logout, a bad password, or being logged in from another system stop the retries.

## [1.0.0] - ?
### Added
- Initial public release

## [0.4.0-dev] - 2026-06-16
### Added
- Restyled the Live Games / Challenges header: surfaced the Hide-bots / Type / Speed / Rank filters inline as a toolbar (replacing the gear/sliders popover), plus a placeholder sub-bar (rank legend, sort, Cards/Table view toggle) for upcoming features
- Game tagging: add/edit/remove a personal tag on your own archived games from the My Games list (`TAG_GAME` / `FETCH_TAGS`)
- My Games filter (header dropdown pills): filter by date played, tag, and result (won/lost/unfinished)
- Rengo (2v2 team games): create/join challenges with open-seat selection and team-average handicap
- Simul exhibitions (one player vs many simultaneously, with per-opponent handicap)
- Add custom board color with --board-wood --board-lines/--board-wood-blend
- Add custom stone color taking a flat vector stone as base
- Add text minimum size rule in DEVELOPMENT_RULES
- Check disappearing chat messages on logout (determined KGS server rule behavior)
- Define the definitive stones and boards selection
- Add sound for moves (integrated custom Yunzi stone clacks and foley capture effects)
- Remove active challenge when user closes the window
- Automatch (auto-find opponents by rank/time preference)
- Find beta-tester to play casual games (added betatwo to centralized bot list)
- Message user separate from rooms (direct messaging conversation view)
- Playback system (live game streaming/playback)
- Ko/loop warning (notify players of repeated position)
- User blocking (block/unblock users from contacting you)
- Compact vs comfortable message density toggle
- Message search within a conversation
- Preferences autosaving with a dynamic visual status indicator
- Unification of local friends list with server-side KGS buddies (removing local friend cache)
- Removal of manual preferences export/import backup utilities

## [0.1.0] - 2026-05-31
### Added
- Check buddy list, censored and fun for user list
- Landing page with login
- Games filter bug fix
- Cloudflare Turnstile CAPTCHA
- Configure agent skill
- Define the initial site restyling (main pages) and the color scheme
- Define a color scheme for info, warning, etc. and for other components
- Add messages for offline players and test chat when the user is offline
- Fix KO bug
- Check the exit game feature
- Restyle icon for incoming offline messages
- No chat feature
- Scoring system
- Check UNDO button style
- Server-side friends: KGS native friend/fan/censor lists
- Evaluation of a different method for friends list (now cached on browser)
- Complete TODO in DESIGN_RULES (unified variables, documented scales)
- Custom color selector for UI color (with color picker popup and settings icon)
- Fix stone markers position to prevent visual offsets/layout shifting
- In-app mailbox (leave/receive messages when user is offline)
- Watch-game joining loading spinner state
- GDPR cookie consent banner on landing page
- Tabbed AboutModal modal (About, Credits, and Terms & Privacy)
- Mobile layout optimizations (responsive flex, sticky headers, padding adjustments)
