// @flow
import React, { PureComponent as Component } from "react";
import GameInfo from "./GameInfo";
import GamePlayersInfo from "./GamePlayersInfo";
import GameChat from "./GameChat";
import GameMoreMenu from "./GameMoreMenu";
import GamePlayActions from "./GamePlayActions";
import GameUndoPrompt from "./GameUndoPrompt";
import GameTypeIcon from "./GameTypeIcon";
import GameTimeSystem from "./GameTimeSystem";
import MoveTree from "./MoveTree";
import BoardContainer from "../board/BoardContainer";
import BoardNav from "../board/BoardNav";
import UserList from "../user/UserList";
import GameClock from "./GameClock";
import ChatMessageBar from "../chat/ChatMessageBar";
import { A, Icon, Modal } from "../common";
import {
  isPlayerMove,
  isGameScoring,
  isGameEditor,
  isDemoOrReview,
  getGameChatSections,
  getGamePlayerRole,
  getGameRoleColor,
} from "../../model/game";
import { sortUsers } from "../../model/user";
import type {
  GameChannel,
  GameChatSection,
  User,
  Room,
  Index,
  AppActions,
  Point,
  BoardPointMark,
  PlayerColor,
  FriendEntry,
  GameNode,
} from "../../model";

type Props = {
  playing?: boolean,
  game: GameChannel,
  usersByName: Index<User>,
  roomsById: Index<Room>,
  currentUser: User,
  actions: AppActions,
  buddies?: ?Array<FriendEntry>,
};

type State = {
  tab: "chat" | "info",
  chatSections: Array<GameChatSection>,
  zenMode: boolean,
  gameId: ?number,
  countdownTime: ?number,
  showingObservers: boolean,
  showScoringInfoModal: boolean,
  showGameInfoModal: boolean,
  hoveredLoc: ?Point,
  // Demo board editing: which color the next placed stone gets, or "alternate"
  // to flip after each placement.
  demoColor: "black" | "white" | "alternate",
  // Active markup tool on the demo board, or null when placing stones/moves.
  // When set, board clicks place that SGF mark instead of stones.
  demoMark: ?("TRIANGLE" | "SQUARE" | "CIRCLE" | "CROSS"),
  // Active sequential-label tool ("number" or "letter"), or null. When set,
  // each placement drops the next label and advances the counter.
  demoLabel: ?("number" | "letter"),
  // Next number to place (1, 2, 3…) and next letter index (0=A, 1=B…).
  demoNextNumber: number,
  demoNextLetter: number,
  // Name of the user pending a "give control" confirmation, if any.
  demoGrantTarget: ?string,
  // User-chosen height (px) of the demo move-tree slot; null = CSS default.
  demoTreeHeight: ?number,
};

/**
 * Helper function that compares the current chat sections with the previous
 * chat sections and returns `true` if the chat has been updated.
 */
function chatHasUpdated(
  chatSections: Array<GameChatSection>,
  prevChatSections: Array<GameChatSection>
) {
  let lastSection = chatSections.length
    ? chatSections[chatSections.length - 1]
    : null;
  let prevLastSection = prevChatSections.length
    ? prevChatSections[prevChatSections.length - 1]
    : null;
  return (
    chatSections.length > prevChatSections.length ||
    (lastSection &&
      prevLastSection &&
      (lastSection.messages.length > prevLastSection.messages.length ||
        lastSection.actions.length > prevLastSection.actions.length))
  );
}

const xLabels = "ABCDEFGHJKLMNOPQRST".split("");

// Sequential letter labels: 0→A, 25→Z, 26→AA, 27→AB … (spreadsheet-style).
function labelFromIndex(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// Inverse of labelFromIndex: "A"→0, "Z"→25, "AA"→26 … Returns null if `text`
// isn't a pure A–Z letter label.
function labelToIndex(text: string): ?number {
  if (!/^[A-Z]+$/.test(text)) {
    return null;
  }
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    n = n * 26 + (text.charCodeAt(i) - 64);
  }
  return n - 1;
}

// Scan a node's existing LABEL props to find where each sequence should resume
// so reopening a game continues numbering instead of restarting. Returns the
// next number (max numeric label + 1) and next letter index (max letter + 1).
function nextLabelCountersFromNode(node: ?Object): {
  number: number,
  letter: number,
} {
  let maxNumber = 0;
  let maxLetter = -1;
  if (node && node.props) {
    for (let p of node.props) {
      if (p.name !== "LABEL" || typeof p.text !== "string") {
        continue;
      }
      let t = p.text.trim();
      if (/^[0-9]+$/.test(t)) {
        let v = parseInt(t, 10);
        if (v > maxNumber) {
          maxNumber = v;
        }
      } else {
        let idx = labelToIndex(t);
        if (idx !== null && idx !== undefined && idx > maxLetter) {
          maxLetter = idx;
        }
      }
    }
  }
  return { number: maxNumber + 1, letter: maxLetter + 1 };
}

function formatCoordinate(loc: ?Point, size: number): ?string {
  if (!loc) {
    return null;
  }
  const col = xLabels[loc.x] || "";
  const row = size - loc.y;
  return `${col}${row}`;
}

