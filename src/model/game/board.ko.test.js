import { validateMove } from "./board";

// Mimics createBoardState(): rows are sparse arrays, so never-occupied points
// read back as `undefined` (not `null`).
function emptyBoard(size) {
  let b = [];
  for (let i = 0; i < size; i++) {
    b.push([]);
  }
  return b;
}

test("ko recapture is illegal even when the parent ko point is undefined", () => {
  // Current position: a lone white stone at (x1,y0) that black can capture by
  // playing (x0,y0). (x2,y0) and (x1,y1) are black.
  let board = emptyBoard(3);
  board[0][1] = "white";
  board[0][2] = "black";
  board[1][1] = "black";

  // Parent (two plies ago) is identical to the post-recapture position, except
  // the ko point (x1,y0) was never occupied there -> `undefined`, whereas the
  // simulated recapture sets it to `null`.
  let parent = emptyBoard(3);
  parent[0][0] = "black";
  parent[0][2] = "black";
  parent[1][1] = "black";

  let err = validateMove(board, parent, { x: 0, y: 0 }, "black", "japanese");
  expect(err).toBe("Ko recapture is illegal");
});

test("a capture that does not recreate the parent position is legal", () => {
  let board = emptyBoard(3);
  board[0][1] = "white";
  board[0][2] = "black";
  board[1][1] = "black";

  // Parent differs from the post-capture position (extra black stone), so this
  // is an ordinary capture, not a ko.
  let parent = emptyBoard(3);
  parent[0][0] = "black";
  parent[0][2] = "black";
  parent[1][1] = "black";
  parent[2][2] = "black";

  let err = validateMove(board, parent, { x: 0, y: 0 }, "black", "japanese");
  expect(err).toBe(null);
});

test("suicide is still rejected", () => {
  // White surrounds (0,0); black playing there has no liberties and captures
  // nothing.
  let board = emptyBoard(3);
  board[0][1] = "white";
  board[1][0] = "white";

  let err = validateMove(board, null, { x: 0, y: 0 }, "black", "japanese");
  expect(err).toBe("Suicide is illegal");
});
