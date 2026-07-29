// @flow
import React, { PureComponent as Component } from "react";
import { A } from "../common";
import PlayerHoverCard from "./PlayerHoverCard";
import type { User, Index, AppActions } from "../../model";

type Props = {
  buddies: Array<{ name: string, notes: ?string }>,
  fans: Array<{ name: string, notes: ?string }>,
  censored: Array<{ name: string, notes: ?string }>,
  usersByName: Index<User>,
  onUserDetail: (string) => any,
  onChat: (string) => any,
  actions: AppActions,
};

type State = {
  activeTab: "buddy" | "fan" | "censored",
};

export default class FriendsList extends Component<Props, State> {
  state = { activeTab: "buddy" };

  _onRemove = (name: string) => {
    const { activeTab } = this.state;
    this.props.actions.onFriendRemove(name, activeTab);
  };

  _setTab = (tab: "buddy" | "fan" | "censored") => {
    this.setState({ activeTab: tab });
  };

  render() {
    const { usersByName, onUserDetail, buddies, fans, censored } = this.props;
    const { activeTab } = this.state;

    let list = [];
    let emptyMsg = "No friends yet";
    let emptyHint =
      "Open a user profile or chat and click the heart icon to add them as a friend";
    if (activeTab === "buddy") {
      list = buddies;
      emptyMsg = "No friends yet";
      emptyHint =
        "Open a user profile or chat and click the heart icon to add them as a friend";
    } else if (activeTab === "fan") {
      list = fans;
      emptyMsg = "Not following anyone yet";
      emptyHint =
        "Open a user profile or chat and click the star icon to follow them";
    } else if (activeTab === "censored") {
      list = censored;
      emptyMsg = "No blocked users";
      emptyHint =
        "Open a user profile or chat and click the ban icon to block them";
    }

    const online = [];
    const offline = [];
    for (const entry of list) {
      const name = entry.name;
      const user = usersByName[name];
      if (user && user.flags && user.flags.connected) {
        online.push({ name, user });
      } else {
        offline.push({ name, user });
      }
    }

    const renderRow = ({ name, user }) => (
      <div key={name} className="FriendsList-item">
        <span
          className={
            "FriendsList-status" +
            (user && user.flags && user.flags.connected ? " online" : "")
          }
        />
        <A className="FriendsList-name" onClick={() => onUserDetail(name)}>
          <PlayerHoverCard
            user={user || { name }}
            onHover={this.props.actions.onPlayerHover}
            onHoverEnd={this.props.actions.onPlayerHoverEnd}>
            {name}
          </PlayerHoverCard>
        </A>
        <div className="FriendsList-actions">
          <A
            className="FriendsList-remove-btn"
            onClick={() => this._onRemove(name)}
            title="Remove">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </A>
        </div>
      </div>
    );

    return (
      <div className="FriendsList">
        <div className="FriendsList-tabs">
          <div
            className={
              "FriendsList-tab" + (activeTab === "buddy" ? " active" : "")
            }
            onClick={() => this._setTab("buddy")}>
            Friends ({buddies.length})
          </div>
          <div
            className={
              "FriendsList-tab" + (activeTab === "fan" ? " active" : "")
            }
            onClick={() => this._setTab("fan")}>
            Follow ({fans.length})
          </div>
          <div
            className={
              "FriendsList-tab" + (activeTab === "censored" ? " active" : "")
            }
            onClick={() => this._setTab("censored")}>
            Blocked ({censored.length})
          </div>
        </div>

        <div className="FriendsList-content">
          {!list.length ? (
            <div className="FriendsList-empty">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <div>{emptyMsg}</div>
              <div className="FriendsList-empty-hint">{emptyHint}</div>
            </div>
          ) : (
            <React.Fragment>
              {online.length > 0 && (
                <div className="FriendsList-section">
                  <div className="FriendsList-section-title">
                    Online · {online.length}
                  </div>
                  {online.map(renderRow)}
                </div>
              )}
              {offline.length > 0 && (
                <div className="FriendsList-section">
                  <div className="FriendsList-section-title">
                    Offline · {offline.length}
                  </div>
                  {offline.map(renderRow)}
                </div>
              )}
            </React.Fragment>
          )}
        </div>
      </div>
    );
  }
}
