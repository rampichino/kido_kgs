import * as React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import {
  applyUiColor,
  getUiColor,
  applyBoardColor,
  getCustomBoardColor,
  getCustomBoardBlend,
  getCustomBoardLines,
  applyStoneColor,
  getCustomStoneBlackBase,
  getCustomStoneWhiteBase,
  getCustomStoneBlackBorder,
  getCustomStoneWhiteBorder,
  getCustomStoneBlackShadow,
  getCustomStoneWhiteShadow,
  getCustomStoneBlackHighlight,
  getCustomStoneWhiteHighlight,
} from "./ui/meta/MoreMenu";
import { isTouchDevice } from "./util/dom";
import { getTheme, applyTheme } from "./util/theme";
import "flag-icons/css/flag-icons.min.css";
import "./css/index.scss";

try {
  applyTheme(getTheme());
} catch (e) {}

applyUiColor(getUiColor());
applyBoardColor(
  getCustomBoardColor(),
  getCustomBoardBlend(),
  getCustomBoardLines()
);
applyStoneColor(
  getCustomStoneBlackBase(),
  getCustomStoneWhiteBase(),
  getCustomStoneBlackBorder(),
  getCustomStoneWhiteBorder(),
  getCustomStoneBlackShadow(),
  getCustomStoneWhiteShadow(),
  getCustomStoneBlackHighlight(),
  getCustomStoneWhiteHighlight()
);

window.addEventListener("unhandledrejection", (event) => {
  if (
    event.reason &&
    (event.reason.message === "Send failed" ||
      event.reason.message === "Receive failed")
  ) {
    event.preventDefault();
    console.warn("Unhandled KGS client error:", event.reason);
  }
});

if (document.body) {
  // Hack to get Mobile Safari to show :active styling on tap
  document.body.ontouchstart = () => {};

  // Lets us style hovers only for non-touch
  document.body.classList.add(isTouchDevice() ? "touch" : "no-touch");
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
