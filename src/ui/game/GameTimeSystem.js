// @flow
import React, { PureComponent as Component } from "react";
import { Icon } from "../common";
import { formatDuration, getGameTimeSpeed } from "../../model/game";
import type { GameRules } from "../../model";

type Props = {
  rules: GameRules,
  hideIcon?: boolean,
  // Render a compact form alongside the full one (used in the mobile challenge
  // list). Both are output; CSS shows the right one per breakpoint.
  mobileCompact?: boolean,
  // Free (unrated) games: a coffee icon is appended inside the compact pill,
  // styled like the pill's own time icon.
  freeGame?: boolean,
};

// Main time compact: minutes with a ′ mark, dropping the seconds once we're at
// a full minute or more (e.g. 15:00 -> 15′). Sub-minute shows seconds (30″).
function formatCompactMain(secs: number): string {
  if (secs >= 60) {
    return Math.floor(secs / 60) + "′";
  }
  return secs + "″";
}

// Period/overtime compact: keeps seconds (e.g. 0:30 -> 30″, 1:30 -> 1′30″).
function formatCompactPeriod(secs: number): string {
  let m = Math.floor(secs / 60);
  let s = secs % 60;
  if (m > 0 && s > 0) {
    return m + "′" + s + "″";
  }
  if (m > 0) {
    return m + "′";
  }
  return s + "″";
}

// e.g. 15:00 + 5×0:30  ->  15′ (5 × 30″)
// Inner text of the compact pill (the speed icon is added by render()).
function renderCompactText(rules: GameRules) {
  if (rules.timeSystem === "none") {
    return "∞";
  }
  let main = formatCompactMain(rules.mainTime || 0);
  if (rules.timeSystem === "absolute") {
    return main;
  }
  if (rules.timeSystem === "byo_yomi") {
    return `${main} · ${rules.byoYomiPeriods || 0}×${formatCompactPeriod(
      rules.byoYomiTime || 0
    )}`;
  }
  if (rules.timeSystem === "canadian") {
    return `${main} · ${formatCompactPeriod(rules.byoYomiTime || 0)}/${
      rules.byoYomiStones || 0
    }`;
  }
  return null;
}

function renderTimeSystem(rules: GameRules) {
  if (rules.timeSystem === "none") {
    return <span>No time limit</span>;
  }
  const main = (
    <strong className="GameTimeSystem-main">
      {formatDuration(rules.mainTime || 0)}
    </strong>
  );
  if (rules.timeSystem === "absolute") {
    return (
      <span>
        {main} <span className="GameTimeSystem-byoyomi">absolute</span>
      </span>
    );
  }
  if (rules.timeSystem === "byo_yomi") {
    return (
      <span>
        {main}
        <span className="GameTimeSystem-byoyomi">
          {" + "}
          {rules.byoYomiPeriods || 0}
          {"×"}
          {formatDuration(rules.byoYomiTime || 0)}
        </span>
      </span>
    );
  }
  if (rules.timeSystem === "canadian") {
    return (
      <span>
        {main}
        <span className="GameTimeSystem-byoyomi">
          {" + "}
          {formatDuration(rules.byoYomiTime || 0)}/{rules.byoYomiStones || 0}
        </span>
      </span>
    );
  }
  return null;
}

export default class GameTimeSystem extends Component<Props> {
  render() {
    let { rules, hideIcon, mobileCompact } = this.props;
    let speed = getGameTimeSpeed(rules);
    let icon;
    if (!hideIcon) {
      if (speed === "very fast") {
        icon = (
          <div className="GameTimeSystem-icon-double">
            <Icon name="bolt" />
            <Icon name="bolt" />
          </div>
        );
      } else if (speed === "fast") {
        icon = <Icon name="bolt" />;
      } else if (speed === "slow") {
        icon = <Icon name="snail" />;
      }
    }
    let iconEl = icon ? (
      <div className="GameTimeSystem-icon">{icon}</div>
    ) : null;
    if (mobileCompact) {
      // Challenge list: a single accent pill carrying the speed icon + the
      // compact time. "Normal" speed has no bolt/snail, so the pill falls back
      // to a clock icon — every pill keeps its chip. (The full form is
      // unchanged.)
      let chipIcon = icon || <Icon name="clock" />;
      return (
        <div className="GameTimeSystem">
          <span className="GameTimeSystem-full">
            {iconEl}
            {renderTimeSystem(rules)}
          </span>
          <span className="GameTimeSystem-compact">
            <span className="GameTimeSystem-compact-icon">{chipIcon}</span>
            {renderCompactText(rules)}
            {this.props.freeGame ? (
              <span
                className="GameTimeSystem-compact-free"
                title="Free (unrated)">
                <Icon name="coffee" size={13} />
              </span>
            ) : null}
          </span>
        </div>
      );
    }
    return (
      <div className="GameTimeSystem">
        {iconEl}
        {renderTimeSystem(rules)}
      </div>
    );
  }
}
