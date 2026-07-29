// @flow
import React, { PureComponent as Component } from "react";
import { Icon, Modal, Spinner, Button } from "./common";
import GameSummaryList from "./game/GameSummaryList";
import UserGameSummary from "./user/UserGameSummary";
import DemoSetupModal from "./game/DemoSetupModal";
import MyGamesFilter, {
  filterMyGames,
  getMyGamesRecord,
  EMPTY_MY_GAMES_FILTER,
} from "./game/MyGamesFilter";
import { renderBotsToggle } from "./game/GameListFilter";
import type { MyGamesFilterState, MyGamesResult } from "./game/MyGamesFilter";
import {
  loadFilter,
  saveFilter,
  loadSort,
  saveSort,
  loadCollapsed,
  saveCollapsed,
} from "../util/filterPrefs";
import { InvariantError } from "../util/error";
import { isMobileScreen } from "../util/dom";
import type {
  User,
  GameSummary,
  GameChannel,
  Index,
  Room,
  ChannelMembership,
  AppActions,
  GameRuleSet,
  TimeSystem,
} from "../model";

const GAMES_PER_PAGE = 30;
const GAMES_SHOW_MORE = 30;

type Props = {
  currentUser: ?User,
  gameSummariesByUser: Index<Array<GameSummary>>,
  gamesById: Index<GameChannel>,
  usersByName: Index<User>,
  roomsById: Index<Room>,
  channelMembership: ChannelMembership,
  reviewGameId: ?number,
  activeConversationId: ?number,
  actions: AppActions,
};

type SortKey = "newest" | "oldest";

type State = {
  visibleCount: number,
  gameToLoad: ?GameSummary,
  showDemoSetup: boolean,
  filter: MyGamesFilterState,
  sort: SortKey,
  filtersCollapsed: boolean,
};

const SORT_OPTIONS: Array<{ key: SortKey, label: string }> = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
];

export default class MyGamesScreen extends Component<Props, State> {
  state = {
    visibleCount: GAMES_PER_PAGE,
    gameToLoad: null,
    showDemoSetup: false,
    filter: { ...EMPTY_MY_GAMES_FILTER, ...loadFilter("mygames") },
    sort: (loadSort("mygames", "newest"): any),
    filtersCollapsed: loadCollapsed(),
  };

  componentDidMount() {
    window.scrollTo(0, 0);
    let { currentUser, actions } = this.props;
    if (currentUser) {
      actions.onJoinArchive(currentUser.name);
    }
  }

