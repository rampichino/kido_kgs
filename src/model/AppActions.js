// @flow
import { AppStore } from "./AppStore";
import { KgsClient } from "./KgsClient";
import { tempId, isTempId } from "./tempId";
import { prepareSavedAppState } from "./appState";
import { saveFilter } from "../util/filterPrefs";
import { getStoredLocale } from "../util/locale";
import { isDirectApi } from "../util/platform";
import { get as idbGet } from "idb-keyval";
import {
  loadChatHistory,
  clearChatHistory,
  setChatHistoryClosed,
} from "../util/chatHistory";
import {
  isGamePlayer,
  isGameEditor,
  isGameOwner,
  isDemoOrReview,
  isGameProposalPlayer,
  proposalsEqual,
  validateMove,
  validateRuleSet,
  getSimulMatchup,
  getRengoMatchup,
  isDirectChallenge,
} from "./game";
import {
  SOUNDS,
  playSound,
  playLocalStoneSound,
  clearLocalStonePlay,
} from "../sound";
import type {
  GameChannel,
  GameFilter,
  GameProposal,
  GameSummary,
  GameRole,
  GameRules,
  GameRuleSet,
  TimeSystem,
  ProposalVisibility,
  NavOption,
  KgsMessage,
  User,
  UserDetails,
  Room,
  Point,
  PlayerColor,
  AutomatchPrefs,
} from "./types";
import { distinct } from "../util/collection";
import { v4 as uuidV4 } from "uuid";

const APP_STATE_SAVE_KEY = "savedAppState";

function sanitizeRules(rules: GameRules): GameRules {
  let sanitized = { ...rules };
  if (sanitized.handicap === 0 || sanitized.handicap === undefined) {
    delete sanitized.handicap;
  }
  let { timeSystem } = sanitized;
  if (timeSystem === "none") {
    delete sanitized.mainTime;
    delete sanitized.byoYomiTime;
    delete sanitized.byoYomiPeriods;
    delete sanitized.byoYomiStones;
  } else if (timeSystem === "absolute") {
    delete sanitized.byoYomiTime;
    delete sanitized.byoYomiPeriods;
    delete sanitized.byoYomiStones;
  } else if (timeSystem === "byo_yomi") {
    delete sanitized.byoYomiStones;
  } else if (timeSystem === "canadian") {
    delete sanitized.byoYomiPeriods;
  }
  return sanitized;
}

function sanitizeProposal(
  proposal: GameProposal,
  submitterName?: string,
  keepName?: string
): Object {
  let otherProps = { ...proposal };
  delete otherProps.status;
  let players = otherProps.players;
  if (otherProps.gameType === "simul" && Array.isArray(players)) {
    // Standard handicap-derived komi (0.5 on a handicap board, the standard
    // board komi otherwise). A Kido challenger may not pick a custom komi, so
    // their own outgoing slot is always forced to this value.
    let boardKomi =
      otherProps.rules && typeof otherProps.rules.komi === "number"
        ? otherProps.rules.komi
        : 6.5;
    players = players.map((p) => {
      if (p.role === "black") {
        let handicap = typeof p.handicap === "number" ? p.handicap : 0;
        let komi = typeof p.komi === "number" ? p.komi : 0;
        let name = p.user ? p.user.name : p.name;
        let cleaned = { ...p, handicap, komi };
        // handicapSet is a UI-only marker; never send it to the server.
        delete cleaned.handicapSet;
        // When submitting as a challenger, only include your own name in your
        // slot — other challengers' names must be omitted or the server rejects.
        if (submitterName && name && name !== submitterName) {
          delete cleaned.name;
          delete cleaned.user;
        }
        // A Kido challenger can't choose komi: force the standard value on
        // their own slot when submitting their proposal.
        if (submitterName && name && name === submitterName) {
          cleaned.komi = handicap > 0 ? 0.5 : boardKomi;
        }
        return cleaned;
      }
      return p;
    });
  } else if (otherProps.gameType === "rengo" && Array.isArray(players)) {
    // Rengo carries the single game handicap/komi on `rules`, not per seat.
    // The color setup (fixed colors or nigiri) is the creator's choice and is
    // preserved as-is; the challenger only takes a seat. Strip per-player
    // handicap/komi and the UI-only handicapSet marker. When submitting as a
    // challenger keep our own seat AND the owner's seat named (the server
    // validates that the owner is present), dropping only other challengers.
    players = players.map((p) => {
      let name = p.user ? p.user.name : p.name;
      let cleaned = { ...p };
      delete cleaned.handicap;
      delete cleaned.komi;
      delete cleaned.handicapSet;
      if (
        submitterName &&
        name &&
        name !== submitterName &&
        name !== keepName
      ) {
        delete cleaned.name;
        delete cleaned.user;
      }
      return cleaned;
    });
  }
  let rules = sanitizeRules(proposal.rules);
  // Nigiri means colors aren't decided yet, so there can be no handicap.
  if (otherProps.nigiri) {
    rules = { ...rules };
    delete rules.handicap;
  }
  return {
    ...otherProps,
    players,
    rules,
  };
}

// DOM input events that count as the local user being "active" for presence.
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];

export class AppActions {
  _store: AppStore;
  _client: KgsClient;
  _history: Object;
  // Decline messages awaiting their conversation channel, keyed by the
  // CONVO_REQUEST callbackKey. Flushed when the matching CONVO_JOIN arrives.
  _pendingDeclineChats: { [number]: string } = {};

  // Timers that resolve an optimistic "Sending..." message if the server never
  // echoes it back (e.g. recipient went offline). Keyed by message id.
  _sendTimers: { [string]: TimeoutID } = {};

  // Metadata for each live send timer so an arriving echo can match and cancel
  // the right timer (the echo carries channelId + text, not our message id).
  _sendTimerMeta: { [string]: { channelId: number, text: string } } = {};

  // --- Idle / presence -------------------------------------------------------
  // Track local input on the Kido tab. After ACTIVE_WINDOW_MS with no input we
  // send IDLE_ON so the KGS server greys us out for everyone; the next input
  // sends WAKE_UP to bring us back online. (IDLE_ON / WAKE_UP are the real
  // upstream presence commands — see KGS_Protocol_Reference.md.)
  _ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 min of no input → idle
  _IDLE_CHECK_MS = 30 * 1000; // how often we re-check inactivity
  _lastActivity = 0;
  _idleSent = false;
  _idleTimer: ?IntervalID = null;
  _activityListener: ?() => void = null;
  _visibilityListener: ?() => void = null;

  // Begin tracking local input + the idle check. Called on login. Idempotent:
  // tears down any prior tracking first so a re-login always re-arms cleanly.
  _startActivityTracking = () => {
    if (typeof window === "undefined") {
      return;
    }
    this._stopActivityTracking();
    this._lastActivity = Date.now();
    this._idleSent = false;
    let onActivity = () => {
      this._lastActivity = Date.now();
      // Coming back from idle wakes us on the server immediately.
      if (this._idleSent) {
        this._idleSent = false;
        if (!this._isOffline()) {
          this._send({ type: "WAKE_UP" });
        }
      }
    };
    // Switching AWAY from the tab (becoming hidden) must NOT count as activity —
    // only the tab becoming visible again does. Otherwise leaving the tab would
    // immediately reset the idle timer.
    let onVisibility = () => {
      if (!document.hidden) {
        onActivity();
      }
    };
    this._activityListener = onActivity;
    this._visibilityListener = onVisibility;
    for (let ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    this._idleTimer = setInterval(() => {
      let inactive = Date.now() - this._lastActivity >= this._ACTIVE_WINDOW_MS;
      if (inactive && !this._idleSent && !this._isOffline()) {
        this._idleSent = true;
        this._send({ type: "IDLE_ON" });
      }
    }, this._IDLE_CHECK_MS);
  };

  // Stop tracking + clear the idle timer. Called on logout.
  _stopActivityTracking = () => {
    if (this._idleTimer !== null && this._idleTimer !== undefined) {
      clearInterval(this._idleTimer);
      this._idleTimer = null;
    }
    if (this._activityListener && typeof window !== "undefined") {
      for (let ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, this._activityListener);
      }
      if (this._visibilityListener) {
        document.removeEventListener(
          "visibilitychange",
          this._visibilityListener
        );
      }
    }
    this._activityListener = null;
    this._visibilityListener = null;
    this._idleSent = false;
  };

  // Single live instance (the app creates exactly one). Lets leaf components
  // like PlayerHoverCard reach friend actions without threading them through
  // every intermediate UserName/list call site.
  static instance: ?Object = null;

  constructor(store: AppStore, client: KgsClient, history: Object) {
    this._store = store;
    this._client = client;
    this._history = history;
    AppActions.instance = this;
  }

  _isOffline = () => {
    let { status, network } = this._store.getState().clientState;
    return status === "loggedOut" || network !== "online";
  };

  // --- Silent reconnect ------------------------------------------------------
  // Backgrounding the app (especially on Android) suspends the WebView, so the
  // long-poll stops and KGS reaps the session; returning to the app would drop
  // the user on the login screen. When the session dies on its own and we hold
  // saved credentials, log back in silently instead.
  _userLoggedOut: boolean = false;
  _blockAutoReconnect: boolean = false;
  _reconnectAttempts: number = 0;
  _RECONNECT_MAX_ATTEMPTS = 3;
  _RECONNECT_DELAY_MS = 1500;
  _RECONNECT_TIMEOUT_MS = 20 * 1000;
  _reconnectWatchdog: ?TimeoutID = null;

  // Called by App when the client goes loggedIn → loggedOut.
  onSessionLost = () => {
    // Only where login needs no CAPTCHA (native app / extension). On the web
    // the proxy rejects a token-less LOGIN, so a silent retry can't work.
    if (!isDirectApi()) {
      return;
    }
    if (this._userLoggedOut || this._blockAutoReconnect) {
      return;
    }
    if (this._reconnectAttempts >= this._RECONNECT_MAX_ATTEMPTS) {
      this._store.dispatch({ type: "RECONNECT_END" });
      return;
    }
    this._reconnectAttempts++;
    this._store.dispatch({ type: "RECONNECT_START" });
    idbGet("savedLogin")
      .then((saved) => {
        if (!saved || !saved.username || !saved.password) {
          // Nothing stored (user didn't tick "save password") — fall back to
          // the normal login screen.
          this._store.dispatch({ type: "RECONNECT_END" });
          return;
        }
        setTimeout(() => {
          if (this._store.getState().currentUser) {
            return;
          }
          this._client.login(
            saved.username,
            saved.password,
            null,
            getStoredLocale()
          );
          // A login that fails on the network never produces a server message,
          // so nothing would clear the "Reconnecting…" state. Re-check, and
          // either try again or hand over to the login screen.
          if (this._reconnectWatchdog) {
            clearTimeout(this._reconnectWatchdog);
          }
          this._reconnectWatchdog = setTimeout(() => {
            this._reconnectWatchdog = null;
            if (this._store.getState().currentUser) {
              return;
            }
            if (this._reconnectAttempts >= this._RECONNECT_MAX_ATTEMPTS) {
              this._store.dispatch({ type: "RECONNECT_END" });
              return;
            }
            this.onSessionLost();
          }, this._RECONNECT_TIMEOUT_MS);
        }, this._RECONNECT_DELAY_MS);
      })
      .catch(() => {
        this._store.dispatch({ type: "RECONNECT_END" });
      });
  };

  // Cheap session probe for tab-wake / network-return: a fresh POST settles
  // within seconds — 404 means the session is dead (noClient → clean logout,
  // login screen right away), 200 means the pipe works — while the hung
  // long-poll a sleeping machine leaves behind can take up to 150s to time
  // out, freezing the UI in the meantime. SYNC_REQUEST is the protocol's
  // designed no-op round-trip. Deliberately not gated on _isOffline():
  // network may be flagged "error" after a wake, which is exactly the state
  // the probe resolves. Throttled — visibility events fire in bursts.
  _lastSessionProbe = 0;
  _SESSION_PROBE_THROTTLE_MS = 10 * 1000;

