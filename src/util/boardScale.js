// @flow
// Desktop-only "Board size" preference. Scales the fitted board down from its
// default 100% (full available area) to a minimum, so players can shrink a
// board that feels too large on big monitors. Mobile is unaffected — phones
// always fill the screen width.
const KEY = "kido_board_scale";
// Zen mode keeps its own size + position so it never affects the normal-mode
// board size (and vice versa).
const ZEN_KEY = "kido_zen_board_scale";
const ZEN_PAN_KEY = "kido_zen_board_pan";

export const BOARD_SCALE_MIN = 60;
export const BOARD_SCALE_MAX = 150;
export const BOARD_SCALE_DEFAULT = 100;

// Fired whenever the (normal-mode) scale changes so an open board / the
// Preferences slider can re-measure live.
export const BOARD_SCALE_EVENT = "board-scale-change";

function clampScale(value: number): number {
  let v = Math.round(value);
  if (v < BOARD_SCALE_MIN) {
    return BOARD_SCALE_MIN;
  }
  if (v > BOARD_SCALE_MAX) {
    return BOARD_SCALE_MAX;
  }
  return v;
}

function readScale(key: string): number {
  try {
    const v = parseInt(localStorage.getItem(key), 10);
    if (!isNaN(v) && v >= BOARD_SCALE_MIN && v <= BOARD_SCALE_MAX) {
      return v;
    }
  } catch (e) {
    // ignore
  }
  return BOARD_SCALE_DEFAULT;
}

export function getBoardScale(): number {
  return readScale(KEY);
}

export function setBoardScale(value: number) {
  let v = clampScale(value);
  try {
    localStorage.setItem(KEY, String(v));
  } catch (e) {
    // ignore
  }
  try {
    window.dispatchEvent(new Event(BOARD_SCALE_EVENT));
  } catch (e) {
    // ignore
  }
}

// ── Zen-mode size + position (persisted independently of normal mode) ────────
export function getZenBoardScale(): number {
  return readScale(ZEN_KEY);
}

export function setZenBoardScale(value: number) {
  try {
    localStorage.setItem(ZEN_KEY, String(clampScale(value)));
  } catch (e) {
    // ignore
  }
}

export function getZenPan(): { x: number, y: number } {
  try {
    const raw = localStorage.getItem(ZEN_PAN_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.x === "number" && typeof p.y === "number") {
        return { x: p.x, y: p.y };
      }
    }
  } catch (e) {
    // ignore
  }
  return { x: 0, y: 0 };
}

export function setZenPan(pan: { x: number, y: number }) {
  try {
    localStorage.setItem(
      ZEN_PAN_KEY,
      JSON.stringify({ x: Math.round(pan.x), y: Math.round(pan.y) })
    );
  } catch (e) {
    // ignore
  }
}
