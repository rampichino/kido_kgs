// @flow
import React, { PureComponent as Component } from "react";
import MoreMenu, { applyUiColor, getUiColor } from "./MoreMenu";
import { A, Icon, UnseenBadge, Modal } from "../common";
import ChatUnseenBadge from "../chat/ChatUnseenBadge";
import { getChatNotifySetting } from "./PreferencesModal";
import UserName from "../user/UserName";
import PlayerHoverCard from "../user/PlayerHoverCard";
import { isAncestor, isMobileScreen } from "../../util/dom";
import { InvariantError } from "../../util/error";
import { AppActions } from "../../model";
import { quoteRegExpPattern } from "../../util/string";
import { distinctBy } from "../../util/collection";
import { sortUsers } from "../../model/user";
import FriendsList from "../user/FriendsList";
import { getTheme, applyTheme, nextTheme } from "../../util/theme";
import type { Theme } from "../../util/theme";
import type {
  User,
  NavOption,
  Conversation,
  ChannelMembership,
  GameChannel,
  UnfinishedGame,
  Index,
} from "../../model";

const THEME_ICONS = {
  light: "sun-o",
  mid: "sun-medium",
  dark: "moon-o",
};

// The label describes what the NEXT click switches to (it's a cycle button).
const THEME_LABELS = {
  light: "Switch to mid theme",
  mid: "Switch to dark theme",
  dark: "Switch to light theme",
};

function getRankTier(rank: string): string {
  if (!rank || rank === "-" || rank === "?" || rank === "NR") {
    return "ddk";
  }
  if (/p$/i.test(rank)) {
    return "pro";
  }
  if (/d$/i.test(rank)) {
    const n = parseInt(rank, 10);
    return n >= 4 ? "sdk" : "dan";
  }
  const n = parseInt(rank, 10);
  if (!isNaN(n) && n >= 10) {
    return "ddk";
  }
  return "sdk";
}

function getNavStatusClass(user) {
  if (!user.flags || !user.flags.connected) {
    return "NavSearch-status-dot NavSearch-status-offline";
  }
  if (user.flags.playing) {
    return "NavSearch-status-dot NavSearch-status-playing";
  }
  if (user.flags.sleeping) {
    return "NavSearch-status-dot NavSearch-status-idle";
  }
  return "NavSearch-status-dot NavSearch-status-online";
}

function getNavStatusLabel(user) {
  if (!user.flags || !user.flags.connected) {
    return "Offline";
  }
  if (user.flags.playing) {
    return "Playing";
  }
  if (user.flags.sleeping) {
    return "Idle";
  }
  return "Online";
}

type Props = {
  nav: NavOption,
  currentUser: ?User,
  usersByName: Index<User>,
  conversationsById: Index<Conversation>,
  channelMembership: ChannelMembership,
  activeChallenge: ?GameChannel,
  hasDirectChallenge?: boolean,
  activeGame: ?GameChannel,
  playGameId?: ?number,
  unfinishedGames?: Array<UnfinishedGame>,
  actions: AppActions,
  buddies?: Array<{ name: string, notes: ?string }>,
  fans?: Array<{ name: string, notes: ?string }>,
  censored?: Array<{ name: string, notes: ?string }>,
  buddyPresenceSettling?: boolean,
  unreadMailboxCount?: number,
};

type State = {
  showingMoreMenu: boolean,
  showingFriends: boolean,
  theme: Theme,
  searchQuery: string,
  searchFocused: boolean,
};

export default class Nav extends Component<Props, State> {
  state = {
    showingMoreMenu: false,
    showingFriends: false,
    searchQuery: "",
    searchFocused: false,
    theme: getTheme(),
  };

  _moreEl: any;

  _onDocumentClick = (e: Object) => {
    if (this.state.showingMoreMenu && this._moreEl) {
      if (e.target !== this._moreEl && !isAncestor(e.target, this._moreEl)) {
        if (!document.querySelector(".Modal")) {
          this.setState({ showingMoreMenu: false });
        }
      }
    }
  };

  componentDidMount() {
    document.addEventListener("click", this._onDocumentClick);
    // Ensure the persisted theme is applied on mount (index.js also applies it
    // at first paint; this keeps body classes in sync if state changed).
    applyTheme(this.state.theme);
  }

