// @flow
import { parseGameChannel, parseGameSummary } from "./parse";
import {
  isGameProposalPlayer,
  isGamePlayer,
  isGamePlaying,
  computeGameNodeStates,
  getGameLine,
} from "./tree";
import { sortGames } from "./display";
import { parseUser } from "../user";
import type {
  AppState,
  KgsMessage,
  GameChannel,
  GameSummary,
  GameTree,
  Index,
  ChannelMembership,
  GameRole,
} from "../types";

// Tags arrive separately from the archive (via FETCH_TAGS_RESULT, keyed by
// game timestamp), so merge them onto the summaries we already have.
function applyTags(
  summaries: Array<GameSummary>,
  tags: Index<string>
): Array<GameSummary> {
  return summaries.map((summary) => {
    let tag = tags[summary.timestamp];
    if (tag) {
      return summary.tag === tag ? summary : { ...summary, tag };
    }
    return summary.tag ? { ...summary, tag: undefined } : summary;
  });
}

function normalizeRole(rawRole: any): GameRole {
  let role: string = "";
  if (typeof rawRole === "number") {
    if (rawRole === 0) {
      role = "challengeCreator";
    } else if (rawRole === 1) {
      role = "owner";
    } else if (rawRole === 2) {
      role = "white";
    } else if (rawRole === 3) {
      role = "white_2";
    } else if (rawRole === 4) {
      role = "black";
    } else if (rawRole === 5) {
      role = "black_2";
    }
  } else if (typeof rawRole === "string") {
    let matches = rawRole.match(/\[([^\]]+)\]/);
    let roleName = (matches && matches[1]) || rawRole;
    role = roleName.toLowerCase();
  } else {
    role = String(rawRole);
  }
  return (role: any);
}

