// @flow
import React, { PureComponent as Component } from "react";
import { isTouchDevice } from "../../util/dom";
import { Icon } from "../common";
import type { Conversation, User } from "../../model";

const EMOJI_LIST = [
  "😀",
  "😂",
  "😊",
  "😍",
  "🤔",
  "😅",
  "👍",
  "👎",
  "🙏",
  "🎉",
  "❤️",
  "😢",
  "😡",
  "🤣",
  "😎",
  "🙄",
  "😴",
  "🥳",
  "👏",
  "🔥",
  "⭐",
  "💯",
  "🎯",
  "🤝",
  "💪",
  "🧠",
  "😮",
  "🤯",
  "😬",
  "🫡",
];

type Props = {
  conversation: ?Conversation,
  onSubmit: (string) => any,
  users?: ?Array<User>,
  onUserDetail?: (string) => any,
  recipientOffline?: boolean,
};

type State = {
  showingUsers: boolean,
  showingEmoji: boolean,
  mentionQuery: string,
  mentionResults: Array<User>,
  mentionIndex: number,
};

export default class ChatMessageBar extends Component<Props, State> {
  static defaultProps: Props;
  _input: ?HTMLInputElement;

  state = {
    showingUsers: false,
    showingEmoji: false,
    mentionQuery: "",
    mentionResults: [],
    mentionIndex: 0,
  };

  componentDidUpdate(prevProps: Props) {
    let prevConvoId = prevProps.conversation && prevProps.conversation.id;
    let convoId = this.props.conversation && this.props.conversation.id;
    if (convoId !== prevConvoId && this._input && !isTouchDevice()) {
      this._input.focus();
    }
  }

  render() {
    let { conversation, recipientOffline } = this.props;
    let { showingEmoji, mentionResults, mentionIndex } = this.state;
    let placeholder;
    let disabled = false;
    if (!conversation || conversation.chatsDisabled) {
      placeholder = "[Chats disabled]";
      disabled = true;
    } else if (recipientOffline) {
      placeholder = "[User is offline]";
      disabled = true;
    } else {
      placeholder = "Type a message...";
    }
    return (
      <div className="ChatMessageBar">
        {mentionResults.length > 0 && (
          <div className="ChatMessageBar-mention-dropdown">
            {mentionResults.map((u, i) => (
              <div
                key={u.name}
                className={
                  "ChatMessageBar-mention-item" +
                  (i === mentionIndex ? " active" : "")
                }
                onMouseDown={() => this._onSelectMention(u.name)}>
                {u.name}
                {u.rank ? (
                  <span className="ChatMessageBar-mention-rank">{u.rank}</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {showingEmoji && (
          <div className="ChatMessageBar-emoji-panel">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                className="ChatMessageBar-emoji-btn"
                onMouseDown={() => this._onInsertEmoji(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="ChatMessageBar-inner">
          <button
            className={
              "ChatMessageBar-emoji-toggle" + (showingEmoji ? " active" : "")
            }
            onClick={disabled ? undefined : this._onToggleEmoji}
            title="Emoji"
            type="button"
            disabled={disabled}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 13s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          <form
            action="#"
            method="post"
            onSubmit={this._onSubmit}
            className="ChatMessageBar-form">
            <input
              ref={this._setInputRef}
              className="ChatMessageBar-input"
              type="text"
              placeholder={placeholder}
              autoFocus={!isTouchDevice() && !disabled}
              onChange={this._onInputChange}
              onKeyDown={this._onKeyDown}
              disabled={disabled}
            />
          </form>
          <button
            className="ChatMessageBar-send-btn"
            onClick={this._onSubmit}
            title="Send"
            type="button"
            disabled={disabled}>
            <Icon name="paper-plane" />
          </button>
        </div>
      </div>
    );
  }

  _setInputRef = (ref: HTMLInputElement | null) => {
    this._input = ref;
  };

  _onToggleUsers = () => {
    this.setState({ showingUsers: !this.state.showingUsers });
  };

  _onToggleEmoji = () => {
    this.setState({ showingEmoji: !this.state.showingEmoji });
  };

  _onInsertEmoji = (emoji: string) => {
    if (!this._input) {
      return;
    }
    const input = this._input;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const val = input.value;
    input.value = val.slice(0, start) + emoji + val.slice(end);
    input.selectionStart = input.selectionEnd = start + emoji.length;
    input.focus();
    this.setState({ showingEmoji: false });
  };

  _onInputChange = () => {
    if (!this._input || !this.props.users) {
      this.setState({ mentionResults: [] });
      return;
    }
    const val = this._input.value;
    const atIdx = val.lastIndexOf("@");
    if (atIdx === -1) {
      this.setState({ mentionResults: [] });
      return;
    }
    const query = val.slice(atIdx + 1).toLowerCase();
    if (!query) {
      this.setState({ mentionResults: [] });
      return;
    }
    const results = (this.props.users || [])
      .filter((u) => u && u.name.toLowerCase().startsWith(query))
      .slice(0, 6);
    this.setState({ mentionResults: results, mentionIndex: 0 });
  };

  _onSelectMention = (name: string) => {
    const input = this._input;
    if (!input) {
      return;
    }
    const val = input.value;
    const atIdx = val.lastIndexOf("@");
    input.value = val.slice(0, atIdx) + "@" + name + " ";
    input.focus();
    this.setState({ mentionResults: [] });
  };

  _onKeyDown = (e: Object) => {
    const { mentionResults, mentionIndex } = this.state;
    if (mentionResults.length === 0) {
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.setState({
        mentionIndex: Math.min(mentionIndex + 1, mentionResults.length - 1),
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.setState({ mentionIndex: Math.max(mentionIndex - 1, 0) });
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      this._onSelectMention(mentionResults[mentionIndex].name);
    } else if (e.key === "Escape") {
      this.setState({ mentionResults: [] });
    }
  };

  _onUserClick = (name: string) => {
    if (this.props.onUserDetail) {
      this.props.onUserDetail(name);
    }
  };

  _onSubmit = (e: Object) => {
    e.preventDefault();
    let { conversation, recipientOffline } = this.props;
    if (
      !conversation ||
      conversation.chatsDisabled ||
      conversation.status !== "created" ||
      recipientOffline
    ) {
      return;
    }
    let input = this._input;
    if (!input) {
      return;
    }
    let body = input.value.trim();
    if (!body) {
      return;
    }
    input.value = "";
    this.setState({ mentionResults: [], showingEmoji: false });
    this.props.onSubmit(body);
  };
}
