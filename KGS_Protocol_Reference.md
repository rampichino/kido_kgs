# KGS Protocol & Web Interface Reference

Generated: 2026-06-01 — Source: https://www.gokgs.com/json/protocol.html

## External References

* [KGS API JSON Protocol Reference](https://www.gokgs.com/json/protocol.html)
* [KGS JSON Data Types Reference](https://www.gokgs.com/json/dataTypes.html)
* [KGS JSON API Downloads](https://www.gokgs.com/help/protocol.html)

---


## 1. SERVER → CLIENT MESSAGES (Received from Server)

> Full official reference: https://www.gokgs.com/json/downstream.html

### Session & Authentication
| Message | Description | Implemented |
|---|---|---|
| `HELLO` | Server info (versionMajor, versionMinor, jsonClientBuild) | ✅ |
| `LOGIN_SUCCESS` | Successful login (you, friends, subscriptions, rooms) | ✅ |
| `LOGOUT` | Server-initiated logout | ✅ |
| `SESSION_EXPIRED` | Session became invalid | ✅ |
| `RECONNECT` | Auto-logged out due to duplicate login elsewhere | ✅ |
| `LOGIN_FAILED_NO_SUCH_USER` | User doesn't exist | ✅ |
| `LOGIN_FAILED_BAD_PASSWORD` | Wrong password | ✅ |
| `LOGIN_FAILED_KEEP_OUT` | Temporary ban | ✅ |
| `LOGIN_FAILED_USER_ALREADY_EXISTS` | User already logged in | ✅ |
| `CHANNEL_SUBSCRIBERS_ONLY` | Game access denied (KGS Plus required) | ✅ |
| `PRIVATE_KEEP_OUT` | Private game/room access denied | ✅ |
| `CHANNEL_NO_TALKING` | Chat disabled in channel | ❌ not handled |
| `CHANNEL_CHAT_ALLOWED` | Chat re-enabled in channel | ❌ not handled |
| `CHANNEL_ALREADY_JOINED` | Duplicate join attempt | ❌ not handled |
| `REGISTER_SUCCESS` | Account registration succeeded | ❌ not handled |
| `REGISTER_BAD_EMAIL` | Registration failed (bad email) | ❌ not handled |
| `DELETE_ACCOUNT_SUCCESS` | Account deletion succeeded | ❌ not handled |
| `IDLE_WARNING` | Server inactivity warning | ✅ (always answered with WAKE_UP — the JSON API has no PING, so this is the only keep-alive; if we had sent IDLE_ON, it is immediately re-asserted so we stay connected but still look idle) |
| `ANNOUNCEMENT` | Global announcement text | ✅ |

**Source:** `src/model/session.js`

---

### Game Messages
| Message | Description | Implemented |
|---|---|---|
| `GAME_JOIN` | Joined a game channel | ✅ |
| `GAME_UPDATE` | Move sequence (sgfEvents) | ✅ |
| `GAME_STATE` | Current game state (flags, actions, clocks, score) | ✅ |
| `GAME_NAME_CHANGE` | Game renamed | ✅ |
| `GAME_LIST` | Game list updates | ✅ |
| `GAME_NOTIFY` | Game awareness alert | ✅ |
| `GAME_REVIEW` | Review game response | ✅ |
| `GAME_OVER` | Game ended (score) | ✅ (marks the channel `over`, patches score + clears `inPlay` on the own-archive summary) |
| `GAME_CONTAINER_REMOVE_GAME` | Game removed from list | ❌ ignored |
| `GAME_UNDO_REQUEST` | Undo requested by opponent | ✅ |
| `GAME_UNDO_DECLINE` | Undo declined | ✅ |
| `GAME_TIME_EXPIRED` | Clock ran out | ❌ ignored |
| `GAME_STARTED` | Game loaded/begun (gameSummary) | ❌ not handled |
| `GAME_ALL_PLAYERS_GONE` | All players disconnected | ❌ not handled |
| `GAME_EDITOR_LEFT` | Review editor left | ❌ not handled |
| `GAME_PREP_STATUS` | Game paused (prepType, time) | ❌ not handled |
| `GAME_LOOP_WARNING` | Ko/repeated position warning | ❌ not handled |
| `GAMELISTENTRY_PLAYER_REPLACED` | Player substituted in game | ❌ not handled |
| `CANT_PLAY_TWICE` | Already playing in another game | ❌ not handled |
| `GLOBAL_GAMES_JOIN` | Joined global games list | ✅ |
| `AUTOMATCH_PREFS` | Automatch preferences received | ❌ received, no UI |
| `AUTOMATCH_STATUS` | Automatch queue state (enabled) | ❌ not handled |
| `TOURN_NOTIFY` | Tournament game alert | ❌ not handled |

**Source:** `src/model/game/message.js`

---

### Challenge Messages
| Message | Description | Implemented |
|---|---|---|
| `CHALLENGE_JOIN` | Joined challenge channel | ✅ |
| `CHALLENGE_PROPOSAL` | Received a challenge proposal | ✅ |
| `CHALLENGE_SUBMIT` | Owner notified of incoming proposal | ✅ |
| `CHALLENGE_DECLINE` | Challenge was declined | ✅ |
| `CHALLENGE_FINAL` | Challenge finalized (game created) | ✅ |
| `CHALLENGE_CREATED` | Challenge initialized (callbackKey, game) | ❌ ignored |
| `CHALLENGE_NOT_CREATED` | Challenge creation failed | ❌ not handled |
| `CHALLENGE_CANT_PLAY_RANKED` | Ranked rules violated | ❌ not handled |

---

### Room Messages
| Message | Description | Implemented |
|---|---|---|
| `ROOM_JOIN` | Joined a room (games, users) | ✅ |
| `ROOM_NAMES` | Room names data | ✅ |
| `ROOM_DESC` | Room description (description, owners) | ✅ |
| `ROOM_CHANNEL_INFO` | Room category information | ✅ |
| `ROOM_NAME_FLUSH` | Room names data invalidated | ✅ |
| `ROOM_CREATED` | Room creation success | ❌ not handled |
| `ROOM_CAT_COUNTERS` | Room statistics (numUsers, numGames) | ❌ not handled |
| `ROOM_CAT_ROOM_GONE` | Room left category | ❌ not handled |
| `ACCESS_LIST` | Private room access list | ❌ not handled |

**Source:** `src/model/room.js`

---

### Chat & Communication Messages
| Message | Description | Implemented |
|---|---|---|
| `CHAT` | Chat message (user, text) | ✅ |
| `ANNOUNCE` | Bold announcement (user, text) | ✅ |
| `MODERATED_CHAT` | Moderated chat message | ✅ |
| `CONVO_JOIN` | Direct conversation started | ✅ |
| `CONVO_NO_SUCH_USER` | Target user doesn't exist | ✅ |
| `CONVO_NO_CHATS` | User has blocked messaging | ❌ not handled |
| `MESSAGES` | Mailbox contents (messages array) | ❌ not handled |
| `MESSAGE_CREATE_SUCCESS` | Mailbox message sent | ❌ not handled |
| `MESSAGE_CREATE_NO_USER` | Mailbox delivery failed — no user | ❌ not handled |
| `MESSAGE_CREATE_FULL` | Mailbox delivery failed — full | ❌ not handled |
| `MESSAGE_CREATE_CONNECTED` | Target user is online | ❌ not handled |

**Source:** `src/model/conversation.js`

---

### User Messages
| Message | Description | Implemented |
|---|---|---|
| `USER_ADDED` | User added to room/game | ✅ |
| `USER_REMOVED` | User removed from room/game | ✅ |
| `USER_UPDATE` | User flags changed | ✅ |
| `AVATAR` | User avatar image data | ❌ not handled |

**Source:** `src/model/user.js`

---

### Friend & Social Messages
| Message | Description | Implemented |
|---|---|---|
| `FRIEND_ADD_SUCCESS` | Friend added | ✅ |
| `FRIEND_REMOVE_SUCCESS` | Friend removed | ✅ |
| `FRIEND_CHANGE_NO_USER` | Friend update failed | ✅ |
| `KEEP_OUT_SUCCESS` | User blocked successfully | ❌ not handled |
| `KEEP_OUT_LOGIN_NOT_FOUND` | Block target not found | ❌ not handled |
| `CLEAR_KEEP_OUT_SUCCESS` | Block lifted | ❌ not handled |
| `TOO_MANY_KEEP_OUTS` | Block limit reached | ❌ not handled |

---

### User Details Messages
| Message | Description | Implemented |
|---|---|---|
| `DETAILS_JOIN` | Joined user details channel | ✅ |
| `DETAILS_UPDATE` | User info changed (name, info, email, rank prefs) | ✅ |
| `DETAILS_NONEXISTANT` | User doesn't exist | ✅ |
| `DETAILS_RANK_GRAPH` | Rank history data | ✅ |

---

### Archive Messages
| Message | Description | Implemented |
|---|---|---|
| `ARCHIVE_JOIN` | Joined archive (game history) | ✅ |
| `ARCHIVE_GAMES_CHANGED` | Archive games updated | ✅ |
| `ARCHIVE_GAME_REMOVED` | Game removed from archive | ✅ |
| `ARCHIVE_NONEXISTANT` | Archive not found | ❌ not handled |
| `LOAD_FAILED` | Archive game load error | ❌ not handled |
| `FETCH_TAGS_RESULT` | Game tags returned — the timestamp→tag map is spread directly on the message (alongside `type`); there is **no** nested `tags` field | ✅ |

---

### Channel Management Messages
| Message | Description | Implemented |
|---|---|---|
| `JOIN_COMPLETE` | Channel join completed | ✅ |
| `UNJOIN` | Unjoined channel | ✅ |
| `CLOSE` | Channel closed | ✅ |

**Source:** `src/model/channel.js`

---

### Playback Messages (Not Yet Implemented)
| Message | Description | Implemented |
|---|---|---|
| `PLAYBACK_ADD` | Playback listings (dateStamp, gameSummary) | ❌ stub |
| `PLAYBACK_DATA` | Live playback move data | ❌ stub |
| `PLAYBACK_SETUP` | Playback ready (gameSummary) | ❌ stub |
| `PLAYBACK_JOIN` | Playback viewing started | ❌ stub |
| `PLAYBACK_SEEK_START` | Seek initiated | ❌ stub |
| `PLAYBACK_SEEK_COMPLETE` | Seek finished | ❌ stub |
| `PLAYBACK_DELETE` | Playback removed (timeStamp) | ❌ stub |
| `PLAYBACK_ERROR` | Playback failure | ❌ stub |
| `ALREADY_IN_PLAYBACK` | Duplicate playback attempt | ❌ stub |

**Source:** `src/model/playback.js` — stubs only, not handled

---

### Server & Subscription Messages
| Message | Description | Implemented |
|---|---|---|
| `SYNC` | Sync completed (callbackKey) | ❌ ignored |
| `SERVER_STATS` | Server statistics (logins, accounts, rooms, games, uptime, version) | ✅ (shown in the network-activity widget's click panel) |
| `SUBSCRIPTION_UPDATE` | Subscription changed | ❌ not handled |
| `SUBSCRIPTION_LOW` | Subscription expiring soon | ❌ not handled |

---

## 2. CLIENT → SERVER COMMANDS (Sent to Server)

> Full official reference: https://www.gokgs.com/json/upstream.html

**Source:** `src/model/AppActions.js`

### Authentication & Account
| Command | Description | Implemented |
|---|---|---|
| `LOGIN` | Login (username, password, locale) | ✅ |
| `LOGOUT` | Disconnect | ✅ |
| `SET_PASSWORD` | Change password | ✅ |
| `REGISTER` | Create account from guest | ❌ |
| `DELETE_ACCOUNT` | Delete account (admin) | ❌ |
| `WAKE_UP` | Reset idle timeout / clear idle status | ✅ (sent on every IDLE_WARNING to keep the session alive — the JSON API's only keep-alive — and on local activity to clear an `IDLE_ON` we set) |
| `IDLE_ON` | Mark self idle — server greys us out for all other users | ✅ (sent after `_ACTIVE_WINDOW_MS` of no input on the tab; cleared by WAKE_UP on the next activity) |
| `SYNC_REQUEST` | Confirm command completion | ❌ |

---

### Channel & Room Management
| Command | Description | Implemented |
|---|---|---|
| `JOIN_REQUEST` | Join a game, room, or challenge channel | ✅ |
| `UNJOIN_REQUEST` | Leave a channel | ✅ |
| `ROOM_NAMES_REQUEST` | Request room names | ✅ |
| `ROOM_DESC_REQUEST` | Request room description | ✅ |
| `CREATE_ROOM_REQUEST` | Create a new room | ❌ |
| `ROOM_EDIT` | Edit room name/description | ❌ |
| `ROOM_ADD_OWNER` / `ROOM_REMOVE_OWNER` | Manage room owners | ❌ |
| `CHANNEL_ADD_ACCESS` / `CHANNEL_REMOVE_ACCESS` | Manage private channel access | ❌ |
| `ACCESS_LIST_REQUEST` | Get private channel access list | ❌ |
| `CHANNEL_DELETE` | Delete a channel (admin) | ❌ |

---

### Game Commands
| Command | Description | Implemented |
|---|---|---|
| `JOIN_GAME_BY_ID` | Join game by timestamp ID | ✅ |
| `GAME_MOVE` | Make a move (coordinates or "PASS") | ✅ |
| `GAME_MARK_LIFE` | Mark stones alive/dead during scoring | ✅ |
| `GAME_RESIGN` | Resign the game | ✅ |
| `GAME_UNDO_REQUEST` | Request an undo | ✅ |
| `GAME_UNDO_ACCEPT` | Accept an undo request | ✅ |
| `GAME_ADD_TIME` | Add time to a player's clock | ✅ |
| `GAME_SCORING_DONE` | Indicate scoring is complete | ✅ |
| `GAME_TIME_EXPIRED` | Indicate time has expired | ✅ |
| `ROOM_LOAD_GAME` | Load a saved game | ✅ |
| `GAME_START_REVIEW` | Convert game to review mode — takes **no** fields (sent to the finished game's channel); server replies with `GAME_REVIEW` creating an editable review channel where the requester is owner/editor | ✅ (Review button on finished games) |
| `GAME_SET_ROLES` | Assign player roles in review/demo | ✅ (demo: grant editor) |
| `GAME_SET_SCORES` | Record final game scores | ❌ |
| `KGS_SGF_CHANGE` | Add SGF notation events | ✅ (demo: place setup stones, moves, and markup — triangle/square/circle) |
| `GAME_SET_ALLOW_CHAT` | Control chat in moderated game | ❌ |
| `ROOM_CLONE_GAME` | Copy game into another room | ❌ |
| `GAME_LIST_ENTRY_SET_FLAGS` | Modify game/challenge flags | ❌ |

---

### Challenge Commands
| Command | Description | Implemented |
|---|---|---|
| `CHALLENGE_CREATE` | Create a new challenge | ✅ |
| `CHALLENGE_PROPOSAL` | Send a counter-proposal | ✅ |
| `CHALLENGE_SUBMIT` | Submit self as challenger | ✅ |
| `CHALLENGE_ACCEPT` | Accept a challenge proposal | ✅ |
| `CHALLENGE_DECLINE` | Decline a challenge proposal | ✅ |
| `CHALLENGE_RETRY` | Return to proposal editing | ❌ |

> 📄 See **[Challenge Negotiation Flow](#5-challenge-negotiation-flow)** below for the full owner/receiver handshake that determines when a game actually starts.

---

### Chat & Communication Commands
| Command | Description | Implemented |
|---|---|---|
| `CHAT` | Send chat message (room, game, or direct) | ✅ |
| `CONVO_REQUEST` | Request a conversation with a user | ✅ |
| `ANNOUNCE` | Bold announcement (admin/owner only) | ❌ |
| `ANNOUNCE_TO_PLAYERS` | Announce to game players | ❌ |
| `MESSAGE_CREATE` | Leave message in user's mailbox | ❌ |
| `MESSAGE_DELETE` | Delete mailbox messages | ❌ |
| `SET_CHAT_MODE` | Change channel moderation (teacher) | ❌ |
| `MODERATED_COMMENT` | Moderator accepts a message | ❌ |

---

### User Commands
| Command | Description | Implemented |
|---|---|---|
| `DETAILS_JOIN_REQUEST` | Request user details | ✅ |
| `DETAILS_CHANGE` | Update own profile | ✅ |
| `DETAILS_RANK_GRAPH_REQUEST` | Request rank graph data | ✅ |
| `JOIN_ARCHIVE_REQUEST` | Join user's game archive | ✅ |
| `AVATAR_REQUEST` | Request user avatar | ❌ |
| `UPLOAD_AVATAR` | Upload new avatar image | ❌ |

---

### Automatch Commands
| Command | Description | Implemented |
|---|---|---|
| `AUTOMATCH_CREATE` | Activate automatch with preferences | ❌ |
| `AUTOMATCH_SET_PREFS` | Update automatch preferences | ❌ |
| `AUTOMATCH_CANCEL` | Cancel automatch queue | ❌ |

---

### Friend & Social Commands
| Command | Description | Implemented |
|---|---|---|
| `FRIEND_ADD` | Add friend/fan/censor | ✅ |
| `FRIEND_REMOVE` | Remove friend/fan/censor | ✅ |
| `KEEP_OUT_REQUEST` | Block a user (admin) | ❌ |
| `CLEAR_KEEP_OUT` | Unblock a user (admin) | ❌ |

---

### Game Lists & Playback Commands
| Command | Description | Implemented |
|---|---|---|
| `GLOBAL_LIST_JOIN_REQUEST` | Join global game list (`ACTIVES` or `CHALLENGES`) | ✅ |
| `START_PLAYBACK` | Create playback channel | ❌ |
| `REQUEST_PLAYBACK_LIST` | Fetch available playbacks | ❌ |
| `PLAYBACK_SET` | Adjust playback position/speed | ❌ |

---

### Tagging Commands
| Command | Description | Implemented |
|---|---|---|
| `TAG_GAME` | Apply tag to a game (`gameTimestamp`, `text`; empty `text` clears) — no `channelId` | ✅ |
| `FETCH_TAGS` | Retrieve personal tag database — takes **no** fields (global request); sent on own-archive join | ✅ |
| `ADMIN_CLEAR_TAG` | Remove tag (admin) | ❌ |

---

### Admin Commands
| Command | Description | Implemented |
|---|---|---|
| `ANNOUNCEMENT` | Broadcast to all channels (admin) | ❌ |
| `REQUEST_SERVER_STATS` | Get server statistics | ✅ (sent when the network-activity stats panel is opened) |
| `SHUTDOWN` | Shut down server (admin) | ❌ |

---

## 3. KEY FILES

| File | Purpose |
|---|---|
| `src/model/AppActions.js` | All client→server commands |
| `src/model/session.js` | Session and auth message handlers |
| `src/model/game/message.js` | Game message handlers |
| `src/model/room.js` | Room message handlers |
| `src/model/conversation.js` | Chat message handlers |
| `src/model/user.js` | User message handlers |
| `src/model/channel.js` | Channel lifecycle handlers |
| `src/model/playback.js` | Playback stubs (not implemented) |
| `src/model/KgsClient.js` | HTTP client (`/api/json-cors/access`) |
| `src/model/types.js` | Flow type definitions for all entities |
| `src/model/index.js` | Main message dispatcher (`handleMessage`) |

---

## 4. USER LISTS API SPECIFICATION

The KGS protocol handles user relationships through three server-side lists (`friendType`):
* `buddy`: Primary friends list. Buddies are monitored for online/offline status.
* `fan`: Follow list. Indicates you are a fan/follower of the user.
* `censored`: Block list. Restricts interactions and messages from the user.

### Upstream Commands (Client → Server)

#### FRIEND_ADD
Sent to add a user to a list or update their notes. A positive non-zero `callbackKey` is required.
```json
{
  "type": "FRIEND_ADD",
  "friendType": "buddy" | "fan" | "censored",
  "name": "username",
  "text": "optional notes or description",
  "callbackKey": 1
}
```

#### FRIEND_REMOVE
Sent to remove a user from a list. A positive non-zero `callbackKey` is required.
```json
{
  "type": "FRIEND_REMOVE",
  "friendType": "buddy" | "fan" | "censored",
  "name": "username",
  "callbackKey": 1
}
```

### Downstream Messages (Server → Client)

#### LOGIN_SUCCESS
Includes the user's initial lists inside the `friends` field.
```json
{
  "type": "LOGIN_SUCCESS",
  "you": { ... },
  "friends": [
    {
      "friendType": "buddy" | "fan" | "censored",
      "user": { "name": "username", "rank": "1d", ... },
      "notes": "note text"
    }
  ]
}
```

#### FRIEND_ADD_SUCCESS
Broadcast when a user is successfully added to a list.
```json
{
  "type": "FRIEND_ADD_SUCCESS",
  "friendType": "buddy" | "fan" | "censored",
  "user": { "name": "username", "rank": "1d", ... },
  "notes": "note text"
}
```

#### FRIEND_REMOVE_SUCCESS
Broadcast when a user is successfully removed from a list.
```json
{
  "type": "FRIEND_REMOVE_SUCCESS",
  "friendType": "buddy" | "fan" | "censored",
  "user": { "name": "username", ... }
}
```

#### FRIEND_CHANGE_NO_USER
Received if the target username does not exist on the server.
```json
{
  "type": "FRIEND_CHANGE_NO_USER",
  "friendType": "buddy" | "fan" | "censored",
  "name": "username"
}
```

---

## 5. CHALLENGE NEGOTIATION FLOW

> ✅ Verified against the behavior of the official CGOBAN client — this is the authoritative reference for how a challenge becomes a game.

### Roles

| Role | Definition |
|---|---|
| **OWNER** | The user who **creates** the challenge (`CHALLENGE_CREATE`). Holds the challenge channel. In a proposal's `players`, the owner has role `0` (`challengeCreator`). |
| **RECEIVER** | A user who joins the owner's challenge and offers to play (the *challenger*). |

### The golden rule

**A game only starts after BOTH sides have agreed on the *same* proposal.** Concretely, the game is finalized (server emits `CHALLENGE_FINAL`) only once the **OWNER** has confirmed the proposal the RECEIVER offered. The RECEIVER agreeing alone is never enough — the OWNER is the one who closes the negotiation.

The RECEIVER cannot edit the settings: when joining, they see the owner's settings and may only offer to play them as-is (sending `CHALLENGE_SUBMIT` / `CHALLENGE_PROPOSAL` with the owner's exact settings). Editing is exclusively the OWNER's privilege.

### FIRST CASE — owner accepts unchanged → instant start

```
1. OWNER    CHALLENGE_CREATE        creates the challenge with settings S
2. RECEIVER CHALLENGE_SUBMIT        joins and offers to play settings S (cannot modify them)
3. OWNER    CHALLENGE_PROPOSAL (S)  owner confirms the unchanged settings S  ── "owner accepts"
   ↓ because the owner's confirmed proposal equals what the RECEIVER offered,
     the RECEIVER's client AUTO-fires CHALLENGE_ACCEPT (S) on the receiver's behalf
4. SERVER   CHALLENGE_FINAL         game created → GAME START
```

From the OWNER's point of view this looks like a single click ("Accept") that immediately starts the game, because the RECEIVER's accept is automatic and silent.

### SECOND CASE — owner modifies settings → receiver must re-accept

```
1. OWNER    CHALLENGE_CREATE         creates the challenge with settings S
2. RECEIVER CHALLENGE_SUBMIT         joins and offers to play settings S (cannot modify them)
3. OWNER    CHALLENGE_PROPOSAL (S')  owner changes some setting → new settings S' ≠ S
   ↓ because S' ≠ what the RECEIVER offered, NO auto-accept happens;
     the RECEIVER is shown the new proposal S' and must decide
4. RECEIVER CHALLENGE_ACCEPT (S')    receiver manually accepts the modified settings
5. SERVER   CHALLENGE_FINAL          game created → GAME START
```

### Implementation notes (Kido)

- The OWNER **never** sends `CHALLENGE_ACCEPT`. The owner finalizes by sending `CHALLENGE_PROPOSAL` (their confirmed settings); the server bounces that proposal to the RECEIVER. Kido guards against the owner accepting their own echoed proposal via an `isCreator` check in `onReceiveChallengeProposal` (`src/model/AppActions.js`).
- The RECEIVER's client compares the incoming `CHALLENGE_PROPOSAL` to the proposal it previously sent (`proposalsEqual`, `src/model/game/challenge.js`):
  - **equal** → auto-fire `CHALLENGE_ACCEPT` (FIRST CASE, instant start).
  - **not equal** → show the new proposal and wait for the user to accept (SECOND CASE).
- `CHALLENGE_ACCEPT` must carry players in **name-only** form (`{ role, name }`), not full `user` objects — the server delivers proposal players as `user` objects, so they must be normalized before re-sending.
- The `CHALLENGE_PROPOSAL` reducer in `src/model/game/message.js` overwrites the stored `sentProposal` with the incoming proposal; the dispatcher snapshots the previous `sentProposal` **before** dispatch so the equality check compares against what the receiver actually sent.

Confirmed behavior of the official client:
- The OWNER (creator) sends `CHALLENGE_PROPOSAL`; the RECEIVER (non-creator) sends `CHALLENGE_ACCEPT`. The server emits `CHALLENGE_FINAL` after the receiver's accept.
- When the receiver gets a `CHALLENGE_PROPOSAL` while their pending action is accept **and** the proposal equals the one they last sent, the official client auto-fires the accept.
