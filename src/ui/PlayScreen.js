// @flow
import React, { PureComponent as Component } from "react";
import { ScreenModal, Button, Icon, A, SelectInput } from "./common";
import ChallengeEditor from "./game/ChallengeEditor";
import GameList, { getBoardSize, isDirectChallengeTo } from "./game/GameList";
import GameSummaryList from "./game/GameSummaryList";
import GameListFilter, {
  GameListFilterBar,
  GameSizeSubBar,
} from "./game/GameListFilter";
import type { ChallengeSort } from "./game/GameListFilter";
import GameScreen from "./game/GameScreen";
import { InvariantError } from "../util/error";
import { loadSort, saveSort } from "../util/filterPrefs";
import { getDefaultRoom } from "../model/room";
import {
  isGamePlaying,
  isGamePlayer,
  isPlayerMove,
  getGameTimeSpeed,
  getWinningColor,
} from "../model/game";
import type {
  User,
  GameChannel,
  GameFilter,
  GameSummary,
  UnfinishedGame,
  Room,
  ChannelMembership,
  Conversation,
  Preferences,
  Index,
  AppActions,
  AutomatchPrefs,
  FriendEntry,
} from "../model";

import { isBot } from "../util/bot";
import { parseRankVal } from "../model/user";

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

function shiftRankVal(val: number, delta: number): number {
  let current = val;
  let steps = Math.abs(delta);
  let direction = delta > 0 ? 1 : -1;
  for (let i = 0; i < steps; i++) {
    current += direction;
    if (current === 0) {
      current += direction;
    }
  }
  return current;
}

function formatRankVal(val: number): string {
  if (val === -9999) {
    return "?";
  }
  if (val < 0) {
    return `${-val}k`;
  }
  if (val >= 1 && val <= 9) {
    return `${val}d`;
  }
  if (val > 10) {
    return `${val - 10}p`;
  }
  return "?";
}

