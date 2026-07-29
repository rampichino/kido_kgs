// @flow
import React, { PureComponent as Component } from "react";
import ChatMessages from "./ChatMessages";
import ChatMessageBar from "./ChatMessageBar";
import UserName from "../user/UserName";
import { Button } from "../common";
import { getUserStatusKind, getUserStatusText } from "../../model/user";
import * as jdenticon from "jdenticon";

function getStatusClass(user) {
  return "UserChat-status-dot UserChat-status-" + getUserStatusKind(user);
}

function getStatusLabel(user) {
  return getUserStatusText(user);
}
import type {
  User,
  Conversation,
  Index,
  FriendEntry,
  Room,
  AppActions,
} from "../../model";

type Props = {
  currentUser: User,
  user: User,
  conversation: Conversation,
  usersByName: Index<User>,
  buddies: Array<FriendEntry>,
  fans: Array<FriendEntry>,
  censored: Array<FriendEntry>,
  roomsById?: ?Index<Room>,
  actions?: ?AppActions,
  onUserDetail: (string) => any,
  onSendChat: (string) => any,
  onFriendAdd: (string, "buddy" | "fan" | "censored") => any,
  onFriendRemove: (string, "buddy" | "fan" | "censored") => any,
  setMessagesDivRef: (HTMLElement | null) => any,
  setMessageInputRef: (HTMLElement | null) => any,
};

type State = {
  confirmingClear: boolean,
};

export default class UserChat extends Component<Props, State> {
  state = { confirmingClear: false };

  componentDidUpdate(prevProps: Props) {
    if (
      this.state.confirmingClear &&
      prevProps.conversation.id !== this.props.conversation.id
    ) {
      this.setState({ confirmingClear: false });
    }
  }

  render() {
    let {
      currentUser,
      user,
      conversation,
      usersByName,
      buddies,
      fans,
      censored,
      actions,
      onUserDetail,
      onSendChat,
      setMessagesDivRef,
      setMessageInputRef,
    } = this.props;
    const isBuddy = buddies && buddies.some((b) => b.name === user.name);
    const isFan = fans && fans.some((f) => f.name === user.name);
    const isCensored = censored && censored.some((c) => c.name === user.name);
    const avatarSvg = jdenticon.toSvg(user.name, 100);
    return (
      <div className="UserChat">
        <div className="UserChat-header">
          <div className="UserChat-header-avatar" onClick={this._onViewProfile}>
            <div className="UserChat-avatar-wrap">
              <div
                className="UserAvatar UserAvatar-missing"
                dangerouslySetInnerHTML={{ __html: avatarSvg }}
              />
              <span
                className={getStatusClass(user)}
                title={getStatusLabel(user)}
              />
            </div>
          </div>
          <div className="UserChat-header-info" onClick={this._onViewProfile}>
            <div className="UserChat-header-name">
              <UserName
                user={user}
                onPlayerHover={actions ? actions.onPlayerHover : undefined}
                onPlayerHoverEnd={
                  actions ? actions.onPlayerHoverEnd : undefined
                }
              />
            </div>
          </div>
          {conversation.chatsDisabled ? (
            <div className="UserChat-header-disabled">[Chat disabled]</div>
          ) : null}
          <div className="UserChat-header-actions">
            {this.state.confirmingClear ? (
              <React.Fragment>
                <Button
                  small
                  danger
                  icon="trash"
                  className="UserChat-clear-confirm"
                  onClick={this._onConfirmClearHistory}
                  title="Confirm — clear this chat history">
                  Delete chat history?
                </Button>
                <Button
                  small
                  secondary
                  icon="circle-x"
                  onClick={this._onCancelClearHistory}
                  title="Keep chat history"
                />
                <div className="UserChat-header-actions-divider" />
              </React.Fragment>
            ) : conversation.messages.length ? (
              <React.Fragment>
                <Button
                  small
                  secondary
                  icon="trash"
                  onClick={this._onClearHistory}
                  title="Clear chat history"
                />
                <div className="UserChat-header-actions-divider" />
              </React.Fragment>
            ) : null}
            {user.flags &&
            user.flags.connected &&
            !user.flags.playing &&
            !user.flags.playingTourney ? (
              <React.Fragment>
                <Button
                  small
                  secondary
                  icon="swords"
                  onClick={this._onCreateDirectChallenge}
                  title={"Challenge " + user.name}
                />
                <div className="UserChat-header-actions-divider" />
              </React.Fragment>
            ) : null}
            <Button
              small
              secondary={!isBuddy}
              warning={isBuddy}
              icon={isBuddy ? "heart" : "heart-o"}
              onClick={this._onToggleBuddy}
              title={isBuddy ? "Remove Friend" : "Add Friend"}
            />
            <Button
              small
              secondary={!isFan}
              warning={isFan}
              icon={isFan ? "star" : "star-o"}
              onClick={this._onToggleFan}
              title={isFan ? "Unfollow" : "Follow"}
            />
            <Button
              small
              secondary={!isCensored}
              danger={isCensored}
              icon="ban"
              onClick={this._onToggleCensored}
              title={isCensored ? "Unblock" : "Block"}
            />
          </div>
        </div>
        <div className="UserChat-messages" ref={setMessagesDivRef}>
          <ChatMessages
            currentUser={currentUser}
            messages={conversation.messages}
            usersByName={usersByName}
            onUserDetail={onUserDetail}
            onPlayerHover={actions ? actions.onPlayerHover : undefined}
            onPlayerHoverEnd={actions ? actions.onPlayerHoverEnd : undefined}
            recipientOffline={!user.flags || !user.flags.connected}
          />
        </div>
        <div className="UserChat-message-bar" ref={setMessageInputRef}>
          <ChatMessageBar
            conversation={conversation}
            onSubmit={onSendChat}
            recipientOffline={!user.flags || !user.flags.connected}
          />
        </div>
      </div>
    );
  }

