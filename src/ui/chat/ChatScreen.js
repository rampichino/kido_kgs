// @flow
import React, { PureComponent as Component } from "react";
import ChatRoomList from "./ChatRoomList";
import ChatUnseenBadge from "./ChatUnseenBadge";
import RoomChat from "./RoomChat";
import UserChat from "./UserChat";
import { A, Icon, Modal } from "../common";
import * as jdenticon from "jdenticon";
import UserName from "../user/UserName";
import UserList from "../user/UserList";
// FriendsList moved to Nav
import {
  sortUsers,
  getUserStatusText,
  getUserStatusKind,
} from "../../model/user";
import { isMobileScreen } from "../../util/dom";
import { InvariantError } from "../../util/error";

// Persisted height (px) of the Rooms pane in the desktop chat sidebar, so the
// user's chosen split between the Rooms and Players lists sticks.
const ROOMS_PANE_KEY = "kido_chat_rooms_pane_h";
const ROOMS_PANE_MIN = 80;
function loadRoomsPaneHeight(): number {
  try {
    const v = parseInt(localStorage.getItem(ROOMS_PANE_KEY), 10);
    if (!isNaN(v) && v >= ROOMS_PANE_MIN && v <= 2000) {
      return v;
    }
  } catch (e) {
    // ignore
  }
  return 260;
}
import type {
  Room,
  User,
  Conversation,
  Index,
  ChannelMembership,
  GameChannel,
  AppActions,
  FriendEntry,
} from "../../model";

type Props = {
  conversation: Conversation,
  active: boolean,
  room?: ?Room,
  user?: ?User,
  onSelect: (number) => any,
  onClose: (number) => any,
};

function _statusClass(user) {
  return "ChatScreen-player-status-" + getUserStatusKind(user);
}

function _statusLabel(user) {
  return getUserStatusText(user);
}

class ChatTab extends Component<Props> {
  render() {
    let { conversation, user, room, active } = this.props;
    let label;
    if (user) {
      label = (
        <div className="ChatScreen-tab-user-name">
          <UserName user={user} showRank={false} />
        </div>
      );
    } else if (room) {
      label = (
        <div className="ChatScreen-tab-room-name">
          {room.name}
          {room.private ? " 🔒" : null}
        </div>
      );
    } else {
      label = "[Empty]";
    }
    const avatarSvg = user
      ? jdenticon.toSvg(user.name, 100)
      : room
        ? jdenticon.toSvg(room.name, 100)
        : null;
    return (
      <div
        className={
          "ChatScreen-tab" +
          (active ? " ChatScreen-tab-active" : "") +
          (!active && conversation.unseenCount ? " ChatScreen-tab-unread" : "")
        }>
        <A className="ChatScreen-tab-label" onClick={this._onSelect}>
          {avatarSvg ? (
            <div className="ChatScreen-tab-avatar-wrap">
              <div
                className="ChatScreen-tab-avatar"
                dangerouslySetInnerHTML={{ __html: avatarSvg }}
              />
              {user ? (
                <span
                  className={"ChatScreen-player-status " + _statusClass(user)}
                  title={_statusLabel(user)}
                />
              ) : null}
            </div>
          ) : null}
          <div className="ChatScreen-tab-name">
            {conversation.unseenCount ? (
              <div className="ChatScreen-tab-badge">
                <ChatUnseenBadge
                  conversationsById={{ [conversation.id]: conversation }}
                />
              </div>
            ) : null}
            {label}
          </div>
          <div className="ChatScreen-tab-info">
            {room && room.users ? <span>{room.users.length} users</span> : null}
          </div>
        </A>
        <A className="ChatScreen-tab-close" onClick={this._onClose}>
          <Icon name="circle-x" size={16} />
        </A>
      </div>
    );
  }

  _onSelect = () => {
    this.props.onSelect(this.props.conversation.id);
  };

  _onClose = () => {
    this.props.onClose(this.props.conversation.id);
  };
}

