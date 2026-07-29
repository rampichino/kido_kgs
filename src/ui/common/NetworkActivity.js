// @flow
import React, { PureComponent as Component } from "react";
import { Icon } from "./Icon";
import { A } from "./A";
import type { KgsClient, AppActions } from "../../model";

const SAMPLE_MS = 1000; // one bar per second
const SLOTS = 30; // bars kept in the scrolling window

type Sample = { in: number, out: number };

type Props = {
  client: KgsClient,
  actions: AppActions,
  serverStats: ?Object,
};

type State = {
  samples: Array<Sample>,
  showStats: boolean,
};

function makeEmptySamples(): Array<Sample> {
  let arr = [];
  for (let i = 0; i < SLOTS; i++) {
    arr.push({ in: 0, out: 0 });
  }
  return arr;
}

// The chart draws in a fixed 100x100 viewBox; CSS scales it to the widget size.
const VIEW_W = 100;
const VIEW_H = 100;

// Build the {x,y} points for the activity line. Combined in+out per sample,
// normalized to the recent peak, with a small floor so the line sits off the
// baseline. y is flipped (SVG y grows downward).
function linePoints(
  samples: Array<Sample>,
  peak: number
): Array<{ x: number, y: number }> {
  let n = samples.length;
  return samples.map((s, i) => {
    let v = s.in + s.out;
    let frac = peak > 0 ? v / peak : 0;
    let x = n > 1 ? (i / (n - 1)) * VIEW_W : 0;
    // Leave 8% headroom top and bottom so peaks/baseline aren't clipped.
    let y = VIEW_H - (8 + frac * (VIEW_H - 16));
    return { x, y };
  });
}

// A smooth path through the points using mid-point quadratic curves, plus the
// matching closed area path (down to the baseline) for the gradient fill.
function buildPaths(pts: Array<{ x: number, y: number }>): {
  line: string,
  area: string,
} {
  if (pts.length === 0) {
    return { line: "", area: "" };
  }
  let d = "M " + pts[0].x + " " + pts[0].y;
  for (let i = 1; i < pts.length; i++) {
    let prev = pts[i - 1];
    let cur = pts[i];
    let mx = (prev.x + cur.x) / 2;
    let my = (prev.y + cur.y) / 2;
    d += " Q " + prev.x + " " + prev.y + " " + mx + " " + my;
  }
  let last = pts[pts.length - 1];
  d += " L " + last.x + " " + last.y;
  let area =
    d + " L " + last.x + " " + VIEW_H + " L " + pts[0].x + " " + VIEW_H + " Z";
  return { line: d, area };
}

function formatUptime(startTime: ?(string | number)): ?string {
  if (!startTime) {
    return null;
  }
  let start = new Date(startTime).getTime();
  if (isNaN(start)) {
    return null;
  }
  let ms = Date.now() - start;
  if (ms < 0) {
    return null;
  }
  let mins = Math.floor(ms / 60000);
  let days = Math.floor(mins / (60 * 24));
  let hours = Math.floor((mins % (60 * 24)) / 60);
  if (days > 0) {
    return days + "d " + hours + "h";
  }
  let m = mins % 60;
  return hours + "h " + m + "m";
}

function num(v: ?number): string {
  return typeof v === "number" ? v.toLocaleString() : "—";
}

// A small, passive network-activity graph. It samples the client's traffic
// counters once a second and scrolls a fixed window of IN/OUT bars. It issues
// no network requests of its own and re-renders at most once per sample tick.
// Clicking it toggles a panel showing live KGS server statistics.
export default class NetworkActivity extends Component<Props, State> {
  _timer: ?IntervalID = null;

  state = {
    samples: makeEmptySamples(),
    showStats: false,
  };

  componentDidMount() {
    document.addEventListener("visibilitychange", this._onVisibility);
    document.addEventListener("click", this._onDocumentClick);
    this._start();
  }

  componentWillUnmount() {
    document.removeEventListener("visibilitychange", this._onVisibility);
    document.removeEventListener("click", this._onDocumentClick);
    this._stop();
  }

