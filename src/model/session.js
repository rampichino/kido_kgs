// @flow
import { getEmptyServerState } from "./appState";
import { parseUser } from "./user";
import { tempId } from "./tempId";
import { loadAllChatHistories } from "../util/chatHistory";
import type {
  AppState,
  KgsMessage,
  Conversation,
  ChannelMembership,
  Index,
  User,
} from "./types";

// Rebuild dormant direct-conversation channels from saved history so messages
// received before logout are visible again after login. Each gets a temp id and
// a `conversation` channel-membership entry so it shows in the chat list; it is
// revived into a real channel when the user sends a message.
function restoreChatHistory(prevState: AppState, ownerName: string): AppState {
  let histories = loadAllChatHistories(ownerName);
  let partners = Object.keys(histories);
  if (partners.length === 0) {
    return prevState;
  }
  let conversationsById: Index<Conversation> = {
    ...prevState.conversationsById,
  };
  let channelMembership: ChannelMembership = {
    ...prevState.channelMembership,
  };
  let usersByName: Index<User> = { ...prevState.usersByName };
  for (let partner of partners) {
    // Skip if a live conversation with this partner already exists.
    let existing = Object.keys(conversationsById).some(
      (cid) => conversationsById[cid].user === partner
    );
    if (existing) {
      continue;
    }
    let id = tempId();
    conversationsById[id] = {
      id,
      user: partner,
      messages: histories[partner],
      status: "created",
    };
    channelMembership[id] = {
      type: "conversation",
      complete: false,
      stale: true,
    };
    // Seed a minimal user so the conversation tab can render the partner's name
    // (and an offline dot) before the server sends any USER_UPDATE for them.
    // Without this the tab falls back to "[Empty]". Don't clobber a richer
    // existing entry.
    if (!usersByName[partner]) {
      usersByName[partner] = { name: partner };
    }
  }
  return { ...prevState, conversationsById, channelMembership, usersByName };
}

const MAILBOX_SEEN_KEY = "kido_mailbox_seen";

function getSeenMailboxTimes(): Set<number> {
  try {
    const raw = localStorage.getItem(MAILBOX_SEEN_KEY);
    if (raw) {
      return new Set(JSON.parse(raw));
    }
  } catch (e) {
    // ignore
  }
  return new Set();
}

function markMailboxAsSeen(times: Array<number>) {
  try {
    localStorage.setItem(MAILBOX_SEEN_KEY, JSON.stringify(times));
  } catch (e) {
    // ignore
  }
}