  onProbeSession = () => {
    if (this._client.state.status !== "loggedIn") {
      return;
    }
    let now = Date.now();
    if (now - this._lastSessionProbe < this._SESSION_PROBE_THROTTLE_MS) {
      return;
    }
    this._lastSessionProbe = now;
    this._send({ type: "SYNC_REQUEST", callbackKey: 1 });
  };

  // All fire-and-forget outgoing messages go through here so a rejected send
  // (e.g. a 400 badRequest) never becomes an unhandled promise rejection or
  // trips the offline alert. Await sendMessage directly only when the caller
  // needs the result and handles errors itself.
  _send = (msg: KgsMessage, opts?: Object) => {
    this._client.sendMessage(msg, opts).catch(() => {});
  };

  onSaveAppState = () => {
    this._store.saveState(APP_STATE_SAVE_KEY, prepareSavedAppState);
  };

  onRestoreAppState = () => {
    this._store.restoreSavedState(APP_STATE_SAVE_KEY, (appState) => {
      this._client.setState(appState.clientState);
      this._store.dispatch({ type: "APP_STATE_INITIALIZED" });
      let clientStatus = appState.clientState.status;
      // TODO - if it's been longer than ~5 mins, log out
      if (clientStatus === "loggedIn") {
        // Resume receive loop from previous session
        this._client.poll();
        // A restored session skips onLoginSuccess, so start idle tracking here
        // too — otherwise reloading the page would leave us never going idle.
        this._startActivityTracking();
      } else if (clientStatus !== "loggedOut") {
        // In transition; could be inconsistent - bail out. Local reset only:
        // the restored session is stale, so a network LOGOUT can only 404
        // (noise in the console); KGS reaps dead sessions by itself.
        this.onLogout({ localOnly: true });
      }
    });
  };

  onReceiveServerMessages = (msgs: Array<KgsMessage>) => {
    let prevDirectIds = this._directChallengeIds();

    // The CHALLENGE_PROPOSAL reducer overwrites a challenge's sentProposal with
    // the incoming proposal, so capture what we last sent BEFORE dispatch — the
    // challenger needs it to decide whether the owner's reply matches (and so
    // can be auto-accepted) or differs (and must be reviewed).
    let prevSentProposals: { [number]: ?GameProposal } = {};
    let msgList = Array.isArray(msgs) ? msgs : [msgs];
    let preState = this._store.getState();
    for (let msg of msgList) {
      if (msg.type === "CHALLENGE_PROPOSAL" && msg.channelId) {
        let chan = preState.gamesById[msg.channelId];
        prevSentProposals[msg.channelId] = chan ? chan.sentProposal : null;
      }
    }

    this._store.dispatch(msgs);

    // A direct challenge addressed to us that wasn't in the list before this
    // batch is a new incoming invitation — notify with the same sound as a
    // received challenge proposal. (Same detection that lights the Play dot.)
    let nextDirectIds = this._directChallengeIds();
    let hasNewDirect = Object.keys(nextDirectIds).some(
      (id) => !prevDirectIds[id]
    );
    if (hasNewDirect) {
      playSound(SOUNDS.CHALLENGE_PROPOSAL_RECEIVED);
    }

    // Follow-up actions we know we need to take, even without user interaction
    msgs = Array.isArray(msgs) ? msgs : [msgs];
    for (let msg of msgs) {
      if (msg.type === "LOGIN_SUCCESS") {
        this._reconnectAttempts = 0;
        this.onLoginSuccess();
      } else if (
        msg.type === "RECONNECT" ||
        msg.type === "LOGIN_FAILED_BAD_PASSWORD" ||
        msg.type === "LOGIN_FAILED_NO_SUCH_USER" ||
        msg.type === "LOGIN_FAILED_KEEP_OUT"
      ) {
        // The server ended this session on purpose (logged in elsewhere) or
        // our stored credentials are no longer valid — stop retrying and let
        // the login screen explain.
        this._blockAutoReconnect = true;
        this._store.dispatch({ type: "RECONNECT_END" });
      } else if (msg.type === "IDLE_WARNING") {
        // KGS warns before idle-disconnecting an inactive session. The JSON
        // API has no PING keep-alive (unlike the raw-socket protocol — see
        // IDLE_KEEPALIVE.md), so WAKE_UP is the only way to stay connected.
        // Always answer it: letting the warning pass killed live sessions,
        // including mid-game while pondering an opponent's long think. If we
        // had deliberately gone idle (IDLE_ON, see _idleSent), immediately
        // re-assert it so others keep seeing the idle dot — net effect is
        // "connected but idle", which is what a PING would have given us.
        if (!this._isOffline()) {
          this._send({ type: "WAKE_UP" });
          if (this._idleSent) {
            this._send({ type: "IDLE_ON" });
          }
        }
      } else if (msg.type === "CHALLENGE_FINAL" && msg.channelId) {
        this.onChallengeFinalized(
          msg.proposal,
          msg.channelId,
          msg.gameChannelId
        );
      } else if (msg.type === "CHALLENGE_PROPOSAL" && msg.channelId) {
        this.onReceiveChallengeProposal(
          msg.channelId,
          msg.proposal,
          prevSentProposals[msg.channelId]
        );
      } else if (msg.type === "CHALLENGE_SUBMIT" && msg.channelId) {
        this.onReceiveChallengeSubmit(msg.channelId);
      } else if (msg.type === "CONVO_JOIN" && msg.channelId) {
        this._flushPendingDeclineChat(msg);
      } else if (msg.type === "CHAT" && msg.channelId && msg.user) {
        this.onReceiveDirectMessage(msg.channelId);
        this._clearPresenceOnOwnEcho(msg.channelId, msg);
      } else if (msg.type === "ARCHIVE_JOIN" && msg.channelId) {
        this.onArchiveJoinSuccess(msg.channelId, msg.user);
      } else if (msg.type === "GLOBAL_GAMES_JOIN" || msg.type === "GAME_LIST") {
        this.onCheckRoomNames(msg.games);
      } else if (msg.type === "GAME_JOIN" && msg.channelId) {
        this.onGameJoined(msg.channelId);
      } else if (msg.type === "GAME_TIME_EXPIRED" && msg.channelId) {
        this.onGameTimeExpired(msg.channelId);
      }
    }
  };

  onLogin = (username: ?string, password: ?string, captchaToken: ?string) => {
    if (!username || !password) {
      this._store.dispatch({ type: "LOGIN_FAILED_MISSING_INFO" });
      return;
    }
    this._userLoggedOut = false;
    this._blockAutoReconnect = false;
    this._reconnectAttempts = 0;
    this._store.dispatch({ type: "LOGIN_START" });
    // Send the locale the user picked in edit-profile (KGS only accepts it at
    // login, never via DETAILS_CHANGE), defaulting to en_US when unset.
    this._client.login(username, password, captchaToken, getStoredLocale());
  };

  onLoginSuccess = () => {
    let state = this._store.getState();

    // Track local activity so we send IDLE_ON when away and WAKE_UP on return.
    this._startActivityTracking();

    // Make sure URL is sync'd with state
    this._history.replace("/" + state.nav);

    // Auto-join game lists
    this._send({
      type: "GLOBAL_LIST_JOIN_REQUEST",
      list: "ACTIVES",
    });
    this._send({
      type: "GLOBAL_LIST_JOIN_REQUEST",
      list: "CHALLENGES",
    });

    // Get own recent games list (mainly useful for showing unfinished games)
    let { currentUser } = state;
    if (currentUser) {
      this._send({
        type: "JOIN_ARCHIVE_REQUEST",
        name: currentUser.name,
      });
      this._send({
        type: "DETAILS_JOIN_REQUEST",
        name: currentUser.name,
      });
    }

    // The LOGIN_SUCCESS friends snapshot can carry incomplete flags, so pull
    // fresh online/offline status for the whole buddy list once at login. This
    // makes the friends badge/count correct before the panel is ever opened
    // (opening it refreshes again — see onRefreshBuddyPresence). Pass true so
    // the count badge stays hidden until these fresh flags settle.
    this.onRefreshBuddyPresence(true);
  };

  onShowUnderConstruction = () => {
    this._store.dispatch({
      type: "SHOW_UNDER_CONSTRUCTION",
    });
  };

  onHideUnderConstruction = () => {
    this._store.dispatch({
      type: "HIDE_UNDER_CONSTRUCTION",
    });
  };

  onHideChallengeTakenNotice = () => {
    this._store.dispatch({
      type: "HIDE_CHALLENGE_TAKEN_NOTICE",
    });
  };

  onWatchChallengeTakenGame = (gameId: number) => {
    this._store.dispatch({
      type: "HIDE_CHALLENGE_TAKEN_NOTICE",
    });
    this.onJoinGame(gameId);
  };

  onStartCreateChallenge = (username?: string) => {
    this._store.dispatch({
      type: "START_CREATE_CHALLENGE",
      username,
    });
  };

  onCancelCreateChallenge = () => {
    this._store.dispatch({
      type: "CANCEL_CREATE_CHALLENGE",
    });
  };

  // Create a demonstration game. A demo has only an OWNER role (no opponent and
  // no proposal/accept handshake), so CHALLENGE_CREATE returns a live game
  // channel the owner edits directly via KGS_SGF_CHANGE. See KGS_Protocol_Reference.md.
  onCreateDemo = (
    roomId: number,
    size: number = 19,
    isPrivate: boolean = false,
    global: boolean = false,
    timeSystem: TimeSystem = "byo_yomi",
    mainTime: number = 20 * 60,
    byoYomiTime: number = 30,
    byoYomiPeriods: number = 5,
    byoYomiStones: number = 25,
    ruleset: GameRuleSet = "japanese",
    handicap: number = 0,
    komi: number = 6.5
  ) => {
    let state = this._store.getState();
    let currentUser = state.currentUser;
    if (!currentUser) {
      return;
    }
    let proposal = sanitizeProposal({
      gameType: "demonstration",
      nigiri: false,
      private: isPrivate,
      rules: {
        size,
        komi,
        rules: ruleset,
        timeSystem,
        mainTime,
        byoYomiTime,
        byoYomiPeriods,
        byoYomiStones,
        handicap,
      },
      players: [{ role: "owner", name: currentUser.name }],
    });
    this._send({
      type: "CHALLENGE_CREATE",
      proposal,
      channelId: Number(roomId),
      text: currentUser.name + "'s demonstration",
      global,
      callbackKey: 12345, // Note - we don't use this
    });
  };

  // Start an editable review of a (finished) game. GAME_START_REVIEW carries the
  // finished game's channel id; the server seeds a review channel with its moves
  // and replies with GAME_REVIEW (handled in game/message.js), where the
  // requester becomes the review owner/editor. See KGS_Protocol_Reference.md.
  //
  // KGS destroys a watched game's channel once it ends. Sending to a dead/
  // unjoined channel makes the server drop the whole session ("Unknown channel
  // NNN") — the next poll 400s and logs us out (same hazard guarded in
  // onUnjoin). So only send when we still hold live membership for a channel
  // that hasn't been removed; otherwise the game must be reviewed from the
  // archive (loaded via My Games), which mints a fresh review channel.
  onStartReview = (gameId: number) => {
    if (this._isOffline()) {
      return;
    }
    let channelId = Number(gameId);
    let { channelMembership, gamesById } = this._store.getState();
    let game = gamesById && gamesById[channelId];
    let joined = !!(channelMembership && channelMembership[channelId]);
    // Not joined, or the server already removed the channel: sending would
    // crash the session (the UI already hides Review for observers of ended
    // games; this is the last-line guard against the logout).
    if (!joined || (game && game.deletedTime)) {
      return;
    }
    // Mark this as OUR review request so the matching GAME_REVIEW navigates us
    // into the new channel. A GAME_REVIEW for someone else's review (broadcast
    // while we watch a game) must NOT hijack our session — see the reducer.
    this._store.dispatch({ type: "SET_PENDING_REVIEW", originalId: channelId });
    this._send({
      type: "GAME_START_REVIEW",
      channelId,
    });
  };

