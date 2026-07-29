// @flow
import React, { PureComponent as Component } from "react";
import { A } from "./A";
import { Icon } from "./Icon";
import { isAncestor } from "../../util/dom";

type Props = {
  children?: any,
  title?: any,
  onClose: Function,
  // When false, the modal can only be dismissed via its own controls (the
  // close icon / buttons) — not by clicking the backdrop or pressing Escape.
  closeOnOutsideClick?: boolean,
};

export class ScreenModal extends Component<Props> {
  _mainDiv: ?HTMLElement;

  componentDidMount() {
    document.addEventListener("keyup", this._onKeyUp);
    if (document.body) {
      document.body.classList.add("no-scroll");
    }
  }

  componentWillUnmount() {
    document.removeEventListener("keyup", this._onKeyUp);
    if (document.body) {
      document.body.classList.remove("no-scroll");
    }
  }

  render() {
    let { children, title, onClose } = this.props;
    let className =
      "ScreenModal ScreenModal-" + (title ? "with-title" : "without-title");
    return (
      <div className={className} onClick={this._onMaybeClose}>
        <div className="ScreenModal-main" ref={this._setMainRef}>
          {title ? <div className="ScreenModal-title">{title}</div> : null}
          <A className="ScreenModal-close" onClick={onClose}>
            <Icon name="x" size={18} />
          </A>
          <div className="ScreenModal-content">{children}</div>
        </div>
      </div>
    );
  }

  _setMainRef = (ref: HTMLElement | null) => {
    this._mainDiv = ref;
  };

  _onKeyUp = (e: Object) => {
    if (this.props.closeOnOutsideClick === false) {
      return;
    }
    if (e.key === "Escape" || e.keyCode === 27) {
      this.props.onClose();
    }
  };

  _onMaybeClose = (e: Object) => {
    if (this.props.closeOnOutsideClick === false) {
      return;
    }
    if (this._mainDiv && isAncestor(e.target, this._mainDiv)) {
      return;
    }
    this.props.onClose();
  };
}
