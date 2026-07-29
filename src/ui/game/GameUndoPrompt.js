// @flow
import React, { PureComponent as Component } from "react";
import { Button } from "../common";
import { Icon } from "../common/Icon";
import type { GameRole } from "../../model";

type Props = {
  role: GameRole,
  onAccept: Function,
  onDecline: Function,
};

export default class GameUndoPrompt extends Component<Props> {
  render() {
    let { onAccept, onDecline } = this.props;
    return (
      <div className="GameUndoPrompt">
        <div className="GameUndoPrompt-icon">
          <Icon name="undo-2" size={18} />
        </div>
        <div className="GameUndoPrompt-content">
          <div className="GameUndoPrompt-label">Undo requested</div>
          <div className="GameUndoPrompt-sublabel">
            Your opponent wants to take back the last move
          </div>
        </div>
        <div className="GameUndoPrompt-buttons">
          <Button small onClick={onDecline}>
            Deny
          </Button>
          <Button small primary onClick={onAccept}>
            Allow
          </Button>
        </div>
      </div>
    );
  }
}
