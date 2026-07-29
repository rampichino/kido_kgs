// @flow
import React, { PureComponent as Component } from "react";
import { A, Icon } from "../common";
import UserName from "../user/UserName";
import BoardStone from "../board/BoardStone";
import NigiriIcon from "../board/NigiriIcon";
import { parseUser } from "../../model";
import type {
  GameProposalPlayer,
  GameType,
  User,
  Index,
  ProposalEditMode,
  GameProposal,
  GameAction,
  UnparsedUser,
} from "../../model";

type Props = {
  player: GameProposalPlayer,
  prevPlayer: ?GameProposalPlayer,
  index: number,
  user: User | string | void,
  nigiri: boolean,
  prevNigiri: boolean | null,
  playerHilite?: boolean,
  onUserDetail: (string) => any,
  onToggleRole: (string) => any,
  gameType: GameType,
  showDelete?: boolean,
  onRemovePlayer?: (number) => any,
  showHandicap?: boolean,
  showHandicapReadonly?: boolean,
  showKomi?: boolean,
  expectedKomi?: number,
  showDecline?: boolean,
  onDeclinePlayer?: ?(string) => any,
  showSeatPick?: boolean,
  onPickSeat?: (number) => any,
  onChangeHandicap?: (number, number) => any,
  confirmStatus?: ?("confirmed" | "pending"),
};

class ProposalPlayersItem extends Component<Props> {
  render() {
    let {
      player,
      prevPlayer,
      user,
      nigiri,
      prevNigiri,
      playerHilite,
      gameType,
      showDelete,
      onRemovePlayer,
      showHandicap,
      showHandicapReadonly,
      showKomi,
      expectedKomi,
      showDecline,
      showSeatPick,
      confirmStatus,
    } = this.props;
    let isWhiteSeat = player.role === "white" || player.role === "white_2";
    let isBlackSeat = player.role === "black" || player.role === "black_2";
    let icon;
    if (nigiri) {
      icon = <NigiriIcon />;
    } else if (isWhiteSeat) {
      icon = <BoardStone color="white" />;
    } else if (isBlackSeat) {
      icon = <BoardStone color="black" />;
    }

    let roleName = "";
    if (gameType === "simul" || gameType === "rengo") {
      roleName = "";
    } else {
      if (nigiri) {
        roleName = "Nigiri";
      } else {
        if (player.role === "white") {
          roleName = "White";
        } else if (player.role === "black") {
          roleName = "Black";
        }
      }
    }

    let className =
      "ProposalPlayers-item" +
      " ProposalPlayers-item-role-" +
      (nigiri ? "nigiri" : player.role) +
      ((playerHilite ? " ProposalPlayers-item-player-hilite" : "") +
        ((prevNigiri !== null && prevNigiri !== nigiri) ||
        (!nigiri && prevPlayer && prevPlayer.role !== player.role)
          ? " ProposalPlayers-item-role-hilite"
          : ""));
    return (
      <div className={className}>
        <A
          className="ProposalPlayers-role-toggle"
          onClick={this._onToggleRole}
          title={gameType === "simul" ? undefined : "Click to change color"}>
          {icon}
        </A>
        <div className="ProposalPlayers-player-info">
          <div className="ProposalPlayers-name-block">
            {roleName ? (
              <span
                className="ProposalPlayers-player-role-name"
                style={{
                  fontSize: "10px",
                  color: "#94a3b8",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "2px",
                }}>
                {roleName}
              </span>
            ) : null}
            <A
              className="ProposalPlayers-player-link"
              onClick={this._onUserDetail}
              style={{ display: "block" }}>
              {user ? (
                typeof user === "string" ? (
                  user
                ) : (
                  <UserName user={user} extraIcons hideMaintainerIcon />
                )
              ) : (
                "--"
              )}
            </A>
          </div>
          {showHandicap || showHandicapReadonly || showKomi ? (
            <div className="ProposalPlayers-settings-row">
              {showHandicap ? (
                <div className="ProposalPlayers-handicap">
                  <span className="ProposalPlayers-handicap-label">H</span>
                  <A
                    button
                    className="ProposalPlayers-handicap-step"
                    onClick={this._onHandicapMinus}
                    title="Decrease handicap">
                    <Icon name="minus" size={13} />
                  </A>
                  <span className="ProposalPlayers-handicap-value">
                    {typeof player.handicap === "number" ? player.handicap : 0}
                  </span>
                  <A
                    button
                    className="ProposalPlayers-handicap-step"
                    onClick={this._onHandicapPlus}
                    title="Increase handicap">
                    <Icon name="plus" size={13} />
                  </A>
                </div>
              ) : showHandicapReadonly ? (
                <div className="ProposalPlayers-handicap ProposalPlayers-handicap-readonly">
                  <span className="ProposalPlayers-handicap-label">H</span>
                  <span className="ProposalPlayers-handicap-value">
                    {typeof player.handicap === "number" && player.handicap > 0
                      ? player.handicap + " stones"
                      : "Even"}
                  </span>
                </div>
              ) : null}
              {showKomi ? this._renderKomi(expectedKomi) : null}
            </div>
          ) : null}
        </div>
        {confirmStatus === "confirmed" ? (
          <span
            className="ProposalPlayers-confirm ProposalPlayers-confirm-confirmed"
            title="Accepted">
            <Icon name="check" size={15} strokeWidth={3} />
          </span>
        ) : null}
        {showDecline ? (
          <A
            button
            className="ProposalPlayers-item-decline"
            onClick={this._onDecline}
            title="Decline this player">
            <Icon name="x" size={16} />
          </A>
        ) : null}
        {showSeatPick ? (
          <A
            button
            className="ProposalPlayers-item-seatpick"
            onClick={this._onPickSeat}
            title="Take this seat">
            Take seat
          </A>
        ) : null}
        {showDelete && onRemovePlayer ? (
          <A
            className="ProposalPlayers-item-delete"
            onClick={this._onRemove}
            title="Remove opponent slot"
            style={{
              marginLeft: "auto",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              padding: "4px",
              alignSelf: "flex-start",
            }}>
            <Icon name="x" size={16} />
          </A>
        ) : null}
      </div>
    );
  }