export function handleSessionMessage(
  prevState: AppState,
  msg: KgsMessage
): AppState {
  let nextState: AppState;
  switch (msg.type) {
    case "RESTORE_APP_STATE":
      // TODO - mark appropriate data as stale
      nextState = {
        ...msg.appState,
        loginError: null,
        logoutError: null,
      };
      return nextState;
    case "APP_STATE_INITIALIZED":
      return {
        ...prevState,
        initialized: true,
      };
    case "CLIENT_STATE_CHANGE":
      return {
        ...prevState,
        clientState: msg.clientState,
      };
    case "HELLO":
      return {
        ...prevState,
        serverInfo: {
          jsonClientBuild: msg.jsonClientBuild,
          versionMajor: msg.versionMajor,
          versionMinor: msg.versionMinor,
          versionBugfix: msg.versionBugfix,
        },
      };
    case "SERVER_STATS":
      return {
        ...prevState,
        serverStats: {
          versionMajor: msg.versionMajor,
          versionMinor: msg.versionMinor,
          versionBugfix: msg.versionBugfix,
          serverStartTime: msg.serverStartTime,
          logins: msg.logins,
          loginsMax: msg.loginsMax,
          accounts: msg.accounts,
          accountsMax: msg.accountsMax,
          rooms: msg.rooms,
          roomsMax: msg.roomsMax,
          games: msg.games,
          gamesMax: msg.gamesMax,
        },
      };
    case "LOGIN_START":
      return {
        ...prevState,
        loginError: null,
        logoutError: null,
      };
    case "RECONNECT_START":
      return {
        ...prevState,
        reconnecting: true,
        loginError: null,
        logoutError: null,
      };
    case "RECONNECT_END":
      return {
        ...prevState,
        reconnecting: false,
      };
    case "LOGIN_FAILED_MISSING_INFO":
      return {
        ...prevState,
        loginError: "Enter username and password",
      };
    // The proxy returns 403 + a JSON {error} body when it rejects a login before
    // it reaches KGS (e.g. CAPTCHA verification failed).
    case "LOGIN_FAILED_SERVER":
      return {
        ...prevState,
        loginError: msg.text || "Login failed",
      };
    case "LOGIN_FAILED_NO_SUCH_USER":
      return {
        ...prevState,
        loginError: "Login failed - no such user",
      };
    case "LOGIN_FAILED_KEEP_OUT":
      return {
        ...prevState,
        loginError: msg.text || "Login failed - you are temporarily banned",
      };
    case "LOGIN_FAILED_BAD_PASSWORD":
      return {
        ...prevState,
        loginError: msg.text || "Login failed - bad password",
      };
    case "LOGIN_FAILED_USER_ALREADY_EXISTS":
      return {
        ...prevState,
        loginError: msg.text || "Login failed - user already exists",
      };
    case "LOGIN_SUCCESS":
      nextState = {
        ...prevState,
        reconnecting: false,
        loginError: null,
        currentUser: parseUser(null, msg.you),
        preferences: { ...prevState.preferences, username: msg.you.name },
      };
      return restoreChatHistory(nextState, msg.you.name);
    case "LOGOUT_START":
      return {
        ...prevState,
        ...getEmptyServerState(),
      };
    case "LOGOUT":
      nextState = { ...prevState };
      if (msg.text) {
        nextState.logoutError = msg.text;
        // Sometimes KGS will give you a LOGOUT error when you try to log in,
        // even though you're not logged in yet
        if (prevState.clientState.status === "loggedOut") {
          nextState.loginError = msg.text;
        }
      }
      return nextState;
    case "RECONNECT":
      return {
        ...prevState,
        logoutError:
          "Automatically logged out because your account has been logged into another system",
      };
    case "SESSION_EXPIRED":
      return {
        ...prevState,
        logoutError: "Previous session expired or became invalid",
      };
    case "NAV_CHANGE":
      return {
        ...prevState,
        nav: msg.nav,
        userDetailsRequest: null,
      };
    case "SET_BUDDY_PRESENCE_SETTLING":
      return {
        ...prevState,
        buddyPresenceSettling: !!msg.settling,
      };
    case "SHOW_UNDER_CONSTRUCTION":
      return {
        ...prevState,
        showUnderConstruction: true,
      };
    case "HIDE_UNDER_CONSTRUCTION":
      return {
        ...prevState,
        showUnderConstruction: false,
      };
    case "SHOW_CHALLENGE_TAKEN_NOTICE":
      return {
        ...prevState,
        challengeTakenNotice: {
          gameId: typeof msg.gameId === "number" ? msg.gameId : null,
        },
      };
    case "HIDE_CHALLENGE_TAKEN_NOTICE":
      return {
        ...prevState,
        challengeTakenNotice: null,
      };
    case "SET_PENDING_LOAD_SUMMARY":
      return {
        ...prevState,
        pendingLoadSummary: msg.summary,
      };
    case "SET_PENDING_REVIEW":
      return {
        ...prevState,
        pendingReviewId: msg.originalId,
      };
    case "SHOW_FEEDBACK_MODAL":
      return {
        ...prevState,
        showFeedbackModal: true,
      };
    case "HIDE_FEEDBACK_MODAL":
      return {
        ...prevState,
        showFeedbackModal: false,
      };
    case "SHOW_PREFERENCES_MODAL":
      return {
        ...prevState,
        showPreferencesModal: true,
      };
    case "HIDE_PREFERENCES_MODAL":
      return {
        ...prevState,
        showPreferencesModal: false,
      };
    case "SHOW_ABOUT_MODAL":
      return {
        ...prevState,
        showAboutModal: true,
        aboutModalTab: msg.tab || "about",
      };
    case "HIDE_ABOUT_MODAL":
      return {
        ...prevState,
        showAboutModal: false,
      };
    case "ACCEPT_COOKIES":
      return {
        ...prevState,
        cookieConsentStatus: "accepted",
      };
    case "DECLINE_COOKIES":
      return {
        ...prevState,
        cookieConsentStatus: "declined",
      };
    case "SHOW_LEAVE_MESSAGE_MODAL": {
      const seenTimes = prevState.mailboxMessages.map((m) => m.time);
      markMailboxAsSeen(seenTimes);
      return {
        ...prevState,
        showLeaveMessageModal: true,
        leaveMessageStatus: null,
        leaveMessageTargetUser: msg.username || null,
        unreadMailboxCount: 0,
      };
    }
    case "HIDE_LEAVE_MESSAGE_MODAL":
      return {
        ...prevState,
        showLeaveMessageModal: false,
        leaveMessageStatus: null,
        leaveMessageTargetUser: null,
      };
    case "SHOW_DEMO_SAVE_CLOSE":
      return {
        ...prevState,
        demoSaveCloseGameId: msg.gameId,
      };
    case "HIDE_DEMO_SAVE_CLOSE":
      return {
        ...prevState,
        demoSaveCloseGameId: null,
      };
    case "MESSAGES": {
      const messages = (msg.messages || []).map((m) => ({
        time: m.time,
        user: parseUser(prevState.usersByName[m.user.name], m.user),
        text: m.text,
      }));
      const seenTimes = getSeenMailboxTimes();
      const unreadMailboxCount = prevState.showLeaveMessageModal
        ? 0
        : messages.filter((m) => !seenTimes.has(m.time)).length;
      return {
        ...prevState,
        mailboxMessages: messages,
        unreadMailboxCount,
      };
    }
    case "MESSAGE_DELETE_LOCAL": {
      const remaining = prevState.mailboxMessages.filter(
        (m) => !(m.time === msg.time && m.user.name === msg.username)
      );
      markMailboxAsSeen(remaining.map((m) => m.time));
      return { ...prevState, mailboxMessages: remaining };
    }
    case "MESSAGE_CLEAR_ALL_LOCAL":
      markMailboxAsSeen([]);
      return { ...prevState, mailboxMessages: [] };
    case "LEAVE_MESSAGE_SEND_START":
      return {
        ...prevState,
        leaveMessageStatus: "sending",
      };
    case "MESSAGE_CREATE_SUCCESS":
      return {
        ...prevState,
        leaveMessageStatus: "success",
      };
    case "MESSAGE_CREATE_NO_USER":
      return {
        ...prevState,
        leaveMessageStatus: "noUser",
      };
    case "MESSAGE_CREATE_FULL":
      return {
        ...prevState,
        leaveMessageStatus: "full",
      };
    case "MESSAGE_CREATE_CONNECTED":
      return {
        ...prevState,
        leaveMessageStatus: "connected",
      };
    case "MESSAGE_CREATE_ERROR":
      return {
        ...prevState,
        leaveMessageStatus: "error",
      };
    case "UPDATE_PREFERENCES":
      return {
        ...prevState,
        preferences: { ...prevState.preferences, ...msg.preferences },
      };
    case "MINIMIZE_CHALLENGE":
      return {
        ...prevState,
        challengeMinimized: true,
      };
    case "RESTORE_CHALLENGE":
    case "PLAY_CHALLENGE":
    case "CLOSE_CHALLENGE":
      return {
        ...prevState,
        challengeMinimized: false,
      };
    case "START_CREATE_CHALLENGE":
      return {
        ...prevState,
        nav: "play",
        creatingChallenge: true,
        challengeTargetUser: msg.username || null,
        playChallengeId: null,
        challengeMinimized: false,
      };
    case "CANCEL_CREATE_CHALLENGE":
    case "CHALLENGE_JOIN":
    case "JOIN_COMPLETE":
    case "GAME_JOIN":
    case "CHALLENGE_FINAL":
      return {
        ...prevState,
        creatingChallenge: false,
        challengeTargetUser: null,
        challengeMinimized: false,
      };
    default:
      return prevState;
  }
}
