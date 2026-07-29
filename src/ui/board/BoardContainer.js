// @flow
import React, { PureComponent as Component } from "react";
import Board from "./Board";
import { Icon } from "../common";
import { isMobileScreen } from "../../util/dom";
import {
  getBoardScale,
  setBoardScale,
  getZenBoardScale,
  setZenBoardScale,
  getZenPan,
  setZenPan,
  BOARD_SCALE_MIN,
  BOARD_SCALE_MAX,
  BOARD_SCALE_EVENT,
} from "../../util/boardScale";
import type {
  GameChannel,
  Point,
  BoardPointMark,
  PlayerColor,
} from "../../model/types";

const STONE_POSITIONS = [
  { left: 28, top: 30 },
  { left: 46, top: 22 },
  { left: 38, top: 45 },
  { left: 20, top: 48 },
  { left: 54, top: 40 },
  { left: 32, top: 58 },
  { left: 50, top: 54 },
  { left: 22, top: 34 },
  { left: 42, top: 32 },
];

type Props = {
  game: GameChannel,
  playing?: boolean,
  zenMode?: boolean,
  activeColor?: ?PlayerColor,
  activeMark?: ?string,
  activeLabel?: ?string,
  paintEnabled?: boolean,
  onClickPoint: (
    game: GameChannel,
    loc: Point,
    color?: ?PlayerColor,
    mark?: ?BoardPointMark
  ) => any,
  onContextMenuBoard?: ?(e: Object) => any,
  onHoverPoint?: ?(loc: ?Point) => any,
  blackCaptures?: number,
  whiteCaptures?: number,
  zenClocks?: any,
};

type State = {
  boardWidth: ?number,
  fitBoardWidth: ?number,
  marginTop: number,
  panX: number,
  panY: number,
};

export default class BoardContainer extends Component<Props, State> {
  static defaultProps: Props;
  state: State = {
    boardWidth: null,
    fitBoardWidth: null,
    marginTop: 0,
    panX: 0,
    panY: 0,
  };

  _containerRef: ?HTMLElement;

  // Free drag-to-move the board (zen mode only). A plain click still plays a
  // move — panning only kicks in past a small movement threshold, and the
  // resulting click is then suppressed.
  _panning: boolean = false;
  _panMoved: boolean = false;
  _panStartX: number = 0;
  _panStartY: number = 0;
  _panBaseX: number = 0;
  _panBaseY: number = 0;
  _boardEl: ?HTMLElement = null;

  // Live drag-resize (desktop): the corner handle scales the board between
  // BOARD_SCALE_MIN% and 100% of the fitted size.
  _resizing: boolean = false;
  _resizeStartX: number = 0;
  _resizeStartY: number = 0;
  _resizeStartWidth: number = 0;
  _resizeScale: number = 100;

  _setBoardWidth = () => {
    if (this._containerRef) {
      // Note: this is tightly coupled to the CSS layout
      let containerWidth = this._containerRef.offsetWidth;
      let boardWidth;
      let fitBoardWidth;
      let marginTop = 0;
      if (containerWidth <= 736) {
        boardWidth = containerWidth;
        fitBoardWidth = containerWidth;
      } else {
        let containerHeight = this._containerRef.offsetHeight;
        fitBoardWidth = Math.min(containerWidth, containerHeight);
        // Desktop-only user "Board size" preference shrinks the fitted board.
        // Zen mode keeps its own size, independent of normal mode.
        let scale = this.props.zenMode ? getZenBoardScale() : getBoardScale();
        boardWidth = Math.round((fitBoardWidth * scale) / 100);
      }
      this.setState({ boardWidth, fitBoardWidth, marginTop });
    }
  };

  _onResizeStart = (e: Object) => {
    // Left button only; ignore on mobile (handle is hidden there anyway).
    if (e.button !== 0 || isMobileScreen()) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    this._resizing = true;
    this._resizeStartX = e.clientX;
    this._resizeStartY = e.clientY;
    this._resizeStartWidth = this.state.boardWidth || 0;
    window.addEventListener("mousemove", this._onResizeMove);
    window.addEventListener("mouseup", this._onResizeEnd);
  };

  _onResizeMove = (e: Object) => {
    let fit = this.state.fitBoardWidth;
    if (!this._resizing || !fit) {
      return;
    }
    // Average the two axes so dragging the corner outward (toward the bottom-
    // right) grows the board and inward shrinks it, symmetric about center.
    let dx = e.clientX - this._resizeStartX;
    let dy = e.clientY - this._resizeStartY;
    let newWidth = this._resizeStartWidth + (dx + dy) / 2;
    let minWidth = (fit * BOARD_SCALE_MIN) / 100;
    let maxWidth = (fit * BOARD_SCALE_MAX) / 100;
    if (newWidth > maxWidth) {
      newWidth = maxWidth;
    } else if (newWidth < minWidth) {
      newWidth = minWidth;
    }
    this._resizeScale = Math.round((newWidth / fit) * 100);
    // Live local update only; persistence happens once, on release.
    this.setState({ boardWidth: Math.round(newWidth) });
  };

