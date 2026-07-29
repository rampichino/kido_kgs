// @flow
import React, { PureComponent as Component } from "react";
import { Modal, Button, Icon } from "../common";

type Props = {
  gameId: ?number,
  onWatch: (gameId: number) => void,
  onClose: () => void,
};

export default class ChallengeTakenModal extends Component<Props> {
  render() {
    let { gameId } = this.props;
    return (
      <Modal onClose={this.props.onClose}>
        <div className="ChallengeTakenModal">
          <div className="ChallengeTakenModal-icon">
            <Icon name="shield-off" size={26} />
          </div>
          <h2 className="ChallengeTakenModal-title">Challenge Closed</h2>
          <p className="ChallengeTakenModal-text">
            The host accepted a different proposal.
            <br />
            You can still watch the game.
          </p>
          <div className="ChallengeTakenModal-actions">
            {typeof gameId === "number" ? (
              <Button primary onClick={this._onWatch}>
                Watch the game
              </Button>
            ) : null}
            <Button secondary onClick={this.props.onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  _onWatch = () => {
    if (typeof this.props.gameId === "number") {
      this.props.onWatch(this.props.gameId);
    }
  };
}
