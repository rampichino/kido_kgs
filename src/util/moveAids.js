// @flow
// Mobile "Move aids" preference — controls how tapping the board plays a move on
// phones. Desktop is unaffected.
//   - "deactivate": play immediately on tap (same as desktop).
//   - "confirm":    tap previews the move; a tick/X popup confirms or cancels.
//   - "zoom":       on 19x19, first tap zooms in, second tap near it plays.
export type MoveAid = "deactivate" | "confirm" | "zoom";

const KEY = "kido_move_aids";

export function getMoveAids(): MoveAid {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "deactivate" || v === "confirm" || v === "zoom") {
      return v;
    }
  } catch (e) {
    // ignore
  }
  return "confirm";
}

export function setMoveAids(value: MoveAid) {
  try {
    localStorage.setItem(KEY, value);
  } catch (e) {
    // ignore
  }
}
