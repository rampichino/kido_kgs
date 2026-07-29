// @flow
import React, { PureComponent as Component } from "react";
import { A, Icon } from "../common";

type Props = {
  nodeId: number,
  currentLine: Array<number>,
  onChangeCurrentNode: (number) => any,
  hoveredCoordinate?: ?string,
};

export default class BoardNav extends Component<Props, { isPlaying: boolean }> {
  state = {
    isPlaying: false,
  };

  _autoplayTimer: ?IntervalID = null;

  componentDidMount() {
    document.addEventListener("keydown", this._onKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this._onKeyDown);
    this._stopAutoplay();
  }

  _startAutoplay = () => {
    this._stopAutoplay();
    this.setState({ isPlaying: true });
    this._autoplayTimer = setInterval(() => {
      const advanced = this._advanceNext();
      if (!advanced) {
        this._stopAutoplay();
      }
    }, 2000);
  };

  _stopAutoplay = () => {
    if (this._autoplayTimer) {
      clearInterval(this._autoplayTimer);
      this._autoplayTimer = null;
    }
    this.setState({ isPlaying: false });
  };

  _togglePlay = () => {
    if (this.state.isPlaying) {
      this._stopAutoplay();
    } else {
      let { nodeId, currentLine } = this.props;
      let idx = currentLine.indexOf(nodeId);
      if (idx === currentLine.length - 1) {
        this._onFirst();
      }
      this._startAutoplay();
    }
  };

  render() {
    let { nodeId, currentLine, hoveredCoordinate } = this.props;
    let { isPlaying } = this.state;
    if (typeof nodeId !== "number" || !currentLine) {
      return <div className="BoardNav" />;
    }
    let moveNum = currentLine.indexOf(nodeId);

    return (
      <div className="BoardNav BoardNav-no-slider">
        <div className="BoardNav-move">Move {moveNum}</div>
        <div className="BoardNav-step">
          <A
            className="BoardNav-first"
            onClick={this._onFirst}
            title="Go to start">
            <Icon name="fast-backward" />
          </A>
          <A
            className="BoardNav-prev"
            onClick={this._onPrev}
            title="Previous move">
            <Icon name="chevron-left" />
          </A>
          <A
            className="BoardNav-play"
            onClick={this._togglePlay}
            title={isPlaying ? "Pause autoplay" : "Start autoplay"}>
            <Icon name={isPlaying ? "pause" : "play"} />
          </A>
          <A className="BoardNav-next" onClick={this._onNext} title="Next move">
            <Icon name="chevron-right" />
          </A>
          <A className="BoardNav-last" onClick={this._onLast} title="Go to end">
            <Icon name="fast-forward" />
          </A>
        </div>
        <div
          className={
            "BoardNav-coordinate-right" +
            (hoveredCoordinate ? "" : " BoardNav-coordinate-right-empty")
          }>
          {hoveredCoordinate || ""}
        </div>
      </div>
    );
  }

  _onPrev = () => {
    this._stopAutoplay();
    let { nodeId, currentLine } = this.props;
    let idx = currentLine.indexOf(nodeId);
    if (idx > 0) {
      this.props.onChangeCurrentNode(currentLine[idx - 1]);
    }
  };

  _advanceNext = () => {
    let { nodeId, currentLine } = this.props;
    let idx = currentLine.indexOf(nodeId);
    if (idx < currentLine.length - 1) {
      this.props.onChangeCurrentNode(currentLine[idx + 1]);
      return true;
    }
    return false;
  };

  _onNext = () => {
    this._stopAutoplay();
    this._advanceNext();
  };

  _onLast = () => {
    this._stopAutoplay();
    let { currentLine } = this.props;
    this.props.onChangeCurrentNode(currentLine[currentLine.length - 1]);
  };

  _onFirst = () => {
    this._stopAutoplay();
    let { currentLine } = this.props;
    this.props.onChangeCurrentNode(currentLine[0]);
  };

  _onKeyDown = (e: Object) => {
    let node = e.target;
    while (node) {
      if (
        node.nodeName === "INPUT" ||
        node.nodeName === "SELECT" ||
        node.nodeName === "TEXTAREA"
      ) {
        if (node.value) {
          return;
        }
      }
      node = node.parentNode;
    }
    if (e.key === "ArrowLeft" || e.keyCode === 37) {
      this._onPrev();
    } else if (e.key === "ArrowRight" || e.keyCode === 39) {
      this._onNext();
    } else if (e.key === "ArrowUp" || e.keyCode === 38) {
      this._onLast();
    } else if (e.key === "ArrowDown" || e.keyCode === 40) {
      this._onFirst();
    }
  };
}
