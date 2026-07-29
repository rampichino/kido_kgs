// @flow
import React, { PureComponent as Component } from "react";
import { Icon } from "./Icon";

type Props = {
  type?: "button" | "submit",
  onClick?: (e: Event) => any,
  href?: string,
  target?: string,
  secondary?: boolean,
  danger?: boolean,
  warning?: boolean,
  muted?: boolean,
  small?: boolean,
  icon?: string,
  disabled?: boolean,
  loading?: boolean,
  children?: any,
  className?: string,
  title?: string,
};

export class Button extends Component<Props> {
  render() {
    let {
      type,
      onClick,
      href,
      target,
      secondary,
      danger,
      warning,
      muted,
      small,
      icon,
      disabled,
      loading,
      children,
      title,
    } = this.props;
    let className = "Button";
    if (secondary) {
      className += " Button-secondary";
    }
    if (small) {
      className += " Button-small";
    }
    if (danger) {
      className += " Button-danger";
    }
    if (warning) {
      className += " Button-warning";
    }
    if (muted) {
      className += " Button-muted";
    }
    if (loading) {
      className += " Button-loading";
    }
    if (!children) {
      className += " Button-no-label";
    }
    if (this.props.className) {
      className += " " + this.props.className;
    }
    let iconEl = null;
    if (icon) {
      iconEl =
        icon || loading ? (
          <div className="Button-icon">
            <Icon name={loading ? "spinner" : icon} />
          </div>
        ) : null;
    }
    if (href) {
      return (
        <a className={className} href={href} target={target} title={title}>
          {iconEl} {children}
        </a>
      );
    } else {
      return (
        <button
          type={type || "button"}
          className={className}
          disabled={disabled}
          onClick={onClick}
          title={title}>
          {iconEl} <div className="Button-content">{children}</div>
        </button>
      );
    }
  }
}