  // Assign a co-editor on a demo/review game the user owns. GAME_SET_ROLES puts
  // each role on the message keyed by the role name, with the player's name as
  // the value (e.g. { owner: "alice" }) — not a players array. The target must
  // already be a member of the game channel. See KGS_Protocol_Reference.md.
  onSetGameRole = (gameId: number, name: string, role: GameRole) => {
    let msg: Object = {
      type: "GAME_SET_ROLES",
      channelId: Number(gameId),
    };
    msg[role] = name;
    this._send(msg);
  };

  // Place a setup stone (or clear a point) on a demo board the user edits.
  // Setup stones (ADDSTONE) and a MOVE can't coexist on the same SGF node — the
  // server rejects (and drops the connection) if we add a setup stone to a move
  // node. So when the current node holds a move, append a new child setup node
  // and edit there; otherwise edit the current node in place.
  onDemoAddStone = (
    gameId: number,
    loc: Point,
    color: ?PlayerColor // null clears the point
  ) => {
    let state = this._store.getState();
    let game = state.gamesById[gameId];
    if (!game || !game.tree) {
      return;
    }
    let tree = game.tree;
    let nodeId = tree.currentNode;
    let prop = { name: "ADDSTONE", loc, color: color || "empty" };
    let curNode = tree.nodes[nodeId];
    let isMoveNode = !!curNode && curNode.props.some((p) => p.name === "MOVE");
    if (!isMoveNode) {
      this._send({
        type: "KGS_SGF_CHANGE",
        channelId: Number(gameId),
        sgfEvents: [{ type: "PROP_ADDED", nodeId, prop }],
      });
      return;
    }
    let maxId = -1;
    for (let id of Object.keys(tree.nodes)) {
      let n = Number(id);
      if (n > maxId) {
        maxId = n;
      }
    }
    let childId = maxId + 1;
    this._send({
      type: "KGS_SGF_CHANGE",
      channelId: Number(gameId),
      sgfEvents: [
        { type: "CHILD_ADDED", nodeId, childNodeId: childId },
        { type: "ACTIVATED", nodeId: childId, prevNodeId: nodeId },
        { type: "PROP_ADDED", nodeId: childId, prop },
      ],
    });
  };

  // Place (or toggle off) an SGF markup symbol on the current node. `markName`
  // is one of "TRIANGLE" | "SQUARE" | "CIRCLE". Marks annotate the current node
  // directly (no move counter change), and clicking an existing mark removes it.
  onDemoAddMark = (gameId: number, loc: Point, markName: string) => {
    let state = this._store.getState();
    let game = state.gamesById[gameId];
    if (!game || !game.tree) {
      return;
    }
    let tree = game.tree;
    let nodeId = tree.currentNode;
    let prop = { name: markName, loc };
    let curNode = tree.nodes[nodeId];
    let exists =
      !!curNode &&
      curNode.props.some(
        (p) =>
          p.name === markName &&
          p.loc &&
          typeof p.loc !== "string" &&
          p.loc.x === loc.x &&
          p.loc.y === loc.y
      );
    this._send({
      type: "KGS_SGF_CHANGE",
      channelId: Number(gameId),
      sgfEvents: [
        { type: exists ? "PROP_REMOVED" : "PROP_ADDED", nodeId, prop },
      ],
    });
  };

  // Place a text LABEL (a number or letter) on the current node. One label per
  // point — placing on a point that already has one replaces it; placing the
  // same text on a point that already has that exact label removes it (toggle).
  // Returns true if a label was placed (so the caller can advance its counter),
  // false if it was a toggle-off.
  onDemoAddLabel = (gameId: number, loc: Point, text: string): boolean => {
    let state = this._store.getState();
    let game = state.gamesById[gameId];
    if (!game || !game.tree) {
      return false;
    }
    let tree = game.tree;
    let nodeId = tree.currentNode;
    let curNode = tree.nodes[nodeId];
    let existing =
      curNode &&
      curNode.props.find(
        (p) =>
          p.name === "LABEL" &&
          p.loc &&
          typeof p.loc !== "string" &&
          p.loc.x === loc.x &&
          p.loc.y === loc.y
      );
    let sgfEvents = [];
    // Remove any label already on this point first.
    if (existing) {
      sgfEvents.push({
        type: "PROP_REMOVED",
        nodeId,
        prop: { name: "LABEL", loc, text: existing.text },
      });
      // Clicking the same label again just clears it.
      if (existing.text === text) {
        this._send({
          type: "KGS_SGF_CHANGE",
          channelId: Number(gameId),
          sgfEvents,
        });
        return false;
      }
    }
    sgfEvents.push({
      type: "PROP_ADDED",
      nodeId,
      prop: { name: "LABEL", loc, text },
    });
    this._send({
      type: "KGS_SGF_CHANGE",
      channelId: Number(gameId),
      sgfEvents,
    });
    return true;
  };

  // Remove every markup symbol (triangle/square/circle/cross) on the current
  // node. Used by right-click on a demo board to wipe the marks of the current
  // move at once. No-op if the node has none.
  onDemoClearMarks = (gameId: number) => {
    let state = this._store.getState();
    let game = state.gamesById[gameId];
    if (!game || !game.tree) {
      return;
    }
    let tree = game.tree;
    let nodeId = tree.currentNode;
    let curNode = tree.nodes[nodeId];
    if (!curNode) {
      return;
    }
    let markNames = {
      TRIANGLE: true,
      SQUARE: true,
      CIRCLE: true,
      CROSS: true,
      LABEL: true,
    };
    let sgfEvents = curNode.props
      .filter((p) => markNames[p.name] && p.loc && typeof p.loc !== "string")
      .map((p) => {
        // LABEL removals must carry the original text, or the server rejects the
        // whole KGS_SGF_CHANGE batch with a 400.
        let prop =
          p.name === "LABEL"
            ? { name: p.name, loc: p.loc, text: p.text }
            : { name: p.name, loc: p.loc };
        return { type: "PROP_REMOVED", nodeId, prop };
      });
    if (sgfEvents.length === 0) {
      return;
    }
    // Apply locally right away so the board clears on this click (the server
    // echo can lag, which made the marks linger until the next change).
    this._store.dispatch({
      type: "GAME_UPDATE",
      channelId: Number(gameId),
      sgfEvents,
    });
    this._send({
      type: "KGS_SGF_CHANGE",
      channelId: Number(gameId),
      sgfEvents,
    });
  };

  // Add a comment to the current node of a demo. KGS does NOT accept COMMENT
  // props via KGS_SGF_CHANGE (it drops the connection) — node comments are
  // created by the SERVER from CHAT messages, attached to the active node. So:
  // first move the server's active node to the current node (ACTIVATED event,
  // same as onDemoMove uses), then send a plain CHAT. The server appends it as
  // "username [rank]: text" in the node's COMMENT. Comments are append-only.
  onDemoAddComment = (gameId: number, text: string) => {
    let state = this._store.getState();
    let game = state.gamesById[gameId];
    if (!game || !game.tree || !text) {
      return;
    }
    let tree = game.tree;
    let nodeId = tree.currentNode;
    if (!tree.nodes[nodeId]) {
      return;
    }
    if (tree.activeNode !== nodeId) {
      this._send({
        type: "KGS_SGF_CHANGE",
        channelId: Number(gameId),
        sgfEvents: [{ type: "ACTIVATED", nodeId, prevNodeId: tree.activeNode }],
      });
    }
    this._send({ type: "CHAT", text, channelId: Number(gameId) });
  };

  // Client-side legality check for a move attaching to `nodeId` (occupied,
  // suicide, Ko). Shows the same warning toast as live play and returns true
  // when the move is illegal. Mirrors the validation in onPlayMove.
  _validateMoveAtNode = (
    game: GameChannel,
    nodeId: number,
    loc: Point,
    color: PlayerColor
  ): boolean => {
    let tree = game.tree;
    if (!tree) {
      return false;
    }
    let node = tree.nodes[nodeId];
    let computed = tree.computedState[nodeId];
    if (!node || !computed) {
      return false;
    }
    let board = computed.board;
    let parentBoard = null;
    let parentNodeId = node.parent;
    if (typeof parentNodeId === "number" && tree.computedState[parentNodeId]) {
      parentBoard = tree.computedState[parentNodeId].board;
    }
    let ruleset = "japanese";
    let rootNode = tree.nodes[tree.rootNode];
    if (rootNode) {
      let rulesProp = rootNode.props.find((p) => p.name === "RULES");
      // $FlowFixMe
      if (rulesProp && typeof rulesProp.rules !== "undefined") {
        try {
          // $FlowFixMe
          ruleset = validateRuleSet(rulesProp.rules);
        } catch (e) {}
      }
    }
    let validationError = validateMove(board, parentBoard, loc, color, ruleset);
    if (!validationError) {
      return false;
    }
    this._store.dispatch({
      type: "SET_GAME_MOVE_ERROR",
      channelId: game.id,
      error: validationError,
    });
    setTimeout(() => {
      let state = this._store.getState();
      let currGame = state.gamesById[game.id];
      if (currGame && currGame.moveError === validationError) {
        this._store.dispatch({
          type: "SET_GAME_MOVE_ERROR",
          channelId: game.id,
          error: null,
        });
      }
    }, 2500);
    return true;
  };

  // Play a move on a demo board. A demo has no players/turns, so GAME_MOVE is
  // rejected; instead the move is an SGF change that appends a new child node
  // with a MOVE prop and activates it. The event order/shape mirrors exactly
  // what KGS itself sends for a move (CHILD_ADDED, then ACTIVATED with
  // prevNodeId, then the MOVE PROP_ADDED — no `position` field). The client
  // picks the new node id (max existing id + 1). This creates a real tree node,
  // so it supports variations and advances the move counter.
  onDemoMove = (gameId: number, loc: Point, color: PlayerColor) => {
    let state = this._store.getState();
    let game = state.gamesById[gameId];
    if (!game || !game.tree) {
      return;
    }
    let tree = game.tree;
    let parentId = tree.currentNode;
    // Reject suicide/Ko/occupied with the same warning shown in live games.
    if (this._validateMoveAtNode(game, parentId, loc, color)) {
      return;
    }
    this._store.dispatch({
      type: "SET_GAME_MOVE_ERROR",
      channelId: game.id,
      error: null,
    });
    // If the current node already has a child that plays this exact move, KGS
    // treats it as the same move — navigate to that existing child instead of
    // creating a duplicate variation.
    let parentNode = tree.nodes[parentId];
    if (parentNode && parentNode.children) {
      let existingChild = parentNode.children.find((cid) => {
        let child = tree.nodes[cid];
        if (!child) {
          return false;
        }
        let mv = child.props.find((p) => p.name === "MOVE");
        return (
          mv &&
          mv.color === color &&
          mv.loc &&
          typeof mv.loc !== "string" &&
          mv.loc.x === loc.x &&
          mv.loc.y === loc.y
        );
      });
      if (typeof existingChild === "number") {
        this.onChangeCurrentNode(game, existingChild);
        return;
      }
    }
    let maxId = -1;
    for (let id of Object.keys(tree.nodes)) {
      let n = Number(id);
      if (n > maxId) {
        maxId = n;
      }
    }
    let childId = maxId + 1;
    this._send({
      type: "KGS_SGF_CHANGE",
      channelId: Number(gameId),
      sgfEvents: [
        { type: "CHILD_ADDED", nodeId: parentId, childNodeId: childId },
        { type: "ACTIVATED", nodeId: childId, prevNodeId: parentId },
        {
          type: "PROP_ADDED",
          nodeId: childId,
          prop: { name: "MOVE", loc, color },
        },
      ],
    });
    // Follow the move we just played. The ACTIVATED echo only advances
    // currentNode when it already equals activeNode — so after navigating back
    // and branching, currentNode would otherwise stay on the old node (making
    // the next color/board read stale). Point it at the new node explicitly.
    this.onChangeCurrentNode(game, childId);
  };

