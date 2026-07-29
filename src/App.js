// @flow
import React, { Component } from "react";
import { createBrowserHistory } from "history";
import { App as CapacitorApp } from "@capacitor/app";
import LoginScreen from "./ui/LoginScreen";
import CookieConsent from "./ui/meta/CookieConsent";
import AboutModal from "./ui/meta/AboutModal";
import NetworkActivity from "./ui/common/NetworkActivity";
import {
  getInitialState,
  handleMessage,
  isValidNav,
  AppStore,
  KgsClient,
  AppActions,
} from "./model";
import type { KgsClientState, NavOption, AppState } from "./model";

type Props = {};

type State = {
  appState: AppState,
};

class App extends Component<Props, State> {
  static defaultProps: any;
  _store: AppStore;
  _client: KgsClient;
  _actions: AppActions;

  _history: Object;
  _unlistenHistory: ?Function;
  _backButtonHandle: ?Object;

  _mainComponent: any;

  constructor(props: any, context: any) {
    super(props, context);

    this._history = createBrowserHistory();

    this._client = new KgsClient();
    this._store = new AppStore(
      handleMessage,
      getInitialState(this._client.state)
    );
    this._actions = new AppActions(this._store, this._client, this._history);

    this.state = { appState: this._store.getState() };

    if (process.env.NODE_ENV === "development") {
      window.App = this;
      window.store = this._store;
      window.kgs = this._client;
      window.actions = this._actions;
    }
  }

  _onUnload = () => {
    this._actions.onSaveAppState();
  };

  _onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      this._actions.onSaveAppState();
    } else {
      // Coming back to the tab: if a sleep/network switch silently killed the
      // poll loop, restart it so the game state catches up immediately. The
      // probe additionally discovers a dead session within seconds — a hung
      // in-flight poll is left alone and can take up to 150s to time out.
      this._client.ensurePolling();
      this._actions.onProbeSession();
    }
  };

  _onOnline = () => {
    this._client.ensurePolling();
    this._actions.onProbeSession();
  };

  _onStoreChange = () => {
    let nextState = this._store.getState();
    if (!this.state.appState.initialized && nextState.initialized) {
      // Just loaded - sync URL with state if necessary
      this._syncNav();
    }
    this.setState({ appState: nextState });
  };

  _onClientChange = (
    clientState: KgsClientState,
    prevState: KgsClientState
  ) => {
    this._store.dispatch({ type: "CLIENT_STATE_CHANGE", clientState });
    // A live session ended without the user asking for it (typically KGS
    // reaping it while the app was backgrounded) — try to restore it silently.
    if (prevState.status === "loggedIn" && clientState.status === "loggedOut") {
      this._actions.onSessionLost();
    }
  };

  _onHistoryChange = (update: Object) => {
    let { location, action } = update;
    let path: NavOption = location.pathname.substring(1);
    if (action === "POP") {
      this._actions.onChangeNav(path, { push: false });
    }
  };

  componentDidMount() {
    this._store.subscribe(this._onStoreChange);
    this._client.setOnChange(this._onClientChange);
    this._client.setOnMessages(this._actions.onReceiveServerMessages);
    this._actions.onRestoreAppState();
    this._unlistenHistory = this._history.listen(this._onHistoryChange);
    window.addEventListener("beforeunload", this._onUnload);
    window.addEventListener("online", this._onOnline);
    document.addEventListener("visibilitychange", this._onVisibilityChange);

    // Android hardware / gesture back button → in-app back navigation (only
    // fires on the native app; the web listener is a no-op).
    let cap = (window: any).Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
      this._backButtonHandle = CapacitorApp.addListener(
        "backButton",
        this._onHardwareBack
      );
    }

    this._loadMainComponent();
  }

  componentWillUnmount() {
    this._store.unsubscribe();
    this._client.setOnChange(null);
    this._client.setOnMessages(null);
    if (this._unlistenHistory) {
      this._unlistenHistory();
    }
    window.removeEventListener("beforeunload", this._onUnload);
    window.removeEventListener("online", this._onOnline);
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    if (this._backButtonHandle) {
      this._backButtonHandle.then((h) => h.remove());
      this._backButtonHandle = null;
    }
  }

  // The Android back button steps back through the app and never quits it:
  // close an open modal → leave a game being viewed → return to the Play (home)
  // tab → then do nothing. Quitting mid-game (or mid-session) by reflex loses
  // the KGS connection; the user can still leave via the system gestures.
  _onHardwareBack = () => {
    let closes = document.querySelectorAll(
      ".Modal-close, .ScreenModal-close, .UserDetailsModal-close"
    );
    if (closes.length) {
      // Close the top-most modal (last one rendered into the portal).
      let top: any = closes[closes.length - 1];
      top.click();
      return;
    }
    let state = this._store.getState();
    if (state.playGameId) {
      this._actions.onRequestLeaveGame(state.playGameId);
      return;
    }
    let watched = state.watchGameId ? state.gamesById[state.watchGameId] : null;
    if (watched && !watched.over) {
      this._actions.onRequestLeaveGame(watched);
      return;
    }
    if (state.nav && state.nav !== "play") {
      this._actions.onChangeNav("play");
    }
    // Already home: swallow the press rather than exiting.
  };

  _syncNav = () => {
    let state = this._store.getState();
    let currentUser = state.currentUser;
    if (!currentUser) {
      this._history.replace("/");
    } else {
      let rawPath: string = this._history.location.pathname.slice(1);
      let path: NavOption = (rawPath: any);
      if (!isValidNav(path)) {
        this._history.replace("/" + state.nav);
      } else if (path !== state.nav) {
        this._actions.onChangeNav(path, { push: false });
      }
    }
  };

  _loadMainComponent = () => {
    import("./App").then(() => {
      this._mainComponent = require("./ui/Main").default;
      this.forceUpdate();
    });
  };

  render() {
    let { appState } = this.state;

    if (!appState.initialized) {
      return <div />;
    }

    let inner;
    if (!appState.currentUser && appState.reconnecting) {
      // Session dropped on its own and we're logging back in — don't flash the
      // login form, which looks like the app threw the user out.
      inner = (
        <div className="App-reconnecting">
          <div className="BoardLoading">
            <div className="BoardLoading-dot" />
            <div className="BoardLoading-dot" />
            <div className="BoardLoading-dot" />
          </div>
          <div className="App-reconnecting-text">Reconnecting…</div>
        </div>
      );
    } else if (!appState.currentUser) {
      inner = <LoginScreen {...appState} actions={this._actions} />;
    } else {
      let Main = this._mainComponent;
      inner = Main ? (
        <Main appState={appState} actions={this._actions} />
      ) : (
        <div />
      );
    }

    return (
      <div className="App-container">
        {inner}
        {appState.currentUser ? (
          <NetworkActivity
            client={this._client}
            actions={this._actions}
            serverStats={appState.serverStats}
          />
        ) : null}
        {!appState.cookieConsentStatus ? (
          <CookieConsent actions={this._actions} />
        ) : null}
        {appState.showAboutModal ? (
          <AboutModal
            aboutModalTab={appState.aboutModalTab}
            actions={this._actions}
          />
        ) : null}
      </div>
    );
  }
}

export default App;
