// @flow
import React, { PureComponent as Component } from "react";
import UserName from "../user/UserName";
import type { GamePlayers, PlayerColor, User, Index } from "../../model";

type Props = {
  players: ?GamePlayers,
  winner?: ?PlayerColor,
  usersByName?: Index<User>,
  showVs?: boolean,
  hideSelfish?: boolean,
  // Drop the live online/idle status icons (meaningless for archived games).
  hideExtraIcons?: boolean,
  // Drop just the maintainer wrench from the extra icons (challenge rows).
  hideMaintainerIcon?: boolean,
  // Name of the current user; their player gets a "self" marker + "you" chip.
  self?: ?string,
  // Render the current user's player as a compact "You" pill instead of their
  // full name, to save horizontal space in dense lists (e.g. My Games).
  selfAsYou?: boolean,
  onSelectUser?: (string) => any,
  // Player hover-card support (rich tooltip fetched on name hover).
  onPlayerHover?: (string) => any,
  onPlayerHoverEnd?: (string) => any,
};

export default class GamePlayersList extends Component<Props> {
  render() {
    let {
      players,
      winner,
      usersByName,
      showVs,
      hideSelfish,
      hideExtraIcons,
      hideMaintainerIcon,
      self,
      selfAsYou,
      onSelectUser,
      onPlayerHover,
      onPlayerHoverEnd,
    } = this.props;
    let extraIcons = !hideExtraIcons;
    const enrich = (u: ?User) =>
      u && usersByName && usersByName[u.name]
        ? { ...u, ...usersByName[u.name] }
        : u;
    const isSelf = (u: ?User) => !!(self && u && u.name === self);
    // Dim the current user's name only when it's rendered as a full name in a
    // self-aware list (e.g. live games). When the name is shown via the "You"
    // pill, or when selfAsYou is off (e.g. demo games show the real username),
    // render it at normal username opacity instead of dimming it.
    const selfClass = (u: ?User) =>
      selfAsYou && isSelf(u) ? " GamePlayersList-player-self" : "";
    const renderName = (u: ?User) =>
      selfAsYou && isSelf(u) ? (
        <span className="GamePlayersList-you">You</span>
      ) : (
        <UserName
          user={u}
          extraIcons={extraIcons}
          hideMaintainerIcon={hideMaintainerIcon}
          hideSelfish={hideSelfish}
          onSelectUser={onSelectUser}
          onPlayerHover={onPlayerHover}
          onPlayerHoverEnd={onPlayerHoverEnd}
        />
      );
    if (!players) {
      return null;
    }
    let player1 = enrich(
      players.white || players.owner || players.challengeCreator
    );
    let player2 = enrich(players.black);
    // A challenge creator has no assigned colour yet (decided at game start /
    // nigiri), so show a neutral split stone instead of black/white.
    const player1Neutral =
      !players.white && !!(players.owner || players.challengeCreator);
    let white2 = enrich(players.white_2);
    let black2 = enrich(players.black_2);
    const isRengo = !!(white2 || black2);
    if (isRengo) {
      return (
        <div className="GamePlayersList GamePlayersList-rengo">
          <div className="GamePlayersList-rengo-team GamePlayersList-rengo-black">
            {player2 ? (
              <div
                className={
                  "GamePlayersList-player GamePlayersList-player2" +
                  (winner === "black" ? " GamePlayersList-winner" : "")
                }>
                <span className="GamePlayersList-stone GamePlayersList-stone-black" />
                <UserName
                  user={player2}
                  extraIcons={extraIcons}
                  hideMaintainerIcon={hideMaintainerIcon}
                  hideSelfish={hideSelfish}
                />
              </div>
            ) : null}
            {black2 ? (
              <div
                className={
                  "GamePlayersList-player GamePlayersList-black2" +
                  (winner === "black" ? " GamePlayersList-winner" : "")
                }>
                <span className="GamePlayersList-stone GamePlayersList-stone-black" />
                <UserName
                  user={black2}
                  extraIcons={extraIcons}
                  hideMaintainerIcon={hideMaintainerIcon}
                  hideSelfish={hideSelfish}
                />
              </div>
            ) : null}
          </div>
          <div className="GamePlayersList-rengo-divider" />
          <div className="GamePlayersList-rengo-team GamePlayersList-rengo-white">
            <div
              className={
                "GamePlayersList-player GamePlayersList-player1" +
                (winner === "white" && players.white
                  ? " GamePlayersList-winner"
                  : "")
              }>
              <span className="GamePlayersList-stone GamePlayersList-stone-white" />
              <UserName
                user={player1}
                extraIcons={extraIcons}
                hideMaintainerIcon={hideMaintainerIcon}
                hideSelfish={hideSelfish}
                onSelectUser={onSelectUser}
              />
            </div>
            {white2 ? (
              <div
                className={
                  "GamePlayersList-player GamePlayersList-white2" +
                  (winner === "white" ? " GamePlayersList-winner" : "")
                }>
                <span className="GamePlayersList-stone GamePlayersList-stone-white" />
                <UserName
                  user={white2}
                  extraIcons={extraIcons}
                  hideMaintainerIcon={hideMaintainerIcon}
                  hideSelfish={hideSelfish}
                />
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    return (
      <div className="GamePlayersList">
        {player2 ? (
          <div
            className={
              "GamePlayersList-player GamePlayersList-player2" +
              (winner === "black" ? " GamePlayersList-winner" : "") +
              selfClass(player2)
            }>
            {players.black ? (
              <span className="GamePlayersList-stone GamePlayersList-stone-black" />
            ) : null}
            {renderName(player2)}
          </div>
        ) : null}
        {showVs && player1 && player2 ? (
          <span className="GamePlayersList-vs">vs</span>
        ) : null}
        {player1 ? (
          <div
            className={
              "GamePlayersList-player GamePlayersList-player1" +
              (winner === "white" && players.white
                ? " GamePlayersList-winner"
                : "") +
              selfClass(player1)
            }>
            {players.white ? (
              <span className="GamePlayersList-stone GamePlayersList-stone-white" />
            ) : player1Neutral ? (
              <span
                className="GamePlayersList-stone GamePlayersList-stone-neutral"
                title="Colour decided at game start"
              />
            ) : null}
            {renderName(player1)}
          </div>
        ) : null}
      </div>
    );
  }
}