type ChatScreenBannerProps = {
  conversationsById: Index<Conversation>,
  activeRoom: ?Room,
  showingRoomUsers: ?boolean,
  activeUser: ?User,
  onShowList: Function,
  onShowRoomUsers: Function,
  onShowRoomChat: Function,
  onUserDetail: (string) => any,
};

class ChatScreenBanner extends Component<ChatScreenBannerProps> {
  _onTitleClick = () => {
    let { activeRoom, activeUser, onShowRoomUsers, onUserDetail } = this.props;
    // In a direct conversation the title is the partner's name, so it opens
    // their profile; in a room it still toggles the room's user list.
    if (!activeRoom && activeUser) {
      onUserDetail(activeUser.name);
      return;
    }
    onShowRoomUsers();
  };

  render() {
    let {
      conversationsById,
      activeRoom,
      showingRoomUsers,
      activeUser,
      onShowList,
      onShowRoomUsers,
      onShowRoomChat,
    } = this.props;
    if (showingRoomUsers) {
      return (
        <div className="ChatScreen-banner">
          <A
            className="ChatScreen-banner-title"
            onClick={onShowRoomChat}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}>
            {activeRoom && activeRoom.users ? (
              <>
                <span>{activeRoom.users.length}</span>
                <Icon name="users" size={18} color="#0284c7" />
              </>
            ) : (
              "Room users"
            )}
          </A>
          <div className="ChatScreen-back">
            <A onClick={onShowRoomChat}>
              <div className="ChatScreen-back-icon">
                <Icon name="chevron-left" size={18} />
              </div>
              <div
                className="ChatScreen-back-label"
                style={{ display: "inline-flex", alignItems: "center" }}>
                <Icon name="messages-square" size={18} />
              </div>
            </A>
          </div>
        </div>
      );
    }
    return (
      <div className="ChatScreen-banner">
        <A className="ChatScreen-banner-title" onClick={this._onTitleClick}>
          {activeRoom ? (
            <div className="ChatScreen-banner-title-room">
              {activeRoom.name} {activeRoom.private ? <Icon name="lock" /> : ""}
            </div>
          ) : activeUser ? (
            <div className="ChatScreen-banner-title-user">
              <UserName user={activeUser} extraIcons />
            </div>
          ) : null}
        </A>
        <A
          className="ChatScreen-banner-info"
          onClick={activeRoom ? onShowRoomUsers : undefined}>
          {activeRoom ? (
            <div className="ChatScreen-banner-info-room">
              {activeRoom.users ? (
                <div
                  className="ChatScreen-banner-info-users-count"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}>
                  <span>{activeRoom.users.length}</span>
                  <Icon name="users" size={18} color="#0284c7" />
                </div>
              ) : null}
            </div>
          ) : activeUser ? (
            <div className="ChatScreen-banner-info-user">
              {getUserStatusText(activeUser)}
            </div>
          ) : null}
        </A>
        <div className="ChatScreen-back">
          <A onClick={onShowList}>
            <div className="ChatScreen-back-icon">
              <Icon name="chevron-left" size={18} />
            </div>
            <div
              className="ChatScreen-back-label"
              style={{ display: "inline-flex", alignItems: "center" }}>
              <Icon name="messages-square" size={18} />
            </div>
            <div className="ChatScreen-back-badge">
              <ChatUnseenBadge conversationsById={conversationsById} />
            </div>
          </A>
        </div>
      </div>
    );
  }
}

type ChatScreenProps = {
  currentUser: ?User,
  channelMembership: ChannelMembership,
  roomsById: Index<Room>,
  usersByName: Index<User>,
  conversationsById: Index<Conversation>,
  gamesById: Index<GameChannel>,
  activeConversationId: ?number,
  actions: AppActions,
  buddies: Array<FriendEntry>,
  fans: Array<FriendEntry>,
  censored: Array<FriendEntry>,
};

type State = {
  roomConvs: Array<Conversation>,
  userConvs: Array<Conversation>,
  activeConv: ?Conversation,
  activeRoom: ?Room,
  activeRoomGames: Array<GameChannel>,
  activeUser: ?User,
  activeConversationId: ?number,
  showingList?: ?boolean,
  showingRoomUsers?: ?boolean,
  showingRoomList?: ?boolean,
  showingFriends?: ?boolean,
  playerSearch?: string,
  showingPlayerSearch?: boolean,
  roomsPaneHeight: number,
};

