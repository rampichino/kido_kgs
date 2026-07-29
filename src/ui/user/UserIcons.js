// @flow
import React, { PureComponent as Component } from "react";
import { Icon } from "../common";
import { isMaintainer } from "../../util/maintainer";
import type { User } from "../../model";

const EMPTY_FLAGS = {};

type Props = {
  user: User,
  iconSize?: number,
  // The maintainer wrench is a nice-to-know badge, not part of a player's
  // identity — contexts that are already tight (the challenge proposal) drop it.
  hideMaintainer?: boolean,
};

export default class UserIcons extends Component<Props> {
  render() {
    let { user, iconSize = 13, hideMaintainer } = this.props;
    let flags = user.flags || EMPTY_FLAGS;
    let icons: Array<{ element: React$Node, title: string }> = [];
    if (user.authLevel === "jr_admin") {
      icons.push({
        element: (
          <Icon
            key="jr_admin"
            name="shield-check"
            className="UserIcons-jr-admin"
            size={iconSize}
          />
        ),
        title: "Junior Admin",
      });
    } else if (user.authLevel === "sr_admin") {
      icons.push({
        element: (
          <Icon
            key="sr_admin"
            name="shield-check"
            className="UserIcons-sr-admin"
            size={iconSize}
          />
        ),
        title: "Senior Admin",
      });
    } else if (user.authLevel === "super_admin") {
      icons.push({
        element: (
          <Icon
            key="super_admin"
            name="shield-check"
            className="UserIcons-super-admin"
            size={iconSize}
          />
        ),
        title: "Super Admin",
      });
    } else if (user.authLevel === "teacher") {
      icons.push({
        element: (
          <Icon
            key="teacher"
            name="book-open"
            className="UserIcons-teacher"
            size={iconSize}
          />
        ),
        title: "Teacher",
      });
    }
    if (flags.kgsPlus) {
      icons.push({
        element: (
          <span key="kgsPlus" className="UserIcons-kgs-plus">
            🎩
          </span>
        ),
        title: "KGS Plus",
      });
    }
    const showRunnerUp = !!flags.tourneyRunnerUp;
    const showMedal = !!(flags.tourneyWinner || flags.kgsMeijin);
    const showMaintainer = !hideMaintainer && isMaintainer(user.name);
    if (!icons.length && !showMedal && !showRunnerUp && !showMaintainer) {
      return null;
    }
    return (
      <div className="UserIcons">
        {showMaintainer ? (
          <div
            className="UserIcons-icon UserIcons-maintainer"
            title="Kido Maintainer">
            <Icon name="wrench" size={iconSize} />
          </div>
        ) : null}
        {showMedal ? (
          <div
            className="UserIcons-icon UserIcons-medal"
            title="Tournament Winner">
            <Icon name="trophy" size={iconSize} />
          </div>
        ) : null}
        {showRunnerUp ? (
          <div
            className="UserIcons-icon UserIcons-runner-up"
            title="Tournament Runner-Up">
            <Icon name="medal" size={iconSize} />
          </div>
        ) : null}
        {icons.map((item, idx) => (
          <div key={idx} className="UserIcons-icon" title={item.title}>
            {item.element}
          </div>
        ))}
      </div>
    );
  }
}
