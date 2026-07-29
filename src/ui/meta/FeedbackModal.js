// @flow
import React, { PureComponent as Component } from "react";
import { Modal, Button } from "../common";
import { Icon } from "../common/Icon";
import { getUserStatusKind, getUserStatusText } from "../../model/user";
import type { User, AppActions, Index } from "../../model";

// All feedback is routed to the maintainer. Online → opens an in-app chat;
// offline → falls back to email.
const FEEDBACK_RECIPIENT = "rampichino";
const FEEDBACK_EMAIL = "kido@tuta.com";

const CATEGORIES = [
  { key: "bug", label: "Bug", subject: "Bug Report" },
  { key: "feature", label: "Feature", subject: "Feature Request" },
  { key: "general", label: "General", subject: "Feedback" },
];

type Props = {
  currentUser: ?User,
  usersByName: Index<User>,
  actions: AppActions,
  onClose: Function,
};

type State = {
  category: string,
  message: string,
};

export default class FeedbackModal extends Component<Props, State> {
  state = { category: "general", message: "" };

  componentDidMount() {
    // Pull the maintainer's current status so the chat option can show whether
    // they're online.
    this.props.actions.onRequestPresence(FEEDBACK_RECIPIENT);
  }

  _recipient(): ?User {
    return this.props.usersByName[FEEDBACK_RECIPIENT];
  }

  _isOnline(): boolean {
    let user = this._recipient();
    return !!(user && user.flags && user.flags.connected);
  }

  _subject(): string {
    let cat = CATEGORIES.find((c) => c.key === this.state.category);
    return cat ? cat.subject : "Feedback";
  }

  _onChangeCategory = (key: string) => {
    this.setState({ category: key });
  };

  _onChangeMessage = (e: Object) => {
    this.setState({ message: e.target.value });
  };

  _onSendChat = () => {
    let body = this.state.message.trim();
    if (!body || !this._isOnline()) {
      return;
    }
    let text = "[" + this._subject() + "] " + body;
    this.props.actions.onStartChatWithMessage(FEEDBACK_RECIPIENT, text);
    this.props.onClose();
  };

  _onSendEmail = () => {
    let body = this.state.message.trim();
    let href =
      "mailto:" +
      FEEDBACK_EMAIL +
      "?subject=" +
      encodeURIComponent(this._subject()) +
      (body ? "&body=" + encodeURIComponent(body) : "");
    window.open(href, "_blank", "noopener,noreferrer");
    this.props.onClose();
  };

  render() {
    let { currentUser, onClose } = this.props;
    let { category, message } = this.state;
    let recipient = this._recipient();
    let online = this._isOnline();
    let canSend = message.trim().length > 0;
    // Guests have no chat/social ability; offer email only.
    let isGuest = !!(
      currentUser &&
      currentUser.flags &&
      currentUser.flags.guest
    );
    let statusKind = recipient ? getUserStatusKind(recipient) : "offline";
    let statusText = recipient ? getUserStatusText(recipient) : "Offline";

    return (
      <Modal title="Feedback" onClose={onClose}>
        <div className="FeedbackModal">
          <p className="FeedbackModal-intro">
            Kido is actively developed. Your feedback directly shapes the
            project, send it as an in-app message or by email.
          </p>

          <div className="FeedbackModal-categories">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                className={
                  "FeedbackModal-category" +
                  (category === c.key ? " FeedbackModal-category-active" : "")
                }
                onClick={() => this._onChangeCategory(c.key)}>
                {c.label}
              </button>
            ))}
          </div>

          <textarea
            className="FeedbackModal-message"
            placeholder="Write your message…"
            value={message}
            onChange={this._onChangeMessage}
            rows={5}
          />

          {!isGuest ? (
            <div className="FeedbackModal-status">
              <span
                className={
                  "FeedbackModal-status-dot FeedbackModal-status-" + statusKind
                }
                title={statusText}
              />
              Maintainer is {online ? "online" : "offline"}
            </div>
          ) : null}

          <div className="FeedbackModal-actions">
            {!isGuest ? (
              <Button
                primary={online}
                secondary={!online}
                icon="message-square"
                disabled={!canSend || !online}
                onClick={this._onSendChat}>
                Chat
              </Button>
            ) : null}
            <Button
              primary={isGuest || !online}
              secondary={!isGuest && online}
              icon="mail"
              onClick={this._onSendEmail}>
              Send by email
            </Button>
          </div>

          <div className="FeedbackModal-footer">
            <Icon name="mail" size={13} />
            Email goes to {FEEDBACK_EMAIL}
          </div>
        </div>
      </Modal>
    );
  }
}
