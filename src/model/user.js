// @flow
import { format as dateFormat } from "date-fns";
import type {
  AppState,
  KgsMessage,
  User,
  UserFlags,
  Index,
  ChannelMembership,
  RankGraph,
  FriendEntry,
} from "./types";

export function userHasRank(user: User) {
  return user.rank && user.rank !== "?";
}

export function userUnranked(user: User) {
  return user.rank === undefined;
}

export function parseRankVal(rank: string) {
  let num = parseInt(rank, 10);
  if (!num) {
    return -9999;
  }
  let type = rank.charAt(rank.length - 1);
  if (type === "?" && rank.length > 1) {
    type = rank.charAt(rank.length - 2);
  }
  if (type === "k") {
    return -num;
  } else if (type === "p") {
    return num + 10;
  } else {
    return num;
  }
}

export function getUserStatusText(user: User) {
  let flags = user.flags;
  let status;
  if (user.presenceUnknown && flags && flags.connected) {
    return "Status unknown — last message wasn't delivered";
  }
  if (flags && flags.playingTourney) {
    status = "In tournament";
  } else if (flags && flags.sleeping) {
    status = "Idle";
  } else if (flags && flags.playing) {
    status = "Playing";
  } else {
    status = flags && flags.connected ? "Online" : "Offline";
  }
  return status;
}

// Status "kind" backing the colored presence dot (matches the user-list dot
// colors). Returns one of:
// "offline" | "unknown" | "playing" | "idle" | "online".
export function getUserStatusKind(user: User): string {
  let flags = user.flags;
  if (!flags || !flags.connected) {
    return "offline";
  }
  // A failed message means their "connected" flag can no longer be trusted.
  if (user.presenceUnknown) {
    return "unknown";
  }
  if (flags.playing || flags.playingTourney) {
    return "playing";
  }
  if (flags.sleeping) {
    return "idle";
  }
  return "online";
}

export function getUserAuthName(user: User) {
  switch (user.authLevel) {
    case "jr_admin":
      return "Junior Admin";
    case "sr_admin":
      return "Senior Admin";
    case "super_admin":
      return "Super Admin";
    case "teacher":
      return "Teacher";
    default:
      return null;
  }
}

export function sortUsers(users: Array<User>, buddies?: ?Array<FriendEntry>) {
  let buddyNames = new Set(buddies ? buddies.map((b) => b.name) : []);
  users.sort((a, b) => {
    let aFriend = buddyNames.has(a.name);
    let bFriend = buddyNames.has(b.name);
    if (aFriend && !bFriend) {
      return -1;
    }
    if (!aFriend && bFriend) {
      return 1;
    }
    let cmp = (b.rankVal || 0) - (a.rankVal || 0);
    if (cmp === 0) {
      return a.name.localeCompare(b.name);
    } else {
      return cmp;
    }
  });
}

export function parseUser(user: ?User, values: Object, details?: Object): User {
  let newUser: Object = user ? { ...user } : {};
  // Only recompute rankVal when the payload carries a rank — partial updates
  // (e.g. DETAILS_UPDATE) would otherwise clobber it to the unranked -9999 and
  // sink the user to the bottom of every sort.
  if (typeof values.rank === "string" || newUser.rankVal === undefined) {
    newUser.rankVal = parseRankVal(values.rank);
  }
  let flagsStr: ?string = values.flags;
  if (typeof flagsStr === "string") {
    let flags: UserFlags = {};
    for (let c of flagsStr) {
      switch (c) {
        case "g":
          flags.guest = true;
          break;
        case "c":
          flags.connected = true;
          break;
        case "d":
          flags.deleted = true;
          break;
        case "s":
          flags.sleeping = true;
          break;
        case "a":
          flags.avatar = true;
          break;
        case "r":
          flags.robot = true;
          break;
        case "T":
          flags.tourneyWinner = true;
          break;
        case "t":
          flags.tourneyRunnerUp = true;
          break;
        case "p":
          flags.playing = true;
          break;
        case "P":
          flags.playingTourney = true;
          break;
        case "*":
          flags.kgsPlus = true;
          break;
        case "!":
          flags.kgsMeijin = true;
          break;
        case "=":
          flags.canPlayRanked = true;
          break;
        case "~":
          flags.selfish = true;
          break;
        default:
          break;
      }
    }
    // The KGS flag string is a per-message snapshot, but not every source
    // reports every flag — lighter game/challenge player references omit the
    // avatar ("a") flag that richer user objects carry. Rebuilding flags from
    // scratch each time therefore made the avatar flicker on/off as different
    // messages arrived. Avatar presence is a stable account property, so keep
    // it sticky once seen rather than letting a flag string that omits it
    // clear it.
    if (!flags.avatar && newUser.flags && newUser.flags.avatar) {
      flags.avatar = true;
    }
    newUser.flags = flags;
    // A fresh flag string is authoritative presence — drop any local "unknown"
    // marker left over from a failed message.
    delete newUser.presenceUnknown;
  } else if (!newUser.flags) {
    newUser.flags = {};
  }
  for (let key of ["name", "rank", "authLevel"]) {
    if (key in values) {
      newUser[key] = values[key];
    }
  }
  if (
    newUser.rank &&
    values.name &&
    values.flags &&
    values.rank === undefined
  ) {
    // Special case for rank removal (e.g. after details update)
    newUser.rank = null;
  }
  if (details) {
    let currentDetails = newUser.details || {};
    let mergedDetails = { ...currentDetails, ...details };

    let privateEmail = details.privateEmail;
    if ("emailPrivate" in details) {
      privateEmail = details.emailPrivate;
    }

    if (privateEmail !== undefined) {
      mergedDetails.privateEmail = !!privateEmail;
    }
    if (mergedDetails.privateEmail === undefined) {
      mergedDetails.privateEmail = false;
    }

    if (details.emailWanted !== undefined) {
      mergedDetails.emailWanted = !!details.emailWanted;
    }
    if (mergedDetails.emailWanted === undefined) {
      mergedDetails.emailWanted = false;
    }

    delete mergedDetails.emailPrivate;
    newUser.details = mergedDetails;
  }
  return newUser;
}

