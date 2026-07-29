// @flow
import type { KgsClientState, KgsMessage } from "./types";
import { isJsError } from "../util/error";
import { escapeUnicode } from "../util/string";

export class ApiError extends Error {
  type: string;
  xhr: XMLHttpRequest;
  constructor(message: string, type: string, xhr: XMLHttpRequest) {
    super(message);
    this.type = type;
    this.xhr = xhr;
  }
}

const initialClientState = {
  status: "loggedOut",
  network: "online",
  retryTimes: 0,
};

// KGS answers the long-poll well within this even with no messages queued;
// only a half-open socket (device sleep, network switch) ever hits it. Without
// a timeout such a socket hangs the poll loop forever with no error event —
// the app looks alive but silently stops receiving.
const POLL_TIMEOUT_MS = 150 * 1000;
const SEND_TIMEOUT_MS = 30 * 1000;
const POLL_RETRY_MS = 3000;
const POLL_RETRY_MAX_MS = 30 * 1000;

type SendMessageOptions = {
  sync?: boolean,
};

type StateChangeListener = (
  nextState: KgsClientState,
  prevState: KgsClientState
) => any;

export class KgsClient {
  state: KgsClientState;

  _onChange: ?StateChangeListener = null;
  _onMessages: ?(messages: Array<KgsMessage>) => any;

  _debug: boolean = process.env.NODE_ENV === "development";
  _apiUrl: string;

  // Lightweight traffic counters for the network-activity widget. Bumped on each
  // outgoing command / incoming message batch; the widget samples + resets them
  // on its own timer, so this adds no per-message React work or network calls.
  netOutCount: number = 0;
  netInCount: number = 0;

  _pollInFlight: boolean = false;
  _pollRetryTimer: ?TimeoutID = null;

  constructor(state?: KgsClientState = initialClientState) {
    this.state = state;

    const isExtension = !!(
      window.chrome &&
      window.chrome.runtime &&
      window.chrome.runtime.id
    );
    // Capacitor native (Android/iOS) app: like the extension, it runs serverless
    // and talks straight to the KGS servlet. The WebView is configured to host
    // the local assets under the www.gokgs.com origin (see capacitor.config.json),
    // so this request is same-origin and carries the Origin/Referer KGS expects.
    // NB: @capacitor/core defines window.Capacitor on the web too, so a bare
    // presence check would wrongly treat the dev server / browser build as
    // native and skip the CORS proxy. Gate on isNativePlatform() instead.
    const cap = typeof window !== "undefined" ? (window: any).Capacitor : null;
    const isNative =
      !!cap &&
      typeof cap.isNativePlatform === "function" &&
      cap.isNativePlatform();
    const isDirectApi = isExtension || isNative;
    if (isDirectApi) {
      this._apiUrl = "https://www.gokgs.com/json/access";
    } else if (process.env.REACT_APP_API_URL) {
      this._apiUrl = process.env.REACT_APP_API_URL;
    } else {
      let isProd = window.location.host.indexOf("gokgs.com") !== -1;
      let isSafari =
        window.navigator.vendor &&
        window.navigator.vendor.indexOf("Apple") > -1;
      if (isProd) {
        this._apiUrl = "https://www.gokgs.com/json-cors/access";
      } else if (!isSafari) {
        this._apiUrl = "/api/json-cors/access";
      } else {
        // Dev proxy for Safari
        this._apiUrl = "/json/access";
      }
    }
    console.log("[KGS Client] Using endpoint " + this._apiUrl);
  }

  setState = (nextState: KgsClientState) => {
    let isSameState =
      nextState.status === this.state.status &&
      nextState.network === this.state.network &&
      nextState.retryTimes === this.state.retryTimes;
    if (isSameState) {
      return;
    }
    let prevState = this.state;
    this.state = nextState;
    if (this._debug) {
      console.log("[KGS Client] State changed", {
        state: this.state,
        prevState,
      });
    }
    if (this._onChange) {
      this._onChange(nextState, prevState);
    }
  };

  setOnChange = (listener: ?StateChangeListener) => {
    this._onChange = listener;
  };

  setOnMessages = (listener: ?(messages: Array<KgsMessage>) => any) => {
    this._onMessages = listener;
  };

