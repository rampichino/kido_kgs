// @flow
import React, { PureComponent as Component } from "react";
import { A, Icon } from "../common";
import type { User, FriendEntry } from "../../model";
import UserName from "./UserName";
import { isBot } from "../../util/bot";
import { getUserStatusKind, getUserStatusText } from "../../model/user";

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

function getStatusClass(user: User): string {
  return "UserList-status-dot UserList-status-" + getUserStatusKind(user);
}

function getStatusLabel(user: User): string {
  return getUserStatusText(user);
}

type Props = {
  user: User,
  onSelect: (User) => any,
  onPlayerHover?: (string) => any,
  onPlayerHoverEnd?: (string) => any,
  // Demo board role markers (optional — only set in a demonstration game).
  demoRole?: ?("editor" | "observer"),
  onGiveControl?: ?(User) => any,
};

class UserListItem extends Component<Props> {
  render() {
    let { user, demoRole, onGiveControl, onPlayerHover, onPlayerHoverEnd } =
      this.props;
    let flags = user.flags || {};
    let className =
      "UserList-item" + (!flags.connected ? " UserList-item-offline" : "");
    return (
      <div className={className}>
        <A onClick={this._onSelect}>
          {demoRole === "editor" ? (
            <span
              className="UserList-demo-role-editor"
              title="Has control of the board">
              <Icon name="pencil" size={13} />
            </span>
          ) : (
            <span
              className={getStatusClass(user)}
              title={getStatusLabel(user)}
            />
          )}
          <span
            className={
              "UserList-item-name" +
              (demoRole === "observer" && onGiveControl
                ? " UserList-item-name-demo"
                : "")
            }>
            <UserName
              user={user}
              extraIcons
              showRank={false}
              hideSelfish
              onPlayerHover={onPlayerHover}
              onPlayerHoverEnd={onPlayerHoverEnd}
            />
            {demoRole === "observer" && onGiveControl ? (
              <A
                button
                className="UserList-demo-grant"
                onClick={this._onGiveControl}
                title={"Give control to " + user.name}>
                <Icon name="circle-plus" size={14} />
              </A>
            ) : null}
          </span>
          {user.rank ? (
            <span
              className={`UserList-item-rank UserName-rank-chip UserName-rank-chip-${getRankTier(
                user.rank
              )}`}>
              {user.rank}
            </span>
          ) : null}
        </A>
      </div>
    );
  }

  _onSelect = () => {
    this.props.onSelect(this.props.user);
  };

  _onGiveControl = (e: Event) => {
    // Sits inside the row's link — don't also open the profile.
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    if (this.props.onGiveControl) {
      this.props.onGiveControl(this.props.user);
    }
  };
}

type UserListProps = {
  users: Array<User>,
  buddies?: ?Array<FriendEntry>,
  onSelectUser: (User) => any,
  onPlayerHover?: (string) => any,
  onPlayerHoverEnd?: (string) => any,
  hideHeader?: boolean,
  // When set, a close (×) button is shown on the right of the Players header
  // (used on the game view to dismiss the observers list).
  onClose?: ?() => any,
  // Demo board: names with editing control, and a grant callback. When set,
  // editors show a pencil after their name; observers reveal a "give control"
  // (user-plus) button on row hover when demoCanGrant, calling onGiveControl.
  demoEditorNames?: ?Set<string>,
  demoCanGrant?: boolean,
  onGiveControl?: ?(User) => any,
};

type State = {
  fullRender: boolean,
  excludeBots: boolean,
  friendsCollapsed: boolean,
};

export default class UserList extends Component<UserListProps, State> {
  state = {
    fullRender: false,
    excludeBots: false,
    friendsCollapsed: false,
  };

  componentDidMount() {
    let { users } = this.props;
    if (users.length > 40) {
      setTimeout(() => {
        this.setState({ fullRender: true });
      }, 32);
    }
  }

  _renderItem = (user: User) => {
    let {
      onSelectUser,
      onPlayerHover,
      onPlayerHoverEnd,
      demoEditorNames,
      demoCanGrant,
      onGiveControl,
    } = this.props;
    let demoRole = null;
    if (demoEditorNames) {
      demoRole = demoEditorNames.has(user.name) ? "editor" : "observer";
    }
    return (
      <UserListItem
        key={user.name}
        user={user}
        onSelect={onSelectUser}
        onPlayerHover={onPlayerHover}
        onPlayerHoverEnd={onPlayerHoverEnd}
        demoRole={demoRole}
        onGiveControl={
          demoCanGrant && demoRole === "observer" ? onGiveControl : null
        }
      />
    );
  };

  render() {
    let { users: allUsers, buddies, hideHeader, onClose } = this.props;
    let { fullRender, excludeBots, friendsCollapsed } = this.state;
    let users = excludeBots
      ? allUsers.filter((u) => !isBot(u.name, u.flags))
      : allUsers;
    users = fullRender ? users : users.slice(0, 40);

    let buddyNames = new Set(buddies ? buddies.map((b) => b.name) : []);
    let friendUsers = [];
    let otherUsers = [];
    for (let u of users) {
      if (buddyNames.has(u.name)) {
        friendUsers.push(u);
      } else {
        otherUsers.push(u);
      }
    }

    return (
      <div className="UserList">
        {friendUsers.length > 0 && (
          <div
            className="UserList-section-title UserList-section-title-collapsible"
            onClick={this._onToggleFriends}>
            <span>Friends ({friendUsers.length})</span>
            <Icon
              name={friendsCollapsed ? "chevron-right" : "chevron-down"}
              size={12}
            />
          </div>
        )}
        {!friendsCollapsed && friendUsers.map(this._renderItem)}
        {otherUsers.length > 0 && (
          <div
            className={
              "UserList-players-header" +
              (onClose ? " UserList-players-header-closable" : "")
            }
            onClick={onClose || undefined}
            title={onClose ? "Close player list" : undefined}>
            <div className="UserList-section-title">
              Players ({otherUsers.length})
            </div>
            {!hideHeader && (
              <div className="UserList-header">
                <div className="ToggleSwitch">
                  <span className="ToggleSwitch-label">Hide bots</span>
                  <label className="ToggleSwitch-control">
                    <input
                      type="checkbox"
                      checked={excludeBots}
                      onChange={this._onToggleBots}
                    />
                    <span className="ToggleSwitch-slider" />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
        {otherUsers.map(this._renderItem)}
      </div>
    );
  }

  _onToggleBots = () => {
    this.setState({ excludeBots: !this.state.excludeBots });
  };

  _onToggleFriends = () => {
    this.setState({ friendsCollapsed: !this.state.friendsCollapsed });
  };
}
