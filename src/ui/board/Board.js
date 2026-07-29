// @flow
import React, { PureComponent as Component } from "react";
import { A } from "../common";
import { range } from "../../util/collection";
import type {
  BoardState,
  BoardMarkup,
  BoardPointMark,
  PlayerColor,
  Point,
} from "../../model/types";
import { playStoneSoundFromUpdate } from "../../sound";
import { getMoveAids } from "../../util/moveAids";

let xLabels = "ABCDEFGHJKLMNOPQRST".split("");

type Props = {
  x: number,
  y: number,
  color: ?PlayerColor,
  mark: ?BoardPointMark,
  label: ?string,
  showMarkGhost?: boolean,
  ghostLabel?: ?string,
  pendingColor?: ?PlayerColor,
  paintEnabled?: boolean,
  onClick: ?(loc: Point, color?: ?PlayerColor, mark?: ?BoardPointMark) => any,
  onPaintStart?: ?(
    e: Object,
    loc: Point,
    color: ?PlayerColor,
    mark: ?BoardPointMark
  ) => any,
  onPaintEnter?: ?(
    loc: Point,
    color: ?PlayerColor,
    mark: ?BoardPointMark
  ) => any,
  onHover?: ?(loc: ?Point) => any,
};

class BoardStoneSlot extends Component<Props> {
  render() {
    let { color, mark, label, showMarkGhost, ghostLabel } = this.props;
    let isDead =
      mark === "dead" ||
      (color === "white" && mark === "blackTerritory") ||
      (color === "black" && mark === "whiteTerritory");
    let className =
      "Board-stone-slot" +
      (color ? "" : " Board-stone-slot-empty") +
      (isDead ? " Board-stone-slot-dead" : "");
    return (
      <A
        button
        className={className}
        onClick={this._onClickPoint}
        onMouseDown={this._onMouseDown}
        onMouseEnter={this._onMouseEnter}>
        {color ? <div className={"Board-stone Board-stone-" + color} /> : null}
        {!color && this.props.pendingColor ? (
          <div
            className={
              "Board-stone Board-stone-pending Board-stone-" +
              this.props.pendingColor
            }
          />
        ) : null}
        {mark ? (
          <div
            className={
              "Board-stone-mark Board-stone-mark-" + (isDead ? "dead" : mark)
            }
          />
        ) : null}
        {label ? <div className="Board-stone-label">{label}</div> : null}
        {showMarkGhost ? <div className="Board-mark-ghost" /> : null}
        {ghostLabel && !label ? (
          <div className="Board-label-ghost">{ghostLabel}</div>
        ) : null}
      </A>
    );
  }

  _onClickPoint = () => {
    // In paint mode, mousedown already placed — skip the trailing click so we
    // don't immediately toggle the same point back off.
    if (this.props.paintEnabled) {
      return;
    }
    let { x, y } = this.props;
    if (this.props.onClick) {
      this.props.onClick({ x, y }, this.props.color, this.props.mark);
    }
  };

  _onMouseDown = (e: Object) => {
    let { x, y, color, mark, onPaintStart } = this.props;
    if (onPaintStart) {
      onPaintStart(e, { x, y }, color, mark);
    }
  };

  _onMouseEnter = () => {
    let { x, y, color, mark, onHover, onPaintEnter } = this.props;
    if (onHover) {
      onHover({ x, y });
    }
    if (onPaintEnter) {
      onPaintEnter({ x, y }, color, mark);
    }
  };
}

type PropsBoard = {
  board: BoardState,
  markup: BoardMarkup,
  width: number,
  activeColor?: ?PlayerColor,
  activeMark?: ?string,
  // The next sequential label (e.g. "1" or "A") to preview under the cursor.
  activeLabel?: ?string,
  // When true, holding the left button and dragging paints onto each point the
  // cursor enters (used for demo marks / setup stones, never for moves).
  paintEnabled?: boolean,
  onContextMenuBoard?: ?(e: Object) => any,
  onClickPoint?: ?(
    loc: Point,
    color?: ?PlayerColor,
    mark?: ?BoardPointMark
  ) => any,
  onHoverPoint?: ?(loc: ?Point) => any,
};

type State = {
  boardStyle: string,
  stoneStyle: string,
  zoomedPoint: ?Point,
  pendingPoint: ?Point,
  // Screen-px pan applied on top of the zoom transform (mobile zoom aid).
  panOffset: { x: number, y: number },
};

// Boards whose points are small enough on a phone to warrant the move aids
// (tap-to-confirm / zoom). 9x9 and 13x13 don't need them.
const isDenseBoard = (size: number) => size === 19 || size === 17;

const getBoardStyle = () => {
  try {
    return localStorage.getItem("tenuki_board_style") || "goban";
  } catch (e) {
    return "goban";
  }
};

