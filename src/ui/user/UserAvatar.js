// @flow
import React, { PureComponent as Component } from "react";
import * as jdenticon from "jdenticon";
import type { User } from "../../model";

type Props = {
  user: ?User,
};

export default class UserAvatar extends Component<Props> {
  render() {
    let { user } = this.props;
    if (!user) {
      return null;
    }

    if (user.flags && user.flags.avatar) {
      return (
        <div className="UserAvatar">
          <img
            src={`https://files.gokgs.com/avatars/${user.name}.jpg`}
            alt=""
          />
        </div>
      );
    }

    const svgString = jdenticon.toSvg(user.name, 100);

    return (
      <div className="UserAvatar">
        <div
          className="UserAvatar-missing"
          dangerouslySetInnerHTML={{ __html: svgString }}
        />
      </div>
    );
  }
}
