// @flow
import React, { PureComponent as Component } from "react";
import type { AppActions } from "../../model";

type Props = {
  actions: AppActions,
};

export default class CookieConsent extends Component<Props> {
  _onAccept = (e: Object) => {
    e.preventDefault();
    this.props.actions.onAcceptCookies();
  };

  _onDecline = (e: Object) => {
    e.preventDefault();
    this.props.actions.onDeclineCookies();
  };

  _onShowPrivacy = (e: Object) => {
    e.preventDefault();
    this.props.actions.onShowAboutModal("terms");
  };

  render() {
    return (
      <div className="CookieConsent">
        <div className="CookieConsent-inner">
          <div className="CookieConsent-text">
            Kido uses cookies and browser storage to save your settings and keep
            you securely logged in. You can choose to accept all cookies or
            decline non-essential storage. Read our{" "}
            <a
              href="#"
              className="CookieConsent-link"
              onClick={this._onShowPrivacy}>
              Privacy Policy
            </a>
            .
          </div>
          <div className="CookieConsent-buttons">
            <button
              type="button"
              className="CookieConsent-btn CookieConsent-btn-decline"
              onClick={this._onDecline}>
              Decline
            </button>
            <button
              type="button"
              className="CookieConsent-btn CookieConsent-btn-accept"
              onClick={this._onAccept}>
              Accept All
            </button>
          </div>
        </div>
      </div>
    );
  }
}
