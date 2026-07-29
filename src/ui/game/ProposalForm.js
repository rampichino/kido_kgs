// @flow
import React, { PureComponent as Component } from "react";
import GameTimeSystem from "./GameTimeSystem";
import ProposalPlayers from "./ProposalPlayers";
import ProposalFormInput from "./ProposalFormInput";
import { SelectInput, CheckboxInput, Icon } from "../common";
import {
  formatDuration,
  formatGameType,
  formatGameRuleset,
} from "../../model/game";
import type {
  GameProposal,
  ProposalVisibility,
  ProposalEditMode,
  User,
  Index,
  Room,
  ChannelMembership,
  GameAction,
  UnparsedUser,
} from "../../model";

type Props = {
  currentUser: User,
  editMode: ProposalEditMode,
  proposal: GameProposal,
  prevProposal: ?GameProposal,
  notes: string,
  visibility: ProposalVisibility,
  usersByName: Index<User>,
  roomsById: Index<Room>,
  channelMembership: ChannelMembership,
  room: Room,
  onUserDetail: (string) => any,
  onChangeProposal: (GameProposal) => any,
  onChangeNotes: (string) => any,
  onChangeVisibility: (ProposalVisibility) => any,
  onChangeRoomId: (number) => any,
  onDeclinePlayer?: ?(string) => any,
  challengeActions?: ?Array<{ action: GameAction, user: UnparsedUser }>,
};

const rulesetOptions = [
  { value: "japanese", label: "Japanese" },
  { value: "chinese", label: "Chinese" },
  { value: "aga", label: "AGA" },
  { value: "new_zealand", label: "New Zealand" },
];

const timeSystemOptions = [
  { value: "none", label: "None" },
  { value: "absolute", label: "Absolute" },
  { value: "byo_yomi", label: "Byo-Yomi" },
  { value: "canadian", label: "Canadian" },
];

const sizeOptions = [9, 13, 17, 19];

export default class ProposalForm extends Component<Props> {
  _renderReadonlyRoom() {
    let { room } = this.props;
    return (
      <div
        className="ProposalForm-field-content ProposalForm-room-box ProposalForm-readonly-box"
        style={{ marginBottom: 12 }}>
        <span className="ProposalForm-readonly-label">Room</span>
        <span className="ProposalForm-readonly-val ProposalForm-readonly-room-val">
          {room.name}
        </span>
      </div>
    );
  }

  _renderReadonlyRoomAndGame() {
    let { proposal, prevProposal, visibility, notes, room, editMode } =
      this.props;
    return (
      <React.Fragment>
        <div className="ProposalForm-field-content ProposalForm-room-box ProposalForm-readonly-box">
          <span className="ProposalForm-readonly-label">Room</span>
          <span className="ProposalForm-readonly-val ProposalForm-readonly-room-val">
            {room.name}
          </span>
        </div>
        <div className="ProposalForm-field-content ProposalForm-game-box ProposalForm-readonly-box">
          <span className="ProposalForm-readonly-label">Game</span>
          <span
            className={
              "ProposalForm-readonly-val" +
              (prevProposal && prevProposal.gameType !== proposal.gameType
                ? " ProposalForm-game-type-name-hilite"
                : "")
            }>
            {visibility === "private" || visibility === "private_public" ? (
              <Icon
                name="lock"
                size={14}
                style={{ marginRight: 6, verticalAlign: "middle" }}
              />
            ) : null}
            {formatGameType(proposal.gameType)}
            {editMode !== "creating" && notes ? (
              <span className="ProposalForm-notes">{notes}</span>
            ) : null}
          </span>
        </div>
      </React.Fragment>
    );
  }

