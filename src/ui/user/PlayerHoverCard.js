// @flow
import React, { PureComponent as Component } from "react";
import ReactDOM from "react-dom";
import localeString from "locale-string";
import UserAvatar from "./UserAvatar";
import UserIcons from "./UserIcons";
import { Icon } from "../common/Icon";
import { isBot } from "../../util/bot";
import { getUserStatusText, getUserStatusKind } from "../../model/user";
import { timeAgo } from "../../util/date";
import { isTouchDevice } from "../../util/dom";
import { AppActions } from "../../model";
import type { User } from "../../model";

type Props = {
  // The wrapped name element (rendered inline, triggers the card on hover).
  children: any,
  user: ?User,
  onHover?: (string) => any,
  onHoverEnd?: (string) => any,
  // Hover dwell before the card shows. Defaults to a snappy value for static
  // lists; chat passes a longer delay so grazing message authors won't fire it.
  showDelay?: number,
};

type FriendOverride = {
  isBuddy?: boolean,
  isFan?: boolean,
  isCensored?: boolean,
};

type State = {
  visible: boolean,
  x: number,
  y: number,
  // Optimistic friend/fan/censor overrides keyed by user name. FRIEND_ADD/REMOVE
  // round-trips to the server asynchronously, and the card isn't subscribed to
  // the store, so we patch the displayed state locally on click and let the
  // server confirm. Keyed by name so it survives the card showing for one user,
  // hiding, then re-showing for another.
  friendOverride: { [name: string]: FriendOverride },
};

const DEFAULT_SHOW_DELAY = 250;
// Grace period after the mouse leaves the name before the card hides, so the
// pointer can travel down into the card to click the action buttons.
const HIDE_DELAY = 160;

