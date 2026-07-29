// @flow
import React, { PureComponent as Component } from "react";
import { Spinner, Icon, Modal } from "../common";
import { InvariantError } from "../../util/error";
import type { User, AppActions, Index } from "../../model";
import {
  isSoundEnabled,
  getStoneSoundSet,
  setStoneSoundSet,
  previewStoneSet,
} from "../../sound";
import type { StoneSoundSet } from "../../sound";
import { getMoveAids, setMoveAids } from "../../util/moveAids";
import type { MoveAid } from "../../util/moveAids";
import {
  getBoardScale,
  setBoardScale,
  BOARD_SCALE_MIN,
  BOARD_SCALE_MAX,
  BOARD_SCALE_EVENT,
} from "../../util/boardScale";

export type ChatNotifySetting = "all" | "users" | "none";

export const CHAT_NOTIFY_KEY = "kido_chat_notify";

export function getChatNotifySetting(): ChatNotifySetting {
  try {
    const v = localStorage.getItem(CHAT_NOTIFY_KEY);
    if (v === "users" || v === "none") {
      return v;
    }
  } catch (e) {
    // ignore
  }
  return "all";
}

type Props = {
  currentUser: ?User,
  usersByName: Index<User>,
  actions: AppActions,
  onClose: Function,
};

type State = {
  emailWanted: boolean,
  rankWanted: boolean,
  chatNotify: ChatNotifySetting,
  soundEnabled: boolean,
  stoneSound: StoneSoundSet,
  moveAids: MoveAid,
  boardScale: number,
  hasInitialized: boolean,
  saveStatus: ?("saving" | "saved"),
};

export default class PreferencesModal extends Component<Props, State> {
  _saveTimeout: ?TimeoutID;
  _clearTimeout: ?TimeoutID;

  constructor(props: Props) {
    super(props);
    let { currentUser, usersByName } = props;
    let user = currentUser ? usersByName[currentUser.name] : null;
    let details = user && user.details;
    let rankWanted = user
      ? !!(user.flags && user.flags.canPlayRanked) ||
        (user.rank !== undefined && user.rank !== null)
      : false;
    this.state = {
      emailWanted: details ? !!details.emailWanted : false,
      rankWanted: rankWanted,
      chatNotify: getChatNotifySetting(),
      soundEnabled: isSoundEnabled(),
      stoneSound: getStoneSoundSet(),
      moveAids: getMoveAids(),
      boardScale: getBoardScale(),
      hasInitialized: !!details,
      saveStatus: null,
    };
  }