  render() {
    let {
      currentUser,
      editMode,
      proposal,
      prevProposal,
      notes,
      visibility,
      usersByName,
      roomsById,
      channelMembership,
      room,
      onUserDetail,
    } = this.props;
    let { players, nigiri, rules } = proposal;
    let ruleset = rules.rules || "japanese";
    let hasTargetUser = players.some((p) => {
      let name = p.user ? p.user.name : p.name;
      return name && name !== currentUser.name;
    });
    // Rooms flagged globalGamesOnly can only host global challenges, so the
    // "Room Only" scope must be locked off.
    let forceGlobal = !!(room && room.globalGamesOnly);
    let isOpenGame =
      forceGlobal || visibility === "public" || visibility === "private_public";

    let rooms = Object.keys(channelMembership)
      .filter((id) => channelMembership[id].type === "room" && roomsById[id])
      .map((id) => roomsById[id])
      .filter((g) => g.name);
    rooms.sort(
      (a, b) =>
        (b.users ? b.users.length : 0) - (a.users ? a.users.length : 0) ||
        (a.name ? a.name.localeCompare(b.name || "") : 0)
    );
    return (
      <div className="ProposalForm">
        {editMode !== "creating" ||
        proposal.gameType === "simul" ||
        proposal.gameType === "rengo" ||
        players.some((p) => {
          let name = p.user ? p.user.name : p.name;
          return name && name !== currentUser.name;
        }) ? (
          <div className="ProposalForm-players">
            <ProposalPlayers
              currentUser={currentUser}
              gameType={proposal.gameType}
              proposal={proposal}
              players={players}
              prevPlayers={prevProposal ? prevProposal.players : null}
              nigiri={nigiri}
              prevNigiri={prevProposal ? prevProposal.nigiri : null}
              usersByName={usersByName}
              onUserDetail={onUserDetail}
              onToggleRole={this._onToggleRole}
              editMode={editMode}
              onChangeProposal={this.props.onChangeProposal}
              onDeclinePlayer={this.props.onDeclinePlayer}
              challengeActions={this.props.challengeActions}
            />
          </div>
        ) : null}
        {editMode === "creating" && !hasTargetUser ? (
          <div className="ProposalForm-field">
            <div className="ProposalForm-field-label">Rooms</div>
            <div className="ProposalForm-field-content">
              <SelectInput value={room.id} onChange={this._onChangeRoomId}>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectInput>
            </div>
          </div>
        ) : null}
        {editMode === "creating" && !hasTargetUser ? (
          <div className="ProposalForm-field">
            <div className="ProposalForm-field-label">Note</div>
            <div className="ProposalForm-field-content">
              <input
                placeholder="Note to challengers"
                type="text"
                value={notes}
                onChange={this._onChangeNotes}
              />
            </div>
          </div>
        ) : null}
        {editMode === "creating" && hasTargetUser
          ? this._renderReadonlyRoom()
          : null}
        {editMode === "creating" ? (
          <div className="ProposalForm-type-visibility">
            <div className="ProposalForm-field">
              <div className="ProposalForm-field-content">
                <div className="ProposalForm-game-type">
                  <div className="ProposalForm-field-label">Game Type</div>
                  <div className="ProposalForm-input-select">
                    <SelectInput
                      value={proposal.gameType}
                      onChange={this._onChangeGameType}>
                      <option value="ranked">Rated</option>
                      <option value="free">Free</option>
                      <option value="simul">Simul</option>
                      <option value="rengo">Rengo</option>
                    </SelectInput>
                  </div>
                </div>
                {!hasTargetUser ? (
                  <div className="ProposalForm-visibility">
                    <div className="ProposalForm-visibility-row">
                      <div className="ProposalForm-visibility-group">
                        <div className="ProposalForm-field-label">
                          Visibility
                        </div>
                        <CheckboxInput
                          label={
                            <span
                              className="ProposalForm-private-label"
                              title="Private game: other users can't observe it.">
                              <Icon name="lock" size={18} />
                            </span>
                          }
                          checked={
                            visibility === "private" ||
                            visibility === "private_public"
                          }
                          onChange={this._onTogglePrivate}
                        />
                      </div>
                      <div className="ProposalForm-visibility-group">
                        <div className="ProposalForm-field-label">Open to</div>
                        <div className="SegmentedControl">
                          <button
                            type="button"
                            disabled={forceGlobal}
                            title={
                              forceGlobal
                                ? "This room only allows global challenges"
                                : undefined
                            }
                            className={
                              "SegmentedControl-item" +
                              (!isOpenGame
                                ? " SegmentedControl-item-active"
                                : "") +
                              (forceGlobal
                                ? " SegmentedControl-item-disabled"
                                : "")
                            }
                            onClick={this._onSelectScopeRoomOnly}>
                            Room Only
                          </button>
                          <button
                            type="button"
                            className={
                              "SegmentedControl-item" +
                              (isOpenGame
                                ? " SegmentedControl-item-active"
                                : "")
                            }
                            onClick={this._onSelectScopeOpen}>
                            All
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {editMode === "creating" ? (
          <div className="ProposalForm-rules-time">
            <div className="ProposalForm-time">
              <div className="ProposalForm-field-content ProposalForm-time-box">
                <div className="ProposalForm-box-title">Time</div>
                <div className="ProposalForm-input-select">
                  <SelectInput
                    value={rules.timeSystem}
                    onChange={this._onChangeTimeSystem}>
                    {timeSystemOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                {rules.timeSystem !== "none" ? (
                  <ProposalFormInput
                    value={formatDuration(rules.mainTime || 0)}
                    label="main"
                    onMinus={this._onMainTimeMinus}
                    onPlus={this._onMainTimePlus}
                  />
                ) : null}
                {rules.timeSystem === "byo_yomi" ||
                rules.timeSystem === "canadian" ? (
                  <ProposalFormInput
                    value={formatDuration(rules.byoYomiTime || 0)}
                    label="overtime"
                    onMinus={this._onByoYomiMinus}
                    onPlus={this._onByoYomiPlus}
                  />
                ) : null}
                {rules.timeSystem === "byo_yomi" ? (
                  <ProposalFormInput
                    value={rules.byoYomiPeriods || 0}
                    label="periods"
                    onMinus={this._onPeriodsMinus}
                    onPlus={this._onPeriodsPlus}
                  />
                ) : null}
                {rules.timeSystem === "canadian" ? (
                  <ProposalFormInput
                    value={rules.byoYomiStones || 0}
                    label="stones"
                    onMinus={this._onStonesMinus}
                    onPlus={this._onStonesPlus}
                  />
                ) : null}
              </div>
            </div>
            <div className="ProposalForm-rules">
              <div className="ProposalForm-field-content ProposalForm-rules-box">
                <div className="ProposalForm-box-title">Rules</div>
                <div className="ProposalForm-input-select">
                  <SelectInput value={ruleset} onChange={this._onChangeRuleset}>
                    {rulesetOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </div>
              <div className="ProposalForm-field-content ProposalForm-board-box">
                <div className="ProposalForm-box-title">Board</div>
                <ProposalFormInput
                  value={`${rules.size}×${rules.size}`}
                  label=""
                  onMinus={this._onSizeMinus}
                  onPlus={this._onSizePlus}
                />
              </div>
            </div>
          </div>
        ) : null}
        {editMode !== "creating" ? (
          <div
            className={
              "ProposalForm-rules-time" +
              (proposal.gameType === "simul"
                ? " ProposalForm-rules-time-simul"
                : "")
            }>
            <div className="ProposalForm-readonly-col">
              {this._renderReadonlyRoomAndGame()}
              <div className="ProposalForm-field-content ProposalForm-time-box ProposalForm-readonly-box">
                <span className="ProposalForm-readonly-label">Time</span>
                <span className="ProposalForm-readonly-val">
                  <GameTimeSystem rules={rules} />
                </span>
              </div>
              {rules.rules ? (
                <div className="ProposalForm-field-content ProposalForm-rules-box ProposalForm-readonly-box">
                  <span className="ProposalForm-readonly-label">Rules</span>
                  <span className="ProposalForm-readonly-val">
                    {formatGameRuleset(rules.rules)}
                  </span>
                </div>
              ) : null}
              {proposal.gameType === "simul" ? (
                <div className="ProposalForm-field-content ProposalForm-board-box ProposalForm-readonly-box">
                  <span className="ProposalForm-readonly-label">Board</span>
                  <span className="ProposalForm-readonly-val">
                    {rules.size}×{rules.size}
                  </span>
                </div>
              ) : null}
            </div>
            {proposal.gameType === "simul" ? null : (
              <div className="ProposalForm-handicap-komi">
                <div className="ProposalForm-field-content ProposalForm-board-box ProposalForm-readonly-box">
                  <span className="ProposalForm-readonly-label">Board</span>
                  <span className="ProposalForm-readonly-val">
                    {rules.size}×{rules.size}
                  </span>
                </div>
                <div className="ProposalForm-handicap-komi-heading">
                  Handicap
                </div>
                <ProposalFormInput
                  value={rules.handicap || 0}
                  label="handicap"
                  readonly={editMode === "waiting" || proposal.nigiri}
                  hilited={
                    prevProposal
                      ? (prevProposal.rules.handicap || 0) !==
                        (rules.handicap || 0)
                      : false
                  }
                  onMinus={this._onHandiMinus}
                  onPlus={this._onHandiPlus}
                />
                <ProposalFormInput
                  value={rules.komi}
                  label="komi"
                  readonly={editMode === "waiting" || proposal.nigiri}
                  hilited={
                    prevProposal
                      ? prevProposal.rules.komi !== rules.komi
                      : false
                  }
                  onMinus={this._onKomiMinus}
                  onPlus={this._onKomiPlus}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  _onTogglePrivate = (e: Object) => {
    let checked = e.target.checked;
    let { visibility, proposal } = this.props;
    if (checked) {
      if (proposal.gameType === "ranked") {
        this.props.onChangeProposal({ ...proposal, gameType: "free" });
      }
      if (visibility === "public" || visibility === "private_public") {
        this.props.onChangeVisibility("private_public");
      } else {
        this.props.onChangeVisibility("private");
      }
    } else {
      if (visibility === "public" || visibility === "private_public") {
        this.props.onChangeVisibility("public");
      } else {
        this.props.onChangeVisibility("roomOnly");
      }
    }
  };

  _onSelectScopeRoomOnly = () => {
    let { visibility, room } = this.props;
    // Rooms that only allow global challenges can't switch to room-only.
    if (room && room.globalGamesOnly) {
      return;
    }
    if (visibility === "public") {
      this.props.onChangeVisibility("roomOnly");
    } else if (visibility === "private_public") {
      this.props.onChangeVisibility("private");
    }
  };

  _onSelectScopeOpen = () => {
    let { visibility } = this.props;
    if (visibility === "roomOnly") {
      this.props.onChangeVisibility("public");
    } else if (visibility === "private") {
      this.props.onChangeVisibility("private_public");
    }
  };

  // Rengo color setup, derived from the proposal: "WWBB" (white team in seats
  // 1-2), "BBWW" (swapped), or "nigiri" (colors decided by chance).
  _rengoColorMode(): "WWBB" | "BBWW" | "nigiri" {
    let { proposal } = this.props;
    if (proposal.nigiri) {
      return "nigiri";
    }
    let first = proposal.players[0];
    return first && (first.role === "black" || first.role === "black_2")
      ? "BBWW"
      : "WWBB";
  }

  // Creator cycles the rengo color setup by clicking a stone:
  // WWBB -> BBWW -> nigiri -> WWBB.
  _cycleRengoColors() {
    let { proposal } = this.props;
    let mode = this._rengoColorMode();
    let next = mode === "WWBB" ? "BBWW" : mode === "BBWW" ? "nigiri" : "WWBB";
    let roles =
      next === "BBWW"
        ? ["black", "black_2", "white", "white_2"]
        : ["white", "white_2", "black", "black_2"];
    let players = proposal.players.map((p, i) => ({ ...p, role: roles[i] }));
    this.props.onChangeProposal({
      ...proposal,
      nigiri: next === "nigiri",
      players,
    });
  }

  _onChangeGameType = (e: Object) => {
    let gameType = e.target.value;
    let { visibility, proposal } = this.props;
    if (
      gameType === "ranked" &&
      (visibility === "private" || visibility === "private_public")
    ) {
      let newVisibility =
        visibility === "private_public" ? "public" : "roomOnly";
      this.props.onChangeVisibility(newVisibility);
    }

    let newProposal = { ...proposal, gameType };

    let creatorSeat = proposal.players.find((p) => {
      let n = p.user ? p.user.name : p.name;
      return n === this.props.currentUser.name;
    });
    let creatorName = this.props.currentUser.name;

    if (gameType === "simul") {
      newProposal.nigiri = false;
      let players = [...proposal.players];
      if (players.length === 2) {
        let whitePlayer = players.find((p) => p.role === "white") || {
          role: "white",
        };
        let blackPlayer = players.find((p) => p.role === "black") || {
          role: "black",
        };
        newProposal.players = [
          { ...whitePlayer, role: "white" },
          { ...blackPlayer, role: "black", handicap: 0, komi: 0 },
          { role: "black", handicap: 0, komi: 0 },
        ];
      } else if (players.length < 3) {
        newProposal.players = [
          { name: creatorName, role: "white" },
          { role: "black", handicap: 0, komi: 0 },
          { role: "black", handicap: 0, komi: 0 },
        ];
      }
    } else if (gameType === "rengo") {
      // 2v2: keep the creator on a white seat, open the other three.
      newProposal.nigiri = false;
      let creatorRole =
        creatorSeat &&
        (creatorSeat.role === "white_2" ||
          creatorSeat.role === "black" ||
          creatorSeat.role === "black_2")
          ? creatorSeat.role
          : "white";
      newProposal.players = [
        { role: "white" },
        { role: "white_2" },
        { role: "black" },
        { role: "black_2" },
      ].map((seat) =>
        seat.role === creatorRole ? { ...seat, name: creatorName } : seat
      );
    } else {
      let players = [...proposal.players];
      if (players.length > 2) {
        let whitePlayer = players.find((p) => p.role === "white") || {
          role: "white",
        };
        let blackPlayer = players.find((p) => p.role === "black") || {
          role: "black",
        };
        newProposal.players = [
          { ...whitePlayer, role: "white" },
          { ...blackPlayer, role: "black" },
        ];
      }
    }

    this.props.onChangeProposal(newProposal);
  };

  _onChangeNotes = (e: Object) => {
    this.props.onChangeNotes(e.target.value);
  };

  _onChangeRoomId = (e: Object) => {
    this.props.onChangeRoomId(e.target.value);
  };

  _onChangeRuleset = (e: Object) => {
    let proposal = this.props.proposal;
    let rules = e.target.value;
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, rules },
    });
  };

  _onChangeTimeSystem = (e: Object) => {
    let proposal = this.props.proposal;
    let timeSystem = e.target.value;
    let rules = { ...proposal.rules, timeSystem };
    if (timeSystem === "canadian") {
      rules.byoYomiStones = 25;
      rules.byoYomiTime = 7 * 60;
    } else if (timeSystem === "byo_yomi") {
      rules.byoYomiTime = 30;
      rules.byoYomiPeriods = 5;
    }
    this.props.onChangeProposal({ ...proposal, rules });
  };

  _onToggleRole = (name: string) => {
    let { editMode, proposal } = this.props;
    if (proposal.gameType === "simul") {
      return;
    }
    // Rengo: only the creator sets colors, by cycling the whole 2v2 setup
    // (WWBB -> BBWW -> nigiri). A joining challenger can't change colors.
    if (proposal.gameType === "rengo") {
      if (editMode === "creating") {
        this._cycleRengoColors();
      }
      return;
    }
    if (editMode !== "negotiating" || proposal.players.length !== 2) {
      return;
    }
    // Players from a received proposal carry their identity as a `user` object
    // (`p.user.name`), while ones we built locally use `p.name`. Match on both
    // so the owner can recolour a challenger's incoming proposal.
    let playerName = (p) => (p.user ? p.user.name : p.name);
    let thisPlayerOld = proposal.players.find((p) => playerName(p) === name);
    let otherPlayerOld = proposal.players.find((p) => playerName(p) !== name);
    if (!thisPlayerOld || !otherPlayerOld) {
      return;
    }
    const thisPlayer = { ...thisPlayerOld };
    const otherPlayer = { ...otherPlayerOld };
    let newProposal = { ...proposal };
    if (proposal.nigiri) {
      newProposal.nigiri = false;
    } else if (thisPlayer.role === "white") {
      thisPlayer.role = "black";
      otherPlayer.role = "white";
    } else if (thisPlayer.role === "black") {
      newProposal.nigiri = true;
      newProposal.rules = { ...newProposal.rules, handicap: 0 };
      thisPlayer.role = "white";
      otherPlayer.role = "black";
    }
    // Maintain order for the sake of KGS API
    newProposal.players = proposal.players.map((p) =>
      playerName(p) === playerName(thisPlayer) ? thisPlayer : otherPlayer
    );
    this.props.onChangeProposal(newProposal);
  };

  _onSizeMinus = () => {
    let { proposal } = this.props;
    let idx = sizeOptions.indexOf(proposal.rules.size);
    if (idx > 0) {
      idx--;
    }
    let size = sizeOptions[idx];
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, size },
    });
  };

  _onSizePlus = () => {
    let { proposal } = this.props;
    let idx = sizeOptions.indexOf(proposal.rules.size);
    if (idx < sizeOptions.length - 1) {
      idx++;
    }
    let size = sizeOptions[idx];
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, size },
    });
  };

  _onHandiMinus = () => {
    let { proposal } = this.props;
    let oldHandi = proposal.rules.handicap || 0;
    let handicap;
    if (oldHandi <= 2) {
      handicap = 0;
    } else {
      handicap = oldHandi - 1;
    }
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, handicap },
    });
  };

