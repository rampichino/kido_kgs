// @flow
import React, { PureComponent as Component } from "react";
import { formatGameRuleset, formatGameScore } from "../../model/game";
import GameTimeSystem from "./GameTimeSystem";
import { formatLocaleDateTime } from "../../util/date";
import type { GameChannel, Room, Index } from "../../model";

const MORE_INFO_PROPS: { [string]: string } = {
  ANNOTATOR: "Annotator",
  COPYRIGHT: "Copyright",
  EVENT: "Event",
  PLACE: "Place",
  PLAYERTEAM: "Team",
  ROUND: "Round",
  SOURCE: "Source",
  TRANSCRIBER: "Transcriber",
};

type Props = {
  game: GameChannel,
  roomsById: Index<Room>,
  children?: any,
  compact?: boolean,
};

export default class GameInfo extends Component<Props> {
  render() {
    let { game, roomsById, children, compact } = this.props;
    let rules = game.rules;
    let room = roomsById[game.roomId];
    let rows = [];
    if (game.name) {
      rows.push(
        <tr key="name">
          <th>Name</th>
          <td>{game.name}</td>
        </tr>
      );
    }
    if (rules) {
      if (!compact) {
        rows.push(
          <tr key="size">
            <th>Size</th>
            <td>{`${rules.size} x ${rules.size}`}</td>
          </tr>
        );
      }

      if (!compact && (rules.handicap || typeof rules.komi === "number")) {
        let handicapText = rules.handicap
          ? `${rules.handicap} ${rules.handicap === 1 ? "stone" : "stones"}`
          : "Even";
        let komiText =
          typeof rules.komi === "number" ? `${rules.komi} komi` : null;
        rows.push(
          <tr key="handicap">
            <th>Handi</th>
            <td>
              {handicapText}
              {komiText ? (
                <span className="GameInfo-komi">{komiText}</span>
              ) : null}
            </td>
          </tr>
        );
      }

      if (!compact && rules.rules) {
        rows.push(
          <tr key="rules">
            <th>Rules</th>
            <td>{formatGameRuleset(rules.rules)}</td>
          </tr>
        );
      }

      if (!compact && rules.timeSystem) {
        rows.push(
          <tr key="time">
            <th>Time</th>
            <td>
              <GameTimeSystem rules={rules} />
            </td>
          </tr>
        );
      }
    }
    if (!compact && room && room.name) {
      rows.push(
        <tr key="room">
          <th>Room</th>
          <td>{room.name}</td>
        </tr>
      );
    }

    if (!compact) {
      if (game.id) {
        rows.push(
          <tr key="gameid">
            <th>ID</th>
            <td>{game.id}</td>
          </tr>
        );
      }
      if (game.time) {
        rows.push(
          <tr key="gametime">
            <th>Date</th>
            <td>{formatLocaleDateTime(new Date(game.time))}</td>
          </tr>
        );
      }
      if (game.over && game.score) {
        rows.push(
          <tr key="gameover">
            <th>Result</th>
            <td>{formatGameScore(game.score)}</td>
          </tr>
        );
      }

      // Add extra SGF metadata (Annotator, Copyright, Event, etc.)
      if (game.tree && game.tree.nodes[0]) {
        let rootNode = game.tree.nodes[0];
        let infoProps = rootNode.props.filter(
          (prop) => prop.name in MORE_INFO_PROPS
        );
        for (let prop of infoProps) {
          let color = prop.color ? `${prop.color[0].toUpperCase()} ` : "";
          let propName = MORE_INFO_PROPS[prop.name];
          // KGS fills the SGF PLACE with "The KGS Go Server at http://...".
          // Drop the trailing URL so it reads cleanly.
          let text = (prop.text || "").replace(
            /\s*at\s+https?:\/\/\S+\/?$/i,
            ""
          );
          rows.push(
            <tr key={`${color}${prop.name.toLowerCase()}`}>
              <th>
                {color}
                {propName}
              </th>
              <td>{text}</td>
            </tr>
          );
        }
      }
    }

    if (!rows.length && !children) {
      return null;
    }

    return (
      <div className="GameInfo">
        <table className="GameInfo-table">
          <tbody>
            {rows}
            {children}
          </tbody>
        </table>
      </div>
    );
  }
}