  // Play a pass on a demo board: appends a MOVE node with loc "PASS". No board
  // validation and no duplicate-collapsing (a pass is always allowed).
  onDemoPass = (gameId: number, color: PlayerColor) => {
    let state = this._store.getState();
    let game = state.gamesById[gameId];
    if (!game || !game.tree) {
      return;
    }
    let tree = game.tree;
    let parentId = tree.currentNode;
    let maxId = -1;
    for (let id of Object.keys(tree.nodes)) {
      let n = Number(id);
      if (n > maxId) {
        maxId = n;
      }
    }
    let childId = maxId + 1;
    this._send({
      type: "KGS_SGF_CHANGE",
      channelId: Number(gameId),
      sgfEvents: [
        { type: "CHILD_ADDED", nodeId: parentId, childNodeId: childId },
        { type: "ACTIVATED", nodeId: childId, prevNodeId: parentId },
        {
          type: "PROP_ADDED",
          nodeId: childId,
          prop: { name: "MOVE", loc: "PASS", color },
        },
      ],
    });
    this.onChangeCurrentNode(game, childId);
  };

  onLogout = (opts?: { localOnly?: boolean }) => {
    // Deliberate logout — never silently log back in.
    this._userLoggedOut = true;
    if (this._reconnectWatchdog) {
      clearTimeout(this._reconnectWatchdog);
      this._reconnectWatchdog = null;
    }
    this._store.dispatch({ type: "RECONNECT_END" });
    for (let id of Object.keys(this._sendTimers)) {
      clearTimeout(this._sendTimers[id]);
    }
    this._sendTimers = {};
    this._sendTimerMeta = {};
    this._stopActivityTracking();
    this._history.push("/");
    this._store.dispatch({ type: "LOGOUT_START" });
    setTimeout(() => {
      this.onSaveAppState();
    }, 0);
    if (this._store.getState().clientState.status !== "loggedOut") {
      if (opts && opts.localOnly) {
        // Reset client state without a network LOGOUT (used when cleaning up
        // a stale restored session that no longer exists on the server).
        this._client.setState({
          ...this._client.state,
          status: "loggedOut",
          network: "online",
          retryTimes: 0,
        });
      } else {
        // A failed LOGOUT send already resolves to "loggedOut" in client
        // state; the rejection itself must not surface as an uncaught error.
        this._client.logout().catch(() => {});
      }
    }
  };

  onChangeNav = (
    nav: NavOption,
    opts?: { push?: boolean } = { push: true }
  ) => {
    if (opts.push && nav !== this._history.location.pathname.slice(1)) {
      this._history.push("/" + nav);
    }
    let state = this._store.getState();
    if (state.nav !== nav) {
      this._store.dispatch({ type: "NAV_CHANGE", nav });
    } else if (nav === "watch") {
      if (typeof state.watchGameId === "number") {
        this.onLeaveGame(state.watchGameId);
      }
    }
  };

  onJoinGame = (gameId: number | string, opts?: { inPlayView?: boolean }) => {
    let state = this._store.getState();

    let { currentUser } = state;
    if (!currentUser) {
      return;
    }

    // Don't auto-leave previous watch game — WatchScreen manages multiple tabs

    if (gameId === state.playGameId) {
      // Already playing this game
      this.onChangeNav("play");
      return;
    }

    let players;
    if (typeof gameId === "number") {
      let game = state.gamesById[gameId];
      players = game && game.players;
    } else {
      let gameSummaries = state.gameSummariesByUser[currentUser.name];
      let gameSummary = gameSummaries
        ? gameSummaries.find((g) => g.timestamp === gameId)
        : null;
      if (gameSummary) {
        players = gameSummary.players;
      }
    }
    // inPlayView lets a caller (e.g. the simul sidebar) keep observed boards in
    // the play view rather than bouncing the user to the Watch tab.
    let isPlayer = players && isGamePlayer(currentUser.name, players);
    let inPlayView = !!(opts && opts.inPlayView);
    let joinType;
    if (isPlayer || inPlayView) {
      joinType = "PLAY_GAME";
      this.onChangeNav("play");
    } else {
      joinType = "WATCH_GAME";
      this.onChangeNav("watch");
    }

    if (typeof gameId === "number") {
      // By channel id
      this._store.dispatch([
        { type: "GAME_JOIN", channelId: gameId },
        { type: joinType, gameId },
      ]);
      if (!this._isOffline()) {
        this._send({
          type: "JOIN_REQUEST",
          channelId: gameId,
        });
      }
    } else {
      // By timestamp
      this._store.dispatch([{ type: joinType, gameId }]);
      if (!this._isOffline()) {
        this._send({
          type: "JOIN_GAME_BY_ID",
          timestamp: gameId,
        });
      }
    }
  };

  // Closing a game from the nav. If it's an unsaved demonstration or review
  // board the current user edits (e.g. a game loaded from My Games with added
  // variations/markup), prompt to save it permanently first (Yes/No/Don't
  // Close); otherwise leave immediately.
  onRequestLeaveGame = (game: GameChannel | number | string) => {
    let gameId =
      typeof game === "number" || typeof game === "string" ? game : game.id;
    let state = this._store.getState();
    let chan =
      typeof gameId === "number"
        ? state.gamesById[gameId]
        : state.gamesById[Number(gameId)];
    let me = state.currentUser ? state.currentUser.name : null;
    if (
      chan &&
      isDemoOrReview(chan) &&
      !chan.saved &&
      me &&
      typeof chan.id === "number" &&
      // Prompt the editor OR the owner: giving control away moves the EDIT
      // action to someone else, but the owner should still be asked to save.
      (isGameEditor(chan, me) || isGameOwner(chan, me))
    ) {
      this._store.dispatch({ type: "SHOW_DEMO_SAVE_CLOSE", gameId: chan.id });
      return;
    }
    this.onLeaveGame(game);
  };

  // Persist a game into the user's KGS archive. GAME_LIST_ENTRY_SET_FLAGS takes
  // the flag as a named boolean field (here `saved`), not a mask.
  onSaveGame = (gameId: number): Promise<any> => {
    return this._client
      .sendMessage({
        type: "GAME_LIST_ENTRY_SET_FLAGS",
        channelId: Number(gameId),
        saved: true,
      })
      .catch(() => {});
  };

  onSaveAndCloseDemo = (gameId: number) => {
    this._store.dispatch({ type: "HIDE_DEMO_SAVE_CLOSE" });
    // Send (and let the server process) the save before leaving the channel.
    this.onSaveGame(gameId).then(() => {
      this.onLeaveGame(gameId);
    });
  };

  onCloseDemoWithoutSaving = (gameId: number) => {
    this._store.dispatch({ type: "HIDE_DEMO_SAVE_CLOSE" });
    this.onLeaveGame(gameId);
  };

  onCancelCloseDemo = () => {
    this._store.dispatch({ type: "HIDE_DEMO_SAVE_CLOSE" });
  };

  onLeaveGame = (game: GameChannel | number | string) => {
    let gameId =
      typeof game === "number" || typeof game === "string" ? game : game.id;
    let state = this._store.getState();
    let chan =
      typeof gameId === "number"
        ? state.gamesById[gameId]
        : state.gamesById[Number(gameId)];
    let isDemo = !!(chan && isDemoOrReview(chan));
    let msgs = [];
    if (state.playGameId === gameId) {
      msgs.push({
        type: "PLAY_GAME",
        gameId: null,
      });
    }
    if (state.watchGameId === gameId) {
      msgs.push({
        type: "WATCH_GAME",
        gameId: null,
      });
    }
    if (msgs.length) {
      this._store.dispatch(msgs);
    }
    // Closing a demonstration or review board returns the user to My Games
    // (where demos are created and archive games are loaded/reviewed from)
    // rather than leaving them on an empty Play/Watch view.
    if (isDemo && (state.nav === "play" || state.nav === "watch")) {
      this.onChangeNav("mygames");
    }
    if (typeof gameId === "number") {
      this.onUnjoin(gameId);
    } else {
      let parsed = parseInt(gameId, 10);
      if (!isNaN(parsed)) {
        this.onUnjoin(parsed);
      }
    }
  };

  onSelectChallenge = (challengeId: number) => {
    if (this._isOffline()) {
      return;
    }
    this._store.dispatch({
      type: "PLAY_CHALLENGE",
      challengeId,
    });
    this._send({
      type: "JOIN_REQUEST",
      channelId: challengeId,
    });
  };

  onCloseChallenge = (challengeId: number) => {
    this._store.dispatch({
      type: "CLOSE_CHALLENGE",
      channelId: challengeId,
    });
    this.onUnjoin(challengeId);
  };

  onMinimizeChallenge = () => {
    this._store.dispatch({
      type: "MINIMIZE_CHALLENGE",
    });
  };

  onRestoreChallenge = () => {
    this.onChangeNav("play");
    this._store.dispatch({
      type: "RESTORE_CHALLENGE",
    });
  };

  onSubmitChallengeProposal = (challengeId: number, proposal: GameProposal) => {
    this._store.dispatch({
      type: "START_CHALLENGE_SUBMIT",
      channelId: challengeId,
      proposal,
    });
    let state = this._store.getState();
    let currentUser = state.currentUser;
    let submitterName = currentUser ? currentUser.name : undefined;
    // The server validates that the challenge owner (creator) is present in the
    // submitted proposal, so the owner's name must be kept alongside ours.
    let challenge = state.gamesById[challengeId];
    let creator =
      challenge && challenge.players && challenge.players.challengeCreator
        ? challenge.players.challengeCreator.name
        : undefined;
    let submitMsg = {
      ...sanitizeProposal(proposal, submitterName, creator),
      type: "CHALLENGE_SUBMIT",
      channelId: challengeId,
    };
    this._send(submitMsg);
  };

  onCreateChallenge = (
    proposal: GameProposal,
    roomId: number,
    visibility: ProposalVisibility,
    notes?: string
  ) => {
    this._store.dispatch({
      type: "UPDATE_PREFERENCES",
      preferences: {
        lastProposal: { proposal, visibility, notes },
      },
    });
    let finalProposal = {
      ...proposal,
      private: visibility === "private" || visibility === "private_public",
    };
    let state = this._store.getState();
    let currentName = state.currentUser ? state.currentUser.name : null;

    let sanitizedPlayers = finalProposal.players.map((p) => {
      if (p.name === currentName) {
        return p;
      }
      let otherProps = { ...p };
      delete otherProps.name;
      return otherProps;
    });

    let sanitized = sanitizeProposal({
      ...finalProposal,
      players: sanitizedPlayers,
    });

    this._send({
      type: "CHALLENGE_CREATE",
      proposal: sanitized,
      channelId: Number(roomId),
      text: notes,
      global: visibility === "public" || visibility === "private_public",
      callbackKey: 12345, // Note - we don't use this
    });
  };