  login = async (
    username: string,
    password: string,
    captchaToken: ?string,
    locale: string = "en_US"
  ) => {
    this.setState({ ...this.state, status: "loggingIn" });
    try {
      await this.sendMessage({
        type: "LOGIN",
        name: username,
        password,
        locale,
        captchaToken,
      });
      setTimeout(() => {
        if (this._debug) {
          console.log("[KGS Client] Starting polling");
        }
        this.poll();
      }, 0);
    } catch (err) {
      // Any login errors are available to callers via client state
      console.warn(err);
      // The proxy returns 403 + a JSON {error} body when it rejects a login
      // before it reaches KGS (e.g. CAPTCHA verification failed). Surface that
      // message on the login screen. A 403 with a non-JSON body (proxy or CDN
      // error page) must still reset the status — otherwise the login screen
      // spins on "loggingIn" forever.
      let onMessages = this._onMessages;
      if (
        err &&
        err.xhr &&
        (err.xhr.status === 403 || err.xhr.status === 400)
      ) {
        let text = null;
        try {
          text = JSON.parse(err.xhr.responseText).error;
        } catch (e) {
          text = null;
        }
        this.setState({ ...this.state, status: "loggedOut" });
        if (onMessages) {
          onMessages([
            { type: "LOGIN_FAILED_SERVER", text: text || "Login failed" },
          ]);
        }
      } else if (this.state.status === "loggingIn") {
        // sendMessage resets the status for network/server errors; this is a
        // last-line guard so no error path can strand the "loggingIn" state.
        this.setState({ ...this.state, status: "loggedOut" });
      }
    }
  };

  logout = (opts?: SendMessageOptions = {}) => {
    // Sometimes network failure happens due to device sleeping or swiching
    // tasks. Attempt to go back online to avoid showing show the user a
    // network error on login screen. If we're truly offline, sendMessage
    // will put us back into that state.
    this.setState({
      ...this.state,
      network: "online",
      status: "loggingOut",
    });
    return this.sendMessage({ type: "LOGOUT" }, opts);
  };

  sendMessage = async (msg: KgsMessage, opts: SendMessageOptions = {}) => {
    this.netOutCount++;
    if (this._debug) {
      console.log(
        "[KGS Client] >> " + msg.type,
        msg.type === "LOGIN" ? { ...msg, password: "..." } : msg
      );
    }
    try {
      await this._sendMessage(msg, opts);
      this.setState({ ...this.state, network: "online", retryTimes: 0 });
    } catch (err) {
      if (isJsError(err) || err.name === "InvariantError") {
        // Likely an error in the app, not with network or client
        throw err;
      }

      if (err && err.type === "noClient") {
        let nextState = { ...this.state };
        nextState.status = "loggedOut";
        nextState.network = "online";
        nextState.retryTimes = 0;
        this.setState(nextState);
      } else if (err && err.type === "badRequest") {
        // Do not change state for bad request validation errors
      } else {
        let nextState = { ...this.state };
        nextState.network = "error";
        if (this.state.status === "loggingIn") {
          nextState.status = "loggedOut";
        } else if (this.state.status === "loggingOut") {
          // Log out failed - just pretend it worked
          nextState.status = "loggedOut";
        }
        this.setState(nextState);
      }

      // Propogate anyway, so errors can be handled by appropriate UI
      throw err;
    }
  };

  _schedulePoll = (delay: number) => {
    if (this._pollRetryTimer) {
      clearTimeout(this._pollRetryTimer);
    }
    this._pollRetryTimer = setTimeout(() => {
      this._pollRetryTimer = null;
      this.poll();
    }, delay);
  };

  // Restart the poll loop if it died or is sitting out a retry delay. Called
  // when the tab becomes visible or the browser reports the network is back —
  // the situations where a slept machine may have left the loop stalled. An
  // in-flight poll is deliberately left alone: aborting it could discard a
  // response the server already sent (those messages would be lost for good);
  // a genuinely dead socket is reaped by the XHR timeout instead.
  ensurePolling = () => {
    if (this.state.status !== "loggedIn" || this._pollInFlight) {
      return;
    }
    if (this._pollRetryTimer) {
      clearTimeout(this._pollRetryTimer);
      this._pollRetryTimer = null;
    }
    this.poll();
  };

