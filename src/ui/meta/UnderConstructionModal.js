// @flow
import React, { PureComponent as Component } from "react";
import { Modal, Button } from "../common";

type Props = {
  onClose: Function,
};

export default class UnderConstructionModal extends Component<Props> {
  render() {
    let { onClose } = this.props;
    return (
      <Modal onClose={onClose}>
        <div className="UnderConstructionModal">
          <div className="UnderConstructionModal-title">Under Construction</div>
          <div className="UnderConstructionModal-desc">
            <p>That feature {"isn't"} available yet.</p>
            <p>
              Want to help? Send feedback to{" "}
              <a
                href="mailto:kido@tuta.com"
                target="_blank"
                rel="noopener noreferrer">
                kido@tuta.com
              </a>{" "}
              or visit the{" "}
              <a
                href="https://github.com/rampichino/Kido"
                target="_blank"
                rel="noopener noreferrer">
                GitHub project
              </a>{" "}
              to find out how to contribute.
            </p>
            <Button primary onClick={onClose}>
              OK
            </Button>
          </div>
        </div>
      </Modal>
    );
  }
}
