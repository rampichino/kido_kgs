// @flow
import React, { PureComponent as Component } from "react";
import { getWinningColor } from "../../model/game";
import { isBot } from "../../util/bot";
import type { GameSummary } from "../../model";

export type MyGamesTypeKey = "played" | "demo" | "review" | "teaching";
export type MyGamesResult = "won" | "lost";

export type MyGamesFilterState = {
  tag: ?string, // null = all, "" = untagged, otherwise a specific tag
  opponent: string, // substring match against any player name ("" = all)
  gameTypes: Array<MyGamesTypeKey>, // empty = all types
  result: ?MyGamesResult, // null = all; otherwise only won/lost played games
  excludeBots: boolean, // true = hide games against bot opponents
};

export const EMPTY_MY_GAMES_FILTER: MyGamesFilterState = {
  tag: null,
  opponent: "",
  gameTypes: [],
  result: null,
  excludeBots: false,
};

// Each filter pill maps to one or more raw GameType values from the summary.
const TYPE_OPTIONS: Array<{ key: MyGamesTypeKey, label: string }> = [
  { key: "played", label: "Played" },
  { key: "demo", label: "Demo" },
  { key: "review", label: "Review" },
  { key: "teaching", label: "Teach" },
];

function gameTypeKey(type: string): ?MyGamesTypeKey {
  if (type === "ranked" || type === "free") {
    return "played";
  }
  if (type === "demonstration") {
    return "demo";
  }
  if (type === "review" || type === "rengo_review") {
    return "review";
  }
  if (type === "teaching") {
    return "teaching";
  }
  return null;
}

// Win/loss result for one of the player's played games. Returns null for games
// that are not "played" (demo/review/teaching) or have no final score.
function gameResult(game: GameSummary, player: string): ?MyGamesResult {
  if (gameTypeKey(game.type) !== "played") {
    return null;
  }
  let winningColor = getWinningColor(game.score);
  if (!winningColor) {
    return null;
  }
  let winner = game.players[winningColor];
  return winner && winner.name === player ? "won" : "lost";
}

// Pure client-side filter for the My Games archive list.
export function filterMyGames(
  games: Array<GameSummary>,
  filter: MyGamesFilterState,
  player: string
): Array<GameSummary> {
  let query = filter.opponent.trim().toLowerCase();
  return games.filter((game) => {
    if (filter.tag !== null) {
      if (filter.tag === "") {
        if (game.tag) {
          return false;
        }
      } else if (game.tag !== filter.tag) {
        return false;
      }
    }
    if (filter.gameTypes.length) {
      let key = gameTypeKey(game.type);
      if (!key || !filter.gameTypes.includes(key)) {
        return false;
      }
    }
    if (filter.result) {
      if (gameResult(game, player) !== filter.result) {
        return false;
      }
    }
    if (filter.excludeBots) {
      let players = game.players || {};
      let hasBot = Object.keys(players).some((role) => {
        let user = players[role];
        return !!user && user.name !== player && isBot(user.name, user.flags);
      });
      if (hasBot) {
        return false;
      }
    }
    if (query) {
      let players = game.players || {};
      let match = Object.keys(players).some((role) => {
        let user = players[role];
        return !!user && user.name.toLowerCase().includes(query);
      });
      if (!match) {
        return false;
      }
    }
    return true;
  });
}

// Win/loss record over the player's played games (rated + free) that have a
// final score. Demo/review/teaching and unfinished games are not counted.
export function getMyGamesRecord(
  games: Array<GameSummary>,
  player: string
): { wins: number, losses: number } {
  let wins = 0;
  let losses = 0;
  for (let game of games) {
    let result = gameResult(game, player);
    if (result === "won") {
      wins++;
    } else if (result === "lost") {
      losses++;
    }
  }
  return { wins, losses };
}

// Distinct tags currently in use, sorted, for the dropdown.
function collectTags(games: Array<GameSummary>): Array<string> {
  let set = {};
  for (let g of games) {
    if (g.tag) {
      set[g.tag] = true;
    }
  }
  return Object.keys(set).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
}

type Props = {
  games: Array<GameSummary>,
  filter: MyGamesFilterState,
  onChange: (MyGamesFilterState) => any,
};

export default class MyGamesFilter extends Component<Props> {
  render() {
    let { games, filter } = this.props;
    let tags = collectTags(games);

    return (
      <React.Fragment>
        <div className="GameFilterBar-group GameFilterBar-group--no-label">
          <span className="GameFilterBar-label">Type</span>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={
                "GameListFilter-type-btn" +
                (filter.gameTypes.includes(opt.key) ? " active" : "")
              }
              onClick={() => this._toggleType(opt.key)}>
              {opt.label}
            </button>
          ))}
        </div>

        {tags.length ? (
          <div className="GameFilterBar-group">
            <span className="GameFilterBar-label">Tag</span>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={
                  "GameListFilter-type-btn" +
                  (filter.tag === tag ? " active" : "")
                }
                onClick={() => this._toggleTag(tag)}>
                {tag}
              </button>
            ))}
          </div>
        ) : null}
      </React.Fragment>
    );
  }

  _toggleType = (key: MyGamesTypeKey) => {
    let current = this.props.filter.gameTypes;
    let next = current.includes(key)
      ? current.filter((x) => x !== key)
      : [...current, key];
    this.props.onChange({ ...this.props.filter, gameTypes: next });
  };

  _toggleTag = (tag: string) => {
    let next = this.props.filter.tag === tag ? null : tag;
    this.props.onChange({ ...this.props.filter, tag: next });
  };
}
