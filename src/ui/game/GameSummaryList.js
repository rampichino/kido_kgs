// @flow
import React, { PureComponent as Component } from "react";
import { A, Icon } from "../common";
import GameTypeIcon from "./GameTypeIcon";
import GamePlayersList from "./GamePlayersList";
import { formatGameScore, getWinningColor } from "../../model/game";
import { formatLocaleDate } from "../../util/date";
import type { GameSummary, Index, User } from "../../model";

const MAX_TAG_LEN = 50;

type TagEditorProps = {
  tag: ?string,
  onSave: (string) => any,
  onClose: () => any,
};

type TagEditorState = {
  value: string,
};

// Inline popover for setting/clearing a game's personal tag. Rendered inside
// the row's <a>, so all interactions stop propagation to avoid navigating.
class GameTagEditor extends Component<TagEditorProps, TagEditorState> {
  _input: ?HTMLInputElement;

  state = {
    value: this.props.tag || "",
  };

  componentDidMount() {
    let input = this._input;
    if (input) {
      input.focus();
      input.select();
    }
  }

  render() {
    return (
      <span
        className="GameSummaryList-tag-editor"
        onClick={this._stop}
        role="presentation">
        <input
          ref={this._setInput}
          className="GameSummaryList-tag-input"
          type="text"
          maxLength={MAX_TAG_LEN}
          placeholder="Add a tag"
          value={this.state.value}
          onChange={this._onChange}
          onKeyDown={this._onKeyDown}
        />
        <button
          type="button"
          className="GameSummaryList-tag-save"
          title="Save tag"
          onClick={this._onSave}>
          <Icon name="check" size={14} />
        </button>
        {this.props.tag ? (
          <button
            type="button"
            className="GameSummaryList-tag-clear"
            title="Remove tag"
            onClick={this._onClear}>
            <Icon name="circle-x" size={14} />
          </button>
        ) : null}
      </span>
    );
  }

  _setInput = (el: ?HTMLInputElement) => {
    this._input = el;
  };

  _stop = (e: Event) => {
    e.stopPropagation();
  };

  _onChange = (e: Object) => {
    this.setState({ value: e.target.value });
  };

  _onKeyDown = (e: Object) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      this._onSave(e);
    } else if (e.key === "Escape") {
      this.props.onClose();
    }
  };

  _onSave = (e: Event) => {
    e.stopPropagation();
    this.props.onSave(this.state.value.trim());
    this.props.onClose();
  };

  _onClear = (e: Event) => {
    e.stopPropagation();
    this.props.onSave("");
    this.props.onClose();
  };
}

type Props = {
  game: GameSummary,
  player?: string,
  selfAsYou?: boolean,
  usersByName?: Index<User>,
  onSelect: (GameSummary) => any,
  onSelectUser?: (string) => any,
  onPlayerHover?: (string) => any,
  onPlayerHoverEnd?: (string) => any,
  onEditTag?: (timestamp: string, text: string) => any,
};

type ItemState = {
  editingTag: boolean,
};

class GameSummaryListItem extends Component<Props, ItemState> {
  state = {
    editingTag: false,
  };

  render() {
    let {
      game,
      player,
      selfAsYou,
      usersByName,
      onSelectUser,
      onPlayerHover,
      onPlayerHoverEnd,
    } = this.props;
    let type = game.type;
    let winningColor = getWinningColor(game.score);
    let winningPlayer = winningColor && game.players[winningColor];
    let won = winningPlayer && winningPlayer.name === player;
    let className =
      "GameSummaryList-item" +
      (onSelectUser ? " GameSummaryList-item-buttononly" : "") +
      (won
        ? " GameSummaryList-item-won"
        : player && winningColor
          ? " GameSummaryList-item-lost"
          : "");
    let playingNow = game.inPlay && !winningColor;
    let loadLabel = playingNow
      ? game.type === "review"
        ? "Open"
        : "Watch"
      : "Load Game";
    return (
      <A
        className={className}
        onClick={this._onSelect}
        onMouseEnter={this._onCardMouseEnter}
        onMouseLeave={this._onCardMouseLeave}
        onMouseMove={this._onCardMouseMove}>
        {onSelectUser ? (
          <span
            className="GameList-item-play-cursor"
            ref={this._setPillEl}
            aria-hidden="true">
            {loadLabel}
          </span>
        ) : null}
        <div className="GameSummaryList-item-players">
          {type === "demonstration" ? (
            <span
              className="GameSummaryList-item-demo-icon"
              title="Demonstration">
              <Icon name="presentation" size={15} />
            </span>
          ) : null}
          <GamePlayersList
            players={game.players}
            winner={winningColor}
            self={player}
            selfAsYou={selfAsYou && type !== "demonstration"}
            usersByName={usersByName}
            hideSelfish
            hideExtraIcons
            showVs
            onSelectUser={onSelectUser}
            onPlayerHover={onPlayerHover}
            onPlayerHoverEnd={onPlayerHoverEnd}
          />
        </div>
        <div className="GameSummaryList-item-info">
          <div className="GameSummaryList-item-badges">
            {this._renderTag()}
            <div
              className={
                "GameSummaryList-item-type" +
                // Tagged so lists can drop the rated marker (it's the norm)
                // without also losing free/demo/review.
                (type === "ranked" && !game.private
                  ? " GameSummaryList-item-type-rated"
                  : "")
              }>
              <GameTypeIcon type={type} isPrivate={game.private} />
            </div>
            {game.rules && game.rules.handicap ? (
              <span
                className="GameSummaryList-item-handicap-icon"
                title={"Handicap " + game.rules.handicap}>
                H
              </span>
            ) : null}
            {game.rules && game.rules.size && game.rules.size !== 19 ? (
              <span
                className="GameSummaryList-item-size"
                title={"Board " + game.rules.size + "×" + game.rules.size}>
                {game.rules.size}×{game.rules.size}
              </span>
            ) : null}
          </div>
          {playingNow ? (
            <div className="GameSummaryList-item-date-now">
              {game.type === "review" ? "Reviewing" : "Playing now"}
            </div>
          ) : (
            <div className="GameSummaryList-item-outcome">
              {game.score && !(type === "demonstration" && !winningColor) ? (
                <div
                  className={
                    "GameSummaryList-item-result" +
                    (won
                      ? " GameSummaryList-item-result-won"
                      : player && winningColor
                        ? " GameSummaryList-item-result-lost"
                        : "")
                  }>
                  {/* Mobile-only copy of the type icon, so it can sit on the
                      result's own line (the badges copy lives outside the
                      result/date column and gets pushed away by the date's
                      width). Hidden by default — see _user.scss. Rated is the
                      norm, so only the free marker is worth the space. */}
                  {type === "ranked" ? null : (
                    <span className="GameSummaryList-item-type-inline">
                      <GameTypeIcon type={type} isPrivate={game.private} />
                    </span>
                  )}
                  {won || (player && winningColor) ? (
                    <span className="GameSummaryList-item-result-dot" />
                  ) : null}
                  {formatGameScore(game.score)}
                </div>
              ) : null}
              <div className="GameSummaryList-item-date">
                {formatLocaleDate(game.timestamp)}
              </div>
            </div>
          )}
          {onSelectUser ? (
            <span
              className="GameSummaryList-item-load"
              onClick={this._onLoad}
              role="button">
              {playingNow
                ? game.type === "review"
                  ? "Open"
                  : "Watch"
                : "Load Game"}
            </span>
          ) : null}
        </div>
      </A>
    );
  }

