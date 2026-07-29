// @flow
import React, { PureComponent as Component } from "react";
import GameTypeIcon from "../game/GameTypeIcon";
import GamePlayersList from "../game/GamePlayersList";
import GameTimeSystem from "../game/GameTimeSystem";
import { A, RichContent, Icon } from "../common";
import UserName from "../user/UserName";
import PlayerHoverCard from "../user/PlayerHoverCard";
import { formatLocaleTime, formatRelativeDay } from "../../util/date";
import { getTheme } from "../../util/theme";

// Chat is a scrolling stream — use a longer dwell than the lists so grazing
// message authors while reading doesn't fire the card (or its network fetch).
const CHAT_HOVER_DELAY = 600;

const USER_COLORS_LIGHT = [
  "#dbeafe",
  "#ede9fe",
  "#fce7f3",
  "#d1fae5",
  "#fef3c7",
  "#fee2e2",
  "#cffafe",
  "#ecfccb",
  "#f3e8ff",
  "#ffedd5",
];

const USER_COLORS_DARK = [
  "rgba(59,130,246,0.12)",
  "rgba(139,92,246,0.12)",
  "rgba(236,72,153,0.12)",
  "rgba(16,185,129,0.12)",
  "rgba(245,158,11,0.12)",
  "rgba(239,68,68,0.12)",
  "rgba(6,182,212,0.12)",
  "rgba(132,204,22,0.12)",
  "rgba(168,85,247,0.12)",
  "rgba(249,115,22,0.12)",
];

// Mid (cream) theme: warm, muted per-user tones that sit on the #f4ebd8 panel —
// the cool light pastels read poorly on cream, so use a warm-leaning palette.
const USER_COLORS_MID = [
  "#e8d8be", // warm sand
  "#e7c9b3", // clay
  "#d9d6b8", // olive cream
  "#e3d3c1", // taupe
  "#d6dcc6", // sage
  "#ecd4c4", // peach
  "#dccfd6", // mauve
  "#cdd9cf", // muted green
  "#e9d6a8", // ochre
  "#ddc9c4", // dusty rose
];

function getUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const theme = getTheme();
  const palette =
    theme === "dark"
      ? USER_COLORS_DARK
      : theme === "mid"
        ? USER_COLORS_MID
        : USER_COLORS_LIGHT;
  return palette[Math.abs(hash) % palette.length];
}

// Identifies the calendar day of a timestamp so we can insert a separator when
// the day changes between consecutive items. Returns null for undated items so
// they never trigger a separator.
function dayKey(time: ?number): ?string {
  if (!time) {
    return null;
  }
  const d = new Date(time);
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
}

function DaySeparator({ time }: { time: number }) {
  return (
    <div className="ChatMessages-day">
      <span className="ChatMessages-day-label">{formatRelativeDay(time)}</span>
    </div>
  );
}
import type {
  User,
  ConversationMessage,
  Index,
  GameChannel,
} from "../../model";

type Props = {
  currentUser: User,
  message: ConversationMessage,
  sender: User | string,
  onUserDetail: (string) => any,
  onPlayerHover?: (string) => any,
  onPlayerHoverEnd?: (string) => any,
  userColors?: boolean,
};

class ChatMessageItem extends Component<Props> {
  render() {
    let { currentUser, message, sender, userColors } = this.props;
    // TODO - for some reason this is null sometimes
    if (!sender) {
      sender = "[Unknown]";
    }
    let className =
      "ChatMessages-item" +
      ((message.announcement ? " ChatMessages-item-announcement" : "") +
        (currentUser.name ===
        (typeof sender === "string" ? sender : sender.name)
          ? " ChatMessages-item-self"
          : ""));
    const isSelf =
      currentUser.name === (typeof sender === "string" ? sender : sender.name);
    let timeEl;
    if (message.notDelivered) {
      timeEl = (
        <span className="ChatMessages-item-time ChatMessages-item-undelivered">
          <Icon name="alert-triangle" size={11} /> Not delivered
        </span>
      );
    } else if (message.date) {
      timeEl = (
        <span className="ChatMessages-item-time">
          {message.sending ? "Sending..." : formatLocaleTime(message.date)}
        </span>
      );
    } else {
      timeEl = null;
    }
    return (
      <div className={className}>
        <div
          className="ChatMessages-item-content"
          style={
            !isSelf && userColors
              ? {
                  background: getUserColor(
                    typeof sender === "string" ? sender : sender.name
                  ),
                }
              : undefined
          }>
          <div className="ChatMessages-item-body">
            <RichContent
              content={message.body}
              highlightUser={currentUser.name}
            />
          </div>
          {!isSelf ? (
            <span className="ChatMessages-item-user">
              <A onClick={this._onUserDetail}>
                {typeof sender === "string" ? (
                  sender
                ) : (
                  <PlayerHoverCard
                    user={sender}
                    onHover={this.props.onPlayerHover}
                    onHoverEnd={this.props.onPlayerHoverEnd}
                    showDelay={CHAT_HOVER_DELAY}>
                    <UserName user={sender} />
                  </PlayerHoverCard>
                )}
              </A>
            </span>
          ) : null}
          {timeEl}
        </div>
      </div>
    );
  }

  _onUserDetail = () => {
    let { sender } = this.props;
    this.props.onUserDetail(typeof sender === "string" ? sender : sender.name);
  };
}