  onAcceptChallengeProposal = (challengeId: number, proposal: GameProposal) => {
    let state = this._store.getState();
    let challenge = state.gamesById[challengeId];

    let proposalToAccept = proposal;

    let activeProposal = challenge
      ? challenge.sentProposal || challenge.initialProposal
      : null;
    if (activeProposal && activeProposal.gameType === "simul") {
      let hostName = state.currentUser ? state.currentUser.name : null;
      let usersByName = state.usersByName;
      let host = hostName ? usersByName[hostName] : null;
      let mergedPlayers = activeProposal.players.map((p) => ({ ...p }));
      // Standard handicap-derived komi (0.5 on a handicap board, the standard
      // board komi otherwise). Used only as a fallback when the challenger did
      // not propose their own komi — a challenger's chosen komi is respected.
      let boardKomi =
        activeProposal.rules && typeof activeProposal.rules.komi === "number"
          ? activeProposal.rules.komi
          : 6.5;
      let defaultKomiFor = (handicap) => (handicap > 0 ? 0.5 : boardKomi);
      // The host may have passed a fully merged roster with manual handicap
      // overrides (handicapSet). Index those by challenger name so they win.
      let overrides = {};
      if (proposal && proposal.gameType === "simul") {
        for (let p of proposal.players) {
          let n = p.user ? p.user.name : p.name;
          if (n && p.role === "black" && p.handicapSet) {
            overrides[n] = {
              handicap: typeof p.handicap === "number" ? p.handicap : 0,
            };
          }
        }
      }
      // Merge every received proposal's challenger into the slots so the host's
      // accept carries all submitted challengers, not just the selected one.
      let allProposals =
        challenge && challenge.receivedProposals
          ? challenge.receivedProposals
          : [proposal];
      for (let recv of allProposals) {
        for (let rp of recv.players) {
          let rpName = rp.user ? rp.user.name : rp.name;
          if (!rpName || rpName === hostName) {
            continue;
          }
          let alreadyIn = mergedPlayers.some((p) => {
            let n = p.user ? p.user.name : p.name;
            return n === rpName;
          });
          if (!alreadyIn) {
            let emptySlot = mergedPlayers.find(
              (p) => p.role === "black" && !p.name && !p.user
            );
            if (emptySlot) {
              emptySlot.name = rpName;
              let rpHandicap =
                typeof rp.handicap === "number" ? rp.handicap : 0;
              if (overrides[rpName]) {
                // Host manually overrode this opponent's handicap (host wins).
                emptySlot.handicap = overrides[rpName].handicap;
                emptySlot.komi = defaultKomiFor(emptySlot.handicap);
              } else if (rp.handicapSet || rpHandicap > 0) {
                // Challenger requested this handicap — respect the stone count
                // and their proposed komi (fall back to the standard komi).
                emptySlot.handicap = rpHandicap;
                emptySlot.komi =
                  typeof rp.komi === "number"
                    ? rp.komi
                    : defaultKomiFor(rpHandicap);
              } else {
                // Auto from opponent rank vs host.
                let matchup = getSimulMatchup(
                  host,
                  usersByName[rpName],
                  boardKomi
                );
                emptySlot.handicap = matchup.handicap;
                emptySlot.komi =
                  typeof rp.komi === "number" ? rp.komi : matchup.komi;
              }
            }
          }
        }
      }
      proposalToAccept = { ...activeProposal, players: mergedPlayers };
    } else if (activeProposal && activeProposal.gameType === "rengo") {
      // Merge every received proposal's seated player into the four-seat roster,
      // then recompute the team-average handicap.
      let usersByName = state.usersByName;
      let mergedPlayers = activeProposal.players.map((p) => ({ ...p }));
      let allProposals =
        challenge && challenge.receivedProposals
          ? challenge.receivedProposals
          : [proposal];
      for (let recv of allProposals) {
        for (let rp of recv.players) {
          let rpName = rp.user ? rp.user.name : rp.name;
          if (!rpName) {
            continue;
          }
          let alreadyIn = mergedPlayers.some((p) => {
            let n = p.user ? p.user.name : p.name;
            return n === rpName;
          });
          if (alreadyIn) {
            continue;
          }
          let seat =
            mergedPlayers.find(
              (p) => p.role === rp.role && !p.name && !p.user
            ) || mergedPlayers.find((p) => !p.name && !p.user);
          if (seat) {
            seat.name = rpName;
            delete seat.user;
          }
        }
      }
      let teamUsers = (roleA, roleB) =>
        mergedPlayers
          .filter(
            (p) => (p.role === roleA || p.role === roleB) && (p.user || p.name)
          )
          .map((p) => usersByName[p.user ? p.user.name : p.name || ""]);
      let matchup = getRengoMatchup(
        teamUsers("white", "white_2"),
        teamUsers("black", "black_2"),
        activeProposal.rules && activeProposal.rules.komi
      );
      proposalToAccept = {
        ...activeProposal,
        players: mergedPlayers,
        rules: {
          ...activeProposal.rules,
          handicap: matchup.handicap,
          komi: matchup.komi,
        },
      };
    }

    // Users must be name-only
    let normProposal = {
      ...proposalToAccept,
      players: proposalToAccept.players.map((p) => {
        p = { ...p, name: p.user ? p.user.name : p.name };
        delete p.user;
        return p;
      }),
    };
    if (challenge) {
      normProposal.private = !!challenge.private;
    }
    this._send({
      ...sanitizeProposal(normProposal),
      type: "CHALLENGE_PROPOSAL",
      channelId: challengeId,
    });
  };

  onAcceptSimulChallengeProposal = (challengeId: number) => {
    let state = this._store.getState();
    let challenge = state.gamesById[challengeId];
    // The challenger accepts by echoing the host's full proposal back, the
    // same way the regular flow echoes the agreed proposal in CHALLENGE_ACCEPT.
    let hostProposal = challenge && challenge.sentProposal;
    if (!hostProposal) {
      return;
    }
    let normProposal = {
      ...hostProposal,
      players: hostProposal.players.map((p) => {
        let np = { ...p, name: p.user ? p.user.name : p.name };
        delete np.user;
        return np;
      }),
    };
    this._send({
      ...sanitizeProposal(normProposal),
      type: "CHALLENGE_ACCEPT",
      channelId: challengeId,
    });
    this._store.dispatch({
      type: "CHALLENGE_ACCEPT_SENT",
      channelId: challengeId,
    });
  };

  onDeclineChallengeProposal = (challengeId: number, name: string) => {
    this._store.dispatch({
      type: "START_CHALLENGE_DECLINE",
      channelId: challengeId,
      name,
    });
    this._send({
      type: "CHALLENGE_DECLINE",
      name,
      channelId: challengeId,
    });
  };

  // Decline a direct challenge straight from its card: hide it locally (handled
  // by the caller) and let the sender know via a private chat message. We open
  // (or reuse) a conversation with the challenge creator and send the note once
  // the conversation channel is established.
  onDeclineDirectChallenge = (challengeId: number) => {
    if (this._isOffline()) {
      return;
    }
    let state = this._store.getState();
    let challenge = state.gamesById[challengeId];
    let creator =
      challenge && challenge.players && challenge.players.challengeCreator;
    let name = creator ? creator.name : null;
    if (!name) {
      return;
    }
    let text =
      "[Auto-reply] Thanks for the challenge, but I can't play right now!";
    let { conversationsById } = state;
    let existingId = Object.keys(conversationsById).find(
      (cid) =>
        conversationsById[cid].user === name &&
        !isTempId(conversationsById[cid].id)
    );
    if (existingId) {
      let convoId = parseInt(existingId, 10);
      this._store.dispatch({
        type: "CHAT",
        sending: true,
        text,
        channelId: convoId,
        user: state.currentUser,
      });
      this._send({ type: "CHAT", text, channelId: convoId });
      return;
    }
    let channelId = tempId();
    let callbackKey = tempId();
    this._pendingDeclineChats[callbackKey] = text;
    this._store.dispatch({
      type: "CONVO_JOIN",
      user: creator,
      channelId,
      callbackKey,
    });
    this._send({ type: "CONVO_REQUEST", name, callbackKey });
  };

  // Optimistically show a direct message as "Sending..." and ship it. The
  // server echo is the ONLY proof of delivery: KGS echoes the CHAT back, which
  // clears the pending flag (see the CHAT dedup in conversation.js). If no echo
  // arrives within the timeout, the message was not delivered — most often
  // because the recipient looked online but had actually gone offline. We never
  // resolve a pending message to a plain timestamp on our own, since that would
  // falsely imply it was received.
  //
  // The echo rides back on the next poll cycle (proxy hop + poll latency), so a
  // genuine delivery can take well over 5s. A short timeout produced false
  // "Not delivered" flags; even so, a late echo now self-heals a wrongly-flagged
  // message (see the CHAT dedup in conversation.js).
  _SEND_TIMEOUT_MS = 15000;

  _dispatchOptimisticChat = (channelId: number, text: string) => {
    let state = this._store.getState();
    let messageId = uuidV4();
    this._store.dispatch({
      type: "CHAT",
      sending: true,
      messageId,
      text,
      channelId,
      user: state.currentUser,
    });
    this._send({ type: "CHAT", text, channelId });

    let convo = state.conversationsById[channelId];
    let partnerName = convo && convo.user ? convo.user : null;

    this._sendTimerMeta[messageId] = { channelId, text };
    this._sendTimers[messageId] = setTimeout(() => {
      delete this._sendTimers[messageId];
      delete this._sendTimerMeta[messageId];
      let msgs = [
        {
          type: "CHAT_RESOLVE_PENDING",
          conversationId: channelId,
          messageId,
          notDelivered: true,
        },
      ];
      // The recipient looked connected but didn't receive the message — their
      // presence is no longer trustworthy. Flag it (cleared by the next server
      // USER_UPDATE).
      if (partnerName) {
        msgs.push({ type: "MARK_PRESENCE_UNKNOWN", name: partnerName });
      }
      this._store.dispatch(msgs);
    }, this._SEND_TIMEOUT_MS);
  };

  _flushPendingDeclineChat = (msg: KgsMessage) => {
    let { callbackKey, channelId } = msg;
    if (!callbackKey || !this._pendingDeclineChats[callbackKey]) {
      return;
    }
    let text = this._pendingDeclineChats[callbackKey];
    delete this._pendingDeclineChats[callbackKey];
    if (typeof channelId !== "number") {
      return;
    }
    this._dispatchOptimisticChat(channelId, text);
  };

  onGameJoined = (gameId: number) => {
    let state = this._store.getState();
    let currentUser = state.currentUser;
    if (!currentUser) {
      return;
    }
    let game = state.gamesById[gameId];
    if (
      !game ||
      !game.players ||
      !isGamePlayer(currentUser.name, game.players)
    ) {
      return;
    }
    // A game we're playing was just joined (e.g. a simul game starting). If we
    // aren't already viewing a game, open it automatically.
    if (!state.playGameId) {
      this._store.dispatch({ type: "PLAY_GAME", gameId });
      this.onChangeNav("play");
    }
  };

  onChallengeFinalized = (
    proposal: GameProposal,
    challengeId: number,
    gameId: number
  ) => {
    let state = this._store.getState();
    let currentUser = state.currentUser;
    let name = currentUser && currentUser.name;
    let isPlayer = name && isGameProposalPlayer(name, proposal);
    if (isPlayer) {
      // We're in this game - navigate to the board so it opens automatically.
      this.onChangeNav("play");
    } else if (proposal.gameType === "simul" || proposal.gameType === "rengo") {
      // Simul/rengo: a co-challenger's board was finalized. These boards are
      // grouped under one challenge channel, so navigate to watch and clean up
      // the other game channels we no longer need.
      this.onChangeNav("watch");
      let { channelMembership } = state;
      for (let chanIdStr of Object.keys(channelMembership)) {
        let chan = channelMembership[chanIdStr];
        let chanId = parseInt(chanIdStr, 10);
        if (chan && chan.type === "game" && chanId !== gameId) {
          this.onUnjoin(chanId);
        }
      }
    } else {
      // Plain 1v1 challenge finalized for someone else (e.g. the owner accepted
      // a competing challenger). Don't drag us into the game. If we had actually
      // submitted a proposal to this challenge, tell us the owner picked someone
      // else and offer a link to watch the game that started.
      let challenge = state.gamesById[challengeId];
      let weSubmitted = !!(challenge && challenge.sentProposal);
      if (weSubmitted) {
        this._store.dispatch({
          type: "SHOW_CHALLENGE_TAKEN_NOTICE",
          gameId,
        });
      }
    }
  };