  componentWillUnmount() {
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
    }
    if (this._clearTimeout) {
      clearTimeout(this._clearTimeout);
    }
    window.removeEventListener(BOARD_SCALE_EVENT, this._onBoardScaleEvent);
  }

  // Keep the slider in sync if the board's corner handle changes the size.
  _onBoardScaleEvent = () => {
    this.setState({ boardScale: getBoardScale() });
  };

  componentDidMount() {
    window.addEventListener(BOARD_SCALE_EVENT, this._onBoardScaleEvent);
    let { currentUser, actions, usersByName } = this.props;
    if (currentUser) {
      let user = usersByName[currentUser.name];
      if (!user || !user.details) {
        // Fire-and-forget: swallow rejections so a transient send failure never
        // surfaces as an uncaught ApiError.
        actions._client
          .sendMessage({
            type: "DETAILS_JOIN_REQUEST",
            name: currentUser.name,
          })
          .catch(() => {});
      }
    }
  }

  componentDidUpdate(prevProps: Props) {
    let { currentUser, usersByName } = this.props;
    if (!currentUser) {
      return;
    }
    let user = usersByName[currentUser.name];
    let prevUser = prevProps.usersByName[currentUser.name];
    let details = user && user.details;
    let prevDetails = prevUser && prevUser.details;

    if (details && (details !== prevDetails || !this.state.hasInitialized)) {
      let rankWanted = user
        ? !!(user.flags && user.flags.canPlayRanked) ||
          (user.rank !== undefined && user.rank !== null)
        : false;
      this.setState({
        emailWanted: !!details.emailWanted,
        rankWanted: rankWanted,
        hasInitialized: true,
      });
    }
  }

  _autosave = () => {
    this.setState({ saveStatus: "saving" });
    let { currentUser, usersByName, actions } = this.props;
    if (!currentUser) {
      return;
    }
    let user = usersByName[currentUser.name];
    let details = user && user.details;
    if (details) {
      let updatedDetails = {
        ...details,
        emailWanted: this.state.emailWanted,
        rankWanted: this.state.rankWanted,
      };
      actions.onUpdateProfileDetails(user, updatedDetails);
    }
    try {
      localStorage.setItem(CHAT_NOTIFY_KEY, this.state.chatNotify);
      localStorage.setItem(
        "kido_sound_enabled",
        this.state.soundEnabled ? "1" : "0"
      );
    } catch (e) {
      // ignore
    }

    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
    }
    if (this._clearTimeout) {
      clearTimeout(this._clearTimeout);
    }

    this._saveTimeout = setTimeout(() => {
      this.setState({ saveStatus: "saved" });
      this._clearTimeout = setTimeout(() => {
        this.setState({ saveStatus: null });
      }, 2000);
    }, 400);
  };

  _onChangeCheckbox = (e: Object) => {
    let target = e.target;
    this.setState(
      {
        // $FlowFixMe: dynamic property keys
        [target.name]: target.checked,
      },
      this._autosave
    );
  };

  _onChangeHideRank = (e: Object) => {
    this.setState(
      {
        rankWanted: !e.target.checked,
      },
      this._autosave
    );
  };

  _onChangeChatNotify = (value: ChatNotifySetting) => {
    this.setState({ chatNotify: value }, this._autosave);
  };

  _onChangeStoneSound = (value: StoneSoundSet) => {
    // Persist immediately and play a preview so the user hears the choice.
    setStoneSoundSet(value);
    previewStoneSet(value);
    this.setState({ stoneSound: value }, this._autosave);
  };

  _onChangeMoveAids = (value: MoveAid) => {
    // Client-only preference (read by the board on each tap) — persist locally.
    setMoveAids(value);
    this.setState({ moveAids: value });
  };

  _onChangeBoardScale = (e: Object) => {
    // Client-only preference. setBoardScale persists + dispatches
    // BOARD_SCALE_EVENT so an open board resizes live.
    let value = parseInt(e.target.value, 10);
    setBoardScale(value);
    this.setState({ boardScale: value });
  };

  render() {
    let { currentUser, usersByName, onClose } = this.props;
    if (!currentUser) {
      throw new InvariantError("currentUser is required");
    }
    let user = usersByName[currentUser.name];
    let details = user && user.details;
    let {
      emailWanted,
      rankWanted,
      chatNotify,
      soundEnabled,
      stoneSound,
      moveAids,
      boardScale,
      hasInitialized,
      saveStatus,
    } = this.state;

    if (!details || !hasInitialized) {
      return (
        <Modal title="Preferences" onClose={onClose}>
          <div className="PreferencesModal-loading">
            <Spinner />
          </div>
        </Modal>
      );
    }

    return (
      <Modal title="Preferences" onClose={onClose}>
        <div className="PreferencesModal">
          <div className="PreferencesModal-fields">
            <div className="PreferencesModal-field">
              <div className="ToggleSwitch">
                <span className="ToggleSwitch-label">
                  Receive KGS announcement emails
                </span>
                <label className="ToggleSwitch-control">
                  <input
                    type="checkbox"
                    name="emailWanted"
                    checked={emailWanted}
                    onChange={this._onChangeCheckbox}
                  />
                  <span className="ToggleSwitch-slider" />
                </label>
              </div>
            </div>

            <div className="PreferencesModal-field">
              <div className="ToggleSwitch">
                <span className="ToggleSwitch-label">
                  Hide rank (games are free)
                </span>
                <label className="ToggleSwitch-control">
                  <input
                    type="checkbox"
                    name="rankWanted"
                    checked={!rankWanted}
                    onChange={this._onChangeHideRank}
                  />
                  <span className="ToggleSwitch-slider" />
                </label>
              </div>
            </div>

            <div className="PreferencesModal-field">
              <div className="ToggleSwitch">
                <span className="ToggleSwitch-label">Use sound effects</span>
                <label className="ToggleSwitch-control">
                  <input
                    type="checkbox"
                    name="soundEnabled"
                    checked={soundEnabled}
                    onChange={this._onChangeCheckbox}
                  />
                  <span className="ToggleSwitch-slider" />
                </label>
              </div>
            </div>

            {soundEnabled ? (
              <div className="PreferencesModal-field PreferencesModal-field-segment">
                <span className="PreferencesModal-segment-label">
                  Stone sound
                </span>
                <div className="PreferencesModal-segment">
                  {[
                    { value: "punchy", label: "Punchy" },
                    { value: "hollow", label: "Hollow" },
                    { value: "pebble", label: "Pebble" },
                    { value: "felt", label: "Felt" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      className={
                        "PreferencesModal-segment-btn" +
                        (stoneSound === opt.value
                          ? " PreferencesModal-segment-btn-active"
                          : "")
                      }
                      onClick={() =>
                        // $FlowFixMe
                        this._onChangeStoneSound(opt.value)
                      }>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="PreferencesModal-field PreferencesModal-field-segment PreferencesModal-field-mobile">
              <span className="PreferencesModal-segment-label">
                Move aids (on mobile - 19x19 and 17x17)
              </span>
              <div className="PreferencesModal-segment">
                {[
                  { value: "deactivate", label: "Off" },
                  { value: "confirm", label: "Confirm" },
                  { value: "zoom", label: "Zoom in" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    className={
                      "PreferencesModal-segment-btn" +
                      (moveAids === opt.value
                        ? " PreferencesModal-segment-btn-active"
                        : "")
                    }
                    onClick={() =>
                      // $FlowFixMe
                      this._onChangeMoveAids(opt.value)
                    }>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="PreferencesModal-field PreferencesModal-field-segment PreferencesModal-field-desktop">
              <span className="PreferencesModal-segment-label">Board size</span>
              <div className="PreferencesModal-slider">
                <input
                  type="range"
                  className="PreferencesModal-slider-input"
                  min={BOARD_SCALE_MIN}
                  max={BOARD_SCALE_MAX}
                  step={5}
                  value={boardScale}
                  onChange={this._onChangeBoardScale}
                />
                <span className="PreferencesModal-slider-value">
                  {boardScale}%
                </span>
              </div>
            </div>

            <div className="PreferencesModal-field PreferencesModal-field-segment">
              <span className="PreferencesModal-segment-label">
                Chat notifications
              </span>
              <div className="PreferencesModal-segment">
                {[
                  { value: "all", label: "All" },
                  { value: "users", label: "Users only" },
                  { value: "none", label: "None" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    className={
                      "PreferencesModal-segment-btn" +
                      (chatNotify === opt.value
                        ? " PreferencesModal-segment-btn-active"
                        : "")
                    }
                    onClick={() =>
                      // $FlowFixMe
                      this._onChangeChatNotify(opt.value)
                    }>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {saveStatus && (
            <div className="PreferencesModal-status-container">
              <div
                className={`PreferencesModal-status-indicator PreferencesModal-status-indicator-${saveStatus}`}>
                {saveStatus === "saving" ? (
                  <React.Fragment>
                    <Icon name="spinner" size={14} />
                    <span>Saving changes...</span>
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <Icon name="check" size={14} />
                    <span>Preferences saved!</span>
                  </React.Fragment>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    );
  }
}
