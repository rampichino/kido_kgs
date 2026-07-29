// @flow
import React, { PureComponent as Component } from "react";
import { A, Button, Icon, TabNav, UnseenBadge } from "../common";
import ProposalForm from "./ProposalForm";
import ChatMessages from "../chat/ChatMessages";
import ChatMessageBar from "../chat/ChatMessageBar";
import {
  getEvenProposal,
  getActionsForUser,
  createInitialProposal,
  getOtherPlayerName,
  getSimulMatchup,
  getRengoMatchup,
} from "../../model/game";
import { InvariantError } from "../../util/error";
import type {
  GameChannel,
  GameProposal,
  GameAction,
  UnparsedUser,
  ProposalVisibility,
  ProposalEditMode,
  User,
  Room,
  ChannelMembership,
  Conversation,
  Preferences,
  Index,
  AppActions,
} from "../../model";

// Returns the ordered list of already-submitted challenger names for a simul
// challenge, derived from CHALLENGE_SUBMITTED actions. Used so a second
// joining challenger can see slot 1 is taken by an earlier submitter.
function getSimulSubmittedNames(
  actions: ?Array<{ action: GameAction, user: UnparsedUser }>,
  currentUserName: string,
  creator: ?{ name: string, ... }
): Array<string> {
  if (!actions) {
    return [];
  }
  let creatorName = creator ? creator.name : null;
  return actions
    .filter(
      (a) =>
        a.action === "CHALLENGE_SUBMITTED" &&
        a.user.name !== currentUserName &&
        a.user.name !== creatorName
    )
    .map((a) => a.user.name);
}

type Props = {
  currentUser: User,
  challenge: ?GameChannel,
  challengeTargetUser?: ?string,
  initialRoomId: number,
  usersByName: Index<User>,
  roomsById: Index<Room>,
  channelMembership: ChannelMembership,
  conversation: ?Conversation,
  preferences: Preferences,
  actions: AppActions,
  onCancel: Function,
  defaultVisibility?: ?ProposalVisibility,
};

type State = {
  initialProposal: GameProposal,
  proposal: GameProposal,
  visibility: ProposalVisibility,
  notes: string,
  selectedProposalIndex: number,
  activeTab: string,
  roomId: number,
  // Per-challenger manual handicap overrides for a simul host, keyed by
  // challenger name. Applied on top of the auto rank-based matchup.
  handicapOverrides: { [name: string]: number },
  // A 1v1 creator's edits to the proposal they're responding to. Null means
  // "not edited" — accepting then echoes the challenger's proposal unchanged so
  // their client auto-accepts and the game starts immediately.
  creatorEdit: ?GameProposal,
};

export default class ChallengeEditor extends Component<Props, State> {
  static defaultProps: Props;
  state: State = this._getInitialState(this.props);
  // Host's merged simul roster from the last render (overrides baked in).
  _simulMergedProposal: ?GameProposal = null;
  // True while a 1v1 creator is awaiting a reply to an edited counter-proposal
  // they just sent. Reset when the set of received proposals changes (the
  // challenger re-submitted, accepted, or declined).
  _creatorCountered: boolean = false;

  _getInitialState(props: Props): State {
    let { challenge, currentUser, usersByName, preferences, initialRoomId } =
      props;
    let proposal: GameProposal;
    let visibility;
    let notes;
    if (challenge) {
      let challengeProposal;
      if (challenge.sentProposal) {
        challengeProposal = challenge.sentProposal;
      } else {
        challengeProposal = challenge.initialProposal;
      }
      if (!challengeProposal) {
        throw new InvariantError("No proposal in challenge");
      }
      let creator = challenge.players.challengeCreator;
      if (creator && creator.name === currentUser.name) {
        // Challenge we created - use as-is
        proposal = challengeProposal;
      } else {
        // Challenge we joined - create an even proposal
        proposal = getEvenProposal(
          challengeProposal,
          currentUser.name,
          usersByName,
          challenge.players,
          getSimulSubmittedNames(challenge.actions, currentUser.name, creator)
        );
      }
      visibility = proposal.private
        ? challenge.global
          ? "private_public"
          : "private"
        : challenge.global
          ? "public"
          : "roomOnly";
      notes = challenge.name || "";
      initialRoomId = challenge.roomId;
    } else {
      let lastProposal = preferences.lastProposal;
      proposal = createInitialProposal(
        currentUser,
        lastProposal ? lastProposal.proposal : null,
        props.challengeTargetUser
      );
      if (props.challengeTargetUser) {
        visibility = "public";
        notes = "Challenge to " + props.challengeTargetUser;
        if (props.roomsById) {
          let englishRoom = Object.keys(props.roomsById)
            .map((id) => props.roomsById[id])
            .find((r) => r && r.name === "English Game Room");
          if (englishRoom) {
            initialRoomId = englishRoom.id;
          }
        }
      } else {
        visibility = props.defaultVisibility || "roomOnly";
        notes = "";
      }
    }
    return {
      proposal,
      initialProposal: proposal,
      visibility,
      notes,
      selectedProposalIndex: 0,
      activeTab: "proposal",
      roomId: initialRoomId,
      handicapOverrides: {},
      creatorEdit: null,
    };
  }

