// @flow
import React, { PureComponent as Component } from "react";
import { get, set } from "idb-keyval";
import { Button, CheckboxInput } from "./common";
import { isTouchDevice } from "../util/dom";
import type { KgsClientState, Preferences, AppActions } from "../model";

type SavedLogin = {
  username: string | null,
  savePassword: boolean | null,
  password: string | null,
};

type Props = {
  loginError: ?string,
  clientState: KgsClientState,
  preferences: Preferences,
  actions: AppActions,
};

type State = {
  logoLoaded: boolean,
  username: string,
  savePassword: boolean,
  password: string,
  captchaToken: ?string,
  captchaError: ?string,
};

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const isExtension =
  typeof window !== "undefined" &&
  !!(window.chrome && window.chrome.runtime && window.chrome.runtime.id);

// Capacitor native app runs serverless and talks directly to KGS, so — like the
// extension — it skips Turnstile entirely. Gate all CAPTCHA logic on isDirectApi.
const isNative = typeof window !== "undefined" && !!(window: any).Capacitor;
const isDirectApi = isExtension || isNative;

const TURNSTILE_SITEKEY = isLocalhost
  ? "1x00000000000000000000AA" // Cloudflare always-pass test key for local dev
  : "0x4AAAAAADdeGj30NWMRwhJG";

export default class LoginScreen extends Component<Props, State> {
  state = {
    logoLoaded: false,
    username: this.props.preferences.username || "",
    // On the native app / extension this also powers the silent reconnect after
    // the OS suspends the app (see AppActions.onSessionLost), so default it on
    // there; a saved choice still wins (loaded in componentDidMount).
    savePassword: isDirectApi,
    password: "",
    captchaToken: null,
    captchaError: null,
  };

  _captchaEl: ?HTMLDivElement;
  _turnstileWidgetId: ?string = null;

  componentDidMount() {
    if (document.body) {
      document.body.classList.add("LoginScreen-body");
    }
    get("savedLogin").then((savedLogin: ?SavedLogin) => {
      if (savedLogin) {
        let nextState = {};
        if (savedLogin.savePassword !== null) {
          nextState.savePassword = savedLogin.savePassword;
        }
        if (savedLogin.password !== null) {
          nextState.password = savedLogin.password;
        }
        if (savedLogin.username) {
          nextState.username = savedLogin.username;
        }
        if (Object.keys(savedLogin).length) {
          this.setState(nextState);
        }
      }
    });
    if (!isDirectApi) {
      this._loadTurnstile();
    }
  }

  componentWillUnmount() {
    if (document.body) {
      document.body.classList.remove("LoginScreen-body");
    }
    if (this._turnstileWidgetId !== null && (window: any).turnstile) {
      (window: any).turnstile.remove(this._turnstileWidgetId);
    }
  }

  _loadTurnstile = () => {
    if ((window: any).turnstile) {
      this._renderCaptcha();
      return;
    }
    (window: any).__onloadTurnstileCallback = this._renderCaptcha;
    var script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__onloadTurnstileCallback&render=explicit";
    script.async = true;
    script.defer = true;
    if (document.head) {
      document.head.appendChild(script);
    }
  };

  _setCaptchaRef = (el: ?HTMLDivElement) => {
    this._captchaEl = el;
    if (el && (window: any).turnstile) {
      this._renderCaptcha();
    }
  };

  _renderCaptcha = () => {
    if (this._captchaEl && (window: any).turnstile) {
      if (this._turnstileWidgetId !== null) {
        (window: any).turnstile.remove(this._turnstileWidgetId);
      }
      this._turnstileWidgetId = (window: any).turnstile.render(
        this._captchaEl,
        {
          sitekey: TURNSTILE_SITEKEY,
          theme: "light",
          retry: "auto",
          "retry-interval": 2000,
          callback: (token) => {
            this.setState({ captchaToken: token, captchaError: null });
          },
          "error-callback": () => {
            this.setState({ captchaToken: null });
            setTimeout(() => {
              if ((window: any).turnstile && this._turnstileWidgetId !== null) {
                (window: any).turnstile.reset(this._turnstileWidgetId);
              }
            }, 1000);
          },
          "expired-callback": () => {
            this.setState({ captchaToken: null });
          },
          "timeout-callback": () => {
            this.setState({ captchaToken: null });
          },
        }
      );
    }
  };

