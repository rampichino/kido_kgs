// @flow
import React, { PureComponent as Component } from "react";
import Nav from "./meta/Nav";
import OfflineAlert from "./meta/OfflineAlert";
import UnderConstructionModal from "./meta/UnderConstructionModal";
import FeedbackModal from "./meta/FeedbackModal";
import LeaveMessageModal from "./meta/LeaveMessageModal";
import WatchScreen from "./WatchScreen";
import PlayScreen from "./PlayScreen";
import MyGamesScreen from "./MyGamesScreen";
import SearchScreen from "./SearchScreen";
import ChatScreen from "./chat/ChatScreen";
import MoreScreen from "./meta/MoreScreen";
import PreferencesModal from "./meta/PreferencesModal";
import UserDetailsModal from "./user/UserDetailsModal";
import DemoCloseModal from "./game/DemoCloseModal";
import ChallengeTakenModal from "./game/ChallengeTakenModal";
import ChallengeBanner from "./game/ChallengeBanner";
import { isDirectChallengeTo } from "./game/GameList";
import type { AppState, AppActions } from "../model";

type Props = {
  appState: AppState,
  actions: AppActions,
};

export default class Main extends Component<Props> {
  render() {
    let { appState, actions } = this.props;
    let {
      nav,
      currentUser,
      usersByName,
      conversationsById,
      channelMembership,
      gamesById,
      playChallengeId,
      playGameId,
      watchGameId,
      clientState,
      logoutError,
      userDetailsRequest,
      showUnderConstruction,
      challengeTakenNotice,
      showFeedbackModal,
      showPreferencesModal,
      showLeaveMessageModal,
      leaveMessageStatus,
      leaveMessageTargetUser,
      demoSaveCloseGameId,
      buddies,
      fans,
      censored,
      buddyPresenceSettling,
      unreadMailboxCount,
      mailboxMessages,
      unfinishedGames,
      challenges,
    } = appState;
    let screenProps = { ...appState, actions };

    let content;
    if (nav === "watch") {
      content = <WatchScreen {...screenProps} />;
    } else if (nav === "play") {
      content = <PlayScreen {...screenProps} />;
    } else if (nav === "mygames") {
      content = <MyGamesScreen {...screenProps} />;
    } else if (nav === "chat") {
      content = <ChatScreen {...screenProps} />;
    } else if (nav === "search") {
      content = <SearchScreen {...screenProps} />;
    } else if (nav === "more") {
      content = <MoreScreen {...screenProps} />;
    }

    let activeChallenge = playChallengeId ? gamesById[playChallengeId] : null;
    let hasDirectChallenge = (challenges || []).some((c) =>
      isDirectChallengeTo(c, currentUser)
    );
    let watchedGame = watchGameId ? gamesById[watchGameId] : null;
    let activeGame = playGameId
      ? gamesById[playGameId]
      : watchedGame && !watchedGame.over
        ? watchedGame
        : null;
    let offline =
      clientState.status === "loggedOut" || clientState.network !== "online";
    return (
      <div className="Main">
        {offline ? (
          <OfflineAlert
            logoutError={logoutError}
            clientState={clientState}
            onLogout={actions.onLogout}
          />
        ) : null}
        <Nav
          nav={nav}
          currentUser={currentUser}
          usersByName={usersByName}
          conversationsById={conversationsById}
          channelMembership={channelMembership}
          activeChallenge={activeChallenge}
          hasDirectChallenge={hasDirectChallenge}
          activeGame={activeGame}
          playGameId={playGameId}
          unfinishedGames={unfinishedGames}
          watchGameId={watchGameId}
          actions={actions}
          buddies={buddies}
          fans={fans}
          censored={censored}
          buddyPresenceSettling={buddyPresenceSettling}
          unreadMailboxCount={unreadMailboxCount}
        />
        <div
          className={"Main-content Main-" + (offline ? "offline" : "online")}>
          {content}
        </div>
        {userDetailsRequest ? <UserDetailsModal {...screenProps} /> : null}
        {showUnderConstruction ? (
          <UnderConstructionModal onClose={actions.onHideUnderConstruction} />
        ) : null}
        {challengeTakenNotice ? (
          <ChallengeTakenModal
            gameId={challengeTakenNotice.gameId}
            onWatch={actions.onWatchChallengeTakenGame}
            onClose={actions.onHideChallengeTakenNotice}
          />
        ) : null}
        {showFeedbackModal ? (
          <FeedbackModal
            currentUser={currentUser}
            usersByName={usersByName}
            actions={actions}
            onClose={actions.onHideFeedbackModal}
          />
        ) : null}
        {showPreferencesModal ? (
          <PreferencesModal
            currentUser={currentUser}
            usersByName={usersByName}
            actions={actions}
            onClose={actions.onHidePreferencesModal}
          />
        ) : null}
        {showLeaveMessageModal ? (
          <LeaveMessageModal
            onClose={actions.onHideLeaveMessageModal}
            onSend={actions.onSendMailboxMessage}
            onDeleteMessage={actions.onDeleteMailboxMessage}
            onClearAll={actions.onClearAllMailboxMessages}
            onStartChat={actions.onStartChat}
            leaveMessageStatus={leaveMessageStatus}
            leaveMessageTargetUser={leaveMessageTargetUser}
            usersByName={usersByName}
            mailboxMessages={mailboxMessages}
          />
        ) : null}
        {demoSaveCloseGameId ? (
          <DemoCloseModal
            gameId={demoSaveCloseGameId}
            onSave={actions.onSaveAndCloseDemo}
            onDiscard={actions.onCloseDemoWithoutSaving}
            onCancel={actions.onCancelCloseDemo}
          />
        ) : null}
        {playChallengeId &&
        appState.challengeMinimized &&
        activeChallenge &&
        currentUser ? (
          <ChallengeBanner
            currentUser={currentUser}
            challenge={activeChallenge}
            onRestore={actions.onRestoreChallenge}
            onCancel={() => actions.onCloseChallenge(playChallengeId)}
          />
        ) : null}
      </div>
    );
  }
}
