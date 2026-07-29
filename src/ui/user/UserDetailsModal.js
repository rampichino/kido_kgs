// @flow
import React, { PureComponent as Component } from "react";
import localeString from "locale-string";
import get from "lodash.get";
import { A, Button, RichContent, Modal } from "../common";
import { Icon } from "../common/Icon";
import UserName from "./UserName";
import UserAvatar from "./UserAvatar";
import UserDetailsEditForm from "./UserDetailsEditForm";
import UserGameSummary from "./UserGameSummary";
import GameSummaryList from "../game/GameSummaryList";
import UserRankGraph from "./UserRankGraph";
import {
  getUserStatusText,
  getUserStatusKind,
  getUserAuthName,
} from "../../model/user";
import { isAncestor } from "../../util/dom";
import { timeAgo } from "../../util/date";
import { InvariantError } from "../../util/error";
import type {
  UserDetailsRequest,
  User,
  UserDetails,
  GameSummary,
  RankGraph,
  Index,
  AppActions,
  Conversation,
  Room,
} from "../../model";

const GAMES_PER_PAGE = 6;

type Props = {
  currentUser: ?User,
  userDetailsRequest: ?UserDetailsRequest,
  usersByName: Index<User>,
  rankGraphsByChannelId: Index<RankGraph>,
  gameSummariesByUser: Index<Array<GameSummary>>,
  actions: AppActions,
  conversationsById: Index<Conversation>,
  roomsById: Index<Room>,
  activeConversationId: ?number,
  reviewGameId: ?number,
  buddies?: Array<{ name: string, notes: ?string }>,
  fans?: Array<{ name: string, notes: ?string }>,
  censored?: Array<{ name: string, notes: ?string }>,
};

type State = {
  tab: "bio" | "games" | "rankGraph",
  editing: boolean,
  showGameSummaryModal: boolean,
  gameToLoad?: GameSummary,
  gamesPage: number,
};

export default class UserDetailsModal extends Component<Props, State> {
  state = {
    tab: "bio",
    editing: false,
    showGameSummaryModal: false,
    gameToLoad: undefined,
    gamesPage: 0,
  };

  _mainDiv: ?HTMLElement;

  componentDidMount() {
    document.addEventListener("keyup", this._onKeyUp);
    if (document.body) {
      document.body.classList.add("no-scroll");
    }
  }

  componentWillUnmount() {
    document.removeEventListener("keyup", this._onKeyUp);
    if (document.body) {
      document.body.classList.remove("no-scroll");
    }
  }

  componentDidUpdate(prevProps: Props) {
    const prevName =
      prevProps.userDetailsRequest && prevProps.userDetailsRequest.name;
    const currentName =
      this.props.userDetailsRequest && this.props.userDetailsRequest.name;
    if (prevName !== currentName) {
      this.setState({ gamesPage: 0, tab: "games" });
    }
  }

  // Auth badge (Senior Admin / Teacher / …) + joined date + country. Lives at
  // the top of the Bio panel on every breakpoint.
  _renderMetadataLine(user: Object, details: Object, extraClass: string) {
    let authName = getUserAuthName(user);
    let locale: Object = localeString.parse(details.locale.replace("_", "-"));
    let cc = details.locale.split(/[_-]/)[1];
    let countryCode = cc && cc.length === 2 ? cc.toLowerCase() : null;
    return (
      <div className={"UserDetailsModal-metadata-line " + extraClass}>
        {authName ? (
          <div className="UserDetailsModal-authname">
            {(user.authLevel === "jr_admin" ||
              user.authLevel === "sr_admin" ||
              user.authLevel === "super_admin") && (
              <Icon
                name="shield-check"
                size={12}
                className={
                  user.authLevel === "jr_admin"
                    ? "UserIcons-jr-admin"
                    : user.authLevel === "sr_admin"
                      ? "UserIcons-sr-admin"
                      : "UserIcons-super-admin"
                }
              />
            )}
            {user.authLevel === "teacher" && (
              <Icon name="book-open" size={12} className="UserIcons-teacher" />
            )}
            {authName}
          </div>
        ) : null}
        <div className="UserDetailsModal-info-bullet UserDetailsModal-joined">
          <Icon name="calendar-check" size={13} />
          <span>Joined {timeAgo(new Date(details.regStartDate))}</span>
        </div>
        {locale ? (
          <div className="UserDetailsModal-info-bullet UserDetailsModal-locale">
            {countryCode ? (
              <span
                className={"fi fi-" + countryCode + " UserDetailsModal-flag"}
              />
            ) : (
              <Icon name="globe" size={13} />
            )}
            <span>{locale.country.replace("United States", "US")}</span>
          </div>
        ) : null}
      </div>
    );
  }

