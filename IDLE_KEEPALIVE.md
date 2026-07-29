# Idle Status & Session Keep-Alive — Implementation Notes

> Status: **IMPLEMENTED** (2026-07-26), with a strategy adapted to the JSON API.
> The open question below was resolved against the official JSON upstream docs
> (gokgs.com/json/upstream.html): **the JSON API has no `PING` message.**
> `WAKE_UP` ("Reset our idle clock. Most commands do this, but if this command
> does nothing else.") is the only keep-alive, and `IDLE_ON` sets idle
> immediately. The raw-socket PING mechanism described below does not exist
> over JSON.
>
> Implemented strategy (in `AppActions.onReceiveServerMessages`'s
> `IDLE_WARNING` handler): **always** answer `IDLE_WARNING` with `WAKE_UP`
> (never let a session idle-die — ignoring it killed live sessions, including
> mid-game during an opponent's long think), and if we had deliberately sent
> `IDLE_ON` (`_idleSent`), immediately re-send `IDLE_ON` after the `WAKE_UP`
> so others keep seeing the idle dot. Net effect is "connected but idle" —
> the same outcome PING provides on the raw protocol, using only documented
> JSON commands, event-driven (no heartbeat timer, no extra traffic).
>
> The rest of this document is kept as the original design/research notes.

## Goal

Two related things the user wants:

1. **Stay connected until explicit Logout.** Currently KGS idle-disconnects an
   inactive session after a few minutes, logging the user out.
2. **Still appear idle when actually away.** The user must NOT look permanently
   "online" just because we keep the connection alive — when they step away,
   other users should see their idle (sleeping) dot.

These two goals are in tension only if you use the wrong mechanism. KGS keeps
them separate (see below), so both are achievable.

## Key protocol facts (verified against the official client's behavior)

KGS has **two independent mechanisms**; do not conflate them:

| Concept | Message | Effect | Official client behavior |
|---|---|---|---|
| Transport keep-alive | `PING` (raw-socket protocol) | Holds the socket/session open. Does **not** touch idle status. | The official client sends it automatically every ~70s of *outbound silence*. |
| Idle reset | `WAKE_UP` | Marks the user **active** again (resets the server idle timer). | Sent in reaction to `IDLE_WARNING` (bots) or on genuine user activity (GUI clients). Never on a periodic timer. |
| Idle/away flag | `sleeping` bit in user flags | What produces the "idle dot" others see. | Set by the **SERVER** from inactivity and broadcast in user-flag updates. The client only reflects it. The upstream `IDLE_ON` also exists (documented in the JSON API). |

Also relevant:
- The connected and sleeping user flags are **separate** — a user
  can be *connected AND sleeping* at the same time. That is exactly the state we
  want when the user is away but we keep the socket alive.
- `IDLE_WARNING` (downstream id 36) is a **warning before disconnect**. Answering
  it with `WAKE_UP` keeps you logged in. Ignoring it eventually disconnects you.

## Why the naive approach was wrong (and reverted)

The first attempt sent `WAKE_UP` on a periodic timer to avoid disconnect. That
works for staying connected, **but it permanently marks the user active** —
they never go idle to others. This is the exact failure we must avoid. Do NOT
send `WAKE_UP` as a heartbeat.

## Correct design

- **Keep connected:** send **`PING`** on a timer (e.g. every 60s) while logged
  in. `PING` does not affect idle status, so the server can still mark us
  sleeping. This is the heartbeat.
- **Go idle naturally:** do **nothing** when the user is inactive. The server
  will set the `sleeping` flag after its own inactivity threshold → others see
  the idle dot. (We already render this: `getUserStatusKind`/`getUserStatusText`
  in `src/model/user.js` map `flags.sleeping` → "idle".)
- **Return from idle:** send a **throttled `WAKE_UP`** on real user activity
  (`mousemove`/`mousedown`/`keydown`/`touchstart`, throttled to ~1 per 30s) so
  coming back marks the user active again promptly.
- **(Optional safety net)** Respond to `IDLE_WARNING` with `WAKE_UP` only if you
  decide a session should never disconnect. Skip this if `PING` already prevents
  the warning — answering it would falsely mark the user active.

### ⚠️ Open question to resolve FIRST

The official desktop client speaks the **raw socket protocol**. Kido uses the **JSON
HTTP API** (`/json-cors/access`). It is **not confirmed** that `PING` is a valid
upstream message on the JSON API, nor that the JSON API even has the same
idle-disconnect behavior. Before building:

1. Check the official JSON upstream docs (gokgs.com/json/upstream.html) for
   `PING` / `WAKE_UP` and any documented keep-alive for the JSON client.
2. If `PING` is not valid over JSON, find what is. Candidates:
   - The poll GET itself may already keep the session alive (then the real bug
     is something else — investigate why it drops after minutes).
   - A lightweight harmless command on a timer.
3. Confirm whether the JSON API marks `sleeping` server-side the same way.

If `PING` is unsupported over JSON, the whole "connected but idle" split may not
be available and we may need a different strategy (e.g. accept always-online, or
only keep alive while the tab is visible).

## Implementation sketch (in `src/model/AppActions.js`)

All of this lived in `AppActions` in the prototype. Rough shape:

```js
// fields
_lastActivity = 0;
_keepAliveTimer = null;
_KEEP_ALIVE_INTERVAL_MS = 60 * 1000;   // PING cadence
_lastWakeUp = 0;
_WAKE_UP_THROTTLE_MS = 30 * 1000;

// constructor: track activity, send throttled WAKE_UP on real input
//   window.addEventListener("mousemove"/"mousedown"/"keydown"/"touchstart", onActivity, {passive:true})
//   onActivity: update _lastActivity; if !offline && throttle elapsed → _send({type:"WAKE_UP"})

// _startKeepAlive(): setInterval → if !offline → _send({ type: "PING" })   // ← verify PING is valid first!
// _stopKeepAlive(): clearInterval

// onLoginSuccess(): this._startKeepAlive()
// onLogout():       this._stopKeepAlive()
// in onReceiveServerMessages follow-up loop:
//   on "LOGOUT" | "SESSION_EXPIRED" | "RECONNECT" → this._stopKeepAlive()
```

Notes:
- `Date.now()` is fine in app runtime (only forbidden in workflow scripts).
- Stop the timer on logout AND on server-initiated session end, or it pings a
  dead session.
- `KgsMessage.type` is `string` in `src/model/types.js`, so no Flow enum to
  extend for `PING`/`WAKE_UP`.
- If `PING`/`WAKE_UP` produce no reducer state change, add them to
  `IGNORED_MESSAGE_TYPES` in `src/model/index.js` only if they ever arrive
  downstream (they don't — these are upstream). `IDLE_WARNING` would go there
  if you add a side-effect-only handler for it.

## Where idle is already displayed (no change needed)

- `src/model/user.js` — `getUserStatusKind()`/`getUserStatusText()` return
  "idle" for `flags.sleeping`.
- Status dots render the amber idle color across UserList, UserChat, hover card,
  chat sidebar, nav search (see `DESIGN_RULES.md` → Status Dot Colors).

## Test plan

1. Log in, leave the tab open and untouched past the point where it currently
   drops (a few minutes). Expect: still logged in.
2. From a second account, observe the idle user: after KGS's inactivity
   threshold they should show the **idle dot** (not online).
3. Move the mouse on the idle tab: within ~30s the second account should see
   them flip back to **online**.
4. Press Logout: session ends; timers stop (no further PING/WAKE_UP).
