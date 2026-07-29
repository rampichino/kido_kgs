// @flow
import React, { PureComponent as Component } from "react";
import { Modal, Icon } from "../common";
import { openAiSensei, openKifubara } from "../../util/reviewServices";
import { AI_SENSEI_ICON, KIFUBARA_ICON } from "./reviewServiceIcons";

type Props = {
  sgfUrl: string,
  onClose: () => any,
};

type State = {
  // Which service is currently being launched (fetch/POST in flight), or null.
  loading: ?string,
  error: ?string,
};

const SERVICES = [
  {
    key: "aisensei",
    label: "AI Sensei",
    icon: AI_SENSEI_ICON,
  },
  {
    key: "kifubara",
    label: "Kifubara",
    icon: KIFUBARA_ICON,
  },
];

// Picker modal for sending the current game's SGF to an external review site.
// Both services need the SGF content (fetched, possibly proxied), so each
// launch is async and shows a spinner.
export default class AiReviewModal extends Component<Props, State> {
  state = { loading: null, error: null };

  render() {
    let { onClose } = this.props;
    let { loading, error } = this.state;
    return (
      <Modal title="AI analysis" onClose={onClose}>
        <div className="AiReviewModal">
          <div className="AiReviewModal-services">
            {SERVICES.map((s) => (
              <button
                key={s.key}
                type="button"
                className="AiReviewModal-service"
                disabled={!!loading}
                onClick={() => this._onLaunch(s.key)}>
                <span className="AiReviewModal-service-icon">
                  <img src={s.icon} alt="" width={28} height={28} />
                </span>
                <span className="AiReviewModal-service-text">
                  <span className="AiReviewModal-service-label">{s.label}</span>
                </span>
                {loading === s.key ? (
                  <span className="AiReviewModal-service-spinner">
                    <Icon name="loader" size={16} />
                  </span>
                ) : (
                  <Icon name="external-link" size={15} />
                )}
              </button>
            ))}
          </div>
          <p className="AiReviewModal-hint">
            <Icon name="external-link" size={13} />
            You&apos;ll be taken to an external tool to review this game.
          </p>
          {error ? <div className="AiReviewModal-error">{error}</div> : null}
        </div>
      </Modal>
    );
  }

  _onLaunch = (key: string) => {
    if (this.state.loading) {
      return;
    }
    let { sgfUrl } = this.props;
    let launch = key === "aisensei" ? openAiSensei : openKifubara;
    this.setState({ loading: key, error: null });
    launch(sgfUrl)
      .then(() => {
        this.props.onClose();
      })
      .catch((err) => {
        this.setState({
          loading: null,
          error:
            (err && err.message) || "Couldn't load the game. Please try again.",
        });
      });
  };
}