  componentDidUpdate(nextProps: Props) {
    let prevChallenge = nextProps.challenge;
    let currentChallenge = this.props.challenge;

    // The challenger replied to our edited counter (their proposals changed) —
    // leave the waiting state so we can review/accept again.
    let prevReceived = prevChallenge ? prevChallenge.receivedProposals : null;
    let currentReceived = currentChallenge
      ? currentChallenge.receivedProposals
      : null;
    if (this._creatorCountered && currentReceived !== prevReceived) {
      this._creatorCountered = false;
    }
    let prevActive = prevChallenge
      ? prevChallenge.sentProposal || prevChallenge.initialProposal
      : null;
    let currentActive = currentChallenge
      ? currentChallenge.sentProposal || currentChallenge.initialProposal
      : null;

    let nextInitialProposal = this.state.initialProposal;
    let nextProposal = this.state.proposal;
    let stateChanged = false;

    let prevPlayers = prevChallenge ? prevChallenge.players : null;
    let currentPlayers = currentChallenge ? currentChallenge.players : null;

    let prevActions = prevChallenge ? prevChallenge.actions : null;
    let currentActions = currentChallenge ? currentChallenge.actions : null;

    if (
      (currentActive !== prevActive ||
        currentPlayers !== prevPlayers ||
        currentActions !== prevActions) &&
      currentActive
    ) {
      let creator =
        currentChallenge && currentChallenge.players.challengeCreator;
      let isCreator = creator && creator.name === this.props.currentUser.name;
      if (isCreator) {
        nextProposal = currentActive;
      } else if (
        (currentActive.gameType === "simul" ||
          currentActive.gameType === "rengo") &&
        currentActive.status === "setup"
      ) {
        // Host sent back a counter-proposal — keep it as-is so the challenger
        // sees the Accept button rather than entering negotiating mode.
        nextProposal = currentActive;
      } else {
        nextProposal = getEvenProposal(
          currentActive,
          this.props.currentUser.name,
          this.props.usersByName,
          currentChallenge ? currentChallenge.players : null,
          getSimulSubmittedNames(
            currentChallenge ? currentChallenge.actions : null,
            this.props.currentUser.name,
            creator
          )
        );
      }
      // 1v1 receiver getting the creator's modified counter (status "setup"/
      // "accepted"): keep the existing initialProposal as the diff baseline so
      // the changed values stay highlighted. Resetting it here would make the
      // baseline equal the counter, hiding the changes.
      let receiverCounter =
        !isCreator &&
        currentActive.gameType !== "simul" &&
        currentActive.gameType !== "rengo" &&
        (currentActive.status === "setup" ||
          currentActive.status === "accepted");
      if (!receiverCounter) {
        nextInitialProposal = nextProposal;
      }
      stateChanged = true;
    } else if (
      prevChallenge &&
      prevChallenge.initialProposal &&
      !currentChallenge
    ) {
      // Challenge cancelled/removed
      nextProposal = { ...prevChallenge.initialProposal, status: "pending" };
      nextInitialProposal = nextProposal;
      stateChanged = true;
    }

    // Check to see if our rank changed and, if so, correct the suggested
    // handicap and color (this can happen when you're new and your rank
    // hasn't settled)
    let prevUser = nextProps.currentUser;
    let currentUser = this.props.currentUser;
    // Recompute from the CURRENT challenge — the previous snapshot may hold
    // stale players/actions/proposal. `players` can be absent while the
    // channel is still loading, so guard the creator lookup.
    let rankChallenge = currentChallenge || prevChallenge;
    if (rankChallenge && currentUser.rank !== prevUser.rank) {
      let creator = rankChallenge.players
        ? rankChallenge.players.challengeCreator
        : null;
      if (
        nextProposal.status !== "pending" &&
        creator &&
        creator.name !== currentUser.name &&
        rankChallenge.initialProposal
      ) {
        let evenProposal = getEvenProposal(
          rankChallenge.initialProposal,
          currentUser.name,
          this.props.usersByName,
          rankChallenge.players,
          getSimulSubmittedNames(
            rankChallenge.actions,
            currentUser.name,
            creator
          )
        );
        nextProposal = {
          ...nextProposal,
          rules: {
            ...nextProposal.rules,
            handicap: evenProposal.rules.handicap,
          },
          players: evenProposal.players,
        };
        stateChanged = true;
      }
    }

    if (stateChanged) {
      this.setState({
        initialProposal: nextInitialProposal,
        proposal: nextProposal,
      });
    }
  }