function _handleGameMessage(prevState: AppState, msg: KgsMessage): AppState {
  let chanId = msg.channelId;
  if (
    msg.type === "ROOM_JOIN" ||
    msg.type === "GAME_LIST" ||
    msg.type === "GLOBAL_GAMES_JOIN"
  ) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    if (msg.games) {
      for (let game of msg.games) {
        gamesById[game.channelId] = parseGameChannel(
          gamesById[game.channelId],
          game
        );
      }
    }
    let nextState = { ...prevState, gamesById };

    // Channel membership
    if (msg.type === "GLOBAL_GAMES_JOIN" && chanId) {
      let chanMem: ChannelMembership = { ...prevState.channelMembership };
      chanMem[chanId] = { type: "gameList", complete: false, stale: false };
      nextState.channelMembership = chanMem;
    }

    return nextState;
  } else if (msg.type === "GAME_CONTAINER_REMOVE_GAME" && chanId) {
    // Note - we don't actually track game/channel associations other than roomId,
    // which is attached to the game channel record itself. We only remove games
    // that should be removed from all views (global list, room, game screen)
    let game = prevState.gamesById[msg.gameId];
    if (game) {
      let watching = prevState.channelMembership[msg.gameId];
      let inRoom = prevState.channelMembership[game.roomId];
      if (!watching && (!inRoom || (inRoom && game.roomId === chanId))) {
        let gamesById: Index<GameChannel> = { ...prevState.gamesById };
        gamesById[msg.gameId] = {
          ...game,
          deletedTime: Date.now(),
        };
        let playChallengeId =
          prevState.playChallengeId === msg.gameId
            ? null
            : prevState.playChallengeId;
        return { ...prevState, gamesById, playChallengeId };
      }
    }
  } else if (msg.type === "GAME_OVER" && chanId) {
    let game = prevState.gamesById[chanId];
    if (!game) {
      return prevState;
    }
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    let overGame = { ...game, over: true };
    if (msg.score !== undefined) {
      overGame.score = msg.score;
    }
    gamesById[chanId] = overGame;
    let nextState = { ...prevState, gamesById };
    // Patch the matching entry in our own archive so My Games stops treating
    // the game as in-play immediately — KGS's ARCHIVE_GAMES_CHANGED for the
    // final summary can lag (or never arrive if the subscription dropped),
    // and a stale inPlay flag routes the click into the dead resume flow.
    let currentUser = prevState.currentUser;
    let ts = game.summary && game.summary.timestamp;
    if (currentUser && ts) {
      let summaries = prevState.gameSummariesByUser[currentUser.name];
      let idx = summaries ? summaries.findIndex((s) => s.timestamp === ts) : -1;
      if (summaries && idx >= 0) {
        let newSummaries = [...summaries];
        let patched = { ...newSummaries[idx] };
        delete patched.inPlay;
        if (msg.score !== undefined) {
          patched.score = msg.score;
        }
        newSummaries[idx] = patched;
        nextState.gameSummariesByUser = {
          ...prevState.gameSummariesByUser,
          [currentUser.name]: newSummaries,
        };
      }
    }
    return nextState;
  } else if (
    (msg.type === "GAME_JOIN" ||
      msg.type === "GAME_UPDATE" ||
      msg.type === "GAME_STATE" ||
      msg.type === "GAME_NAME_CHANGE" ||
      msg.type === "GAME_PREP_STATUS" ||
      msg.type === "CHALLENGE_JOIN") &&
    chanId
  ) {
    // Special case to remove game name
    if (msg.type === "GAME_NAME_CHANGE" && !msg.name) {
      msg.name = null;
    }

    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    let game = parseGameChannel(gamesById[chanId], msg);
    let summary = game.summary;
    gamesById[chanId] = game;
    let nextState = { ...prevState, gamesById };

    // Channel membership
    if (msg.type === "GAME_JOIN" || msg.type === "CHALLENGE_JOIN") {
      let chanMem: ChannelMembership = { ...prevState.channelMembership };
      chanMem[chanId] = { type: "game", complete: false, stale: false };
      nextState.channelMembership = chanMem;

      if (
        prevState.watchGameId &&
        summary &&
        summary.timestamp === prevState.watchGameId
      ) {
        nextState.watchGameId = chanId;
      } else if (
        prevState.playGameId &&
        summary &&
        summary.timestamp === prevState.playGameId
      ) {
        nextState.playGameId = chanId;
      }

      if (summary && summary.type === "review") {
        nextState.reviewGameId = chanId;
        // A game loaded from the archive arrives as a review channel whose own
        // summary describes the review session (today's date, partial players),
        // not the archived game. Attach the stashed original archive summary so
        // the channel keeps the correct date + players (used for the SGF URL).
        if (prevState.pendingLoadSummary) {
          gamesById[chanId] = {
            ...game,
            loadedSummary: prevState.pendingLoadSummary,
          };
          nextState.gamesById = gamesById;
          nextState.pendingLoadSummary = null;
        }
      }
    }

    // Created a challenge
    if (msg.type === "CHALLENGE_JOIN" && !prevState.playChallengeId) {
      nextState.playChallengeId = chanId;
    }

    return nextState;
  } else if (msg.type === "GAME_REVIEW") {
    let oldGameId: number = msg.originalId;
    let newGameId: number = msg.review.channelId;
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    let originalGame = gamesById[oldGameId];
    let game = parseGameChannel(originalGame, msg.review);
    // The review is seeded from the original game, so parseGameChannel copies
    // its fields — including `saved` (a finished game is already archived). But a
    // fresh review is a NEW, unsaved editing session: reset the flag so closing
    // it with edits prompts to save (see onRequestLeaveGame in AppActions).
    game = { ...game, saved: false };
    // The review payload's `players` map carries only the review owner, which
    // wipes the original game's black/white players — leaving the header to show
    // just the owner's avatar. Restore the original players (black/white) so the
    // header keeps showing who actually played, with the owner merged on top.
    if (originalGame && originalGame.players) {
      game.players = { ...originalGame.players, ...game.players };
    }
    gamesById[newGameId] = game;
    // Only navigate into the review if WE requested it (onStartReview set
    // pendingReviewId to this originalId). A GAME_REVIEW broadcast for someone
    // else's review — e.g. of a game we're merely watching — must not switch our
    // active game or reviewGameId, or the UI would try to leave the (now
    // server-destroyed) original channel and crash the session ("Unknown
    // channel NNN" -> logout).
    let isOurReview = prevState.pendingReviewId === oldGameId;
    let nextState = { ...prevState, gamesById };
    if (isOurReview) {
      // Our review: claim membership, move the active game to the new channel,
      // and surface it so the UI navigates in. Then clear the marker.
      if (prevState.playGameId === oldGameId) {
        nextState.playGameId = newGameId;
      }
      let chanMem: ChannelMembership = { ...prevState.channelMembership };
      chanMem[newGameId] = { type: "game", complete: false, stale: false };
      nextState.channelMembership = chanMem;
      nextState.reviewGameId = newGameId;
      nextState.pendingReviewId = null;
    }
    // For a review we did NOT request (broadcast while watching the original),
    // record the game data only — don't claim membership or navigate, or the UI
    // would leave the now-destroyed original channel and crash the session.
    return nextState;
  } else if (msg.type === "GAME_NOTIFY") {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    let gameId = msg.game.channelId;
    gamesById[gameId] = parseGameChannel(gamesById[gameId], msg.game);
    return { ...prevState, gamesById };
  } else if (msg.type === "AUTOMATCH_PREFS") {
    let prefs = {
      ...msg,
      estimatedRank: msg.estimatedRank || msg.estiamtedRank || "1k",
    };
    let automatchPrefs = {
      blitzOk: !!prefs.blitzOk,
      estimatedRank: String(prefs.estimatedRank),
      fastOk: !!prefs.fastOk,
      freeOk: !!prefs.freeOk,
      humanOk: !!prefs.humanOk,
      maxHandicap:
        typeof prefs.maxHandicap === "number" ? prefs.maxHandicap : 0,
      mediumOk: !!prefs.mediumOk,
      rankedOk: !!prefs.rankedOk,
      robotOk: !!prefs.robotOk,
      unrankedOk: !!prefs.unrankedOk,
    };
    return { ...prevState, automatchPrefs };
  } else if (msg.type === "AUTOMATCH_STATUS") {
    return { ...prevState, automatchEnabled: !!msg.enabled };
  } else if (msg.type === "ARCHIVE_JOIN" && chanId) {
    let gameSummariesByUser: Index<Array<GameSummary>> = {
      ...prevState.gameSummariesByUser,
    };
    let name = msg.user.name;
    let summaries = msg.games.map((g) => parseGameSummary(g));
    summaries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    let isOwnArchive =
      prevState.currentUser && prevState.currentUser.name === name;
    if (isOwnArchive) {
      summaries = applyTags(summaries, prevState.gameTagsByTimestamp);
    }
    gameSummariesByUser[name] = summaries;
    let nextState = { ...prevState, gameSummariesByUser };

    // Remember our own archive channel so we can fetch/set tags on it.
    if (isOwnArchive) {
      nextState.archiveChannelId = chanId;
    }

    // Channel membership
    let chanMem: ChannelMembership = { ...prevState.channelMembership };
    chanMem[chanId] = { type: "archive", complete: false, stale: false };
    nextState.channelMembership = chanMem;

    return nextState;
  } else if (msg.type === "ARCHIVE_GAMES_CHANGED") {
    // FIXME: hack - hardcoded to currentUser since the message doens't include
    // the user, and we only stay subscribed to archive for currentUser
    let gameSummariesByUser: Index<Array<GameSummary>> = {
      ...prevState.gameSummariesByUser,
    };
    let name = prevState.currentUser ? prevState.currentUser.name : "FIXME";
    let summaries = msg.games.map((g) => parseGameSummary(g));
    let oldSummaries = gameSummariesByUser[name];
    if (oldSummaries) {
      let mergedSummaries = [...oldSummaries];
      for (let summary of summaries) {
        let index = mergedSummaries.findIndex(
          (s) => s.timestamp === summary.timestamp
        );
        if (index >= 0) {
          mergedSummaries[index] = summary;
        } else {
          mergedSummaries.push(summary);
        }
      }
      mergedSummaries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      gameSummariesByUser[name] = applyTags(
        mergedSummaries,
        prevState.gameTagsByTimestamp
      );
    } else {
      summaries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      gameSummariesByUser[name] = applyTags(
        summaries,
        prevState.gameTagsByTimestamp
      );
    }
    return { ...prevState, gameSummariesByUser };
  } else if (msg.type === "ARCHIVE_GAME_REMOVED") {
    // FIXME: hack - hardcoded to currentUser since the message doens't include
    // the user, and we only stay subscribed to archive for currentUser
    let gameSummariesByUser: Index<Array<GameSummary>> = {
      ...prevState.gameSummariesByUser,
    };
    let name = prevState.currentUser ? prevState.currentUser.name : "FIXME";
    let oldSummaries = gameSummariesByUser[name];
    if (oldSummaries) {
      gameSummariesByUser[name] = oldSummaries.filter(
        (summary) => summary.timestamp !== msg.timestamp
      );
      return { ...prevState, gameSummariesByUser };
    }
  } else if (msg.type === "FETCH_TAGS_RESULT") {
    // The tag map is spread directly onto the message (a mapping from game
    // timestamp to tag), alongside the "type" field — there is no nested
    // "tags" object. Collect every field except "type".
    let tags: Index<string> = {};
    for (let key of Object.keys(msg)) {
      if (key !== "type" && typeof msg[key] === "string") {
        tags[key] = msg[key];
      }
    }
    let gameSummariesByUser: Index<Array<GameSummary>> = {
      ...prevState.gameSummariesByUser,
    };
    let name = prevState.currentUser ? prevState.currentUser.name : null;
    if (name && gameSummariesByUser[name]) {
      gameSummariesByUser[name] = applyTags(gameSummariesByUser[name], tags);
    }
    return { ...prevState, gameTagsByTimestamp: tags, gameSummariesByUser };
  } else if (msg.type === "SET_GAME_TAG") {
    // Local optimistic update when the user tags/untags one of their games.
    let tags: Index<string> = { ...prevState.gameTagsByTimestamp };
    if (msg.tag) {
      tags[msg.timestamp] = msg.tag;
    } else {
      delete tags[msg.timestamp];
    }
    let gameSummariesByUser: Index<Array<GameSummary>> = {
      ...prevState.gameSummariesByUser,
    };
    let name = prevState.currentUser ? prevState.currentUser.name : null;
    if (name && gameSummariesByUser[name]) {
      gameSummariesByUser[name] = applyTags(gameSummariesByUser[name], tags);
    }
    return { ...prevState, gameTagsByTimestamp: tags, gameSummariesByUser };
  } else if (msg.type === "WATCH_FILTER_CHANGE") {
    return {
      ...prevState,
      watchFilter: prevState.watchFilter
        ? { ...prevState.watchFilter, ...msg.filter }
        : msg.filter,
    };
  } else if (msg.type === "PLAY_FILTER_CHANGE") {
    return {
      ...prevState,
      playFilter: prevState.playFilter
        ? { ...prevState.playFilter, ...msg.filter }
        : msg.filter,
    };
  } else if (msg.type === "WATCH_GAME") {
    return { ...prevState, watchGameId: msg.gameId, userDetailsRequest: null };
  } else if (msg.type === "PLAY_CHALLENGE") {
    return { ...prevState, playChallengeId: msg.challengeId };
  } else if (msg.type === "CLOSE_CHALLENGE" && chanId) {
    let challenge = { ...prevState.gamesById[chanId] };
    delete challenge.sentProposal;
    delete challenge.receivedProposals;
    return {
      ...prevState,
      gamesById: {
        ...prevState.gamesById,
        [chanId]: challenge,
      },
      playChallengeId: null,
    };
  } else if (msg.type === "GAMELISTENTRY_PLAYER_REPLACED" && chanId) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    let game = gamesById[chanId];
    if (game) {
      let players = game.players ? { ...game.players } : {};
      let role = normalizeRole(msg.role);
      if (msg.user) {
        players[role] = parseUser(players[role], msg.user);
      } else {
        delete players[role];
      }
      gamesById[chanId] = {
        ...game,
        players: (players: any),
      };
    }
    return {
      ...prevState,
      gamesById,
    };
  } else if (msg.type === "CHALLENGE_PROPOSAL" && chanId) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    let challenge = { ...prevState.gamesById[chanId] };
    if (challenge) {
      gamesById[chanId] = {
        ...challenge,
        sentProposal: msg.proposal,
      };
    }
    return {
      ...prevState,
      gamesById,
    };
  } else if (msg.type === "CHALLENGE_DECLINE" && chanId) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    let challenge = { ...prevState.gamesById[chanId] };

    if (challenge.sentProposal) {
      challenge.sentProposal = {
        ...challenge.sentProposal,
        status: "declined",
      };
      gamesById[chanId] = challenge;
      return {
        ...prevState,
        gamesById,
      };
    }
  } else if (msg.type === "START_CHALLENGE_DECLINE" && chanId) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    let challenge = { ...prevState.gamesById[chanId] };
    if (challenge.receivedProposals) {
      challenge.receivedProposals = challenge.receivedProposals.filter(
        (proposal) =>
          !proposal.players.some((p) => {
            let name = p.user ? p.user.name : p.name;
            return name === msg.name;
          })
      );
    }
    // Optimistically drop the declined player from the other roster sources too
    // (the channel user/player lists), so their seat reopens immediately
    // instead of lingering until the server's USER_REMOVED arrives.
    if (challenge.users) {
      challenge.users = challenge.users.filter((n) => n !== msg.name);
    }
    if (challenge.players) {
      let players: any = { ...challenge.players };
      for (let role of Object.keys(players)) {
        if (players[role] && players[role].name === msg.name) {
          delete players[role];
        }
      }
      challenge.players = players;
    }
    gamesById[chanId] = challenge;
    return {
      ...prevState,
      gamesById,
    };
  } else if (msg.type === "CHALLENGE_PROPOSAL_RECEIVED" && chanId) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    gamesById[chanId] = {
      ...gamesById[chanId],
      sentProposal: { ...msg.proposal, status: "setup" },
    };
    return { ...prevState, gamesById };
  } else if (msg.type === "CHALLENGE_ACCEPT_SENT" && chanId) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    let chan = { ...gamesById[chanId] };
    // Keep the accepted roster on screen (mark it "accepted") instead of
    // dropping it — otherwise the other seated players vanish from the
    // challenger's view while everyone finishes confirming.
    if (chan.sentProposal) {
      chan.sentProposal = { ...chan.sentProposal, status: "accepted" };
    }
    gamesById[chanId] = chan;
    return { ...prevState, gamesById };
  } else if (msg.type === "START_CHALLENGE_SUBMIT" && chanId) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    let sentProposal = { ...msg.proposal, status: "pending" };
    gamesById[chanId] = {
      ...gamesById[chanId],
      sentProposal,
    };
    return {
      ...prevState,
      gamesById,
    };
  } else if (msg.type === "CHALLENGE_SUBMIT" && chanId) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    if (!gamesById[chanId]) {
      // Challenge channel unknown (message arrived before/after the channel
      // exists) — don't crash the reducer for the whole poll batch.
      return prevState;
    }
    let receivedProposals = gamesById[chanId].receivedProposals
      ? [...gamesById[chanId].receivedProposals]
      : [];
    receivedProposals.push(msg.proposal);
    gamesById[chanId] = {
      ...gamesById[chanId],
      receivedProposals,
    };
    return {
      ...prevState,
      gamesById,
    };
  } else if (msg.type === "CHALLENGE_FINAL") {
    let currentUser = prevState.currentUser;
    let name = currentUser && currentUser.name;
    let isPlayer = name && isGameProposalPlayer(name, msg.proposal);
    let nextState = { ...prevState, playChallengeId: null };
    if (isPlayer) {
      nextState.playGameId = msg.gameChannelId;
    } else if (
      msg.proposal &&
      (msg.proposal.gameType === "simul" || msg.proposal.gameType === "rengo")
    ) {
      // Only auto-target a watch board for simul/rengo, where co-challengers'
      // boards are grouped. For a plain 1v1 finalized for someone else, don't
      // pull the passed-over challenger into watching the winner's game.
      nextState.watchGameId = msg.gameChannelId;
    }
    // Tag the new board with its originating simul challenge channel so the
    // simul's boards can be grouped together (the challenge channel id is the
    // same for every board of one simul).
    if (
      msg.proposal &&
      msg.proposal.gameType === "simul" &&
      msg.gameChannelId &&
      chanId
    ) {
      let gamesById: Index<GameChannel> = { ...prevState.gamesById };
      let game = gamesById[msg.gameChannelId];
      if (game) {
        gamesById[msg.gameChannelId] = {
          ...game,
          simulChallengeId: chanId,
        };
        nextState.gamesById = gamesById;
      }
    }
    return nextState;
  } else if (msg.type === "PLAY_GAME") {
    return { ...prevState, playGameId: msg.gameId, userDetailsRequest: null };
  } else if (msg.type === "GAME_UNDO_REQUEST" && chanId) {
    let role = normalizeRole(msg.role);
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    gamesById[chanId] = { ...gamesById[chanId], undoRequest: role };
    return { ...prevState, gamesById };
  } else if (msg.type === "GAME_UNDO_DECLINE" && chanId) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    gamesById[chanId] = { ...gamesById[chanId] };
    delete gamesById[chanId].undoRequest;
    return { ...prevState, gamesById };
  } else if (msg.type === "START_GAME_MOVE" && chanId) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    gamesById[chanId] = { ...gamesById[chanId] };
    let tree = gamesById[chanId].tree;
    if (tree) {
      tree = ({ ...tree }: GameTree);
      tree.pendingMove = {
        nodeId: tree.activeNode,
        color: msg.color,
        loc: msg.loc,
      };
      tree.computedState = computeGameNodeStates(tree, tree.activeNode);
      gamesById[chanId].tree = tree;
      return { ...prevState, gamesById };
    }
  } else if (msg.type === "CANCEL_GAME_MOVE" && chanId) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    gamesById[chanId] = { ...gamesById[chanId] };
    let tree = gamesById[chanId].tree;
    if (tree) {
      tree = ({ ...tree }: GameTree);
      delete tree.pendingMove;
      tree.computedState = computeGameNodeStates(tree, tree.activeNode);
      gamesById[chanId].tree = tree;
      return { ...prevState, gamesById };
    }
  } else if (
    msg.type === "USER_REMOVED" &&
    chanId &&
    prevState.gamesById[chanId]
  ) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    let users = gamesById[chanId].users;
    if (!users) {
      return prevState;
    }
    gamesById[chanId] = {
      ...gamesById[chanId],
      users: users.filter((name) => name !== msg.user.name),
    };
    let receivedProposals = gamesById[chanId].receivedProposals;
    if (receivedProposals) {
      // Remove proposals if this user was a challenger
      gamesById[chanId].receivedProposals = receivedProposals.filter(
        (proposal) =>
          !proposal.players.some(
            (p) =>
              (p.name && p.name === msg.user.name) ||
              (p.user && p.user.name === msg.user.name)
          )
      );
    }
    return { ...prevState, gamesById };
  } else if (
    msg.type === "USER_ADDED" &&
    chanId &&
    prevState.gamesById[chanId]
  ) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    let users = gamesById[chanId].users;
    if (!users || users.find((name) => name === msg.user.name)) {
      return prevState;
    }
    gamesById[chanId] = {
      ...gamesById[chanId],
      users: [...users, msg.user.name],
    };
    return { ...prevState, gamesById };
  } else if (msg.type === "CHANNEL_SUBSCRIBERS_ONLY" && chanId) {
    let gamesById: Index<GameChannel> = {
      ...prevState.gamesById,
      [chanId]: {
        ...prevState.gamesById[chanId],
        accessDenied: "KGS Plus Subscribers Only",
      },
    };
    return { ...prevState, gamesById };
  } else if (msg.type === "PRIVATE_KEEP_OUT" && chanId) {
    let game = prevState.gamesById[chanId];
    if (!game) {
      return prevState;
    }
    let gamesById: Index<GameChannel> = {
      ...prevState.gamesById,
      [chanId]: {
        ...prevState.gamesById[chanId],
        accessDenied: "Private Game",
      },
    };
    return { ...prevState, gamesById };
  } else if (msg.type === "SET_CURRENT_GAME_NODE" && chanId) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    gamesById[chanId] = { ...gamesById[chanId] };
    let tree = gamesById[chanId].tree;
    if (tree) {
      tree = ({ ...tree }: GameTree);
      tree.currentNode = msg.currentNode;
      // Only rebuild the line for a node that actually exists. When following a
      // just-played demo move the target node may not have arrived yet (the SGF
      // echo is in flight); the subsequent GAME_UPDATE rebuilds the line.
      if (
        tree.nodes[tree.currentNode] &&
        tree.currentLine.indexOf(tree.currentNode) === -1
      ) {
        tree.currentLine = getGameLine(tree, tree.currentNode);
      }
      gamesById[chanId].tree = tree;
      return { ...prevState, gamesById };
    }
  } else if (msg.type === "SET_GAME_MOVE_ERROR" && chanId) {
    let gamesById: Index<GameChannel> = { ...prevState.gamesById };
    if (gamesById[chanId]) {
      gamesById[chanId] = {
        ...gamesById[chanId],
        moveError: msg.error,
      };
      return { ...prevState, gamesById };
    }
  }
  return prevState;
}

