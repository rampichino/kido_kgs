// @flow
import React, { PureComponent as Component } from "react";
import { A, Icon, Modal } from "../common";
import { AppActions } from "../../model";
import { getTheme, applyTheme } from "../../util/theme";
import type { Theme } from "../../util/theme";
import { KIDO_VERSION, resolveNativeVersion } from "../../version";
import type { User } from "../../model";

const BG_KEY = "kido_custom_bg_url";
const BG_SIZE_KEY = "kido_custom_bg_size";
// Per-theme UI accent presets. Each theme defines 4 presets plus 1 custom; the
// FIRST entry is that theme's default (loaded the first time on that theme).
// The chosen preset is persisted per theme under `kido_ui_color_<theme>`.
const rgbOf = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
};
const preset = (id, label, color) => ({ id, label, color, rgb: rgbOf(color) });

const THEME_UI_COLORS = {
  light: [
    preset("navy", "Navy Blue", "#0a2342"),
    preset("amber", "Amber", "#b45309"),
    preset("teal", "Teal", "#0f766e"),
    preset("stone", "Stone", "#7f6859"),
  ],
  mid: [
    preset("olive", "Olive", "#46483a"),
    preset("navy", "Navy Blue", "#0a2342"),
    preset("deepteal", "Deep Teal", "#2f6b66"),
    preset("rust", "Rust", "#9c4a2f"),
  ],
  dark: [
    preset("whitesmoke", "White Smoke", "#f6f5f2"),
    preset("gold", "Gold", "#fbbf24"),
    preset("teal", "Teal", "#2dd4bf"),
    preset("lime", "Lime", "#a3e635"),
  ],
};

// Persisted accent choice is keyed per theme.
const uiColorKey = (theme) => "kido_ui_color_" + theme;

const CUSTOM_COLOR_KEY = "kido_ui_custom_color";

function hexToRgb(hex: string): ?{ r: number, g: number, b: number } {
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return "#ffffff";
  }
  const brightness = Math.round(
    (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
  );
  return brightness > 125 ? "#1e1e1e" : "#ffffff";
}

function adjustColorBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  let { r, g, b } = rgb;
  const offset = Math.round((percent / 100) * 255);
  r = Math.min(255, Math.max(0, r + offset));
  g = Math.min(255, Math.max(0, g + offset));
  b = Math.min(255, Math.max(0, b + offset));
  const toHex = (c: number) => {
    const s = c.toString(16);
    return s.length === 1 ? "0" + s : s;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function extractHexColor(str: string, fallback: string): string {
  const matches = str.match(/#[0-9a-fA-F]{6}\b/g);
  if (matches && matches.length > 0) {
    if (matches.length >= 2) {
      return matches[1];
    }
    return matches[0];
  }
  return fallback;
}

export function getCustomColor(): string {
  try {
    return localStorage.getItem(CUSTOM_COLOR_KEY) || "#7a9e8e";
  } catch (e) {
    return "#7a9e8e";
  }
}

export function setCustomColor(color: string) {
  try {
    localStorage.setItem(CUSTOM_COLOR_KEY, color);
  } catch (e) {}
}

const BOARD_CUSTOM_COLOR_KEY = "kido_board_custom_color";
const BOARD_CUSTOM_BLEND_KEY = "kido_board_custom_blend";
const BOARD_CUSTOM_LINES_KEY = "kido_board_custom_lines";

export function getCustomBoardColor(): string {
  try {
    return localStorage.getItem(BOARD_CUSTOM_COLOR_KEY) || "#dca862";
  } catch (e) {
    return "#dca862";
  }
}

export function setCustomBoardColor(color: string) {
  try {
    localStorage.setItem(BOARD_CUSTOM_COLOR_KEY, color);
  } catch (e) {}
}

export function getCustomBoardBlend(): string {
  try {
    return localStorage.getItem(BOARD_CUSTOM_BLEND_KEY) || "#b2742d";
  } catch (e) {
    return "#b2742d";
  }
}

export function setCustomBoardBlend(color: string) {
  try {
    localStorage.setItem(BOARD_CUSTOM_BLEND_KEY, color);
  } catch (e) {}
}

export function getCustomBoardLines(): string {
  try {
    return localStorage.getItem(BOARD_CUSTOM_LINES_KEY) || "#281808";
  } catch (e) {
    return "#281808";
  }
}

export function setCustomBoardLines(color: string) {
  try {
    localStorage.setItem(BOARD_CUSTOM_LINES_KEY, color);
  } catch (e) {}
}

export function applyBoardColor(color: string, blend: string, lines: string) {
  const root = document.documentElement;
  if (root) {
    root.style.setProperty("--board-custom-color", color);
    root.style.setProperty("--board-custom-blend", blend);
    root.style.setProperty("--board-custom-lines", lines);
  }
}

const STONE_FLAT_KEY = "kido_stone_custom_flat";

export function getCustomStoneFlat(): boolean {
  try {
    return localStorage.getItem(STONE_FLAT_KEY) === "true";
  } catch (e) {
    return false;
  }
}

export function setCustomStoneFlat(val: boolean) {
  try {
    localStorage.setItem(STONE_FLAT_KEY, val ? "true" : "false");
  } catch (e) {}
}

const STONE_BLACK_BASE_KEY = "kido_stone_custom_black_base";
const STONE_WHITE_BASE_KEY = "kido_stone_custom_white_base";
const STONE_BLACK_BORDER_KEY = "kido_stone_custom_black_border";
const STONE_WHITE_BORDER_KEY = "kido_stone_custom_white_border";
const STONE_BLACK_SHADOW_KEY = "kido_stone_custom_black_shadow";
const STONE_WHITE_SHADOW_KEY = "kido_stone_custom_white_shadow";
const STONE_BLACK_HIGHLIGHT_KEY = "kido_stone_custom_black_highlight";
const STONE_WHITE_HIGHLIGHT_KEY = "kido_stone_custom_white_highlight";

export function getCustomStoneBlackBase(): string {
  try {
    const val = localStorage.getItem(STONE_BLACK_BASE_KEY);
    if (!val) {
      return "radial-gradient(circle at 30% 30%, #404040 0%, #1a1a1a 70%, #000000 100%)";
    }
    if (val.startsWith("#")) {
      const lightColor = adjustColorBrightness(val, 40);
      const darkColor = adjustColorBrightness(val, -60);
      return `radial-gradient(circle at 30% 30%, ${lightColor} 0%, ${val} 70%, ${darkColor} 100%)`;
    }
    return val;
  } catch (e) {
    return "radial-gradient(circle at 30% 30%, #404040 0%, #1a1a1a 70%, #000000 100%)";
  }
}

export function setCustomStoneBlackBase(val: string) {
  try {
    localStorage.setItem(STONE_BLACK_BASE_KEY, val);
  } catch (e) {}
}

export function getCustomStoneWhiteBase(): string {
  try {
    const val = localStorage.getItem(STONE_WHITE_BASE_KEY);
    if (!val) {
      return "radial-gradient(circle at 30% 30%, #ffffff 0%, #e0e0e8 70%, #b4b4bd 100%)";
    }
    if (val.startsWith("#")) {
      const darkColor = adjustColorBrightness(val, -30);
      return `radial-gradient(circle at 30% 30%, #ffffff 0%, ${val} 70%, ${darkColor} 100%)`;
    }
    return val;
  } catch (e) {
    return "radial-gradient(circle at 30% 30%, #ffffff 0%, #e0e0e8 70%, #b4b4bd 100%)";
  }
}

export function setCustomStoneWhiteBase(val: string) {
  try {
    localStorage.setItem(STONE_WHITE_BASE_KEY, val);
  } catch (e) {}
}

export function getCustomStoneBlackBorder(): string {
  try {
    return localStorage.getItem(STONE_BLACK_BORDER_KEY) || "none";
  } catch (e) {
    return "none";
  }
}

export function setCustomStoneBlackBorder(val: string) {
  try {
    localStorage.setItem(STONE_BLACK_BORDER_KEY, val);
  } catch (e) {}
}

export function getCustomStoneWhiteBorder(): string {
  try {
    return localStorage.getItem(STONE_WHITE_BORDER_KEY) || "none";
  } catch (e) {
    return "none";
  }
}

export function setCustomStoneWhiteBorder(val: string) {
  try {
    localStorage.setItem(STONE_WHITE_BORDER_KEY, val);
  } catch (e) {}
}

export function getCustomStoneBlackShadow(): string {
  try {
    return (
      localStorage.getItem(STONE_BLACK_SHADOW_KEY) ||
      "0 2px 6px rgba(0, 0, 0, 0.4)"
    );
  } catch (e) {
    return "0 2px 6px rgba(0, 0, 0, 0.4)";
  }
}

export function setCustomStoneBlackShadow(val: string) {
  try {
    localStorage.setItem(STONE_BLACK_SHADOW_KEY, val);
  } catch (e) {}
}

export function getCustomStoneWhiteShadow(): string {
  try {
    return (
      localStorage.getItem(STONE_WHITE_SHADOW_KEY) ||
      "0 2px 6px rgba(0, 0, 0, 0.3)"
    );
  } catch (e) {
    return "0 2px 6px rgba(0, 0, 0, 0.3)";
  }
}

export function setCustomStoneWhiteShadow(val: string) {
  try {
    localStorage.setItem(STONE_WHITE_SHADOW_KEY, val);
  } catch (e) {}
}

export function getCustomStoneBlackHighlight(): string {
  return "1.0";
}

export function setCustomStoneBlackHighlight(val: string) {
  try {
    localStorage.setItem(STONE_BLACK_HIGHLIGHT_KEY, val);
  } catch (e) {}
}

export function getCustomStoneWhiteHighlight(): string {
  return "1.0";
}

export function setCustomStoneWhiteHighlight(val: string) {
  try {
    localStorage.setItem(STONE_WHITE_HIGHLIGHT_KEY, val);
  } catch (e) {}
}

export function applyStoneColor(
  blackBase: string,
  whiteBase: string,
  blackBorder: string,
  whiteBorder: string,
  blackShadow: string,
  whiteShadow: string,
  blackHighlight: string,
  whiteHighlight: string
) {
  const root = document.documentElement;
  if (root) {
    const isFlat = getCustomStoneFlat();
    let finalBlackBase = blackBase;
    let finalWhiteBase = whiteBase;
    let finalBlackHighlight = blackHighlight;
    let finalWhiteHighlight = whiteHighlight;

    if (isFlat) {
      finalBlackBase = extractHexColor(blackBase, "#1a1a1a");
      finalWhiteBase = extractHexColor(whiteBase, "#ffffff");
      finalBlackHighlight = "0";
      finalWhiteHighlight = "0";
    }

    root.style.setProperty("--stone-custom-black-base", finalBlackBase);
    root.style.setProperty("--stone-custom-white-base", finalWhiteBase);
    root.style.setProperty("--stone-custom-black-border", blackBorder);
    root.style.setProperty("--stone-custom-white-border", whiteBorder);
    root.style.setProperty("--stone-custom-black-shadow", blackShadow);
    root.style.setProperty("--stone-custom-white-shadow", whiteShadow);
    root.style.setProperty(
      "--stone-custom-black-highlight",
      finalBlackHighlight
    );
    root.style.setProperty(
      "--stone-custom-white-highlight",
      finalWhiteHighlight
    );
  }
}

// The presets for the active theme (used by getUiColor / applyUiColor / the
// swatch UI). Each theme has its own 4; the first is the default.
export function getThemeUiColors() {
  return THEME_UI_COLORS[getTheme()] || THEME_UI_COLORS.light;
}

export function getUiColor(): string {
  const presets = getThemeUiColors();
  try {
    return localStorage.getItem(uiColorKey(getTheme())) || presets[0].id;
  } catch (e) {
    return presets[0].id;
  }
}

export function setUiColor(colorId: string) {
  try {
    localStorage.setItem(uiColorKey(getTheme()), colorId);
  } catch (e) {}
}

export function applyUiColor(colorId: string) {
  let color = colorId;
  let rgb = "0, 130, 127"; // fallback
  if (colorId.startsWith("#")) {
    const parsed = hexToRgb(colorId);
    if (parsed) {
      rgb = `${parsed.r}, ${parsed.g}, ${parsed.b}`;
    }
  } else {
    const presets = getThemeUiColors();
    const option = presets.find((c) => c.id === colorId) || presets[0];
    color = option.color;
    rgb = option.rgb;
  }
  const contrastColor = getContrastColor(color);
  const root = document.documentElement;
  if (root) {
    root.style.setProperty("--ui-color", color);
    root.style.setProperty("--ui-color-rgb", rgb);
    root.style.setProperty("--ui-color-contrast", contrastColor);
  }
  const body = document.body;
  if (body) {
    // A very light accent needs dark button text (contrast resolves to dark).
    if (contrastColor === "#1e1e1e") {
      body.classList.add("ui-color-light");
    } else {
      body.classList.remove("ui-color-light");
    }
  }
}

export function getCustomBgUrl(): string {
  try {
    return localStorage.getItem(BG_KEY) || "";
  } catch (e) {
    return "";
  }
}

export function getCustomBgSize(): string {
  try {
    return localStorage.getItem(BG_SIZE_KEY) || "contain";
  } catch (e) {
    return "contain";
  }
}

export function applyCustomBg(url: string, size: string = "contain") {
  if (document.body) {
    if (url) {
      document.body.style.backgroundImage = `url(${url})`;
      document.body.style.backgroundSize = size === "tile" ? "auto" : size;
      document.body.style.backgroundAttachment = "fixed";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundRepeat =
        size === "tile" ? "repeat" : "no-repeat";
      document.body.classList.add("has-custom-bg");
    } else {
      document.body.style.backgroundImage = "";
      document.body.style.backgroundSize = "";
      document.body.style.backgroundAttachment = "";
      document.body.style.backgroundPosition = "";
      document.body.style.backgroundRepeat = "";
      document.body.classList.remove("has-custom-bg");
    }
  }
}

type Props = {
  currentUser: ?User,
  actions: AppActions,
};

type State = {
  theme: Theme,
  boardStyle: string,
  stoneStyle: string,
  showBoard: boolean,
  showBgModal: boolean,
  bgUrlInput: string,
  bgUrlActive: string,
  bgSize: string,
  uiColor: string,
  customColor: string,
  customBoardColor: string,
  customBoardBlend: string,
  customBoardLines: string,
  showCustomBoardModal: boolean,
  customStoneBlackBase: string,
  customStoneWhiteBase: string,
  customStoneBlackBorder: string,
  customStoneWhiteBorder: string,
  customStoneBlackShadow: string,
  customStoneWhiteShadow: string,
  customStoneBlackHighlight: string,
  customStoneWhiteHighlight: string,
  showCustomStoneModal: boolean,
  customStoneFlat: boolean,
  version: ?string,
};

const BLACK_BORDER_PRESETS: Array<{
  id: string,
  label: string,
  value: string,
}> = [
  { id: "none", label: "None", value: "none" },
  { id: "subtle", label: "Subtle", value: "1px solid rgba(0, 0, 0, 0.45)" },
  { id: "hard", label: "Hard", value: "1.5px solid #000000" },
];

const WHITE_BORDER_PRESETS: Array<{
  id: string,
  label: string,
  value: string,
}> = [
  { id: "none", label: "None", value: "none" },
  { id: "subtle", label: "Subtle", value: "1px solid rgba(0, 0, 0, 0.12)" },
  { id: "hard", label: "Hard", value: "1.5px solid rgba(0, 0, 0, 0.6)" },
];

const BLACK_SHADOW_PRESETS: Array<{
  id: string,
  label: string,
  value: string,
}> = [
  { id: "none", label: "None", value: "none" },
  { id: "flat", label: "Flat", value: "0 2px 4px rgba(0, 0, 0, 0.15)" },
  { id: "soft", label: "Soft 3D", value: "0 2px 6px rgba(0, 0, 0, 0.4)" },
  {
    id: "deep",
    label: "Deep 3D",
    value:
      "0 4px 8px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.3), inset 0 -3px 8px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.15)",
  },
];

const WHITE_SHADOW_PRESETS: Array<{
  id: string,
  label: string,
  value: string,
}> = [
  { id: "none", label: "None", value: "none" },
  { id: "flat", label: "Flat", value: "0 2px 4px rgba(0, 0, 0, 0.1)" },
  { id: "soft", label: "Soft 3D", value: "0 2px 6px rgba(0, 0, 0, 0.3)" },
  {
    id: "deep",
    label: "Deep 3D",
    value:
      "0 4px 8px rgba(0, 0, 0, 0.22), 0 1px 3px rgba(0, 0, 0, 0.15), inset 0 -3px 6px rgba(0, 0, 0, 0.12), inset 0 2px 4px rgba(255, 255, 255, 0.6)",
  },
];

const stylesList = [
  {
    id: "goban",
    name: "Goban",
    preview: "linear-gradient(135deg, #ecc788 50%, #1e1e1e 50%)",
  },
  {
    id: "sabaki",
    name: "Sabaki Wood",
    preview: "linear-gradient(135deg, #f1b458 50%, #202022 50%)",
  },
  {
    id: "tatami",
    name: "Woven Tatami",
    preview: "linear-gradient(135deg, #d8d0a8 50%, #b8af80 50%)",
  },

  {
    id: "photorealistic",
    name: "Photorealistic Wood",
    preview: "linear-gradient(135deg, #dca862 50%, #1c1c20 50%)",
  },
  {
    id: "kaya",
    name: "Kaya Wood",
    preview: "linear-gradient(135deg, #EAC598 50%, #2a2a2e 50%)",
  },
  {
    id: "slate",
    name: "Slate Washi",
    preview: "linear-gradient(135deg, #3e4d66 50%, #151d28 50%)",
  },
  {
    id: "autumn",
    name: "Autumn Amber",
    preview: "linear-gradient(135deg, #a04020 50%, #141416 50%)",
  },
  {
    id: "paper",
    name: "Ink Washi",
    preview: "linear-gradient(135deg, #f5eedc 50%, #1c1c1e 50%)",
  },
  {
    id: "golden",
    name: "Shin Kaya",
    preview: "linear-gradient(135deg, #e8af56 50%, #2b2b2b 50%)",
  },
];

const stoneStylesList = [
  {
    id: "goban",
    name: "Goban",
    preview:
      "repeating-radial-gradient(circle at 120% 120%, transparent 0px, transparent 3px, rgba(0, 0, 0, 0.08) 3px, rgba(0, 0, 0, 0.08) 4px), radial-gradient(circle at 30% 30%, #ffffff 0%, #e0e0e8 70%, #b4b4bd 100%)",
  },
  {
    id: "sabaki",
    name: "Sabaki Slate/Shell",
    preview:
      "radial-gradient(circle at 35% 35%, #ffffff 0%, #ecece6 70%, #d8d8d0 100%)",
  },

  {
    id: "agate",
    name: "Carnelian Agate",
    preview:
      "repeating-radial-gradient(circle at 25% 25%, transparent 0px, transparent 5px, rgba(255, 255, 255, 0.3) 5px, rgba(255, 255, 255, 0.3) 7px, transparent 7px, transparent 12px), radial-gradient(circle at 35% 35%, #ffd3b6 0%, #ffb684 35%, #b26027 100%)",
  },
  {
    id: "yunzi",
    name: "Yunzi Jade",
    preview:
      "radial-gradient(circle at 35% 35%, #ffffff 0%, #fbf9f2 40%, #dbd3c2 100%)",
  },
  {
    id: "jade",
    name: "Emerald Jade",
    preview:
      "radial-gradient(circle at 35% 35%, #eefbf2 0%, #daf3e3 40%, #a2d9b4 100%)",
  },
  {
    id: "sakura",
    name: "Sakura Blossom",
    preview:
      "radial-gradient(circle at 35% 35%, #ffffff 0%, #fff0f2 40%, #f4aab9 100%)",
  },
  {
    id: "glassy",
    name: "Glossy Enamel",
    preview:
      "radial-gradient(circle at 30% 30%, #ffffff 0%, #e0e0e8 70%, #b4b4bd 100%)",
  },
  {
    id: "glassy-outlined",
    name: "3D Outlined",
    preview:
      "radial-gradient(circle at 30% 30%, #ffffff 0%, #e0e0e8 70%, #b4b4bd 100%)",
  },

  { id: "matte", name: "Matte Slate/Shell", preview: "#ebdcd0" },
];

const getBoardStyle = () => {
  try {
    return localStorage.getItem("tenuki_board_style") || "goban";
  } catch (e) {
    return "kaya";
  }
};

const getStoneStyle = () => {
  try {
    return localStorage.getItem("tenuki_stone_style") || "goban";
  } catch (e) {
    return "glassy";
  }
};

export default class MoreMenu extends Component<Props, State> {
  state = {
    theme: getTheme(),
    boardStyle: getBoardStyle(),
    stoneStyle: getStoneStyle(),
    showBoard: false,
    showBgModal: false,
    bgUrlInput: getCustomBgUrl(),
    bgUrlActive: getCustomBgUrl(),
    bgSize: getCustomBgSize(),
    uiColor: getUiColor(),
    customColor: getCustomColor(),
    customBoardColor: getCustomBoardColor(),
    customBoardBlend: getCustomBoardBlend(),
    customBoardLines: getCustomBoardLines(),
    showCustomBoardModal: false,
    customStoneBlackBase: getCustomStoneBlackBase(),
    customStoneWhiteBase: getCustomStoneWhiteBase(),
    customStoneBlackBorder: getCustomStoneBlackBorder(),
    customStoneWhiteBorder: getCustomStoneWhiteBorder(),
    customStoneBlackShadow: getCustomStoneBlackShadow(),
    customStoneWhiteShadow: getCustomStoneWhiteShadow(),
    customStoneBlackHighlight: getCustomStoneBlackHighlight(),
    customStoneWhiteHighlight: getCustomStoneWhiteHighlight(),
    showCustomStoneModal: false,
    customStoneFlat: getCustomStoneFlat(),
    version: KIDO_VERSION,
  };

  _unmounted: boolean = false;

  componentDidMount() {
    window.addEventListener("tenuki-style-change", this._onStyleEvent);
    // On the native app the real versionName is only readable asynchronously,
    // so refine the synchronous default once it resolves.
    resolveNativeVersion().then((version) => {
      if (version && !this._unmounted) {
        this.setState({ version });
      }
    });
    applyCustomBg(getCustomBgUrl(), getCustomBgSize());
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
  }

  componentWillUnmount() {
    this._unmounted = true;
    window.removeEventListener("tenuki-style-change", this._onStyleEvent);
  }

  _onStyleEvent = () => {
    this.setState({
      boardStyle: getBoardStyle(),
      stoneStyle: getStoneStyle(),
      customStoneFlat: getCustomStoneFlat(),
    });
  };

  _onBoardStyleChange = (styleId: string) => {
    this.setState({ boardStyle: styleId });
    try {
      localStorage.setItem("tenuki_board_style", styleId);
      window.dispatchEvent(new Event("tenuki-style-change"));
    } catch (e) {}
  };

  _onStoneStyleChange = (styleId: string) => {
    this.setState({ stoneStyle: styleId });
    try {
      localStorage.setItem("tenuki_stone_style", styleId);
      window.dispatchEvent(new Event("tenuki-style-change"));
    } catch (e) {}
  };

  _onToggleBoard = (e: Object) => {
    e.preventDefault();
    this.setState({ showBoard: !this.state.showBoard });
  };

  _onOpenBgModal = (e: Object) => {
    e.preventDefault();
    this.setState({ showBgModal: true, bgUrlInput: this.state.bgUrlActive });
  };

  _onCloseBgModal = () => {
    this.setState({ showBgModal: false });
  };

  _onBgUrlChange = (e: Object) => {
    this.setState({ bgUrlInput: e.target.value });
  };

  _onBgSizeChange = (size: string) => {
    this.setState({ bgSize: size });
  };

  _onApplyBg = () => {
    const url = this.state.bgUrlInput.trim();
    const size = this.state.bgSize;
    try {
      localStorage.setItem(BG_KEY, url);
      localStorage.setItem(BG_SIZE_KEY, size);
    } catch (e) {}
    applyCustomBg(url, size);
    this.setState({ bgUrlActive: url, showBgModal: false });
  };

  _onClearBg = () => {
    try {
      localStorage.removeItem(BG_KEY);
      localStorage.removeItem(BG_SIZE_KEY);
    } catch (e) {}
    applyCustomBg("");
    this.setState({
      bgUrlInput: "",
      bgUrlActive: "",
      bgSize: "contain",
      showBgModal: false,
    });
  };

  _onUiColorChange = (colorId: string) => {
    this.setState({ uiColor: colorId });
    setUiColor(colorId);
    applyUiColor(colorId);
  };

  // The single row of the active theme's 4 accent presets.
  _renderAccentSwatches(selected: string): React$Node {
    return getThemeUiColors().map((opt) =>
      this._accentSwatchColor(opt.id, opt.id, opt.color, opt.label, selected)
    );
  }

  // An accent swatch. `key` is React's key, `value` is what gets stored/applied
  // on click (a preset id OR a hex), `color` is the dot color shown, `selected`
  // is the active accent.
  _accentSwatchColor(
    key: string,
    value: string,
    color: string,
    label: string,
    selected: string
  ): React$Node {
    return (
      <button
        key={key}
        onClick={() => this._onUiColorChange(value)}
        title={label}
        className={
          "MoreMenu-accent-btn" +
          (selected === value ? " MoreMenu-accent-btn-selected" : "")
        }>
        <span className="MoreMenu-accent-dot" style={{ background: color }} />
      </button>
    );
  }

  _colorPickerRef: any = React.createRef();

  _onCustomColorInputClick = () => {
    this._onUiColorChange(this.state.customColor);
  };

  _onCustomColorChange = (e: SyntheticInputEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    this.setState({ customColor: newColor });
    setCustomColor(newColor);
    this._onUiColorChange(newColor);
  };

  _onCustomBoardClick = (e: Object) => {
    e.preventDefault();
    this._onBoardStyleChange("custom");
    this.setState({ showCustomBoardModal: true });
  };

  _onCloseCustomBoardModal = () => {
    this.setState({ showCustomBoardModal: false });
  };

  _onCustomBoardColorChange = (e: SyntheticInputEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    this.setState({ customBoardColor: newColor });
    setCustomBoardColor(newColor);
    applyBoardColor(
      newColor,
      this.state.customBoardBlend,
      this.state.customBoardLines
    );
  };

  _onCustomBoardBlendChange = (e: SyntheticInputEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    this.setState({ customBoardBlend: newColor });
    setCustomBoardBlend(newColor);
    applyBoardColor(
      this.state.customBoardColor,
      newColor,
      this.state.customBoardLines
    );
  };

  _onCustomBoardLinesChange = (e: SyntheticInputEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    this.setState({ customBoardLines: newColor });
    setCustomBoardLines(newColor);
    applyBoardColor(
      this.state.customBoardColor,
      this.state.customBoardBlend,
      newColor
    );
  };

  _onCustomStoneClick = (e: Object) => {
    e.preventDefault();
    this._onStoneStyleChange("custom");
    this.setState({ showCustomStoneModal: true });
  };

  _onCloseCustomStoneModal = () => {
    this.setState({ showCustomStoneModal: false });
  };

  _onCustomStoneBlackColorChange = (
    e: SyntheticInputEvent<HTMLInputElement>
  ) => {
    const baseColor = e.target.value;
    const lightColor = adjustColorBrightness(baseColor, 40);
    const darkColor = adjustColorBrightness(baseColor, -60);
    const val = `radial-gradient(circle at 30% 30%, ${lightColor} 0%, ${baseColor} 70%, ${darkColor} 100%)`;
    this.setState({ customStoneBlackBase: val });
    setCustomStoneBlackBase(val);
    applyStoneColor(
      val,
      this.state.customStoneWhiteBase,
      this.state.customStoneBlackBorder,
      this.state.customStoneWhiteBorder,
      this.state.customStoneBlackShadow,
      this.state.customStoneWhiteShadow,
      this.state.customStoneBlackHighlight,
      this.state.customStoneWhiteHighlight
    );
  };

  _onCustomStoneWhiteColorChange = (
    e: SyntheticInputEvent<HTMLInputElement>
  ) => {
    const baseColor = e.target.value;
    const darkColor = adjustColorBrightness(baseColor, -30);
    const val = `radial-gradient(circle at 30% 30%, #ffffff 0%, ${baseColor} 70%, ${darkColor} 100%)`;
    this.setState({ customStoneWhiteBase: val });
    setCustomStoneWhiteBase(val);
    applyStoneColor(
      this.state.customStoneBlackBase,
      val,
      this.state.customStoneBlackBorder,
      this.state.customStoneWhiteBorder,
      this.state.customStoneBlackShadow,
      this.state.customStoneWhiteShadow,
      this.state.customStoneBlackHighlight,
      this.state.customStoneWhiteHighlight
    );
  };

  _onCustomStoneBlackBorderSelect = (val: string) => {
    this.setState({ customStoneBlackBorder: val });
    setCustomStoneBlackBorder(val);
    applyStoneColor(
      this.state.customStoneBlackBase,
      this.state.customStoneWhiteBase,
      val,
      this.state.customStoneWhiteBorder,
      this.state.customStoneBlackShadow,
      this.state.customStoneWhiteShadow,
      this.state.customStoneBlackHighlight,
      this.state.customStoneWhiteHighlight
    );
  };

  _onCustomStoneWhiteBorderSelect = (val: string) => {
    this.setState({ customStoneWhiteBorder: val });
    setCustomStoneWhiteBorder(val);
    applyStoneColor(
      this.state.customStoneBlackBase,
      this.state.customStoneWhiteBase,
      this.state.customStoneBlackBorder,
      val,
      this.state.customStoneBlackShadow,
      this.state.customStoneWhiteShadow,
      this.state.customStoneBlackHighlight,
      this.state.customStoneWhiteHighlight
    );
  };

  _onCustomStoneBlackShadowSelect = (val: string) => {
    this.setState({ customStoneBlackShadow: val });
    setCustomStoneBlackShadow(val);
    applyStoneColor(
      this.state.customStoneBlackBase,
      this.state.customStoneWhiteBase,
      this.state.customStoneBlackBorder,
      this.state.customStoneWhiteBorder,
      val,
      this.state.customStoneWhiteShadow,
      this.state.customStoneBlackHighlight,
      this.state.customStoneWhiteHighlight
    );
  };

  _onCustomStoneWhiteShadowSelect = (val: string) => {
    this.setState({ customStoneWhiteShadow: val });
    setCustomStoneWhiteShadow(val);
    applyStoneColor(
      this.state.customStoneBlackBase,
      this.state.customStoneWhiteBase,
      this.state.customStoneBlackBorder,
      this.state.customStoneWhiteBorder,
      this.state.customStoneBlackShadow,
      val,
      this.state.customStoneBlackHighlight,
      this.state.customStoneWhiteHighlight
    );
  };

  _onCustomStoneFlatChange = (e: SyntheticInputEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    this.setState({ customStoneFlat: val }, () => {
      setCustomStoneFlat(val);
      applyStoneColor(
        this.state.customStoneBlackBase,
        this.state.customStoneWhiteBase,
        this.state.customStoneBlackBorder,
        this.state.customStoneWhiteBorder,
        this.state.customStoneBlackShadow,
        this.state.customStoneWhiteShadow,
        this.state.customStoneBlackHighlight,
        this.state.customStoneWhiteHighlight
      );
    });
  };

  _onMailboxClick = (e: Object) => {
    e.preventDefault();
    this.props.actions.onShowLeaveMessageModal();
  };

  _onSelectTheme = (theme: Theme) => {
    applyTheme(theme);
    // Each theme has its own accent presets/default — re-apply for the new theme.
    applyUiColor(getUiColor());
    this.setState({ theme, uiColor: getUiColor() });
  };

  _onPreferencesClick = (e: Object) => {
    e.preventDefault();
    this.props.actions.onShowPreferencesModal();
  };

  render() {
    let { actions } = this.props;
    let { showBoard, showBgModal, bgUrlInput, bgUrlActive, bgSize, uiColor } =
      this.state;
    return (
      <div className="MoreMenu">
        <A className="MoreMenu-item" onClick={this._onViewProfile}>
          <Icon name="user" size={16} />
          <span className="MoreMenu-item-text">Profile</span>
        </A>

        <A
          className="MoreMenu-item MoreMenu-item-mygames"
          onClick={this._onMyGamesClick}>
          <Icon name="library" size={16} />
          <span className="MoreMenu-item-text">My Games</span>
        </A>

        <A className="MoreMenu-item" onClick={this._onMailboxClick}>
          <Icon name="mail" size={16} />
          <span className="MoreMenu-item-text">Mailbox</span>
        </A>

        <A className="MoreMenu-item" onClick={this._onPreferencesClick}>
          <Icon name="settings" size={16} />
          <span className="MoreMenu-item-text">Preferences</span>
        </A>

        <A
          className={
            "MoreMenu-item" + (showBoard ? " MoreMenu-item-active" : "")
          }
          onClick={this._onToggleBoard}>
          <Icon name="sliders" size={16} />
          <span className="MoreMenu-item-text">Themes</span>
          <Icon
            name={showBoard ? "chevron-up" : "chevron-down"}
            size={14}
            className="MoreMenu-item-chevron"
          />
        </A>

        {showBoard && (
          <div className="MoreMenu-preferences-panel">
            <div className="MoreMenu-styles-section MoreMenu-theme-section">
              <div className="MoreMenu-section-title">Theme</div>
              <div className="MoreMenu-options-row MoreMenu-theme-row">
                {[
                  { id: "light", label: "Light", icon: "sun-o" },
                  { id: "mid", label: "Mid", icon: "sun-medium" },
                  { id: "dark", label: "Dark", icon: "moon-o" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => this._onSelectTheme((t.id: any))}
                    className={
                      "MoreMenu-theme-btn" +
                      (this.state.theme === t.id
                        ? " MoreMenu-theme-btn-selected"
                        : "")
                    }>
                    <Icon name={t.icon} size={15} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="MoreMenu-styles-section">
              <div className="MoreMenu-section-title">Board</div>
              <div className="MoreMenu-options-row MoreMenu-options-row-board">
                {stylesList.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => this._onBoardStyleChange(style.id)}
                    title={style.name}
                    className={
                      "MoreMenu-option-swatch" +
                      (this.state.boardStyle === style.id
                        ? " MoreMenu-option-swatch-selected"
                        : "")
                    }>
                    <span
                      className="MoreMenu-option-preview"
                      style={{ background: style.preview }}
                    />
                  </button>
                ))}

                <button
                  title="Custom Board (Click to customize)"
                  onClick={this._onCustomBoardClick}
                  className={
                    "MoreMenu-option-swatch MoreMenu-custom-board-btn" +
                    (this.state.boardStyle === "custom"
                      ? " MoreMenu-option-swatch-selected"
                      : "")
                  }>
                  <span
                    className="MoreMenu-option-preview"
                    style={{
                      background: `linear-gradient(135deg, ${this.state.customBoardColor} 50%, ${this.state.customBoardBlend} 50%)`,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                    }}>
                    <Icon
                      name="settings"
                      size={14}
                      color="#ffffff"
                      strokeWidth={1.8}
                      style={{
                        pointerEvents: "none",
                        filter:
                          "drop-shadow(0px 0px 1.5px rgba(0, 0, 0, 0.95)) drop-shadow(0px 1px 1.5px rgba(0, 0, 0, 0.85))",
                      }}
                    />
                  </span>
                </button>
              </div>
            </div>

            <div className="MoreMenu-styles-section">
              <div className="MoreMenu-section-title">Stone</div>
              <div className="MoreMenu-options-row">
                {stoneStylesList.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => this._onStoneStyleChange(style.id)}
                    title={style.name}
                    className={
                      "MoreMenu-option-swatch" +
                      (this.state.stoneStyle === style.id
                        ? " MoreMenu-option-swatch-selected"
                        : "")
                    }>
                    <span
                      className="MoreMenu-option-preview"
                      style={{ background: style.preview }}
                    />
                  </button>
                ))}

                <button
                  title="Custom Stones (Click to customize)"
                  onClick={this._onCustomStoneClick}
                  className={
                    "MoreMenu-option-swatch MoreMenu-custom-stone-btn" +
                    (this.state.stoneStyle === "custom"
                      ? " MoreMenu-option-swatch-selected"
                      : "")
                  }>
                  <span className="MoreMenu-option-preview MoreMenu-option-preview-stone">
                    <Icon
                      name="settings"
                      size={14}
                      color="#ffffff"
                      strokeWidth={1.8}
                      style={{
                        pointerEvents: "none",
                        filter:
                          "drop-shadow(0px 0px 1.5px rgba(0, 0, 0, 0.95)) drop-shadow(0px 1px 1.5px rgba(0, 0, 0, 0.85))",
                      }}
                    />
                  </span>
                </button>
              </div>
            </div>

            <div className="MoreMenu-styles-section">
              <div className="MoreMenu-section-title">UI Color</div>
              <div className="MoreMenu-options-row MoreMenu-options-row-accent">
                {this._renderAccentSwatches(uiColor)}

                <button
                  title="Custom Color (Click to customize)"
                  className={
                    "MoreMenu-accent-btn MoreMenu-custom-color-btn" +
                    (uiColor.startsWith("#")
                      ? " MoreMenu-accent-btn-selected"
                      : "")
                  }>
                  <span
                    className="MoreMenu-accent-dot"
                    style={{
                      background: "transparent",
                      boxShadow: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                    <Icon
                      name="settings"
                      size={18}
                      color={this.state.customColor}
                    />
                  </span>
                  <input
                    type="color"
                    className="MoreMenu-custom-color-input"
                    value={this.state.customColor}
                    onClick={this._onCustomColorInputClick}
                    onChange={this._onCustomColorChange}
                  />
                </button>
              </div>
            </div>

            <div className="MoreMenu-styles-section">
              <div className="MoreMenu-section-title">Background</div>
              <button
                className={
                  "MoreMenu-bg-btn" +
                  (bgUrlActive ? " MoreMenu-bg-btn-active" : "")
                }
                onClick={this._onOpenBgModal}>
                <Icon name="globe" size={14} />
                {bgUrlActive ? "Custom image set" : "Set image URL…"}
                {bgUrlActive && <span className="MoreMenu-bg-btn-dot" />}
              </button>
            </div>
          </div>
        )}

        {showBgModal && (
          <Modal title="Background Image" onClose={this._onCloseBgModal}>
            <div className="BgModal">
              <p className="BgModal-hint">
                Paste a public image URL to use as the website background.
              </p>
              <div className="BgModal-input-row">
                <input
                  type="url"
                  className="BgModal-input"
                  placeholder="https://example.com/image.jpg"
                  value={bgUrlInput}
                  onChange={this._onBgUrlChange}
                  autoFocus
                />
              </div>
              <div className="BgModal-size-row">
                {[
                  { id: "contain", label: "Fit" },
                  { id: "cover", label: "Fill" },
                  { id: "tile", label: "Tile" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    className={
                      "BgModal-size-btn" +
                      (bgSize === opt.id ? " BgModal-size-btn-active" : "")
                    }
                    onClick={() => this._onBgSizeChange(opt.id)}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {bgUrlInput.trim() && (
                <div className="BgModal-preview">
                  <div
                    className="BgModal-preview-img"
                    style={{ backgroundImage: `url(${bgUrlInput.trim()})` }}
                  />
                </div>
              )}
              <div className="BgModal-buttons">
                <button
                  className="BgModal-apply-btn"
                  onClick={this._onApplyBg}
                  disabled={!bgUrlInput.trim()}>
                  Apply
                </button>
                {bgUrlActive && (
                  <button
                    className="BgModal-clear-btn"
                    onClick={this._onClearBg}>
                    Remove background
                  </button>
                )}
              </div>
            </div>
          </Modal>
        )}

        {this.state.showCustomBoardModal && (
          <Modal
            title="Custom Board Theme"
            onClose={this._onCloseCustomBoardModal}>
            <div className="CustomBoardModal">
              <p className="CustomBoardModal-hint">
                Customize the colors of your game board.
              </p>

              <div className="CustomBoardModal-form">
                <div className="CustomBoardModal-field">
                  <label className="CustomBoardModal-label">Board Color</label>
                  <div className="CustomBoardModal-picker-row">
                    <input
                      type="color"
                      className="CustomBoardModal-color-input"
                      value={this.state.customBoardColor}
                      onChange={this._onCustomBoardColorChange}
                    />
                    <input
                      type="text"
                      className="CustomBoardModal-text-input"
                      value={this.state.customBoardColor}
                      onChange={this._onCustomBoardColorChange}
                    />
                  </div>
                </div>

                <div className="CustomBoardModal-field">
                  <label className="CustomBoardModal-label">Blend Color</label>
                  <div className="CustomBoardModal-picker-row">
                    <input
                      type="color"
                      className="CustomBoardModal-color-input"
                      value={this.state.customBoardBlend}
                      onChange={this._onCustomBoardBlendChange}
                    />
                    <input
                      type="text"
                      className="CustomBoardModal-text-input"
                      value={this.state.customBoardBlend}
                      onChange={this._onCustomBoardBlendChange}
                    />
                  </div>
                </div>

                <div className="CustomBoardModal-field">
                  <label className="CustomBoardModal-label">Lines Color</label>
                  <div className="CustomBoardModal-picker-row">
                    <input
                      type="color"
                      className="CustomBoardModal-color-input"
                      value={this.state.customBoardLines}
                      onChange={this._onCustomBoardLinesChange}
                    />
                    <input
                      type="text"
                      className="CustomBoardModal-text-input"
                      value={this.state.customBoardLines}
                      onChange={this._onCustomBoardLinesChange}
                    />
                  </div>
                </div>
              </div>

              <div className="CustomBoardModal-preview-section">
                <div className="CustomBoardModal-preview-title">Preview</div>
                <div className="CustomBoardModal-preview-container">
                  <div
                    className="CustomBoardModal-board-preview"
                    style={{
                      background: `radial-gradient(circle at center, ${this.state.customBoardColor} 0%, ${this.state.customBoardBlend} 100%)`,
                      borderColor: this.state.customBoardLines,
                    }}>
                    <div
                      className="CustomBoardModal-board-line-x"
                      style={{ backgroundColor: this.state.customBoardLines }}
                    />
                    <div
                      className="CustomBoardModal-board-line-y"
                      style={{ backgroundColor: this.state.customBoardLines }}
                    />
                    <div
                      className="CustomBoardModal-board-star"
                      style={{ backgroundColor: this.state.customBoardLines }}
                    />
                    <div className="CustomBoardModal-stone CustomBoardModal-stone-black" />
                    <div className="CustomBoardModal-stone CustomBoardModal-stone-white" />
                  </div>
                </div>
              </div>

              <div className="CustomBoardModal-buttons">
                <button
                  className="CustomBoardModal-btn CustomBoardModal-close-btn"
                  onClick={this._onCloseCustomBoardModal}>
                  Done
                </button>
              </div>
            </div>
          </Modal>
        )}

        {this.state.showCustomStoneModal && (
          <Modal
            title="Custom Stone Theme"
            onClose={this._onCloseCustomStoneModal}>
            <div className="CustomStoneModal">
              <p className="CustomStoneModal-hint">
                Customize the appearance of black and white stones.
              </p>

              <div className="CustomStoneModal-form">
                <div className="CustomStoneModal-field">
                  <div className="ToggleSwitch">
                    <span className="ToggleSwitch-label">Flat Stones</span>
                    <label className="ToggleSwitch-control">
                      <input
                        type="checkbox"
                        checked={this.state.customStoneFlat}
                        onChange={this._onCustomStoneFlatChange}
                      />
                      <span className="ToggleSwitch-slider" />
                    </label>
                  </div>
                </div>

                <div className="CustomStoneModal-section-title">
                  Black Stones
                </div>
                <div className="CustomStoneModal-field">
                  <label className="CustomStoneModal-label">Black Color</label>
                  <div className="CustomStoneModal-picker-row">
                    <input
                      type="color"
                      className="CustomStoneModal-color-input"
                      value={extractHexColor(
                        this.state.customStoneBlackBase,
                        "#1a1a1a"
                      )}
                      onChange={this._onCustomStoneBlackColorChange}
                    />
                    <span className="CustomStoneModal-color-value">
                      {extractHexColor(
                        this.state.customStoneBlackBase,
                        "#1a1a1a"
                      )}
                    </span>
                  </div>
                </div>

                <div className="CustomStoneModal-field">
                  <label className="CustomStoneModal-label">Black Border</label>
                  <div className="CustomStoneModal-picker-row">
                    {BLACK_BORDER_PRESETS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={
                          "CustomStoneModal-select-btn" +
                          (this.state.customStoneBlackBorder === opt.value
                            ? " CustomStoneModal-select-btn-active"
                            : "")
                        }
                        onClick={() =>
                          this._onCustomStoneBlackBorderSelect(opt.value)
                        }>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="CustomStoneModal-field">
                  <label className="CustomStoneModal-label">Black Shadow</label>
                  <div className="CustomStoneModal-picker-row">
                    {BLACK_SHADOW_PRESETS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={
                          "CustomStoneModal-select-btn" +
                          (this.state.customStoneBlackShadow === opt.value
                            ? " CustomStoneModal-select-btn-active"
                            : "")
                        }
                        onClick={() =>
                          this._onCustomStoneBlackShadowSelect(opt.value)
                        }>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="CustomStoneModal-section-title">
                  White Stones
                </div>
                <div className="CustomStoneModal-field">
                  <label className="CustomStoneModal-label">White Color</label>
                  <div className="CustomStoneModal-picker-row">
                    <input
                      type="color"
                      className="CustomStoneModal-color-input"
                      value={extractHexColor(
                        this.state.customStoneWhiteBase,
                        "#ffffff"
                      )}
                      onChange={this._onCustomStoneWhiteColorChange}
                    />
                    <span className="CustomStoneModal-color-value">
                      {extractHexColor(
                        this.state.customStoneWhiteBase,
                        "#ffffff"
                      )}
                    </span>
                  </div>
                </div>

                <div className="CustomStoneModal-field">
                  <label className="CustomStoneModal-label">White Border</label>
                  <div className="CustomStoneModal-picker-row">
                    {WHITE_BORDER_PRESETS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={
                          "CustomStoneModal-select-btn" +
                          (this.state.customStoneWhiteBorder === opt.value
                            ? " CustomStoneModal-select-btn-active"
                            : "")
                        }
                        onClick={() =>
                          this._onCustomStoneWhiteBorderSelect(opt.value)
                        }>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="CustomStoneModal-field">
                  <label className="CustomStoneModal-label">White Shadow</label>
                  <div className="CustomStoneModal-picker-row">
                    {WHITE_SHADOW_PRESETS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={
                          "CustomStoneModal-select-btn" +
                          (this.state.customStoneWhiteShadow === opt.value
                            ? " CustomStoneModal-select-btn-active"
                            : "")
                        }
                        onClick={() =>
                          this._onCustomStoneWhiteShadowSelect(opt.value)
                        }>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="CustomStoneModal-preview-section">
                <div className="CustomStoneModal-preview-title">Preview</div>
                <div className="CustomStoneModal-preview-container">
                  <div
                    className="CustomStoneModal-board-preview Board"
                    data-board-style="custom"
                    data-stone-style="custom"
                    style={{
                      borderColor: this.state.customBoardLines,
                    }}>
                    <div
                      className="CustomStoneModal-board-line-x"
                      style={{ backgroundColor: this.state.customBoardLines }}
                    />
                    <div
                      className="CustomStoneModal-board-line-y"
                      style={{ backgroundColor: this.state.customBoardLines }}
                    />
                    <div
                      className="CustomStoneModal-board-star"
                      style={{ backgroundColor: this.state.customBoardLines }}
                    />
                    <div
                      className="Board-stone Board-stone-black"
                      style={{
                        top: "10px",
                        left: "10px",
                        width: "44px",
                        height: "44px",
                        position: "absolute",
                      }}
                    />
                    <div
                      className="Board-stone Board-stone-white"
                      style={{
                        top: "auto",
                        left: "auto",
                        bottom: "10px",
                        right: "10px",
                        width: "44px",
                        height: "44px",
                        position: "absolute",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="CustomStoneModal-buttons">
                <button
                  className="CustomStoneModal-btn CustomStoneModal-close-btn"
                  onClick={this._onCloseCustomStoneModal}>
                  Done
                </button>
              </div>
            </div>
          </Modal>
        )}

        <A
          className="MoreMenu-item MoreMenu-item-logout"
          onClick={actions.onLogout}>
          <Icon name="log-out" size={16} />
          <span className="MoreMenu-item-text">Sign out</span>
        </A>

        <div className="MoreMenu-footer">
          <div className="MoreMenu-footer-links">
            <A className="MoreMenu-footer-link" onClick={this._onAboutClick}>
              <Icon name="info" size={12} />
              About
            </A>
            <A className="MoreMenu-footer-link" onClick={this._onCreditsClick}>
              <Icon name="star" size={12} />
              Credits
            </A>
            <A className="MoreMenu-footer-link" onClick={this._onTermsClick}>
              <Icon name="lock" size={12} />
              Terms & Privacy
            </A>
            <A className="MoreMenu-footer-link" onClick={this._onFeedback}>
              <Icon name="message-square" size={12} />
              Feedback
            </A>
            <a
              className="MoreMenu-footer-link"
              href="https://www.gokgs.com/"
              target="_blank"
              rel="noopener noreferrer">
              <Icon name="globe" size={12} />
              KGS
            </a>
            <a
              className="MoreMenu-footer-link"
              href="https://github.com/rampichino/kido_kgs"
              target="_blank"
              rel="noopener noreferrer">
              <Icon name="code" size={12} />
              GitHub
            </a>
          </div>
          {this.state.version ? (
            <div className="MoreMenu-footer-version">
              Kido v{this.state.version}
            </div>
          ) : null}
          <div className="MoreMenu-footer-copyright">
            © {new Date().getFullYear()} Kido. All rights reserved.
          </div>
        </div>
      </div>
    );
  }

  _onViewProfile = () => {
    if (this.props.currentUser) {
      this.props.actions.onUserDetail(this.props.currentUser.name);
    }
  };

  _onMyGamesClick = () => {
    this.props.actions.onChangeNav("mygames");
  };

  _onFeedback = () => {
    this.props.actions.onShowFeedbackModal();
  };

  _onAboutClick = (e: Object) => {
    e.preventDefault();
    this.props.actions.onShowAboutModal("about");
  };

  _onCreditsClick = (e: Object) => {
    e.preventDefault();
    this.props.actions.onShowAboutModal("credits");
  };

  _onTermsClick = (e: Object) => {
    e.preventDefault();
    this.props.actions.onShowAboutModal("terms");
  };
}
