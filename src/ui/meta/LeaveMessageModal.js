// @flow
import React, { PureComponent as Component } from "react";
import { Modal, Button, Icon } from "../common";
import { quoteRegExpPattern } from "../../util/string";
import { distinctBy } from "../../util/collection";
import { sortUsers } from "../../model/user";
import { formatLocaleDateTime, timeAgo } from "../../util/date";
import type {
  LeaveMessageStatus,
  User,
  Index,
  MailboxMessage,
} from "../../model";

type Props = {
  onClose: () => any,
  onSend: (recipient: string, text: string) => any,
  onDeleteMessage: (time: number, username: string) => any,
  onClearAll: () => any,
  onStartChat: (user: User) => any,
  leaveMessageStatus: ?LeaveMessageStatus,
  leaveMessageTargetUser: ?string,
  usersByName: Index<User>,
  mailboxMessages: Array<MailboxMessage>,
};

type State = {
  recipient: string,
  messageText: string,
  validationError: ?string,
  searchFocused: boolean,
  activeTab: "inbox" | "send",
  inboxSeen: boolean,
};

function getRankTier(rank: string): string {
  if (!rank || rank === "-" || rank === "?" || rank === "NR") {
    return "ddk";
  }
  if (/p$/i.test(rank)) {
    return "pro";
  }
  if (/d$/i.test(rank)) {
    const n = parseInt(rank, 10);
    return n >= 4 ? "sdk" : "dan";
  }
  const n = parseInt(rank, 10);
  if (!isNaN(n) && n >= 10) {
    return "ddk";
  }
  return "sdk";
}