  render() {
    let {
      currentUser,
      gameSummariesByUser,
      usersByName,
      roomsById,
      channelMembership,
      actions,
    } = this.props;
    if (!currentUser) {
      throw new InvariantError("currentUser is required");
    }
    // The server only loads a game into a room the user has joined, so offer
    // only joined rooms in the load dialog.
    let joinedRooms = Object.keys(channelMembership)
      .filter(
        (id) => channelMembership[id].type === "room" && roomsById[Number(id)]
      )
      .map((id) => roomsById[Number(id)]);
    let { visibleCount, gameToLoad, filter, sort, filtersCollapsed } =
      this.state;
    let allGames = gameSummariesByUser[currentUser.name];
    let loaded = !!allGames;
    allGames = allGames || [];
    let games = filterMyGames(allGames, filter, currentUser.name);
    // The sort control is hidden on mobile, where games always sort newest.
    let effectiveSort = isMobileScreen() ? "newest" : sort;
    games = games.slice().sort((a, b) => {
      let diff =
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      return effectiveSort === "newest" ? -diff : diff;
    });
    let pageGames = games.slice(0, visibleCount);
    let hasMore = games.length > visibleCount;
    let filterActive =
      filter.tag !== null ||
      filter.opponent.trim() !== "" ||
      filter.gameTypes.length > 0 ||
      filter.result !== null ||
      filter.excludeBots;
    let record = getMyGamesRecord(allGames, currentUser.name);
    return (
      <div className="WatchScreen MyGamesScreen">
        <div className="WatchScreen-content">
          <div className="WatchScreen-list">
            <div className="WatchScreen-header">
              <div className="WatchScreen-header-row">
                <div className="WatchScreen-header-title">
                  My Games
                  <span className="WatchScreen-header-count">
                    {filterActive
                      ? games.length + " / " + allGames.length
                      : allGames.length}
                  </span>
                  {record.wins + record.losses > 0 ? (
                    <span className="MyGamesScreen-record">
                      <button
                        type="button"
                        className={
                          "MyGamesScreen-record-wins" +
                          (filter.result === "won" ? " active" : "")
                        }
                        title="Show only wins"
                        onClick={() => this._onToggleResult("won")}>
                        {record.wins}W
                      </button>
                      <button
                        type="button"
                        className={
                          "MyGamesScreen-record-losses" +
                          (filter.result === "lost" ? " active" : "")
                        }
                        title="Show only losses"
                        onClick={() => this._onToggleResult("lost")}>
                        {record.losses}L
                      </button>
                    </span>
                  ) : null}
                </div>
                <div className="WatchScreen-header-actions">
                  <Button
                    secondary
                    icon="presentation"
                    disabled={this.state.showDemoSetup}
                    onClick={this._onShowDemoSetup}
                    title="Start a demonstration board">
                    Demo
                  </Button>
                </div>
              </div>
              {loaded && allGames.length > 0 ? (
                <React.Fragment>
                  <div
                    className={
                      "GameFilterBar" +
                      (filtersCollapsed ? " GameFilterBar-collapsed" : "")
                    }
                    onClick={this._onRowClick}>
                    {filtersCollapsed ? null : (
                      <div className="GameFilterBar-heading">Filters</div>
                    )}
                    <button
                      type="button"
                      className={
                        "GameFilterBar-toggle" +
                        (filtersCollapsed ? " is-collapsed" : "") +
                        (filterActive ? " has-active" : "")
                      }
                      title={filtersCollapsed ? "Show filters" : "Hide filters"}
                      onClick={this._onToggleFilters}>
                      <Icon
                        name={
                          filtersCollapsed ? "chevron-right" : "chevron-down"
                        }
                        size={16}
                      />
                      {filtersCollapsed ? (
                        <span className="GameFilterBar-toggle-label">
                          {filterActive ? "Filters On" : "Filters"}
                        </span>
                      ) : null}
                    </button>
                    {filtersCollapsed ? null : (
                      <MyGamesFilter
                        games={allGames}
                        filter={filter}
                        onChange={this._onChangeFilter}
                      />
                    )}
                    {!filtersCollapsed && filterActive ? (
                      <button
                        type="button"
                        className="GameFilterBar-clear"
                        title="Clear filters"
                        onClick={this._onClearFilters}>
                        <Icon name="circle-x" size={19} />
                      </button>
                    ) : null}
                    <div className="MyGamesScreen-search">
                      <Icon name="search" size={14} />
                      <input
                        type="text"
                        className="MyGamesScreen-search-input"
                        placeholder="Filter by username"
                        value={filter.opponent}
                        onChange={this._onChangeOpponent}
                      />
                      {filter.opponent ? (
                        <button
                          type="button"
                          className="MyGamesScreen-search-clear"
                          title="Clear"
                          onClick={this._onClearOpponent}>
                          <Icon name="circle-x" size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="GameSubBar">
                    <div className="GameSubBar-controls">
                      <div className="GameSubBar-left">
                        {renderBotsToggle(
                          filter.excludeBots,
                          this._onToggleBots
                        )}
                      </div>
                      <div className="GameSubBar-sort">
                        <span className="GameSubBar-sort-label">Sort</span>
                        {SORT_OPTIONS.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            className={
                              "GameSubBar-sort-btn" +
                              (sort === opt.key ? " active" : "")
                            }
                            onClick={() => this._onChangeSort(opt.key)}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              ) : null}
            </div>
            {!loaded ? (
              <div className="MyGamesScreen-loading">
                <Spinner />
              </div>
            ) : allGames.length === 0 ? (
              <div className="MyGamesScreen-empty">You have no games yet.</div>
            ) : games.length === 0 ? (
              <div className="MyGamesScreen-empty">
                No games match the current filter.
              </div>
            ) : (
              <React.Fragment>
                <GameSummaryList
                  games={pageGames}
                  player={currentUser.name}
                  usersByName={usersByName}
                  selfAsYou
                  onSelect={this._onSelectGame}
                  onSelectUser={actions.onUserDetail}
                  onPlayerHover={actions.onPlayerHover}
                  onPlayerHoverEnd={actions.onPlayerHoverEnd}
                  onEditTag={actions.onTagGame}
                />
                {hasMore ? (
                  <div className="GameList-show-more-container">
                    <button
                      type="button"
                      className="GameList-show-more-btn"
                      onClick={this._onShowMore}>
                      Show More <Icon name="chevron-down" />
                    </button>
                  </div>
                ) : null}
              </React.Fragment>
            )}
          </div>
        </div>
        {/* end content */}
        {gameToLoad ? (
          <Modal title="Load game" onClose={this._onCloseLoad}>
            <UserGameSummary
              game={gameToLoad}
              rooms={joinedRooms}
              reviewGameId={this.props.reviewGameId}
              activeConversationId={this.props.activeConversationId}
              onLoadGame={actions.onLoadGame}
              onJoinGame={actions.onJoinGame}
              onLeaveGame={actions.onLeaveGame}
              onCloseUserDetail={this._onCloseLoad}
            />
          </Modal>
        ) : null}
        {this.state.showDemoSetup ? (
          <DemoSetupModal
            onClose={this._onCloseDemoSetup}
            rooms={joinedRooms}
            onCreate={this._onCreateDemo}
          />
        ) : null}
      </div>
    );
  }

  _onShowDemoSetup = () => {
    this.setState({ showDemoSetup: true });
  };

  _onCloseDemoSetup = () => {
    this.setState({ showDemoSetup: false });
  };

  _onCreateDemo = (
    roomId: number,
    size: number,
    isPrivate: boolean,
    global: boolean,
    timeSystem: TimeSystem,
    mainTime: number,
    byoYomiTime: number,
    byoYomiPeriods: number,
    byoYomiStones: number,
    ruleset: GameRuleSet,
    handicap: number,
    komi: number
  ) => {
    this.setState({ showDemoSetup: false });
    this.props.actions.onCreateDemo(
      roomId,
      size,
      isPrivate,
      global,
      timeSystem,
      mainTime,
      byoYomiTime,
      byoYomiPeriods,
      byoYomiStones,
      ruleset,
      handicap,
      komi
    );
  };

  _onSelectGame = (game: GameSummary) => {
    // The summary's inPlay flag can be stale (archive updates lag the actual
    // game end). If we can see the live channel and it's already over, the
    // resume flow would dead-end on the Play tab — load it for review instead.
    let liveChannel = Object.keys(this.props.gamesById)
      .map((id) => this.props.gamesById[id])
      .find((g) => g.summary && g.summary.timestamp === game.timestamp);
    let finished = liveChannel && (liveChannel.over || liveChannel.deletedTime);
    if (game.inPlay && !finished) {
      if (game.type === "review" && this.props.reviewGameId) {
        this.props.actions.onJoinGame(this.props.reviewGameId);
      } else {
        this.props.actions.onJoinGame(game.timestamp);
      }
    } else {
      this.setState({ gameToLoad: game });
    }
  };

  _onCloseLoad = () => {
    this.setState({ gameToLoad: null });
  };

  _onShowMore = () => {
    this.setState((s) => ({ visibleCount: s.visibleCount + GAMES_SHOW_MORE }));
  };

  // Applies a partial change to the current filter, persists it, and resets
  // pagination. Centralizing this keeps every filter mutation in sync with
  // localStorage.
  _applyFilter = (patch: $Shape<MyGamesFilterState>) => {
    let filter = { ...this.state.filter, ...patch };
    saveFilter("mygames", filter);
    this.setState({ filter, visibleCount: GAMES_PER_PAGE });
  };

  _onChangeFilter = (filter: MyGamesFilterState) => {
    saveFilter("mygames", filter);
    this.setState({ filter, visibleCount: GAMES_PER_PAGE });
  };

  _onChangeSort = (sort: SortKey) => {
    saveSort("mygames", sort);
    this.setState({ sort });
  };

  _onToggleFilters = () => {
    this.setState((s) => {
      const filtersCollapsed = !s.filtersCollapsed;
      saveCollapsed(filtersCollapsed);
      return { filtersCollapsed };
    });
  };

  // Clicking the empty row area (labels, gutters — anything that isn't an
  // interactive control) collapses the filter row.
  _onRowClick = (e: SyntheticMouseEvent<HTMLElement>) => {
    if ((e.target: any).closest("button, input, a, select, label")) {
      return;
    }
    this._onToggleFilters();
  };

  _onClearFilters = () => {
    this._applyFilter(EMPTY_MY_GAMES_FILTER);
  };

  _onToggleResult = (result: MyGamesResult) => {
    this._applyFilter({
      result: this.state.filter.result === result ? null : result,
    });
  };

  _onToggleBots = (checked: boolean) => {
    this._applyFilter({ excludeBots: checked });
  };

  _onChangeOpponent = (e: SyntheticInputEvent<HTMLInputElement>) => {
    this._applyFilter({ opponent: e.target.value });
  };

  _onClearOpponent = () => {
    this._applyFilter({ opponent: "" });
  };
}