  onReceiveChallengeProposal = (
    challengeId: number,
    proposal: GameProposal,
    prevSentProposal: ?GameProposal
  ) => {
    if (!proposal) {
      this.onCloseChallenge(challengeId);
      return;
    }
    // What we (the challenger) last sent, captured before the reducer replaced
    // it with this incoming proposal. Falls back to the stored value for any
    // caller that doesn't supply it.
    let state = this._store.getState();
    let challenge = state.gamesById[challengeId];
    let sentProposal =
      prevSentProposal !== undefined
        ? prevSentProposal
        : challenge && challenge.sentProposal;

    // Only the challenger (non-creator) finalizes a challenge with
    // CHALLENGE_ACCEPT — the creator replies with CHALLENGE_PROPOSAL and waits
    // for CHALLENGE_FINAL (see CGOBAN GtpChal.testProposal). The creator also
    // receives the server's echo of their own proposal here, so without this
    // guard they would wrongly accept their own bounce and the game never
    // starts.
    let currentUser = state.currentUser;
    let creator =
      challenge && challenge.players && challenge.players.challengeCreator;
    let isCreator = !!(
      creator &&
      currentUser &&
      creator.name === currentUser.name
    );
    if (isCreator) {
      return;
    }

    if (sentProposal) {
      if (proposal.gameType === "simul" || proposal.gameType === "rengo") {
        // For simul/rengo the host's counter-proposal carries the full roster,
        // so it won't match the challenger's own sent proposal. Store it so the
        // challenger can review and click Accept themselves.
        this._store.dispatch({
          type: "CHALLENGE_PROPOSAL_RECEIVED",
          channelId: challengeId,
          proposal,
        });
      } else {
        let acceptable = proposalsEqual(sentProposal, proposal);
        if (acceptable) {
          // The owner agreed to our proposal unchanged — finalize it. The
          // server delivers players as full user objects, but CHALLENGE_ACCEPT
          // must carry name-only players (matching the original proposal), so
          // normalize before echoing it back. This is what produces
          // CHALLENGE_FINAL and starts the game.
          let acceptProposal = {
            ...proposal,
            players: proposal.players.map((p) => {
              let np = { ...p, name: p.user ? p.user.name : p.name };
              delete np.user;
              return np;
            }),
          };
          this._send({
            ...sanitizeProposal(acceptProposal),
            type: "CHALLENGE_ACCEPT",
            channelId: challengeId,
          });
        } else {
          // The owner sent back a modified proposal (a counter-offer). Don't
          // close — surface it so the challenger can review and Accept it
          // themselves, mirroring CGOBAN's negotiate-again behaviour.
          this._store.dispatch({
            type: "CHALLENGE_PROPOSAL_RECEIVED",
            channelId: challengeId,
            proposal,
          });
        }
      }
    }
    // If no sentProposal (e.g. host receiving echo of their own proposal),
    // there is nothing to do — wait for CHALLENGE_FINAL.
  };

  // Map of channelId -> true for every challenge currently addressed directly
  // to the logged-in user. Used to detect newly arrived direct challenges.
  _directChallengeIds = (): { [string]: boolean } => {
    let { challenges, currentUser } = this._store.getState();
    let name = currentUser ? currentUser.name : null;
    let ids = {};
    for (let c of challenges || []) {
      if (isDirectChallenge(c, name)) {
        ids[String(c.id)] = true;
      }
    }
    return ids;
  };

  onReceiveChallengeSubmit = (challengeId: number) => {
    let { playChallengeId } = this._store.getState();
    if (playChallengeId === challengeId) {
      // Received a challenge proposal submission
      playSound(SOUNDS.CHALLENGE_PROPOSAL_RECEIVED);
    }
  };

  onReceiveDirectMessage = (channelId: number) => {
    let { conversationsById } = this._store.getState();
    if (conversationsById[channelId] && conversationsById[channelId].user) {
      playSound(SOUNDS.DIRECT_MESSAGE_RECEIVED);
    }
  };

  // The server echo of our OWN direct message proves it was delivered and the
  // partner is reachable. Cancel the pending send timeout (so it never fires the
  // false "Not delivered" / "presence unknown" flags) and, if an earlier timeout
  // already marked their presence "unknown", clear it.
  _clearPresenceOnOwnEcho = (channelId: ?number, msg: KgsMessage) => {
    if (channelId === null || channelId === undefined) {
      return;
    }
    let state = this._store.getState();
    let currentUser = state.currentUser;
    if (!currentUser || !msg.user || msg.user.name !== currentUser.name) {
      return;
    }
    // The echo carries channelId + text, not our optimistic message id — match
    // on those to find and cancel the right pending timer.
    for (let id of Object.keys(this._sendTimerMeta)) {
      let meta = this._sendTimerMeta[id];
      if (meta.channelId === channelId && meta.text === msg.text) {
        clearTimeout(this._sendTimers[id]);
        delete this._sendTimers[id];
        delete this._sendTimerMeta[id];
        break;
      }
    }
    let convo = state.conversationsById[channelId];
    if (convo && convo.user) {
      this._store.dispatch({ type: "MARK_PRESENCE_KNOWN", name: convo.user });
    }
  };

  onShowGames = (filter: GameFilter) => {
    let msgs;
    let state = this._store.getState();
    if (filter.type === "challenge") {
      this.onChangeNav("play");
      saveFilter("play", { ...state.playFilter, ...filter });
      msgs = [{ type: "PLAY_FILTER_CHANGE", filter }];
      if (state.playGameId) {
        this.onLeaveGame(state.playGameId);
      }
    } else {
      this.onChangeNav("watch");
      saveFilter("watch", { ...state.watchFilter, ...filter });
      msgs = [{ type: "WATCH_FILTER_CHANGE", filter }];
      if (typeof state.watchGameId === "number") {
        this.onLeaveGame(state.watchGameId);
      }
    }
    this._store.dispatch(msgs);
  };

  onLoadGame = (
    timestamp: string,
    channelId: number,
    privateGame: boolean,
    archiveSummary?: GameSummary
  ) => {
    // A loaded game comes back as a "review" channel whose own summary describes
    // the review session (today's date, partial players) — not the archived
    // game. Stash the original archive summary so the loaded channel can carry
    // the correct date + players (used e.g. for the SGF download URL). The
    // review GAME_JOIN that follows attaches it (see message.js).
    if (archiveSummary) {
      this._store.dispatch({
        type: "SET_PENDING_LOAD_SUMMARY",
        summary: archiveSummary,
      });
    }
    this._send({
      type: "ROOM_LOAD_GAME",
      channelId,
      private: privateGame,
      timestamp,
    });
  };

  onUserDetail = (name: string) => {
    if (this._isOffline()) {
      return;
    }
    this._store.dispatch({ type: "START_USER_DETAILS", name });
    // Offline guests have no profile on the server — opening the modal is enough
    // (it shows a guest note); skip the details/archive fetch that would only
    // come back nonexistant.
    let { usersByName } = this._store.getState();
    let user = usersByName && usersByName[name];
    let isOfflineGuest = !!(
      user &&
      user.flags &&
      user.flags.guest &&
      !user.flags.connected
    );
    // Already known to have no profile (server returned DETAILS_NONEXISTANT
    // before) — re-requesting would only bounce back nonexistant again.
    let knownNoProfile = !!(user && user.detailsNotFound && !user.details);
    if (isOfflineGuest || knownNoProfile) {
      return;
    }
    // Only details load on open; the game archive is fetched on demand when the
    // user opens the Games tab (see onRequestArchive), so we don't pull every
    // visited player's full game history up front.
    this._send({ type: "DETAILS_JOIN_REQUEST", name });
  };

  // Refresh presence (online/idle/playing) for every buddy. The friends list
  // classifies each buddy from their cached `flags.connected`, but those flags
  // are only frozen from the LOGIN_SUCCESS snapshot (or the last time we shared
  // a room/game with them) — KGS does not push presence for buddies we don't
  // share a channel with. So a buddy who logs off keeps showing "Online" until
  // something re-fetches them. This re-joins each buddy's details channel (which
  // returns fresh flags) and releases it again shortly after, mirroring what the
  // hover card and profile modal already do for a single user. Called when the
  // friends panel is opened. Staggered so we never fire a burst of requests.
  // When `markSettling` is true (the login-time call) the friends online-count
  // badge is hidden until the whole batch has had time to land, so it never
  // flashes a too-high count from the stale login snapshot before the fresh
  // flags arrive. The panel-open call passes false — that must not blank the
  // badge mid-session.
  onRefreshBuddyPresence = (markSettling: boolean = false) => {
    if (this._isOffline()) {
      if (markSettling) {
        this._store.dispatch({
          type: "SET_BUDDY_PRESENCE_SETTLING",
          settling: false,
        });
      }
      return;
    }
    let { buddies, currentUser } = this._store.getState();
    if (!buddies || !buddies.length) {
      if (markSettling) {
        this._store.dispatch({
          type: "SET_BUDDY_PRESENCE_SETTLING",
          settling: false,
        });
      }
      return;
    }
    if (markSettling) {
      this._store.dispatch({
        type: "SET_BUDDY_PRESENCE_SETTLING",
        settling: true,
      });
      // Requests are staggered ~120ms apart; clear once the last DETAILS_JOIN
      // has had time to come back. Scale with the list size, but keep it within
      // a sane 1.5–6s window.
      let settleMs = Math.min(Math.max(buddies.length * 120 + 900, 1500), 6000);
      setTimeout(() => {
        this._store.dispatch({
          type: "SET_BUDDY_PRESENCE_SETTLING",
          settling: false,
        });
      }, settleMs);
    }
    buddies.forEach((buddy, i) => {
      let name = buddy.name;
      if (!name || (currentUser && name === currentUser.name)) {
        return;
      }
      setTimeout(() => {
        if (this._isOffline()) {
          return;
        }
        this._send({ type: "DETAILS_JOIN_REQUEST", name });
        // Release the details channel once the fresh flags have arrived, unless
        // the full profile modal is open for this user (which holds it itself).
        setTimeout(() => {
          let state = this._store.getState();
          if (
            state.userDetailsRequest &&
            state.userDetailsRequest.name === name
          ) {
            return;
          }
          let user = state.usersByName && state.usersByName[name];
          if (
            user &&
            user.details &&
            (!state.currentUser || user.name !== state.currentUser.name)
          ) {
            this.onUnjoin(user.details.channelId);
          }
        }, 5000);
      }, i * 120);
    });
  };

  // Fetch a user's game archive (the Games tab). Called on demand when the tab
  // is opened; the ARCHIVE_JOIN reducer populates gameSummariesByUser.
  onRequestArchive = (name: string) => {
    if (this._isOffline() || !name) {
      return;
    }
    this._send({ type: "JOIN_ARCHIVE_REQUEST", name });
  };

  // Lightweight details fetch backing the player hover card. Debounced so a
  // quick pass over a row never hits the network; the joined details channel is
  // released again in onPlayerHoverEnd to avoid leaking subscriptions. Only the
  // details channel is joined (not the archive) to keep this to one request.
  _hoverTimer: ?TimeoutID = null;
  _hoverName: ?string = null;

  onPlayerHover = (name: string) => {
    if (this._isOffline() || !name) {
      return;
    }
    if (this._hoverTimer) {
      clearTimeout(this._hoverTimer);
    }
    this._hoverName = name;
    this._hoverTimer = setTimeout(() => {
      this._hoverTimer = null;
      // Always re-join the details channel so presence (online/idle/playing) is
      // current — a cached `user.details` can hold a stale `sleeping` flag from a
      // previous hover. The fetch is debounced (350ms) and one user at a time, so
      // the cost is negligible; this matches what the full profile modal does.
      this._send({ type: "DETAILS_JOIN_REQUEST", name });
    }, 350);
  };

  onPlayerHoverEnd = (name: string) => {
    if (this._hoverTimer && this._hoverName === name) {
      clearTimeout(this._hoverTimer);
      this._hoverTimer = null;
    }
    if (this._isOffline()) {
      return;
    }
    let { usersByName, currentUser, userDetailsRequest } =
      this._store.getState();
    // Don't unjoin if the full profile modal is open for this user.
    if (userDetailsRequest && userDetailsRequest.name === name) {
      return;
    }
    let user = usersByName && usersByName[name];
    if (user && user.details) {
      if (!currentUser || user.name !== currentUser.name) {
        this.onUnjoin(user.details.channelId);
      }
    }
  };

