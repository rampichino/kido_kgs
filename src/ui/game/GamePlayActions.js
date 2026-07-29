// @flow
import React, { PureComponent as Component } from "react";
import { A } from "../common";
import { getGamePlayerOtherRole } from "../../model/game";
import type { GameChannel, GameRole, User } from "../../model";

type Props = {
  currentUser: User,
  game: GameChannel,
  isOurMove: boolean,
  scoring: boolean,
  onPass: (GameChannel) => any,
  onUndo: (GameChannel) => any,
  onResign: (GameChannel) => any,
  onAddTime: (game: GameChannel, role: GameRole, seconds: number) => any,
};

export default class GamePlayActions extends Component<Props> {
  render() {
    let { isOurMove, scoring } = this.props;
    let passClassName =
      "GamePlayActions-item-button GamePlayActions-pass" +
      (isOurMove ? "" : " GamePlayActions-pass-disabled");
    return (
      <div className="GamePlayActions">
        {scoring ? null : (
          <div className="GamePlayActions-item">
            <A className={passClassName} onClick={this._onPass}>
              Pass
            </A>
          </div>
        )}
        <div className="GamePlayActions-item">
          <A
            className="GamePlayActions-item-button GamePlayActions-undo"
            onClick={this._onUndo}>
            Undo
          </A>
        </div>
        <div className="GamePlayActions-item">
          <A
            className="GamePlayActions-item-button GamePlayActions-resign"
            onClick={this._onResign}>
            Resign
          </A>
        </div>
        <div className="GamePlayActions-item">
          <A
            className="GamePlayActions-item-button GamePlayActions-addtime"
            onClick={this._onAdd1Minute}>
            +1 min
          </A>
        </div>
      </div>
    );
  }

  _onPass = () => {
    if (this.props.isOurMove) {
      this.props.onPass(this.props.game);
    }
  };

  _onUndo = () => {
    this.props.onUndo(this.props.game);
  };

  _onResign = () => {
    this.props.onResign(this.props.game);
  };

  _onAdd1Minute = () => {
    let { currentUser, game, onAddTime } = this.props;
    let otherRole = getGamePlayerOtherRole(currentUser.name, game.players);
    if (otherRole) {
      onAddTime(game, otherRole, 60);
    }
  };
}