  render() {
    let { loginError, clientState } = this.props;
    let {
      logoLoaded,
      username,
      savePassword,
      password,
      captchaToken,
      captchaError,
    } = this.state;
    let loggingIn = clientState.status === "loggingIn";
    let publicUrl = process.env.PUBLIC_URL || "";
    let error = loginError || captchaError;
    if (!error && clientState.network !== "online") {
      error =
        "Server unavailable. Try again or check your internet connection.";
    }
    return (
      <div className="LoginScreen">
        <div className="LoginScreen-header">
          <div
            className={
              "LoginScreen-title" +
              (logoLoaded ? " LoginScreen-title-logo-loaded" : "")
            }>
            <div className="LoginScreen-title-icon">
              <img
                src={publicUrl + "/apple-touch-icon.png"}
                width={48}
                height={48}
                alt=""
                onLoad={this._onLogoLoad}
              />
            </div>
            <div className="LoginScreen-title-text">Kido</div>
          </div>
        </div>
        <div className="LoginScreen-main">
          {error ? <div className="LoginScreen-error">{error}</div> : null}
          <form
            className="LoginScreen-form"
            action="#"
            method="post"
            onSubmit={this._onLogin}>
            <div className="LoginScreen-form-fields">
              <input
                type="text"
                placeholder="Username"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus={!isTouchDevice()}
                value={username}
                onChange={this._onChangeUsername}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={this._onChangePassword}
              />
              <div className="LoginScreen-save-password">
                <CheckboxInput
                  label={isDirectApi ? "Stay signed in" : "Save password"}
                  checked={savePassword}
                  onChange={this._onChangeSavePassword}
                />
              </div>
            </div>
            {!isDirectApi ? (
              <div className="LoginScreen-captcha" ref={this._setCaptchaRef} />
            ) : null}
            <div className="LoginScreen-form-button">
              <Button
                type="submit"
                loading={loggingIn}
                disabled={loggingIn || (!isDirectApi && !captchaToken)}>
                Log In
              </Button>
            </div>
          </form>
          <div className="LoginScreen-help">
            <a
              href="https://www.gokgs.com/register"
              target="_blank"
              rel="noopener noreferrer">
              Sign up
            </a>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <a
              href="https://www.gokgs.com/password.jsp"
              target="_blank"
              rel="noopener noreferrer">
              Forgot password
            </a>
          </div>
        </div>
        <div className="LoginScreen-footer">
          <a
            className="LoginScreen-footer-link"
            href="https://www.gokgs.com/"
            target="_blank"
            rel="noopener noreferrer">
            Official KGS
          </a>
        </div>
      </div>
    );
  }

  _onLogin = (event: Event) => {
    event.preventDefault();
    let { username, savePassword, password, captchaToken } = this.state;
    if (!isDirectApi && !captchaToken) {
      this.setState({
        captchaError: "Please complete the CAPTCHA verification.",
      });
      return;
    }
    if (username && password) {
      this.props.actions.onLogin(
        username,
        password,
        isDirectApi ? null : captchaToken
      );
      let savedLogin: SavedLogin = {
        username,
        savePassword,
        password: savePassword ? password : null,
      };
      set("savedLogin", savedLogin);
    }
  };

  _onLogoLoad = () => {
    this.setState({ logoLoaded: true });
  };

  _onChangeUsername = (e: Object) => {
    this.setState({ username: e.target.value });
  };

  _onChangePassword = (e: Object) => {
    this.setState({ password: e.target.value });
  };

  _onChangeSavePassword = (e: Object) => {
    this.setState({ savePassword: e.target.checked });
  };
}
