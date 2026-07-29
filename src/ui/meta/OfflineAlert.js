// @flow
import React, { PureComponent as Component } from "react";
import { Button } from "../common";
import type { KgsClientState } from "../../model/types";

type Props = {
  logoutError: ?string,
  clientState: KgsClientState,
  onLogout: Function,
};

export default class OfflineAlert extends Component<Props> {
  render() {
    let { logoutError, clientState, onLogout } = this.props;
    let text = "Disconnected";
    // While the session is still nominally alive the client retries on its
    // own (a failed send doesn't bump retryTimes, so check status too) —
    // "log in again" is only true once we're actually logged out.
    let reconnecting =
      !!clientState.retryTimes || clientState.status === "loggedIn";
    if (logoutError) {
      text += ` - ${logoutError.replace(/\.$/, "")}`;
    }
    if (reconnecting) {
      text += ". Trying to reconnect...";
    } else if (!logoutError) {
      text += ". Please log in again.";
    }
    return (
      <div className="OfflineAlert">
        <div className="OfflineAlert-text">{text}</div>
        <div className="OfflineAlert-logout">
          <Button small onClick={onLogout}>
            Exit
          </Button>
        </div>
      </div>
    );
  }
}
