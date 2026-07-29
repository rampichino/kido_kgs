// @flow
import React, { PureComponent as Component } from "react";
import ReactDOM from "react-dom";
import { A, Icon, Button } from "../common";
import GameTypeIcon from "./GameTypeIcon";
import GamePlayersList from "./GamePlayersList";
import GameRulesDisplay from "./GameRulesDisplay";
import {
  formatGameScore,
  getWinningColor,
  getGameTimeSpeed,
} from "../../model/game";
import type { GameChannel, GameFilter, Room, User, Index } from "../../model";

import { isBot } from "../../util/bot";

// Tier buckets for the Rank filter. Mirrors getRankTier() in UserName.js, but
// folds "pro" into "dan" so the single Dan button matches the "Pro / Dan"
// legend group (RANK_OPTIONS has no separate Pro tier).
function getRankTier(rank: ?string): string {
  // Unranked / guests get their own tier so they match none of the three rank
  // buttons (dan/sdk/ddk) and are excluded whenever a rank filter is active.
  if (!rank || rank === "-" || rank === "?" || rank === "NR") {
    return "unranked";
  }
  const r = rank.replace(/\?$/, "");
  if (/p$/i.test(r)) {
    return "dan";
  }
  if (/d$/i.test(r)) {
    return "dan";
  }
  // kyu: 1k-9k = sdk, 10k+ = ddk
  const n = parseInt(r, 10);
  if (!isNaN(n) && n >= 10) {
    return "ddk";
  }
  return "sdk";
}

// Maps a game to one of the live-games category buttons (Rev/Teach,
// Sim/Rengo). Rengo is also detected from two-headed boards (white_2/black_2)
// since some rengo games carry a generic type. Returns true when `category`
// is falsy (no filter) or the game matches.
export function matchesCategory(game: GameChannel, category: ?string): boolean {
  if (!category) {
    return true;
  }
  const proposal = game.initialProposal;
  const type = proposal ? proposal.gameType : game.type;
  const players = game.players;
  const isRengo = !!(players && (players.white_2 || players.black_2));
  if (category === "simulrengo") {
    return (
      type === "simul" || type === "rengo" || type === "rengo_review" || isRengo
    );
  }
  if (category === "revteach") {
    return (
      type === "review" ||
      type === "rengo_review" ||
      type === "teaching" ||
      type === "demonstration"
    );
  }
  return true;
}

// Returns the board size of a game/challenge from its proposal or rules.
export function getBoardSize(game: GameChannel): ?number {
  const proposal = game.initialProposal;
  const rules = proposal ? proposal.rules : game.rules;
  return rules ? rules.size : null;
}

// A challenge created directly to the current user (from their profile). KGS
// names these "Challenge to <name>". Mirrors isDirectChallenge in
// model/game/display.js — kept here so the UI can group and pin them.
export function isDirectChallengeTo(
  game: GameChannel,
  currentUser: ?User
): boolean {
  return !!(
    currentUser &&
    game.type === "challenge" &&
    game.name &&
    game.name.includes("Challenge to " + currentUser.name)
  );
}

// Static indicator that a challenge carries a message. The message text itself
// is surfaced in the hover "Play: <message>" pill, so this no longer opens a
// tooltip on hover.
class NoteTooltip extends Component<{ text: string }> {
  render() {
    return (
      <span className="GameList-item-note-indicator">
        <Icon name="message-square-text" />
      </span>
    );
  }
}

type Props = {
  game: GameChannel,
  room: ?Room,
  usersByName?: Index<User>,
  onSelect: (number) => any,
  onSelectUser?: (string) => any,
  onDeclineDirect?: (number) => any,
  currentUser?: ?User,
  onPlayerHover?: (string) => any,
  onPlayerHoverEnd?: (string) => any,
};

type GameListItemState = { showPrivateWarning: boolean };