export default class ChatScreen extends Component<ChatScreenProps, State> {
  // On mobile, open onto the chat list (Rooms / Players) rather than dropping
  // straight into a conversation. Desktop shows the full layout, so this stays
  // false there. `showingList` isn't part of _getState, so the prop-driven
  // setState in UNSAFE_componentWillReceiveProps preserves it.
  state: State = {
    ...this._getState(this.props),
    showingList: isMobileScreen(),
    roomsPaneHeight: loadRoomsPaneHeight(),
  };

  _messagesDiv: ?(HTMLElement | null);
  _messageInput: ?(HTMLElement | null);

  // Resizable Rooms/Players split (desktop sidebar and mobile list).
  _tabsInnerEl: ?HTMLElement = null;
  _roomsResizing: boolean = false;
  _roomsResizeStartY: number = 0;

  // The Players header doubles as the resize handle: on mobile the standalone
  // divider row is hidden and the grip shown here instead, so the split can be
  // dragged from the header itself without spending a row on it.
  _renderPlayersHeader() {
    return (
      <div className="ChatScreen-tabs-section-header">
        <span className="ChatScreen-tabs-section-title">Players</span>
        {/* The drag handle fills the gap between the title and Search: a wide
            target (rules either side of the grip) that is the ONLY thing that
            starts a resize, so tapping Search never drags. */}
        <span
          className="ChatScreen-tabs-resize-grip"
          title="Drag to resize"
          role="separator"
          aria-orientation="horizontal"
          onPointerDown={this._onRoomsResizeStart}>
          <Icon name="chevrons-up-down" size={16} />
        </span>
        <div className="ChatScreen-join-room-btn">
          <A onClick={this._onTogglePlayerSearch}>
            <Icon name="search" size={11} />
            Search
          </A>
        </div>
      </div>
    );
  }

  _setTabsInnerEl = (el: ?HTMLElement) => {
    this._tabsInnerEl = el;
  };

