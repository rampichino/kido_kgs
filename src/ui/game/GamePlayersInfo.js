// @flow
import React, { PureComponent as Component } from "react";
import GameClock from "./GameClock";
import UserName from "../user/UserName";
import UserAvatar from "../user/UserAvatar";
import PlayerHoverCard from "../user/PlayerHoverCard";
import BoardStone from "../board/BoardStone";
import { A, Icon } from "../common";
import { getWinningColor, isDemoOrReview } from "../../model/game";
import type {
  GameChannel,
  GameRules,
  User,
  ClockState,
  Index,
} from "../../model";

type Props = {
  nodeId: ?number,
  color: "white" | "black" | "owner",
  winner: boolean,
  isTurn?: boolean,
  owner: ?User,
  player1: ?User,
  player2: ?User,
  clock: ?ClockState,
  gameRules: ?GameRules,
  captures: number,
  timeLeft: number,
  gameActive: boolean,
  hideAvatar?: boolean,
  onUserDetail: (User) => any,
  onPlayerHover?: (string) => any,
  onPlayerHoverEnd?: (string) => any,
};

class GamePlayersInfoColor extends Component<Props> {
  render() {
    let {
      nodeId,
      color,
      winner,
      isTurn,
      player1,
      player2,
      clock,
      gameRules,
      timeLeft,
      gameActive,
      captures,
      hideAvatar,
      onPlayerHover,
      onPlayerHoverEnd,
    } = this.props;
    if (!player1 && !player2) {
      return null;
    }
    const renderName = (player: User) => (
      <PlayerHoverCard
        user={player}
        onHover={onPlayerHover}
        onHoverEnd={onPlayerHoverEnd}>
        <UserName user={player} hideSelfish />
      </PlayerHoverCard>
    );
    let className =
      "GamePlayersInfo-color GamePlayersInfo-" +
      color +
      (winner ? " GamePlayersInfo-winner" : "");
    let isOwner = color === "owner";
    return (
      <div className={className}>
        {hideAvatar ? null : (
          <div className="GamePlayersInfo-avatar">
            <A onClick={this._onClickPlayer1}>
              <UserAvatar user={player1} />
            </A>
          </div>
        )}
        <div className="GamePlayersInfo-players">
          {player1 ? (
            <div className="GamePlayersInfo-player1">
              {color === "white" || color === "black" ? (
                <div
                  className={
                    "GamePlayersInfo-players-icon" +
                    (isTurn ? " GamePlayersInfo-players-icon-turn" : "")
                  }>
                  <BoardStone color={color} />
                </div>
              ) : null}
              {isOwner ? (
                <span
                  className="GamePlayersInfo-owner-badge"
                  title="Demo board owner">
                  <Icon name="graduation-cap" size={15} />
                </span>
              ) : null}
              <A onClick={this._onClickPlayer1}>
                {isOwner ? (
                  <span title="Game Owner">{renderName(player1)}</span>
                ) : (
                  renderName(player1)
                )}
              </A>
            </div>
          ) : null}
          {player2 ? (
            <div className="GamePlayersInfo-player2">
              {color === "white" || color === "black" ? (
                <div
                  className={
                    "GamePlayersInfo-players-icon" +
                    (isTurn ? " GamePlayersInfo-players-icon-turn" : "")
                  }>
                  <BoardStone color={color} />
                </div>
              ) : null}
              {isOwner ? (
                <span
                  className="GamePlayersInfo-owner-badge"
                  title="Demo board owner">
                  <Icon name="graduation-cap" size={15} />
                </span>
              ) : null}
              <A onClick={this._onClickPlayer2}>
                {isOwner ? (
                  <span title="Game Owner">{renderName(player2)}</span>
                ) : (
                  renderName(player2)
                )}
              </A>
            </div>
          ) : null}
        </div>
        {color !== "owner" ? (
          <div className="GamePlayersInfo-captures-clock">
            <div className="GamePlayersInfo-winner-clock">
              {clock ? (
                <div className="GamePlayersInfo-clock">
                  <GameClock
                    nodeId={nodeId}
                    active={gameActive}
                    clock={clock}
                    timeLeft={timeLeft}
                    gameRules={gameRules}
                  />
                  {captures > 0 ? (
                    <div
                      className="GamePlayersInfo-captures-badge"
                      title={`${captures} stones captured`}>
                      {captures}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {winner ? (
                <div className="GamePlayersInfo-winner-badge" title="Winner">
                  <Icon name="crown" size={28} />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  _onClickPlayer1 = () => {
    if (this.props.player1) {
      this.props.onUserDetail(this.props.player1);
    }
  };

  _onClickPlayer2 = () => {
    if (this.props.player2) {
      this.props.onUserDetail(this.props.player2);
    }
  };
}

type GamePlayersInfoProps = {
  game: GameChannel,
  usersByName?: Index<User>,
  onUserDetail: (User) => any,
  onPlayerHover?: (string) => any,
  onPlayerHoverEnd?: (string) => any,
};

export default class GamePlayersInfo extends Component<GamePlayersInfoProps> {
  render() {
    let { game, usersByName, onUserDetail, onPlayerHover, onPlayerHoverEnd } =
      this.props;
    let players = game.players;
    let winner = getWinningColor(game.score);
    if (!players) {
      return null;
    }
    // The game's player objects are summary snapshots without live profile
    // details; merge the up-to-date user from usersByName so the hover card
    // can show country/joined info instead of loading forever.
    const enrich = (u: ?User) =>
      u && usersByName && usersByName[u.name]
        ? { ...u, ...usersByName[u.name] }
        : u;
    let white1 = enrich(players.white);
    let white2 = enrich(players.white_2);
    let black1 = enrich(players.black);
    let black2 = enrich(players.black_2);
    let color1 = "white";
    if (!white1 && !white2 && !black1 && !black2) {
      white1 = enrich(players.owner);
      color1 = "owner";
    }
    let computedState;
    let nodeId;
    let gameActive;
    if (game.tree) {
      nodeId = game.tree.currentNode;
      computedState = game.tree.computedState[nodeId];
      gameActive = !game.over && nodeId === game.tree.activeNode;
    } else {
      gameActive = false;
    }
    // Whose turn it is: the server's pending MOVE action names the player who
    // must move now. Map that user to their color so the active player's stone
    // can be highlighted (only while the game is live).
    let turnColor = null;
    if (gameActive && game.actions) {
      let moveAction = game.actions.find((a) => a.action === "MOVE");
      let mover = moveAction && moveAction.user && moveAction.user.name;
      if (mover) {
        if (
          (players.white && players.white.name === mover) ||
          (players.white_2 && players.white_2.name === mover)
        ) {
          turnColor = "white";
        } else if (
          (players.black && players.black.name === mover) ||
          (players.black_2 && players.black_2.name === mover)
        ) {
          turnColor = "black";
        }
      }
    }
    // A review of a played game is an analysis session — show just the players'
    // names (with the stone icon), not their avatars. Only applies when real
    // black/white players are present (color1 !== "owner"); an owner-only demo
    // board keeps its single owner avatar.
    let isReviewLike = isDemoOrReview(game);
    let hideAvatar = isReviewLike && color1 !== "owner";
    // Reviews/demos have no running clocks — the SGF may carry the original
    // game's clock data, but showing a live timer in an analysis header is
    // wrong, so suppress it.
    let whiteClock = isReviewLike ? null : game.clocks && game.clocks[color1];
    let blackClock = isReviewLike ? null : game.clocks && game.clocks.black;
    let className =
      "GamePlayersInfo" + (white2 && black2 ? " GamePlayersInfo-rengo" : "");
    return (
      <div className={className}>
        <GamePlayersInfoColor
          nodeId={nodeId}
          color={color1}
          winner={winner === "white"}
          isTurn={turnColor === "white"}
          player1={white1}
          player2={white2}
          owner={players.owner}
          captures={computedState ? computedState.whiteCaptures : 0}
          timeLeft={computedState ? computedState.whiteTimeLeft : -1}
          gameActive={gameActive}
          hideAvatar={hideAvatar}
          clock={whiteClock}
          gameRules={game.rules}
          onUserDetail={onUserDetail}
          onPlayerHover={onPlayerHover}
          onPlayerHoverEnd={onPlayerHoverEnd}
        />
        <GamePlayersInfoColor
          nodeId={nodeId}
          color="black"
          winner={winner === "black"}
          isTurn={turnColor === "black"}
          player1={black1}
          player2={black2}
          owner={players.owner}
          captures={computedState ? computedState.blackCaptures : 0}
          timeLeft={computedState ? computedState.blackTimeLeft : -1}
          gameActive={gameActive}
          hideAvatar={hideAvatar}
          clock={blackClock}
          gameRules={game.rules}
          onUserDetail={onUserDetail}
          onPlayerHover={onPlayerHover}
          onPlayerHoverEnd={onPlayerHoverEnd}
        />
      </div>
    );
  }
}