export default class LeaveMessageModal extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const hasMessages =
      props.mailboxMessages && props.mailboxMessages.length > 0;
    this.state = {
      recipient: props.leaveMessageTargetUser || "",
      messageText: "",
      validationError: null,
      searchFocused: false,
      activeTab: hasMessages ? "inbox" : "send",
      inboxSeen: hasMessages,
    };
  }

  render() {
    const { onClose, leaveMessageStatus, usersByName, mailboxMessages } =
      this.props;
    const { recipient, messageText, searchFocused, activeTab, inboxSeen } =
      this.state;
    const isSending = leaveMessageStatus === "sending";

    const instructions =
      "The message will be delivered the next time the user logs in. If they're currently online, use the chat instead.";

    let searchResults = [];
    if (recipient.trim().length > 0) {
      let queryRe = new RegExp(quoteRegExpPattern(recipient), "i");
      searchResults = Object.keys(usersByName)
        .filter((name) => queryRe.test(name))
        .map((name) => usersByName[name])
        .filter((user) => !user.flags || !user.flags.connected); // Offline users only
      searchResults = distinctBy(searchResults, (u) => u.name);
      sortUsers(searchResults);
      searchResults = searchResults.slice(0, 8);
    }
    const showDropdown = searchFocused && searchResults.length > 0;

    return (
      <Modal title="Mailbox" onClose={onClose}>
        <div className="LeaveMessageModal">
          <div className="LeaveMessageModal-tabs">
            <button
              className={`LeaveMessageModal-tab ${activeTab === "inbox" ? "active" : ""}`}
              onClick={() => this._onTabChange("inbox")}>
              Inbox
              {mailboxMessages && mailboxMessages.length > 0 && !inboxSeen ? (
                <span className="LeaveMessageModal-tab-badge">
                  {mailboxMessages.length}
                </span>
              ) : null}
            </button>
            <button
              className={`LeaveMessageModal-tab ${activeTab === "send" ? "active" : ""}`}
              onClick={() => this._onTabChange("send")}>
              Send Message
            </button>
          </div>

          {activeTab === "inbox" ? (
            this._renderInbox()
          ) : (
            <div className="LeaveMessageModal-form">
              <p className="LeaveMessageModal-instructions">{instructions}</p>

              <div className="LeaveMessageModal-field">
                <label htmlFor="leave-message-recipient">Username</label>
                <div className="LeaveMessageModal-search-container">
                  <input
                    id="leave-message-recipient"
                    className="LeaveMessageModal-input"
                    type="text"
                    name="recipient"
                    placeholder="Username"
                    value={recipient}
                    onChange={this._onChangeInput}
                    onFocus={this._onSearchFocus}
                    onBlur={this._onSearchBlur}
                    disabled={isSending || leaveMessageStatus === "success"}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                  />
                  {showDropdown && (
                    <div className="LeaveMessageModal-search-dropdown">
                      {searchResults.map((user) => (
                        <div
                          key={user.name}
                          className="LeaveMessageModal-search-result"
                          onMouseDown={() => this._onSelectUser(user)}>
                          {user.name}
                          {user.rank ? (
                            <span
                              className={`UserName-rank-chip UserName-rank-chip-${getRankTier(
                                user.rank
                              )}`}>
                              {user.rank}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="LeaveMessageModal-field">
                <div className="LeaveMessageModal-textarea-header">
                  <label htmlFor="leave-message-body">Message</label>
                  <span className="LeaveMessageModal-char-count">
                    {messageText.length} / 1000
                  </span>
                </div>
                <textarea
                  id="leave-message-body"
                  className="LeaveMessageModal-input"
                  name="messageText"
                  placeholder="Write your message here..."
                  value={messageText}
                  maxLength={1000}
                  onChange={this._onChangeInput}
                  rows={5}
                  disabled={isSending || leaveMessageStatus === "success"}
                />
              </div>

              {this._renderStatus()}

              <div className="LeaveMessageModal-buttons">
                {leaveMessageStatus === "success" ? (
                  <Button primary onClick={onClose}>
                    Close
                  </Button>
                ) : (
                  <Button
                    icon="paper-plane"
                    primary
                    onClick={this._onSubmit}
                    disabled={isSending}>
                    {isSending ? "Sending..." : "Send Message"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  _onTabChange = (tab: "inbox" | "send") => {
    this.setState({
      activeTab: tab,
      validationError: null,
      inboxSeen: tab === "inbox" ? true : this.state.inboxSeen,
    });
  };

  _onReply = (senderName: string) => {
    const userObj = this.props.usersByName[senderName];
    if (userObj && userObj.flags && userObj.flags.connected) {
      this.props.onClose();
      this.props.onStartChat(userObj);
    } else {
      this.setState({
        activeTab: "send",
        recipient: senderName,
        validationError: null,
      });
    }
  };

  _renderInbox() {
    const { mailboxMessages, onDeleteMessage, onClearAll } = this.props;

    if (!mailboxMessages || mailboxMessages.length === 0) {
      return (
        <div className="LeaveMessageModal-empty-inbox">
          <Icon name="mail" size={32} />
          <p>No messages in your mailbox.</p>
        </div>
      );
    }

    const sortedMessages = [...mailboxMessages].sort((a, b) => {
      const timeA = new Date(a.time).getTime();
      const timeB = new Date(b.time).getTime();
      return timeB - timeA;
    });

    return (
      <div className="LeaveMessageModal-inbox-container">
        <div className="LeaveMessageModal-inbox-header">
          <span>
            {mailboxMessages.length} message
            {mailboxMessages.length > 1 ? "s" : ""}
          </span>
          <Button small warning onClick={onClearAll}>
            Clear All
          </Button>
        </div>
        <div className="LeaveMessageModal-inbox-warning">
          <Icon name="alert-triangle" size={13} />
          Please clear your old messages. A full inbox prevents other users from
          sending you new ones.
        </div>
        <div className="LeaveMessageModal-inbox">
          {sortedMessages.map((msg, index) => {
            const date = new Date(msg.time);
            return (
              <div key={index} className="LeaveMessageModal-msg-card">
                <div className="LeaveMessageModal-msg-meta">
                  <span className="LeaveMessageModal-msg-sender">
                    {msg.user.name}
                    {msg.user.rank ? (
                      <span
                        className={`UserName-rank-chip UserName-rank-chip-${getRankTier(
                          msg.user.rank
                        )}`}>
                        {msg.user.rank}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="LeaveMessageModal-msg-time"
                    title={formatLocaleDateTime(date)}>
                    {timeAgo(date)}
                  </span>
                </div>
                <div className="LeaveMessageModal-msg-body">{msg.text}</div>
                <div className="LeaveMessageModal-msg-footer">
                  <button
                    className="LeaveMessageModal-trash-btn"
                    onClick={() => onDeleteMessage(msg.time, msg.user.name)}
                    title="Delete message">
                    <Icon name="trash" size={14} />
                  </button>
                  <Button
                    small
                    secondary
                    icon="reply"
                    onClick={() => this._onReply(msg.user.name)}
                    title="Reply"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  _renderStatus() {
    const { leaveMessageStatus } = this.props;
    const { validationError } = this.state;

    if (validationError) {
      return (
        <div className="LeaveMessageModal-status LeaveMessageModal-status-error">
          {validationError}
        </div>
      );
    }

    switch (leaveMessageStatus) {
      case "sending":
        return (
          <div className="LeaveMessageModal-status LeaveMessageModal-status-info">
            Sending message...
          </div>
        );
      case "success":
        return (
          <div className="LeaveMessageModal-status LeaveMessageModal-status-success">
            Message sent successfully!
          </div>
        );
      case "noUser":
        return (
          <div className="LeaveMessageModal-status LeaveMessageModal-status-error">
            User not found. Please check spelling.
          </div>
        );
      case "full":
        return (
          <div className="LeaveMessageModal-status LeaveMessageModal-status-error">
            Recipient&apos;s mailbox is full.
          </div>
        );
      case "connected":
        return (
          <div className="LeaveMessageModal-status LeaveMessageModal-status-error">
            User is online. Please talk to them directly instead.
          </div>
        );
      case "error":
        return (
          <div className="LeaveMessageModal-status LeaveMessageModal-status-error">
            An error occurred. Please try again.
          </div>
        );
      default:
        return null;
    }
  }

  _onChangeInput = (e: Object) => {
    const { name, value } = e.target;
    if (name === "messageText") {
      if (value.length <= 1000) {
        this.setState({ messageText: value, validationError: null });
      }
    } else {
      this.setState({ [name]: value, validationError: null });
    }
  };

  _onSearchFocus = () => {
    this.setState({ searchFocused: true });
  };

  _onSearchBlur = () => {
    setTimeout(() => {
      this.setState({ searchFocused: false });
    }, 200);
  };

  _onSelectUser = (user: User) => {
    this.setState({ recipient: user.name, searchFocused: false });
  };

  _onSubmit = () => {
    const { recipient, messageText } = this.state;
    const trimmedRecipient = recipient.trim();
    const trimmedMessage = messageText.trim();

    if (!trimmedRecipient) {
      this.setState({ validationError: "Please enter a recipient username." });
      return;
    }

    if (!trimmedMessage) {
      this.setState({ validationError: "Please enter a message." });
      return;
    }

    this.props.onSend(trimmedRecipient, trimmedMessage);
  };
}
