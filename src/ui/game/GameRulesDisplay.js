// @flow
import React, { PureComponent as Component } from "react";
import GameTimeSystem from "./GameTimeSystem";
import type { GameRules } from "../../model";

type Props = {
  rules: GameRules,
  // Emit the compact mobile time form (used in the challenge list).
  compactTime?: boolean,
  // Adds the "free" marker inside that compact time pill.
  freeGame?: boolean,
};

export default class GameRulesDisplay extends Component<Props> {
  render() {
    let { rules, compactTime, freeGame } = this.props;
    return (
      <div className="GameRulesDisplay">
        {rules.timeSystem ? (
          <div className="GameRulesDisplay-time">
            <GameTimeSystem
              rules={rules}
              mobileCompact={compactTime}
              freeGame={freeGame}
            />
          </div>
        ) : null}
        {rules.size && rules.size !== 19 ? (
          <div
            className="GameRulesDisplay-size"
            title={`${rules.size}×${rules.size}`}>
            <span className="GameRulesDisplay-size-num">{rules.size}</span>
            {/* Dropped on mobile, where the bare number is enough. */}
            <span className="GameRulesDisplay-size-suffix">×{rules.size}</span>
          </div>
        ) : null}
        {rules.handicap ? (
          <div
            className="GameRulesDisplay-handicap"
            title={"Handicap " + rules.handicap}>
            ◉
          </div>
        ) : null}
        {rules.komi ? (
          <div className="GameRulesDisplay-komi">Komi {rules.komi}</div>
        ) : null}
      </div>
    );
  }
}