  render() {
    let {
      currentUser,
      challenge,
      usersByName,
      roomsById,
      channelMembership,
      conversation,
      actions,
      onCancel,
    } = this.props;
    let {
      initialProposal,
      proposal,
      visibility,
      notes,
      selectedProposalIndex,
      activeTab,
      roomId,
    } = this.state;
    // let sentProposal = challenge && challenge.sentProposal;
    let creator = challenge
      ? challenge.players && challenge.players.challengeCreator
      : currentUser;
    let isCreator = creator && creator.name === currentUser.name;
    let { status } = proposal;

    let room = roomId && roomsById[roomId];

    if (!room) {
      throw new InvariantError("Room cannot be absent");
    }

    let pending = status === "pending";
    let userActions = challenge
      ? getActionsForUser(challenge.actions, currentUser.name)
      : {};
    let receivedProposals = challenge ? challenge.receivedProposals : [];
    let proposalCount = receivedProposals ? receivedProposals.length : 0;

    let editMode: ProposalEditMode;
    let editProposal;
    let prevProposal;
    let buttons;
    let simulCounterProposal =
      !isCreator &&
      challenge &&
      challenge.sentProposal &&
      (challenge.sentProposal.gameType === "simul" ||
        challenge.sentProposal.gameType === "rengo") &&
      (challenge.sentProposal.status === "setup" ||
        challenge.sentProposal.status === "accepted");
    // 1v1 receiver: the creator sent back a modified proposal (status "setup").
    // The receiver must Accept it (CHALLENGE_ACCEPT) rather than re-submitting.
    let counterProposal =
      !isCreator &&
      challenge &&
      challenge.sentProposal &&
      challenge.sentProposal.gameType !== "simul" &&
      challenge.sentProposal.gameType !== "rengo" &&
      (challenge.sentProposal.status === "setup" ||
        challenge.sentProposal.status === "accepted");
    if (!challenge && !pending) {
      editMode = "creating";
      editProposal = proposal;
      buttons = (
        <Button primary onClick={this._onCreateChallenge}>
          Create Challenge
        </Button>
      );
    } else if (simulCounterProposal && challenge && challenge.sentProposal) {
      // Host replied to a multi-player (simul/rengo) challenger with the full
      // roster. Show Accept until we've confirmed, then keep the roster on
      // screen with a waiting state while everyone else confirms.
      editMode = "waiting";
      editProposal = challenge.sentProposal;
      prevProposal = initialProposal;
      buttons =
        challenge.sentProposal.status === "accepted" ? (
          <Button primary disabled loading className="Button-starting">
            Starting game...
          </Button>
        ) : (
          <Button
            primary
            className="Button-pulse"
            onClick={this._onAcceptSimulProposal}>
            &nbsp;&nbsp;Accept&nbsp;&nbsp;
          </Button>
        );
    } else if (counterProposal && challenge && challenge.sentProposal) {
      // The creator modified the proposal. Show it read-only with an Accept
      // button so the receiver confirms the new settings and the game starts.
      // (The receiver can't counter back — to change settings they close the
      // window and re-open the challenge with a fresh proposal.)
      editMode = "waiting";
      editProposal = challenge.sentProposal;
      prevProposal = initialProposal;
      buttons =
        challenge.sentProposal.status === "accepted" ? (
          <Button primary disabled loading className="Button-starting">
            Starting game...
          </Button>
        ) : (
          <Button
            primary
            className="Button-pulse"
            onClick={this._onAcceptSimulProposal}>
            &nbsp;&nbsp;Accept&nbsp;&nbsp;
          </Button>
        );
    } else if (!pending && !isCreator) {
      editMode = "negotiating";
      editProposal = proposal;
      prevProposal = initialProposal;
      buttons = (
        <Button primary onClick={this._onSubmitProposal}>
          Send Proposal
        </Button>
      );
    } else {
      editMode = "waiting";
      if (userActions.CHALLENGE_SETUP || !challenge) {
        // Rengo creator: always assemble the four-seat roster from every source
        // (channel players, submitted actions, received proposals), even once
        // receivedProposals has emptied as players accept — otherwise a seated
        // player would vanish on the last accept.
        if (initialProposal.gameType === "rengo") {
          let mergedPlayers = initialProposal.players.map((p) => ({ ...p }));
          let chanPlayers = challenge ? challenge.players : null;
          if (chanPlayers) {
            for (let seat of mergedPlayers) {
              let roleKey: any = seat.role;
              if (
                !seat.name &&
                !seat.user &&
                chanPlayers[roleKey] &&
                chanPlayers[roleKey].name
              ) {
                seat.user = { name: chanPlayers[roleKey].name };
              }
            }
          }
          let seatName = (n: string, role: string) => {
            if (!n) {
              return;
            }
            let already = mergedPlayers.some((mp) => {
              let mn = mp.user ? mp.user.name : mp.name;
              return mn === n;
            });
            if (already) {
              return;
            }
            let seat =
              mergedPlayers.find(
                (mp) => mp.role === role && !mp.name && !mp.user
              ) || mergedPlayers.find((mp) => !mp.name && !mp.user);
            if (seat) {
              seat.user = { name: n };
            }
          };
          for (let recv of receivedProposals || []) {
            for (let rp of recv.players) {
              let rpName = rp.user ? rp.user.name : rp.name;
              if (rpName && rpName !== currentUser.name) {
                seatName(rpName, rp.role);
              }
            }
          }
          for (let submitted of getSimulSubmittedNames(
            challenge ? challenge.actions : null,
            currentUser.name,
            creator
          )) {
            seatName(submitted, "");
          }
          let rengoMatchup = getRengoMatchup(
            mergedPlayers
              .filter(
                (p) =>
                  (p.role === "white" || p.role === "white_2") &&
                  (p.user || p.name)
              )
              .map((p) => usersByName[p.user ? p.user.name : p.name || ""]),
            mergedPlayers
              .filter(
                (p) =>
                  (p.role === "black" || p.role === "black_2") &&
                  (p.user || p.name)
              )
              .map((p) => usersByName[p.user ? p.user.name : p.name || ""]),
            initialProposal.rules && initialProposal.rules.komi
          );
          editProposal = {
            ...initialProposal,
            players: mergedPlayers,
            rules: {
              ...initialProposal.rules,
              handicap: rengoMatchup.handicap,
              komi: rengoMatchup.komi,
            },
          };
          this._simulMergedProposal = editProposal;
          prevProposal = initialProposal;
          let allSeatsFilled = mergedPlayers.every(
            (mp) => !!(mp.user || mp.name)
          );
          buttons = (
            <div className="ChallengeEditor-buttons-decision">
              <Button
                primary
                disabled={!allSeatsFilled}
                className={allSeatsFilled ? "Button-pulse" : undefined}
                onClick={this._onAcceptProposal}>
                &nbsp;&nbsp;Accept&nbsp;&nbsp;
              </Button>
            </div>
          );
        } else if (receivedProposals && receivedProposals.length) {
          if (initialProposal.gameType === "simul") {
            // For simul, merge ALL received proposals into one view so the
            // host sees every challenger in their respective slot at once.
            let mergedPlayers = initialProposal.players.map((p) => ({
              ...p,
            }));
            // Standard komi follows the handicap: 0.5 on a handicap board, the
            // board komi otherwise. A challenger's proposed komi is preserved
            // (so a non-standard value shows up flagged), unless the host
            // overrides the handicap themselves.
            let boardKomi =
              initialProposal.rules &&
              typeof initialProposal.rules.komi === "number"
                ? initialProposal.rules.komi
                : 6.5;
            let komiFor = (handicap) => (handicap > 0 ? 0.5 : boardKomi);
            for (let recv of receivedProposals) {
              for (let rp of recv.players) {
                let rpName = rp.user ? rp.user.name : rp.name;
                if (!rpName || rpName === currentUser.name) {
                  continue;
                }
                let emptySlot = mergedPlayers.find(
                  (mp) => mp.role === "black" && !mp.name && !mp.user
                );
                let alreadyIn = mergedPlayers.some((mp) => {
                  let n = mp.user ? mp.user.name : mp.name;
                  return n === rpName;
                });
                if (!alreadyIn && emptySlot) {
                  emptySlot.user = rp.user || { name: rpName };
                  let rpHandicap =
                    typeof rp.handicap === "number" ? rp.handicap : 0;
                  // Host's own manual override wins over everything else.
                  if (
                    Object.prototype.hasOwnProperty.call(
                      this.state.handicapOverrides,
                      rpName
                    )
                  ) {
                    emptySlot.handicap = this.state.handicapOverrides[rpName];
                    emptySlot.handicapSet = true;
                    emptySlot.komi = komiFor(emptySlot.handicap);
                  } else if (rp.handicapSet || rpHandicap > 0) {
                    // The challenger requested this handicap in their proposal.
                    // Host can still override it before accepting (host wins).
                    emptySlot.handicap = rpHandicap;
                    emptySlot.komi =
                      typeof rp.komi === "number"
                        ? rp.komi
                        : komiFor(rpHandicap);
                  } else {
                    // Challenger left it at default — auto-assign from rank.
                    let host = usersByName[currentUser.name];
                    let opp = usersByName[rpName];
                    let matchup = getSimulMatchup(host, opp, boardKomi);
                    emptySlot.handicap = matchup.handicap;
                    emptySlot.komi =
                      typeof rp.komi === "number" ? rp.komi : matchup.komi;
                  }
                }
              }
            }
            editProposal = { ...initialProposal, players: mergedPlayers };
            // Remember the host's merged roster (with any manual handicap
            // overrides baked in) so accepting sends exactly what's displayed.
            this._simulMergedProposal = editProposal;
            prevProposal = initialProposal;
            // Accept is only enabled once every opponent slot is filled, so the
            // host doesn't start the simul with empty boards.
            let allSlotsFilled = mergedPlayers
              .filter((mp) => mp.role === "black")
              .every((mp) => !!(mp.user || mp.name));
            // Creator accepts all challengers at once; declining is done
            // per-opponent from each player row.
            buttons = (
              <div className="ChallengeEditor-buttons-decision">
                <Button
                  primary
                  disabled={!allSlotsFilled}
                  className={allSlotsFilled ? "Button-pulse" : undefined}
                  onClick={this._onAcceptProposal}>
                  &nbsp;&nbsp;Accept&nbsp;&nbsp;
                </Button>
              </div>
            );
          } else {
            // Creator that can accept/decline challenges. The creator may also
            // edit the settings before accepting: an unchanged accept makes the
            // challenger's client auto-accept (instant start), while a modified
            // proposal is sent back for the challenger to re-accept.
            let rawProposal = receivedProposals[selectedProposalIndex];
            let challengerName = getOtherPlayerName(
              rawProposal,
              currentUser.name,
              challenge ? challenge.players : null
            );
            if (!challengerName) {
              throw new InvariantError("No challenger");
            }
            if (this._creatorCountered) {
              // We sent an edited counter-proposal; wait for the challenger.
              editMode = "waiting";
              editProposal =
                (challenge && challenge.sentProposal) || rawProposal;
              prevProposal = rawProposal;
              buttons = (
                <Button primary disabled loading>
                  Awaiting Response
                </Button>
              );
            } else {
              editMode = "negotiating";
              // Start from the challenger's offer so an unchanged accept matches
              // it exactly (auto-accept → instant start). The creator's own
              // edits, once made, live in creatorEdit and take over the display.
              // Keep the current challenger roster (rawProposal.players) but layer
              // the creator's color (role) edits on top, matched by name — so
              // white/black assignments survive, not just the nigiri flag.
              let creatorEdit = this.state.creatorEdit;
              if (creatorEdit) {
                let editedRoles = creatorEdit.players || [];
                let playerKey = (p) => (p.user ? p.user.name : p.name);
                let mergedPlayers = rawProposal.players.map((p) => {
                  let edited = editedRoles.find(
                    (e) => playerKey(e) === playerKey(p)
                  );
                  return edited ? { ...p, role: edited.role } : p;
                });
                editProposal = { ...creatorEdit, players: mergedPlayers };
              } else {
                editProposal = rawProposal;
              }
              prevProposal = rawProposal;
              buttons = (
                <div className="ChallengeEditor-buttons-decision">
                  <Button primary onClick={this._onAcceptProposal}>
                    &nbsp;&nbsp;Accept&nbsp;&nbsp;
                  </Button>{" "}
                  <Button danger onClick={this._onDeclineProposal}>
                    Decline
                  </Button>
                </div>
              );
            }
          }
        } else {
          // Creator awaiting challenges
          editProposal = proposal;
          prevProposal = proposal;
          buttons = (
            <Button primary disabled loading>
              Awaiting Challengers
            </Button>
          );
        }
      } else {
        // Sent proposal to creator
        editProposal = proposal;
        prevProposal = initialProposal;
        // For simul/rengo: host has replied with the full roster (status
        // "setup"); show Accept so the challenger can confirm and start.
        if (
          (initialProposal.gameType === "simul" ||
            initialProposal.gameType === "rengo") &&
          challenge &&
          challenge.sentProposal &&
          challenge.sentProposal.status === "setup"
        ) {
          editProposal = challenge.sentProposal;
          buttons = (
            <Button primary onClick={this._onAcceptSimulProposal}>
              &nbsp;&nbsp;Accept&nbsp;&nbsp;
            </Button>
          );
        } else {
          buttons = (
            <Button primary disabled loading>
              Awaiting Response
            </Button>
          );
        }
      }
    }

    let proposalContent = (
      <div className="ChallengeEditor-proposal">
        <ProposalForm
          currentUser={currentUser}
          editMode={editMode}
          proposal={editProposal}
          prevProposal={prevProposal}
          visibility={visibility}
          notes={notes}
          usersByName={usersByName}
          roomsById={roomsById}
          channelMembership={channelMembership}
          room={room}
          onUserDetail={actions.onUserDetail}
          onChangeProposal={this._onChangeProposal}
          onChangeNotes={this._onChangeNotes}
          onChangeRoomId={this._onChangeRoomId}
          onChangeVisibility={this._onChangeVisibility}
          onDeclinePlayer={
            isCreator && editMode === "waiting"
              ? this._onDeclinePlayer
              : undefined
          }
          challengeActions={challenge ? challenge.actions : null}
        />
        <div className="ChallengeEditor-buttons">
          {buttons}{" "}
          {editMode !== "waiting" ? (
            <div className="ChallengeEditor-close-action">
              <Button muted onClick={onCancel}>
                Close
              </Button>
            </div>
          ) : null}
          {editMode !== "waiting" ? null : (
            <React.Fragment>
              <div className="ChallengeEditor-minimize">
                <Button muted onClick={actions.onMinimizeChallenge}>
                  Minimize
                </Button>
              </div>
              <div className="ChallengeEditor-cancel">
                <Button muted onClick={onCancel}>
                  Cancel Challenge
                </Button>
              </div>
            </React.Fragment>
          )}
        </div>
        {proposalCount > 1 &&
        initialProposal.gameType !== "simul" &&
        initialProposal.gameType !== "rengo" ? (
          <div className="ChallengeEditor-prevnext">
            <A
              button
              disabled={selectedProposalIndex === 0}
              className="ChallengeEditor-prevnext-button"
              onClick={this._onPrevProposal}>
              <Icon name="chevron-left" />
            </A>
            <A
              button
              disabled={selectedProposalIndex === proposalCount - 1}
              className="ChallengeEditor-prevnext-button"
              onClick={this._onNextProposal}>
              <Icon name="chevron-right" />
            </A>
          </div>
        ) : null}
      </div>
    );

    let chatLabel = (
      <div className="ChallengeEditor-chat-label">
        Chat
        <div className="ChallengeEditor-chat-label-badge">
          <UnseenBadge
            majorCount={(conversation && conversation.unseenCount) || 0}
          />
        </div>
      </div>
    );
    let chatContent = conversation ? (
      <div className="ChallengeEditor-chat">
        <div className="ChallengeEditor-chat-messages">
          <ChatMessages
            currentUser={currentUser}
            messages={conversation.messages}
            onUserDetail={actions.onUserDetail}
            usersByName={usersByName}
          />
        </div>
        <div className="ChallengeEditor-chat-message-bar">
          <ChatMessageBar conversation={conversation} onSubmit={this._onChat} />
        </div>
      </div>
    ) : null;

    let headerLabel =
      proposal.gameType === "simul"
        ? "Simul Challenge"
        : proposal.gameType === "rengo"
          ? "Rengo Challenge"
          : isCreator
            ? "Create Challenge"
            : "Challenge";

    return (
      <div className="ChallengeEditor">
        <div className="ChallengeEditor-header">{headerLabel}</div>
        {/* Mobile: the full header is hidden and this compact badge sits at the
            top-left instead. */}
        <div className="ChallengeEditor-badge">{headerLabel}</div>
        {status === "declined" ? (
          <div className="ChallengeEditor-declined">
            Your proposal was declined
          </div>
        ) : null}
        {editMode !== "creating" ? (
          <div className="ChallengeEditor-tabs">
            <TabNav
              activeTabId={activeTab}
              onSelectTab={this._onSelectTab}
              tabs={[
                { id: "proposal", label: "Proposal", content: proposalContent },
                { id: "chat", label: chatLabel, content: chatContent },
              ]}
            />
          </div>
        ) : (
          proposalContent
        )}
      </div>
    );
  }

