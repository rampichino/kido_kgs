// @flow
import { userHasRank, userUnranked } from "../user";
import type {
  User,
  GameProposal,
  GameRules,
  Index,
  GamePlayers,
} from "../types";

export const DEFAULT_KOMI = 6.5;

type MatchupInfo = {
  white: string,
  black: string,
  handicap: number,
  komi: number,
  nigiri: boolean,
  unranked: boolean,
};

export function getMatchupInfo(
  user1: User,
  user2: User,
  initialKomi?: number
): MatchupInfo {
  let rank1 = user1.rankVal;
  let rank2 = user2.rankVal;
  let unranked = userUnranked(user1) || userUnranked(user2);
  if (
    !userHasRank(user1) ||
    !userHasRank(user2) ||
    user1.rankVal === user2.rankVal ||
    typeof rank1 !== "number" ||
    typeof rank2 !== "number"
  ) {
    return {
      white: user1.name,
      black: user2.name,
      handicap: 0,
      komi: initialKomi || DEFAULT_KOMI,
      nigiri: true,
      unranked,
    };
  }
  rank1 = rank1 < 0 ? rank1 + 1 : rank1;
  rank2 = rank2 < 0 ? rank2 + 1 : rank2;
  let white;
  let black;
  let handicap;
  let komi = 0.5;
  let nigiri = false;
  if (rank1 > rank2) {
    white = user1.name;
    black = user2.name;
    handicap = Math.max(0, Math.min(rank1 - rank2, 9));
  } else {
    white = user2.name;
    black = user1.name;
    handicap = Math.max(0, Math.min(rank2 - rank1, 9));
  }
  if (handicap === 1) {
    handicap = 0;
  }
  return { white, black, handicap, komi, nigiri, unranked };
}

// Handicap/komi for a single simul board. The host is always white; the
// opponent (black) receives stones based on how much weaker they are than the
// host. A stronger-than-host opponent gets no stones (handicap 0) since the
// host stays white in a simul exhibition.
//
// Komi rules:
//   - Even board (handicap 0): use the standard board komi (defaultKomi).
//   - Any handicap board (2–9 stones): komi is fixed at 0.5 to avoid ties.
export function getSimulMatchup(
  host: ?User,
  opponent: ?User,
  defaultKomi?: number
): { handicap: number, komi: number } {
  let evenKomi = typeof defaultKomi === "number" ? defaultKomi : DEFAULT_KOMI;
  if (
    !host ||
    !opponent ||
    !userHasRank(host) ||
    !userHasRank(opponent) ||
    typeof host.rankVal !== "number" ||
    typeof opponent.rankVal !== "number"
  ) {
    return { handicap: 0, komi: evenKomi };
  }
  let hostRank = host.rankVal < 0 ? host.rankVal + 1 : host.rankVal;
  let oppRank = opponent.rankVal < 0 ? opponent.rankVal + 1 : opponent.rankVal;
  let diff = hostRank - oppRank;
  if (diff <= 1) {
    // Opponent is equal to or stronger than host, or only 1 stone weaker.
    return { handicap: 0, komi: evenKomi };
  }
  return { handicap: Math.min(diff, 9), komi: 0.5 };
}