  _onResizeEnd = () => {
    if (!this._resizing) {
      return;
    }
    this._resizing = false;
    window.removeEventListener("mousemove", this._onResizeMove);
    window.removeEventListener("mouseup", this._onResizeEnd);
    // Persist to the mode-specific store so zen size never affects normal size.
    if (this.props.zenMode) {
      setZenBoardScale(this._resizeScale);
    } else {
      setBoardScale(this._resizeScale);
    }
  };

  // ── Drag-to-move the whole board (zen mode, desktop) ────────────────────
  _onBoardPanStart = (e: Object) => {
    // Zen only, left button, desktop. Don't preventDefault: a non-dragging
    // press must still deliver its click to the intersection (play a move).
    if (!this.props.zenMode || e.button !== 0 || isMobileScreen()) {
      return;
    }
    this._panning = true;
    this._panMoved = false;
    this._panStartX = e.clientX;
    this._panStartY = e.clientY;
    this._panBaseX = this.state.panX;
    this._panBaseY = this.state.panY;
    window.addEventListener("mousemove", this._onBoardPanMove);
    window.addEventListener("mouseup", this._onBoardPanEnd);
  };

  _onBoardPanMove = (e: Object) => {
    if (!this._panning) {
      return;
    }
    let dx = e.clientX - this._panStartX;
    let dy = e.clientY - this._panStartY;
    if (!this._panMoved && Math.abs(dx) + Math.abs(dy) < 5) {
      return; // below threshold — still a potential click
    }
    this._panMoved = true;
    this.setState({ panX: this._panBaseX + dx, panY: this._panBaseY + dy });
  };

