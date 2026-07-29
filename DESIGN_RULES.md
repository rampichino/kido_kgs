# Kido Design Rules

This is the **authoritative design reference** for the Kido UI. All color, layout, and component decisions must follow these rules. When adding or modifying UI, always check this file first.

---

## 1. Color Palettes

### Light Mode Palette — `design/palette_white.scss`

| Name | Hex | Role |
|---|---|---|
| `white-smoke` | `#f6f5f2` | Page/container background, game card background |
| `floral-white` | `#f6f1e7` | Panel background (sidebar, left rail) |
| `white` | `#fcfcfb` | Content surface (game board area background) |
| `light-sea-green` | `#00a3a3` | — (reserve, retired) |
| `strong-cyan` | `#33cbcb` | — (reserve, retired) |
| `bright-amber` | `#ffcc00` | — (reserve, retired) |
| `rosy-copper` | `#db5a47` | Default UI accent color (`--ui-color`) |

### Dark Mode Palette — `design/palette_dark.scss`

| Name | Hex | Role |
|---|---|---|
| `carbon-black` | `#171f1d` | Darkest background surface |
| `jet-black` | `#232f2c` | Dark panel/card background |
| `ink-green` | `#162420` | — (reserve; former dark game card) |
| `card-green` | `#1d2523` | Dark game card background (`.GameSummaryList-item`, `.GameList-item`) |
| `moss-black` | `#1a2420` | Modal/drawer background (Create Challenge, Automatch) |
| `dark-slate-grey` | `#1e3b38` | — (reserve, retired) |
| `turf-green` | `#057357` | — (reserve, retired) |
| `mint-leaf` | `#20ba94` | Dark mode UI accent |
| `tomato` | `#ff6b40` | — (reserve, retired) |
| `pale-amber` | `#f6e77a` | — (reserve, retired) |

### Runtime Color Variables

These CSS custom properties are set at runtime via the color picker in preferences. Always use these in SCSS — never hardcode the accent hex directly.

| Variable | Purpose |
|---|---|
| `--ui-color` | Primary accent (text, borders, active states, nav underline, clock, challenge cards, highlights) |
| `--ui-color-rgb` | RGB triplet of `--ui-color` for use in `rgba()` |

**Usage pattern:**
```scss
color: var(--ui-color);
background: rgba(var(--ui-color-rgb), 0.1);
border: 1px solid rgba(var(--ui-color-rgb), 0.3);
```

### Available UI Color Options

User-selectable accent colors defined in `src/ui/meta/MoreMenu.js`. Stored in `localStorage` under key `kido_ui_color`. All presets have been adjusted to ensure a >= 4.5:1 WCAG AA contrast ratio on light backgrounds.

| ID | Label | Hex | RGB |
|---|---|---|---|
| `rosy` | Rosy *(default)* | `#c24b38` | `194, 75, 56` |
| `turquoise` | Turquoise | `#00827f` | `0, 130, 127` |
| `navy` | Navy Blue | `#0a2342` *(switches to white in dark mode)* | `10, 35, 66` |
| `slate` | Slate Blue | `#3d5c6d` | `61, 92, 109` |
| `stone` | Stone | `#7f6859` | `127, 104, 89` |

### Where `--ui-color` Is Applied

| Element | Property | CSS Class |
|---|---|---|
| Active nav tab underline | `border-bottom` | `.MainNav-item-selected a` |
| Active nav tab icon | `color` | `.MainNav-item-icon` |
| Input focus ring | `border-color`, `box-shadow` | `input:focus`, `select:focus` |
| Primary button | `background`, `border` | `.Button.primary` |
| Move/coordinate badge | `color`, `background`, `border` | `.BoardNav-move`, `.BoardNav-coordinate-right` |
| Active game clock | `color` | `.GameClock-active`, `.GameClock-running` |
| Urgent countdown bg | `background` | `.TimeCountdown-urgent` |
| Challenge tab underline | `border-bottom-color` | `.ChallengeEditor` tab |
| Challenge +/− buttons | `color`, `background`, `border` | `.ChallengeEditor` step buttons |
| Segmented control active | `color` | `.SegmentedControl` active option |
| Filter pill hover/active | `color`, `border-color` | `.CheckboxInput-checked .CheckboxInput-label` |
| Hide room info button hover | `color`, `border-color` | `a.RoomChat-desc-toggle:hover` |
| FriendsList active tab | `color`, `border-bottom-color` | `.FriendsList-tab.active` |
| Chat room game/challenge icon | `color` | `.RoomGameLink` icon |
| UserList section title | `color`, `background`, `border` | `.UserList-section-title` |
| Account trigger hover underline | `border-bottom` | `.MainNav-account-trigger:hover` |
| WatchTabs active tab | `color`, `background`, `border` | `.WatchTabs-tab-active` |