  // Request a user's archive without opening their profile. The archive
  // includes their in-play games, which lets a simul participant discover the
  // host's other boards.
  onJoinArchive = (name: string) => {
    if (this._isOffline()) {
      return;
    }
    this._send({ type: "JOIN_ARCHIVE_REQUEST", name });
  };

  onCloseUserDetail = () => {
    let { userDetailsRequest, usersByName, currentUser } =
      this._store.getState();
    if (userDetailsRequest) {
      let user = usersByName[userDetailsRequest.name];
      if (user && user.details) {
        if (!currentUser || user.name !== currentUser.name) {
          this.onUnjoin(user.details.channelId);
        }
      }
    }
    this._store.dispatch({ type: "CLOSE_USER_DETAILS" });
  };

  onFriendAdd = async (
    name: string,
    friendType: "buddy" | "fan" | "censored",
    text?: string
  ) => {
    if (this._isOffline()) {
      return;
    }
    const msg: Object = {
      type: "FRIEND_ADD",
      name,
      friendType,
      callbackKey: 1,
    };
    if (text) {
      msg.text = text;
    }
    try {
      await this._client.sendMessage(msg);
    } catch (err) {
      console.warn("FRIEND_ADD failed", err);
    }
  };

  onFriendRemove = async (
    name: string,
    friendType: "buddy" | "fan" | "censored"
  ) => {
    if (this._isOffline()) {
      return;
    }
    try {
      await this._client.sendMessage({
        type: "FRIEND_REMOVE",
        name,
        friendType,
        callbackKey: 1,
      });
    } catch (err) {
      console.warn("FRIEND_REMOVE failed", err);
    }
  };

  // Snapshot of the current user's relationship to `name`, read straight from
  // the store. Backs the quick friend/follow/block buttons in the hover card so
  // they don't need the buddy/fan/censored lists threaded through every call
  // site. `canModify` is false for guests (who cannot edit social lists) and for
  // the current user themselves.
  getFriendStatus = (
    name: string
  ): {
    isBuddy: boolean,
    isFan: boolean,
    isCensored: boolean,
    canModify: boolean,
    isSelf: boolean,
  } => {
    let state = this._store.getState();
    let { buddies, fans, censored, currentUser } = state;
    let isSelf = !!(currentUser && currentUser.name === name);
    let isGuest = !!(
      currentUser &&
      currentUser.flags &&
      currentUser.flags.guest
    );
    return {
      isBuddy: !!(buddies && buddies.some((b) => b.name === name)),
      isFan: !!(fans && fans.some((f) => f.name === name)),
      isCensored: !!(censored && censored.some((c) => c.name === name)),
      canModify: !isSelf && !isGuest,
      isSelf,
    };
  };

  onRequestRankGraph = (channelId: number) => {
    this._send({
      type: "DETAILS_RANK_GRAPH_REQUEST",
      channelId,
    });
  };

  onSelectConversation = (conversationId: number) => {
    let msgs = [
      { type: "SAW_CONVERSATION", conversationId },
      { type: "CONVERSATION_CHANGE", conversationId },
    ];
    let activeConvId = this._store.getState().activeConversationId;
    if (activeConvId) {
      msgs.push({ type: "SAW_CONVERSATION", conversationId: activeConvId });
    }
    this._store.dispatch(msgs);
  };

  markConversationSeen = (conversationId: number) => {
    this._store.dispatch({ type: "SAW_CONVERSATION", conversationId });
  };

  onClearConversationHistory = (conversationId: number) => {
    let state = this._store.getState();
    let convo = state.conversationsById[conversationId];
    if (!convo) {
      return;
    }
    if (convo.user && state.currentUser) {
      clearChatHistory(state.currentUser.name, convo.user);
    }
    this._store.dispatch({
      type: "CLEAR_CONVERSATION_HISTORY",
      conversationId,
    });
  };

  onCloseConversation = (conversationId: number) => {
    if (this._isOffline()) {
      return;
    }
    // Closing a direct conversation marks its saved history as closed so it is
    // NOT auto-opened on the next login — but the messages are kept, so the chat
    // still shows its history if the user deliberately reopens it.
    let state = this._store.getState();
    let convo = state.conversationsById[conversationId];
    if (convo && convo.user && state.currentUser) {
      setChatHistoryClosed(state.currentUser.name, convo.user, true);
    }
    this._store.dispatch({ type: "CLOSE_CONVERSATION", conversationId });
    if (!isTempId(conversationId)) {
      this.onUnjoin(conversationId);
    }
  };

  // `pendingBody` (optional) is queued and sent into the conversation as soon
  // as it is live — used by onStartChatWithMessage. Queuing it on the same
  // callbackKey as the CONVO_REQUEST below avoids issuing a second request
  // (which would create a duplicate channel for the same partner).
  onStartChat = (user: User, pendingBody?: string) => {
    if (this._isOffline()) {
      return;
    }
    this.onChangeNav("chat");
    let state = this._store.getState();
    let { conversationsById, currentUser } = state;
    // Reuse an existing open conversation; a closed one must not be re-selected
    // (the chat list hides closed conversations, so nothing would show).
    let userConvo = Object.keys(conversationsById).find(
      (cid) =>
        conversationsById[cid].user === user.name &&
        conversationsById[cid].status !== "closed"
    );
    if (userConvo) {
      let convId = parseInt(userConvo, 10);
      this.onSelectConversation(convId);
      if (pendingBody) {
        this.onSendChat(pendingBody, convId);
      }
      return;
    }
    let channelId = tempId();
    let callbackKey = tempId();
    if (pendingBody) {
      this._pendingDeclineChats[callbackKey] = pendingBody;
    }
    // Reopen with any saved history so previously received messages reappear.
    let messages = currentUser
      ? loadChatHistory(currentUser.name, user.name)
      : [];
    // Reopening a previously-closed conversation un-marks it, so it will be
    // auto-restored on future logins again.
    if (currentUser) {
      setChatHistoryClosed(currentUser.name, user.name, false);
    }
    this._store.dispatch({
      type: "CONVO_JOIN",
      user,
      channelId,
      callbackKey,
      joinNow: true,
      messages,
    });
    this._send({
      type: "CONVO_REQUEST",
      name: user.name,
      callbackKey,
    });
  };

  onSendChat = (body: string, conversationId: number) => {
    if (this._isOffline()) {
      return;
    }
    let state = this._store.getState();
    let { channelMembership, conversationsById } = state;
    if (!channelMembership || !channelMembership[conversationId]) {
      return;
    }
    // A conversation restored from saved history has only a temp id and no live
    // channel yet. Reviving it: stamp the temp conversation with a callbackKey
    // (so the incoming CONVO_JOIN merges into it, keeping the restored
    // messages), request a real channel, and queue the message to send once the
    // CONVO_JOIN arrives. The optimistic CHAT is dispatched on flush, not here,
    // to avoid a duplicate bubble.
    let convo = conversationsById[conversationId];
    if (isTempId(conversationId) && convo && convo.user) {
      let callbackKey = tempId();
      this._pendingDeclineChats[callbackKey] = body;
      this._store.dispatch({
        type: "CONVO_REVIVE",
        conversationId,
        callbackKey,
      });
      this._send({
        type: "CONVO_REQUEST",
        name: convo.user,
        callbackKey,
      });
      return;
    }
    // Optimistic message shown until the server echoes it back (or the send
    // timeout resolves it).
    this._dispatchOptimisticChat(conversationId, body);
  };

  onSendGameChat = (body: string, gameId: number) => {
    if (this._isOffline()) {
      return;
    }
    let { channelMembership } = this._store.getState();
    if (channelMembership && channelMembership[gameId]) {
      this._send({ type: "CHAT", text: body, channelId: gameId });
    }
  };

  onJoinRoom = (room: Room) => {
    if (this._isOffline()) {
      return;
    }
    this._store.dispatch([
      { type: "ROOM_JOIN", channelId: room.id },
      { type: "CONVERSATION_CHANGE", conversationId: room.id },
    ]);
    this._send({ type: "JOIN_REQUEST", channelId: room.id });
    this._send({ type: "ROOM_DESC_REQUEST", channelId: room.id });
  };

  onFetchRoomList = () => {
    let roomsById = this._store.getState().roomsById;
    // Only fetch rooms whose name we don't know yet
    let roomIds = distinct(
      Object.keys(roomsById).filter(
        (id) => typeof roomsById[id].name !== "string"
      )
    );
    if (roomIds.length) {
      this._send({ type: "ROOM_NAMES_REQUEST", rooms: roomIds });
    }
  };

  onCheckRoomNames = (games: Array<GameChannel>) => {
    if (this._isOffline()) {
      return;
    }

    let state = this._store.getState();

    // Room names we don't have yet
    let roomsById = state.roomsById;
    let roomIds = distinct(
      games
        .filter(
          (g) =>
            g.roomId &&
            (!roomsById[g.roomId] ||
              typeof roomsById[g.roomId].name !== "string")
        )
        .map((g) => g.roomId)
    );
    if (roomIds.length) {
      this._send({ type: "ROOM_NAMES_REQUEST", rooms: roomIds });
    }
  };

  onArchiveJoinSuccess = (channelId: number, user: User) => {
    let state = this._store.getState();
    let { currentUser } = state;
    if (currentUser && currentUser.name === user.name) {
      // Stay subscribed to own archive, for unfinished games list. Also fetch
      // our game tags so they can be shown/edited in My Games. FETCH_TAGS is a
      // global request and takes no fields.
      this._send({ type: "FETCH_TAGS" });
      return;
    }

    // Immediately unjoin - don't care about live updates for anyone else
    this.onUnjoin(channelId);
  };

  // Set (or clear, with an empty string) the personal tag on one of our own
  // archived games. The tag is stored server-side and echoed back via
  // FETCH_TAGS_RESULT; we also update the store optimistically.
  onTagGame = (timestamp: string, text: string) => {
    if (this._isOffline()) {
      return;
    }
    let { archiveChannelId } = this._store.getState();
    if (typeof archiveChannelId !== "number") {
      return;
    }
    let tag = text.trim().slice(0, 50);
    this._store.dispatch({ type: "SET_GAME_TAG", timestamp, tag });
    this._send({
      type: "TAG_GAME",
      gameTimestamp: timestamp,
      text: tag,
    });
  };

  onUnjoin = (channelId: number) => {
    if (this._isOffline()) {
      return;
    }
    let { channelMembership, gamesById } = this._store.getState();
    if (!channelMembership || !channelMembership[channelId]) {
      return;
    }
    // If the server already ended/removed this game channel, sending
    // UNJOIN_REQUEST to it crashes the whole session ("Unknown channel NNN").
    // KGS destroys a watched game's channel when it finishes; we just clean up
    // our own membership locally instead of touching the dead channel.
    let game = gamesById && gamesById[channelId];
    if (game && (game.over || game.deletedTime)) {
      this._store.dispatch({ type: "UNJOIN", channelId });
      return;
    }
    this._send({ type: "UNJOIN_REQUEST", channelId });
  };

  // Join a game for watching without changing watchGameId in store
  onJoinGameWatch = (gameId: number) => {
    this._store.dispatch({ type: "GAME_JOIN", channelId: gameId });
    if (!this._isOffline()) {
      this._send({ type: "JOIN_REQUEST", channelId: gameId });
    }
  };

  // Leave a watched game without affecting store watchGameId
  onLeaveGameWatch = (gameId: number) => {
    this.onUnjoin(gameId);
  };

  onChangeCurrentNode = (game: GameChannel, nodeId: number) => {
    this._store.dispatch({
      type: "SET_CURRENT_GAME_NODE",
      currentNode: nodeId,
      channelId: game.id,
    });
  };

