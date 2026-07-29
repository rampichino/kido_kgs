// @flow
import React, { PureComponent as Component } from "react";
import ChatMessages from "./ChatMessages";
import ChatMessageBar from "./ChatMessageBar";
import RoomGameLinks from "./RoomGameLinks";
import { A, RichContent, Icon } from "../common";
import * as jdenticon from "jdenticon";
import UserList from "../user/UserList";
import { sortUsers } from "../../model/user";
import { isMobileScreen } from "../../util/dom";
import type {
  Room,
  User,
  Conversation,
  Index,
  GameChannel,
  GameFilter,
  FriendEntry,
  AppActions,
} from "../../model";

type Props = {
  currentUser: User,
  room: Room,
  conversation: Conversation,
  usersByName: Index<User>,
  buddies?: ?Array<FriendEntry>,
  games?: ?Array<GameChannel>,
  onUserDetail: (string) => any,
  onJoinGame: (gameId: number | string) => any,
  onSelectChallenge: (number) => any,
  onShowGames: (filter: GameFilter) => any,
  onSendChat: (string) => any,
  setMessagesDivRef: (HTMLElement | null) => any,
  setMessageInputRef: (HTMLElement | null) => any,
  actions: AppActions,
};

type State = { descCollapsed: boolean };

export default class RoomChat extends Component<Props, State> {
  state = { descCollapsed: true };

  _onToggleDesc = () => {
    this.setState({ descCollapsed: !this.state.descCollapsed });
  };

  _onCreateChallenge = () => {
    let filter: GameFilter = {
      roomId: this.props.room.id,
      type: "challenge",
    };
    this.props.onShowGames(filter);
    this.props.actions.onStartCreateChallenge();
  };

  render() {
    let {
      currentUser,
      room,
      conversation,
      usersByName,
      buddies,
      games,
      onUserDetail,
      onSendChat,
      onJoinGame,
      onSelectChallenge,
      setMessagesDivRef,
      setMessageInputRef,
    } = this.props;
    let { descCollapsed } = this.state;
    let users;
    if (room.users) {
      users = room.users.map((name) => usersByName[name]).filter((u) => u);
      sortUsers(users, buddies);
    }
    return (
      <div className="RoomChat">
        <div className="RoomChat-header">
          <div
            className="RoomChat-header-avatar"
            dangerouslySetInnerHTML={{
              __html: jdenticon.toSvg(room.name, 100),
            }}
          />
          <div className="RoomChat-header-info">
            <div className="RoomChat-header-name">
              {room.name}
              {room.private ? " 🔒" : null}
            </div>
          </div>
        </div>
        <div className="RoomChat-messages-container" ref={setMessagesDivRef}>
          <div className="RoomChat-desc">
            <div className="RoomChat-desc-header">
              <div className="RoomChat-desc-actions">
                {games && games.length ? (
                  <RoomGameLinks games={games} onSelect={this._onShowGames} />
                ) : null}
                <A
                  className="RoomChat-create-challenge"
                  onClick={this._onCreateChallenge}>
                  <div className="RoomChat-create-challenge-icon">
                    <Icon name="sword" />
                  </div>
                  <div className="RoomChat-create-challenge-label">
                    Create Challenge
                  </div>
                </A>
              </div>
              {room.description ? (
                <A
                  className="RoomChat-desc-toggle"
                  onClick={this._onToggleDesc}>
                  <Icon
                    name={descCollapsed ? "chevron-right" : "chevron-down"}
                  />
                  {descCollapsed ? "Show room info" : "Hide room info"}
                </A>
              ) : null}
            </div>
            {room.description && !descCollapsed && (
              <div className="RoomChat-desc-text">
                <RichContent
                  content={room.description.replace(/[\r\n]+$/, "")}
                  firstLineHeading
                />
              </div>
            )}
          </div>
          <div className="RoomChat-messages">
            <ChatMessages
              currentUser={currentUser}
              messages={conversation.messages}
              usersByName={usersByName}
              onUserDetail={onUserDetail}
              onPlayerHover={this.props.actions.onPlayerHover}
              onPlayerHoverEnd={this.props.actions.onPlayerHoverEnd}
              onJoinGame={onJoinGame}
              onSelectChallenge={onSelectChallenge}
              userColors
            />
          </div>
        </div>
        <div className="RoomChat-message-bar" ref={setMessageInputRef}>
          <ChatMessageBar
            conversation={conversation}
            onSubmit={onSendChat}
            users={users}
            onUserDetail={onUserDetail}
          />
        </div>
        {!isMobileScreen() ? (
          <div className="RoomChat-sidebar">
            <div className="RoomChat-users">
              {users ? (
                <UserList
                  users={users}
                  buddies={buddies}
                  onSelectUser={this._onUserDetail}
                  onPlayerHover={this.props.actions.onPlayerHover}
                  onPlayerHoverEnd={this.props.actions.onPlayerHoverEnd}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  _onUserDetail = (user: User) => {
    this.props.onUserDetail(user.name);
  };

  _onShowGames = (games: Array<GameChannel>) => {
    let filter: GameFilter = {
      roomId: this.props.room.id,
      type:
        games.length && games[0].type === "challenge" ? "challenge" : "game",
    };
    this.props.onShowGames(filter);
  };
}