---

## 2. UI Zone Color Map

Each row is a named UI zone. The **Light** and **Dark** columns show the background value for that mode. Notes cover borders, text, states, and special conditions.

| Zone | CSS Classes | Light Mode | Dark Mode | Notes |
|---|---|---|---|---|
| **Panel Background** | `.WatchTabs`, `.ChatScreen-friends-panel` | `floral-white` | `jet-black` | Room list sidebar, WatchTabs panel |
| **Page / Container** | `body.GameScreen-body`, `.WatchScreen` | `white-smoke` | `carbon-black` | Main page body, game list area |
| **Panel Header** | `.ChallengeEditor-header`, `.Modal:has(.UserGameSummary) .Modal-title` | `linear-gradient(#2d3a32, #1a2420)` | same | Text `#f1f5f9`. Intentionally dark/inverted in both modes |
| **Top Menu** | `.MainNav` | `rgba(255,255,255,0.75)` + blur | `rgba(26,36,32,0.95)` | Custom BG: `rgba(255,255,255,0.25)` + blur(16px) on `body.has-custom-bg` |
| **Top Menu Tab (active)** | `.MainNav-item.MainNav-item-selected a` | `rgba(--ui-color-rgb, 0.05)` + `--ui-color` underline | same | Selector must target bare `a`, not just `:hover`. Icon also `--ui-color` |
| **Game Card** | `.GameSummaryList-item` | `white`, border `rgba(0,0,0,0.07)` | `ink-green` | Challenge card: left border `rgba(--ui-color-rgb, 0.6)` + `color-mix()` tint |
| **Secondary Button / Pill** | `.CheckboxInput-label`, `.RoomChat-desc-toggle` | `#f8fafc`, `1.5px solid rgba(0,0,0,0.1)` | same | Hover: `--ui-color` border+text. Active: `rgba(--ui-color-rgb, 0.1)` bg, `font-weight:700` |
| **Dropdown List** | `.SelectInput-menu`, `.GameListFilter-room-menu`, `.MainNav-search-dropdown`, `.MainNav-more-menu`, … | `#fcfbf8` (mid `#f6efe0`), border `rgba(0,0,0,0.1)` | `var(--dk-surface)`, border `rgba(255,255,255,0.12)` | One shared style — see **Dropdowns** in §5. Option hover/selected use `--ui-color` tints |
| **Primary Modal Header** | `.ChallengeEditor-header`, `.Modal-title` (dark variant) | `linear-gradient(#2d3a32, #1a2420)` | same | Text `#7a9e8e`, `24px / 300`, `letter-spacing:-0.01em`. No border |
| **Primary Button** | `.Button.primary` | `--ui-color` bg, `var(--ui-color-contrast)` text | same | Border `1px solid --ui-color`, shadow `0 4px 12px rgba(--ui-color-rgb, 0.25)` |
| **Cards Inside Modal** | form rows in `.Modal-content`, `.ScreenModal-content` | `#f8fafc`, border `rgba(0,0,0,0.07)` | `#1e293b` | Settings rows, form groups |
| **Secondary Modal Header** | `.Modal-title`, `.ScreenModal-title` (standard) | transparent, border-bottom `rgba(0,0,0,0.07)` | border-bottom `rgba(255,255,255,0.07)` | `24px / 300`, `letter-spacing: -0.01em`, `padding: 20px 24px 16px`, `color: #7a9e8e` |
| **Player Info Modal** | `.UserDetailsModal`, `.UserDetailsModal-main` | `#ffffff` | `#1e293b` | No header bar. Player name `18px/700`, meta `15px`, labels `12px` |

---

## 3. Typography