function getNodeMoveCoordinate(node: ?GameNode, size: number): ?string {
  if (!node || !node.props) {
    return null;
  }
  let moveProp = node.props.find((p) => p.name === "MOVE");
  if (!moveProp) {
    return null;
  }
  let loc = moveProp.loc;
  if (!loc) {
    return null;
  }
  if (loc === "PASS") {
    return "Pass";
  }
  return formatCoordinate(loc, size);
}

export default class GameScreen extends Component<Props, State> {
  static getDerivedStateFromProps(props: Props, state: State) {
    let { chatSections, gameId } = state;
    let { game } = props;

    if (game.id !== gameId) {
      return {
        ...state,
        gameId: game.id,
        chatSections: getGameChatSections(game),
        hoveredLoc: null,
      };
    }

    let currentChatSections = getGameChatSections(game);
    if (chatHasUpdated(currentChatSections, chatSections)) {
      return { ...state, chatSections: currentChatSections };
    }

    return null;
  }

  state = {
    tab: "chat",
    chatSections: [],
    zenMode: false,
    gameId: null,
    countdownTime: null,
    showingObservers: false,
    showScoringInfoModal: false,
    showGameInfoModal: false,
    hoveredLoc: null,
    demoColor: "alternate",
    demoMark: null,
    demoLabel: null,
    demoNextNumber: 1,
    demoNextLetter: 0,
    demoGrantTarget: null,
    // Height (px) of the demo move-tree slot; null = CSS default. Dragged via
    // the divider between the tree/comment area and the chat.
    demoTreeHeight: null,
  };

  // Divider-drag bookkeeping (not state — avoids a re-render per mousemove).
  _demoDivider: ?{ startY: number, startH: number } = null;

  _chatScrollRef: ?HTMLElement;

  _setChatScroll = () => {
    setTimeout(() => {
      if (this._chatScrollRef) {
        this._chatScrollRef.scrollTop = this._chatScrollRef.scrollHeight;
      }
    }, 0);
  };

  _countdownTimerId: ?IntervalID = null;

  _startCountdown = (time: number) => {
    this._stopCountdown();
    this.setState({ countdownTime: Math.ceil(time) });
    this._countdownTimerId = setInterval(() => {
      let { countdownTime } = this.state;
      if (countdownTime && countdownTime > 0) {
        this.setState({ countdownTime: countdownTime - 1 });
      } else {
        this._stopCountdown();
      }
    }, 1000);
  };

  _stopCountdown = () => {
    if (this._countdownTimerId) {
      clearInterval(this._countdownTimerId);
      this._countdownTimerId = null;
    }
  };

