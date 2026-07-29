// @flow
import React, { PureComponent as Component } from "react";
import {
  ScreenModal,
  Button,
  CheckboxInput,
  Icon,
  SelectInput,
} from "../common";
import ProposalFormInput from "./ProposalFormInput";
import { formatDuration } from "../../model/game";
import type { GameRuleSet, TimeSystem, Room } from "../../model";

type Props = {
  onClose: Function,
  rooms: Array<Room>,
  onCreate: (
    roomId: number,
    size: number,
    isPrivate: boolean,
    global: boolean,
    timeSystem: TimeSystem,
    mainTime: number,
    byoYomiTime: number,
    byoYomiPeriods: number,
    byoYomiStones: number,
    ruleset: GameRuleSet,
    handicap: number,
    komi: number
  ) => void,
};

type State = {
  roomId: ?number,
  size: number,
  isPrivate: boolean,
  global: boolean,
  timeSystem: TimeSystem,
  mainTime: number,
  byoYomiTime: number,
  byoYomiPeriods: number,
  byoYomiStones: number,
  ruleset: GameRuleSet,
  handicap: number,
  komi: number,
  showMore: boolean,
};

const sizeOptions = [9, 13, 19];

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

export default class DemoSetupModal extends Component<Props, State> {
  state = {
    roomId:
      this.props.rooms && this.props.rooms.length
        ? this.props.rooms[0].id
        : null,
    size: 19,
    isPrivate: false,
    global: false,
    timeSystem: "byo_yomi",
    mainTime: 20 * 60,
    byoYomiTime: 30,
    byoYomiPeriods: 5,
    byoYomiStones: 25,
    ruleset: "japanese",
    handicap: 0,
    komi: 6.5,
    showMore: false,
  };