  componentWillUnmount() {
    document.removeEventListener("click", this._onDocumentClick);
  }

  render() {
    let {
      nav,
      currentUser,
      usersByName,
      conversationsById,
      channelMembership,
      activeChallenge,
      hasDirectChallenge,
      playGameId,
      unfinishedGames,
      actions,
      unreadMailboxCount,
    } = this.props;
    let { showingMoreMenu, showingFriends, theme, searchQuery, searchFocused } =
      this.state;

    const isViewingGame = !!(nav === "play" && playGameId);
    const showResumeGame = !!(
      (playGameId && nav !== "play") ||
      (!playGameId && unfinishedGames && unfinishedGames.length > 0)
    );
    const hasGameActions = isViewingGame || showResumeGame;

    const chatNotify = getChatNotifySetting();
    let unseenDmCount = 0;
    if (chatNotify !== "none") {
      for (let id of Object.keys(conversationsById)) {
        let chan = channelMembership[id];
        if (chan && chan.type === "conversation") {
          let convo = conversationsById[id];
          if (convo.unseenCount) {
            unseenDmCount += convo.unseenCount;
          }
        }
      }
    }

    let searchResults = [];
    if (searchQuery.trim().length > 0) {
      let queryRe = new RegExp(quoteRegExpPattern(searchQuery), "i");
      searchResults = Object.keys(usersByName)
        .filter((name) => queryRe.test(name))
        .map((name) => usersByName[name]);
      searchResults = distinctBy(searchResults, (u) => u.name);
      sortUsers(searchResults, this.props.buddies);
      searchResults = searchResults.slice(0, 8);
    }
    let showDropdown = searchFocused && searchResults.length > 0;
    if (!currentUser) {
      throw new InvariantError("currentUser is required");
    }
    let challengeConversation = activeChallenge
      ? conversationsById[activeChallenge.id]
      : null;
    // The Play-tab dot lights up for an incoming direct challenge, or for a
    // challenge the user created that has new proposals / unseen chat.
    let showPlayDot =
      !!hasDirectChallenge ||
      (!!activeChallenge &&
        (activeChallenge.receivedProposals
          ? activeChallenge.receivedProposals.length
          : 0) +
          ((challengeConversation && challengeConversation.unseenCount) || 0) >
          0);
    return (
      <div className="MainNav" onClickCapture={this._onNavClickCapture}>
        <div className="MainNav-inner">
          <div
            className={
              "MainNav-logo" + (isViewingGame ? " MainNav-logo-back" : "")
            }>
            {isViewingGame ? (
              <A onClick={this._onBackClick} className="MainNav-logo-link">
                <img src="/logo.svg" alt="Kido" />
                <span className="MainNav-logo-text">Kido</span>
              </A>
            ) : (
              <div className="MainNav-logo-link">
                <img src="/logo.svg" alt="Kido" />
                <span className="MainNav-logo-text">Kido</span>
              </div>
            )}
          </div>
          <div className="MainNav-tabs">
            <div
              className={
                "MainNav-item" +
                (nav === "play" ? " MainNav-item-selected" : "")
              }>
              <A onClick={this._onNavPlay}>
                <div className="MainNav-item-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round">
                    <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
                    <line x1="13" x2="19" y1="19" y2="13" />
                    <line x1="16" x2="20" y1="16" y2="20" />
                    <line x1="19" x2="21" y1="21" y2="19" />
                    <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
                    <line x1="5" x2="9" y1="14" y2="18" />
                    <line x1="7" x2="4" y1="17" y2="20" />
                    <line x1="3" x2="5" y1="19" y2="21" />
                  </svg>
                </div>
                <div className="MainNav-item-label">Play</div>
                {nav === "play" || !showPlayDot ? null : (
                  <div className="MainNav-item-badge">
                    <span className="MainNav-item-badge-dot" />
                  </div>
                )}
              </A>
            </div>
            <div
              className={
                "MainNav-item" +
                (nav === "watch" ? " MainNav-item-selected" : "")
              }>
              <A onClick={this._onNavWatch}>
                <div className="MainNav-item-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round">
                    <path d="M10 10h4" />
                    <path d="M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3" />
                    <path d="M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2z" />
                    <path d="M 22 16 L 2 16" />
                    <path d="M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2z" />
                    <path d="M9 7V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3" />
                  </svg>
                </div>
                <div className="MainNav-item-label">Watch</div>
              </A>
            </div>
            <div
              className={
                "MainNav-item MainNav-item-mygames" +
                (nav === "mygames" ? " MainNav-item-selected" : "")
              }>
              <A onClick={this._onNavMyGames}>
                <div className="MainNav-item-icon">
                  <Icon name="library" size={18} />
                </div>
                <div className="MainNav-item-label">My Games</div>
              </A>
            </div>
            <div
              className={
                "MainNav-item" +
                (nav === "chat" ? " MainNav-item-selected" : "")
              }>
              <A onClick={this._onNavChat}>
                <div className="MainNav-item-icon">
                  <Icon name="messages-square" size={18} />
                </div>
                <div className="MainNav-item-label">Chats</div>
                {nav === "chat" ? null : (
                  <div className="MainNav-item-badge">
                    <ChatUnseenBadge
                      conversationsById={conversationsById}
                      channelMembership={channelMembership}
                    />
                  </div>
                )}
              </A>
            </div>
            <div
              className={
                "MainNav-item MainNav-item-search" +
                (nav === "search" ? " MainNav-item-selected" : "")
              }>
              <A onClick={this._onNavSearch}>
                <div className="MainNav-item-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round">
                    <path d="m21 21-4.34-4.34" />
                    <circle cx="11" cy="11" r="8" />
                  </svg>
                </div>
                <div className="MainNav-item-label">Search</div>
              </A>
            </div>
            <div className="MainNav-search">
              <div className="MainNav-search-icon">
                <Icon name="search" />
              </div>
              <input
                className="MainNav-search-input"
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={this._onSearchChange}
                onFocus={this._onSearchFocus}
                onBlur={this._onSearchBlur}
                onKeyDown={this._onSearchKeyDown}
                autoCorrect="off"
                autoCapitalize="none"
              />
              {showDropdown && (
                <div className="MainNav-search-dropdown">
                  {searchResults.map((user) => (
                    <div
                      key={user.name}
                      className="MainNav-search-result"
                      onMouseDown={() => this._onSelectUser(user)}>
                      <span
                        className={getNavStatusClass(user)}
                        title={getNavStatusLabel(user)}
                      />
                      <PlayerHoverCard
                        user={user}
                        onHover={this.props.actions.onPlayerHover}
                        onHoverEnd={this.props.actions.onPlayerHoverEnd}>
                        {user.name}
                      </PlayerHoverCard>
                      {user.rank ? (
                        <span
                          className={`UserName-rank-chip UserName-rank-chip-${getRankTier(
                            user.rank
                          )}`}>
                          {user.rank}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {(() => {
              const buddies = this.props.buddies || [];
              const onlineCount = buddies.filter((b) => {
                const u = usersByName[b.name];
                return u && u.flags && u.flags.connected;
              }).length;
              // While the login-time presence refresh is still settling, hide the
              // count so it never flashes a too-high number from the stale login
              // snapshot before offline buddies drop off.
              const showCount =
                !this.props.buddyPresenceSettling && onlineCount > 0;
              return (
                <div className="MainNav-friends-wrapper">
                  <button
                    className={
                      "MainNav-friends-btn" +
                      (showingFriends ? " MainNav-friends-btn-active" : "") +
                      (showCount ? " MainNav-friends-btn-online" : "")
                    }
                    onClick={this._onToggleFriends}
                    title="Friends">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round">
                      <path d="M18 21a8 8 0 0 0-16 0" />
                      <circle cx="10" cy="8" r="5" />
                      <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
                    </svg>
                    {showCount ? (
                      <span className="MainNav-friends-badge">
                        {onlineCount}
                      </span>
                    ) : null}
                  </button>
                  {showingFriends &&
                    (() => {
                      const friendsList = (
                        <FriendsList
                          buddies={buddies}
                          fans={this.props.fans || []}
                          censored={this.props.censored || []}
                          usersByName={usersByName}
                          onUserDetail={this._onFriendDetail}
                          onChat={this._onFriendChat}
                          actions={actions}
                        />
                      );
                      // On mobile the dropdown becomes a full-screen modal
                      // (like the other mobile modals); desktop keeps the
                      // anchored dropdown panel.
                      return isMobileScreen() ? (
                        <Modal title="Friends" onClose={this._onCloseFriends}>
                          {friendsList}
                        </Modal>
                      ) : (
                        <div className="MainNav-friends-panel">
                          {friendsList}
                        </div>
                      );
                    })()}
                </div>
              );
            })()}
            <div
              className={
                "MainNav-game-actions" +
                (hasGameActions ? " MainNav-game-actions-visible" : "")
              }>
              {isViewingGame ? (
                <A
                  className="MainNav-leave-game-btn"
                  onClick={this._onBackClick}
                  title="Close game and return to list">
                  <Icon name="log-out" />
                  <span className="MainNav-leave-game-label">Close Game</span>
                </A>
              ) : null}
              {(playGameId && nav !== "play") ||
              (!playGameId && unfinishedGames && unfinishedGames.length > 0) ? (
                <A
                  className="MainNav-active-game-btn"
                  onClick={this._onResumeGame}
                  title="Resume your active game">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    className="MainNav-go-stones-icon">
                    {/* Black stone — top-left, dark green */}
                    <circle
                      cx="7"
                      cy="7"
                      r="6"
                      fill="#15803d"
                      stroke="rgba(0,0,0,0.2)"
                      strokeWidth="0.5"
                    />
                    {/* White stone — bottom-right, light green */}
                    <circle
                      cx="13"
                      cy="13"
                      r="6"
                      fill="rgba(220,252,231,0.9)"
                      stroke="rgba(21,128,61,0.4)"
                      strokeWidth="1"
                    />
                    {/* Highlight on white stone */}
                    <circle
                      cx="11.5"
                      cy="11.5"
                      r="1.8"
                      fill="white"
                      opacity="0.5"
                    />
                  </svg>
                  <span className="MainNav-active-game-label">Resume Game</span>
                </A>
              ) : null}
            </div>
            <div
              className={
                "MainNav-item MainNav-item-more " +
                (nav === "more" ? " MainNav-item-selected" : "")
              }>
              <A onClick={this._onNavMore}>
                <div className="MainNav-item-icon">
                  <Icon name="bars" />
                </div>
                <div className="MainNav-item-label">More</div>
              </A>
            </div>
          </div>
          <div
            className={
              "MainNav-account" +
              (showingMoreMenu ? " MainNav-account-showing-menu" : "")
            }
            ref={this._setMoreEl}>
            {unreadMailboxCount && unreadMailboxCount > 0 ? (
              <A
                className="MainNav-mail-trigger"
                onClick={() => actions.onShowLeaveMessageModal()}
                title="New mailbox messages">
                <Icon name="mail" size={18} />
                <div className="MainNav-mail-badge">
                  <UnseenBadge minorCount={unreadMailboxCount} />
                </div>
              </A>
            ) : null}
            <A
              className="MainNav-account-trigger"
              onClick={this._onToggleMoreMenu}>
              {unseenDmCount > 0 && (
                <span className="MainNav-account-dm-icon" title="New messages">
                  <Icon name="message-circle" size={14} />
                </span>
              )}
              <UserName user={currentUser} />
              <div className="MainNav-account-trigger-icon">
                <Icon name="chevron-down" />
              </div>
            </A>
            {showingMoreMenu ? (
              <div className="MainNav-more-menu">
                <MoreMenu currentUser={currentUser} actions={actions} />
              </div>
            ) : null}
          </div>
          <button
            className={"MainNav-theme-toggle MainNav-theme-toggle-" + theme}
            onClick={this._onCycleTheme}
            title={THEME_LABELS[theme]}
            aria-label={THEME_LABELS[theme]}>
            <span className="MainNav-theme-toggle-track">
              <span className="MainNav-theme-toggle-thumb">
                <Icon name={THEME_ICONS[theme]} />
              </span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  _onNavWatch = () => this.props.actions.onChangeNav("watch");
  _onNavMyGames = () => this.props.actions.onChangeNav("mygames");
  _onNavPlay = () => this.props.actions.onChangeNav("play");
  _onNavChat = () => this.props.actions.onChangeNav("chat");
  _onNavSearch = () => this.props.actions.onChangeNav("search");
  _onNavMore = () => this.props.actions.onChangeNav("more");

  _onSearchChange = (e: Object) => {
    this.setState({ searchQuery: e.target.value });
  };

  _onSearchFocus = () => {
    this.setState({ searchFocused: true });
  };

  _onSearchBlur = () => {
    setTimeout(() => this.setState({ searchFocused: false }), 150);
  };

  _onSearchKeyDown = (e: Object) => {
    if (e.key === "Enter") {
      let { searchQuery } = this.state;
      if (searchQuery.trim()) {
        this.props.actions.onUserDetail(searchQuery.trim().toLowerCase());
        this.setState({ searchQuery: "", searchFocused: false });
      }
    } else if (e.key === "Escape") {
      this.setState({ searchQuery: "", searchFocused: false });
    }
  };

  _onSelectUser = (user: User) => {
    this.props.actions.onUserDetail(user.name);
    this.setState({ searchQuery: "", searchFocused: false });
  };
  _onBackClick = () => {
    if (this.props.activeGame) {
      this.props.actions.onRequestLeaveGame(this.props.activeGame);
      document.body && document.body.classList.remove("zen-mode");
    }
  };
  _onReturnToGame = () => {
    this.props.actions.onChangeNav("play");
  };
  _onResumeGame = () => {
    let { playGameId, unfinishedGames, actions } = this.props;
    if (playGameId) {
      this._onReturnToGame();
    } else if (unfinishedGames && unfinishedGames.length > 0) {
      let firstGame = unfinishedGames[0];
      if (firstGame.type === "channel") {
        actions.onJoinGame(firstGame.game.id);
      } else if (firstGame.type === "summary" && firstGame.game.inPlay) {
        actions.onJoinGame(firstGame.game.timestamp);
      }
    }
  };

  _setMoreEl = (el: HTMLElement | null) => {
    this._moreEl = el;
  };

  _onToggleMoreMenu = () => {
    this.setState({ showingMoreMenu: !this.state.showingMoreMenu });
  };

  _onToggleFriends = () => {
    let opening = !this.state.showingFriends;
    this.setState({ showingFriends: opening });
    // Buddy presence goes stale between shared channels (KGS only pushes it for
    // users we share a room/game with), so pull fresh online/offline status for
    // the whole list each time the panel is opened.
    if (opening && this.props.actions.onRefreshBuddyPresence) {
      this.props.actions.onRefreshBuddyPresence();
    }
  };

  _onCloseFriends = () => {
    this.setState({ showingFriends: false });
  };

  // On mobile the nav bar stays visible above full-screen modals. Tapping it
  // dismisses an open modal instead of acting on the nav item — by clicking that
  // modal's own close button, which works for every modal (the challenge modal
  // ignores Escape, so a keypress wouldn't close it). Capture phase so it runs
  // before the tab/button handlers.
  _onNavClickCapture = (e: Object) => {
    if (!isMobileScreen()) {
      return;
    }
    // Modals render through a portal (into <body>), but their clicks still
    // bubble up the React tree to this capture handler. Only act on genuine
    // nav-bar taps — otherwise we'd hijack a modal's own close button / content
    // (their DOM target isn't inside .MainNav).
    let t = e.target;
    if (!t || typeof t.closest !== "function" || !t.closest(".MainNav")) {
      return;
    }
    let closeButtons = document.querySelectorAll(
      ".Modal-close, .ScreenModal-close, .UserDetailsModal-close"
    );
    if (!closeButtons.length) {
      return;
    }
    // The topmost modal is the last one rendered into the portal root.
    let topClose: any = closeButtons[closeButtons.length - 1];
    topClose.click();
    e.preventDefault();
    e.stopPropagation();
  };

  _onFriendDetail = (name: string) => {
    this.setState({ showingFriends: false });
    this.props.actions.onUserDetail(name);
  };

  _onFriendChat = (name: string) => {
    this.setState({ showingFriends: false });
    this.props.actions.onUserDetail(name);
  };

  _onCycleTheme = () => {
    const theme = nextTheme(this.state.theme);
    this.setState({ theme });
    applyTheme(theme);
    // Each theme has its own accent presets and default, so re-apply the new
    // theme's stored/default UI color (getUiColor resolves it per theme).
    applyUiColor(getUiColor());
  };
}