  _onDocumentClick = (e: Object) => {
    // Close the stats panel when clicking outside the widget.
    if (!this.state.showStats) {
      return;
    }
    let el = e.target;
    while (el) {
      if (el.classList && el.classList.contains("NetworkActivity")) {
        return;
      }
      el = el.parentNode;
    }
    this.setState({ showStats: false });
  };

  _onVisibility = () => {
    // No point sampling while the tab is hidden — pause to stay light.
    if (document.hidden) {
      this._stop();
    } else if (!this._timer) {
      this._start();
    }
  };

  _start = () => {
    if (this._timer) {
      return;
    }
    // Reset counters so the first sample isn't a backlog spike.
    this.props.client.netInCount = 0;
    this.props.client.netOutCount = 0;
    this._timer = setInterval(this._sample, SAMPLE_MS);
  };

  _stop = () => {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  };

  _sample = () => {
    let client = this.props.client;
    let next: Sample = { in: client.netInCount, out: client.netOutCount };
    client.netInCount = 0;
    client.netOutCount = 0;
    this.setState((prev) => ({
      samples: prev.samples.slice(1).concat(next),
    }));
  };

  _onToggleStats = () => {
    let next = !this.state.showStats;
    this.setState({ showStats: next });
    if (next) {
      // Re-request on open so the numbers are current.
      this.props.actions.onRequestServerStats();
    }
  };

  _onClose = () => {
    this.setState({ showStats: false });
  };

  render() {
    let { samples, showStats } = this.state;
    let { serverStats } = this.props;
    let peak = 1;
    for (let s of samples) {
      let total = s.in + s.out;
      if (total > peak) {
        peak = total;
      }
    }
    let { line, area } = buildPaths(linePoints(samples, peak));
    return (
      <div
        className={
          "NetworkActivity" + (showStats ? " NetworkActivity-open" : "")
        }>
        {showStats ? (
          <div className="NetworkActivity-panel">
            <div className="NetworkActivity-panel-header">
              <a
                className="NetworkActivity-panel-title"
                href="https://www.gokgs.com/"
                target="_blank"
                rel="noopener noreferrer">
                <Icon name="globe" size={13} /> KGS Server
              </a>
              <A
                className="NetworkActivity-panel-close"
                onClick={this._onClose}>
                <Icon name="circle-x" size={15} />
              </A>
            </div>
            {serverStats ? (
              <div className="NetworkActivity-stats">
                <StatRow label="Users online" value={num(serverStats.logins)} />
                <StatRow label="Accounts" value={num(serverStats.accounts)} />
                <StatRow label="Active Games" value={num(serverStats.games)} />
                <StatRow
                  label="Uptime"
                  value={formatUptime(serverStats.serverStartTime) || "—"}
                />
                <StatRow
                  label="Version"
                  value={
                    serverStats.versionMajor +
                    "." +
                    serverStats.versionMinor +
                    "." +
                    serverStats.versionBugfix
                  }
                />
              </div>
            ) : (
              <div className="NetworkActivity-stats-empty">
                Server stats unavailable.
              </div>
            )}
          </div>
        ) : null}
        <A className="NetworkActivity-trigger" onClick={this._onToggleStats}>
          <div className="NetworkActivity-graph">
            <svg
              className="NetworkActivity-chart"
              viewBox={"0 0 " + VIEW_W + " " + VIEW_H}
              preserveAspectRatio="none">
              <defs>
                <linearGradient
                  id="netActivityFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path
                className="NetworkActivity-chart-area"
                d={area}
                fill="url(#netActivityFill)"
              />
              <path
                className="NetworkActivity-chart-line"
                d={line}
                fill="none"
              />
            </svg>
          </div>
          <div className="NetworkActivity-legend">KGS</div>
        </A>
      </div>
    );
  }
}

function StatRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="NetworkActivity-stat">
      <span className="NetworkActivity-stat-label">{label}</span>
      <span className="NetworkActivity-stat-value">{value}</span>
    </div>
  );
}
