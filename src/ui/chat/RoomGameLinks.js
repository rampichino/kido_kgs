// @flow
import React, { PureComponent as Component } from "react";
import { A } from "../common";
import type { GameChannel } from "../../model";

type Props = {
  games: Array<GameChannel>,
  onSelect: (games: Array<GameChannel>) => any,
};

class RoomGameLink extends Component<Props> {
  render() {
    let { games } = this.props;
    let isChallenges = games.length && games[0].type === "challenge";
    let className =
      "RoomGameLink " +
      (isChallenges ? " RoomGameLink-challenges" : "RoomGameLink-games");
    return (
      <div className={className}>
        <A onClick={this._onSelect}>
          <div className="RoomGameLink-icon">
            {isChallenges ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
                <line x1="13" x2="19" y1="19" y2="13" />
                <line x1="16" x2="20" y1="16" y2="20" />
                <line x1="19" x2="21" y1="21" y2="19" />
                <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
                <line x1="5" x2="9" y1="14" y2="18" />
                <line x1="7" x2="4" y1="17" y2="20" />
                <line x1="3" x2="5" y1="19" y2="21" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M10 10h4" />
                <path d="M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3" />
                <path d="M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2z" />
                <path d="M 22 16 L 2 16" />
                <path d="M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2z" />
                <path d="M9 7V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3" />
              </svg>
            )}
          </div>
          <div className="RoomGameLink-label">
            {games.length}{" "}
            {(isChallenges ? "challenge" : "game") +
              (games.length > 1 ? "s" : "")}
          </div>
        </A>
      </div>
    );
  }

  _onSelect = () => {
    this.props.onSelect(this.props.games);
  };
}

type RoomGameLinksProps = {
  games: Array<GameChannel>,
  onSelect: (games: Array<GameChannel>) => any,
};

export default class RoomGameLinks extends Component<RoomGameLinksProps> {
  render() {
    let { games, onSelect } = this.props;
    let activeGames = [];
    let challenges = [];
    for (let game of games) {
      if (game.deletedTime) {
        continue;
      }
      if (game.type === "challenge") {
        challenges.push(game);
      } else {
        activeGames.push(game);
      }
    }
    return (
      <div key="digests" className="RoomGameLinks">
        {activeGames.length ? (
          <RoomGameLink games={activeGames} onSelect={onSelect} />
        ) : null}
        {challenges.length ? (
          <RoomGameLink games={challenges} onSelect={onSelect} />
        ) : null}
      </div>
    );
  }
}