| Element | Size | Weight | Notes |
|---|---|---|---|
| Primary modal title | `24px` | `300` | Dark header (Panel Header style) |
| Secondary modal title | `24px` | `300` | Standard header, matching primary |
| Player name (profile) | `18px` | `500` | UserDetailsModal |
| Meta/detail text | `15px` | `400` | Modal body |
| Label text | `12px` | `500` | Form labels, section labels |
| Navigation items | `15px` | `400–500` | Active item is `500` |
| Badge / pill text | `11px` | `600` | Move count, coordinate badges |
| Body text | `16px` (`1rem`) | `400` | Global default body text size |
| Chat message text | `14px` | `400` | Chat screen message bubbles (`.ChatMessage-text`) |
| Game board player name | `16px` | `400` | Game screen sidebar player username (`.GamePlayersInfo-players`) |

**Font stack:** `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

---

## 4. Semantic / State Colors

These are fixed and must not be changed without updating this document.

| Role | Hex | SCSS Variable |
|---|---|---|
| Success / Win | `#3fca8c` | `$success-bg` |
| Warning | `#f59e0b` | `$warning-bg` |
| Error / Danger | `#ef4444` | `$error-bg` |
| Info / Link | `#0284c7` | `$link-color` |
| Rated game badge | `#0284c7` | `$ranked-color` |
| Free game badge | `#4eb8d0` | `$free-color` |

### Status Dot Colors (fixed — never change these)

| State | Hex |
|---|---|
| Online | `#22c55e` |
| Playing | `#0284c7` |
| Idle | `#f59e0b` |
| Offline | `#cbd5e1` |

### Rank Chip Colors

| Tier | Background | Text |
|---|---|---|
| Pro (1p–9p) | `rgba(239,68,68,0.12)` | `#b91c1c` |
| Dan (1d–9d) | `rgba(234,179,8,0.15)` | `#92700a` |
| SDK (1k–9k) | `rgba(16,185,129,0.10)` | `#065f46` |
| DDK (10k+) | `rgba(99,102,241,0.10)` | `#4338ca` |
| Unranked (`?` / unknown) | *(uses DDK)* `rgba(99,102,241,0.10)` | `#4338ca` |

**Dark mode** keeps the same hue per tier (the rank→color mapping must stay consistent) but raises fill/border opacity and lightens the text so the pills stay legible on dark rows. Text uses the 300-level tint of each hue.

| Tier | Background | Border | Text |
|---|---|---|---|
| Pro | `rgba(239,68,68,0.28)` | `rgba(239,68,68,0.4)` | `#fca5a5` |
| Dan | `rgba(234,179,8,0.28)` | `rgba(234,179,8,0.4)` | `#fcd34d` |
| SDK | `rgba(16,185,129,0.26)` | `rgba(16,185,129,0.4)` | `#6ee7b7` |
| DDK / Unranked | `rgba(99,102,241,0.28)` | `rgba(99,102,241,0.4)` | `#a5b4fc` |

(Mid mode reuses the light-mode chip colors — the dark block is scoped to `body.dark-mode` only.)

---

## 5. Component Conventions

### Modals
- Use `ScreenModal` or `Modal` from `src/ui/common/`
- Modal overlay: `rgba(0,0,0,0.45)` + `backdrop-filter: blur(4px)`
- Modal card: `border-radius: 20px`, `max-width: 620px`. For its border + elevation see **Primary Window border & elevation** below.
- **Cancel buttons should not be used in modals.** Use a close icon (×) in the header instead. The save/submit button is sufficient.

#### Mobile modal style (standard)
On mobile (`≤736px`), primary form modals go **full-screen** and use the **accent header bar** — NOT the dark desktop header. This is the "Create Challenge" style; the Preferences modal follows it, and any new full-form modal should too.

- **Full-screen:** overlay `top: 50px` (clears the fixed 50px nav), card `height: calc(100dvh - 50px)`, `width: 100%`, `max-height: none`, `margin: 0`, `border-radius: 0`. Scope with `:has(.YourModalRoot)`.
- **Header bar** (replaces the desktop dark/`Modal-title` header): full-width, left-aligned, `font-size: 18px`, `font-weight: 600`, `color: var(--ui-color)`, `background: rgba(var(--ui-color-rgb), 0.12)`, `border-bottom: 1px solid rgba(var(--ui-color-rgb), 0.25)`, `border-radius: 0`. Use `!important` where a theme rule forces the title color. Reference: `.ChallengeEditor-badge` and `.Modal:has(.PreferencesModal) .Modal-title` in `_common.scss`.
- **Close (×):** bare accent icon (no button chrome) at top-right, `26px` SVG.