function countGames(games, filter, usersByName) {
  let displayGames = games;
  if (filter && Object.keys(filter).length) {
    const roomId = filter.roomId;
    const excludeBots = filter.excludeBots;
    const gameRatings = filter.gameRatings;
    const playerRanks = filter.playerRanks;
    const timeSpeeds = filter.timeSpeeds;
    const boardSizes = filter.boardSizes;
    displayGames = games.filter((game) => {
      if (roomId && game.roomId !== roomId) {
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
  challenges: Array<GameChannel>,
  playFilter: GameFilter,
  playChallengeId: ?number,
  playGameId: ?number,
  gamesById: Index<GameChannel>,
  gameSummariesByUser: Index<Array<GameSummary>>,
  unfinishedGames: Array<UnfinishedGame>,
  roomsById: Index<Room>,
  channelMembership: ChannelMembership,
  conversationsById: Index<Conversation>,
  usersByName: Index<User>,
  preferences: Preferences,
  actions: AppActions,
  creatingChallenge: boolean,
  challengeTargetUser: ?string,
  activeConversationId: ?number,
  automatchEnabled: boolean,
  automatchPrefs: ?AutomatchPrefs,
  challengeMinimized: boolean,
  buddies?: ?Array<FriendEntry>,
};

type State = {
  blitzOk: boolean,
  estimatedRank: string,
  fastOk: boolean,
  freeOk: boolean,
  humanOk: boolean,
  maxHandicap: number,
  mediumOk: boolean,
  rankedOk: boolean,
  robotOk: boolean,
  unrankedOk: boolean,
  hasInitializedPrefs: boolean,
  showPrefs: boolean,
  showPlayMenu: boolean,
  challengeSort: ChallengeSort,
  dismissedChallengeIds: { [number]: boolean },
};

export default class PlayScreen extends Component<Props, State> {
  // Hosts whose archive we've already requested (to discover sibling simul
  // boards) — avoids re-requesting on every render.
  _requestedSimulArchives: { [name: string]: boolean } = {};

  constructor(props: Props) {
    super(props);
    let prefs = props.automatchPrefs;
    this.state = {
      blitzOk: prefs ? !!prefs.blitzOk : false,
      estimatedRank: prefs ? prefs.estimatedRank : "1k",
      fastOk: prefs ? !!prefs.fastOk : true,
      freeOk: prefs ? !!prefs.freeOk : false,
      humanOk: prefs ? !!prefs.humanOk : true,
      maxHandicap:
        prefs && typeof prefs.maxHandicap === "number" ? prefs.maxHandicap : 0,
      mediumOk: prefs ? !!prefs.mediumOk : true,
      rankedOk: prefs ? !!prefs.rankedOk : true,
      robotOk: prefs ? !!prefs.robotOk : false,
      unrankedOk: prefs ? !!prefs.unrankedOk : false,
      hasInitializedPrefs: !!prefs,
      showPrefs: false,
      showPlayMenu: false,
      challengeSort: (loadSort("play", "newest"): any),
      dismissedChallengeIds: {},
    };
  }

  componentDidMount() {
    window.scrollTo(0, 0);
  }

  componentDidUpdate(prevProps: Props) {
    let { playGameId } = this.props;
    let { playGameId: prevPlayGameId } = prevProps;
    let activeGame = playGameId ? this.props.gamesById[playGameId] : null;
    let prevActiveGame = prevPlayGameId
      ? prevProps.gamesById[prevPlayGameId]
      : null;
    if (!prevActiveGame && activeGame) {
      // Game started - scroll to top
      window.scrollTo(0, 0);
    }

    this._maybeFetchSimulHostArchive(activeGame);

    if (
      this.props.automatchPrefs &&
      this.props.automatchPrefs !== prevProps.automatchPrefs &&
      !this.state.hasInitializedPrefs
    ) {
      let prefs = this.props.automatchPrefs;
      this.setState({
        blitzOk: !!prefs.blitzOk,
        estimatedRank: prefs.estimatedRank || "1k",
        fastOk: !!prefs.fastOk,
        freeOk: !!prefs.freeOk,
        humanOk: !!prefs.humanOk,
        maxHandicap:
          typeof prefs.maxHandicap === "number" ? prefs.maxHandicap : 0,
        mediumOk: !!prefs.mediumOk,
        rankedOk: !!prefs.rankedOk,
        robotOk: !!prefs.robotOk,
        unrankedOk: !!prefs.unrankedOk,
        hasInitializedPrefs: true,
      });
    }
  }

  render() {
    let {
      currentUser,
      challenges,
      playFilter,
      playChallengeId,
      playGameId,
      gamesById,
      unfinishedGames,
      roomsById,
      channelMembership,
      conversationsById,
      usersByName,
      preferences,
      actions,
      creatingChallenge,
      challengeTargetUser,
      challengeMinimized,
      activeConversationId,
      automatchEnabled,
    } = this.props;
    if (!currentUser) {
      throw new InvariantError("currentUser is required");
    }
    let challenge = playChallengeId ? gamesById[playChallengeId] : null;
    let conversation = playChallengeId
      ? conversationsById[playChallengeId]
      : null;
    let activeGame = playGameId ? gamesById[playGameId] : null;
    let defaultRoom = getDefaultRoom(channelMembership, roomsById);
    let filterRoomId = playFilter && playFilter.roomId;
    // No joined room channels yet (fresh login/reconnect before ROOM_JOIN
    // arrives) — fall back to 0 so the render survives; the editor and
    // roomsById lookups below treat it as "no room".
    let initialRoomId = defaultRoom ? defaultRoom.id : 0;
    if (
      filterRoomId &&
      channelMembership[filterRoomId] &&
      channelMembership[filterRoomId].type === "room" &&
      roomsById[filterRoomId]
    ) {
      initialRoomId = filterRoomId;
    } else {
      // If creating under "All Challenges" (no filterRoomId), default to "English Game Room" if joined
      let englishRoom = Object.keys(channelMembership)
        .filter((id) => channelMembership[id].type === "room" && roomsById[id])
        .map((id) => roomsById[id])
        .find((r) => r.name === "English Game Room");
      if (englishRoom) {
        initialRoomId = englishRoom.id;
      } else if (
        activeConversationId &&
        channelMembership[activeConversationId] &&
        channelMembership[activeConversationId].type === "room" &&
        roomsById[activeConversationId]
      ) {
        initialRoomId = activeConversationId;
      }
    }
    let isPlayingGame = Object.keys(gamesById).some((id) => {
      let g = gamesById[Number(id)];
      return g && isGamePlaying(g) && isGamePlayer(currentUser.name, g.players);
    });

    // Challenges default to room-only (posted to the room, not globally).
    // Only rooms that require it (globalGamesOnly) default to global.
    let initialRoom = roomsById[initialRoomId];
    let defaultVisibility =
      initialRoom && initialRoom.globalGamesOnly ? "public" : "roomOnly";
    return (
      <div className="PlayScreen">
        {(challenge || creatingChallenge) && !challengeMinimized ? (
          <div className="PlayScreen-challenge">
            <ScreenModal
              onClose={this._onCloseChallenge}
              closeOnOutsideClick={false}>
              <ChallengeEditor
                currentUser={currentUser}
                challenge={challenge}
                challengeTargetUser={challengeTargetUser}
                usersByName={usersByName}
                roomsById={roomsById}
                channelMembership={channelMembership}
                initialRoomId={initialRoomId}
                conversation={conversation}
                preferences={preferences}
                actions={actions}
                onCancel={this._onCloseChallenge}
                defaultVisibility={defaultVisibility}
              />
            </ScreenModal>
          </div>
        ) : null}
        {activeGame ? (
          <div
            className={
              "PlayScreen-game-wrap" +
              (this._getSimulGames().length >= 2
                ? " PlayScreen-game-wrap-simul"
                : "")
            }>
            {this._renderSimulSidebar()}
            <div className="PlayScreen-game">
              <GameScreen
                playing={isGamePlaying(activeGame)}
                game={activeGame}
                usersByName={usersByName}
                roomsById={roomsById}
                currentUser={currentUser}
                actions={actions}
                buddies={this.props.buddies}
              />
            </div>
          </div>
        ) : (
          <div className="PlayScreen-list">
            <div className="WatchScreen-header">
              <div className="WatchScreen-header-row">
                {/* Mobile: row 1 is the title alone, row 2 is the room selector
                    (left) + Play/automatch (right). On desktop the title-line is
                    just the title and the room copy below is hidden (the desktop
                    room selector lives in the controls). */}
                <div className="PlayScreen-title-line">
                  <div className="WatchScreen-header-title">
                    Challenges
                    <span className="WatchScreen-header-count">
                      {countGames(challenges, playFilter, usersByName)}
                    </span>
                  </div>
                </div>
                <div className="PlayScreen-room-mobile">
                  <GameListFilter
                    games={challenges}
                    roomsById={roomsById}
                    channelMembership={channelMembership}
                    filter={playFilter}
                    onChange={actions.onShowGames}
                  />
                </div>
                <div className="PlayScreen-header-controls">
                  <div className="WatchScreen-header-actions">
                    <div className="PlayScreen-play-dropdown">
                      <Button
                        secondary
                        icon="play"
                        title="Play"
                        disabled={
                          !!playChallengeId ||
                          creatingChallenge ||
                          isPlayingGame
                        }
                        className={
                          "PlayScreen-play-btn" +
                          (this.state.showPlayMenu || automatchEnabled
                            ? " active"
                            : "") +
                          (automatchEnabled ? " searching" : "")
                        }
                        onClick={this._onTogglePlayMenu}>
                        Play
                      </Button>
                      {this.state.showPlayMenu ? (
                        <React.Fragment>
                          <div
                            className="PlayScreen-play-menu-backdrop"
                            onClick={this._onClosePlayMenu}
                          />
                          <div className="PlayScreen-play-menu">
                            <button
                              type="button"
                              className="PlayScreen-play-menu-item"
                              onClick={this._onMenuCreateChallenge}>
                              <Icon name="swords" />
                              <span>Create challenge</span>
                            </button>
                            <button
                              type="button"
                              className="PlayScreen-play-menu-item"
                              onClick={this._onMenuAutomatch}>
                              <Icon name="shuffle" />
                              <span>
                                {automatchEnabled
                                  ? "Cancel automatch"
                                  : "Automatch"}
                              </span>
                            </button>
                          </div>
                        </React.Fragment>
                      ) : null}
                      {this._renderAutomatchModal()}
                    </div>
                  </div>
                  <GameListFilter
                    games={challenges}
                    roomsById={roomsById}
                    channelMembership={channelMembership}
                    filter={playFilter}
                    onChange={actions.onShowGames}
                  />
                </div>
              </div>
              <div className="PlayScreen-filtersort-row">
                <GameListFilterBar
                  games={challenges}
                  filter={playFilter}
                  onChange={actions.onShowGames}
                  showSpeed={true}
                  showBots={true}
                />
                <GameSizeSubBar
                  filter={playFilter}
                  onChange={actions.onShowGames}
                  sort={this.state.challengeSort}
                  onSortChange={this._onChallengeSort}
                />
              </div>
            </div>
            {unfinishedGames.length ? (
              <div className="PlayScreen-unfinished-list">
                <div className="PlayScreen-unfinished-heading">
                  <Icon
                    name="hourglass-o"
                    className="PlayScreen-unfinished-heading-icon"
                    size={16}
                  />
                  Unfinished Games
                </div>
                <GameList
                  games={unfinishedGames
                    .filter((ug) => ug.type === "channel")
                    .map((ug: Object) => ug.game)}
                  onSelect={this._onSelectGameChannel}
                  currentUser={currentUser}
                />
                <GameSummaryList
                  games={unfinishedGames
                    .filter((ug) => ug.type === "summary")
                    .map((ug: Object) => ug.game)}
                  player={currentUser.name}
                  onSelect={this._onSelectGameSummary}
                />
              </div>
            ) : null}
            <GameList
              games={this._sortChallenges(challenges)}
              filter={playFilter}
              roomsById={roomsById}
              usersByName={usersByName}
              onSelect={actions.onSelectChallenge}
              onSelectUser={actions.onUserDetail}
              onDeclineDirect={this._onDismissChallenge}
              currentUser={currentUser}
              groupDirectChallenges={true}
              onPlayerHover={actions.onPlayerHover}
              onPlayerHoverEnd={actions.onPlayerHoverEnd}
            />
          </div>
        )}
      </div>
    );
  }

  _onChallengeSort = (challengeSort: ChallengeSort) => {
    saveSort("play", challengeSort);
    this.setState({ challengeSort });
  };

  // Decline a direct challenge: hide its card locally and notify the sender with
  // a private chat message (handled by the action).
  _onDismissChallenge = (challengeId: number) => {
    this.setState((state) => ({
      dismissedChallengeIds: {
        ...state.dismissedChallengeIds,
        [challengeId]: true,
      },
    }));
    this.props.actions.onDeclineDirectChallenge(challengeId);
  };

  // Best (strongest) parseable rank among a challenge's known players, used as
  // the sort key for Stronger/Weaker. Challenges with no parseable rank fall to
  // the bottom for both directions.
  _challengeRankVal = (game: GameChannel): number => {
    let players = game.players || {};
    let best = -Infinity;
    for (let role of Object.keys(players)) {
      let user = players[role];
      if (user && user.rank) {
        let val = parseRankVal(user.rank);
        if (val > best) {
          best = val;
        }
      }
    }
    return best;
  };

  _compareChallenges = (a: GameChannel, b: GameChannel): number => {
    let sort = this.state.challengeSort;
    if (sort === "newest") {
      return (b.time || 0) - (a.time || 0);
    }
    let diff = this._challengeRankVal(a) - this._challengeRankVal(b);
    return sort === "stronger" ? -diff : diff;
  };

  // Direct challenges (to the current user) are pinned ahead of open ones so
  // they always lead the list; GameList renders them in their own section. Both
  // groups are independently ordered by the active sort.
  _sortChallenges = (challenges: Array<GameChannel>): Array<GameChannel> => {
    let { currentUser } = this.props;
    let { dismissedChallengeIds } = this.state;
    let direct = [];
    let open = [];
    for (let g of challenges) {
      if (dismissedChallengeIds[g.id]) {
        continue;
      }
      if (isDirectChallengeTo(g, currentUser)) {
        direct.push(g);
      } else {
        open.push(g);
      }
    }
    direct.sort(this._compareChallenges);
    open.sort(this._compareChallenges);
    return direct.concat(open);
  };

  _onTogglePrefs = () => {
    this.setState({ showPrefs: !this.state.showPrefs });
  };

  _onTogglePlayMenu = () => {
    this.setState({ showPlayMenu: !this.state.showPlayMenu });
  };

  _onClosePlayMenu = () => {
    this.setState({ showPlayMenu: false });
  };

  _onMenuCreateChallenge = () => {
    this.setState({ showPlayMenu: false });
    this._onCreateChallenge();
  };

  _onMenuAutomatch = () => {
    // If a search is already running the menu item cancels it; otherwise open
    // the automatch preferences modal.
    if (this.props.automatchEnabled) {
      this.setState({ showPlayMenu: false });
      this.props.actions.onAutomatchCancel();
    } else {
      this.setState({ showPlayMenu: false, showPrefs: true });
    }
  };

  _updatePref = (update: Object) => {
    this.setState(update, () => {
      let {
        blitzOk,
        estimatedRank,
        fastOk,
        freeOk,
        humanOk,
        maxHandicap,
        mediumOk,
        rankedOk,
        robotOk,
        unrankedOk,
      } = this.state;
      let prefs = {
        blitzOk,
        estimatedRank,
        fastOk,
        freeOk,
        humanOk,
        maxHandicap,
        mediumOk,
        rankedOk,
        robotOk,
        unrankedOk,
      };
      this.props.actions.onAutomatchSetPrefs(prefs);
    });
  };

  _onStartAutomatch = () => {
    let {
      blitzOk,
      estimatedRank,
      fastOk,
      freeOk,
      humanOk,
      maxHandicap,
      mediumOk,
      rankedOk,
      robotOk,
      unrankedOk,
    } = this.state;
    let prefs = {
      blitzOk,
      estimatedRank,
      fastOk,
      freeOk,
      humanOk,
      maxHandicap,
      mediumOk,
      rankedOk,
      robotOk,
      unrankedOk,
    };
    this.setState({ showPrefs: false });
    this.props.actions.onAutomatchSetPrefs(prefs);
    this.props.actions.onAutomatchCreate(prefs);
  };

  _renderAutomatchModal() {
    let { currentUser, gamesById } = this.props;
    let isPlayingGame =
      !!currentUser &&
      Object.keys(gamesById).some((id) => {
        let g = gamesById[Number(id)];
        return (
          g && isGamePlaying(g) && isGamePlayer(currentUser.name, g.players)
        );
      });
    let {
      blitzOk,
      estimatedRank,
      fastOk,
      freeOk,
      humanOk,
      maxHandicap,
      mediumOk,
      rankedOk,
      robotOk,
      unrankedOk,
      showPrefs,
    } = this.state;

    const rankOptions = [];
    for (let i = 30; i >= 1; i--) {
      rankOptions.push(`${i}k`);
    }

    const userRank = currentUser ? currentUser.rank : null;
    const isUnranked =
      !userRank ||
      (typeof userRank === "string" &&
        (userRank.includes("?") ||
          userRank === "?" ||
          userRank === "NR" ||
          userRank === "-"));

    const baseRankString = isUnranked ? estimatedRank : userRank;
    let baseRankVal = baseRankString ? parseRankVal(baseRankString) : -9999;
    let rangeText = "";
    if (baseRankVal !== -9999) {
      let minRankVal = shiftRankVal(baseRankVal, -maxHandicap);
      let maxRankVal = shiftRankVal(baseRankVal, maxHandicap);
      rangeText = `(${formatRankVal(minRankVal)} – ${formatRankVal(maxRankVal)})`;
    }

    if (!showPrefs) {
      return null;
    }

    return (
      <ScreenModal onClose={this._onTogglePrefs}>
        <div className="ChallengeEditor PlayScreen-automatch-modal">
          <div className="ChallengeEditor-header">Automatch</div>
          <div className="ChallengeEditor-badge">Automatch</div>

          <div className="PlayScreen-automatch-form">
            <div className="PlayScreen-automatch-section">
              <div className="PlayScreen-automatch-section-title">
                Opponent selection
              </div>
              <div className="PlayScreen-automatch-section-content">
                <div className="PlayScreen-automatch-checkbox-row">
                  <label className="PlayScreen-automatch-checkbox">
                    <input
                      type="checkbox"
                      checked={humanOk}
                      onChange={(e) =>
                        this._updatePref({ humanOk: e.target.checked })
                      }
                    />
                    Human
                  </label>

                  <label className="PlayScreen-automatch-checkbox">
                    <input
                      type="checkbox"
                      checked={robotOk}
                      onChange={(e) =>
                        this._updatePref({ robotOk: e.target.checked })
                      }
                    />
                    Robot
                  </label>
                </div>

                <label className="PlayScreen-automatch-checkbox">
                  <input
                    type="checkbox"
                    checked={unrankedOk}
                    onChange={(e) =>
                      this._updatePref({ unrankedOk: e.target.checked })
                    }
                  />
                  Unranked Opponent
                </label>

                <div className="PlayScreen-automatch-diff-row">
                  <div className="PlayScreen-automatch-diff-control">
                    <button
                      type="button"
                      className="PlayScreen-automatch-diff-btn"
                      disabled={maxHandicap <= 0}
                      onClick={() =>
                        this._updatePref({
                          maxHandicap: Math.max(0, maxHandicap - 1),
                        })
                      }>
                      -
                    </button>
                    <span className="PlayScreen-automatch-diff-val">
                      {maxHandicap}
                    </span>
                    <button
                      type="button"
                      className="PlayScreen-automatch-diff-btn"
                      disabled={maxHandicap >= 9}
                      onClick={() =>
                        this._updatePref({
                          maxHandicap: Math.min(9, maxHandicap + 1),
                        })
                      }>
                      +
                    </button>
                  </div>
                  <span className="PlayScreen-automatch-diff-label">
                    Max Rank Difference
                    {rangeText ? (
                      <span className="PlayScreen-automatch-diff-range">
                        {rangeText}
                      </span>
                    ) : null}
                  </span>
                </div>

                {isUnranked && (
                  <div className="PlayScreen-automatch-field PlayScreen-automatch-est-rank">
                    <span className="PlayScreen-automatch-label-inline">
                      Your Estimated Rank:
                    </span>
                    <SelectInput
                      className="PlayScreen-automatch-select"
                      value={estimatedRank}
                      onChange={(e) =>
                        this._updatePref({ estimatedRank: e.target.value })
                      }>
                      {rankOptions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                )}
              </div>
            </div>

            <div className="PlayScreen-automatch-form-row">
              <div className="PlayScreen-automatch-section">
                <div className="PlayScreen-automatch-section-title">
                  Game Type
                </div>
                <div className="PlayScreen-automatch-section-content">
                  <label className="PlayScreen-automatch-checkbox">
                    <input
                      type="checkbox"
                      checked={rankedOk}
                      onChange={(e) =>
                        this._updatePref({ rankedOk: e.target.checked })
                      }
                    />
                    Ranked
                  </label>

                  <label className="PlayScreen-automatch-checkbox">
                    <input
                      type="checkbox"
                      checked={freeOk}
                      onChange={(e) =>
                        this._updatePref({ freeOk: e.target.checked })
                      }
                    />
                    Free
                  </label>
                </div>
              </div>

              <div className="PlayScreen-automatch-section">
                <div className="PlayScreen-automatch-section-title">
                  Game Speed
                </div>
                <div className="PlayScreen-automatch-section-content">
                  <label className="PlayScreen-automatch-checkbox">
                    <input
                      type="checkbox"
                      checked={mediumOk}
                      onChange={(e) =>
                        this._updatePref({ mediumOk: e.target.checked })
                      }
                    />
                    Medium
                  </label>

                  <label className="PlayScreen-automatch-checkbox">
                    <input
                      type="checkbox"
                      checked={fastOk}
                      onChange={(e) =>
                        this._updatePref({ fastOk: e.target.checked })
                      }
                    />
                    Fast
                  </label>

                  <label className="PlayScreen-automatch-checkbox">
                    <input
                      type="checkbox"
                      checked={blitzOk}
                      onChange={(e) =>
                        this._updatePref({ blitzOk: e.target.checked })
                      }
                    />
                    Blitz
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="ChallengeEditor-buttons PlayScreen-automatch-actions">
            <Button
              primary={!this.props.automatchEnabled}
              warning={this.props.automatchEnabled}
              icon={this.props.automatchEnabled ? "shuffle" : undefined}
              disabled={isPlayingGame}
              onClick={
                this.props.automatchEnabled
                  ? this.props.actions.onAutomatchCancel
                  : this._onStartAutomatch
              }>
              {this.props.automatchEnabled ? "Cancel Search" : "Play"}
            </Button>
            <div className="ChallengeEditor-close-action">
              <Button muted onClick={this._onTogglePrefs}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </ScreenModal>
    );
  }

  _onCloseChallenge = () => {
    let { playChallengeId, creatingChallenge } = this.props;
    if (playChallengeId) {
      this.props.actions.onCloseChallenge(playChallengeId);
    }
    if (creatingChallenge) {
      this.props.actions.onCancelCreateChallenge();
    }
  };

  _onCreateChallenge = () => {
    this.props.actions.onStartCreateChallenge();
  };

  // When the current user is in a simul board they don't host, fetch the
  // host's archive once. The archive includes the host's in-play games, which
  // surfaces the other boards of the simul so a challenger can see them too.
  _maybeFetchSimulHostArchive(activeGame: ?GameChannel) {
    let { currentUser, actions } = this.props;
    if (!currentUser || !activeGame || !this._isSimulBoard(activeGame)) {
      return;
    }
    let name = currentUser.name;
    let hostName = this._getSimulHostName(activeGame);
    if (!hostName || hostName === name) {
      return; // We are the host (or no host) — we already have our boards.
    }
    if (this._requestedSimulArchives[hostName]) {
      return;
    }
    this._requestedSimulArchives[hostName] = true;
    actions.onJoinArchive(hostName);
  }

  _isSimulBoard(g: ?GameChannel): boolean {
    if (!g || !g.players) {
      return false;
    }
    // A real simul board is a started game (has a tree, or a global-list
    // summary) with exactly a white host vs a single black opponent. Exclude
    // the challenge channel, which holds the multi-slot proposal: it has an
    // initialProposal and no game tree/summary.
    let isStartedGame = !!(g.tree || g.summary);
    if (!isStartedGame) {
      return false;
    }
    if (!g.players.white || !g.players.black) {
      return false;
    }
    return !!(
      g.type === "simul" ||
      (g.summary && g.summary.type === "simul") ||
      (g.initialProposal && g.initialProposal.gameType === "simul")
    );
  }

  // The host of a simul board is its white player.
  _getSimulHostName(g: GameChannel): ?string {
    return g.players && g.players.white ? g.players.white.name : null;
  }

  // All started simul boards that belong to the same simul as the current
  // user's board. Primary grouping key is the originating simul challenge
  // channel id (simulChallengeId), which every board of one simul shares and is
  // set on CHALLENGE_FINAL; we fall back to the shared host (white player) for
  // boards that don't carry the tag (e.g. summary entries from the global
  // list). Works for the owner (all their boards) and challengers (sibling
  // boards too, best-effort). The user's own board is sorted first; finished
  // boards are kept so the sidebar stays visible and shows the scoreboard.
  _getSimulGames(): Array<GameChannel> {
    let { currentUser, gamesById } = this.props;
    if (!currentUser) {
      return [];
    }
    let name = currentUser.name;
    let allSimul = Object.keys(gamesById)
      .map((id) => gamesById[Number(id)])
      .filter((g) => this._isSimulBoard(g));

    // Anchor on the current user's own simul board.
    let myBoard = allSimul.find((g) => isGamePlayer(name, g.players));
    if (!myBoard) {
      return [];
    }
    let simulId = myBoard.simulChallengeId;
    let hostName = this._getSimulHostName(myBoard);

    let games = allSimul.filter((g) => {
      // Match by the shared simul challenge id when available, otherwise by the
      // shared host.
      if (
        typeof simulId === "number" &&
        typeof g.simulChallengeId === "number"
      ) {
        return g.simulChallengeId === simulId;
      }
      return !!hostName && this._getSimulHostName(g) === hostName;
    });

    // Merge in the host's other simul boards from their archive (which includes
    // in-play games). This lets a challenger see sibling boards that aren't in
    // their own channel state. Skip any board already represented above.
    if (hostName) {
      let haveBoard = (white, black) =>
        games.some((g) => {
          let w = g.players && g.players.white && g.players.white.name;
          let b = g.players && g.players.black && g.players.black.name;
          return w === white && b === black;
        });
      let hostSummaries = this.props.gameSummariesByUser[hostName] || [];
      for (let s of hostSummaries) {
        if (s.type !== "simul" || !s.players) {
          continue;
        }
        let w = s.players.white ? s.players.white.name : null;
        let b = s.players.black ? s.players.black.name : null;
        if (w !== hostName || !b || haveBoard(w, b)) {
          continue;
        }
        // Adapt the summary into the minimal shape the sidebar renders.
        let adapted: any = {
          id: s.timestamp,
          type: "simul",
          players: s.players,
          over: !s.inPlay,
          score: s.score,
          summary: s,
        };
        games.push((adapted: GameChannel));
      }
    }

    // Current user's own board first, then the rest (stable otherwise).
    games.sort((a, b) => {
      let aMine = isGamePlayer(name, a.players) ? 0 : 1;
      let bMine = isGamePlayer(name, b.players) ? 0 : 1;
      return aMine - bMine;
    });
    return games;
  }

  _renderSimulSidebar() {
    let { currentUser, playGameId } = this.props;
    if (!currentUser) {
      return null;
    }
    let simulGames = this._getSimulGames();
    if (simulGames.length < 2) {
      return null;
    }
    let name = currentUser.name;
    // The current user is the simul owner if they're the white host on any
    // board. For the owner every board is theirs, so the "You" badge would be
    // redundant — only show it to a challenger marking their own board.
    let isOwner = simulGames.some((g) => this._getSimulHostName(g) === name);
    // Running scoreboard from the host's perspective (the simul standings).
    let wins = 0;
    let losses = 0;
    for (let g of simulGames) {
      if (!g.over) {
        continue;
      }
      let r = this._getSimulResult(g);
      if (r === "win") {
        wins++;
      } else if (r === "loss") {
        losses++;
      }
    }
    return (
      <div className="PlayScreen-simul-sidebar">
        <div className="PlayScreen-simul-sidebar-header">
          <span className="PlayScreen-simul-sidebar-title">Simul Games</span>
          {wins || losses ? (
            <span
              className="PlayScreen-simul-sidebar-score"
              title="Host record">
              <span className="PlayScreen-simul-sidebar-score-pill PlayScreen-simul-sidebar-score-win">
                {wins}W
              </span>
              <span className="PlayScreen-simul-sidebar-score-pill PlayScreen-simul-sidebar-score-loss">
                {losses}L
              </span>
            </span>
          ) : null}
        </div>
        {simulGames.map((g) => {
          // Each board is labelled by its black player (the challenger).
          let opponent =
            g.players && g.players.black ? g.players.black.name : "—";
          let isMine = isGamePlayer(name, g.players);
          let isOver = !!g.over;
          // "Your turn" only applies to the viewer's own board. On sibling
          // boards the turn is between the host and someone else, so a turn dot
          // there would be meaningless to the current challenger.
          let ourMove = isMine && !isOver && isPlayerMove(g, name);
          let isActive = g.id === playGameId;
          // Result is from the host's perspective (win = host won the board).
          let result = isOver ? this._getSimulResult(g) : null;
          return (
            <A
              key={g.id}
              className={
                "PlayScreen-simul-sidebar-item" +
                (isActive ? " PlayScreen-simul-sidebar-item-active" : "") +
                (isMine && !isOwner
                  ? " PlayScreen-simul-sidebar-item-mine"
                  : "") +
                (isOver ? " PlayScreen-simul-sidebar-item-over" : "") +
                (result ? " PlayScreen-simul-sidebar-item-" + result : "")
              }
              onClick={() => this._onSelectSimulGame(g.id)}>
              {isOver ? (
                <span
                  className="PlayScreen-simul-sidebar-result"
                  title={
                    result === "win"
                      ? "Host won"
                      : result === "loss"
                        ? "Host lost"
                        : "Finished (no result)"
                  }>
                  {result === "win" ? (
                    <Icon name="check" size={12} />
                  ) : result === "loss" ? (
                    <Icon name="x" size={12} />
                  ) : (
                    <Icon name="minus" size={12} />
                  )}
                </span>
              ) : isMine ? (
                <span
                  className={
                    "PlayScreen-simul-sidebar-dot" +
                    (ourMove ? " PlayScreen-simul-sidebar-dot-turn" : "")
                  }
                  title={ourMove ? "Your turn" : "Waiting"}
                />
              ) : (
                <span className="PlayScreen-simul-sidebar-spacer" />
              )}
              <span className="PlayScreen-simul-sidebar-name">{opponent}</span>
              {isOver && result ? (
                <span
                  className={
                    "PlayScreen-simul-sidebar-score-text" +
                    (result === "win"
                      ? " PlayScreen-simul-sidebar-score-text-win"
                      : " PlayScreen-simul-sidebar-score-text-loss")
                  }>
                  {result === "win" ? "W+" : "B+"}
                </span>
              ) : null}
              {isMine && !isOwner ? (
                <span className="PlayScreen-simul-sidebar-you">You</span>
              ) : null}
            </A>
          );
        })}
      </div>
    );
  }

  // Result of a finished board from the simul host's (white's) perspective:
  // "win" = host won, "loss" = host lost. Reporting from the host's side keeps
  // the scoreboard the simul standings — consistent for the owner and every
  // challenger viewing it.
  _getSimulResult(g: GameChannel): ?("win" | "loss") {
    let winningColor = getWinningColor(g.score);
    if (winningColor === "white") {
      return "win";
    } else if (winningColor === "black") {
      return "loss";
    }
    return null;
  }

  _onSelectSimulGame = (gameId: number | string) => {
    // Keep simul boards in the play view, even sibling boards the user is only
    // observing, so they stay in the simul context instead of the Watch tab.
    this.props.actions.onJoinGame(gameId, { inPlayView: true });
  };

  _onSelectGameChannel = (gameId: number) => {
    this.props.actions.onJoinGame(gameId);
  };

  _onSelectGameSummary = (game: GameSummary) => {
    if (game.inPlay) {
      this.props.actions.onJoinGame(game.timestamp);
    } else {
      this.props.actions.onShowUnderConstruction();
    }
  };
}