const getStoneStyle = () => {
  try {
    return localStorage.getItem("tenuki_stone_style") || "goban";
  } catch (e) {
    return "goban";
  }
};

export default class Board extends Component<PropsBoard, State> {
  state = {
    boardStyle: getBoardStyle(),
    stoneStyle: getStoneStyle(),
    zoomedPoint: null,
    pendingPoint: null,
    panOffset: { x: 0, y: 0 },
  };

  // True between mousedown and mouseup while drag-painting marks/stones.
  _painting: boolean = false;

  // Long-press-to-pan gesture state (mobile zoom aid).
  _panStart: ?{ x: number, y: number } = null;
  _panBase: { x: number, y: number } = { x: 0, y: 0 };
  _isPanning: boolean = false;
  _panArmed: boolean = false;
  _panLongPressTimer: ?TimeoutID = null;
  _suppressClick: boolean = false;
  _boardEl: ?HTMLElement = null;

  componentDidMount() {
    window.addEventListener("tenuki-style-change", this._onStyleEvent);
    window.addEventListener("resize", this._onResize);
    window.addEventListener("mouseup", this._onPaintEnd);
  }

  componentWillUnmount() {
    window.removeEventListener("tenuki-style-change", this._onStyleEvent);
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("mouseup", this._onPaintEnd);
  }

  // Paint a point: applies the active tool at `loc`. Bypasses the mobile zoom
  // flow — drag-paint is desktop-only.
  _paintPoint = (loc: Point, color: ?PlayerColor, mark: ?BoardPointMark) => {
    if (this.props.onClickPoint) {
      this.props.onClickPoint(loc, color, mark);
    }
  };

  // Left-button press on a point starts a paint gesture and places immediately.
  _onPaintStart = (
    e: Object,
    loc: Point,
    color: ?PlayerColor,
    mark: ?BoardPointMark
  ) => {
    if (!this.props.paintEnabled || e.button !== 0) {
      return;
    }
    this._painting = true;
    this._paintPoint(loc, color, mark);
  };

  // Entering a point while the button is held paints there too.
  _onPaintEnter = (loc: Point, color: ?PlayerColor, mark: ?BoardPointMark) => {
    if (this.props.paintEnabled && this._painting) {
      this._paintPoint(loc, color, mark);
    }
  };

  _onPaintEnd = () => {
    this._painting = false;
  };

  // ── Long-press-to-pan (mobile zoom aid) ─────────────────────────────────
  // When the board is zoomed in, a long press (or a clear drag) lets the user
  // pan the magnified view around instead of tapping to re-center. Panning
  // suppresses the tap that would otherwise play / re-center.
  _isZoomActive(): boolean {
    let isMobile = window.matchMedia("(max-width: 736px)").matches;
    return (
      isMobile &&
      isDenseBoard(this.props.board.length) &&
      this.state.zoomedPoint !== null
    );
  }

  // A held finger "arms" panning: a subsequent small drag then pans. A plain
  // (even slightly long) tap that never moves still plays — arming alone never
  // suppresses the move.
  _armPan = () => {
    this._panArmed = true;
  };

  _startPanning = () => {
    this._isPanning = true;
    this._suppressClick = true;
    if (this._panLongPressTimer) {
      clearTimeout(this._panLongPressTimer);
      this._panLongPressTimer = null;
    }
  };

  _onBoardTouchStart = (e: Object) => {
    this._suppressClick = false;
    this._panArmed = false;
    if (!this._isZoomActive() || e.touches.length !== 1) {
      this._panStart = null;
      return;
    }
    let t = e.touches[0];
    this._panStart = { x: t.clientX, y: t.clientY };
    this._panBase = { ...this.state.panOffset };
    this._isPanning = false;
    this._panLongPressTimer = setTimeout(this._armPan, 300);
  };

