// @flow
import React, { PureComponent as Component } from "react";
import ReactDOM from "react-dom";
import { Icon } from "../common";
import type { GameTree, GameNode } from "../../model";

const xLabels = "ABCDEFGHJKLMNOPQRST".split("");

// Node/grid geometry (px). A node is placed at column = depth, row = branch.
const NODE = 30; // node diameter
const COL_GAP = 22; // horizontal gap between columns
const ROW_GAP = 12; // vertical gap between rows
const PAD = 12; // padding around the graph
const COL = NODE + COL_GAP;
const ROW = NODE + ROW_GAP;

// Build the SVG path `d` for a parent→child link. The mainline is straight; a
// branch uses a smooth S-curve. In horizontal mode moves flow left→right (curve
// control handles are horizontal); in vertical mode top→bottom (handles are
// vertical).
function linkPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  vertical: boolean
): string {
  if (x1 === x2 || y1 === y2) {
    return "M " + x1 + " " + y1 + " L " + x2 + " " + y2;
  }
  if (vertical) {
    let cy = (y1 + y2) / 2;
    return (
      "M " +
      x1 +
      " " +
      y1 +
      " C " +
      x1 +
      " " +
      cy +
      " " +
      x2 +
      " " +
      cy +
      " " +
      x2 +
      " " +
      y2
    );
  }
  let cx = (x1 + x2) / 2;
  return (
    "M " +
    x1 +
    " " +
    y1 +
    " C " +
    cx +
    " " +
    y1 +
    " " +
    cx +
    " " +
    y2 +
    " " +
    x2 +
    " " +
    y2
  );
}

type Props = {
  tree: GameTree,
  currentNode: number,
  boardSize: number,
  onSelectNode: (nodeId: number) => any,
  comment?: string,
  onSetComment?: (text: string) => any,
  // Show the read-only comment area (viewers who can't write). Editors get the
  // comment area implicitly via onSetComment.
  showComments?: boolean,
  // Demo viewers: jump to the editor's current position (tree.activeNode).
  onSyncToActive?: () => any,
};

const WIN_W = 360;
const WIN_H = 460;
const WIN_MIN_W = 220;
const WIN_MIN_H = 200;
// Graph height range when the user drags the graph/comment divider.
const INLINE_GRAPH_H = 138;
const INLINE_GRAPH_MIN_H = 60;

type State = {
  expanded: boolean,
  // Drag offset of the expanded window from its centered position (px).
  dragX: number,
  dragY: number,
  // Expanded window size (px).
  winW: number,
  winH: number,
  // Draft text of the comment editor (committed on blur / Save).
  commentDraft: string,
  // Height (px) of the inline graph; null = CSS default (drag to resize the
  // split between the move list and the comment area).
  inlineGraphH: ?number,
  // When a node is right-clicked, its popover opens at {x,y} (viewport px).
  commentPopover: ?{
    nodeId: number,
    x: number,
    y: number,
  },
};

type Placed = {
  id: number,
  col: number,
  row: number,
  parentId: ?number,
  label: string,
  color: ?string, // "black" | "white" | null (setup/root)
  hasComment: boolean,
};

function moveInfo(
  node: ?GameNode,
  size: number
): { label: ?string, color: ?string } {
  if (!node || !node.props) {
    return { label: null, color: null };
  }
  let moveProp = node.props.find((p) => p.name === "MOVE");
  if (!moveProp || !moveProp.loc) {
    return { label: null, color: null };
  }
  let color = moveProp.color || null;
  if (moveProp.loc === "PASS") {
    return { label: "Pass", color };
  }
  let loc = moveProp.loc;
  let label = (xLabels[loc.x] || "") + (size - loc.y);
  return { label, color };
}

// Lay the tree out left-to-right by depth. Each leaf/branch consumes a row; a
// straight line keeps its parent's row, and each additional branch drops to the
// next free row. Returns the placed nodes plus the grid extent.
function layoutTree(
  tree: GameTree,
  size: number
): { placed: Array<Placed>, cols: number, rows: number } {
  let placed: Array<Placed> = [];
  let nextRow = 0;
  let maxCol = 0;

  // Pre-order walk: the main line (child 0) keeps its parent's row; each extra
  // branch drops to the next free row.
  let visit = (id: number, col: number, parentId: ?number, row: number) => {
    let node = tree.nodes[id];
    if (!node) {
      return;
    }
    if (col > maxCol) {
      maxCol = col;
    }
    let info =
      id === tree.rootNode
        ? { label: "Start", color: null }
        : moveInfo(node, size);
    let commentText = (node.props || [])
      .filter((p) => p.name === "COMMENT" && p.text)
      .map((p) => p.text)
      .join("\n");
    placed.push({
      id,
      col,
      row,
      parentId,
      label: info.label || "•",
      color: info.color,
      hasComment: !!commentText,
    });
    let children = node.children || [];
    for (let i = 0; i < children.length; i++) {
      let childRow = i === 0 ? row : ++nextRow;
      visit(children[i], col + 1, id, childRow);
    }
  };
  visit(tree.rootNode, 0, null, 0);

  return { placed, cols: maxCol + 1, rows: nextRow + 1 };
}

