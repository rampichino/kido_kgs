// @flow
import React, { PureComponent as Component } from "react";
import UserIcons from "./UserIcons";
import PlayerHoverCard from "./PlayerHoverCard";
import { Icon } from "../common";
import { isBot } from "../../util/bot";
import type { User } from "../../model";

type Props = {
  user: ?User,
  prefixIcons?: boolean,
  extraIcons?: boolean,
  extraIconsSize?: number,
  // Drop the maintainer wrench from `extraIcons` (see UserIcons).
  hideMaintainerIcon?: boolean,
  showFriendStar?: boolean,
  isBuddy?: boolean,
  onToggleBuddy?: () => any,
  showRank?: boolean,
  hideSelfish?: boolean,
  onSelectUser?: (string) => any,
  onPlayerHover?: (string) => any,
  onPlayerHoverEnd?: (string) => any,
};

const EMPTY_FLAGS = {};

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
  // kyu: 1k-9k = sdk, 10k+ = ddk
  const n = parseInt(r, 10);
  if (!isNaN(n) && n >= 10) {
    return "ddk";
  }
  return "sdk";
}

export default class UserName extends Component<Props> {
  static defaultProps: Props;

  _onToggleFriend = (e: Object) => {
    e.stopPropagation();
    e.preventDefault();
    if (this.props.onToggleBuddy) {
      this.props.onToggleBuddy();
    }
  };

  _onSelectUser = (e: Object) => {
    e.stopPropagation();
    e.preventDefault();
    if (this.props.onSelectUser && this.props.user) {
      this.props.onSelectUser(this.props.user.name);
    }
  };

  render() {
    let {
      user,
      prefixIcons,
      extraIcons,
      showFriendStar,
      isBuddy,
      showRank,
      hideSelfish,
    } = this.props;
    let starred = !!isBuddy;
    let className = "UserName";
    if (prefixIcons) {
      className += " Username-with-prefix-icons";
    }
    if (!user) {
      return <div className="UserName">[unknown]</div>;
    }
    let flags = user.flags || EMPTY_FLAGS;
    let iconSize = this.props.extraIconsSize || 13;
    let icons = (
      <div className="UserName-icons">
        {flags.selfish && !hideSelfish ? (
          <span
            className="UserName-selfish"
            title="Plays stronger players far more often than weaker ones">
            <Icon name="activity" size={iconSize} />
          </span>
        ) : null}
        {flags.guest ? (
          <span className="UserName-guest" title="Guest">
            <Icon name="hat-glasses" size={iconSize === 13 ? 16 : iconSize} />
          </span>
        ) : null}
        {extraIcons ? (
          <UserIcons
            user={user}
            iconSize={iconSize}
            hideMaintainer={this.props.hideMaintainerIcon}
          />
        ) : null}
      </div>
    );
    const rank = user.rank || "-";
    const rankTier = getRankTier(rank);
    const isBotUser = isBot(user.name, flags);
    const { onPlayerHover, onPlayerHoverEnd } = this.props;
    let nameText = this.props.onSelectUser ? (
      <span
        className="UserName-text UserName-text-link"
        onClick={this._onSelectUser}>
        {user.name}
      </span>
    ) : (
      <span className="UserName-text">{user.name}</span>
    );
    if (onPlayerHover) {
      nameText = (
        <PlayerHoverCard
          user={user}
          onHover={onPlayerHover}
          onHoverEnd={onPlayerHoverEnd}>
          {nameText}
        </PlayerHoverCard>
      );
    }
    return (
      <div className={className}>
        {prefixIcons ? icons : null}
        {nameText}
        {flags.guest || showRank === false ? (
          isBotUser ? (
            <span className="UserName-bot-icon" title="BOT">
              <Icon name="cpu" size={iconSize} />
            </span>
          ) : null
        ) : (
          <span className={`UserName-rank-chip UserName-rank-chip-${rankTier}`}>
            {rank}
            {isBotUser ? (
              <span className="UserName-rank-bot-icon">
                <Icon name="cpu" size={iconSize - 2} />
              </span>
            ) : null}
          </span>
        )}
        {prefixIcons ? null : icons}
        {showFriendStar && !flags.guest ? (
          <span
            className={
              "UserName-friend-star" +
              (starred ? " UserName-friend-star-active" : "")
            }
            onClick={this._onToggleFriend}
            title={starred ? "Remove Friend" : "Add Friend"}>
            <Icon name={starred ? "heart" : "heart-o"} size={iconSize} />
          </span>
        ) : null}
      </div>
    );
  }
}
