import * as React from "react";
import ReactDOM from "react-dom";
import App from "./App";

// Mock indexedDB for jsdom environment
global.indexedDB = {
  open: () => {
    return {
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  },
};

it("renders without crashing", () => {
  const div = document.createElement("div");
  ReactDOM.render(<App />, div);
});
