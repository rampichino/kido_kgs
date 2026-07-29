// @flow
import React, { PureComponent as Component } from "react";
import { Icon } from "../common";
import { loadCollapsed, saveCollapsed } from "../../util/filterPrefs";
import type {
  GameChannel,
  GameFilter,
  Index,
  Room,
  ChannelMembership,
} from "../../model";

type Props = {
  games: Array<GameChannel>,
  roomsById: Index<Room>,
  channelMembership: ChannelMembership,
  filter: GameFilter,
  onChange: (GameFilter) => any,
};

type State = {
  open: boolean,
};

const SPEED_OPTIONS = [
  { speed: "very fast", icon: "bolt", label: "Very fast", double: true },
  { speed: "fast", icon: "bolt", label: "Fast", double: false },
  // "clock" matches the fallback the game list's time pill uses for normal
  // speed (GameTimeSystem) — the filter should show the icon it filters on.
  { speed: "normal", icon: "clock", label: "Normal", double: false },
  { speed: "slow", icon: "snail", label: "Slow", double: false },
];

const RANK_OPTIONS = [
  { tier: "dan", label: "Dan", className: "rank-dan" },
  { tier: "sdk", label: "SDK", className: "rank-sdk" },
  { tier: "ddk", label: "DDK", className: "rank-ddk" },
];

// Live-games category filter. Each key maps to one or more KGS game types
// (see GameType in types.js). "simulrengo" also covers two-headed boards
// detected via white_2/black_2 — matched in GameList.js.
const CATEGORY_OPTIONS = [
  { key: "revteach", label: "Rev/Teach" },
  { key: "simulrengo", label: "Sim/Rengo" },
];

// None selected means all sizes are shown. The chip renders as "19" + a
// smaller "×19" — the suffix shrinks further on mobile, where four full-size
// labels would overflow the row.
const SIZE_OPTIONS = [
  { size: 19, label: "19×19" },
  { size: 17, label: "17×17" },
  { size: 13, label: "13×13" },
  { size: 9, label: "9×9" },
];

export default class GameListFilter extends Component<Props, State> {
  state = { open: false };

  _ref: any;

  componentDidMount() {
    document.addEventListener("click", this._onDocumentClick);
  }

  componentWillUnmount() {
    document.removeEventListener("click", this._onDocumentClick);
  }

  _onDocumentClick = (e: Object) => {
    if (this.state.open && this._ref && !this._ref.contains(e.target)) {
      this.setState({ open: false });
    }
  };

