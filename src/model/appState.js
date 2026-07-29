// @flow
import { loadFilter } from "../util/filterPrefs";
import type { AppState, KgsClientState } from "./types";

// Resets on each login
export function getEmptyServerState() {
  return {
    currentUser: null,
    serverInfo: null,
    serverStats: null,
    roomsById: {},
    gamesById: {},
    gameSummariesByUser: {},
    gameTagsByTimestamp: {},
    archiveChannelId: null,
    rankGraphsByChannelId: {},
    activeGames: [],
    challenges: [],
    unfinishedGames: [],
    watchGameId: null,
    playGameId: null,
    playChallengeId: null,
    nav: "chat",
    usersByName: {},
    conversationsById: {},
    channelMembership: {},
    automatchPrefs: null,
    automatchEnabled: false,
    playbacks: [],
    activeConversationId: null,
    userDetailsRequest: null,
    buddyPresenceSettling: false,
    showUnderConstruction: false,
    challengeTakenNotice: null,
    showFeedbackModal: false,
    showPreferencesModal: false,
    reviewGameId: null,
    pendingReviewId: null,
    pendingLoadSummary: null,
    buddies: [],
    fans: [],
    censored: [],
    creatingChallenge: false,
    challengeTargetUser: null,
    challengeMinimized: false,
    showLeaveMessageModal: false,
    leaveMessageStatus: null,
    leaveMessageTargetUser: null,
    demoSaveCloseGameId: null,
    showAboutModal: false,
    aboutModalTab: "about",
    mailboxMessages: [],
    unreadMailboxCount: 0,
  };
}

export function getInitialState(clientState: KgsClientState): AppState {
  return {
    initialized: false,
    preferences: {},
    watchFilter: loadFilter("watch"),
    playFilter: loadFilter("play"),
    savedAt: null,
    loginError: null,
    logoutError: null,
    reconnecting: false,
    clientState,
    cookieConsentStatus: null,
    ...getEmptyServerState(),
  };
}

export function prepareSavedAppState(appState: AppState): AppState {
  // Always pretend we're online when saving state, so after restoration
  // we can try a network request before finding out what the true
  // state of the network is.
  return {
    ...appState,
    clientState: {
      ...appState.clientState,
      network: "online",
    },
  };
}
