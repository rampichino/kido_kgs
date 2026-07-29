// @flow
import React, { PureComponent as Component } from "react";
import { Icon } from "../common";
import AiReviewModal from "./AiReviewModal";
import { getKgsSgfUrl, isGamePlayer } from "../../model/game";
import type { GameChannel, AppActions, Index, Room, User } from "../../model";

type Props = {
  game: GameChannel,
  actions: AppActions,
  currentUser: User,
  roomsById: Index<Room>,
  // When set, an Info button is shown in the row that opens the Game Info modal
  // (used by demo/review boards, which have no inline game-details panel).
  onShowInfo?: () => any,
};

type State = {
  showAiReview: boolean,
};

export default class GameMoreMenu extends Component<Props, State> {
  state = { showAiReview: false };

  _onReview = () => {
    this.props.actions.onStartReview(this.props.game.id);
  };

  _onShowAiReview = () => {
    this.setState({ showAiReview: true });
  };

  _onCloseAiReview = () => {
    this.setState({ showAiReview: false });
  };

  render() {
    let { game, currentUser, onShowInfo } = this.props;
    // For a loaded archive game, prefer the original archive summary (correct
    // date + players) over the review channel's own summary.
    let summary = game.loadedSummary || game.summary;
    let sgfUrl = summary ? getKgsSgfUrl(summary) : "#";
    // Offer an editable review only for a finished real game (not one that is
    // already a review/demo/teaching editing channel), AND only to a player of
    // that game. KGS destroys a *watched* game's channel once it ends, so an
    // observer's GAME_START_REVIEW would hit a dead channel and crash the
    // session — observers must review from the archive (load it via My Games).
    let isPlayer = !!(
      game.players && isGamePlayer(currentUser.name, game.players)
    );
    let canReview =
      game.over &&
      isPlayer &&
      game.type !== "review" &&
      game.type !== "rengo_review" &&
      game.type !== "demonstration" &&
      game.type !== "teaching";

    return (
      <div className="GameMoreMenu">
        <div className="GameMoreMenu-buttons">
          <a className="GameMoreMenu-button" download href={sgfUrl}>
            <Icon name="download" size={14} />
            SGF
          </a>
          <button
            type="button"
            className="GameMoreMenu-button"
            onClick={this._onShowAiReview}>
            <Icon name="brain-circuit" size={14} />
            AI
          </button>
          {canReview ? (
            <button
              type="button"
              className="GameMoreMenu-button GameMoreMenu-button-review"
              onClick={this._onReview}>
              <Icon name="book-open" size={14} />
              Review
            </button>
          ) : null}
          {onShowInfo ? (
            <button
              type="button"
              className="GameMoreMenu-button GameMoreMenu-button-info"
              onClick={onShowInfo}
              title="Game Info">
              <Icon name="info" size={14} />
              Info
            </button>
          ) : null}
        </div>
        {this.state.showAiReview ? (
          <AiReviewModal sgfUrl={sgfUrl} onClose={this._onCloseAiReview} />
        ) : null}
      </div>
    );
  }
}