  render() {
    let {
      roomId,
      size,
      isPrivate,
      global,
      timeSystem,
      mainTime,
      byoYomiTime,
      byoYomiPeriods,
      byoYomiStones,
      ruleset,
      handicap,
      komi,
      showMore,
    } = this.state;
    let rooms = this.props.rooms || [];
    return (
      <ScreenModal onClose={this.props.onClose}>
        <div className="ChallengeEditor DemoSetup">
          <div className="ChallengeEditor-header">Create Demo Board</div>
          <div className="DemoSetup-body">
            {rooms.length > 1 ? (
              <div className="DemoSetup-field DemoSetup-room-field">
                <label className="DemoSetup-room-label">Room</label>
                <SelectInput
                  value={
                    roomId === null || roomId === undefined
                      ? ""
                      : String(roomId)
                  }
                  onChange={this._onChangeRoom}>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </SelectInput>
              </div>
            ) : null}
            <div className="DemoSetup-primary">
              <div className="DemoSetup-field">
                <ProposalFormInput
                  value={`${size}×${size}`}
                  label=""
                  onMinus={this._onSizeMinus}
                  onPlus={this._onSizePlus}
                />
              </div>
              <div className="DemoSetup-field">
                <div className="SegmentedControl DemoSetup-scope">
                  <button
                    type="button"
                    className={
                      "SegmentedControl-item" +
                      (!global ? " SegmentedControl-item-active" : "")
                    }
                    onClick={this._onSelectScopeRoomOnly}>
                    Room Only
                  </button>
                  <button
                    type="button"
                    className={
                      "SegmentedControl-item" +
                      (global ? " SegmentedControl-item-active" : "")
                    }
                    onClick={this._onSelectScopeOpen}>
                    All
                  </button>
                </div>
              </div>
              <div className="DemoSetup-field">
                <CheckboxInput
                  label={
                    <span
                      className="ProposalForm-private-label"
                      title="Private board: other users can't observe it.">
                      <Icon name="lock" size={18} />
                      Private
                    </span>
                  }
                  checked={isPrivate}
                  onChange={this._onTogglePrivate}
                />
              </div>
            </div>
            <button
              type="button"
              className="DemoSetup-more-toggle"
              onClick={this._onToggleMore}>
              <Icon name={showMore ? "chevron-up" : "chevron-down"} size={14} />
              {showMore ? "Fewer options" : "More options"}
            </button>
            {showMore ? (
              <div className="DemoSetup-more">
                <div className="ProposalForm-rules-time">
                  <div className="ProposalForm-time">
                    <div className="ProposalForm-field-content ProposalForm-time-box">
                      <div className="ProposalForm-box-title">Time</div>
                      <div className="ProposalForm-input-select">
                        <SelectInput
                          value={timeSystem}
                          onChange={this._onChangeTimeSystem}>
                          {timeSystemOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </SelectInput>
                      </div>
                      {timeSystem !== "none" ? (
                        <ProposalFormInput
                          value={formatDuration(mainTime)}
                          label="main"
                          onMinus={this._onMainTimeMinus}
                          onPlus={this._onMainTimePlus}
                        />
                      ) : null}
                      {timeSystem === "byo_yomi" ||
                      timeSystem === "canadian" ? (
                        <ProposalFormInput
                          value={formatDuration(byoYomiTime)}
                          label="overtime"
                          onMinus={this._onByoYomiMinus}
                          onPlus={this._onByoYomiPlus}
                        />
                      ) : null}
                      {timeSystem === "byo_yomi" ? (
                        <ProposalFormInput
                          value={byoYomiPeriods}
                          label="periods"
                          onMinus={this._onPeriodsMinus}
                          onPlus={this._onPeriodsPlus}
                        />
                      ) : null}
                      {timeSystem === "canadian" ? (
                        <ProposalFormInput
                          value={byoYomiStones}
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
                        <SelectInput
                          value={ruleset}
                          onChange={this._onChangeRuleset}>
                          {rulesetOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </SelectInput>
                      </div>
                    </div>
                    <div className="ProposalForm-field-content ProposalForm-board-box">
                      <div className="ProposalForm-box-title">
                        Handicap &amp; Komi
                      </div>
                      <ProposalFormInput
                        value={handicap}
                        label="handicap"
                        onMinus={this._onHandiMinus}
                        onPlus={this._onHandiPlus}
                      />
                      <ProposalFormInput
                        value={komi}
                        label="komi"
                        onMinus={this._onKomiMinus}
                        onPlus={this._onKomiPlus}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="DemoSetup-actions">
              <Button primary onClick={this._onCreate}>
                Create
              </Button>
            </div>
          </div>
        </div>
      </ScreenModal>
    );
  }

  _onToggleMore = () => {
    this.setState((s) => ({ showMore: !s.showMore }));
  };

  _onSizeMinus = () => {
    let idx = sizeOptions.indexOf(this.state.size);
    if (idx > 0) {
      this.setState({ size: sizeOptions[idx - 1] });
    }
  };

  _onSizePlus = () => {
    let idx = sizeOptions.indexOf(this.state.size);
    if (idx < sizeOptions.length - 1) {
      this.setState({ size: sizeOptions[idx + 1] });
    }
  };

  _onChangeTimeSystem = (e: Object) => {
    let timeSystem = e.target.value;
    let update: Object = { timeSystem };
    if (timeSystem === "canadian") {
      update.byoYomiStones = 25;
      update.byoYomiTime = 7 * 60;
    } else if (timeSystem === "byo_yomi") {
      update.byoYomiTime = 30;
      update.byoYomiPeriods = 5;
    }
    this.setState(update);
  };

  _onMainTimeMinus = () => {
    let old = this.state.mainTime;
    let mainTime = old === 5 * 60 ? 60 : Math.max(0, old - 5 * 60);
    this.setState({ mainTime });
  };

  _onMainTimePlus = () => {
    let old = this.state.mainTime;
    let mainTime = old === 0 ? 60 : old === 60 ? 5 * 60 : old + 5 * 60;
    this.setState({ mainTime });
  };

  _onByoYomiMinus = () => {
    let old = this.state.byoYomiTime;
    let byoYomiTime =
      old <= 20
        ? Math.max(5, old - 5)
        : old <= 60
          ? Math.max(5, old - 10)
          : Math.max(5, old - 60);
    this.setState({ byoYomiTime });
  };

  _onByoYomiPlus = () => {
    let old = this.state.byoYomiTime;
    let byoYomiTime = old >= 60 ? old + 60 : old >= 20 ? old + 10 : old + 5;
    this.setState({ byoYomiTime });
  };

  _onPeriodsMinus = () => {
    this.setState((s) => ({
      byoYomiPeriods: Math.max(1, s.byoYomiPeriods - 1),
    }));
  };

  _onPeriodsPlus = () => {
    this.setState((s) => ({
      byoYomiPeriods: Math.min(100, s.byoYomiPeriods + 1),
    }));
  };

  _onStonesMinus = () => {
    this.setState((s) => ({
      byoYomiStones: Math.max(5, s.byoYomiStones - 5),
    }));
  };

  _onStonesPlus = () => {
    this.setState((s) => ({
      byoYomiStones: Math.min(100, s.byoYomiStones + 5),
    }));
  };

  _onChangeRuleset = (e: Object) => {
    this.setState({ ruleset: e.target.value });
  };

  _onHandiMinus = () => {
    let old = this.state.handicap;
    this.setState({ handicap: old <= 2 ? 0 : old - 1 });
  };

  _onHandiPlus = () => {
    let old = this.state.handicap;
    this.setState({ handicap: old <= 1 ? 2 : Math.min(9, old + 1) });
  };

  _onKomiMinus = () => {
    let old = this.state.komi;
    let komi;
    if (old === 10.5) {
      komi = 7.5;
    } else if (old === 7.5) {
      komi = 6.5;
    } else if (old === 6.5) {
      komi = 0.5;
    } else if (old === 0.5) {
      komi = -5.5;
    } else {
      komi = old - 5;
    }
    this.setState({ komi });
  };

  _onKomiPlus = () => {
    let old = this.state.komi;
    let komi;
    if (old === -5.5) {
      komi = 0.5;
    } else if (old === 0.5) {
      komi = 6.5;
    } else if (old === 6.5) {
      komi = 7.5;
    } else if (old === 7.5) {
      komi = 10.5;
    } else {
      komi = old + 5;
    }
    this.setState({ komi });
  };

  _onTogglePrivate = () => {
    this.setState((s) => ({ isPrivate: !s.isPrivate }));
  };

  _onSelectScopeRoomOnly = () => {
    this.setState({ global: false });
  };

  _onSelectScopeOpen = () => {
    this.setState({ global: true });
  };

  _onCreate = () => {
    let {
      roomId,
      size,
      isPrivate,
      global,
      timeSystem,
      mainTime,
      byoYomiTime,
      byoYomiPeriods,
      byoYomiStones,
      ruleset,
      handicap,
      komi,
    } = this.state;
    let rooms = this.props.rooms || [];
    let validRoom =
      roomId !== null &&
      roomId !== undefined &&
      rooms.some((r) => r.id === roomId);
    let targetRoom = validRoom ? roomId : rooms.length ? rooms[0].id : null;
    if (targetRoom === null || targetRoom === undefined) {
      return;
    }
    this.props.onCreate(
      targetRoom,
      size,
      isPrivate,
      global,
      timeSystem,
      mainTime,
      byoYomiTime,
      byoYomiPeriods,
      byoYomiStones,
      ruleset,
      handicap,
      komi
    );
  };

  _onChangeRoom = (e: { target: { value: string } }) => {
    this.setState({ roomId: Number(e.target.value) });
  };
}
