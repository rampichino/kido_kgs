// @flow
import React, { PureComponent as Component } from "react";
import { Icon } from "../common";
import type { GameType } from "../../model";

const GAME_TYPE_CODE = {
  challenge: "C",
  demonstration: "Demo",
  review: "Rev",
  rengo_review: "Rev",
  teaching: "Teach",
  simul: "Simul",
  rengo: "Rengo",
  free: "Free",
  ranked: "Rated",
  tournament: "🏆",
};

type Props = {
  type: GameType,
  subscribersOnly?: boolean,
  isPrivate?: boolean,
  useChallengeIcons?: boolean,
};

export default class GameTypeIcon extends Component<Props> {
  render() {
    let { type, subscribersOnly, isPrivate } = this.props;
    let isSparkle = type === "ranked" && !subscribersOnly && !isPrivate;
    let isLeaf = type === "free" && !subscribersOnly && !isPrivate;
    let typeClassName =
      "GameTypeIcon GameTypeIcon-" +
      (isPrivate ? "private" : isSparkle ? "sparkle" : isLeaf ? "leaf" : type);
    let code;
    if (subscribersOnly) {
      code = "🎩";
    } else if (isPrivate) {
      code = <Icon name="lock" />;
    } else if (type === "tournament") {
      code = <Icon name="trophy" />;
    } else if (isSparkle) {
      code = <Icon name="shield" size={16} />;
    } else if (isLeaf) {
      code = <Icon name="coffee" size={16} />;
    } else {
      code = GAME_TYPE_CODE[type];
    }
    let tooltip;
    if (isSparkle) {
      tooltip = "Rated";
    } else if (isLeaf) {
      tooltip = "Free";
    }
    return (
      <div className={typeClassName} title={tooltip}>
        <div className="GameTypeIcon-code">{code}</div>
      </div>
    );
  }
}