function getRankTier(rank: string): string {
  if (!rank || rank === "-" || rank === "?" || rank === "NR") {
    return "ddk";
  }
  const r = rank.replace(/\?$/, "");
  if (/p$/i.test(r)) {
    return "pro";
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

export default class PlayerHoverCard extends Component<Props, State> {
  state: State = { visible: false, x: 0, y: 0, friendOverride: {} };
  _showTimer: ?TimeoutID = null;
  _hideTimer: ?TimeoutID = null;

  componentWillUnmount() {
    if (this._showTimer) {
      clearTimeout(this._showTimer);
    }
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
    }
  }

  _clearHideTimer() {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
  }

  // Pointer entered the card itself — cancel the pending hide so the buttons
  // stay clickable.
  _onCardEnter = () => {
    this._clearHideTimer();
  };

  _onCardLeave = () => {
    this.setState({ visible: false });
  };

  // The card is portalled to document.body, but React propagates synthetic
  // events up the React tree — i.e. into the trigger span and the list-item
  // around it. Without this, clicking an action (e.g. Message) also fires the
  // list item's own click, which opens the profile modal. Stop the click here
  // so card interactions never leak to the wrapping element.
  _onCardClick = (e: SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
  };

  _onFriendToggle = (
    friendType: "buddy" | "fan" | "censored",
    active: boolean
  ) => {
    const { user } = this.props;
    const actions = AppActions.instance;
    if (!user || !actions) {
      return;
    }
    if (active) {
      actions.onFriendRemove(user.name, friendType);
    } else {
      actions.onFriendAdd(user.name, friendType);
    }
    // Reflect the change immediately. The server round-trip is async and the
    // card isn't store-subscribed, so patch the displayed state optimistically.
    // buddy/fan/censored are fully independent on KGS, so each toggle only
    // touches its own flag.
    const name = user.name;
    this.setState((s) => {
      const prev = s.friendOverride[name] || {};
      let patch: FriendOverride;
      if (friendType === "buddy") {
        patch = { isBuddy: !active };
      } else if (friendType === "fan") {
        patch = { isFan: !active };
      } else {
        patch = { isCensored: !active };
      }
      return {
        friendOverride: {
          ...s.friendOverride,
          [name]: { ...prev, ...patch },
        },
      };
    });
  };

  _onOpenProfile = () => {
    const { user } = this.props;
    const actions = AppActions.instance;
    if (user && actions) {
      actions.onUserDetail(user.name);
    }
  };

  _onChallenge = () => {
    const { user } = this.props;
    const actions = AppActions.instance;
    if (user && actions) {
      actions.onStartCreateChallenge(user.name);
    }
  };

  _onChat = () => {
    const { user } = this.props;
    const actions = AppActions.instance;
    if (user && actions) {
      actions.onStartChat(user);
    }
  };

  _onLeaveMessage = () => {
    const { user } = this.props;
    const actions = AppActions.instance;
    if (user && actions) {
      actions.onShowLeaveMessageModal(user.name);
    }
  };

  _onMouseEnter = (e: MouseEvent) => {
    const { user, onHover } = this.props;
    if (!user) {
      return;
    }
    this._clearHideTimer();
    if (e.currentTarget instanceof HTMLElement) {
      const r = e.currentTarget.getBoundingClientRect();
      const x = r.left;
      const y = r.bottom + 6;
      if (this._showTimer) {
        clearTimeout(this._showTimer);
      }
      const delay =
        typeof this.props.showDelay === "number"
          ? this.props.showDelay
          : DEFAULT_SHOW_DELAY;
      this._showTimer = setTimeout(() => {
        this._showTimer = null;
        this.setState({ visible: true, x, y });
      }, delay);
    }
    if (onHover) {
      onHover(user.name);
    }
  };

  _onMouseLeave = () => {
    const { user, onHoverEnd } = this.props;
    if (this._showTimer) {
      clearTimeout(this._showTimer);
      this._showTimer = null;
    }
    // Don't hide instantly — give the pointer time to reach the card so its
    // buttons stay clickable. The card's own mouseenter cancels this.
    this._clearHideTimer();
    this._hideTimer = setTimeout(() => {
      this._hideTimer = null;
      this.setState({ visible: false });
    }, HIDE_DELAY);
    if (user && onHoverEnd) {
      onHoverEnd(user.name);
    }
  };

  _renderActions(
    connected: boolean,
    playing: boolean,
    fs: ?{
      isBuddy: boolean,
      isFan: boolean,
      isCensored: boolean,
      canModify: boolean,
      isSelf: boolean,
    }
  ) {
    return (
      <div className="PlayerHoverCard-actions">
        {connected ? (
          <React.Fragment>
            {/* No challenge while they're already in a game. */}
            {playing ? null : (
              <button
                type="button"
                className="PlayerHoverCard-action"
                title="Challenge"
                onClick={this._onChallenge}>
                <Icon name="swords" size={15} />
              </button>
            )}
            <button
              type="button"
              className="PlayerHoverCard-action"
              title="Message"
              onClick={this._onChat}>
              <Icon name="message-square" size={15} />
            </button>
          </React.Fragment>
        ) : (
          <button
            type="button"
            className="PlayerHoverCard-action"
            title="Leave Message"
            onClick={this._onLeaveMessage}>
            <Icon name="mail" size={15} />
          </button>
        )}
        {fs ? (
          <React.Fragment>
            <div className="PlayerHoverCard-action-divider" />
            <button
              type="button"
              className={
                "PlayerHoverCard-action" +
                (fs.isBuddy ? " PlayerHoverCard-action-active" : "")
              }
              title={fs.isBuddy ? "Remove Friend" : "Add Friend"}
              onClick={() => this._onFriendToggle("buddy", fs.isBuddy)}>
              <Icon name={fs.isBuddy ? "heart" : "heart-o"} size={15} />
            </button>
            <button
              type="button"
              className={
                "PlayerHoverCard-action" +
                (fs.isFan ? " PlayerHoverCard-action-active" : "")
              }
              title={fs.isFan ? "Unfollow" : "Follow"}
              onClick={() => this._onFriendToggle("fan", fs.isFan)}>
              <Icon name={fs.isFan ? "star" : "star-o"} size={15} />
            </button>
            <button
              type="button"
              className={
                "PlayerHoverCard-action PlayerHoverCard-action-block" +
                (fs.isCensored ? " PlayerHoverCard-action-active" : "")
              }
              title={fs.isCensored ? "Unblock" : "Block"}
              onClick={() => this._onFriendToggle("censored", fs.isCensored)}>
              <Icon name="ban" size={15} />
            </button>
          </React.Fragment>
        ) : null}
      </div>
    );
  }

  _renderCard() {
    const { user } = this.props;
    const { x, y } = this.state;
    if (!user) {
      return null;
    }
    const flags = user.flags || {};
    const details = user.details;
    const rank = user.rank || "-";
    const rankTier = getRankTier(rank);
    const isBotUser = isBot(user.name, flags);
    const personalName =
      details && details.personalName && details.personalName !== user.name
        ? details.personalName
        : null;
    let locale = null;
    let countryCode = null;
    if (details && details.locale) {
      try {
        locale = localeString.parse(details.locale.replace("_", "-"));
      } catch (e) {
        locale = null;
      }
      // KGS locale is a 5-char string like "fr_FR"; the country code is the
      // 2 chars after the separator. flag-icons uses lowercase codes.
      const cc = details.locale.split(/[_-]/)[1];
      if (cc && cc.length === 2) {
        countryCode = cc.toLowerCase();
      }
    }
    const joined =
      details && details.regStartDate ? new Date(details.regStartDate) : null;
    const statusText = getUserStatusText(user);

    // Clamp horizontally so the card never spills off the right edge.
    const maxX = window.innerWidth - 280;
    const left = x > maxX ? maxX : x;

    // Quick actions row: message/challenge (contact) plus the friend toggle.
    // Suppressed entirely for the current user and for accounts with no profile
    // (e.g. an offline guest from an old game).
    const actions = AppActions.instance;
    let status =
      actions && !user.detailsNotFound
        ? actions.getFriendStatus(user.name)
        : null;
    // Apply any optimistic toggle made since the card opened (the store update
    // is async and we don't re-read it on success).
    const override = this.state.friendOverride[user.name];
    if (status && override) {
      status = { ...status, ...override };
    }
    const showActions = !!(status && !status.isSelf);
    // The heart is editable only when the current user can modify lists (not a
    // guest); contact actions don't require that.
    const friendStatus = status && status.canModify ? status : null;

    return (
      <div
        className="PlayerHoverCard"
        style={{ left: left < 8 ? 8 : left, top: y }}
        onClick={this._onCardClick}
        onMouseEnter={this._onCardEnter}
        onMouseLeave={this._onCardLeave}>
        <div className="PlayerHoverCard-head">
          <UserAvatar user={user} />
          <div className="PlayerHoverCard-head-text">
            <div className="PlayerHoverCard-name-row">
              <span
                className={
                  "PlayerHoverCard-status-dot PlayerHoverCard-status-" +
                  getUserStatusKind(user)
                }
                title={statusText}
              />
              <span
                className="PlayerHoverCard-name PlayerHoverCard-name-link"
                title="View profile"
                onClick={this._onOpenProfile}>
                {user.name}
              </span>
              <span
                className={`UserName-rank-chip UserName-rank-chip-${rankTier}`}>
                {rank}
              </span>
              {isBotUser ? (
                <span className="PlayerHoverCard-bot" title="BOT">
                  <Icon name="cpu" size={12} />
                </span>
              ) : null}
              {flags.guest ? (
                <span className="UserName-guest" title="Guest">
                  <Icon name="hat-glasses" size={16} />
                </span>
              ) : null}
              {flags.selfish ? (
                <span
                  className="UserName-selfish"
                  title="Plays stronger players far more often than weaker ones">
                  <Icon name="activity" size={13} />
                </span>
              ) : null}
              <UserIcons user={user} iconSize={13} />
            </div>
            {personalName ? (
              <div className="PlayerHoverCard-realname">{personalName}</div>
            ) : null}
            {statusText ? (
              <div className="PlayerHoverCard-status">{statusText}</div>
            ) : null}
          </div>
        </div>
        <div className="PlayerHoverCard-meta">
          {countryCode ? (
            <span className="PlayerHoverCard-meta-item">
              <span
                className={"fi fi-" + countryCode + " PlayerHoverCard-flag"}
                title={locale && locale.country ? locale.country : countryCode}
              />
            </span>
          ) : null}
          {joined ? (
            <span className="PlayerHoverCard-meta-item">
              Joined {timeAgo(joined)}
            </span>
          ) : null}
        </div>
        {!details ? (
          <div className="PlayerHoverCard-loading">
            {user.detailsNotFound
              ? "This guest account no longer exists."
              : "Loading…"}
          </div>
        ) : null}
        {showActions
          ? this._renderActions(
              !!flags.connected,
              !!(flags.playing || flags.playingTourney),
              friendStatus
            )
          : null}
      </div>
    );
  }

  render() {
    const { children } = this.props;
    const { visible } = this.state;
    // No hover on touch devices — tapping the name already opens the full
    // profile modal, so the card would be useless (and could linger after a
    // tap). Render the name straight through without the hover wiring.
    if (isTouchDevice()) {
      return children;
    }
    return (
      <span
        className="PlayerHoverCard-trigger"
        onMouseEnter={this._onMouseEnter}
        onMouseLeave={this._onMouseLeave}>
        {children}
        {visible && ReactDOM.createPortal(this._renderCard(), document.body)}
      </span>
    );
  }
}