type PropsChatGameLink = {
  game: GameChannel,
  onSelect: (GameChannel) => any,
};

class ChatGameLink extends Component<PropsChatGameLink> {
  render() {
    let { game } = this.props;
    let className =
      "ChatMessages-game ChatMessages-game-type-" +
      game.type +
      (game.deletedTime ? " ChatMessages-game-deleted" : "");
    return (
      <A className={className} onClick={this._onSelect}>
        <div className="ChatMessages-game-icon">
          <GameTypeIcon
            type={
              game.initialProposal ? game.initialProposal.gameType : game.type
            }
            isPrivate={game.private}
            subscribersOnly={game.subscribers}
          />
        </div>
        <div className="ChatMessages-game-players">
          <GamePlayersList players={game.players} hideSelfish />
        </div>
        <div className="ChatMessages-game-time">
          {game.initialProposal && game.initialProposal.rules ? (
            <GameTimeSystem rules={game.initialProposal.rules} />
          ) : null}
        </div>
        {game.name ? (
          <div className="ChatMessages-game-name">{game.name}</div>
        ) : null}
      </A>
    );
  }

  _onSelect = () => {
    this.props.onSelect(this.props.game);
  };
}

type ChatItem =
  | { id: number, time: number, type: "message", message: ConversationMessage }
  | { id: number, time: number, type: "game", game: GameChannel };

type PropsChatMessages = {
  currentUser: User,
  messages: Array<ConversationMessage>,
  usersByName: Index<User>,
  games?: ?Array<GameChannel>,
  onUserDetail: (string) => any,
  onPlayerHover?: (string) => any,
  onPlayerHoverEnd?: (string) => any,
  onJoinGame?: (gameId: number | string) => any,
  onSelectChallenge?: (number) => any,
  userColors?: boolean,
  recipientOffline?: boolean,
  hideEmptyState?: boolean,
};

export default class ChatMessages extends Component<PropsChatMessages> {
  render() {
    let {
      currentUser,
      messages,
      usersByName,
      games,
      onUserDetail,
      onPlayerHover,
      onPlayerHoverEnd,
      userColors,
      recipientOffline,
      hideEmptyState,
    } = this.props;
    let displayMessages;
    if (games && games.length) {
      let itemId = 1;
      let items: Array<ChatItem> = messages.map((msg) => ({
        type: "message",
        id: itemId++,
        time: msg.date ? msg.date.getTime() : 0,
        message: msg,
      }));
      for (let game of games) {
        items.push({
          type: "game",
          id: itemId++,
          time: game.time || 0,
          game: game,
        });
      }
      items.sort((a, b) => a.time - b.time);
      displayMessages = [];
      let prevDay = null;
      for (let item of items) {
        let day = dayKey(item.time);
        if (day && day !== prevDay) {
          displayMessages.push(
            <DaySeparator key={"day-" + item.id} time={item.time} />
          );
          prevDay = day;
        }
        if (item.type === "message") {
          displayMessages.push(
            <ChatMessageItem
              currentUser={currentUser}
              key={item.id}
              message={item.message}
              sender={usersByName[item.message.sender] || item.message.sender}
              onUserDetail={onUserDetail}
              onPlayerHover={onPlayerHover}
              onPlayerHoverEnd={onPlayerHoverEnd}
              userColors={userColors}
            />
          );
        } else if (item.type === "game") {
          displayMessages.push(
            <ChatGameLink
              key={item.id}
              game={item.game}
              onSelect={this._onSelectGame}
            />
          );
        }
      }
    } else {
      displayMessages = [];
      let prevDay = null;
      for (let msg of messages) {
        let time = msg.date ? msg.date.getTime() : 0;
        let day = dayKey(time);
        if (day && day !== prevDay) {
          displayMessages.push(
            <DaySeparator key={"day-" + msg.id} time={time} />
          );
          prevDay = day;
        }
        displayMessages.push(
          <ChatMessageItem
            currentUser={currentUser}
            key={msg.id}
            message={msg}
            sender={usersByName[msg.sender] || msg.sender}
            onUserDetail={onUserDetail}
            onPlayerHover={onPlayerHover}
            onPlayerHoverEnd={onPlayerHoverEnd}
            userColors={userColors}
          />
        );
      }
    }
    if (!displayMessages.length && hideEmptyState) {
      return null;
    }
    return (
      <div className="ChatMessages">
        {displayMessages.length ? (
          displayMessages
        ) : (
          <div className="ChatMessages-empty">
            {recipientOffline ? (
              <>
                <div className="ChatMessages-empty-icon">
                  <Icon name="message-square-off" size={36} />
                </div>
                <div className="ChatMessages-empty-text">User is offline</div>
              </>
            ) : (
              <>
                <div className="ChatMessages-empty-icon">
                  <Icon name="message-square-dashed" size={40} />
                </div>
                <div className="ChatMessages-empty-text">
                  No messages yet — say hello!
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  _onSelectGame = (game: GameChannel) => {
    let { onJoinGame, onSelectChallenge } = this.props;
    if (game.deletedTime) {
      return;
    }
    if (game.type === "challenge" && onSelectChallenge) {
      onSelectChallenge(game.id);
    } else if (onJoinGame) {
      onJoinGame(game.id);
    }
  };
}