  onPlayMove = async (game: GameChannel, loc: Point, color: ?PlayerColor) => {
    // Clear any previous move error
    this._store.dispatch({
      type: "SET_GAME_MOVE_ERROR",
      channelId: game.id,
      error: null,
    });
    if (!color) {
      return;
    }

    let tree = game.tree;
    if (tree) {
      let activeNodeId = tree.activeNode;
      let activeNode = tree.nodes[activeNodeId];
      let activeComputed = tree.computedState[activeNodeId];
      if (activeNode && activeComputed) {
        let board = activeComputed.board;
        let parentBoard = null;
        let parentNodeId = activeNode.parent;
        if (
          typeof parentNodeId === "number" &&
          tree.computedState[parentNodeId]
        ) {
          parentBoard = tree.computedState[parentNodeId].board;
        }

        // Determine ruleset
        let ruleset = "japanese";
        let rootNode = tree.nodes[tree.rootNode];
        if (rootNode) {
          let rulesProp = rootNode.props.find((p) => p.name === "RULES");
          // $FlowFixMe
          if (rulesProp && typeof rulesProp.rules !== "undefined") {
            try {
              // $FlowFixMe
              ruleset = validateRuleSet(rulesProp.rules);
            } catch (e) {}
          }
        }

        // Perform client-side validation
        let validationError = validateMove(
          board,
          parentBoard,
          loc,
          color,
          ruleset
        );
        if (validationError) {
          this._store.dispatch({
            type: "SET_GAME_MOVE_ERROR",
            channelId: game.id,
            error: validationError,
          });
          // Auto-clear the error toast after 2.5 seconds
          setTimeout(() => {
            let state = this._store.getState();
            let currGame = state.gamesById[game.id];
            if (currGame && currGame.moveError === validationError) {
              this._store.dispatch({
                type: "SET_GAME_MOVE_ERROR",
                channelId: game.id,
                error: null,
              });
            }
          }, 2500);
          return; // Prevent sending illegal move to the server
        }
      }
    }

    // Sound the click now, inside the user gesture (mobile autoplay policies
    // can block audio triggered later from the server echo). The board diff
    // skips the echo of this placement so it doesn't sound twice.
    playLocalStoneSound();

    this._store.dispatch({
      type: "START_GAME_MOVE",
      channelId: game.id,
      loc,
      color,
    });

    try {
      await this._client.sendMessage({
        type: "GAME_MOVE",
        channelId: game.id,
        loc,
      });
    } catch (err) {
      clearLocalStonePlay();
      // Say what actually happened: only a 400 is the server rejecting the
      // move; a dead session or a network failure means the move never got
      // there at all.
      let errorText;
      if (err && err.type === "noClient") {
        errorText = "Connection lost - please log in again";
      } else if (err && err.type === "badRequest") {
        errorText = "Server rejected move";
      } else {
        errorText = "Move not sent - connection problem";
      }
      this._store.dispatch([
        {
          type: "CANCEL_GAME_MOVE",
          channelId: game.id,
        },
        {
          type: "SET_GAME_MOVE_ERROR",
          channelId: game.id,
          error: errorText,
        },
      ]);
      setTimeout(() => {
        let state = this._store.getState();
        let currGame = state.gamesById[game.id];
        if (currGame && currGame.moveError === errorText) {
          this._store.dispatch({
            type: "SET_GAME_MOVE_ERROR",
            channelId: game.id,
            error: null,
          });
        }
      }, 2500);
      console.warn("Play move failed:", err);
    }
  };

  onMarkLife = (game: GameChannel, loc: Point, alive: boolean) => {
    this._send({
      type: "GAME_MARK_LIFE",
      channelId: game.id,
      x: loc.x,
      y: loc.y,
      alive,
    });
  };

  onPass = (game: GameChannel) => {
    this._send({
      type: "GAME_MOVE",
      channelId: game.id,
      loc: "PASS",
    });
  };

  onUndo = (game: GameChannel) => {
    this._send({
      type: "GAME_UNDO_REQUEST",
      channelId: game.id,
    });
  };

  onResign = (game: GameChannel) => {
    this._send({
      type: "GAME_RESIGN",
      channelId: game.id,
    });
  };

  onAddGameTime = (game: GameChannel, role: GameRole, seconds: number) => {
    this._send({
      type: "GAME_ADD_TIME",
      channelId: game.id,
      time: seconds,
      role,
    });
  };

  onDoneScoring = (game: GameChannel) => {
    this._send({
      type: "GAME_SCORING_DONE",
      channelId: game.id,
      doneId: game.doneId,
    });
  };

  onAcceptUndo = (game: GameChannel) => {
    this._send({
      type: "GAME_UNDO_ACCEPT",
      channelId: game.id,
    });
  };

  onDeclineUndo = (game: GameChannel) => {
    this._store.dispatch({
      type: "GAME_UNDO_DECLINE",
      channelId: game.id,
    });
  };

  onGameTimeExpired = (gameId: number) => {
    this._send({
      type: "GAME_TIME_EXPIRED",
      channelId: gameId,
    });
  };

  onUpdateProfileDetails = async (user: User, details: UserDetails) => {
    if (this._isOffline()) {
      return;
    }
    this._store.dispatch({
      type: "UPDATE_LOCAL_USER_DETAILS",
      user: { name: user.name, authLevel: user.authLevel },
      details,
    });
    let prevRankWanted =
      !!(user.flags && user.flags.canPlayRanked) ||
      (user.rank !== undefined && user.rank !== null);
    let rankWantedChanged = details.rankWanted !== prevRankWanted;

    // Await the change so the server commits it before we leave the channel.
    // Unjoining while DETAILS_CHANGE is still in flight makes KGS drop the
    // update (notably rankWanted).
    try {
      await this._client.sendMessage({
        type: "DETAILS_CHANGE",
        channelId: details.channelId,
        personalName: details.personalName,
        personalEmail: details.email,
        personalInfo: details.personalInfo,
        emailWanted: details.emailWanted,
        emailPrivate: details.privateEmail,
        privateEmail: details.privateEmail,
        rankWanted: details.rankWanted,
        authLevel: user.authLevel || "normal",
      });
    } catch (err) {
      // Send failed — don't unjoin/refresh below, and don't let the rejection
      // surface as an uncaught error (sendMessage already updated client state).
      console.warn("DETAILS_CHANGE failed", err);
      return;
    }
    if (rankWantedChanged) {
      // Force a refresh, since changing rankWanted doesn't get reflected in
      // DETAILS_UPDATE response
      this.onUnjoin(details.channelId);
      setTimeout(() => {
        // If we do it right away it doesn't always work
        this._send({
          type: "DETAILS_JOIN_REQUEST",
          name: user.name,
        });
      }, 500);
    }
  };

  onUpdatePassword = (user: User, newPassword: string) => {
    if (this._isOffline()) {
      return;
    }
    this._send({
      type: "SET_PASSWORD",
      user: user.name,
      password: newPassword,
    });
  };

  onShowFeedbackModal = () => {
    this._store.dispatch({ type: "SHOW_FEEDBACK_MODAL" });
  };

  onHideFeedbackModal = () => {
    this._store.dispatch({ type: "HIDE_FEEDBACK_MODAL" });
  };

  // Lightweight presence fetch for a single user (used by the feedback form to
  // show whether the maintainer is online). Joins the details channel only if we
  // don't already have rich details cached.
  onRequestPresence = (name: string) => {
    if (this._isOffline() || !name) {
      return;
    }
    let { usersByName } = this._store.getState();
    let user = usersByName && usersByName[name];
    if (user && user.details) {
      return;
    }
    this._send({ type: "DETAILS_JOIN_REQUEST", name });
  };

  // Ask the server for its live statistics (users online, rooms, games, uptime).
  // The reply arrives as a SERVER_STATS message. May return nothing if the
  // server restricts this to admins — the UI handles the empty case.
  onRequestServerStats = () => {
    if (this._isOffline()) {
      return;
    }
    this._send({ type: "REQUEST_SERVER_STATS" });
  };

  // Open a direct chat with `name` and immediately send `body` into it. Used by
  // the feedback form's "chat" path so the typed message lands in the chat.
  onStartChatWithMessage = (name: string, body: string) => {
    if (this._isOffline() || !name || !body) {
      return;
    }
    let user = this._store.getState().usersByName[name] || { name };
    this.onStartChat(user, body);
  };

  onShowPreferencesModal = () => {
    this._store.dispatch({ type: "SHOW_PREFERENCES_MODAL" });
  };

  onHidePreferencesModal = () => {
    this._store.dispatch({ type: "HIDE_PREFERENCES_MODAL" });
  };

  onShowAboutModal = (tab?: string) => {
    this._store.dispatch({ type: "SHOW_ABOUT_MODAL", tab });
  };

  onHideAboutModal = () => {
    this._store.dispatch({ type: "HIDE_ABOUT_MODAL" });
  };

  onAcceptCookies = () => {
    this._store.dispatch({ type: "ACCEPT_COOKIES" });
    this.onSaveAppState();
  };

  onDeclineCookies = () => {
    this._store.dispatch({ type: "DECLINE_COOKIES" });
    this.onSaveAppState();
  };

  onShowLeaveMessageModal = (username?: string) => {
    this._store.dispatch({ type: "SHOW_LEAVE_MESSAGE_MODAL", username });
  };

  onHideLeaveMessageModal = () => {
    this._store.dispatch({ type: "HIDE_LEAVE_MESSAGE_MODAL" });
  };

  onSendMailboxMessage = async (
    recipientName: string,
    messageText: string
  ): Promise<void> => {
    if (this._isOffline()) {
      return;
    }
    this._store.dispatch({ type: "LEAVE_MESSAGE_SEND_START" });
    try {
      await this._client.sendMessage({
        type: "MESSAGE_CREATE",
        callbackKey: 1,
        name: recipientName,
        text: messageText,
      });
    } catch (err) {
      console.warn("Failed to send mailbox message:", err);
      this._store.dispatch({ type: "MESSAGE_CREATE_ERROR" });
    }
  };

  onDeleteMailboxMessage = async (time: number, username: string) => {
    if (this._isOffline()) {
      return;
    }
    this._store.dispatch({ type: "MESSAGE_DELETE_LOCAL", time, username });
    try {
      await this._client.sendMessage({
        type: "MESSAGE_DELETE",
        messages: [{ date: time, name: username }],
      });
    } catch (err) {
      console.warn("Failed to delete mailbox message:", err);
    }
  };

  onClearAllMailboxMessages = async () => {
    if (this._isOffline()) {
      return;
    }
    this._store.dispatch({ type: "MESSAGE_CLEAR_ALL_LOCAL" });
    try {
      await this._client.sendMessage({
        type: "MESSAGE_DELETE",
      });
    } catch (err) {
      console.warn("Failed to clear mailbox:", err);
    }
  };

  onClickContribute = () => {
    window.open("https://github.com/rampichino/Kido", "_blank");
  };

  onAutomatchCreate = (prefs: AutomatchPrefs) => {
    if (this._isOffline()) {
      return;
    }
    this._send({
      type: "AUTOMATCH_CREATE",
      blitzOk: prefs.blitzOk,
      estiamtedRank: prefs.estimatedRank,
      fastOk: prefs.fastOk,
      freeOk: prefs.freeOk,
      humanOk: prefs.humanOk,
      maxHandicap: prefs.maxHandicap,
      mediumOk: prefs.mediumOk,
      rankedOk: prefs.rankedOk,
      robotOk: prefs.robotOk,
      unrankedOk: prefs.unrankedOk,
    });
  };

  onAutomatchSetPrefs = (prefs: AutomatchPrefs) => {
    if (this._isOffline()) {
      return;
    }
    this._send({
      type: "AUTOMATCH_SET_PREFS",
      blitzOk: prefs.blitzOk,
      estiamtedRank: prefs.estimatedRank,
      fastOk: prefs.fastOk,
      freeOk: prefs.freeOk,
      humanOk: prefs.humanOk,
      maxHandicap: prefs.maxHandicap,
      mediumOk: prefs.mediumOk,
      rankedOk: prefs.rankedOk,
      robotOk: prefs.robotOk,
      unrankedOk: prefs.unrankedOk,
    });
  };

  onAutomatchCancel = () => {
    if (this._isOffline()) {
      return;
    }
    this._send({
      type: "AUTOMATCH_CANCEL",
    });
  };
}
