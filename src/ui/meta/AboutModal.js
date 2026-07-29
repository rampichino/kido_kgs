// @flow
import React, { PureComponent as Component } from "react";
import { A, Modal } from "../common";
import { Icon } from "../common/Icon";
import type { AppActions } from "../../model";

type Props = {
  aboutModalTab: string,
  actions: AppActions,
};

type State = {
  tab: "about" | "credits" | "terms",
};

export default class AboutModal extends Component<Props, State> {
  state = {
    tab: (this.props.aboutModalTab: any) || "about",
  };

  _onShowAbout = (e: Object) => {
    e.preventDefault();
    this.setState({ tab: "about" });
  };

  _onShowCredits = (e: Object) => {
    e.preventDefault();
    this.setState({ tab: "credits" });
  };

  _onShowTerms = (e: Object) => {
    e.preventDefault();
    this.setState({ tab: "terms" });
  };

  render() {
    let { actions } = this.props;
    let { tab } = this.state;

    let content;
    if (tab === "about") {
      content = (
        <div className="AboutModal-content-pane">
          <p>
            Kido is a modern, responsive web client designed for playing and
            watching Go games on the <strong>KGS Go Server</strong>. Kido
            provides an ad-free, streamlined way to access KGS on the web,
            featuring a mobile-responsive interface, personalized themes, and
            upgraded visuals.
          </p>
          <p>
            Join rooms, chat with other players, and enjoy your games in a
            premium, fluid interface.
          </p>
        </div>
      );
    } else if (tab === "credits") {
      content = (
        <div className="AboutModal-content-pane AboutModal-credits">
          <p>
            Kido is built using open-source libraries, assets, and design
            references:
          </p>
          <ul className="AboutModal-credits-list">
            <li>
              <div className="AboutModal-credit-title">
                <a
                  href="https://www.gokgs.com/"
                  target="_blank"
                  rel="noopener noreferrer">
                  KGS Go Server <Icon name="globe" size={12} />
                </a>
              </div>
              <div className="AboutModal-credit-desc">
                The game server, database, and community that form the Kido
                foundation.
              </div>
            </li>
            <li>
              <div className="AboutModal-credit-title">
                <a
                  href="https://github.com/jkk/shinkgs"
                  target="_blank"
                  rel="noopener noreferrer">
                  shinkgs <Icon name="globe" size={12} />
                </a>
              </div>
              <div className="AboutModal-credit-desc">
                The core JavaScript client engine and starting point for the
                Kido web client.
              </div>
            </li>
            <li>
              <div className="AboutModal-credit-title">
                <a
                  href="https://github.com/billhails/SabakiThemes/tree/main"
                  target="_blank"
                  rel="noopener noreferrer">
                  SabakiThemes <Icon name="globe" size={12} />
                </a>
              </div>
              <div className="AboutModal-credit-desc">
                Premium CSS design ideas for wood grains, boards, and stone
                looks.
              </div>
            </li>
            <li>
              <div className="AboutModal-credit-title">
                <a
                  href="https://lucide.dev/"
                  target="_blank"
                  rel="noopener noreferrer">
                  Lucide Icons <Icon name="globe" size={12} />
                </a>
              </div>
              <div className="AboutModal-credit-desc">
                Crisp, modern open-source vector icon set.
              </div>
            </li>
            <li>
              <div className="AboutModal-credit-title">
                <a
                  href="https://jdenticon.com/"
                  target="_blank"
                  rel="noopener noreferrer">
                  Jdenticon <Icon name="globe" size={12} />
                </a>
              </div>
              <div className="AboutModal-credit-desc">
                Free avatar generation library providing beautiful vector
                identicons for KGS users.
              </div>
            </li>
          </ul>
        </div>
      );
    } else if (tab === "terms") {
      content = (
        <div className="AboutModal-content-pane">
          <ul className="AboutModal-terms-list">
            <li>
              <Icon name="globe" size={15} />
              <div>
                <strong>Direct Connection</strong>
                <p>
                  Kido connects you directly to the KGS Go Server. All login
                  credentials and game actions are transmitted straight to KGS
                  without any intermediate server operated by Kido.
                </p>
              </div>
            </li>
            <li>
              <Icon name="shield-check" size={15} />
              <div>
                <strong>No Data Tracking</strong>
                <p>
                  Kido does not store, log, track, or share your credentials,
                  gameplay data, or personal information with any third party.
                  Your data belongs to you and KGS alone.
                </p>
              </div>
            </li>
            <li>
              <Icon name="ban" size={15} />
              <div>
                <strong>Ad-Free Experience</strong>
                <p>
                  There are no advertising scripts, analytics, telemetry, or
                  tracking cookies on Kido. Your experience is private, clean,
                  and fast by design.
                </p>
              </div>
            </li>
            <li>
              <Icon name="lock" size={15} />
              <div>
                <strong>Local Storage Only</strong>
                <p>
                  Kido stores only your preferences (themes, board and stone
                  style, friends list…) in your browser&apos;s local storage.
                  This data never leaves your device.
                </p>
              </div>
            </li>
            <li>
              <Icon name="info" size={15} />
              <div>
                <strong>Third-Party Services</strong>
                <p>
                  Kido uses Cloudflare Turnstile for login protection. Turnstile
                  is privacy-respecting and does not use tracking cookies. No
                  other third-party services are used.
                </p>
              </div>
            </li>
          </ul>
        </div>
      );
    }

    const titles = {
      about: "About Kido",
      credits: "Credits",
      terms: "Terms & Privacy",
    };

    return (
      <Modal title={titles[tab]} onClose={actions.onHideAboutModal}>
        <div className="AboutModal-tabs-container">
          <div className="AboutModal-tabs">
            <div className="AboutModal-tabs-inner">
              <A
                className={
                  "AboutModal-tab" +
                  (tab === "about" ? " AboutModal-tab-active" : "")
                }
                onClick={this._onShowAbout}>
                About
              </A>
              <A
                className={
                  "AboutModal-tab" +
                  (tab === "credits" ? " AboutModal-tab-active" : "")
                }
                onClick={this._onShowCredits}>
                Credits
              </A>
              <A
                className={
                  "AboutModal-tab" +
                  (tab === "terms" ? " AboutModal-tab-active" : "")
                }
                onClick={this._onShowTerms}>
                Terms & Privacy
              </A>
            </div>
          </div>
          <div className="AboutModal-tab-content">{content}</div>
        </div>
      </Modal>
    );
  }
}