  poll = async () => {
    if (this._pollInFlight) {
      return;
    }
    this._pollInFlight = true;
    let messages;
    try {
      messages = await this._receiveMessages();
      this._pollInFlight = false;
      if (messages && messages.length) {
        this.netInCount += messages.length;
      }
      if (this.state.retryTimes && messages.length) {
        // Reconnected
        if (messages[messages.length - 1].type === "LOGOUT") {
          // We reconnected only to be immediately logged out. Ensure an
          // appropriate error is shown to the user
          messages.push({ type: "SESSION_EXPIRED" });
        }
      }

      let nextState = { ...this.state, network: "online", retryTimes: 0 };
      if (messages.find((msg) => msg.type === "LOGOUT")) {
        nextState.status = "loggedOut";
      } else if (messages.find((msg) => msg.type === "LOGIN_SUCCESS")) {
        nextState.status = "loggedIn";
      }
      this.setState(nextState);

      if (this._debug) {
        console.log("[KGS Client] << ", messages);
      }
      if (this._onMessages) {
        this._onMessages(messages);
      }

      if (nextState.status !== "loggedOut") {
        this._schedulePoll(0);
      } else if (this._debug) {
        console.log("[KGS Client] Stopped polling");
      }
    } catch (err) {
      this._pollInFlight = false;
      if (isJsError(err) || err.name === "InvariantError") {
        // Likely an error in the app, not with network or client
        throw err;
      }

      let nextState = { ...this.state };
      if (err && err.type === "noClient") {
        nextState.status = "loggedOut";
        nextState.network = "online";
        nextState.retryTimes = 0;
      } else {
        let { retryTimes } = this.state;
        // While logged in, never give up — a stopped poll loop leaves the app
        // looking alive but frozen (stale board, stale turn indicator). Only
        // the transitional login/logout states get a bounded retry budget.
        let transitional =
          this.state.status === "loggingIn" ||
          this.state.status === "loggingOut";
        if (
          this.state.status !== "loggedOut" &&
          (!transitional || retryTimes < 10)
        ) {
          nextState.retryTimes = Math.min(retryTimes + 1, 10);
          nextState.network = "error";
          if (this._debug) {
            console.log(
              "[KGS Client] Poll failed - retry",
              nextState.retryTimes
            );
          }
          // Exponential backoff (3s → 6 → 12 → 24 → 30 max): KGS 502-bursts
          // are often rate-limiting; hammering a struggling server at a fixed
          // 3s prolongs them.
          this._schedulePoll(
            Math.min(
              POLL_RETRY_MS * Math.pow(2, nextState.retryTimes - 1),
              POLL_RETRY_MAX_MS
            )
          );
        } else {
          nextState.network = "error";
          nextState.retryTimes = 0;
          if (
            this.state.status === "loggingIn" ||
            this.state.status === "loggingOut"
          ) {
            // Log in/out failed - treat as logged out
            nextState.status = "loggedOut";
          }
        }
      }
      this.setState(nextState);

      console.warn(err);
    }
  };

  _receiveMessages = (): Promise<Array<KgsMessage>> => {
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      let onError = () => {
        let errorType = "networkError";
        if (xhr.status) {
          // 400 and 404 errors indicate the session no longer exists on the KGS server.
          // Other status codes (like 500 Internal Error) are server errors and should not force a logout.
          errorType =
            xhr.status === 400 || xhr.status === 404
              ? "noClient"
              : "serverError";
        }
        let err = new ApiError("Receive failed", errorType, xhr);
        reject(err);
      };
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            let resp;
            try {
              resp = JSON.parse(xhr.responseText);
            } catch (e) {
              // A 200 with a non-JSON body (proxy error page, truncated
              // response) must reject into the retry path — throwing here
              // would leave the promise unsettled and kill the poll loop.
              reject(new ApiError("Receive failed", "serverError", xhr));
              return;
            }
            resolve(resp.messages || []);
          } else {
            onError();
          }
        }
      };
      xhr.addEventListener("error", onError);
      xhr.addEventListener("abort", onError);
      xhr.addEventListener("timeout", onError);
      xhr.open("GET", this._apiUrl, true);
      xhr.timeout = POLL_TIMEOUT_MS;
      xhr.setRequestHeader("Accept", "application/json;charset=UTF-8");
      xhr.withCredentials = true;
      xhr.send();
    });
  };

  _sendMessage = (
    msg: KgsMessage,
    opts: SendMessageOptions = {}
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      let onError = () => {
        let errorType = "networkError";
        if (xhr.status) {
          // 400 on a POST request is usually a validation/bad request error, not a missing session.
          // If the session actually expired, the poll request (_receiveMessages) will detect it.
          errorType =
            xhr.status === 404
              ? "noClient"
              : xhr.status === 400 || xhr.status === 403
                ? "badRequest"
                : "serverError";
        }
        let err = new ApiError("Send failed", errorType, xhr);
        reject(err);
      };
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            resolve();
          } else {
            onError();
          }
        }
      };
      xhr.addEventListener("error", onError);
      xhr.addEventListener("abort", onError);
      xhr.addEventListener("timeout", onError);
      let isAsync = !opts.sync;
      xhr.open("POST", this._apiUrl, isAsync);
      if (isAsync) {
        // timeout is only legal on async requests
        xhr.timeout = SEND_TIMEOUT_MS;
      }
      xhr.withCredentials = true;
      xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
      xhr.send(escapeUnicode(JSON.stringify(msg)));
    });
  };
}