  _onChangeProposal = (proposal: GameProposal) => {
    // A 1v1 creator responding to a received proposal: store edits separately so
    // they don't disturb the creator's own pending proposal, and so an
    // unedited accept still echoes the challenger's proposal unchanged.
    let { challenge, currentUser } = this.props;
    let creator = challenge ? challenge.players.challengeCreator : null;
    let isCreator = !!(creator && creator.name === currentUser.name);
    let received = challenge ? challenge.receivedProposals : null;
    if (
      isCreator &&
      received &&
      received.length &&
      proposal.gameType !== "simul" &&
      proposal.gameType !== "rengo"
    ) {
      this.setState({ creatorEdit: proposal });
      return;
    }
    // For a simul host, capture per-challenger handicap edits into an override
    // map so they survive the merge that rebuilds the proposal each render.
    if (proposal.gameType === "simul") {
      let overrides = { ...this.state.handicapOverrides };
      let changed = false;
      for (let p of proposal.players) {
        if (p.role === "black" && p.handicapSet) {
          let name = p.user ? p.user.name : p.name;
          if (name) {
            let h = typeof p.handicap === "number" ? p.handicap : 0;
            if (overrides[name] !== h) {
              overrides[name] = h;
              changed = true;
            }
          }
        }
      }
      if (changed) {
        this.setState({ proposal, handicapOverrides: overrides });
        return;
      }
    }
    this.setState({ proposal });
  };