export default class MoveTree extends Component<Props, State> {
  _scrollRef: ?HTMLElement;

  state = {
    expanded: false,
    dragX: 0,
    dragY: 0,
    winW: WIN_W,
    winH: WIN_H,
    commentDraft: "",
    commentPopover: null,
    inlineGraphH: null,
  };

  // Resize bookkeeping (not state — avoids churn during a resize drag).
  _resizeStart: ?{
    mx: number,
    my: number,
    w: number,
    h: number,
    x: number,
    corner: "bl" | "br",
  } = null;

  // Drag bookkeeping (not state — avoids a re-render per mousemove).
  _dragStart: ?{ mx: number, my: number, x: number, y: number } = null;

  // Graph/comment divider drag bookkeeping.
  _graphResizeStart: ?{ my: number, h: number } = null;

  componentDidMount() {
    this._scrollToCurrent();
    document.addEventListener("mousedown", this._onDocMouseDown);
  }

  // Close the comment popover when clicking outside it.
  _onDocMouseDown = (e: Object) => {
    if (!this.state.commentPopover) {
      return;
    }
    let el = e.target;
    while (el) {
      if (
        el.classList &&
        (el.classList.contains("MoveTree-comment-popover") ||
          el.classList.contains("MoveTree-node"))
      ) {
        return;
      }
      el = el.parentNode;
    }
    this._closeCommentPopover();
  };

  componentDidUpdate(prev: Props, prevState: State) {
    // Re-scroll when the current node changes, the tree changes (a just-played
    // move: currentNode was set before its node existed), or we (un)expand.
    if (
      prev.currentNode !== this.props.currentNode ||
      prev.tree !== this.props.tree ||
      prevState.expanded !== this.state.expanded
    ) {
      this._scrollToCurrent();
    }
    // Comments are append-only (KGS chat lines), so the editor starts empty
    // for each node — clear the draft when the selected node changes.
    if (prev.currentNode !== this.props.currentNode) {
      this.setState({ commentDraft: "" });
    }
  }

  _onCommentChange = (e: Object) => {
    this.setState({ commentDraft: e.target.value });
  };

  _commitComment = () => {
    let { onSetComment } = this.props;
    let draft = this.state.commentDraft.trim();
    if (onSetComment && draft) {
      onSetComment(draft);
    }
    this.setState({ commentDraft: "" });
  };