  componentDidMount() {
    if (document.body) {
      document.body.classList.add("GameScreen-body");
    }
    this._setChatScroll();
    document.addEventListener("keydown", this._onKeyDown);

    let { game } = this.props;
    if (
      game.prepType === "AUTOMATCH" &&
      typeof game.time === "number" &&
      game.time > 0
    ) {
      this._startCountdown(game.time);
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    let { chatSections, gameId } = this.state;
    let { chatSections: prevChatSections, gameId: prevGameId } = prevState;
    if (
      gameId !== prevGameId ||
      chatHasUpdated(chatSections, prevChatSections)
    ) {
      this._setChatScroll();
    }

    let { game } = this.props;
    let { game: prevGame } = prevProps;
    if (
      game.prepType === "AUTOMATCH" &&
      typeof game.time === "number" &&
      game.time > 0
    ) {
      if (prevGame.prepType !== "AUTOMATCH" || game.time !== prevGame.time) {
        this._startCountdown(game.time);
      }
    } else if (
      prevGame.prepType === "AUTOMATCH" &&
      game.prepType !== "AUTOMATCH"
    ) {
      this._stopCountdown();
      this.setState({ countdownTime: null });
    }
  }

  componentWillUnmount() {
    const body = document.body;
    if (body) {
      body.classList.remove("GameScreen-body");
      body.classList.remove("zen-mode");
    }
    document.removeEventListener("keydown", this._onKeyDown);
    this._stopCountdown();
  }

  render() {
    let {
      playing,
      currentUser,
      game,
      usersByName,
      roomsById,
      actions,
      buddies,
    } = this.props;
    let { tab, chatSections, zenMode, countdownTime, showingObservers } =
      this.state;
    let isMobile = window.matchMedia("(max-width: 736px)").matches;
    let showPrepOverlay =
      game.prepType === "AUTOMATCH" &&
      typeof countdownTime === "number" &&
      countdownTime > 0;
    let users = game.users ? game.users.map((name) => usersByName[name]) : [];
    sortUsers(users, buddies);
    let tree = game.tree;
    let isOurMove;
    if (playing && tree) {
      isOurMove = isPlayerMove(game, currentUser.name);
    } else {
      isOurMove = false;
    }
    let role = playing
      ? getGamePlayerRole(currentUser.name, game.players)
      : null;
    let playerColor = role && getGameRoleColor(role);
    let scoring = isGameScoring(game);
    // Demonstration / review board: the owner (and any granted editor) edits the
    // board — placing setup stones, moves, and markup — rather than playing timed
    // moves. Reviews (including games loaded from the archive, which arrive as
    // type "review") share the demo editing model, so they use this same path.
    let isDemo = isDemoOrReview(game);
    let isDemoEditor = isDemo && isGameEditor(game, currentUser.name);
    // Names that currently hold editing control of the demo (from EDIT actions),
    // used to mark the observers list with pencil (editor) vs eye (observer).
    let demoEditorNames = null;
    if (isDemo && game.actions) {
      demoEditorNames = new Set(
        game.actions
          .filter((a) => a.action === "EDIT" && a.user)
          .map((a) => a.user.name)
      );
    }
    let isRengo = !!game.players.white_2;
    let white1 = game.players.white;
    let white2 = game.players.white_2;
    let black1 = game.players.black;
    let black2 = game.players.black_2;
    let computedState = tree ? tree.computedState[tree.currentNode] : null;
    let blackCaptures = computedState ? computedState.blackCaptures : 0;
    let whiteCaptures = computedState ? computedState.whiteCaptures : 0;
    let board = computedState ? computedState.board : null;
    let boardSize = board
      ? board.length
      : game.rules && game.rules.size
        ? game.rules.size
        : 19;
    let hoveredCoordinate = formatCoordinate(this.state.hoveredLoc, boardSize);
    let currentNodeObj = tree ? tree.nodes[tree.currentNode] : null;
    let nodeCoordinate = tree
      ? getNodeMoveCoordinate(currentNodeObj, boardSize)
      : null;
    let coordinateToDisplay = hoveredCoordinate || nodeCoordinate;
    let demoMode = this.state.demoColor === "alternate" ? "move" : "edit";
    let className =
      "GameScreen GameScreen-" +
      (playing ? "playing" : "watching") +
      (isRengo ? " GameScreen-rengo" : "") +
      (isDemo ? " GameScreen-demo" : "") +
      (isDemoEditor
        ? " GameScreen-demo-editing GameScreen-demo-" + demoMode
        : "") +
      (zenMode ? " GameScreen-zen" : "");
    let rootStyle =
      isDemo && typeof this.state.demoTreeHeight === "number"
        ? { "--demo-tree-h": this.state.demoTreeHeight + "px" }
        : undefined;
    return (
      <div className={className} style={rootStyle}>
        {showPrepOverlay ? (
          <div className="GameScreen-prep-overlay">
            <div className="GameScreen-prep-card">
              <div className="GameScreen-prep-title">Match Found!</div>
              <div className="GameScreen-prep-timer">{countdownTime}</div>
              <div className="GameScreen-prep-subtitle">Game starts soon</div>
              <div className="GameScreen-prep-warning">
                Do not leave! Leaving a rated automatch game results in an
                escaper mark.
              </div>
            </div>
          </div>
        ) : null}
        <div className="GameScreen-main">
          {scoring ? (
            <div className="GameScreen-scoring-banner">
              <div className="GameScreen-scoring-banner-content">
                <A
                  onClick={this._onShowScoringInfo}
                  className="GameScreen-scoring-banner-info-link"
                  title="Show scoring instructions">
                  <Icon
                    name="badge-info"
                    className="GameScreen-scoring-banner-icon"
                    size={22}
                  />
                </A>
                <span className="GameScreen-scoring-banner-text">
                  <strong>Scoring Phase</strong>
                  {typeof game.blackScore === "number" &&
                  typeof game.whiteScore === "number" ? (
                    <span className="GameScreen-scoring-banner-score">
                      {" | "}Current Score:{" "}
                      <strong>B: {game.blackScore}</strong> –{" "}
                      <strong>W: {game.whiteScore}</strong>
                    </span>
                  ) : null}
                </span>
              </div>
              {playing ? (
                <button
                  type="button"
                  className="Button GameScreen-scoring-done-btn"
                  onClick={this._onDoneScoring}>
                  Done
                </button>
              ) : null}
            </div>
          ) : null}
          {this.state.showScoringInfoModal ? (
            <Modal
              title="Scoring Phase Instructions"
              onClose={this._onHideScoringInfo}>
              <div className="GameScreen-scoring-info-modal-content">
                <div className="GameScreen-scoring-info-highlight-box">
                  <strong>How to mark stones dead/alive</strong>: Click a stone
                  once to mark it as dead (it will fade and show a cross mark).
                  Clicking the stone again will restore it to alive. You can
                  toggle its state back and forth by clicking.
                </div>
                <div className="GameScreen-scoring-info-highlight-box">
                  <strong>Complete Yose first</strong>: The endgame boundaries
                  (yose) must be completely finished before passing. Otherwise,
                  the software might assign huge amounts of territory to the
                  wrong player.
                </div>
                <div className="GameScreen-scoring-info-highlight-box">
                  <strong>Territory Dots</strong>: The server places small
                  square dots to indicate which intersections are counted as
                  territory. When all dead stones have been identified correctly
                  and both players agree, click the <strong>Done</strong> button
                  to announce the final score.
                </div>
                <div className="GameScreen-scoring-info-highlight-box">
                  <strong>Correcting Errors</strong>: If boundaries were left
                  open, click the <strong>Undo</strong> button on the sidebar to
                  restore the game before the passes occurred. You can then
                  complete play and pass again.
                </div>
                <div className="GameScreen-scoring-info-secondary-box">
                  If your opponent continues to mark stones incorrectly, please
                  contact a{" "}
                  <a
                    href="https://www.gokgs.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="GameScreen-scoring-info-kms-link">
                    KGS
                  </a>{" "}
                  server administrator.
                </div>
              </div>
            </Modal>
          ) : null}
          {zenMode && isMobile ? (
            <div className="GameScreen-zen-controls">
              <button
                className="GameScreen-zen-control-btn GameScreen-zen-exit-btn"
                onClick={this._onToggleZen}
                title="Exit zen mode">
                <Icon name="compress" />
              </button>
            </div>
          ) : null}
          <BoardContainer
            game={game}
            playing={playing}
            zenMode={zenMode}
            activeColor={
              isOurMove ? playerColor : this._demoGhostColor(game, isDemoEditor)
            }
            activeMark={
              isDemoEditor && this.state.demoMark
                ? this.state.demoMark.toLowerCase()
                : null
            }
            activeLabel={isDemoEditor ? this._nextDemoLabelText() : null}
            paintEnabled={
              isDemoEditor &&
              !this.state.demoLabel &&
              (!!this.state.demoMark || this.state.demoColor !== "alternate")
            }
            onChangeCurrentNode={this._onChangeCurrentNode}
            onClickPoint={
              isOurMove || scoring || isDemoEditor
                ? this._onClickPoint
                : undefined
            }
            onContextMenuBoard={
              isDemoEditor ? this._onDemoContextMenu : undefined
            }
            onHoverPoint={this._onHoverPoint}
            blackCaptures={blackCaptures}
            whiteCaptures={whiteCaptures}
            zenClocks={
              zenMode && computedState ? (
                <div className="GameScreen-zen-clocks">
                  {!isMobile ? (
                    <div className="GameScreen-zen-clocks-actions">
                      <button
                        className="GameScreen-zen-clock-btn GameScreen-zen-exit-btn"
                        onClick={this._onToggleZen}
                        title="Exit zen mode">
                        <Icon name="compress" />
                      </button>
                      {playing ? (
                        <>
                          <button
                            className={
                              "GameScreen-zen-clock-btn GameScreen-zen-pass-btn" +
                              (isOurMove ? "" : " GameScreen-zen-btn-disabled")
                            }
                            onClick={
                              isOurMove ? () => actions.onPass(game) : undefined
                            }
                            disabled={!isOurMove}
                            title="Pass move">
                            Pass
                          </button>
                          <button
                            className="GameScreen-zen-clock-btn GameScreen-zen-undo-btn"
                            onClick={() => actions.onUndo(game)}
                            title="Request undo">
                            Undo
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="GameScreen-zen-clock GameScreen-zen-clock-white">
                    <div className="GameScreen-zen-username">
                      {white1 ? white1.name : "White"}
                      {white2 ? ` & ${white2.name}` : ""}
                    </div>
                    <GameClock
                      nodeId={tree ? tree.currentNode : null}
                      active={
                        !game.over && tree
                          ? tree.currentNode === tree.activeNode
                          : false
                      }
                      clock={(game.clocks && game.clocks.white) || {}}
                      timeLeft={computedState.whiteTimeLeft}
                      gameRules={game.rules}
                    />
                  </div>
                  <div className="GameScreen-zen-clock GameScreen-zen-clock-black">
                    <div className="GameScreen-zen-username">
                      {black1 ? black1.name : "Black"}
                      {black2 ? ` & ${black2.name}` : ""}
                    </div>
                    <GameClock
                      nodeId={tree ? tree.currentNode : null}
                      active={
                        !game.over && tree
                          ? tree.currentNode === tree.activeNode
                          : false
                      }
                      clock={(game.clocks && game.clocks.black) || {}}
                      timeLeft={computedState.blackTimeLeft}
                      gameRules={game.rules}
                    />
                  </div>
                </div>
              ) : null
            }
          />
          {tree ? (
            <div className="BoardNav-below-board">
              <BoardNav
                nodeId={tree.currentNode}
                currentLine={tree.currentLine}
                onChangeCurrentNode={this._onChangeCurrentNode}
                hoveredCoordinate={coordinateToDisplay}
              />
            </div>
          ) : null}
          {game.accessDenied ? (
            <div className="GameScreen-access-denied">
              <div className="GameScreen-access-denied-text">
                {game.accessDenied}
              </div>
            </div>
          ) : null}
          <div className="GameScreen-side-container">
            <div className="GameScreen-side-inner">
              {!isDemo && game.rules && game.rules.timeSystem ? (
                <div className="GameScreen-time-header">
                  <div className="GameInfo-time-cell">
                    <GameTypeIcon type={game.type} isPrivate={game.private} />
                    <GameTimeSystem rules={game.rules} hideIcon />
                    <A
                      className="GameScreen-time-info-btn"
                      onClick={this._onToggleGameInfoModal}
                      title="Game Info">
                      <Icon name="info" size={14} />
                    </A>
                  </div>
                </div>
              ) : null}
              {playing ? (
                <div className="GameScreen-play-actions-row">
                  <GamePlayActions
                    currentUser={currentUser}
                    game={game}
                    isOurMove={isOurMove}
                    scoring={scoring}
                    onPass={actions.onPass}
                    onUndo={actions.onUndo}
                    onResign={actions.onResign}
                    onAddTime={actions.onAddGameTime}
                  />
                  <button
                    className={
                      "GameScreen-zen-btn" +
                      (zenMode ? " GameScreen-zen-btn-active" : "")
                    }
                    onClick={this._onToggleZen}
                    title={zenMode ? "Exit zen mode" : "Zen mode"}>
                    <Icon name={zenMode ? "compress" : "expand"} />
                  </button>
                </div>
              ) : null}
              {!playing ? (
                <div className="GameScreen-nav">
                  <GameMoreMenu
                    game={game}
                    actions={actions}
                    currentUser={currentUser}
                    roomsById={roomsById}
                    onShowInfo={
                      isDemo ? this._onToggleGameInfoModal : undefined
                    }
                  />
                  {!isDemo ? (
                    <button
                      className={
                        "GameScreen-zen-btn" +
                        (zenMode ? " GameScreen-zen-btn-active" : "")
                      }
                      onClick={this._onToggleZen}
                      title={zenMode ? "Exit zen mode" : "Zen mode"}>
                      <Icon name={zenMode ? "compress" : "expand"} />
                    </button>
                  ) : null}
                  {isDemo &&
                  !isDemoEditor &&
                  tree &&
                  tree.currentNode !== tree.activeNode ? (
                    <button
                      className="GameScreen-nav-sync-btn"
                      onClick={() => this._onChangeCurrentNode(tree.activeNode)}
                      title="Sync to presenter's current move">
                      <Icon name="fast-forward" size={13} /> Sync
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="GameScreen-players-users">
                <div className="GameScreen-players">
                  <GamePlayersInfo
                    game={game}
                    usersByName={usersByName}
                    onUserDetail={this._onUserDetail}
                    onPlayerHover={actions.onPlayerHover}
                    onPlayerHoverEnd={actions.onPlayerHoverEnd}
                  />
                </div>
                <div className="GameScreen-tabs">
                  <div className="GameScreen-tabs-inner">
                    <A
                      className={
                        "GameScreen-tab" +
                        (tab === "chat" ? " GameScreen-tab-active" : "")
                      }
                      onClick={this._onShowChat}>
                      Chat
                    </A>
                    <A
                      className={
                        "GameScreen-tab" +
                        (tab === "info" ? " GameScreen-tab-active" : "")
                      }
                      onClick={this._onShowInfo}>
                      Info
                    </A>
                  </div>
                </div>
              </div>
              {isDemoEditor ? this._renderDemoToolbar() : null}
              {isDemo && tree ? (
                <MoveTree
                  tree={tree}
                  currentNode={tree.currentNode}
                  boardSize={boardSize}
                  onSelectNode={this._onChangeCurrentNode}
                  comment={this._currentNodeComment(game)}
                  onSetComment={
                    isDemoEditor
                      ? (text) =>
                          this.props.actions.onDemoAddComment(game.id, text)
                      : undefined
                  }
                  showComments={isDemo && !isDemoEditor}
                  onSyncToActive={
                    isDemo && !isDemoEditor && tree
                      ? () => this._onChangeCurrentNode(tree.activeNode)
                      : undefined
                  }
                />
              ) : null}
              {isDemo && tree ? (
                <div
                  className="GameScreen-demo-divider-handle"
                  title="Drag to resize"
                  onMouseDown={this._onDemoDividerStart}>
                  <span className="GameScreen-demo-divider-grip" />
                </div>
              ) : null}
              <div
                className={
                  "GameScreen-chat" +
                  (tab === "chat" || tab === "info"
                    ? " GameScreen-tab-content GameScreen-tab-content-" + tab
                    : "") +
                  (showingObservers ? " GameScreen-chat-showing-observers" : "")
                }>
                <div
                  className="GameScreen-chat-scroll"
                  ref={this._setChatScrollRef}>
                  {!isDemo && game.tree && game.name ? (
                    <div className="GameScreen-chat-info">
                      <GameInfo game={game} roomsById={roomsById} compact />
                    </div>
                  ) : null}
                  {tab === "chat" ? (
                    <GameChat
                      currentUser={currentUser}
                      chatSections={chatSections}
                      usersByName={usersByName}
                      onUserDetail={actions.onUserDetail}
                      onSelectNode={this._onChangeCurrentNode}
                    />
                  ) : null}
                </div>
                {tab === "chat" && showingObservers ? (
                  <div className="GameScreen-observers-panel">
                    <UserList
                      users={users}
                      onSelectUser={this._onUserDetail}
                      onPlayerHover={actions.onPlayerHover}
                      onPlayerHoverEnd={actions.onPlayerHoverEnd}
                      hideHeader
                      onClose={this._onToggleObservers}
                      demoEditorNames={demoEditorNames}
                      demoCanGrant={isDemoEditor}
                      onGiveControl={this._onRequestGiveControl}
                    />
                  </div>
                ) : null}
                {tab === "chat" ? (
                  <div className="GameScreen-chat-message-bar">
                    <div className="GameScreen-observers-toggle-container">
                      <A
                        className={
                          "GameScreen-observers-icon-btn" +
                          (showingObservers ? " active" : "")
                        }
                        onClick={this._onToggleObservers}
                        title="Observers">
                        <Icon name="users" size={16} />
                        <span className="GameScreen-observers-badge">
                          {users.length}
                        </span>
                      </A>
                    </div>
                    <ChatMessageBar
                      conversation={{
                        id: 0,
                        messages: [],
                        status: "created",
                        chatsDisabled: !game.tree,
                      }}
                      users={users}
                      onUserDetail={actions.onUserDetail}
                      onSubmit={this._onChat}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {game.undoRequest ? (
          <div className="GameScreen-undo-prompt">
            <GameUndoPrompt
              role={game.undoRequest}
              onAccept={this._onAcceptUndo}
              onDecline={this._onDeclineUndo}
            />
          </div>
        ) : null}
        {this.state.showGameInfoModal ? (
          <Modal title="Game Info" onClose={this._onToggleGameInfoModal}>
            <div className="GameMoreMenu-game-info">
              <GameInfo game={game} roomsById={roomsById} />
            </div>
          </Modal>
        ) : null}
        {this.state.demoGrantTarget ? (
          <Modal title="Give control" onClose={this._onCancelGiveControl}>
            <div className="GameScreen-demo-confirm">
              <p className="GameScreen-demo-confirm-text">
                Give <strong>{this.state.demoGrantTarget}</strong> control of
                this demo board?
              </p>
              <div className="GameScreen-demo-confirm-actions">
                <button
                  type="button"
                  className="Button primary"
                  onClick={this._onConfirmGiveControl}>
                  Give control
                </button>
              </div>
            </div>
          </Modal>
        ) : null}
      </div>
    );
  }

  _setChatScrollRef = (ref: HTMLElement | null) => {
    this._chatScrollRef = ref;
  };

  // Drag the divider between the demo move-tree/comment area and the chat to
  // rebalance their heights. The tree slot grows/shrinks; the chat takes the
  // rest (CSS keys the chat's `top` off `--demo-tree-h`).
  _onDemoDividerStart = (e: Object) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    let current =
      typeof this.state.demoTreeHeight === "number"
        ? this.state.demoTreeHeight
        : 318;
    this._demoDivider = { startY: e.clientY, startH: current };
    window.addEventListener("mousemove", this._onDemoDividerMove);
    window.addEventListener("mouseup", this._onDemoDividerEnd);
  };

  _onDemoDividerMove = (e: Object) => {
    let d = this._demoDivider;
    if (!d) {
      return;
    }
    let next = d.startH + (e.clientY - d.startY);
    next = Math.max(150, Math.min(560, next));
    this.setState({ demoTreeHeight: next });
  };

  _onDemoDividerEnd = () => {
    this._demoDivider = null;
    window.removeEventListener("mousemove", this._onDemoDividerMove);
    window.removeEventListener("mouseup", this._onDemoDividerEnd);
  };

  _onToggleZen = () => {
    const next = !this.state.zenMode;
    this.setState({ zenMode: next });
    if (document.body) {
      document.body.classList.toggle("zen-mode", next);
    }
  };

  _onKeyDown = (e: Object) => {
    if (e.key === "Escape" && this.state.zenMode) {
      this.setState({ zenMode: false });
      if (document.body) {
        document.body.classList.remove("zen-mode");
      }
    }
  };

  _onUserDetail = (user: User) => {
    this.props.actions.onUserDetail(user.name);
  };

  _onChat = (body: string) => {
    this.props.actions.onSendGameChat(body, this.props.game.id);
  };

  _onShowChat = () => {
    this.setState({ tab: "chat" });
  };

  _onShowInfo = () => {
    this.setState({ tab: "info" });
  };

  _onToggleObservers = () => {
    this.setState((state) => ({ showingObservers: !state.showingObservers }));
  };

  _onToggleGameInfoModal = () => {
    this.setState((state) => ({ showGameInfoModal: !state.showGameInfoModal }));
  };

  _onChangeCurrentNode = (nodeId: number) => {
    this.props.actions.onChangeCurrentNode(this.props.game, nodeId);
  };

  // The raw COMMENT text on the current node (joined if there are several), or
  // "" if none. Used to seed the move-comment editor.
  _currentNodeComment(game: GameChannel): string {
    let tree = game.tree;
    let node = tree ? tree.nodes[tree.currentNode] : null;
    if (!node || !node.props) {
      return "";
    }
    return node.props
      .filter((p) => p.name === "COMMENT" && typeof p.text === "string")
      .map((p) => (p.text || "").trim())
      .filter((t) => t.length > 0)
      .join("\n");
  }

  _onHoverPoint = (loc: ?Point) => {
    this.setState({ hoveredLoc: loc });
  };

  // Right-click on a demo board clears all markup symbols on the current node.
  _onDemoContextMenu = (e: Object) => {
    e.preventDefault();
    let { game, currentUser } = this.props;
    if (isDemoOrReview(game) && isGameEditor(game, currentUser.name)) {
      this.props.actions.onDemoClearMarks(game.id);
    }
  };

  _onClickPoint = (
    game: GameChannel,
    loc: Point,
    locColor?: ?PlayerColor,
    locMark?: ?BoardPointMark
  ) => {
    let scoring = isGameScoring(game);
    let isDemoEditor =
      isDemoOrReview(game) && isGameEditor(game, this.props.currentUser.name);
    if (scoring) {
      let isDead =
        locMark === "dead" ||
        (locColor === "white" && locMark === "blackTerritory") ||
        (locColor === "black" && locMark === "whiteTerritory");
      this.props.actions.onMarkLife(game, loc, isDead);
    } else if (isDemoEditor) {
      let { demoColor, demoMark, demoLabel } = this.state;
      if (demoLabel) {
        // Sequential label tool: drop the next number/letter, then advance.
        this._placeDemoLabel(game, loc);
      } else if (demoMark) {
        // Markup tool: toggle a triangle/square/circle on the current node.
        this.props.actions.onDemoAddMark(game.id, loc, demoMark);
      } else if (demoColor === "alternate") {
        // Move tool: append a real move node (supports variations, advances the
        // move counter). Color alternates from the last move on the current line,
        // so branching from any point continues the right color. Empty points only.
        if (!locColor) {
          this.props.actions.onDemoMove(
            game.id,
            loc,
            this._nextMoveColor(game)
          );
        }
      } else {
        // Edit tool: place/remove setup stones (does not affect the move count).
        if (locColor) {
          this.props.actions.onDemoAddStone(game.id, loc, null);
        } else {
          this.props.actions.onDemoAddStone(game.id, loc, demoColor);
        }
      }
    } else if (!locColor) {
      let role = getGamePlayerRole(this.props.currentUser.name, game.players);
      let playerColor = role && getGameRoleColor(role);
      this.props.actions.onPlayMove(game, loc, playerColor);
    }
  };

  // The stone color to preview under the cursor while editing a demo: the next
  // move color for the Move tool, or the fixed color for the Place-stones tool.
  // Returns null when a markup tool is active (the mark ghost takes over).
  _demoGhostColor(game: GameChannel, isDemoEditor: boolean): ?PlayerColor {
    if (!isDemoEditor || this.state.demoMark || this.state.demoLabel) {
      return null;
    }
    let { demoColor } = this.state;
    if (demoColor === "alternate") {
      return this._nextMoveColor(game);
    }
    return demoColor;
  }

  // Remembers the fixed color while alternate (move) mode is active.
  _fixedColor: PlayerColor = "black";

  // The color to play next with the move tool: the opposite of the last move on
  // the current line (black if there are no moves yet). Reading from the tree
  // means branching from any node continues with the correct color.
  _nextMoveColor(game: GameChannel): PlayerColor {
    let tree = game.tree;
    if (!tree) {
      return "black";
    }
    let nodeId = tree.currentNode;
    while (typeof nodeId === "number") {
      let node = tree.nodes[nodeId];
      if (!node) {
        break;
      }
      // A pass counts as a move (it consumes a turn), so the next color
      // alternates from it too — otherwise passing wouldn't switch sides.
      let moveProp = node.props.find((p) => p.name === "MOVE" && p.color);
      if (moveProp && moveProp.color) {
        return moveProp.color === "black" ? "white" : "black";
      }
      nodeId = node.parent;
    }
    return "black";
  }

  // Play a pass on the demo, using the next move color from the current line.
  _onDemoPass = () => {
    let { game } = this.props;
    this.props.actions.onDemoPass(game.id, this._nextMoveColor(game));
  };

  // Clicking the color stone activates fixed-color mode; clicking it again (when
  // already active) toggles between black and white. Also clears any mark tool.
  _onClickColorStone = () => {
    let { demoColor, demoMark } = this.state;
    let next;
    if (demoColor === "alternate" || demoMark) {
      next = this._fixedColor;
    } else {
      next = demoColor === "black" ? "white" : "black";
    }
    this._fixedColor = next;
    this.setState({ demoColor: next, demoMark: null, demoLabel: null });
  };

  _onSelectAlternate = () => {
    this.setState({ demoColor: "alternate", demoMark: null, demoLabel: null });
  };

  // Select a markup tool; clicking the active one again clears it (back to the
  // move/stone tool).
  _onSelectMark = (mark: "TRIANGLE" | "SQUARE" | "CIRCLE" | "CROSS") => {
    this.setState((prev) => ({
      demoMark: prev.demoMark === mark ? null : mark,
      demoLabel: null,
    }));
  };

  // Select a sequential-label tool. Re-selecting the active one clears it.
  // Selecting it resumes the sequence after the highest label already on the
  // current node, so reopening a game continues numbering instead of restarting.
  _onSelectLabel = (kind: "number" | "letter") => {
    let { game } = this.props;
    let tree = game.tree;
    let node = tree ? tree.nodes[tree.currentNode] : null;
    let resume = nextLabelCountersFromNode(node);
    this.setState((prev) => {
      let active = prev.demoLabel === kind;
      return {
        demoLabel: active ? null : kind,
        demoMark: null,
        demoNextNumber: kind === "number" ? resume.number : prev.demoNextNumber,
        demoNextLetter: kind === "letter" ? resume.letter : prev.demoNextLetter,
      };
    });
  };

  // The next label text to drop (and to preview under the cursor), or null when
  // no label tool is active.
  _nextDemoLabelText(): ?string {
    let { demoLabel, demoNextNumber, demoNextLetter } = this.state;
    if (demoLabel === "number") {
      return String(demoNextNumber);
    }
    if (demoLabel === "letter") {
      return labelFromIndex(demoNextLetter);
    }
    return null;
  }

  // Place the next label in the active sequence and advance the counter.
  // Re-placing on a point that has the same label removes it without advancing.
  _placeDemoLabel = (game: GameChannel, loc: Point) => {
    let { demoLabel, demoNextNumber, demoNextLetter } = this.state;
    if (!demoLabel) {
      return;
    }
    let text =
      demoLabel === "number"
        ? String(demoNextNumber)
        : labelFromIndex(demoNextLetter);
    let placed = this.props.actions.onDemoAddLabel(game.id, loc, text);
    if (placed) {
      if (demoLabel === "number") {
        this.setState({ demoNextNumber: demoNextNumber + 1 });
      } else {
        this.setState({ demoNextLetter: demoNextLetter + 1 });
      }
    }
  };

  _onRequestGiveControl = (user: User) => {
    this.setState({ demoGrantTarget: user.name });
  };

  _onCancelGiveControl = () => {
    this.setState({ demoGrantTarget: null });
  };

  _onConfirmGiveControl = () => {
    let { demoGrantTarget } = this.state;
    if (demoGrantTarget) {
      this.props.actions.onSetGameRole(
        this.props.game.id,
        demoGrantTarget,
        "owner"
      );
    }
    this.setState({ demoGrantTarget: null });
  };

  _renderDemoToolbar() {
    let { demoColor, demoMark, demoLabel } = this.state;
    let isAlternate = demoColor === "alternate";
    let noOverlay = !demoMark && !demoLabel;
    // The single-color stone shows the currently selected fixed color (or the
    // last one chosen, while alternate mode is active).
    let fixedColor = isAlternate ? this._fixedColor : demoColor;
    let marks = [
      { id: "TRIANGLE", icon: "triangle", title: "Place Triangle" },
      { id: "SQUARE", icon: "square", title: "Place Square" },
      { id: "CIRCLE", icon: "circle", title: "Place Circle" },
      { id: "CROSS", icon: "x", title: "Place X" },
    ];
    let labels = [
      { id: "number", text: "1", title: "Place Numbers (1, 2, 3…)" },
      { id: "letter", text: "A", title: "Place Letters (A, B, C…)" },
    ];
    return (
      <div className="GameScreen-demo-toolbar">
        <button
          type="button"
          className={
            "GameScreen-demo-option" +
            (isAlternate && noOverlay ? " GameScreen-demo-option-active" : "")
          }
          onClick={this._onSelectAlternate}
          title="Make a move">
          <span className="GameScreen-demo-stone GameScreen-demo-stone-alternate" />
        </button>
        <button
          type="button"
          className={
            "GameScreen-demo-option" +
            (!isAlternate && noOverlay ? " GameScreen-demo-option-active" : "")
          }
          onClick={this._onClickColorStone}
          title="Place stones">
          <span
            className={
              "GameScreen-demo-stone GameScreen-demo-stone-" + fixedColor
            }>
            <span className="GameScreen-demo-stone-plus">
              <Icon name="plus" size={12} />
            </span>
          </span>
        </button>
        <button
          type="button"
          className="GameScreen-demo-option GameScreen-demo-mark GameScreen-demo-pass"
          onClick={this._onDemoPass}
          title="Pass">
          <Icon name="fast-forward" size={15} />
        </button>
        <span className="GameScreen-demo-divider" />
        {marks.map((m) => (
          <button
            key={m.id}
            type="button"
            className={
              "GameScreen-demo-option GameScreen-demo-mark" +
              (demoMark === m.id ? " GameScreen-demo-option-active" : "")
            }
            onClick={() => this._onSelectMark(m.id)}
            title={m.title}>
            <Icon name={m.icon} size={15} />
          </button>
        ))}
        <span className="GameScreen-demo-divider" />
        {labels.map((l) => (
          <button
            key={l.id}
            type="button"
            className={
              "GameScreen-demo-option GameScreen-demo-mark GameScreen-demo-label" +
              (demoLabel === l.id ? " GameScreen-demo-option-active" : "")
            }
            onClick={() => this._onSelectLabel(l.id)}
            title={l.title}>
            {l.text}
          </button>
        ))}
      </div>
    );
  }

  _onAcceptUndo = () => {
    let { game } = this.props;
    if (game.undoRequest) {
      this.props.actions.onAcceptUndo(game);
    }
  };

  _onDeclineUndo = () => {
    let { game } = this.props;
    if (game.undoRequest) {
      this.props.actions.onDeclineUndo(game);
    }
  };

  _onDoneScoring = () => {
    this.props.actions.onDoneScoring(this.props.game);
  };

  _onShowScoringInfo = () => {
    this.setState({ showScoringInfoModal: true });
  };

  _onHideScoringInfo = () => {
    this.setState({ showScoringInfoModal: false });
  };
}