  _renderTag() {
    let { game, onEditTag } = this.props;
    if (this.state.editingTag) {
      return (
        <GameTagEditor
          tag={game.tag}
          onSave={this._onSaveTag}
          onClose={this._onCloseTag}
        />
      );
    }
    if (game.tag) {
      return (
        <span
          className={
            "GameSummaryList-item-tag" +
            (onEditTag ? " GameSummaryList-item-tag-editable" : "")
          }
          title={onEditTag ? "Edit tag" : "Tag: " + game.tag}
          onClick={onEditTag ? this._onStartEditTag : undefined}
          role={onEditTag ? "button" : undefined}>
          <Icon name="tag" size={11} />
          {game.tag}
        </span>
      );
    }
    if (onEditTag) {
      return (
        <span
          className="GameSummaryList-item-tag GameSummaryList-item-tag-add"
          title="Add a tag"
          onClick={this._onStartEditTag}
          role="button">
          <Icon name="tag" size={11} />
          Tag
        </span>
      );
    }
    return null;
  }

  _onStartEditTag = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    this.setState({ editingTag: true });
  };

  _onCloseTag = () => {
    this.setState({ editingTag: false });
  };

  _onSaveTag = (text: string) => {
    if (this.props.onEditTag) {
      this.props.onEditTag(this.props.game.timestamp, text);
    }
  };

  _onSelect = () => {
    // The whole card loads/opens the game; the username keeps its own handler.
    this.props.onSelect(this.props.game);
  };

  _onLoad = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    this.props.onSelect(this.props.game);
  };

  // Cursor-following "Load Game" pill (desktop only; hidden on touch / mobile
  // via CSS), mirroring the challenge / live-game pills.
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
}

type GameSummaryListProps = {
  games: Array<GameSummary>,
  player?: string,
  selfAsYou?: boolean,
  usersByName?: Index<User>,
  onSelect: (GameSummary) => any,
  onSelectUser?: (string) => any,
  onPlayerHover?: (string) => any,
  onPlayerHoverEnd?: (string) => any,
  onEditTag?: (timestamp: string, text: string) => any,
};

type State = {
  fullRender: boolean,
};

export default class GameSummaryList extends Component<
  GameSummaryListProps,
  State,
> {
  state = {
    fullRender: false,
  };

  componentDidMount() {
    this._deferFullRender();
  }

  componentDidUpdate() {
    this._deferFullRender();
  }

  _deferFullRender() {
    if (!this.state.fullRender && this.props.games.length > 15) {
      setTimeout(() => {
        this.setState({ fullRender: true });
      }, 0);
    }
  }

  render() {
    let {
      games,
      player,
      selfAsYou,
      usersByName,
      onSelect,
      onSelectUser,
      onPlayerHover,
      onPlayerHoverEnd,
      onEditTag,
    } = this.props;
    let { fullRender } = this.state;
    if (!fullRender) {
      games = games.slice(0, 15);
    }
    return (
      <div className="GameSummaryList">
        {games.map((game) => (
          <GameSummaryListItem
            key={game.timestamp}
            game={game}
            player={player}
            selfAsYou={selfAsYou}
            usersByName={usersByName}
            onSelect={onSelect}
            onSelectUser={onSelectUser}
            onPlayerHover={onPlayerHover}
            onPlayerHoverEnd={onPlayerHoverEnd}
            onEditTag={onEditTag}
          />
        ))}
      </div>
    );
  }
}