export function handleGameMessage(
  prevState: AppState,
  msg: KgsMessage
): AppState {
  let nextState = _handleGameMessage(prevState, msg);
  let currentUser = nextState.currentUser;
  let unfinishedGames;

  // If games changed, separate active games from challenges; sort
  if (prevState.gamesById !== nextState.gamesById) {
    let allGames = Object.keys(nextState.gamesById).map(
      (id) => nextState.gamesById[id]
    );

    let activeGames = allGames.filter(
      (g) => g.type !== "challenge" && !g.deletedTime && !g.over
    );
    sortGames(activeGames);

    let challenges = allGames.filter(
      (g) => g.type === "challenge" && !g.deletedTime
    );
    sortGames(challenges, currentUser ? currentUser.name : null);

    if (currentUser) {
      let currentName = currentUser.name;
      unfinishedGames = activeGames
        .filter((g) => isGamePlayer(currentName, g.players) && isGamePlaying(g))
        .map((g) => ({
          type: "channel",
          game: g,
        }));
    }

    nextState = { ...nextState, activeGames, challenges };
  }

  if (currentUser) {
    let nextSummaries = nextState.gameSummariesByUser[currentUser.name];
    let prevSummaries = prevState.gameSummariesByUser[currentUser.name];
    let summariesChanged = prevSummaries !== nextSummaries;
    // unfinishedGames mixes "channel" entries (from gamesById, recomputed
    // above when games changed) and "summary" entries (from the user's
    // archive). When only one source changed, keep the other source's entries
    // from the previous state instead of dropping them.
    if (unfinishedGames || summariesChanged) {
      let prevUnfinished = prevState.unfinishedGames || [];
      let channelEntries =
        unfinishedGames || prevUnfinished.filter((e) => e.type === "channel");
      let summaryEntries =
        summariesChanged && nextSummaries
          ? nextSummaries
              .filter(
                (summary) => summary.score === "UNFINISHED" && summary.inPlay
              )
              .map((summary) => ({
                type: "summary",
                game: summary,
              }))
          : prevUnfinished.filter((e) => e.type === "summary");
      nextState = {
        ...nextState,
        unfinishedGames: channelEntries.concat(summaryEntries),
      };
    }
  }

  return nextState;
}