  _onChangeNotes = (notes: string) => {
    this.setState({ notes });
  };

  _onChangeVisibility = (visibility: ProposalVisibility) => {
    this.setState({ visibility });
  };

  _onChangeRoomId = (roomId: any) => {
    let id = roomId ? Number(roomId) : roomId;
    this.setState((state) => {
      let next: $Shape<State> = { roomId: id };
      // Rooms flagged globalGamesOnly can only host global challenges. When the
      // user switches into one, force the visibility to global (preserving the
      // private flag).
      let room = id ? this.props.roomsById[id] : null;
      if (room && room.globalGamesOnly) {
        let priv =
          state.visibility === "private" ||
          state.visibility === "private_public";
        next.visibility = priv ? "private_public" : "public";
      }
      return next;
    });
  };

  _onPrevProposal = () => {
    this.setState((state) => ({
      selectedProposalIndex: state.selectedProposalIndex - 1,
      creatorEdit: null,
    }));
  };

  _onNextProposal = () => {
    this.setState((state) => ({
      selectedProposalIndex: state.selectedProposalIndex + 1,
      creatorEdit: null,
    }));
  };

  _onSubmitProposal = () => {
    let { challenge } = this.props;
    let { proposal } = this.state;
    if (challenge) {
      this.props.actions.onSubmitChallengeProposal(challenge.id, proposal);
    }
  };