  // Pointer Events only: one stream for mouse and touch. The touch+mouse pair
  // used before double-fired on Android (a touch is followed by synthetic
  // mouse events), which restarted the drag from a stale origin and made the
  // split jump. `setPointerCapture` also keeps events coming to this element
  // even as the layout shifts under the finger.
  _onRoomsResizeStart = (e: Object) => {
    if (e.button !== undefined && e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    let el = e.currentTarget;
    this._roomsResizePointerId = e.pointerId;
    this._roomsResizeEl = el;
    if (el && el.setPointerCapture && e.pointerId !== undefined) {
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {
        // Capture is best-effort; the window listeners below still work.
      }
    }
    this._roomsResizing = true;
    this._roomsResizeStartY = e.clientY;
    this._roomsResizeMoved = false;
    window.addEventListener("pointermove", this._onRoomsResizeMove);
    window.addEventListener("pointerup", this._onRoomsResizeEnd);
    window.addEventListener("pointercancel", this._onRoomsResizeEnd);
  };

  _roomsResizePointerId: ?number = null;
  _roomsResizeEl: ?HTMLElement = null;
  _roomsResizeMoved: boolean = false;
  _roomsResizeRaf: ?AnimationFrameID = null;

  _onRoomsResizeMove = (e: Object) => {
    if (!this._roomsResizing) {
      return;
    }
    if (
      this._roomsResizePointerId !== null &&
      this._roomsResizePointerId !== undefined &&
      e.pointerId !== undefined &&
      e.pointerId !== this._roomsResizePointerId
    ) {
      return;
    }
    // A tap must not move anything: only past this threshold is it a drag.
    if (
      !this._roomsResizeMoved &&
      Math.abs(e.clientY - this._roomsResizeStartY) < 6
    ) {
      return;
    }
    this._roomsResizeMoved = true;
    e.preventDefault();
    // Coalesce to one update per frame — a burst of moves each triggering a
    // synchronous re-render is what let the split visibly thrash.
    let clientY = e.clientY;
    if (this._roomsResizeRaf) {
      return;
    }
    this._roomsResizeRaf = requestAnimationFrame(() => {
      this._roomsResizeRaf = null;
      this._resizeRoomsTo(clientY);
    });
  };

  // Height is derived from where the pointer is *inside the container*, not
  // accumulated from a start offset. That makes it self-correcting: if the
  // layout shifts mid-drag (a scroll, the WebView resizing), the next event
  // still maps to the finger's real position instead of compounding the error
  // — the runaway that made the split fly up and down on mobile.
  _resizeRoomsTo = (clientY: number) => {
    let container = this._tabsInnerEl;
    if (!container) {
      return;
    }
    let rect = container.getBoundingClientRect();
    let h = clientY - rect.top;
    // Reserve just enough for the Players header so the pane below never fully
    // collapses, but let the Rooms list grow to take most of the sidebar.
    let max = rect.height - 70;
    if (h < ROOMS_PANE_MIN) {
      h = ROOMS_PANE_MIN;
    } else if (max > ROOMS_PANE_MIN && h > max) {
      h = max;
    }
    if (Math.round(h) === Math.round(this.state.roomsPaneHeight)) {
      return;
    }
    this.setState({ roomsPaneHeight: h });
  };

  _onRoomsResizeEnd = () => {
    if (!this._roomsResizing) {
      return;
    }
    this._roomsResizing = false;
    if (this._roomsResizeRaf) {
      cancelAnimationFrame(this._roomsResizeRaf);
      this._roomsResizeRaf = null;
    }
    window.removeEventListener("pointermove", this._onRoomsResizeMove);
    window.removeEventListener("pointerup", this._onRoomsResizeEnd);
    window.removeEventListener("pointercancel", this._onRoomsResizeEnd);
    let el = this._roomsResizeEl;
    let pointerId = this._roomsResizePointerId;
    if (
      el &&
      el.releasePointerCapture &&
      pointerId !== null &&
      pointerId !== undefined
    ) {
      try {
        el.releasePointerCapture((pointerId: any));
      } catch (err) {
        // Already released (pointer left the document) — nothing to do.
      }
    }
    this._roomsResizeEl = null;
    this._roomsResizePointerId = null;
    try {
      localStorage.setItem(
        ROOMS_PANE_KEY,
        String(Math.round(this.state.roomsPaneHeight))
      );
    } catch (e) {
      // ignore
    }
  };

  _getState(props: ChatScreenProps) {
    let {
      channelMembership,
      activeConversationId,
      conversationsById,
      roomsById,
      usersByName,
      gamesById,
    } = props;
    let roomConvs = [];
    let userConvs = [];
    let activeRoomGames = [];
    let activeConv;
    let activeRoom;
    let activeUser;
    for (let chanId of Object.keys(channelMembership)) {
      let chan = channelMembership[chanId];
      let conv = conversationsById[chanId];
      if (!conv || conv.status === "closed") {
        continue;
      }
      if (chan.type === "room") {
        if (!activeConversationId) {
          activeConversationId = conv.id;
        }
        if (activeConversationId === conv.id) {
          activeConv = conv;
          activeRoom = roomsById[conv.id];
          for (let gid of Object.keys(gamesById)) {
            if (gamesById[gid].roomId === conv.id) {
              activeRoomGames.push(gamesById[gid]);
            }
          }
        }
        roomConvs.push(conv);
      } else if (chan.type === "conversation") {
        userConvs.push(conv);
        if (activeConversationId === conv.id && conv.user) {
          activeConv = conv;
          activeUser = usersByName[conv.user];
        }
      }
    }
    return {
      roomConvs,
      userConvs,
      activeConv,
      activeRoom,
      activeRoomGames,
      activeUser,
      activeConversationId,
    };
  }

  _setScroll() {
    let { activeConv } = this.state;
    if (activeConv && activeConv.messages.length && document.documentElement) {
      // Hack to scroll div or window depending on if we're on mobile or not
      if (this._messagesDiv && !isMobileScreen()) {
        this._messagesDiv.scrollTop = this._messagesDiv.scrollHeight;
      } else {
        if (this._messageInput) {
          this._messageInput.scrollIntoView(false);
        }
        // window.scrollTo(0, document.documentElement.scrollHeight);
      }
    }
  }

  // FIXME: UNSAFE_componentWillReceiveProps is deprecated.
  UNSAFE_componentWillReceiveProps(nextProps: ChatScreenProps) {
    let nextState = this._getState(nextProps);
    let nextConvId = nextState.activeConversationId;
    let thisConvId = this.state.activeConversationId;
    let nextLen = nextState.activeConv && nextState.activeConv.messages.length;
    let thisLen =
      this.state.activeConv && this.state.activeConv.messages.length;
    // TODO - check games
    this.setState(nextState, () => {
      if (nextConvId !== thisConvId || (nextLen || 0) > (thisLen || 0)) {
        this._setScroll();
      }
    });
  }

  componentDidMount() {
    this._setScroll();
    if (this.state.activeConversationId) {
      this.props.actions.markConversationSeen(this.state.activeConversationId);
    }
  }

  componentWillUnmount() {
    // A class body allows only one componentWillUnmount — this must also tear
    // down the Rooms/Players divider drag listeners.
    window.removeEventListener("pointermove", this._onRoomsResizeMove);
    window.removeEventListener("pointerup", this._onRoomsResizeEnd);
    window.removeEventListener("pointercancel", this._onRoomsResizeEnd);
    if (this.state.activeConversationId) {
      this.props.actions.markConversationSeen(this.state.activeConversationId);
    }
  }

  render() {
    let {
      conversationsById,
      currentUser,
      roomsById,
      usersByName,
      actions,
      buddies,
      fans,
      censored,
    } = this.props;
    let {
      roomConvs,
      userConvs,
      activeConv,
      activeRoom,
      activeRoomGames,
      activeUser,
      activeConversationId,
      showingList,
      showingRoomUsers,
      showingRoomList,
      playerSearch,
      showingPlayerSearch,
      roomsPaneHeight,
    } = this.state;

    if (!currentUser) {
      throw new InvariantError("currentUser is required");
    }

    let users = [];
    if (showingRoomUsers && activeRoom && activeRoom.users) {
      users = activeRoom.users
        .map((name) => usersByName[name])
        .filter((u) => u);
      sortUsers(users, buddies);
    }

    let roomTabs = roomConvs.map((conv) => (
      <ChatTab
        key={conv.id}
        conversation={conv}
        active={activeConversationId === conv.id}
        room={roomsById[conv.id]}
        onSelect={this._onSelectConversation}
        onClose={this._onCloseConversation}
      />
    ));

    let userTabs = userConvs.map((conv) => (
      <ChatTab
        key={conv.id}
        conversation={conv}
        active={activeConversationId === conv.id}
        user={conv.user ? usersByName[conv.user] || { name: conv.user } : null}
        onSelect={this._onSelectConversation}
        onClose={this._onCloseConversation}
      />
    ));

    let modal = showingRoomList ? (
      <div className="ChatScreen-rooms-list">
        <Modal
          title={
            <span className="ChatScreen-rooms-modal-title">
              <Icon name="search" size={20} />
              Explore Rooms
            </span>
          }
          onClose={this._onCloseRoomList}>
          <ChatRoomList roomsById={roomsById} onJoinRoom={this._onJoinRoom} />
        </Modal>
      </div>
    ) : null;

    if (showingList) {
      return (
        <div className="ChatScreen ChatScreen-with-list">
          <div className="ChatScreen-list" ref={this._setTabsInnerEl}>
            <div
              className="ChatScreen-tabs-section ChatScreen-tabs-section-rooms"
              style={{ flexBasis: roomsPaneHeight }}>
              <div className="ChatScreen-tabs-section-header">
                <span className="ChatScreen-tabs-section-title">Rooms</span>
                <div className="ChatScreen-join-room-btn">
                  <A onClick={this._onShowRoomList}>
                    <Icon name="search" size={11} />
                    Explore
                  </A>
                </div>
              </div>
              <div className="ChatScreen-tabs-section-items">{roomTabs}</div>
            </div>
            <div className="ChatScreen-tabs-section ChatScreen-tabs-section-players">
              {this._renderPlayersHeader()}
              {showingPlayerSearch ? (
                <div className="ChatScreen-player-search">
                  <Icon name="search" size={16} />
                  <input
                    className="ChatScreen-player-search-input"
                    type="text"
                    placeholder="Search players..."
                    value={playerSearch || ""}
                    onChange={this._onPlayerSearch}
                    autoFocus
                  />
                </div>
              ) : null}
              <div className="ChatScreen-tabs-section-items">
                {playerSearch && playerSearch.length > 0
                  ? Object.values(usersByName)
                      .filter(
                        (u: any) =>
                          u.name !== (currentUser && currentUser.name) &&
                          u.name
                            .toLowerCase()
                            .includes(playerSearch.toLowerCase())
                      )
                      .slice(0, 8)
                      .map((u: any) => (
                        <div
                          key={u.name}
                          className="ChatScreen-player-result"
                          onClick={() => this._onStartChat(u)}>
                          <span
                            className={
                              "ChatScreen-player-status " + _statusClass(u)
                            }
                            title={_statusLabel(u)}
                          />
                          <UserName user={u} />
                        </div>
                      ))
                  : null}
                {userTabs}
              </div>
            </div>
          </div>
          {modal}
        </div>
      );
    }

    return (
      <div className="ChatScreen">
        <ChatScreenBanner
          conversationsById={conversationsById}
          activeRoom={activeRoom}
          showingRoomUsers={showingRoomUsers}
          activeUser={activeUser}
          onShowList={this._onShowList}
          onShowRoomUsers={this._onShowRoomUsers}
          onShowRoomChat={this._onShowRoomChat}
          onUserDetail={this.props.actions.onUserDetail}
        />
        <div className="ChatScreen-tabs">
          <div className="ChatScreen-tabs-inner" ref={this._setTabsInnerEl}>
            <div
              className="ChatScreen-tabs-section ChatScreen-tabs-section-rooms"
              style={{ flexBasis: roomsPaneHeight }}>
              <div className="ChatScreen-tabs-section-header">
                <span className="ChatScreen-tabs-section-title">Rooms</span>
                <div className="ChatScreen-join-room-btn">
                  <A onClick={this._onShowRoomList}>
                    <Icon name="search" size={11} />
                    Explore
                  </A>
                </div>
              </div>
              <div className="ChatScreen-tabs-section-items">{roomTabs}</div>
            </div>
            <div className="ChatScreen-tabs-section ChatScreen-tabs-section-players">
              {this._renderPlayersHeader()}
              {showingPlayerSearch ? (
                <div className="ChatScreen-player-search">
                  <Icon name="search" size={16} />
                  <input
                    className="ChatScreen-player-search-input"
                    type="text"
                    placeholder="Search players..."
                    value={playerSearch || ""}
                    onChange={this._onPlayerSearch}
                    autoFocus
                  />
                </div>
              ) : null}
              <div className="ChatScreen-player-results">
                {playerSearch && playerSearch.length > 0
                  ? Object.values(usersByName)
                      .filter(
                        (u: any) =>
                          u.name !== (currentUser && currentUser.name) &&
                          u.name
                            .toLowerCase()
                            .includes(playerSearch.toLowerCase())
                      )
                      .slice(0, 8)
                      .map((u: any) => (
                        <div
                          key={u.name}
                          className="ChatScreen-player-result"
                          onClick={() => this._onStartChat(u)}>
                          <span
                            className={
                              "ChatScreen-player-status " + _statusClass(u)
                            }
                            title={_statusLabel(u)}
                          />
                          <UserName user={u} />
                        </div>
                      ))
                  : null}
                {userTabs}
              </div>
            </div>
          </div>
        </div>
        <div className="ChatScreen-active-chat">
          {activeConv && activeUser ? (
            <UserChat
              currentUser={currentUser}
              user={activeUser}
              conversation={activeConv}
              usersByName={usersByName}
              buddies={buddies}
              fans={fans}
              censored={censored}
              roomsById={roomsById}
              actions={actions}
              onUserDetail={actions.onUserDetail}
              onSendChat={this._onSendChat}
              onFriendAdd={actions.onFriendAdd}
              onFriendRemove={actions.onFriendRemove}
              setMessagesDivRef={this._setMessagesDivRef}
              setMessageInputRef={this._setMessageInputRef}
            />
          ) : null}
          {activeConv && activeRoom ? (
            showingRoomUsers ? (
              <div className="ChatScreen-room-users">
                <UserList
                  users={users}
                  buddies={buddies}
                  onSelectUser={this._onUserDetail}
                  onPlayerHover={this.props.actions.onPlayerHover}
                  onPlayerHoverEnd={this.props.actions.onPlayerHoverEnd}
                />
              </div>
            ) : (
              <RoomChat
                currentUser={currentUser}
                room={activeRoom}
                conversation={activeConv}
                usersByName={usersByName}
                buddies={buddies}
                games={activeRoomGames}
                onUserDetail={actions.onUserDetail}
                onShowGames={actions.onShowGames}
                onJoinGame={actions.onJoinGame}
                onSelectChallenge={actions.onSelectChallenge}
                onSendChat={this._onSendChat}
                setMessagesDivRef={this._setMessagesDivRef}
                setMessageInputRef={this._setMessageInputRef}
                actions={actions}
              />
            )
          ) : null}
        </div>
        {modal}
      </div>
    );
  }

  _setMessagesDivRef = (ref: HTMLElement | null) => {
    this._messagesDiv = ref;
  };

  _setMessageInputRef = (ref: HTMLElement | null) => {
    this._messageInput = ref;
  };

  _onToggleFriends = () => {
    this.setState({ showingFriends: !this.state.showingFriends });
  };

  _onChatFriend = (name: string) => {
    this.setState({ showingFriends: false });
    this.props.actions.onUserDetail(name);
  };

  _onSelectConversation = (conversationId: number) => {
    this.setState({ showingList: false });
    this.props.actions.onSelectConversation(conversationId);
  };

  _onCloseConversation = (conversationId: number) => {
    this.props.actions.onCloseConversation(conversationId);
  };

  _onSendChat = (body: string) => {
    let { activeConversationId, activeUser } = this.state;
    if (!activeConversationId) {
      return;
    }
    if (activeUser && (!activeUser.flags || !activeUser.flags.connected)) {
      return;
    }
    this.props.actions.onSendChat(body, activeConversationId);
  };

  _onTogglePlayerSearch = () => {
    this.setState((s) => ({
      showingPlayerSearch: !s.showingPlayerSearch,
      playerSearch: "",
    }));
  };

  _onPlayerSearch = (e: Object) => {
    this.setState({ playerSearch: e.target.value });
  };

  _onStartChat = (user: User) => {
    this.setState({ playerSearch: "" });
    this.props.actions.onStartChat(user);
  };

  _onShowList = () => {
    this.setState({ showingList: true }, () => {
      window.scrollTo(0, 0);
    });
  };

  _onShowRoomUsers = () => {
    this.setState({ showingRoomUsers: true }, () => {
      window.scrollTo(0, 0);
    });
  };

  _onShowRoomChat = () => {
    this.setState({ showingRoomUsers: false }, () => {
      this._setScroll();
    });
  };

  _onShowRoomList = () => {
    this.props.actions.onFetchRoomList();
    this.setState({ showingRoomList: true });
  };

  _onCloseRoomList = () => {
    this.setState({ showingRoomList: false });
  };

  _onJoinRoom = (room: Room) => {
    this._onCloseRoomList();
    this.props.actions.onJoinRoom(room);
  };

  _onUserDetail = (user: User) => {
    this.props.actions.onUserDetail(user.name);
  };
}
