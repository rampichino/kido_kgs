// @flow
import React, { PureComponent as Component } from "react";
import { Modal, Button, Icon } from "../common";

type Props = {
  gameId: number,
  onSave: (gameId: number) => void,
  onDiscard: (gameId: number) => void,
  onCancel: () => void,
};

export default class DemoCloseModal extends Component<Props> {
  render() {
    return (
      <Modal onClose={this.props.onCancel}>
        <div className="DemoCloseModal">
          <div className="DemoCloseModal-icon">
            <Icon name="presentation" size={26} />
          </div>
          <h2 className="DemoCloseModal-title">
            This board isn&apos;t saved yet
          </h2>
          <p className="DemoCloseModal-text">
            Save it to your game list before closing?
          </p>
          <div className="DemoCloseModal-actions">
            <Button primary onClick={this._onSave}>
              Yes, save it
            </Button>
            <Button secondary onClick={this._onDiscard}>
              No
            </Button>
            <Button secondary onClick={this.props.onCancel}>
              Don&apos;t close
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  _onSave = () => {
    this.props.onSave(this.props.gameId);
  };

  _onDiscard = () => {
    this.props.onDiscard(this.props.gameId);
  };
}
