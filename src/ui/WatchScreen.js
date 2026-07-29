// @flow
import React, { PureComponent as Component } from "react";
import GameList, { matchesCategory } from "./game/GameList";
import GameListFilter, {
  GameListFilterBar,
  GameListSubBar,
} from "./game/GameListFilter";
import GameScreen from "./game/GameScreen";
import { A, Icon, Spinner } from "./common";
import { InvariantError } from "../util/error";
import { loadSort, saveSort } from "../util/filterPrefs";
import type {
  GameChannel,
  GameFilter,
  Room,
  User,
  Index,
  AppActions,
  ChannelMembership,
  FriendEntry,
} from "../model";

import { isBot } from "../util/bot";
import { getGameTimeSpeed } from "../model/game";

// Keep in sync with getRankTier() in GameList.js (pro folded into dan).
function getRankTier(rank: ?string): string {
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
  const n = parseInt(r, 10);
  if (!isNaN(n) && n >= 10) {
    return "ddk";
  }
  return "sdk";
}

function countGames(games, filter, usersByName) {
  let displayGames = games;
  if (filter && Object.keys(filter).length) {
    const roomId = filter.roomId;
    const excludeBots = filter.excludeBots;
    const gameRatings = filter.gameRatings;
    const playerRanks = filter.playerRanks;
    const timeSpeeds = filter.timeSpeeds;
    const category = filter.category;
    displayGames = games.filter((game) => {
      if (roomId && game.roomId !== roomId) {
        return false;
      }
      if (category && !matchesCategory(game, category)) {
        return false;
      }
      if (excludeBots) {
        if (game.type === "robot_ranked" || game.type === "robot_free") {
          return false;
        }
        let hasBot = false;
        if (game.players) {
          hasBot = !!Object.keys(game.players)
            .map((role: any) => game.players[role])
            .find((player) => {
              if (!player || !player.name) {
                return false;
              }
              const fullUser = usersByName && usersByName[player.name];
              return isBot(player.name, fullUser && fullUser.flags);
            });
        }
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
  }
  return displayGames.length;
}

type Props = {
  currentUser: ?User,
  activeGames: Array<GameChannel>,
  gamesById: Index<GameChannel>,
  watchFilter: GameFilter,
  watchGameId: ?(number | string),
  reviewGameId: ?number,
  roomsById: Index<Room>,
  channelMembership: ChannelMembership,
  usersByName: Index<User>,
  actions: AppActions,
  buddies?: ?Array<FriendEntry>,
};

type SortKey = "top" | "watched" | "moves";

type State = {
  watchedIds: Array<number | string>,
  activeId: ?(number | string),
  sort: SortKey,
};

export default class WatchScreen extends Component<Props, State> {
  static defaultProps: Props;

  state: State = {
    watchedIds: [],
    activeId: null,
    sort: (loadSort("watch", "top"): any),
  };

  _onSortChange = (sort: SortKey) => {
    saveSort("watch", sort);
    this.setState({ sort });
  };

  componentDidMount() {
    window.scrollTo(0, 0);
    if (this.props.watchGameId) {
      this.setState({
        watchedIds: [this.props.watchGameId],
        activeId: this.props.watchGameId,
      });
    }
  }

  _updateTabsClass(hasGames: boolean) {
    if (document.body) {
      document.body.classList.toggle("GameScreen-has-tabs", hasGames);
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    let { watchGameId, reviewGameId } = this.props;
    if (watchGameId && watchGameId !== prevProps.watchGameId) {
      this.setState((state) => ({
        watchedIds: state.watchedIds.includes(watchGameId)
          ? state.watchedIds
          : [...state.watchedIds, watchGameId],
        activeId: watchGameId,
      }));
    }

    // A review was just started (e.g. from the finished-game Review button):
    // open the new review channel as the active tab.
    if (reviewGameId && reviewGameId !== prevProps.reviewGameId) {
      let id = reviewGameId;
      this.setState((state) => ({
        watchedIds: state.watchedIds.includes(id)
          ? state.watchedIds
          : [...state.watchedIds, id],
        activeId: id,
      }));
    }

    if (prevState.watchedIds.length !== this.state.watchedIds.length) {
      this._updateTabsClass(this.state.watchedIds.length > 0);
    }
  }

  componentWillUnmount() {
    this._updateTabsClass(false);
    let { watchedIds } = this.state;
    for (let id of watchedIds) {
      if (typeof id === "number") {
        this.props.actions.onLeaveGameWatch(id);
      } else {
        this.props.actions.onLeaveGame(id);
      }
    }
  }

  _onJoinGame = (gameId: number | string) => {
    let { watchedIds } = this.state;
    if (!watchedIds.includes(gameId)) {
      if (typeof gameId === "number") {
        this.props.actions.onJoinGameWatch(gameId);
      } else {
        this.props.actions.onJoinGame(gameId);
      }
      this.setState((state) => ({
        watchedIds: [...state.watchedIds, gameId],
        activeId: gameId,
      }));
    } else {
      this.setState({ activeId: gameId });
    }
  };

  _onCloseTab = (gameId: number | string) => {
    let { watchedIds, activeId } = this.state;
    if (typeof gameId === "number") {
      this.props.actions.onLeaveGameWatch(gameId);
    } else {
      this.props.actions.onLeaveGame(gameId);
    }
    let newIds = watchedIds.filter((id) => id !== gameId);
    let newActive =
      activeId === gameId
        ? newIds.length
          ? newIds[newIds.length - 1]
          : null
        : activeId;
    this.setState({ watchedIds: newIds, activeId: newActive });
  };

  _onSelectTab = (gameId: ?(number | string)) => {
    this.setState({ activeId: gameId });
  };

  render() {
    let {
      currentUser,
      activeGames,
      gamesById,
      watchFilter,
      roomsById,
      channelMembership,
      usersByName,
      actions,
    } = this.props;
    let { watchedIds, activeId, sort } = this.state;
    if (!currentUser) {
      throw new InvariantError("currentUser is required");
    }

    let watchedGames = watchedIds.map((id) => gamesById[id]).filter(Boolean);

    let activeGame = activeId ? gamesById[activeId] : null;

    // "top" keeps the server/sortGames order (direct challenges + strongest
    // players first); the others re-sort by spectators or move count.
    let sortedGames = activeGames;
    if (sort === "watched") {
      sortedGames = [...activeGames].sort(
        (a, b) => (b.observers || 0) - (a.observers || 0)
      );
    } else if (sort === "moves") {
      sortedGames = [...activeGames].sort(
        (a, b) => (b.moveNum || 0) - (a.moveNum || 0)
      );
    }

    return (
      <div
        className={
          "WatchScreen" +
          (watchedGames.length > 0 ? " WatchScreen-with-tabs" : "")
        }>
        {watchedGames.length > 0 && (
          <div className="WatchTabs">
            <A
              className={
                "WatchTabs-tab" +
                (activeId === null ? " WatchTabs-tab-active" : "")
              }
              onClick={() => this._onSelectTab(null)}>
              <Icon name="list" />
              <span>Games</span>
            </A>
            <div className="WatchTabs-divider" />
            {watchedGames.map((game) => {
              let white = game.players && game.players.white;
              let black = game.players && game.players.black;
              let label =
                white && black
                  ? `${white.name} vs ${black.name}`
                  : `Game ${game.id}`;
              return (
                <div
                  key={game.id}
                  className={
                    "WatchTabs-tab" +
                    (activeId === game.id ? " WatchTabs-tab-active" : "")
                  }>
                  <A
                    className="WatchTabs-tab-label"
                    onClick={() => this._onSelectTab(game.id)}>
                    {label}
                  </A>
                  <A
                    className="WatchTabs-tab-close"
                    onClick={() => this._onCloseTab(game.id)}>
                    <Icon name="circle-x" size={15} />
                  </A>
                </div>
              );
            })}
          </div>
        )}
        <div className="WatchScreen-content">
          {activeId ? (
            activeGame ? (
              <div className="WatchScreen-game">
                <GameScreen
                  game={activeGame}
                  usersByName={usersByName}
                  roomsById={roomsById}
                  currentUser={currentUser}
                  actions={actions}
                  buddies={this.props.buddies}
                />
              </div>
            ) : (
              <div className="WatchScreen-loading">
                <Spinner />
              </div>
            )
          ) : (
            <div className="WatchScreen-list">
              <div className="WatchScreen-header">
                <div className="WatchScreen-header-row">
                  <div className="WatchScreen-header-title">
                    Live Games
                    <span className="WatchScreen-header-count">
                      {countGames(activeGames, watchFilter, usersByName)}
                    </span>
                  </div>
                  <GameListFilter
                    games={activeGames}
                    roomsById={roomsById}
                    channelMembership={channelMembership}
                    filter={watchFilter}
                    onChange={actions.onShowGames}
                  />
                </div>
                <GameListFilterBar
                  games={activeGames}
                  filter={watchFilter}
                  onChange={actions.onShowGames}
                  showCategory={true}
                  showBots={true}
                />
                <GameListSubBar
                  sort={sort}
                  onSortChange={this._onSortChange}
                  filter={watchFilter}
                  onChange={actions.onShowGames}
                />
              </div>
              <GameList
                games={sortedGames}
                filter={watchFilter}
                roomsById={roomsById}
                usersByName={usersByName}
                onSelect={this._onJoinGame}
                onSelectUser={actions.onUserDetail}
                onPlayerHover={actions.onPlayerHover}
                onPlayerHoverEnd={actions.onPlayerHoverEnd}
                paginate={true}
                pageSize={30}
                currentUser={currentUser}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}