  _renderKomi(expectedKomi: ?number) {
    let { player } = this.props;
    let komi = typeof player.komi === "number" ? player.komi : 0;
    let nonStandard = typeof expectedKomi === "number" && komi !== expectedKomi;
    return (
      <div
        className={
          "ProposalPlayers-komi" +
          (nonStandard ? " ProposalPlayers-komi-warning" : "")
        }
        title={
          nonStandard
            ? `Non-standard komi (standard is ${String(expectedKomi)})`
            : undefined
        }>
        {nonStandard ? <Icon name="alert-triangle" size={12} /> : null}
        <span className="ProposalPlayers-komi-label">Komi</span>
        <span className="ProposalPlayers-komi-value">{komi}</span>
      </div>
    );
  }

  _onHandicapMinus = () => {
    let { player, onChangeHandicap, index } = this.props;
    if (!onChangeHandicap) {
      return;
    }
    let h = typeof player.handicap === "number" ? player.handicap : 0;
    let next = h <= 2 ? 0 : h - 1;
    onChangeHandicap(index, next);
  };

  _onHandicapPlus = () => {
    let { player, onChangeHandicap, index } = this.props;
    if (!onChangeHandicap) {
      return;
    }
    let h = typeof player.handicap === "number" ? player.handicap : 0;
    let next = h < 2 ? 2 : Math.min(h + 1, 9);
    onChangeHandicap(index, next);
  };

  _onUserDetail = () => {
    let { user, onUserDetail } = this.props;
    if (!user) {
      return;
    }
    onUserDetail(typeof user === "string" ? user : user.name);
  };

  _onToggleRole = () => {
    let { user, onToggleRole, gameType } = this.props;
    // Rengo cycles the whole color setup and ignores which seat was clicked,
    // so allow clicking an empty seat too.
    if (!user) {
      if (gameType === "rengo") {
        onToggleRole("");
      }
      return;
    }
    onToggleRole(typeof user === "string" ? user : user.name);
  };

  _onRemove = () => {
    if (this.props.onRemovePlayer) {
      this.props.onRemovePlayer(this.props.index);
    }
  };