  _onCreateDirectChallenge = (e: Event) => {
    e.stopPropagation();
    let { user, actions } = this.props;
    if (actions) {
      actions.onStartCreateChallenge(user.name);
    }
  };

  _onViewProfile = () => {
    this.props.onUserDetail(this.props.user.name);
  };

  _onClearHistory = (e: Event) => {
    e.stopPropagation();
    this.setState({ confirmingClear: true });
  };

  _onCancelClearHistory = (e: Event) => {
    e.stopPropagation();
    this.setState({ confirmingClear: false });
  };

  _onConfirmClearHistory = (e: Event) => {
    e.stopPropagation();
    let { conversation, actions } = this.props;
    if (actions) {
      actions.onClearConversationHistory(conversation.id);
    }
    this.setState({ confirmingClear: false });
  };

  _onToggleBuddy = (e: Event) => {
    e.stopPropagation();
    const { user, buddies, onFriendAdd, onFriendRemove } = this.props;
    const isBuddy = buddies && buddies.some((b) => b.name === user.name);
    if (isBuddy) {
      onFriendRemove(user.name, "buddy");
    } else {
      onFriendAdd(user.name, "buddy");
    }
  };

  _onToggleFan = (e: Event) => {
    e.stopPropagation();
    const { user, fans, onFriendAdd, onFriendRemove } = this.props;
    const isFan = fans && fans.some((f) => f.name === user.name);
    if (isFan) {
      onFriendRemove(user.name, "fan");
    } else {
      onFriendAdd(user.name, "fan");
    }
  };

  _onToggleCensored = (e: Event) => {
    e.stopPropagation();
    const { user, censored, onFriendAdd, onFriendRemove } = this.props;
    const isCensored = censored && censored.some((c) => c.name === user.name);
    if (isCensored) {
      onFriendRemove(user.name, "censored");
    } else {
      onFriendAdd(user.name, "censored");
    }
  };
}