  _onBoardPanEnd = () => {
    if (!this._panning) {
      return;
    }
    this._panning = false;
    window.removeEventListener("mousemove", this._onBoardPanMove);
    window.removeEventListener("mouseup", this._onBoardPanEnd);
    if (this._panMoved) {
      // Remember where the user parked the board in zen mode.
      setZenPan({ x: this.state.panX, y: this.state.panY });
    }
    if (this._panMoved && this._boardEl) {
      // Swallow the click that a drag would otherwise trigger (which would
      // play a stray move). One-shot, capture phase.
      let board = this._boardEl;
      let swallow = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
        board.removeEventListener("click", swallow, true);
      };
      board.addEventListener("click", swallow, true);
      // If the drag ends without a click ever firing (mouse released off the
      // board), the capture listener would linger and swallow the next real
      // move click. Same 400ms safety window as Board.js.
      setTimeout(() => board.removeEventListener("click", swallow, true), 400);
    }
  };

  _setBoardEl = (el: ?HTMLElement) => {
    this._boardEl = el;
  };

  _rafId: ?AnimationFrameID;
  _zenRafId: ?AnimationFrameID;

  componentDidMount() {
    this._setBoardWidth();
    // The parent GameScreen adds the `GameScreen-body` class to <body> in its
    // own componentDidMount, which runs AFTER this child's. That class changes
    // the container's layout, so the measurement above can be taken against the
    // pre-class layout and come out slightly wrong (visible as a board/sidebar
    // misalignment that "fixes itself" on the next resize). Re-measure on the
    // next frame, once the body class and its styles have applied.
    this._rafId = window.requestAnimationFrame(this._setBoardWidth);
    window.addEventListener("resize", this._setBoardWidth);
    window.addEventListener(BOARD_SCALE_EVENT, this._setBoardWidth);
    // Mounted directly in zen (e.g. remount while active): restore its position.
    if (this.props.zenMode) {
      let pan = getZenPan();
      if (pan.x !== 0 || pan.y !== 0) {
        this.setState({ panX: pan.x, panY: pan.y });
      }
    }
  }

  componentWillUnmount() {
    if (this._rafId) {
      window.cancelAnimationFrame(this._rafId);
    }
    if (this._zenRafId) {
      window.cancelAnimationFrame(this._zenRafId);
    }
    window.removeEventListener("resize", this._setBoardWidth);
    window.removeEventListener(BOARD_SCALE_EVENT, this._setBoardWidth);
    window.removeEventListener("mousemove", this._onResizeMove);
    window.removeEventListener("mouseup", this._onResizeEnd);
    window.removeEventListener("mousemove", this._onBoardPanMove);
    window.removeEventListener("mouseup", this._onBoardPanEnd);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.zenMode === prevProps.zenMode) {
      return;
    }
    if (this.props.zenMode) {
      // Entering zen: restore the parked position; normal mode never pans.
      let pan = getZenPan();
      this.setState({ panX: pan.x, panY: pan.y });
    } else {
      // Leaving zen: drop the pan so it can't carry into the normal layout.
      this.setState({ panX: 0, panY: 0 });
    }
    // The container's dimensions change with the zen body class; re-measure on
    // the next frame (once layout settles) so the mode's stored size applies.
    if (this._zenRafId) {
      window.cancelAnimationFrame(this._zenRafId);
    }
    this._zenRafId = window.requestAnimationFrame(this._setBoardWidth);
  }

  render() {
    let {
      game,
      onClickPoint,
      onContextMenuBoard,
      onHoverPoint,
      activeColor,
      activeMark,
      activeLabel,
      paintEnabled,
      blackCaptures,
      whiteCaptures,
      zenClocks,
    } = this.props;
    let { boardWidth, marginTop, panX, panY } = this.state;
    let { zenMode } = this.props;

    if (!boardWidth) {
      return (
        <div
          className="GameScreen-board-container GameScreen-board-container-loading"
          ref={this._setContainerRef}>
          <div className="BoardLoading">
            <div className="BoardLoading-dot" />
            <div className="BoardLoading-dot" />
            <div className="BoardLoading-dot" />
          </div>
        </div>
      );
    }

    let tree = game.tree;
    let board;
    let markup;
    if (tree) {
      // Normally render the current node's position. If it isn't computed yet
      // (e.g. a just-played demo move whose SGF echo is still in flight, so
      // currentNode points at a node that doesn't exist locally for a moment),
      // fall back to the active node's state instead of flashing the loading
      // spinner. The echo arrives within a frame or two and re-renders cleanly.
      let computedState =
        tree.computedState[tree.currentNode] ||
        tree.computedState[tree.activeNode];
      if (computedState) {
        board = computedState.board;
        markup = computedState.markup;
      }
    }
    return (
      <div className="GameScreen-board-container" ref={this._setContainerRef}>
        <div
          ref={this._setBoardEl}
          className={
            "GameScreen-board" + (zenMode ? " GameScreen-board-movable" : "")
          }
          onMouseDown={zenMode ? this._onBoardPanStart : undefined}
          style={{
            width: boardWidth,
            height: boardWidth,
            marginTop,
            position: "relative",
            transform:
              zenMode && (panX || panY)
                ? `translate(${panX}px, ${panY}px)`
                : undefined,
          }}>
          <div className="GameScreen-board-inner">
            {board && markup ? (
              <Board
                board={board}
                markup={markup}
                width={boardWidth}
                activeColor={activeColor}
                activeMark={activeMark}
                activeLabel={activeLabel}
                paintEnabled={paintEnabled}
                onClickPoint={onClickPoint ? this._onClickPoint : undefined}
                onContextMenuBoard={onContextMenuBoard}
                onHoverPoint={onHoverPoint}
              />
            ) : (
              <div className="GameScreen-board-spinner">
                <div className="BoardLoading">
                  <div className="BoardLoading-dot" />
                  <div className="BoardLoading-dot" />
                  <div className="BoardLoading-dot" />
                </div>
              </div>
            )}
          </div>
          {game.moveError ? (
            <div className="GameScreen-board-error-toast">
              <span className="GameScreen-board-error-toast-text">
                <span className="GameScreen-board-error-toast-icon">
                  <Icon name="alert-triangle" size={14} />
                </span>
                {game.moveError}
              </span>
            </div>
          ) : null}
          {zenClocks || null}
          <div className="CaptureBowl CaptureBowl-topleft">
            <div className="CaptureBowl-dish">
              {Array.from({ length: Math.min(blackCaptures || 0, 9) }).map(
                (_, i) => (
                  <div
                    key={i}
                    className="CaptureBowl-stone CaptureBowl-stone-white"
                    style={{
                      left: `${STONE_POSITIONS[i].left}%`,
                      top: `${STONE_POSITIONS[i].top}%`,
                    }}
                  />
                )
              )}
            </div>
            {(blackCaptures || 0) > 0 && (
              <span className="CaptureBowl-count">{blackCaptures}</span>
            )}
          </div>
          <div className="CaptureBowl CaptureBowl-bottomright">
            <div className="CaptureBowl-dish">
              {Array.from({ length: Math.min(whiteCaptures || 0, 9) }).map(
                (_, i) => (
                  <div
                    key={i}
                    className="CaptureBowl-stone CaptureBowl-stone-black"
                    style={{
                      left: `${STONE_POSITIONS[i].left}%`,
                      top: `${STONE_POSITIONS[i].top}%`,
                    }}
                  />
                )
              )}
            </div>
            {(whiteCaptures || 0) > 0 && (
              <span className="CaptureBowl-count">{whiteCaptures}</span>
            )}
          </div>
          <button
            type="button"
            className="GameScreen-board-resize"
            title="Drag to resize the board"
            aria-label="Resize board"
            onMouseDown={this._onResizeStart}>
            <Icon name="move-diagonal" size={16} />
          </button>
        </div>
      </div>
    );
  }

  _setContainerRef = (ref: HTMLElement | null) => {
    this._containerRef = ref;
  };

  _onClickPoint = (
    loc: Point,
    color?: ?PlayerColor,
    mark?: ?BoardPointMark
  ) => {
    this.props.onClickPoint(this.props.game, loc, color, mark);
  };
}