  _onCreateChallenge = () => {
    let { challenge } = this.props;
    let { proposal, visibility, notes, roomId } = this.state;
    if (!challenge) {
      // Creating a challenge - we have no app state for it yet, so just
      // set the status here
      this.setState({ proposal: { ...proposal, status: "pending" } });
    }

    if (roomId) {
      this.props.actions.onCreateChallenge(proposal, roomId, visibility, notes);
    }
  };

  _onAcceptSimulProposal = () => {
    let { challenge } = this.props;
    if (challenge) {
      this.props.actions.onAcceptSimulChallengeProposal(challenge.id);
    }
  };

  _onAcceptProposal = () => {
    let { selectedProposalIndex, creatorEdit } = this.state;
    let { challenge } = this.props;
    let proposal =
      challenge &&
      challenge.receivedProposals &&
      challenge.receivedProposals[selectedProposalIndex];
    if (challenge && proposal) {
      // For simul and rengo, send the merged roster (all seated players) rather
      // than a single received proposal, so the full line-up reaches the server.
      let toAccept;
      if (
        (proposal.gameType === "simul" || proposal.gameType === "rengo") &&
        this._simulMergedProposal
      ) {
        toAccept = this._simulMergedProposal;
      } else if (creatorEdit) {
        // 1v1, creator edited the settings: send the modified proposal back
        // (keeping the challenger's roster) while preserving the creator's
        // color (role) edits, matched by name. The challenger must re-accept it.
        let editedRoles = creatorEdit.players || [];
        let playerKey = (p) => (p.user ? p.user.name : p.name);
        let mergedPlayers = proposal.players.map((p) => {
          let edited = editedRoles.find((e) => playerKey(e) === playerKey(p));
          return edited ? { ...p, role: edited.role } : p;
        });
        toAccept = { ...creatorEdit, players: mergedPlayers };
      } else {
        // 1v1, accepted unchanged: echo the challenger's proposal exactly so
        // their client auto-accepts and the game starts immediately.
        toAccept = proposal;
      }
      this.props.actions.onAcceptChallengeProposal(challenge.id, toAccept);
      if (creatorEdit) {
        // We sent a modified counter — wait for the challenger to re-accept.
        this._creatorCountered = true;
        this.setState({ creatorEdit: null });
      }
    }
  };

  _onDeclineProposal = () => {
    let { selectedProposalIndex } = this.state;
    let { currentUser, challenge } = this.props;
    let proposal =
      challenge &&
      challenge.receivedProposals &&
      challenge.receivedProposals[selectedProposalIndex];
    if (challenge && proposal) {
      let otherName = getOtherPlayerName(
        proposal,
        currentUser.name,
        challenge.players
      );
      if (otherName) {
        this.props.actions.onDeclineChallengeProposal(challenge.id, otherName);
        this.setState({ selectedProposalIndex: 0, creatorEdit: null });
      }
    }
  };

  _onDeclinePlayer = (name: string) => {
    let { challenge } = this.props;
    if (challenge && name) {
      this.props.actions.onDeclineChallengeProposal(challenge.id, name);
    }
  };

  _onSelectTab = (tab: string) => {
    let { challenge } = this.props;
    if (tab === "chat" && challenge) {
      this.props.actions.markConversationSeen(challenge.id);
    }
    this.setState({ activeTab: tab });
  };

  _onChat = (body: string) => {
    let { challenge } = this.props;
    if (challenge) {
      this.props.actions.onSendChat(body, challenge.id);
    }
  };
}