// Handicap/komi for a rengo (2v2) game, derived from the average rank of each
// team. Black receives stones when its team is weaker than white's. Unlike a
// 1v1 game we average the two players per side; if any rank is missing we fall
// back to an even game. (CGOBAN itself leaves rengo handicap manual; here we
// offer an average-based suggestion the players can still override.)
export function getRengoMatchup(
  whiteTeam: Array<?User>,
  blackTeam: Array<?User>,
  defaultKomi?: number
): { handicap: number, komi: number } {
  let evenKomi = typeof defaultKomi === "number" ? defaultKomi : DEFAULT_KOMI;
  let avgRank = (team: Array<?User>): ?number => {
    let vals = [];
    for (let u of team) {
      if (!u || !userHasRank(u) || typeof u.rankVal !== "number") {
        return null;
      }
      // Skip the dan/kyu discontinuity at 0 so differences are linear.
      vals.push(u.rankVal < 0 ? u.rankVal + 1 : u.rankVal);
    }
    if (!vals.length) {
      return null;
    }
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  let whiteRank = avgRank(whiteTeam);
  let blackRank = avgRank(blackTeam);
  if (typeof whiteRank !== "number" || typeof blackRank !== "number") {
    return { handicap: 0, komi: evenKomi };
  }
  let diff = Math.round(whiteRank - blackRank);
  if (diff <= 1) {
    return { handicap: 0, komi: evenKomi };
  }
  return { handicap: Math.min(diff, 9), komi: 0.5 };
}

export function proposalsEqual(p1: GameProposal, p2: GameProposal) {
  if (
    p1.gameType !== p2.gameType ||
    p1.nigiri !== p2.nigiri ||
    p1.private !== p2.private ||
    p1.rules.size !== p2.rules.size ||
    p1.rules.komi !== p2.rules.komi ||
    (p1.rules.handicap || 0) !== (p2.rules.handicap || 0) ||
    p1.rules.rules !== p2.rules.rules ||
    p1.rules.timeSystem !== p2.rules.timeSystem ||
    p1.rules.mainTime !== p2.rules.mainTime ||
    p1.rules.byoYomiPeriods !== p2.rules.byoYomiPeriods ||
    p1.rules.byoYomiStones !== p2.rules.byoYomiStones ||
    p1.rules.byoYomiTime !== p2.rules.byoYomiTime ||
    p1.players.length !== p2.players.length
  ) {
    return false;
  }
  if (p1.nigiri) {
    return true;
  }
  for (let i = 0; i < p1.players.length; i++) {
    if (p1.players[i].role !== p2.players[i].role) {
      return false;
    }
    let name1 = p1.players[i].user
      ? p1.players[i].user.name
      : p1.players[i].name;
    let name2 = p2.players[i].user
      ? p2.players[i].user.name
      : p2.players[i].name;
    if (name1 !== name2) {
      return false;
    }
  }
  return true;
}

export function getEvenProposal(
  initialProposal: GameProposal,
  challengerName: string,
  usersByName: Index<User>,
  challengePlayers?: ?GamePlayers,
  submittedNames?: ?Array<string>
): GameProposal {
  let proposal = { ...initialProposal };

  // Simul games follow a different model: one host (white) plays many
  // opponents (black), each in their own slot. A joining challenger must
  // preserve every existing slot (host + all already-joined opponents) and
  // only occupy the first empty black slot. This mirrors CGOBAN's
  // CChallenge.createExpectedProposal.
  if (proposal.gameType === "simul") {
    let blackSlot = 0;
    let hostName;
    let players = proposal.players.map((player) => {
      let newPlayer = { ...player };
      if (newPlayer.user) {
        newPlayer.name = newPlayer.user.name;
        delete newPlayer.user;
      }
      // Prefer the authoritative channel player list (post-accept), then fall
      // back to submittedNames from CHALLENGE_SUBMITTED actions so a second
      // joining challenger can see that an earlier slot is already taken.
      if (newPlayer.role === "black") {
        blackSlot++;
        let roleKey: any = blackSlot === 1 ? "black" : "black_" + blackSlot;
        if (challengePlayers && challengePlayers[roleKey]) {
          newPlayer.name = challengePlayers[roleKey].name;
        } else if (submittedNames && submittedNames[blackSlot - 1]) {
          newPlayer.name = submittedNames[blackSlot - 1];
        }
      } else if (newPlayer.role === "white") {
        if (challengePlayers && challengePlayers.white) {
          newPlayer.name = challengePlayers.white.name;
        }
        hostName = newPlayer.name;
      }
      return newPlayer;
    });
    let alreadyJoined = players.some((p) => p.name === challengerName);
    if (!alreadyJoined) {
      let emptySlot = players.find((p) => p.role === "black" && !p.name);
      if (emptySlot) {
        emptySlot.name = challengerName;
        if (typeof emptySlot.handicap !== "number") {
          emptySlot.handicap = 0;
        }
        if (typeof emptySlot.komi !== "number") {
          emptySlot.komi = 0;
        }
      }
    }
    // Auto-assign each opponent's handicap/komi from their rank vs the host,
    // unless the host has manually overridden that slot (handicapSet flag).
    let host = hostName ? usersByName[hostName] : null;
    let boardKomi =
      proposal.rules && typeof proposal.rules.komi === "number"
        ? proposal.rules.komi
        : DEFAULT_KOMI;
    for (let p of players) {
      if (p.role === "black" && p.name && !p.handicapSet) {
        let opponent = usersByName[p.name];
        let matchup = getSimulMatchup(host, opponent, boardKomi);
        p.handicap = matchup.handicap;
        p.komi = matchup.komi;
      }
    }
    proposal.players = players;
    if (!proposal.status) {
      proposal.status = "setup";
    }
    return proposal;
  }

  // Rengo (2v2): four fixed seats (white, white_2, black, black_2). A joining
  // player takes the first open seat, preserving everyone already in. Handicap
  // is suggested from each team's average rank (players may override it).
  if (proposal.gameType === "rengo") {
    let players = proposal.players.map((player) => {
      let newPlayer = { ...player };
      if (newPlayer.user) {
        newPlayer.name = newPlayer.user.name;
        delete newPlayer.user;
      }
      // Prefer the authoritative channel player list once the game is joined.
      let roleKey: any = newPlayer.role;
      if (challengePlayers && challengePlayers[roleKey]) {
        newPlayer.name = challengePlayers[roleKey].name;
      }
      return newPlayer;
    });
    // Fill open seats with other challengers who have already submitted (from
    // CHALLENGE_SUBMITTED actions) so a joining player sees who's already in.
    if (submittedNames) {
      for (let submitted of submittedNames) {
        if (!submitted || submitted === challengerName) {
          continue;
        }
        if (players.some((p) => p.name === submitted)) {
          continue;
        }
        let openSeat = players.find((p) => !p.name);
        if (openSeat) {
          openSeat.name = submitted;
        }
      }
    }
    let alreadyJoined = players.some((p) => p.name === challengerName);
    if (!alreadyJoined) {
      let openSeat = players.find((p) => !p.name);
      if (openSeat) {
        openSeat.name = challengerName;
      }
    }
    let boardKomi =
      proposal.rules && typeof proposal.rules.komi === "number"
        ? proposal.rules.komi
        : DEFAULT_KOMI;
    let whiteTeam = players
      .filter((p) => (p.role === "white" || p.role === "white_2") && p.name)
      .map((p) => usersByName[p.name || ""]);
    let blackTeam = players
      .filter((p) => (p.role === "black" || p.role === "black_2") && p.name)
      .map((p) => usersByName[p.name || ""]);
    let matchup = getRengoMatchup(whiteTeam, blackTeam, boardKomi);
    proposal.rules = {
      ...proposal.rules,
      handicap: matchup.handicap,
      komi: matchup.komi,
    };
    proposal.players = players;
    if (!proposal.status) {
      proposal.status = "setup";
    }
    return proposal;
  }

  let players = [];
  let otherUser;
  let challenging = false;
  let assignedChallenger = false;

  let whiteCount = 0;
  let blackCount = 0;

  // Put players into expected format (name only, not full user)
  // and while we're at it, figure out who the other user is and if
  // we're challenging or receiving challenges
  for (let player of proposal.players) {
    let newPlayer = { ...player };
    if (newPlayer.user) {
      newPlayer.name = newPlayer.user.name;
      delete newPlayer.user;
    }

    // Map to KGS role name
    let kgsRoleName;
    if (newPlayer.role === "white") {
      whiteCount++;
      kgsRoleName = whiteCount === 1 ? "white" : "white_" + whiteCount;
    } else if (newPlayer.role === "black") {
      blackCount++;
      kgsRoleName = blackCount === 1 ? "black" : "black_" + blackCount;
    }

    // Merge from accepted players if available
    if (challengePlayers && kgsRoleName) {
      let roleKey: any = kgsRoleName;
      if (challengePlayers[roleKey]) {
        newPlayer.name = challengePlayers[roleKey].name;
      }
    }

    if (newPlayer.name === challengerName) {
      assignedChallenger = true;
    } else if (!newPlayer.name && !assignedChallenger) {
      newPlayer.name = challengerName;
      challenging = true;
      assignedChallenger = true;
    }
    if (newPlayer.name && newPlayer.name !== challengerName) {
      otherUser = usersByName[newPlayer.name];
    }
    players.push(newPlayer);
  }

  // If sending a challenge, auto-set handicap and komi as appropriate
  let challenger = usersByName[challengerName];
  if (challenging && otherUser && challenger && proposal.gameType !== "simul") {
    let matchupInfo = getMatchupInfo(
      challenger,
      otherUser,
      proposal.rules.komi
    );
    let { handicap, komi, nigiri, white, black, unranked } = matchupInfo;
    proposal.rules = {
      ...proposal.rules,
      handicap,
      komi,
    };
    proposal.nigiri = nigiri;
    if (unranked && proposal.gameType === "ranked") {
      proposal.gameType = "free";
    }
    for (let player of players) {
      if (!player.name) {
        continue;
      }
      if (player.name === white) {
        player.role = "white";
      } else if (player.name === black) {
        player.role = "black";
      }
    }
  }

  proposal.players = players;

  if (!proposal.status) {
    proposal.status = "setup";
  }

  return proposal;
}

export function createInitialProposal(
  currentUser: User,
  lastProposal?: ?GameProposal,
  targetUser?: ?string
): GameProposal {
  let gameType = targetUser ? "free" : "ranked";
  if (lastProposal) {
    gameType = lastProposal.gameType;
  }

  let players;
  let nigiri = true;
  if (gameType === "simul") {
    nigiri = false;
    players = [
      { name: currentUser.name, role: "white" },
      { role: "black", handicap: 0, komi: 0 },
      { role: "black", handicap: 0, komi: 0 },
    ];
  } else if (gameType === "rengo") {
    // 2v2: creator takes White 1, the other three seats are open. Players pick
    // any open seat (white/white_2/black/black_2) when they join.
    nigiri = false;
    players = [
      { name: currentUser.name, role: "white" },
      { role: "white_2" },
      { role: "black" },
      { role: "black_2" },
    ];
  } else {
    players = [
      { name: currentUser.name, role: "white" },
      targetUser ? { name: targetUser, role: "black" } : { role: "black" },
    ];
  }

  let rules: GameRules = lastProposal
    ? lastProposal.rules
    : {
        komi: DEFAULT_KOMI,
        size: 19,
        rules: "japanese",
        timeSystem: "byo_yomi",
        mainTime: 60 * 20,
        byoYomiPeriods: 5,
        byoYomiTime: 30,
      };
  let proposal = {
    gameType,
    players,
    rules,
    nigiri,
  };
  return proposal;
}

export function getOtherPlayerName(
  proposal: GameProposal,
  ourName: string,
  challengePlayers?: ?GamePlayers
): ?string {
  for (let player of proposal.players) {
    let name = player.user ? player.user.name : player.name;
    if (name && name !== ourName) {
      if (challengePlayers) {
        let accepted = false;
        for (let key of Object.keys(challengePlayers)) {
          if (key === "challengeCreator" || key === "owner") {
            continue;
          }
          let p = challengePlayers[key];
          if (p && p.name === name) {
            accepted = true;
            break;
          }
        }
        if (accepted) {
          continue;
        }
      }
      return name;
    }
  }
  return null;
}