  _onDecline = () => {
    let { user, player, onDeclinePlayer } = this.props;
    let name =
      typeof user === "string"
        ? user
        : user
          ? user.name
          : player.user
            ? player.user.name
            : player.name;
    if (name && onDeclinePlayer) {
      onDeclinePlayer(name);
    }
  };

  _onPickSeat = () => {
    if (this.props.onPickSeat) {
      this.props.onPickSeat(this.props.index);
    }
  };
}

type ProposalPlayersProps = {
  currentUser: User,
  players: Array<GameProposalPlayer>,
  prevPlayers: ?Array<GameProposalPlayer>,
  nigiri: boolean,
  prevNigiri: boolean | null,
  gameType: GameType,
  usersByName: Index<User>,
  onUserDetail: (string) => any,
  onToggleRole: (string) => any,
  editMode: ProposalEditMode,
  proposal?: GameProposal,
  onChangeProposal?: (GameProposal) => any,
  onDeclinePlayer?: ?(string) => any,
  challengeActions?: ?Array<{ action: GameAction, user: UnparsedUser }>,
};

export default class ProposalPlayers extends Component<ProposalPlayersProps> {
  render() {
    let {
      currentUser,
      players,
      prevPlayers,
      nigiri,
      prevNigiri,
      gameType,
      usersByName,
      onUserDetail,
      onToggleRole,
      editMode,
    } = this.props;

    let { proposal } = this.props;
    let boardKomi =
      proposal && proposal.rules && typeof proposal.rules.komi === "number"
        ? proposal.rules.komi
        : 6.5;

    let isHost = false;
    if (players[0]) {
      let hostName = players[0].user ? players[0].user.name : players[0].name;
      isHost = hostName === currentUser.name;
    }
    // For rengo the creator may sit in any seat, so seat 0 isn't a reliable
    // host check. onDeclinePlayer is only handed to the creator, so its
    // presence identifies the current user as the creator.
    if (gameType === "rengo" && this.props.onDeclinePlayer) {
      isHost = true;
    }

    let containerClassName =
      "ProposalPlayers" +
      (gameType === "simul" ? " ProposalPlayers-vertical" : "") +
      (gameType === "rengo" ? " ProposalPlayers-rengo" : "");

    // During the final confirmation phase (the agreed roster has been sent and
    // status is "setup") a player who still owes their Accept has a pending
    // CHALLENGE_ACCEPT action; once they accept it clears. Show per-seat
    // confirmation markers for everyone while we wait.
    let { challengeActions } = this.props;
    let showConfirmStatus =
      (gameType === "simul" || gameType === "rengo") &&
      editMode === "waiting" &&
      proposal &&
      (proposal.status === "setup" || proposal.status === "accepted") &&
      !!challengeActions;
    let pendingAcceptNames = {};
    if (showConfirmStatus && challengeActions) {
      for (let a of challengeActions) {
        if (a.action === "CHALLENGE_ACCEPT" && a.user && a.user.name) {
          pendingAcceptNames[a.user.name] = true;
        }
      }
    }

    // Only simul lets the host add/remove opponent slots; rengo has four fixed
    // seats that are never removable.
    let canDelete =
      gameType === "simul" &&
      isHost &&
      (editMode === "creating" || editMode === "negotiating") &&
      players.length > 3;

    // Opponent slots are every black slot (slot 0 is the host).
    let opponentCount = players.filter((p) => p.role === "black").length;
    let showOpponentCount = gameType === "simul" && isHost;

    let canEditSlots =
      gameType === "simul" &&
      isHost &&
      (editMode === "creating" || editMode === "negotiating");
    let canAddSlot = canEditSlots && players.length < 101;
    // Keep at least two opponents (host + 2 black slots = 3 players), and never
    // remove a seat that already has a player in it.
    let hasEmptyBlackSlot = players.some(
      (p) => p.role === "black" && !p.name && !p.user
    );
    let canRemoveSlot = canEditSlots && players.length > 3 && hasEmptyBlackSlot;
    return (
      <div className={containerClassName}>
        {showOpponentCount ? (
          <div className="ProposalPlayers-count-row">
            <span className="ProposalPlayers-count">
              {opponentCount} {opponentCount === 1 ? "opponent" : "opponents"}
            </span>
            {canAddSlot || canRemoveSlot ? (
              <span className="ProposalPlayers-count-actions">
                {canRemoveSlot ? (
                  <button
                    type="button"
                    className="ProposalPlayers-add-button ProposalPlayers-icon-button"
                    onClick={this._onRemoveLastSlot}
                    title="Remove an empty opponent slot">
                    <Icon name="minus" size={13} />
                  </button>
                ) : null}
                {canAddSlot ? (
                  <button
                    type="button"
                    className="ProposalPlayers-add-button ProposalPlayers-icon-button"
                    onClick={this._onAddPlayer}
                    title="Add an opponent slot">
                    <Icon name="plus" size={13} />
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
        ) : null}
        {players.map((player, i) => {
          let name = player.user ? player.user.name : player.name;
          // Prefer the full user record from the index, but fall back to the
          // user object embedded in the proposal (e.g. a simul challenger the
          // host hasn't otherwise seen) and finally to the bare name.
          let user: User | string | void;
          if (name && usersByName[name]) {
            user = usersByName[name];
          } else if (player.user) {
            user = parseUser(null, player.user);
          } else {
            user = name;
          }
          // The host can set the handicap on any named black slot. A challenger
          // can request a handicap on their own black slot while negotiating
          // (host can still override it later — host wins).
          let isOwnSlot = !!name && name === currentUser.name;
          let showHandicap =
            gameType === "simul" &&
            player.role === "black" &&
            ((isHost &&
              !!name &&
              (editMode === "creating" ||
                editMode === "negotiating" ||
                editMode === "waiting")) ||
              (!isHost && isOwnSlot && editMode === "negotiating"));
          // When the stepper isn't editable, still show the agreed handicap as
          // read-only text for every named opponent so it's always visible.
          let showHandicapReadonly =
            !showHandicap &&
            gameType === "simul" &&
            player.role === "black" &&
            !!name;
          // Show komi on every named simul opponent slot. The standard komi is
          // 0.5 on a handicap board, the board komi otherwise; a value that
          // differs is flagged in red so the host notices (e.g. a CGOBAN
          // challenger that proposed something non-standard).
          let showKomi =
            gameType === "simul" && player.role === "black" && !!name;
          let playerHandicap =
            typeof player.handicap === "number" ? player.handicap : 0;
          // Only the host gets the non-standard-komi warning; the challenger
          // just sees the komi value without any red flag.
          let expectedKomi = isHost
            ? playerHandicap > 0
              ? 0.5
              : boardKomi
            : undefined;
          // The creator can decline an individual joined player (any seat but
          // their own). For simul that's a black opponent slot; for rengo it's
          // any other seat. onDeclinePlayer is only provided while the creator
          // is reviewing the roster (before they accept).
          let showDecline =
            ((gameType === "simul" && player.role === "black") ||
              gameType === "rengo") &&
            isHost &&
            !!name &&
            !isOwnSlot &&
            !!this.props.onDeclinePlayer;
          // Rengo: a player who hasn't taken a seat yet can click any open seat
          // to claim it while negotiating.
          let userSeated =
            gameType === "rengo" &&
            players.some((p) => {
              let n = p.user ? p.user.name : p.name;
              return n === currentUser.name;
            });
          let showSeatPick =
            gameType === "rengo" &&
            !name &&
            !userSeated &&
            editMode === "negotiating";
          let playerHilite;
          if (gameType === "simul") {
            playerHilite = isOwnSlot;
          } else if (gameType === "rengo") {
            playerHilite = isOwnSlot;
          } else {
            playerHilite = i > 0 && name && currentUser.name !== name;
          }
          // Confirmation marker: a seated player still owing their Accept is
          // "pending", otherwise "confirmed".
          let confirmStatus =
            showConfirmStatus && name
              ? pendingAcceptNames[name]
                ? "pending"
                : "confirmed"
              : null;
          return (
            <ProposalPlayersItem
              key={i + "-" + (name || "")}
              player={player}
              prevPlayer={prevPlayers ? prevPlayers[i] : null}
              index={i}
              confirmStatus={confirmStatus}
              user={user}
              nigiri={nigiri}
              prevNigiri={prevNigiri}
              gameType={gameType}
              showDelete={i >= 1 && canDelete}
              onRemovePlayer={this._onRemovePlayer}
              showHandicap={showHandicap}
              showHandicapReadonly={showHandicapReadonly}
              showKomi={showKomi}
              expectedKomi={expectedKomi}
              showDecline={showDecline}
              onDeclinePlayer={this.props.onDeclinePlayer}
              showSeatPick={showSeatPick}
              onPickSeat={this._onPickSeat}
              onChangeHandicap={this._onChangeHandicap}
              playerHilite={playerHilite ? true : false}
              onUserDetail={onUserDetail}
              onToggleRole={onToggleRole}
            />
          );
        })}
      </div>
    );
  }

  _onRemovePlayer = (index: number) => {
    let { proposal, onChangeProposal } = this.props;
    if (proposal && onChangeProposal && proposal.players.length > 3) {
      let newPlayers = proposal.players.filter((_, i) => i !== index);
      onChangeProposal({
        ...proposal,
        players: newPlayers.map((p, i) => {
          let newPlayer = {
            ...p,
            role: i === 0 ? "white" : "black",
          };
          if (i === 0) {
            delete newPlayer.handicap;
            delete newPlayer.komi;
          } else {
            newPlayer.handicap =
              typeof p.handicap === "number" ? p.handicap : 0;
            newPlayer.komi = typeof p.komi === "number" ? p.komi : 0;
          }
          return newPlayer;
        }),
      });
    }
  };

  // Rengo: claim the open seat at `index`, vacating any seat the user already
  // holds so they never occupy two seats.
  _onPickSeat = (index: number) => {
    let { proposal, onChangeProposal, currentUser } = this.props;
    if (!proposal || !onChangeProposal) {
      return;
    }
    let players = proposal.players.map((p, i) => {
      let n = p.user ? p.user.name : p.name;
      if (i === index) {
        let np = { ...p, name: currentUser.name };
        delete np.user;
        return np;
      }
      if (n === currentUser.name) {
        let np = { ...p };
        delete np.name;
        delete np.user;
        return np;
      }
      return p;
    });
    onChangeProposal({ ...proposal, players });
  };

  _onChangeHandicap = (index: number, handicap: number) => {
    let { proposal, onChangeProposal } = this.props;
    if (!proposal || !onChangeProposal) {
      return;
    }
    // Komi follows the handicap: 0.5 on a handicap board, the standard board
    // komi on an even board. Komi is never set independently of the handicap.
    let boardKomi =
      proposal.rules && typeof proposal.rules.komi === "number"
        ? proposal.rules.komi
        : 6.5;
    let players = proposal.players.map((p, i) => {
      if (i !== index) {
        return p;
      }
      // Mark handicapSet so auto rank-based assignment won't override the
      // host's manual choice.
      return {
        ...p,
        handicap,
        komi: handicap > 0 ? 0.5 : boardKomi,
        handicapSet: true,
      };
    });
    onChangeProposal({ ...proposal, players });
  };

  _onAddPlayer = () => {
    let { proposal, onChangeProposal } = this.props;
    if (proposal && onChangeProposal && proposal.players.length < 101) {
      onChangeProposal({
        ...proposal,
        players: [...proposal.players, { role: "black", handicap: 0, komi: 0 }],
      });
    }
  };

  // Remove the last empty opponent slot, keeping at least two opponents.
  _onRemoveLastSlot = () => {
    let { proposal, onChangeProposal } = this.props;
    if (!proposal || !onChangeProposal || proposal.players.length <= 3) {
      return;
    }
    let lastEmpty = -1;
    proposal.players.forEach((p, i) => {
      if (p.role === "black" && !p.name && !p.user) {
        lastEmpty = i;
      }
    });
    if (lastEmpty === -1) {
      return;
    }
    onChangeProposal({
      ...proposal,
      players: proposal.players.filter((_, i) => i !== lastEmpty),
    });
  };
}
