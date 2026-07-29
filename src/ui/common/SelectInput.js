// @flow
import React, { PureComponent as Component } from "react";
import { Icon } from "./Icon";

type Option = { value: string, label: React$Node };

type Props = {
  value?: mixed,
  onChange?: (e: { target: { value: string } }) => mixed,
  children?: React$Node,
  disabled?: boolean,
  name?: string,
  id?: string,
  className?: string,
};

type MenuPos = { left: number, top: number, width: number };

type State = {
  open: boolean,
  menuPos: ?MenuPos,
};

// Custom dropdown that mirrors the reference room filter (.GameListFilter-room):
// a styled trigger plus a floating menu of option buttons, so the open list
// matches the rest of the UI instead of the browser-native <option> popup.
// It keeps the same API as a native <select> (value / onChange / <option>
// children) — onChange is invoked with a { target: { value } } shape so existing
// handlers reading e.target.value keep working.
//
// The menu is positioned with `position: fixed` against the trigger's screen
// rect so it is never clipped by an ancestor's `overflow: hidden` (e.g. inside a
// modal). It repositions on scroll/resize while open.
export class SelectInput extends Component<Props, State> {
  state = { open: false, menuPos: null };
  triggerRef: { current: null | HTMLButtonElement } = React.createRef();
  menuRef: { current: null | HTMLDivElement } = React.createRef();

  componentWillUnmount() {
    this._removeListeners();
  }

  _options(): Array<Option> {
    const opts = [];
    React.Children.forEach(this.props.children, (child) => {
      if (child && child.props && child.props.value !== undefined) {
        opts.push({
          value: String(child.props.value),
          label: child.props.children,
        });
      }
    });
    return opts;
  }

  _selectedLabel(): React$Node {
    const value =
      this.props.value === undefined ? "" : String(this.props.value);
    const match = this._options().find((o) => o.value === value);
    return match ? match.label : "";
  }

  _updateMenuPos = () => {
    const el = this.triggerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      this.setState({
        menuPos: { left: r.left, top: r.bottom + 6, width: r.width },
      });
    }
  };

  _onDocMouseDown = (e: MouseEvent) => {
    const t = this.triggerRef.current;
    const m = this.menuRef.current;
    if (
      e.target instanceof Node &&
      !(t && t.contains(e.target)) &&
      !(m && m.contains(e.target))
    ) {
      this._close();
    }
  };

  _addListeners() {
    document.addEventListener("mousedown", this._onDocMouseDown);
    window.addEventListener("resize", this._updateMenuPos);
    window.addEventListener("scroll", this._updateMenuPos, true);
  }

  _removeListeners() {
    document.removeEventListener("mousedown", this._onDocMouseDown);
    window.removeEventListener("resize", this._updateMenuPos);
    window.removeEventListener("scroll", this._updateMenuPos, true);
  }

  _open = () => {
    if (this.props.disabled || this.state.open) {
      return;
    }
    this.setState({ open: true });
    this._updateMenuPos();
    this._addListeners();
  };

  _close = () => {
    if (!this.state.open) {
      return;
    }
    this.setState({ open: false, menuPos: null });
    this._removeListeners();
  };

  _onToggle = () => {
    if (this.state.open) {
      this._close();
    } else {
      this._open();
    }
  };

  _onSelect = (value: string) => {
    this._close();
    if (this.props.onChange) {
      this.props.onChange({ target: { value } });
    }
  };

  render() {
    const { open, menuPos } = this.state;
    const { disabled, id, className } = this.props;
    const value =
      this.props.value === undefined ? "" : String(this.props.value);
    const options = this._options();

    return (
      <div className={"SelectInput" + (className ? " " + className : "")}>
        <button
          ref={this.triggerRef}
          type="button"
          id={id}
          className={"SelectInput-trigger" + (open ? " is-open" : "")}
          disabled={disabled}
          onClick={this._onToggle}>
          <span className="SelectInput-trigger-label">
            {this._selectedLabel()}
          </span>
          <Icon name="chevron-down" />
        </button>
        {open && menuPos ? (
          <div
            ref={this.menuRef}
            className="SelectInput-menu"
            style={{
              position: "fixed",
              left: menuPos.left,
              top: menuPos.top,
              width: menuPos.width,
            }}>
            {options.map((o) => (
              <button
                type="button"
                key={o.value}
                className={
                  "SelectInput-option" +
                  (o.value === value ? " is-selected" : "")
                }
                onClick={() => this._onSelect(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
}