// Turn KGS's rank graph into a format suited for Chartist.js
export function parseRankGraph(data: Array<number>): RankGraph {
  let newRankGraph: Object = {};

  // The data is an array of ranks on individual days, ending at yesterday.
  // Generate dates for each of the data points.
  let series: Array<Object> = data.map((rank, i) => {
    var d = new Date();
    d.setDate(d.getDate() - (data.length - i));

    const maxRank = 900; // 9d
    const minRank = -30000; // 30k

    return {
      x: d,
      y: rank < maxRank && rank > minRank ? rank : null,
    };
  });

  newRankGraph.data = {
    series: [series],
  };

  // Create a list of the unique months present in the graph data for labeling
  newRankGraph.months = [];
  series.forEach((d) => {
    let str = dateFormat(d.x, "MMMM yyyy");
    if (newRankGraph.months.indexOf(str) === -1) {
      newRankGraph.months.push(str);
    }
  });

  return newRankGraph;
}

export function handleUserMessage(
  prevState: AppState,
  msg: KgsMessage
): AppState {
  let chanId = msg.channelId;
  if (msg.type === "UPDATE_LOCAL_USER_DETAILS") {
    let user = msg.user;
    if (user && user.name) {
      let usersByName: Index<User> = { ...prevState.usersByName };
      let existingUser = usersByName[user.name] || { name: user.name };
      let updatedUser = {
        ...existingUser,
        details: {
          ...(existingUser.details || {}),
          ...msg.details,
        },
      };
      usersByName[user.name] = updatedUser;
      let nextState = { ...prevState, usersByName };
      if (nextState.currentUser && nextState.currentUser.name === user.name) {
        nextState.currentUser = { ...nextState.currentUser, ...updatedUser };
      }
      return nextState;
    }
  }
  if (msg.type === "MARK_PRESENCE_UNKNOWN") {
    let name = msg.name;
    if (name && prevState.usersByName[name]) {
      let usersByName: Index<User> = { ...prevState.usersByName };
      usersByName[name] = { ...usersByName[name], presenceUnknown: true };
      return { ...prevState, usersByName };
    }
    return prevState;
  }
  if (msg.type === "MARK_PRESENCE_KNOWN") {
    // A delayed message echo finally arrived, so the partner is reachable after
    // all — clear the "presence unknown" flag set by an earlier send timeout.
    let name = msg.name;
    if (
      name &&
      prevState.usersByName[name] &&
      prevState.usersByName[name].presenceUnknown
    ) {
      let usersByName: Index<User> = { ...prevState.usersByName };
      usersByName[name] = { ...usersByName[name] };
      delete usersByName[name].presenceUnknown;
      return { ...prevState, usersByName };
    }
    return prevState;
  }
  if (msg.type === "ROOM_JOIN" || msg.type === "GAME_JOIN") {
    let usersByName: Index<User> = { ...prevState.usersByName };
    if (msg.users) {
      for (let user of msg.users) {
        usersByName[user.name] = parseUser(usersByName[user.name], user);
      }
    }
    return { ...prevState, usersByName };
  } else if (msg.type === "USER_UPDATE" || msg.type === "USER_ADDED") {
    let usersByName: Index<User> = { ...prevState.usersByName };
    let user = msg.user;
    let newUser = parseUser(usersByName[user.name], user);
    usersByName[user.name] = newUser;
    let nextState = { ...prevState, usersByName };
    if (nextState.currentUser && nextState.currentUser.name === user.name) {
      nextState.currentUser = { ...nextState.currentUser, ...newUser };
    }
    return nextState;
  } else if (msg.type === "LOGIN_SUCCESS") {
    let usersByName: Index<User> = { ...prevState.usersByName };
    let user = msg.you;
    usersByName[user.name] = parseUser(usersByName[user.name], user);
    let buddies = [];
    let fans = [];
    let censored = [];
    if (msg.friends) {
      for (let f of msg.friends) {
        let u = f.user;
        if (u) {
          usersByName[u.name] = parseUser(usersByName[u.name], u);
          let entry = { name: u.name, notes: f.notes || null };
          if (f.friendType === "buddy") {
            buddies.push(entry);
          } else if (f.friendType === "fan") {
            fans.push(entry);
          } else if (f.friendType === "censored") {
            censored.push(entry);
          }
        }
      }
    }
    return { ...prevState, usersByName, buddies, fans, censored };
  } else if (msg.type === "FRIEND_ADD_SUCCESS") {
    let usersByName: Index<User> = { ...prevState.usersByName };
    let u = msg.user;
    if (u) {
      usersByName[u.name] = parseUser(usersByName[u.name], u);
      let entry = { name: u.name, notes: msg.notes || null };
      // buddy/fan/censored are fully independent on KGS — adding to one list
      // never touches the others (verified against the CGOBAN client, which
      // simply does group.add on a single FriendsGroup). So you can be a buddy,
      // a fan, AND censored at the same time.
      let buddies = prevState.buddies;
      let fans = prevState.fans;
      let censored = prevState.censored;
      if (msg.friendType === "buddy") {
        buddies = buddies.filter((b) => b.name !== u.name).concat(entry);
      } else if (msg.friendType === "fan") {
        fans = fans.filter((f) => f.name !== u.name).concat(entry);
      } else if (msg.friendType === "censored") {
        censored = censored.filter((c) => c.name !== u.name).concat(entry);
      }
      return { ...prevState, usersByName, buddies, fans, censored };
    }
    return prevState;
  } else if (msg.type === "FRIEND_REMOVE_SUCCESS") {
    let u = msg.user;
    if (u) {
      let name = u.name;
      // Only drop the user from the list they were removed from — buddy and fan
      // are independent, so removing one must leave the other intact. If the
      // server omits friendType, fall back to clearing all (legacy behaviour).
      let buddies = prevState.buddies;
      let fans = prevState.fans;
      let censored = prevState.censored;
      if (msg.friendType === "buddy") {
        buddies = buddies.filter((b) => b.name !== name);
      } else if (msg.friendType === "fan") {
        fans = fans.filter((f) => f.name !== name);
      } else if (msg.friendType === "censored") {
        censored = censored.filter((c) => c.name !== name);
      } else {
        buddies = buddies.filter((b) => b.name !== name);
        fans = fans.filter((f) => f.name !== name);
        censored = censored.filter((c) => c.name !== name);
      }
      return { ...prevState, buddies, fans, censored };
    }
    return prevState;
  } else if (msg.type === "FRIEND_CHANGE_NO_USER") {
    console.warn("Friend change failed: user not found", msg);
    return prevState;
  } else if (msg.type === "START_USER_DETAILS") {
    return {
      ...prevState,
      userDetailsRequest: {
        name: msg.name,
        status: "pending",
      },
    };
  } else if (msg.type === "DETAILS_JOIN" && chanId) {
    let usersByName: Index<User> = { ...prevState.usersByName };
    let user = msg.user;
    let newUser = parseUser(usersByName[user.name], user, msg);
    usersByName[user.name] = newUser;

    // In case we looked it up without knowing the casing
    let lowerName = user.name.toLowerCase();
    if (user.name !== lowerName) {
      usersByName[lowerName] = newUser;
    }

    let nextState = { ...prevState, usersByName };

    if (
      prevState.userDetailsRequest &&
      prevState.userDetailsRequest.name.toLowerCase() === lowerName
    ) {
      nextState.userDetailsRequest = {
        name: prevState.userDetailsRequest.name,
        status: "received",
      };
    }

    // Channel membership
    let chanMem: ChannelMembership = { ...prevState.channelMembership };
    chanMem[chanId] = { type: "details", complete: false, stale: false };
    nextState.channelMembership = chanMem;

    if (nextState.currentUser && nextState.currentUser.name === user.name) {
      nextState.currentUser = { ...nextState.currentUser, ...newUser };
    }

    return nextState;
  } else if (msg.type === "DETAILS_RANK_GRAPH") {
    let rankGraphsByChannelId: Index<RankGraph> = {
      ...prevState.rankGraphsByChannelId,
    };
    let channelId: string = String(msg.channelId);
    let data: Array<number> = msg.data;

    rankGraphsByChannelId[channelId] = parseRankGraph(data);
    let nextState = { ...prevState, rankGraphsByChannelId };

    return nextState;
  } else if (msg.type === "DETAILS_UPDATE" && chanId) {
    let nameToUpdate = null;
    let req = prevState.userDetailsRequest;
    if (req) {
      let user = prevState.usersByName[req.name];
      if (user && user.details && user.details.channelId === chanId) {
        nameToUpdate = user.name;
      }
    }
    if (!nameToUpdate) {
      for (let name of Object.keys(prevState.usersByName)) {
        let user = prevState.usersByName[name];
        if (user && user.details && user.details.channelId === chanId) {
          nameToUpdate = user.name;
          break;
        }
      }
    }
    if (nameToUpdate) {
      let usersByName: Index<User> = { ...prevState.usersByName };
      usersByName[nameToUpdate] = parseUser(usersByName[nameToUpdate], {}, msg);
      return { ...prevState, usersByName };
    }
  } else if (msg.type === "DETAILS_NONEXISTANT") {
    // Mark the user so the hover card can show an "unavailable" state instead
    // of spinning forever — common for guests, who have no profile once their
    // ephemeral session ends.
    let usersByName: Index<User> = { ...prevState.usersByName };
    let existing = usersByName[msg.name] ||
      usersByName[msg.name.toLowerCase()] ||
        // The user may only exist as a game snapshot (e.g. a guest in an old
        // game), with no usersByName entry yet — create one so the flag sticks.
        { name: msg.name };
    let marked = { ...existing, detailsNotFound: true };
    usersByName[existing.name] = marked;
    usersByName[existing.name.toLowerCase()] = marked;
    // Only flip the profile modal to "not found" if a request is actually open
    // for this user (i.e. they clicked to open it). A hover-triggered details
    // request must NOT open the modal — otherwise hovering a nonexistent guest
    // would pop the profile window on its own.
    let req = prevState.userDetailsRequest;
    let modalOpenForThis =
      req && req.name.toLowerCase() === msg.name.toLowerCase();
    return {
      ...prevState,
      usersByName,
      userDetailsRequest: modalOpenForThis
        ? { name: msg.name, status: "nonexistant" }
        : req,
    };
  } else if (msg.type === "CLOSE_USER_DETAILS") {
    return { ...prevState, userDetailsRequest: null };
  } else if (
    msg.type === "GAME_LIST" ||
    msg.type === "GLOBAL_GAMES_JOIN" ||
    msg.type === "ARCHIVE_JOIN" ||
    msg.type === "ARCHIVE_GAMES_CHANGED"
  ) {
    // Archived game players carry their flags (incl. guest) only as the raw KGS
    // flag string. Run them through parseUser so usersByName has parsed flags —
    // this is what lets the hover card and profile modal recognise an offline
    // guest from an old game.
    if (msg.games) {
      let usersByName: Index<User> = { ...prevState.usersByName };
      for (let game of msg.games) {
        if (game.players) {
          for (let role of Object.keys(game.players)) {
            let name = game.players[role].name;
            if (name) {
              usersByName[name] = parseUser(
                usersByName[name],
                game.players[role]
              );
            }
          }
        }
      }
      return { ...prevState, usersByName };
    }
  } else if (
    msg.users &&
    (msg.type === "GAME_JOIN" ||
      msg.type === "GAME_UPDATE" ||
      msg.type === "GAME_STATE" ||
      msg.type === "GAME_NAME_CHANGE" ||
      msg.type === "CHALLENGE_JOIN")
  ) {
    if (prevState.currentUser) {
      for (let user of msg.users) {
        if (user.name === prevState.currentUser.name) {
          let usersByName: Index<User> = { ...prevState.usersByName };
          let newUser = parseUser(usersByName[user.name], user);
          usersByName[user.name] = newUser;
          let nextState = { ...prevState, usersByName };
          if (
            nextState.currentUser &&
            nextState.currentUser.name === user.name
          ) {
            nextState.currentUser = { ...nextState.currentUser, ...newUser };
          }
          return nextState;
        }
      }
    }
  } else if (msg.type === "MESSAGES" && msg.messages) {
    let usersByName: Index<User> = { ...prevState.usersByName };
    for (let m of msg.messages) {
      let u = m.user;
      if (u && u.name) {
        usersByName[u.name] = parseUser(usersByName[u.name], u);
      }
    }
    return { ...prevState, usersByName };
  }
  return prevState;
}