class GameListItem extends Component<Props, GameListItemState> {
  state = { showPrivateWarning: false };

  render() {
    let {
      game,
      room,
      usersByName,
      currentUser,
      onSelectUser,
      onPlayerHover,
      onPlayerHoverEnd,
    } = this.props;
    let proposal = game.initialProposal;
    let type = proposal ? proposal.gameType : game.type;
    let rules = proposal ? proposal.rules : game.rules;
    const players = game.players;
    const allPlayers = players
      ? [
          players.white,
          players.black,
          players.challengeCreator,
          players.white_2,
          players.black_2,
        ].filter(Boolean)
      : [];
    const creatorIsBot = allPlayers.some((p) => {
      if (!p.name) {
        return false;
      }
      const full = usersByName && usersByName[p.name];
      return isBot(p.name, full && full.flags);
    });
    const isRengo = !!(players && (players.white_2 || players.black_2));
    const showTypeIcon =
      !isRengo &&
      (game.type === "challenge" ||
        game.private ||
        (type !== "ranked" && type !== "free"));
    const hasCurrentUserMention = isDirectChallengeTo(game, currentUser);
    let className =
      "GameList-item" +
      (game.adjourned ? " GameList-item-adjourned" : "") +
      (game.event ? " GameList-item-event" : "") +
      (game.private ? " GameList-item-private" : "") +
      (isRengo ? " GameList-item-rengo" : "") +
      (onSelectUser ? " GameList-item-buttononly" : "") +
      (game.type === "challenge"
        ? " GameList-item-challenge" +
          (creatorIsBot ? " GameList-item-bot" : "") +
          (hasCurrentUserMention ? " GameList-item-direct-challenge" : "")
        : " GameList-item-active" + (creatorIsBot ? " GameList-item-bot" : ""));
    return (
      <React.Fragment>
        <A
          className={className}
          onClick={this._onSelect}
          onMouseEnter={this._onCardMouseEnter}
          onMouseLeave={this._onCardMouseLeave}
          onMouseMove={this._onCardMouseMove}>
          <span
            className="GameList-item-play-cursor"
            ref={this._setPillEl}
            aria-hidden="true">
            {game.type === "challenge"
              ? hasCurrentUserMention
                ? "Accept"
                : "Play"
              : "Watch"}
            {game.type === "challenge" && game.name ? (
              <React.Fragment>
                {": "}
                <span className="GameList-item-play-cursor-msg">
                  {game.name}
                </span>
              </React.Fragment>
            ) : null}
          </span>
          <div className="GameList-item-players">
            {hasCurrentUserMention && game.type === "challenge" ? (
              <span
                className="GameList-item-direct-icon"
                title="Direct challenge to you!">
                <Icon name="swords" />
              </span>
            ) : null}
            <GamePlayersList
              players={game.players}
              winner={getWinningColor(game.score)}
              usersByName={usersByName}
              showVs={game.type !== "challenge"}
              hideSelfish
              hideMaintainerIcon={game.type === "challenge"}
              onSelectUser={onSelectUser}
              onPlayerHover={onPlayerHover}
              onPlayerHoverEnd={onPlayerHoverEnd}
            />
            {showTypeIcon ? (
              <div
                className={
                  "GameList-item-type" +
                  // Tagged explicitly so mobile can hide the rated icon
                  // without relying on :has() (unsupported in older WebViews).
                  (type === "ranked" && !game.private && !game.subscribers
                    ? " GameList-item-type-rated"
                    : "") +
                  (type === "free" && !game.private && !game.subscribers
                    ? " GameList-item-type-free"
                    : "")
                }>
                <GameTypeIcon
                  type={type}
                  subscribersOnly={game.subscribers}
                  isPrivate={game.private}
                  useChallengeIcons={game.type === "challenge"}
                />
              </div>
            ) : null}
          </div>
          <div className="GameList-item-info">
            {isRengo ? (
              <GameTypeIcon
                type={type}
                subscribersOnly={game.subscribers}
                isPrivate={game.private}
                useChallengeIcons={false}
              />
            ) : null}
            {game.type !== "challenge" ? (
              <div className="GameList-item-observers">
                {game.observers ? (
                  <span className="GameList-item-observers-count">
                    <Icon name="users" /> {game.observers}
                  </span>
                ) : null}
              </div>
            ) : null}
            {rules ? (
              <div className="GameList-item-rules">
                {game.name && game.type === "challenge" ? (
                  <NoteTooltip text={game.name} />
                ) : null}
                <GameRulesDisplay
                  rules={rules}
                  compactTime={game.type === "challenge"}
                  freeGame={
                    game.type === "challenge" &&
                    type === "free" &&
                    !game.private &&
                    !game.subscribers
                  }
                />
                {game.type === "challenge" ? (
                  <span className="GameList-item-play" onClick={this._onPlay}>
                    Play
                  </span>
                ) : null}
                {hasCurrentUserMention &&
                game.type === "challenge" &&
                this.props.onDeclineDirect ? (
                  <span
                    className="GameList-item-decline"
                    title="Decline this challenge"
                    onClick={this._onDeclineDirect}>
                    Decline
                  </span>
                ) : null}
              </div>
            ) : null}
            {game.over && game.score ? (
              <span className="GameList-item-result">
                {formatGameScore(game.score)}
              </span>
            ) : game.type !== "challenge" ? (
              <div className="GameList-item-move">
                {rules && rules.handicap ? (
                  <span
                    className="GameList-item-handicap-icon"
                    title={"Handicap " + rules.handicap}>
                    H
                  </span>
                ) : null}
                {game.moveNum ? (
                  <span
                    className="GameList-item-move-count"
                    title={game.moveNum + " moves"}>
                    {game.moveNum}
                  </span>
                ) : null}
                <span className="GameList-item-watch" onClick={this._onWatch}>
                  Watch
                </span>
              </div>
            ) : null}
            {game.name && game.type !== "challenge" ? (
              <div className="GameList-item-name">{game.name}</div>
            ) : null}
          </div>
          {room ? (
            <div className="GameList-item-room">{room.name || "Automatch"}</div>
          ) : null}
        </A>
        {this.state.showPrivateWarning &&
          ReactDOM.createPortal(
            <div
              className="GameList-private-overlay"
              onClick={this._onDismissWarning}>
              <div
                className="GameList-private-dialog"
                onClick={(e) => e.stopPropagation()}>
                <div className="GameList-private-dialog-icon">
                  <Icon name="lock" size={28} />
                </div>
                <div className="GameList-private-dialog-title">
                  Private Game
                </div>
                <div className="GameList-private-dialog-body">
                  This game is private and can only be accessed by authorized
                  users.
                </div>
                <div className="GameList-private-dialog-actions">
                  <Button muted onClick={this._onDismissWarning}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </React.Fragment>
    );
  }

  // Cursor-following "Play" pill for challenge cards (desktop only; hidden on
  // touch / mobile via CSS). Positioned by hand on mousemove to trail the
  // pointer without re-rendering the card.
  _pillEl: ?HTMLElement = null;

  _setPillEl = (el: ?HTMLElement) => {
    this._pillEl = el;
  };

  _onCardMouseEnter = (e: Object) => {
    let el = this._pillEl;
    if (
      !el ||
      !document.body ||
      !document.body.classList.contains("no-touch")
    ) {
      return;
    }
    // Position before showing so it never flashes at the corner.
    this._onCardMouseMove(e);
    el.style.opacity = "1";
    el.style.transform = "translate(16px, -50%) scale(1)";
  };

  _onCardMouseLeave = () => {
    let el = this._pillEl;
    if (!el) {
      return;
    }
    el.style.opacity = "0";
    el.style.transform = "translate(16px, -50%) scale(0.9)";
  };

  _onCardMouseMove = (e: Object) => {
    let el = this._pillEl;
    if (!el || !el.parentElement) {
      return;
    }
    let r = el.parentElement.getBoundingClientRect();
    el.style.left = e.clientX - r.left + "px";
    el.style.top = e.clientY - r.top + "px";
  };

  _onSelect = () => {
    const { game } = this.props;
    // The whole card is the click target (challenges and live games alike) — it
    // opens the game / challenge. The username keeps its own handler for the
    // profile action (it stops propagation), and the hover Play / Watch buttons
    // are gone.
    if (game.private) {
      this.setState({ showPrivateWarning: true });
      return;
    }
    this.props.onSelect(game.id);
  };

  _onOpen = (e: Object) => {
    e.stopPropagation();
    e.preventDefault();
    const { game } = this.props;
    if (game.private) {
      this.setState({ showPrivateWarning: true });
      return;
    }
    this.props.onSelect(game.id);
  };

  _onPlay = (e: Object) => {
    this._onOpen(e);
  };

  _onWatch = (e: Object) => {
    this._onOpen(e);
  };

  _onDeclineDirect = (e: Object) => {
    e.stopPropagation();
    e.preventDefault();
    if (this.props.onDeclineDirect) {
      this.props.onDeclineDirect(this.props.game.id);
    }
  };

  _onDismissWarning = () => {
    this.setState({ showPrivateWarning: false });
  };
}

type GameListProps = {
  games: Array<GameChannel>,
  filter?: GameFilter,
  roomsById?: Index<Room>,
  usersByName?: Index<User>,
  onSelect: (number) => any,
  onSelectUser?: (string) => any,
  onDeclineDirect?: (number) => any,
  paginate?: boolean,
  pageSize?: number,
  currentUser?: ?User,
  // When set, direct challenges (to the current user) are pinned in their own
  // labelled "Direct challenges" section above an "Open challenges" section.
  groupDirectChallenges?: boolean,
  // Player hover-card support (rich tooltip fetched on name hover).
  onPlayerHover?: (string) => any,
  onPlayerHoverEnd?: (string) => any,
};

type State = {
  fullRender: boolean,
  showAll: boolean,
};

export default class GameList extends Component<GameListProps, State> {
  state = {
    fullRender: false,
    showAll: false,
  };

  componentDidMount() {
    let { games } = this.props;
    if (games.length > 20) {
      setTimeout(() => {
        this.setState({ fullRender: true });
      }, 32);
    }
  }

  componentDidUpdate(prevProps: GameListProps) {
    if (prevProps.filter !== this.props.filter) {
      this.setState({ showAll: false });
    }
  }

  _onShowAll = () => {
    this.setState({ showAll: true });
  };

  render() {
    const {
      games,
      filter,
      roomsById,
      usersByName,
      onSelect,
      onSelectUser,
      onDeclineDirect,
      paginate,
      pageSize,
      currentUser,
      groupDirectChallenges,
      onPlayerHover,
      onPlayerHoverEnd,
    } = this.props;
    let { fullRender, showAll } = this.state;
    let displayGames;
    if (filter && Object.keys(filter).length) {
      const roomId = filter.roomId;
      const excludeBots = filter.excludeBots;
      const gameRatings = filter.gameRatings;
      const playerRanks = filter.playerRanks;
      const timeSpeeds = filter.timeSpeeds;
      const category = filter.category;
      const boardSizes = filter.boardSizes;
      displayGames = games.filter((game) => {
        // Direct challenges (to the current user) bypass all filters — they're
        // personal invitations and must always stay visible.
        if (groupDirectChallenges && isDirectChallengeTo(game, currentUser)) {
          return true;
        }
        if (roomId && game.roomId !== roomId) {
          return false;
        }
        if (category && !matchesCategory(game, category)) {
          return false;
        }
        if (boardSizes && boardSizes.length) {
          const size = getBoardSize(game);
          if (!size || !boardSizes.includes(size)) {
            return false;
          }
        }
        if (excludeBots) {
          if (game.type === "robot_ranked" || game.type === "robot_free") {
            return false;
          }
          let hasBot =
            game.players &&
            Object.keys(game.players)
              .map((role: any) => game.players[role])
              .find((player) => {
                if (!player || !player.name) {
                  return false;
                }
                const fullUser = usersByName && usersByName[player.name];
                return isBot(player.name, fullUser && fullUser.flags);
              });
          if (hasBot) {
            return false;
          }
        }
        if (gameRatings && gameRatings.length) {
          const proposal = game.initialProposal;
          const type = proposal ? proposal.gameType : game.type;
          if (!gameRatings.includes(type)) {
            return false;
          }
        }
        if (playerRanks && playerRanks.length) {
          const players = game.players;
          const allPlayers = players
            ? [
                players.white,
                players.black,
                players.challengeCreator,
                players.owner,
              ].filter(Boolean)
            : [];
          // A game matches if any of its players falls in a selected tier.
          const anyMatch = allPlayers.some((p) =>
            playerRanks.includes(getRankTier(p.rank))
          );
          if (allPlayers.length && !anyMatch) {
            return false;
          }
        }
        if (timeSpeeds && timeSpeeds.length) {
          const proposal = game.initialProposal;
          const rules = proposal ? proposal.rules : game.rules;
          if (rules) {
            const speed = getGameTimeSpeed(rules);
            if (!timeSpeeds.includes(speed)) {
              return false;
            }
          }
        }
        return true;
      });
    } else {
      displayGames = games;
    }

    let paginatedGames = displayGames;
    const size = pageSize || 30;

    if (paginate && !showAll) {
      paginatedGames = displayGames.slice(0, size);
    } else if (!paginate && !fullRender) {
      paginatedGames = displayGames.slice(0, 20);
    }

    const hasMore = paginate && !showAll && displayGames.length > size;

    const renderItem = (game) => (
      <GameListItem
        key={game.id}
        game={game}
        room={roomsById ? roomsById[game.roomId] : null}
        usersByName={usersByName}
        onSelect={onSelect}
        onSelectUser={onSelectUser}
        onDeclineDirect={onDeclineDirect}
        currentUser={currentUser}
        onPlayerHover={onPlayerHover}
        onPlayerHoverEnd={onPlayerHoverEnd}
      />
    );

    let directGames = [];
    let openGames = paginatedGames;
    if (groupDirectChallenges) {
      directGames = paginatedGames.filter((g) =>
        isDirectChallengeTo(g, currentUser)
      );
      openGames = paginatedGames.filter(
        (g) => !isDirectChallengeTo(g, currentUser)
      );
    }

    return (
      <div className="GameList-container">
        <div className="GameList">
          {paginatedGames.length ? (
            groupDirectChallenges ? (
              <React.Fragment>
                {directGames.length ? (
                  <React.Fragment>
                    <div className="GameList-section-title">
                      Direct challenges
                    </div>
                    {directGames.map(renderItem)}
                  </React.Fragment>
                ) : null}
                {openGames.length ? (
                  <React.Fragment>
                    {directGames.length ? (
                      <div className="GameList-section-title">
                        Open challenges
                      </div>
                    ) : null}
                    {openGames.map(renderItem)}
                  </React.Fragment>
                ) : null}
              </React.Fragment>
            ) : (
              paginatedGames.map(renderItem)
            )
          ) : (
            <div className="GameList-empty">None</div>
          )}
        </div>
        {hasMore ? (
          <div className="GameList-show-more-container">
            <button
              type="button"
              className="GameList-show-more-btn"
              onClick={this._onShowAll}>
              Show More <Icon name="chevron-down" />
            </button>
          </div>
        ) : null}
      </div>
    );
  }
}