  // Right-click a node → select it and open its comment popover as a fixed box
  // near the cursor, kept within the viewport.
  _onNodeContextMenu = (e: Object, nodeId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!this.props.onSetComment) {
      return;
    }
    if (nodeId !== this.props.currentNode) {
      this.props.onSelectNode(nodeId);
    }
    let POP_W = 236;
    let POP_H = 150;
    let x = Math.min(e.clientX, window.innerWidth - POP_W - 8);
    let y = Math.min(e.clientY + 8, window.innerHeight - POP_H - 8);
    this.setState({
      commentPopover: {
        nodeId,
        x: Math.max(8, x),
        y: Math.max(8, y),
      },
    });
  };

  _closeCommentPopover = () => {
    this._commitComment();
    this.setState({ commentPopover: null });
  };

  _scrollToCurrent = () => {
    let el = this._scrollRef;
    if (!el) {
      return;
    }
    let placed = this._layout().placed;
    let cur = placed.find((p) => p.id === this.props.currentNode);
    if (!cur) {
      return;
    }
    let vertical = this.state.expanded;
    let x = vertical ? PAD + cur.row * COL : PAD + cur.col * COL;
    let y = vertical ? PAD + cur.col * ROW : PAD + cur.row * ROW;
    // Keep the current node roughly centered in view (both axes).
    el.scrollLeft = Math.max(0, x - el.clientWidth / 2);
    el.scrollTop = Math.max(0, y - el.clientHeight / 2);
  };

  _layout(): { placed: Array<Placed>, cols: number, rows: number } {
    return layoutTree(this.props.tree, this.props.boardSize);
  }

  _toggleExpanded = () => {
    // Reset position + size each time it opens.
    this.setState((s) => ({
      expanded: !s.expanded,
      dragX: 0,
      dragY: 0,
      winW: WIN_W,
      winH: WIN_H,
    }));
  };

  componentWillUnmount() {
    this._endDrag();
    this._endResize();
    this._endGraphResize();
    document.removeEventListener("mousedown", this._onDocMouseDown);
  }

  // Start dragging the expanded window from its header.
  _onDragStart = (e: Object) => {
    if (e.button !== 0) {
      return;
    }
    this._dragStart = {
      mx: e.clientX,
      my: e.clientY,
      x: this.state.dragX,
      y: this.state.dragY,
    };
    window.addEventListener("mousemove", this._onDragMove);
    window.addEventListener("mouseup", this._endDrag);
  };

  _onDragMove = (e: Object) => {
    if (!this._dragStart) {
      return;
    }
    this.setState({
      dragX: this._dragStart.x + (e.clientX - this._dragStart.mx),
      dragY: this._dragStart.y + (e.clientY - this._dragStart.my),
    });
  };

  _endDrag = () => {
    this._dragStart = null;
    window.removeEventListener("mousemove", this._onDragMove);
    window.removeEventListener("mouseup", this._endDrag);
  };

  // Start resizing from a bottom corner grip. "br" grows width to the right;
  // "bl" grows width to the left, which also shifts the window's left edge
  // (adjusts dragX) so the right edge stays put.
  _onResizeStart = (e: Object, corner: "bl" | "br") => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    this._resizeStart = {
      mx: e.clientX,
      my: e.clientY,
      w: this.state.winW,
      h: this.state.winH,
      x: this.state.dragX,
      corner,
    };
    window.addEventListener("mousemove", this._onResizeMove);
    window.addEventListener("mouseup", this._endResize);
  };

  _onResizeMove = (e: Object) => {
    let rs = this._resizeStart;
    if (!rs) {
      return;
    }
    let dx = e.clientX - rs.mx;
    let dy = e.clientY - rs.my;
    let h = Math.max(WIN_MIN_H, rs.h + dy);
    // The window is anchored to the right (`right: 32px`), so growing its width
    // naturally expands it LEFTWARD (right edge pinned).
    if (rs.corner === "br") {
      // Bottom-right: the right edge should move, left edge fixed. Counteract the
      // right-anchor by shifting the window right by the width it gained.
      let w = Math.max(WIN_MIN_W, rs.w + dx);
      let applied = w - rs.w;
      this.setState({ winW: w, winH: h, dragX: rs.x + applied });
    } else {
      // Bottom-left: the left edge moves, right edge fixed — which is exactly
      // what the right-anchor does when width grows. No dragX change needed.
      let w = Math.max(WIN_MIN_W, rs.w - dx);
      this.setState({ winW: w, winH: h });
    }
  };

  _endResize = () => {
    this._resizeStart = null;
    window.removeEventListener("mousemove", this._onResizeMove);
    window.removeEventListener("mouseup", this._endResize);
  };

  // Drag the divider between the move list and the comment area to rebalance
  // them. Dragging DOWN grows the graph and shrinks the comments.
  _onGraphResizeStart = (e: Object) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    let current =
      typeof this.state.inlineGraphH === "number"
        ? this.state.inlineGraphH
        : INLINE_GRAPH_H;
    this._graphResizeStart = { my: e.clientY, h: current };
    window.addEventListener("mousemove", this._onGraphResizeMove);
    window.addEventListener("mouseup", this._endGraphResize);
  };

  _onGraphResizeMove = (e: Object) => {
    let rs = this._graphResizeStart;
    if (!rs) {
      return;
    }
    let h = Math.max(INLINE_GRAPH_MIN_H, rs.h + (e.clientY - rs.my));
    this.setState({ inlineGraphH: h });
  };

  _endGraphResize = () => {
    this._graphResizeStart = null;
    window.removeEventListener("mousemove", this._onGraphResizeMove);
    window.removeEventListener("mouseup", this._endGraphResize);
  };

  _renderGraph() {
    let { currentNode, onSelectNode } = this.props;
    // Rotated 90°: moves flow TOP→BOTTOM. Depth (col) maps to the Y axis and
    // branches (row) map to the X axis.
    let vertical = this.state.expanded;
    let { placed, cols, rows } = this._layout();
    // px position of a node's top-left corner given its grid col/row.
    let px = (p) =>
      vertical
        ? { x: PAD + p.row * COL, y: PAD + p.col * ROW }
        : { x: PAD + p.col * COL, y: PAD + p.row * ROW };
    let width = vertical
      ? PAD * 2 + rows * COL - COL_GAP
      : PAD * 2 + cols * COL - COL_GAP;
    let height = vertical
      ? PAD * 2 + cols * ROW - ROW_GAP
      : PAD * 2 + rows * ROW - ROW_GAP;
    let byId = {};
    for (let p of placed) {
      byId[p.id] = p;
    }
    return (
      <div className="MoveTree-canvas" style={{ width, height }}>
        <svg
          className="MoveTree-links"
          width={width}
          height={height}
          viewBox={"0 0 " + width + " " + height}>
          {placed.map((p) => {
            if (p.parentId === null || p.parentId === undefined) {
              return null;
            }
            let parent = byId[p.parentId];
            if (!parent) {
              return null;
            }
            let a = px(parent);
            let b = px(p);
            let x1 = a.x + NODE / 2;
            let y1 = a.y + NODE / 2;
            let x2 = b.x + NODE / 2;
            let y2 = b.y + NODE / 2;
            return (
              <path
                key={"l" + p.id}
                className="MoveTree-link"
                d={linkPath(x1, y1, x2, y2, vertical)}
                fill="none"
              />
            );
          })}
        </svg>
        {placed.map((p) => {
          let cls =
            "MoveTree-node" +
            (p.color ? " MoveTree-node-" + p.color : " MoveTree-node-setup") +
            (p.id === currentNode ? " MoveTree-node-current" : "");
          let pos = px(p);
          // Hover indicator: the move number (depth from root) + coordinate,
          // e.g. "Move 8: H15". The root node (col 0) is the start of the game.
          let title = p.col === 0 ? "Start" : "Move " + p.col + ": " + p.label;
          return (
            <button
              type="button"
              key={p.id}
              className={cls}
              style={{
                left: pos.x,
                top: pos.y,
                width: NODE,
                height: NODE,
              }}
              title={title}
              onClick={() => onSelectNode(p.id)}
              onContextMenu={(e) => this._onNodeContextMenu(e, p.id)}>
              {p.label}
              {p.hasComment ? (
                <span className="MoveTree-node-comment-dot" />
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  _renderCommentPopover() {
    let pop = this.state.commentPopover;
    if (!pop || !this.props.onSetComment) {
      return null;
    }
    return (
      <div
        className="MoveTree-comment-popover"
        style={{ left: pop.x, top: pop.y }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}>
        <textarea
          className="MoveTree-comment-input"
          placeholder="Add a comment on this move…"
          autoFocus
          value={this.state.commentDraft}
          onChange={this._onCommentChange}
        />
        <div className="MoveTree-comment-actions">
          <button
            type="button"
            className="MoveTree-comment-save"
            onClick={this._closeCommentPopover}>
            Save
          </button>
        </div>
      </div>
    );
  }

  _onCommentBarKeyDown = (e: Object) => {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this._commitComment();
    }
  };

  // Comment editor pinned to the bottom of the expanded window: adds a comment
  // on the currently selected move. Only shown for demo editors (onSetComment).
  // `inline` = the non-detached tree in the sidebar; it omits the drag grip and
  // uses a small capped comment strip (the slot is short). The detached window
  // passes inline=false and gets the drag-to-resize strip.
  _renderCommentBar(inline: boolean) {
    let canWrite = !!this.props.onSetComment;
    // Editors get the input + comments; viewers (showComments) get comments only.
    if (!canWrite && !this.props.showComments) {
      return null;
    }
    return (
      <div
        className={
          "MoveTree-comment-bar" +
          (inline ? " MoveTree-comment-bar-inline" : "") +
          (canWrite ? "" : " MoveTree-comment-bar-readonly")
        }>
        <div className="MoveTree-comment-field">
          {canWrite ? (
            <div className="MoveTree-comment-bar-row">
              <textarea
                className="MoveTree-comment-bar-input"
                placeholder="Comment on this move…"
                rows={1}
                value={this.state.commentDraft}
                onChange={this._onCommentChange}
                onKeyDown={this._onCommentBarKeyDown}
              />
              <button
                type="button"
                className="MoveTree-comment-bar-send"
                title="Add comment"
                disabled={!this.state.commentDraft.trim()}
                onClick={this._commitComment}>
                <Icon name="paper-plane" size={14} />
              </button>
            </div>
          ) : null}
          {this.props.comment ? (
            <div className="MoveTree-comment-bar-existing">
              {this.props.comment.split("\n").map((line, i) => {
                // Lines come as "name: message" — show the message first, then
                // the author name after it (smaller, softer).
                let m = line.match(/^(.{1,40}?):\s*([\s\S]+)$/);
                return (
                  <div className="MoveTree-comment-line" key={i}>
                    <span className="MoveTree-comment-line-text">
                      {m ? m[2] : line}
                    </span>
                    {m ? (
                      <span className="MoveTree-comment-line-author">
                        {m[1]}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  render() {
    let { expanded, dragX, dragY, winW, winH } = this.state;
    if (expanded) {
      // A floating, draggable, resizable window — no dimming overlay, so the
      // board behind stays visible and interactive. Custom bottom-left and
      // bottom-right grips (CSS resize only offers bottom-right). Rendered via a
      // portal to <body> so it escapes the game screen's stacking context and
      // sits above the left game-list rail.
      return ReactDOM.createPortal(
        <>
          <div
            className="MoveTree-window"
            style={{
              width: winW,
              height: winH,
              transform: "translate(" + dragX + "px, " + dragY + "px)",
            }}>
            <div
              className="MoveTree-window-header"
              onMouseDown={this._onDragStart}>
              <span className="MoveTree-window-title">Move Tree</span>
              {this.props.onSyncToActive &&
              this.props.currentNode !== this.props.tree.activeNode ? (
                <button
                  type="button"
                  className="MoveTree-sync-btn MoveTree-sync-btn-window"
                  title="Sync to presenter's current move"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={this.props.onSyncToActive}>
                  <Icon name="fast-forward" size={13} /> Sync
                </button>
              ) : null}
              <button
                type="button"
                className="MoveTree-window-close"
                title="Close"
                onClick={this._toggleExpanded}>
                <Icon name="circle-x" size={18} />
              </button>
            </div>
            <div
              className="MoveTree MoveTree-in-window"
              ref={(r) => (this._scrollRef = r)}
              style={
                (this.props.onSetComment || this.props.showComments) &&
                typeof this.state.inlineGraphH === "number"
                  ? { flex: "0 0 auto", height: this.state.inlineGraphH }
                  : undefined
              }>
              {this._renderGraph()}
            </div>
            {this.props.onSetComment || this.props.showComments ? (
              <div
                className="MoveTree-graph-divider"
                title="Drag to resize"
                onMouseDown={this._onGraphResizeStart}>
                <span className="MoveTree-graph-divider-grip" />
              </div>
            ) : null}
            {this._renderCommentBar(false)}
            <div
              className="MoveTree-resize MoveTree-resize-bl"
              onMouseDown={(e) => this._onResizeStart(e, "bl")}
            />
            <div
              className="MoveTree-resize MoveTree-resize-br"
              onMouseDown={(e) => this._onResizeStart(e, "br")}
            />
          </div>
          {this._renderCommentPopover()}
        </>,
        document.body
      );
    }
    let hasCommentBar = !!this.props.onSetComment || !!this.props.showComments;
    return (
      <div
        className={
          "MoveTree-wrap" +
          (hasCommentBar ? " MoveTree-wrap-with-comments" : "")
        }>
        <button
          type="button"
          className="MoveTree-expand-btn"
          title="Expand move tree"
          onClick={this._toggleExpanded}>
          <Icon name="expand" size={13} />
        </button>
        <div
          className="MoveTree MoveTree-inline-graph"
          ref={(r) => (this._scrollRef = r)}
          style={
            hasCommentBar && typeof this.state.inlineGraphH === "number"
              ? { height: this.state.inlineGraphH, maxHeight: "none" }
              : undefined
          }>
          {this._renderGraph()}
        </div>
        {hasCommentBar ? (
          <div
            className="MoveTree-graph-divider"
            title="Drag to resize"
            onMouseDown={this._onGraphResizeStart}>
            <span className="MoveTree-graph-divider-grip" />
          </div>
        ) : null}
        {this._renderCommentBar(true)}
        {this._renderCommentPopover()}
      </div>
    );
  }
}