  _onHandiPlus = () => {
    let { proposal } = this.props;
    let oldHandi = proposal.rules.handicap || 0;
    let handicap;
    if (oldHandi <= 1) {
      handicap = 2;
    } else {
      handicap = oldHandi < 9 ? oldHandi + 1 : 9;
    }
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, handicap },
    });
  };

  _onKomiMinus = () => {
    let { proposal } = this.props;
    let oldKomi = proposal.rules.komi;
    let komi;
    if (oldKomi === 10.5) {
      komi = 7.5;
    } else if (oldKomi === 7.5) {
      komi = 6.5;
    } else if (oldKomi === 6.5) {
      komi = 0.5;
    } else if (oldKomi === 0.5) {
      komi = -5.5;
    } else {
      komi = oldKomi - 5;
    }
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, komi },
    });
  };

  _onKomiPlus = () => {
    let { proposal } = this.props;
    let oldKomi = proposal.rules.komi;
    let komi;
    if (oldKomi === -5.5) {
      komi = 0.5;
    } else if (oldKomi === 0.5) {
      komi = 6.5;
    } else if (oldKomi === 6.5) {
      komi = 7.5;
    } else if (oldKomi === 7.5) {
      komi = 10.5;
    } else {
      komi = oldKomi + 5;
    }
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, komi },
    });
  };

  _onMainTimeMinus = () => {
    let { proposal } = this.props;
    let oldMainTime = proposal.rules.mainTime || 0;
    let mainTime;
    if (oldMainTime === 5 * 60) {
      mainTime = 60;
    } else {
      mainTime = Math.max(0, oldMainTime - 5 * 60);
    }
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, mainTime },
    });
  };

  _onMainTimePlus = () => {
    let { proposal } = this.props;
    let oldMainTime = proposal.rules.mainTime || 0;
    let mainTime;
    if (oldMainTime === 0) {
      mainTime = 60;
    } else if (oldMainTime === 60) {
      mainTime = 5 * 60;
    } else {
      mainTime = oldMainTime + 5 * 60;
    }
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, mainTime },
    });
  };

  _onByoYomiMinus = () => {
    let { proposal } = this.props;
    let oldByoYomi = proposal.rules.byoYomiTime || 0;
    let byoYomiTime;
    if (oldByoYomi <= 20) {
      byoYomiTime = Math.max(5, oldByoYomi - 5);
    } else if (oldByoYomi <= 60) {
      byoYomiTime = Math.max(5, oldByoYomi - 10);
    } else {
      byoYomiTime = Math.max(5, oldByoYomi - 60);
    }
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, byoYomiTime },
    });
  };

  _onByoYomiPlus = () => {
    let { proposal } = this.props;
    let oldByoYomi = proposal.rules.byoYomiTime || 0;
    let byoYomiTime = 0;
    if (oldByoYomi >= 60) {
      byoYomiTime = oldByoYomi + 60;
    } else if (byoYomiTime >= 20) {
      byoYomiTime = oldByoYomi + 10;
    } else {
      byoYomiTime = oldByoYomi + 5;
    }
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, byoYomiTime },
    });
  };

  _onPeriodsMinus = () => {
    let { proposal } = this.props;
    let byoYomiPeriods = Math.max(1, (proposal.rules.byoYomiPeriods || 5) - 1);
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, byoYomiPeriods },
    });
  };

  _onPeriodsPlus = () => {
    let { proposal } = this.props;
    let byoYomiPeriods = Math.min(
      100,
      (proposal.rules.byoYomiPeriods || 5) + 1
    );
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, byoYomiPeriods },
    });
  };

  _onStonesMinus = () => {
    let { proposal } = this.props;
    let byoYomiStones = Math.max(5, (proposal.rules.byoYomiStones || 25) - 5);
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, byoYomiStones },
    });
  };

  _onStonesPlus = () => {
    let { proposal } = this.props;
    let byoYomiStones = Math.min(100, (proposal.rules.byoYomiStones || 25) + 5);
    this.props.onChangeProposal({
      ...proposal,
      rules: { ...proposal.rules, byoYomiStones },
    });
  };
}