  _onBoardTouchMove = (e: Object) => {
    if (!this._panStart) {
      return;
    }
    let t = e.touches[0];
    let dx = t.clientX - this._panStart.x;
    let dy = t.clientY - this._panStart.y;
    if (!this._isPanning) {
      // Panning starts once the finger travels past the threshold — small when
      // the long press has armed it, larger otherwise so taps aren't hijacked.
      let threshold = this._panArmed ? 4 : 12;
      if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        this._startPanning();
      } else {
        return;
      }
    }
    this.setState({
      panOffset: { x: this._panBase.x + dx, y: this._panBase.y + dy },
    });
  };

  _onBoardTouchEnd = () => {
    if (this._panLongPressTimer) {
      clearTimeout(this._panLongPressTimer);
      this._panLongPressTimer = null;
    }
    let wasPanning = this._isPanning;
    this._panStart = null;
    this._isPanning = false;
    this._panArmed = false;
    if (wasPanning) {
      this._commitPan();
    }
    // If panning didn't end on a point (no click follows), clear the guard so
    // it can't swallow a later, unrelated tap.
    setTimeout(() => {
      this._suppressClick = false;
    }, 400);
  };

  // Fold the screen-px pan back into the zoom center (a fractional board point)
  // and reset the offset, so the tap-to-play distance check stays relative to
  // what's actually centered on screen.
  _commitPan = () => {
    let { zoomedPoint, panOffset } = this.state;
    let size = this.props.board.length;
    if (!zoomedPoint || !this._boardEl) {
      this.setState({ panOffset: { x: 0, y: 0 } });
      return;
    }
    let rect = this._boardEl.getBoundingClientRect();
    let cell = rect.width / (size - 1); // scaled screen px per intersection
    if (!cell) {
      this.setState({ panOffset: { x: 0, y: 0 } });
      return;
    }
    let clamp = (v) => Math.max(0, Math.min(size - 1, v));
    let nx = clamp(zoomedPoint.x - panOffset.x / cell);
    let ny = clamp(zoomedPoint.y - panOffset.y / cell);
    this.setState({ zoomedPoint: { x: nx, y: ny }, panOffset: { x: 0, y: 0 } });
  };

  _setBoardEl = (el: HTMLElement | null) => {
    this._boardEl = el;
  };

  componentDidUpdate(prevProps: PropsBoard) {
    if (prevProps.board !== this.props.board) {
      this.setState({
        zoomedPoint: null,
        pendingPoint: null,
        panOffset: { x: 0, y: 0 },
      });
      if (prevProps.board && this.props.board) {
        let stonesPlaced = 0;
        let stoneCaptured = false;
        let prevSize = prevProps.board.length;
        let currSize = this.props.board.length;
        if (prevSize === currSize) {
          for (let y = 0; y < currSize; y++) {
            for (let x = 0; x < currSize; x++) {
              let prevVal = prevProps.board[y][x];
              let currVal = this.props.board[y][x];
              if (!prevVal && currVal) {
                stonesPlaced++;
              } else if (prevVal && !currVal) {
                stoneCaptured = true;
              }
            }
          }
        }
        if (stonesPlaced > 0) {
          playStoneSoundFromUpdate(stoneCaptured, stonesPlaced > 1);
        }
      }
    }
  }

  _onResize = () => {
    let isMobile = window.matchMedia("(max-width: 736px)").matches;
    if (!isMobile && this.state.zoomedPoint) {
      this.setState({ zoomedPoint: null });
    }
  };

  _onStyleEvent = () => {
    this.setState({
      boardStyle: getBoardStyle(),
      stoneStyle: getStoneStyle(),
    });
  };

  _onMouseLeave = () => {
    if (this.props.onHoverPoint) {
      this.props.onHoverPoint(null);
    }
  };

  _onClickPointInternal = (
    loc: Point,
    color?: ?PlayerColor,
    mark?: ?BoardPointMark
  ) => {
    let { board, onClickPoint, activeColor } = this.props;
    let size = board.length;

    // A pan gesture just ended on this point — swallow the tap, don't play.
    if (this._suppressClick) {
      this._suppressClick = false;
      return;
    }

    let isMobile = window.matchMedia("(max-width: 736px)").matches;
    // The move aids only apply when actually placing a move (your turn — the
    // board carries an activeColor) on a phone, and only on the dense boards
    // (19x19 and 17x17). On 9x9 and 13x13 the points are large enough that no
    // aid is needed.
    let aidsApply =
      isMobile && !!onClickPoint && !!activeColor && isDenseBoard(size);
    let aid = aidsApply ? getMoveAids() : "deactivate";

    if (aid === "confirm") {
      // Tap once to preview a translucent stone; tap the SAME point again to
      // commit it. Tapping a different empty point moves the preview; tapping an
      // occupied point clears it.
      let { pendingPoint } = this.state;
      let samePoint =
        pendingPoint && pendingPoint.x === loc.x && pendingPoint.y === loc.y;
      if (samePoint) {
        if (onClickPoint) {
          onClickPoint(loc, color, mark);
        }
        this.setState({ pendingPoint: null });
      } else if (color) {
        // Occupied intersection — cancel any pending preview.
        if (pendingPoint) {
          this.setState({ pendingPoint: null });
        }
      } else {
        this.setState({ pendingPoint: loc });
      }
      return;
    }

    if (aid === "zoom") {
      let { zoomedPoint } = this.state;
      if (!zoomedPoint) {
        this.setState({ zoomedPoint: loc });
      } else {
        let dx = Math.abs(zoomedPoint.x - loc.x);
        let dy = Math.abs(zoomedPoint.y - loc.y);
        let distance = Math.max(dx, dy);

        if (distance <= 3) {
          if (onClickPoint) {
            onClickPoint(loc, color, mark);
          }
          this.setState({ zoomedPoint: null, panOffset: { x: 0, y: 0 } });
        } else {
          this.setState({ zoomedPoint: loc, panOffset: { x: 0, y: 0 } });
        }
      }
      return;
    }

    // "deactivate", desktop, or non-move interaction — play immediately.
    if (onClickPoint) {
      onClickPoint(loc, color, mark);
    }
  };

  render() {
    let {
      board,
      markup,
      onHoverPoint,
      activeColor,
      activeMark,
      activeLabel,
      paintEnabled,
    } = this.props;
    let size = board.length;
    let sizeRange = range(size);
    let { zoomedPoint } = this.state;

    let isMobile = window.matchMedia("(max-width: 736px)").matches;
    let isZoomed = isMobile && isDenseBoard(size) && zoomedPoint !== null;

    let className =
      "Board" +
      " Board-size-" +
      size +
      (this.props.onClickPoint ? " Board-clickable" : "") +
      (activeColor ? " Board-active-" + activeColor : "") +
      (activeMark ? " Board-active-mark Board-active-mark-" + activeMark : "");

    let boardStyle = {};
    if (isZoomed && zoomedPoint) {
      let px = zoomedPoint.x / (size - 1);
      let py = zoomedPoint.y / (size - 1);
      let tx = (0.5 - px) * 100;
      let ty = (0.5 - py) * 100;
      let pan = this.state.panOffset;
      // Outer px translate pans the (scaled) board in screen space.
      boardStyle.transform =
        `translate(${pan.x}px, ${pan.y}px) ` +
        `scale(2) translate(${tx}%, ${ty}%)`;
    }

    return (
      <div className={"Board-wrapper" + (isZoomed ? " is-zoomed" : "")}>
        <div
          ref={this._setBoardEl}
          className={className}
          style={boardStyle}
          data-board-style={this.state.boardStyle}
          data-stone-style={this.state.stoneStyle}
          onTouchStart={this._onBoardTouchStart}
          onTouchMove={this._onBoardTouchMove}
          onTouchEnd={this._onBoardTouchEnd}
          onTouchCancel={this._onBoardTouchEnd}>
          <div className="Board-inner">
            <div className="Board-grid">
              <div className="Board-grid-lines-y">
                {sizeRange.map((y) => (
                  <div key={y} className="Board-grid-line-y" />
                ))}
              </div>
              <div className="Board-grid-lines-x">
                {sizeRange.map((x) => (
                  <div key={x} className="Board-grid-line-x" />
                ))}
              </div>
            </div>
            <div className="Board-star-points">
              {range(0, 9).map((i) => (
                <div
                  key={i}
                  className={"Board-star-point Board-star-point-" + i}
                />
              ))}
            </div>
            <div className="Board-coords">
              <div className="Board-coords-top">
                {sizeRange.map((x) => (
                  <div key={x} className="Board-coord-label">
                    {xLabels[x]}
                  </div>
                ))}
              </div>
              <div className="Board-coords-bottom">
                {sizeRange.map((x) => (
                  <div key={x} className="Board-coord-label">
                    {xLabels[x]}
                  </div>
                ))}
              </div>
              <div className="Board-coords-left">
                {sizeRange.map((y) => (
                  <div key={y} className="Board-coord-label">
                    {size - y}
                  </div>
                ))}
              </div>
              <div className="Board-coords-right">
                {sizeRange.map((y) => (
                  <div key={y} className="Board-coord-label">
                    {size - y}
                  </div>
                ))}
              </div>
            </div>
            <div
              className="Board-stones"
              onMouseLeave={this._onMouseLeave}
              onContextMenu={this.props.onContextMenuBoard || undefined}>
              {range(size).map((y) => (
                <div key={y} className="Board-stones-line">
                  {range(size).map((x) => {
                    let color = board[y][x];
                    let mark = markup.marks[y] && markup.marks[y][x];
                    let label = markup.labels[y] && markup.labels[y][x];
                    return (
                      <BoardStoneSlot
                        key={y * size + x}
                        x={x}
                        y={y}
                        color={color}
                        mark={mark}
                        label={label}
                        showMarkGhost={!!activeMark}
                        ghostLabel={activeLabel}
                        pendingColor={
                          zoomedPoint === null &&
                          this.state.pendingPoint &&
                          this.state.pendingPoint.x === x &&
                          this.state.pendingPoint.y === y
                            ? activeColor
                            : null
                        }
                        paintEnabled={paintEnabled}
                        onClick={this._onClickPointInternal}
                        onPaintStart={
                          paintEnabled ? this._onPaintStart : undefined
                        }
                        onPaintEnter={
                          paintEnabled ? this._onPaintEnter : undefined
                        }
                        onHover={onHoverPoint}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