  render() {
    let { games, roomsById, filter, channelMembership } = this.props;
    let { open } = this.state;
    let isChallenge = games[0] && games[0].type === "challenge";

    let gameRoomsById = {};
    for (let g of games) {
      if (g.roomId) {
        if (
          channelMembership[g.roomId] &&
          channelMembership[g.roomId].type === "room"
        ) {
          if (!gameRoomsById[g.roomId]) {
            gameRoomsById[g.roomId] = {
              id: g.roomId,
              name: roomsById[g.roomId] && roomsById[g.roomId].name,
              count: 1,
            };
          } else {
            gameRoomsById[g.roomId].count++;
          }
        }
      }
    }
    let rooms = Object.keys(gameRoomsById)
      .map((id) => gameRoomsById[id])
      .filter((g) => g.name);
    rooms.sort((a, b) => b.count - a.count);

    // If a room is currently filtered but has no games right now, it won't be
    // in the games-derived list above — add it so the dropdown reflects the
    // active filter instead of misleadingly showing "All" while still
    // excluding everything.
    if (
      filter.roomId &&
      !gameRoomsById[filter.roomId] &&
      roomsById[filter.roomId] &&
      roomsById[filter.roomId].name
    ) {
      rooms.push({
        id: filter.roomId,
        name: roomsById[filter.roomId].name,
        count: 0,
      });
    }

    let gameTypeLabel = isChallenge ? "Challenges" : "Games";
    let allLabel = isChallenge ? "All Challenges" : `All ${gameTypeLabel}`;
    let selected = filter.roomId
      ? rooms.find((r) => r.id === filter.roomId)
      : null;
    let triggerLabel = selected ? selected.name : allLabel;

    return (
      <div
        className={"GameListFilter-room" + (filter.roomId ? " is-active" : "")}
        ref={(el) => {
          this._ref = el;
        }}>
        <button
          type="button"
          className={"GameListFilter-room-trigger" + (open ? " is-open" : "")}
          onClick={this._onToggle}>
          <span className="GameListFilter-room-trigger-label">
            {triggerLabel}
          </span>
          {filter.roomId ? (
            <span
              className="GameListFilter-room-clear"
              title="Clear room filter"
              onClick={this._onClear}>
              <Icon name="circle-x" size={16} />
            </span>
          ) : (
            <Icon name={open ? "chevron-up" : "chevron-down"} size={16} />
          )}
        </button>
        {open ? (
          <div className="GameListFilter-room-menu">
            <button
              type="button"
              className={
                "GameListFilter-room-option" +
                (filter.roomId ? "" : " is-selected")
              }
              onClick={() => this._onSelectRoom(null)}>
              {allLabel}
            </button>
            {rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                className={
                  "GameListFilter-room-option" +
                  (filter.roomId === room.id ? " is-selected" : "")
                }
                onClick={() => this._onSelectRoom(room.id)}>
                <span className="GameListFilter-room-option-name">
                  {room.name}
                </span>
                {room.count > 0 ? (
                  <span className="GameListFilter-room-option-count">
                    {room.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  _onToggle = () => {
    this.setState((s) => ({ open: !s.open }));
  };

  _onClear = (e: SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
    this._onSelectRoom(null);
  };

  _onSelectRoom = (roomId: ?number) => {
    let { games } = this.props;
    let type = games[0] && games[0].type === "challenge" ? "challenge" : "game";
    this.setState({ open: false });
    this.props.onChange({ ...this.props.filter, type, roomId: roomId || null });
  };
}

// The inline filter toolbar (Hide bots / TYPE / SPEED / RANK), rendered in its
// own header row below the title. Replaces the old gear/sliders popover.
type ToolbarProps = {
  games: Array<GameChannel>,
  filter: GameFilter,
  onChange: (GameFilter) => any,
  // Speed has data only for challenges (full proposal rules). The live-games
  // list summary has no time control, so the Watch screen leaves this off.
  showSpeed?: boolean,
  // The Rev/Teach / Simul / Rengo category filter only applies to the live
  // games list (challenges are always plain games).
  showCategory?: boolean,
  // Render the "Hide bots" toggle as a filter group inside the bar (so it
  // collapses with the rest). The sub-bars no longer carry it.
  showBots?: boolean,
};

type ToolbarState = {
  collapsed: boolean,
};

// The "Hide bots" switch. In the filter bar it renders as a plain group (no
// pill); in the sub-bars / My Games it keeps the light pill so it matches the
// Sort control next to it.
export function renderBotsToggle(
  checked: boolean,
  onChange: (boolean) => any,
  opts?: { inBar?: boolean }
) {
  let className =
    "GameFilterBar-bots" + (opts && opts.inBar ? "" : " GameSubBar-bots");
  return (
    <label className={className}>
      <span className="ToggleSwitch-control">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e: Object) => onChange(!!e.target.checked)}
        />
        <span className="ToggleSwitch-slider" />
      </span>
      <span className="GameFilterBar-bots-label">Hide bots</span>
    </label>
  );
}

// On phones the filter row is bulky, so default it to collapsed there (until the
// user explicitly expands it, which is then remembered). Desktop stays expanded.
function filtersDefaultCollapsed(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(max-width: 736px)").matches
  );
}

export class GameListFilterBar extends Component<ToolbarProps, ToolbarState> {
  state = { collapsed: loadCollapsed(filtersDefaultCollapsed()) };

  render() {
    let { filter, showSpeed, showCategory, showBots } = this.props;
    let { collapsed } = this.state;
    let sizes = filter.boardSizes || [];
    let hasActiveFilter = !!(
      (sizes && sizes.length) ||
      (filter.gameRatings && filter.gameRatings.length) ||
      (showSpeed && filter.timeSpeeds && filter.timeSpeeds.length) ||
      (filter.playerRanks && filter.playerRanks.length) ||
      (showCategory && filter.category)
    );

    let toggle = (
      <button
        type="button"
        className={
          "GameFilterBar-toggle" +
          (collapsed ? " is-collapsed" : "") +
          (hasActiveFilter ? " has-active" : "")
        }
        title={collapsed ? "Show filters" : "Hide filters"}
        onClick={this._onToggleCollapsed}>
        <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={16} />
        {collapsed ? (
          <span className="GameFilterBar-toggle-label">
            {hasActiveFilter ? "Filters On" : "Filters"}
          </span>
        ) : null}
      </button>
    );

    if (collapsed) {
      return (
        <div
          className="GameFilterBar GameFilterBar-collapsed"
          onClick={this._onRowClick}>
          {toggle}
        </div>
      );
    }

    return (
      <div className="GameFilterBar" onClick={this._onRowClick}>
        {/* Open state: the heading itself is the (pill) toggle, so there's no
            loose chevron floating next to the first filter row. */}
        <button
          type="button"
          className="GameFilterBar-heading GameFilterBar-heading-btn"
          title="Hide filters"
          onClick={this._onToggleCollapsed}>
          Filters
        </button>
        <div className="GameFilterBar-group">
          <span className="GameFilterBar-label">Size</span>
          {SIZE_OPTIONS.map(({ size, label }) => (
            <button
              key={size}
              type="button"
              className={
                "GameListFilter-type-btn GameListFilter-size-btn" +
                (sizes.includes(size) ? " active" : "")
              }
              title={label}
              onClick={() => this._onToggleSize(size)}>
              <span className="GameListFilter-size-num">{size}</span>
              <span className="GameListFilter-size-suffix">×{size}</span>
            </button>
          ))}
        </div>

        <div className="GameFilterBar-group">
          <span className="GameFilterBar-label">Rated</span>
          {["ranked", "free"].map((r) => (
            <button
              key={r}
              type="button"
              className={
                "GameListFilter-type-btn GameListFilter-rating-btn" +
                (filter.gameRatings && filter.gameRatings.includes(r)
                  ? " active"
                  : "")
              }
              title={r === "ranked" ? "Rated" : "Free"}
              onClick={() => this._onSelectRating(r)}>
              <Icon name={r === "ranked" ? "shield" : "coffee"} size={15} />
            </button>
          ))}
        </div>

        {showSpeed ? (
          <div className="GameFilterBar-group">
            <span className="GameFilterBar-label">Speed</span>
            {SPEED_OPTIONS.map(({ speed, icon, label, double }) => (
              <button
                key={speed}
                type="button"
                className={
                  "GameListFilter-speed-btn" +
                  (double ? " GameListFilter-speed-btn-double" : "") +
                  (filter.timeSpeeds && filter.timeSpeeds.includes(speed)
                    ? " active"
                    : "")
                }
                title={label}
                onClick={() => this._onSelectSpeed(speed)}>
                <Icon name={icon} size={15} />
                {double ? <Icon name={icon} size={15} /> : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className="GameFilterBar-group">
          <span className="GameFilterBar-label">Rank</span>
          {RANK_OPTIONS.map(({ tier, label, className }) => (
            <button
              key={tier}
              type="button"
              className={
                "GameListFilter-type-btn " +
                className +
                (filter.playerRanks && filter.playerRanks.includes(tier)
                  ? " active"
                  : "")
              }
              onClick={() => this._onSelectRank(tier)}>
              {label}
            </button>
          ))}
        </div>

        {showCategory ? (
          <div className="GameFilterBar-group">
            <span className="GameFilterBar-label">Type</span>
            {CATEGORY_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={
                  "GameListFilter-type-btn" +
                  (filter.category === key ? " active" : "")
                }
                onClick={() => this._onSelectCategory((key: any))}>
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {showBots ? (
          <div className="GameFilterBar-group GameFilterBar-group--bots">
            {renderBotsToggle(!!filter.excludeBots, this._onChangeBots, {
              inBar: true,
            })}
          </div>
        ) : null}

        {hasActiveFilter ? (
          <button
            type="button"
            className="GameFilterBar-clear"
            title="Clear filters"
            onClick={this._onClear}>
            <Icon name="circle-x" size={19} />
          </button>
        ) : null}
      </div>
    );
  }

  _onToggleCollapsed = () => {
    this.setState((s) => {
      const collapsed = !s.collapsed;
      saveCollapsed(collapsed);
      return { collapsed };
    });
  };

  // Clicking the empty row area (labels, gutters — anything that isn't an
  // interactive control) collapses the filter row. The toggle chevron is a
  // button, so it falls through to its own handler.
  _onRowClick = (e: SyntheticMouseEvent<HTMLElement>) => {
    if ((e.target: any).closest("button, input, a, select, label")) {
      return;
    }
    this._onToggleCollapsed();
  };

  _getType = () => {
    let { games, filter } = this.props;
    return (
      filter.type ||
      (games[0] && games[0].type === "challenge" ? "challenge" : "game")
    );
  };

  _onClear = () => {
    this.props.onChange({
      ...this.props.filter,
      type: this._getType(),
      boardSizes: [],
      gameRatings: [],
      timeSpeeds: [],
      playerRanks: [],
      category: null,
    });
  };

  _onChangeBots = (checked: boolean) => {
    this.props.onChange({
      ...this.props.filter,
      type: this._getType(),
      excludeBots: checked,
    });
  };

  _onToggleSize = (size: number) => {
    const current = this.props.filter.boardSizes || [];
    const next = current.includes(size)
      ? current.filter((x) => x !== size)
      : [...current, size];
    this.props.onChange({
      ...this.props.filter,
      type: this._getType(),
      boardSizes: next,
    });
  };

  _onSelectRating = (r: string) => {
    const current = this.props.filter.gameRatings || [];
    const next = current.includes(r)
      ? current.filter((x) => x !== r)
      : [...current, r];
    this.props.onChange({
      ...this.props.filter,
      type: this._getType(),
      gameRatings: next,
    });
  };

  _onSelectSpeed = (speed: string) => {
    const current = this.props.filter.timeSpeeds || [];
    const next = current.includes(speed)
      ? current.filter((x) => x !== speed)
      : [...current, speed];
    this.props.onChange({
      ...this.props.filter,
      type: this._getType(),
      timeSpeeds: next,
    });
  };

  _onSelectRank = (tier: string) => {
    const current = this.props.filter.playerRanks || [];
    const next = current.includes(tier)
      ? current.filter((x) => x !== tier)
      : [...current, tier];
    this.props.onChange({
      ...this.props.filter,
      type: this._getType(),
      playerRanks: next,
    });
  };

  _onSelectCategory = (key: "revteach" | "simulrengo") => {
    const next = this.props.filter.category === key ? null : key;
    this.props.onChange({
      ...this.props.filter,
      type: this._getType(),
      category: next,
    });
  };
}

// Sub-header: Hide-bots toggle + sort control.
type SubBarProps = {
  sort: "top" | "watched" | "moves",
  onSortChange: ("top" | "watched" | "moves") => any,
  filter: GameFilter,
  onChange: (GameFilter) => any,
};

const SORT_OPTIONS = [
  { key: "top", label: "Top games", mobileLabel: "Ranks" },
  { key: "watched", label: "Most watched", mobileLabel: "Viewers" },
  { key: "moves", label: "Most moves", mobileLabel: "Moves" },
];

export class GameListSubBar extends Component<SubBarProps> {
  render() {
    let { sort, filter } = this.props;
    return (
      <div className="GameSubBar">
        <div className="GameSubBar-controls">
          <div className="GameSubBar-left">
            {renderBotsToggle(!!filter.excludeBots, this._onChangeBots)}
          </div>
          <div className="GameSubBar-sort">
            <span className="GameSubBar-sort-label">Sort</span>
            {SORT_OPTIONS.map(({ key, label, mobileLabel }) => (
              <button
                key={key}
                type="button"
                data-mobile-label={mobileLabel}
                className={
                  "GameSubBar-sort-btn" + (sort === key ? " active" : "")
                }
                onClick={() => this.props.onSortChange((key: any))}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  _onChangeBots = (checked: boolean) => {
    this.props.onChange({
      ...this.props.filter,
      excludeBots: checked,
    });
  };
}

// Challenge-list sub-bar: the "Hide bots" toggle + sort control.
export type ChallengeSort = "newest" | "stronger" | "weaker";

type SizeSubBarProps = {
  filter: GameFilter,
  onChange: (GameFilter) => any,
  sort: ChallengeSort,
  onSortChange: (ChallengeSort) => any,
};

const CHALLENGE_SORT_OPTIONS: Array<{ key: ChallengeSort, label: string }> = [
  { key: "newest", label: "Newest" },
  { key: "stronger", label: "Stronger" },
  { key: "weaker", label: "Weaker" },
];

export class GameSizeSubBar extends Component<SizeSubBarProps> {
  render() {
    let { sort, filter } = this.props;
    return (
      <div className="GameSubBar">
        <div className="GameSubBar-controls">
          <div className="GameSubBar-left">
            {renderBotsToggle(!!filter.excludeBots, this._onChangeBots)}
          </div>
          <div className="GameSubBar-sort">
            <span className="GameSubBar-sort-label">Sort</span>
            {CHALLENGE_SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={
                  "GameSubBar-sort-btn" + (sort === key ? " active" : "")
                }
                onClick={() => this.props.onSortChange(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  _onChangeBots = (checked: boolean) => {
    this.props.onChange({
      ...this.props.filter,
      type: "challenge",
      excludeBots: checked,
    });
  };
}
