import * as React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
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
  const root = createRoot(div);
  act(() => {
    root.render(<App />);
  });
  act(() => {
    root.unmount();
  });
});