#### Primary Window border & elevation (standard)

Primary windows — the modal cards `.Modal-main`, `.ScreenModal-main`, `.UserDetailsModal-main` (e.g. the player-info modal) — use this **standard border + shadow per theme**. Apply the same treatment to any new primary window; do not invent ad-hoc borders/shadows.

| Theme | Border | Box-shadow |
|---|---|---|
| **Light** | none | `0 12px 32px rgba(0,0,0,0.12), 0 3px 10px rgba(0,0,0,0.06)` |
| **Mid** (dune) | none | `0 12px 32px rgba(59,49,39,0.14), 0 3px 10px rgba(59,49,39,0.07)` (warm) |
| **Dark** | `1px solid var(--dk-border)` (`rgba(255,255,255,0.07)`) | `0 8px 24px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)` |

Rationale: light + mid use **no border**, relying on a soft drop shadow to lift the card (mid's shadow is warm-tinted to match the cream theme). Dark keeps a faint light hairline (`--dk-border`) because a shadow alone doesn't separate a dark card from a dark page. Light's shadow lives on the base `.UserDetailsModal-main`; dark/mid share the `body.dark-mode, body.mid-mode` block; mid overrides the shadow to the warm variant in its own `body.mid-mode` block.

#### Confirmation / decision modals (default pattern)
Short "do you want to…?" prompts use this **centered** layout — no header title. Reference implementation: `src/ui/game/DemoCloseModal.js`.

- **Structure (top to bottom, all centered):**
  1. **Icon badge** — a `56×56` circle, `color: var(--ui-color)` on `background: rgba(var(--ui-color-rgb), 0.12)`, holding a relevant `<Icon size={26} />`.
  2. **Title** — `19px / 600`, the headline (e.g. "This board isn't saved yet"). No trailing question mark.
  3. **Text** — `15px / 400`, `line-height: 1.5`, `color: $semi-muted` (dark mode `#94a3b8`). The question/explanation.
  4. **Actions** — buttons centered (`justify-content: center`, `gap: 10px`, `flex-wrap: wrap`), **primary action first** (`<Button primary>`), then secondary choices.
- Container: `display: flex; flex-direction: column; align-items: center; text-align: center`.
- Keep button labels short and specific ("Yes, save it" / "No" / "Don't close") rather than generic OK/Cancel.

### Close Icons
- Always use `<Icon name="circle-x" />` for all close buttons
- Never use `&times;`, `✕`, or plain `x`
- Close button hover: `color: #c2601a`, `background: rgba(194,96,26,0.1)`

### Badges / Pills
- Move count badge, coordinate badge: `color: var(--ui-color)`, `background: rgba(var(--ui-color-rgb), 0.15)`, `border: 1px solid rgba(var(--ui-color-rgb), 0.3)`, `border-radius: 20px`, `padding: 2px 10px`
- Game list move count: `color: #232f2c`, `background: #f6f5f2`, `border: 1px solid rgba(0,0,0,0.12)`

### Dropdowns (authoritative — all dropdowns must match)

There is **one** dropdown style across the entire app. The reference implementation is the room filter on the Play/Watch challenge list — `.GameListFilter-room` in `src/css/_gamelist.scss`. The shared `SelectInput` component (`src/ui/common/SelectInput.js`) renders this exact structure and is the **default way to build any dropdown** — prefer it over a native `<select>` (a native select can't style its open option list, so it will never match).

> **Rule:** Do not use a native `<select>` for a styled dropdown, and do not invent a new menu/popover look. Use `SelectInput`, or replicate the `.GameListFilter-room` structure below. This applies to every dropdown, search-result list, autocomplete, and action menu.

**Structure** — a trigger button + an absolutely-positioned floating menu of option buttons (never the browser-native popup):

```
.SelectInput            (relative wrapper, font-size 14px)
  .SelectInput-trigger  (the closed box — flex, space-between, chevron on the right)
  .SelectInput-menu     (the floating option list, top: calc(100% + 6px))
    .SelectInput-option  ( + .is-selected )
```

**Trigger** (same in every theme except the per-theme surface/border below):
```scss
height: 36px;            // 38px inside the Create Challenge form, to match its inputs
padding: 0 12px;
font-size: 14px;
font-weight: 500;
border: 1.5px solid …;   // see per-theme table
border-radius: 10px;
.Icon { color: $muted; } // chevron
&:hover  { border-color: …; }            // darker border
&.is-open {                              // open / focused
  border-color: var(--ui-color);
  box-shadow: 0 0 0 3px rgba(var(--ui-color-rgb), 0.12);
  .Icon { color: var(--ui-color); }
}
```

**Menu + options** (radius/shadow identical in all themes; only the surface tints change):
```scss
.SelectInput-menu {
  top: calc(100% + 6px);
  padding: 6px;
  border-radius: 12px;
  border: 1px solid …;     // per-theme
  box-shadow: …;           // per-theme
  max-height: 320px; overflow-y: auto;
}
.SelectInput-option {
  padding: 8px 10px;
  border-radius: 8px;
  &:hover       { background: rgba(var(--ui-color-rgb), 0.08); color: var(--ui-color); }
  &.is-selected { background: rgba(var(--ui-color-rgb), 0.10); color: var(--ui-color); font-weight: 600; }
}
```

**Per-theme surfaces** (mid follows the white theme's accent; only the surface differs):

| Part | Light | Mid (dune) | Dark |
|---|---|---|---|
| **Trigger bg** | `#ffffff` (`#faf9f6` in the Create Challenge form) | light styling (cream form bg) | `var(--dk-bg)` |
| **Trigger border** | `1.5px rgba(0,0,0,0.1)`; hover `rgba(0,0,0,0.2)` | same as light | `1.5px rgba(255,255,255,0.1)`; hover `rgba(255,255,255,0.2)` |
| **Menu bg** | `#fcfbf8` (faint warm tint) | `#f6efe0` (warm lifted cream) | `var(--dk-surface)` |
| **Menu border** | `1px rgba(0,0,0,0.1)` | `var(--dk-border)` | `1px rgba(255,255,255,0.12)` |
| **Menu shadow** | `0 12px 32px rgba(0,0,0,0.16)` | `0 12px 32px rgba(0,0,0,0.16)` | `0 12px 32px rgba(0,0,0,0.45)` |
| **Option text** | `#334155` | `var(--dk-fg)` | `var(--dk-fg-faint)` |
| **Option hover bg** | `rgba(--ui-color-rgb, 0.08)` | `rgba(--ui-color-rgb, 0.08)` | `rgba(--ui-color-rgb, 0.16)` |
| **Option selected bg** | `rgba(--ui-color-rgb, 0.10)` | `rgba(--ui-color-rgb, 0.10)` | `rgba(--ui-color-rgb, 0.18)` |
| **Count pill** (room filter) | `#232f2c` on `rgba(0,0,0,0.05)` | `var(--dk-fg-muted)` on `rgba(59,49,39,0.1)` | `var(--dk-fg)` on `rgba(255,255,255,0.14)` |

Rationale: the menu is a *lifted* surface, so it must sit a notch off the page in every theme — light gets a faint warm tint (pure white was indistinct on the near-white page), mid gets a warm lifted cream (the white surface read too white on the cream theme), dark uses `--dk-surface` not `--dk-bg` (the deepest bg was too dark and hid the count pills).

Mid is light-leaning: the **trigger** falls through to the light styling; only the open **menu** gets a mid-specific tone. Dark/mid menu overrides for `SelectInput` live in `src/css/_common.scss`; the reference room filter's overrides live in `src/css/_gamelist.scss`.

**Every dropdown in the app uses this style.** Current instances: `.GameListFilter-room` (reference), `SelectInput` (Create Challenge rooms/type/rules, Demo setup time/board, load-game room, automatch estimated rank, profile locale), `.MainNav-search-dropdown`, `.MainNav-more-menu`, `.LeaveMessageModal-search-dropdown`, `.ChatMessageBar-mention-dropdown`, `.GameMoreMenu-dropdown`. The `.MainNav-more-menu` keeps full-bleed rows (multi-section panel) but shares the same container surface/border/shadow.

### Filter / Pill Buttons (Zone 6)

All filter/toggle buttons — speed (`.GameListFilter-speed-btn`), type / rank (`.GameListFilter-type-btn`), and the sub-bar pills (`.GameSubBar-sort`, `.GameSubBar-bots`, `.GameSubBar-view`) — share **one** style across all three themes: a distinct warm/neutral fill with a firm border, going to an **accent-tinted active state**. Rank filter buttons (Dan/SDK/DDK) intentionally use this same style — **no per-tier coloring**.

Base button: `height: 32px`, `padding: 0 12px`, `border-radius: 8px`, `font-size: 13–14px`, `font-weight: 500`. Hover → `border-color`+`color: var(--ui-color)`. Active → accent-tinted bg + accent border/text + `font-weight: 600`.

| Part | Light | Mid (dune) | Dark |
|---|---|---|---|
| **Button bg** | `#f3efe8` | `#e8dcc2` | `#1a2a24` |
| **Button border** | `1.5px rgba(80,60,40,0.22)` | `rgba(59,49,39,0.28)` | `rgba(255,255,255,0.1)` |
| **Button text** | `#475569` | `#6b5f4b` | `#a8c4b4` |
| **Active bg** | `rgba(--ui-color-rgb, 0.16)` | `rgba(--ui-color-rgb, 0.16)` | `rgba(--ui-color-rgb, 0.15)` |
| **Active border / text** | `var(--ui-color)` | `var(--ui-color)` | `var(--ui-color)` |

The legacy secondary pill (`.CheckboxInput-label`, `.RoomChat-desc-toggle`) uses the cooler `#f8fafc` / `1.5px rgba(0,0,0,0.1)` base (see Zone 6 row in §2); new filter buttons should follow the warm table above.

### Active Game Clock
- Running clock: `color: var(--ui-color)`
- Time countdown (urgent): `background: var(--ui-color); color: #ffffff`

### Custom Background Image (`body.has-custom-bg`)
- MainNav becomes semi-transparent (`rgba(255,255,255,0.25)`)
- WatchTabs sidebar becomes fully transparent (`background: transparent`)

### Game Board Page
- Body background: `#fcfcfb`
- Mobile side container: `#f6f1e7`

### Segmented Controls
- `.SegmentedControl` (e.g. the "Open to" Room Only/All switcher, Demo scope) shares the **Sort-button style** (`.GameSubBar-sort`): a warm container holding pill items, with an **accent-tinted active fill** (not a white card).
- Container: `padding: 2px`, `gap: 2px`, `border-radius: 8px` — Light `#f3efe8` / `1px rgba(80,60,40,0.18)`, Mid `#e8dcc2` / `rgba(59,49,39,0.28)`, Dark `#1a2a24` / `rgba(255,255,255,0.1)`.
- Item: transparent, `1px solid transparent`, `border-radius: 6px`, text `#64748b` (dark `#a8c4b4`); hover → `var(--ui-color)`.
- Active segment: `color: var(--ui-color)`, `font-weight: 600`, `background: rgba(--ui-color-rgb, 0.16)` (dark `0.18`), `border: 1px solid var(--ui-color)`, no shadow.

### Toggle Switch (ToggleSwitch)
- Use inline (`display: inline-flex; width: auto`) — never full width
- Used instead of checkboxes for binary preferences (e.g. "Private" game)
- **"On" (checked) color — single default for every toggle in the app: `rgba(22, 163, 74, 0.7)`** (deep green-600 at 70% opacity). Do not use the brighter `#22c55e` (that is reserved for the online status dot) or the `--ui-color` accent. The knob (`:before`) stays `#fff`; the unchecked track is `#cbd5e1` (light) / `#475569` (dark).
- The base slider + checked color live un-nested in `src/css/_challenge.scss` and apply everywhere; per-context blocks (`_user.scss`, `_meta.scss`, `_gamelist.scss`) only override geometry/label and **inherit** this checked color. If a block re-declares the checked background, it must use the same `rgba(22, 163, 74, 0.7)`.

### FriendsList Tabs / Chat Tabs
- Active tab: `color: var(--ui-color)`, `border-bottom-color: var(--ui-color)`

### Border Radius Scale
- **`20px`**: Modals (`.Modal-card`), challenge creator header (`.ChallengeEditor-header`).
- **`12px`**: Panel containers, **dropdown menus** (`.SelectInput-menu`, `.GameListFilter-room-menu`, `.MainNav-search-dropdown`, `.MainNav-more-menu`), observers panel (`.GameScreen-observers-panel`).
- **`10px`**: Dropdown **triggers** (`.SelectInput-trigger`, `.GameListFilter-room-trigger`).
- **`8px`**: Primary and secondary buttons, filter pill buttons, toggle switches, **dropdown options** (`.SelectInput-option`).
- **`20px` / `9999px`**: Badge chips, move count badges, observers count badge.

### Spacing & Padding Scale
- **Modal Content Padding**: `20px 24px`
- **Modal Header Padding**: `20px 24px 16px`
- **Separator Negative Margin Trick**: `margin: 0 -48px`
- **Layout Gutters / Gaps**: `20px` on desktop, `10px` on mobile screens.

---

## 6. Game Screen Specific Colors

These colors are used in the game board UI and are intentionally warm/wooden-toned to match the board aesthetic. They are **not** part of the palette and should only be used in game screen contexts.

| Element | Hex | Notes |
|---|---|---|
| BoardNav buttons bg | `#f0eee9` | Warm off-white, matches board surround |
| BoardNav buttons hover/active | `#e2e0d8` | Slightly darker warm tone |
| Pass / Done actions | `#d4a373` | Warm amber — intentional game action color |
| Pass / Done hover | `#c39262` | Darker warm amber |
| WatchTabs sidebar (dark bg) | `#232f2c` | Dark green panel (aligned to `jet-black`) |
| WatchTabs tab (dark) | `#7a9e8e` | Muted green text |

> [!NOTE]
> Game-specific board controls (e.g. `#f0eee9` for BoardNav bg, `#d4a373` for Pass/Done bg) are warm accents designed to match the Goban board aesthetic, and are intentionally preserved without dark mode overrides to keep a unified board appearance.

---

## 7. Dark Mode Rules

- All dark mode overrides go inside `body.dark-mode { }` blocks in the relevant SCSS file
- Key structural dark overrides:

| Light value | Dark override |
|---|---|
| `#f8fafc` / `#f6f5f2` (bg) | `#0f172a` |
| `#ffffff` (surface) | `#1e293b` |
| `#1e293b` (fg) | `#f1f5f9` |
| `#f1f5f9` (off-white) | `#162032` |

---

## 8. Mid Theme (warm "dune" cream)

A third main theme sits between light and dark, toggled via `body.mid-mode` (the header cycle button switches Light → Mid → Dark). It is a **light-leaning warm cream** theme: dark text on warm sand/cream surfaces. It reuses the dark-mode rule set via the shared `body.dark-mode, body.mid-mode` selector and overrides the `--dk-*` variables; it must **never** affect the light or dark themes.

Persistence: `localStorage` key `kido_theme` = `light | mid | dark` (legacy `kido_dark_mode` kept in sync). Helpers in `src/util/theme.js`. Because mid is light-leaning, `isDarkish(mid)` is `false` — mid **follows the white theme's `--ui-color`** (no dark accent overrides), uses light native `color-scheme`, and the light chat-avatar palette.

### Mid surface palette (starting values, in `body.mid-mode`)

| Role | Hex |
|---|---|
| Page background (`--dk-bg`) | `#fbf5ea` |
| Panels / rails (`--dk-bg-off`) | `#f0e4cc` |
| Cards / surface (`--dk-surface`) | `#fffdf8` |
| Border (`--dk-border`) | `rgba(226,203,160,0.7)` |
| Primary text (`--dk-fg`) | `#3b3127` |
| Muted text (`--dk-fg-muted`) | `#9a7b49` |
| Game-list background (panel/list/screen) | `#f4ebd8` |
| Game card (`.GameSummaryList-item`) | `#fbf5ea` |
| WatchScreen header / sub-bar | `#fbf5ea` |

### Chat panels — single shared color (`#f4ebd8`)

In mid mode the following chat surfaces **must all share the same background color `#f4ebd8`** (and `.RoomChat-header`'s `border-bottom` color must also be `#f4ebd8` so the divider blends in). Keep these in sync — if one changes, change all:

- `.ChatScreen-tabs` (left conversation-list column)
- `.ChatScreen-tabs-section-header`
- `.RoomChat-message-bar`
- `.RoomChat-sidebar`
- `.RoomChat-header` (background **and** `border-bottom-color`)
- `.RoomChat-desc`
- `.UserList-section-title`
- `.UserList-header` (and the `.UserList-players-header` sticky wrapper)

Implementation lives in the `body.mid-mode { }` blocks of `src/css/_chat.scss` and `src/css/_user.scss`.

---