  render() {
    let {
      currentUser,
      userDetailsRequest,
      usersByName,
      gameSummariesByUser,
      rankGraphsByChannelId,
      actions,
      conversationsById,
      roomsById,
      activeConversationId,
      reviewGameId,
      buddies = [],
      fans = [],
      censored = [],
    } = this.props;
    if (!currentUser || !userDetailsRequest) {
      throw new InvariantError("currentUser and userDetailsRequest required");
    }
    let tab = this.state.tab;
    let { editing, showGameSummaryModal, gameToLoad, gamesPage } = this.state;
    let content;
    let offline;
    let user = usersByName[userDetailsRequest.name];
    let gameSummaries = gameSummariesByUser[userDetailsRequest.name];
    if (gameSummaries) {
      const maxPage = Math.max(
        0,
        Math.ceil(gameSummaries.length / GAMES_PER_PAGE) - 1
      );
      if (gamesPage > maxPage) {
        gamesPage = maxPage;
      }
    }
    let details = user && user.details;
    let channelId = details && details.channelId;
    let persName =
      details && details.personalName && details.personalName !== user.name
        ? details.personalName
        : null;
    let isCurrentUserGuest = !!(
      currentUser &&
      currentUser.flags &&
      currentUser.flags.guest
    );

    if (editing && user && user.details && details) {
      return (
        <Modal title="Edit Profile" onClose={this._onDoneEditing}>
          <UserDetailsEditForm
            user={user}
            details={details}
            onSave={this._onSaveUserDetails}
            onCancel={this._onDoneEditing}
          />
        </Modal>
      );
    }

    if (showGameSummaryModal && gameToLoad) {
      let rooms = Object.keys(conversationsById).map(
        (roomId) => roomsById[roomId]
      );

      return (
        <Modal title="Game Summary" onClose={this._onCloseGameLoadModal}>
          <UserGameSummary
            activeConversationId={activeConversationId}
            game={gameToLoad}
            onLoadGame={this.props.actions.onLoadGame}
            onCloseUserDetail={this.props.actions.onCloseUserDetail}
            onJoinGame={this.props.actions.onJoinGame}
            onLeaveGame={this.props.actions.onLeaveGame}
            reviewGameId={reviewGameId}
            rooms={rooms}
          />
        </Modal>
      );
    }

    // The server tells us a player has no fetchable profile via
    // DETAILS_NONEXISTANT (stamped as `detailsNotFound`, or surfaced as the
    // request status). This is the normal case for an offline guest from an old
    // game — their ephemeral account is gone. Show a short note instead of a
    // spinner or a bare "User not found".
    let noProfile =
      !details &&
      ((user && user.detailsNotFound) ||
        userDetailsRequest.status === "nonexistant");

    if (user && noProfile) {
      offline = true;
      content = (
        <div className="UserDetailsModal-guest-note">
          This guest account no longer exists.
        </div>
      );
    } else if (user) {
      offline = user.flags && !user.flags.connected;
      if (details) {
        let bio = details.personalInfo ? details.personalInfo.trim() : "";
        // Guests have no rank, so the rank graph tab is meaningless for them.
        let isGuest = !!(user.flags && user.flags.guest);

        // Bio is the default tab and always shown (empty if the user has none).
        // Games / Rank load only when their tab is opened. The only forced
        // switch left: a guest has no rank graph, so fall back to Bio.
        if (tab === "rankGraph" && isGuest) {
          tab = "bio";
        }

        content = (
          <div className="UserDetailsModal-user-info">
            {
              <div className="UserDetailsModal-tabs-container">
                <div className="UserDetailsModal-tabs">
                  <div className="UserDetailsModal-tabs-inner">
                    <A
                      className={
                        "UserDetailsModal-tab" +
                        (tab === "bio" ? " UserDetailsModal-tab-active" : "")
                      }
                      onClick={this._onShowBio}>
                      Bio
                    </A>
                    <A
                      className={
                        "UserDetailsModal-tab" +
                        (tab === "games" ? " UserDetailsModal-tab-active" : "")
                      }
                      onClick={this._onShowGames}>
                      {gameSummaries ? (
                        <span className="UserDetailsModal-tab-count">
                          {gameSummaries.length}
                        </span>
                      ) : null}
                      Games
                    </A>
                    {isGuest ? null : (
                      <A
                        className={
                          "UserDetailsModal-tab" +
                          (tab === "rankGraph"
                            ? " UserDetailsModal-tab-active"
                            : "")
                        }
                        onClick={this._onShowRankGraph}>
                        Rank
                      </A>
                    )}
                  </div>
                </div>
                <div className="UserDetailsModal-tab-content">
                  {tab === "bio" ? (
                    <React.Fragment>
                      {this._renderMetadataLine(
                        user,
                        details,
                        "UserDetailsModal-metadata-line-bio"
                      )}
                      {bio ? (
                        <div className="UserDetailsModal-bio">
                          <RichContent content={bio} />
                        </div>
                      ) : (
                        <div className="UserDetailsModal-bio UserDetailsModal-bio-empty">
                          No bio.
                        </div>
                      )}
                    </React.Fragment>
                  ) : null}
                  {tab === "games" && !gameSummaries ? (
                    <div className="UserDetailsModal-tab-loading">
                      <div className="BoardLoading">
                        <div className="BoardLoading-dot" />
                        <div className="BoardLoading-dot" />
                        <div className="BoardLoading-dot" />
                      </div>
                    </div>
                  ) : null}
                  {gameSummaries && gameSummaries.length && tab === "games" ? (
                    <div className="UserDetailsModal-games-list-container">
                      <div className="UserDetailsModal-games-list">
                        <GameSummaryList
                          games={gameSummaries.slice(
                            gamesPage * GAMES_PER_PAGE,
                            (gamesPage + 1) * GAMES_PER_PAGE
                          )}
                          player={user.name}
                          onSelect={this._onSelectGame}
                        />
                      </div>
                      {gameSummaries.length > GAMES_PER_PAGE ? (
                        <div className="UserDetailsModal-pagination">
                          <button
                            className="Button Button-muted UserDetailsModal-pagination-btn"
                            disabled={gamesPage === 0}
                            onClick={this._onPrevGamesPage}
                            title="Previous Page">
                            <Icon name="chevron-left" size={14} />
                          </button>
                          <span className="UserDetailsModal-pagination-info">
                            Page {gamesPage + 1} of{" "}
                            {Math.ceil(gameSummaries.length / GAMES_PER_PAGE)}
                          </span>
                          <button
                            className="Button Button-muted UserDetailsModal-pagination-btn"
                            disabled={
                              (gamesPage + 1) * GAMES_PER_PAGE >=
                              gameSummaries.length
                            }
                            onClick={this._onNextGamesPage}
                            title="Next Page">
                            <Icon name="chevron-right" size={14} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {tab === "games" &&
                  gameSummaries &&
                  gameSummaries.length === 0 ? (
                    <div className="UserDetailsModal-bio UserDetailsModal-bio-empty">
                      No games.
                    </div>
                  ) : null}
                  {tab === "rankGraph" && !isGuest ? (
                    get(rankGraphsByChannelId, channelId) ? (
                      <div className="UserDetailsModal-rank-graph">
                        <UserRankGraph
                          graph={get(rankGraphsByChannelId, channelId)}
                        />
                      </div>
                    ) : (
                      <div className="UserDetailsModal-tab-loading">
                        <div className="BoardLoading">
                          <div className="BoardLoading-dot" />
                          <div className="BoardLoading-dot" />
                          <div className="BoardLoading-dot" />
                        </div>
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            }
          </div>
        );
      } else {
        content = (
          <div className="UserDetailsModal-loading">
            <div className="BoardLoading">
              <div className="BoardLoading-dot" />
              <div className="BoardLoading-dot" />
              <div className="BoardLoading-dot" />
            </div>
          </div>
        );
      }
    } else if (userDetailsRequest.status === "pending") {
      content = (
        <div className="UserDetailsModal-loading">
          <div className="BoardLoading">
            <div className="BoardLoading-dot" />
            <div className="BoardLoading-dot" />
            <div className="BoardLoading-dot" />
          </div>
        </div>
      );
    } else {
      content = (
        <div className="UserDetailsModal-not-found">User not found</div>
      );
    }

    return (
      <div className="UserDetailsModal" onClick={this._onMaybeClose}>
        <div className="UserDetailsModal-main" ref={this._setMainRef}>
          <div className="UserDetailsModal-top-bar">
            <A
              className="UserDetailsModal-close"
              onClick={actions.onCloseUserDetail}>
              <Icon name="x" size={18} />
            </A>
            <div className="UserDetailsModal-avatar">
              <UserAvatar user={user} />
            </div>
            <div className="UserDetailsModal-top-bar-info">
              <div className="UserDetailsModal-name">
                {user ? (
                  <UserName
                    user={user}
                    extraIcons
                    extraIconsSize={17}
                    showFriendStar={false}
                    isBuddy={buddies.some((b) => b.name === user.name)}
                    onToggleBuddy={() => {
                      if (buddies.some((b) => b.name === user.name)) {
                        actions.onFriendRemove(user.name, "buddy");
                      } else {
                        actions.onFriendAdd(user.name, "buddy");
                      }
                    }}
                  />
                ) : (
                  userDetailsRequest.name
                )}
              </div>
              {persName ? (
                <div className="UserDetailsModal-realname-header">
                  {persName}
                </div>
              ) : null}
              <div className="UserDetailsModal-status">
                {user ? (
                  <span
                    className={
                      "UserDetailsModal-status-dot UserDetailsModal-status-" +
                      getUserStatusKind(user)
                    }
                    title={getUserStatusText(user)}
                  />
                ) : null}
                {user
                  ? getUserStatusText(user) +
                    (offline && user.details
                      ? " · last on " + timeAgo(new Date(user.details.lastOn))
                      : "")
                  : null}
              </div>
            </div>
            {user && !noProfile ? (
              <div className="UserDetailsModal-actions">
                {user && user.name !== currentUser.name ? (
                  <React.Fragment>
                    {user.flags && user.flags.connected ? (
                      <React.Fragment>
                        {/* No challenge while they're already in a game. */}
                        {user.flags.playing ||
                        user.flags.playingTourney ? null : (
                          <Button
                            icon="swords"
                            secondary
                            onClick={this._onCreateDirectChallenge}
                            title={"Challenge " + user.name}
                          />
                        )}
                        <Button
                          icon="message-square"
                          secondary
                          onClick={this._onStartChat}
                          title="Message"
                        />
                      </React.Fragment>
                    ) : (
                      <Button
                        icon="mail"
                        secondary
                        onClick={() =>
                          actions.onShowLeaveMessageModal(user.name)
                        }
                        title="Leave Message"
                      />
                    )}
                    {!isCurrentUserGuest ? (
                      <div className="UserDetailsModal-divider" />
                    ) : null}
                    {!isCurrentUserGuest &&
                      (() => {
                        const isBuddy = buddies.some(
                          (b) => b.name === user.name
                        );
                        const isFan = fans.some((f) => f.name === user.name);
                        const isCensored = censored.some(
                          (c) => c.name === user.name
                        );
                        return (
                          <React.Fragment>
                            <Button
                              icon={isBuddy ? "heart" : "heart-o"}
                              secondary={!isBuddy}
                              warning={isBuddy}
                              onClick={() => {
                                if (isBuddy) {
                                  actions.onFriendRemove(user.name, "buddy");
                                } else {
                                  actions.onFriendAdd(user.name, "buddy");
                                }
                              }}
                              title={isBuddy ? "Remove Friend" : "Add Friend"}
                            />
                            <Button
                              icon={isFan ? "star" : "star-o"}
                              secondary={!isFan}
                              warning={isFan}
                              onClick={() => {
                                if (isFan) {
                                  actions.onFriendRemove(user.name, "fan");
                                } else {
                                  actions.onFriendAdd(user.name, "fan");
                                }
                              }}
                              title={isFan ? "Unfollow" : "Follow"}
                            />
                            <Button
                              icon="ban"
                              secondary={!isCensored}
                              danger={isCensored}
                              onClick={() => {
                                if (isCensored) {
                                  actions.onFriendRemove(user.name, "censored");
                                } else {
                                  actions.onFriendAdd(user.name, "censored");
                                }
                              }}
                              title={isCensored ? "Unblock" : "Block"}
                            />
                          </React.Fragment>
                        );
                      })()}
                  </React.Fragment>
                ) : user && user.name === currentUser.name ? (
                  <div className="UserDetailsModal-edit-button">
                    <Button icon="pencil" secondary onClick={this._onEdit}>
                      Edit Profile
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="UserDetailsModal-details">{content}</div>
        </div>
      </div>
    );
  }

  _setMainRef = (ref: HTMLElement | null) => {
    this._mainDiv = ref;
  };

  _onKeyUp = (e: Object) => {
    if (e.key === "Escape" || e.keyCode === 27) {
      this.props.actions.onCloseUserDetail();
    }
  };

  _onMaybeClose = (e: Object) => {
    let insideModal =
      this._mainDiv &&
      (e.target === this._mainDiv || isAncestor(e.target, this._mainDiv));
    if (insideModal) {
      return;
    }
    this.props.actions.onCloseUserDetail();
  };

  _onShowBio = () => {
    this.setState({ tab: "bio", gamesPage: 0 });
  };

  _onShowGames = () => {
    const { actions, userDetailsRequest, gameSummariesByUser } = this.props;
    // Load the archive on first open of the Games tab (not already fetched).
    let name = userDetailsRequest && userDetailsRequest.name;
    if (name && !gameSummariesByUser[name]) {
      actions.onRequestArchive(name);
    }
    this.setState({ tab: "games", gamesPage: 0 });
  };

  _onShowRankGraph = () => {
    const { actions, userDetailsRequest, usersByName } = this.props;

    const user = userDetailsRequest && usersByName[userDetailsRequest.name];
    const channelId: number = Number(
      user && user.details && user.details.channelId
    );

    actions.onRequestRankGraph(channelId);
    this.setState({ tab: "rankGraph", gamesPage: 0 });
  };

  _onPrevGamesPage = () => {
    this.setState((state) => ({
      gamesPage: Math.max(0, state.gamesPage - 1),
    }));
  };

  _onNextGamesPage = () => {
    this.setState((state) => ({
      gamesPage: state.gamesPage + 1,
    }));
  };

  _onSelectGame = (game: GameSummary) => {
    if (game.inPlay) {
      this.props.actions.onCloseUserDetail();

      if (game.type === "review" && this.props.reviewGameId) {
        this.props.actions.onJoinGame(this.props.reviewGameId);
      } else {
        this.props.actions.onJoinGame(game.timestamp);
      }
    } else {
      this.setState({ showGameSummaryModal: true, gameToLoad: game });
    }
  };

  _onCreateDirectChallenge = () => {
    let { userDetailsRequest, actions } = this.props;
    if (userDetailsRequest && actions) {
      actions.onCloseUserDetail();
      actions.onStartCreateChallenge(userDetailsRequest.name);
    }
  };

  _onStartChat = () => {
    let { userDetailsRequest, usersByName } = this.props;
    if (userDetailsRequest) {
      let user = usersByName[userDetailsRequest.name];
      if (user) {
        this.props.actions.onStartChat(user);
      }
    }
  };

  _onEdit = () => {
    this.setState({ editing: true });
  };

  _onDoneEditing = () => {
    this.setState({ editing: false });
  };

  _onSaveUserDetails = (
    user: User,
    details: UserDetails,
    newPassword: string
  ) => {
    this.props.actions.onUpdateProfileDetails(user, details);
    if (newPassword) {
      this.props.actions.onUpdatePassword(user, newPassword);
    }
    this._onDoneEditing();
  };

  _onCloseGameLoadModal = () => {
    this.setState({ showGameSummaryModal: false });
  };
}
