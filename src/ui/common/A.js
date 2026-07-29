// @flow
import React, { PureComponent as Component } from "react";

type Props = {
  href?: string,
  button?: boolean,
  disabled?: boolean,
  onClick?: (e: Event) => void | Promise<any>,
  onMouseDown?: (e: Event) => any,
  onMouseEnter?: (e: Event) => any,
  onMouseLeave?: (e: Event) => any,
  onMouseMove?: (e: Event) => any,
  className?: string,
  children?: any,
};

export class A extends Component<Props> {
  render() {
    let {
      href,
      button,
      disabled,
      className,
      children,
      onMouseDown,
      onMouseEnter,
      onMouseLeave,
      onMouseMove,
    } = this.props;
    return href || !button ? (
      <a
        className={className}
        href={href || "#"}
        onClick={this._onClick}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}>
        {children}
      </a>
    ) : (
      <button
        className={className}
        disabled={disabled}
        onClick={this._onClick}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}>
        {children}
      </button>
    );
  }

  _onClick = (e: KeyboardEvent) => {
    let { href, onClick } = this.props;
    if (href && (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey)) {
      // Opening in new tab/window or some other special user action
      return;
    }
    e.preventDefault();
    if (onClick) {
      onClick(e);
    }
  };
}
