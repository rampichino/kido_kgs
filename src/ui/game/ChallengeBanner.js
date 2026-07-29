// @flow
import React, { PureComponent as Component } from "react";
import { Button, Icon } from "../common";
import type { GameChannel, User } from "../../model";

type Props = {
  currentUser: User,
  challenge: GameChannel,
  onRestore: () => void,
  onCancel: () => void,
};

export default class ChallengeBanner extends Component<Props> {
  render() {
    const { currentUser, challenge, onRestore, onCancel } = this.props;
    const proposal = challenge.initialProposal;
    if (!proposal) {
      return null;
    }

    // Find the opponent's name from players (the one that is not currentUser)
    const opponent = proposal.players.find(
      (p) => p && p.name && p.name !== currentUser.name
    );
    const opponentName = opponent ? opponent.name : null;

    const receivedProposals = challenge.receivedProposals || [];
    const proposalsCount = receivedProposals.length;
    const hasProposals = proposalsCount > 0;

    return (
      <div
        className={
          "ChallengeBanner" + (hasProposals ? " ChallengeBanner-alert" : "")
        }>
        <div className="ChallengeBanner-info">
          {hasProposals ? (
            <Icon
              name="swords"
              className="ChallengeBanner-icon-alert"
              size={16}
            />
          ) : (
            <Icon name="spinner" size={16} />
          )}
          <span className="ChallengeBanner-text">
            {hasProposals ? (
              <span>
                <strong>
                  {proposalsCount === 1
                    ? "New proposal received!"
                    : `${proposalsCount} proposals received!`}
                </strong>
              </span>
            ) : opponentName ? (
              <span>
                {"Challenge sent to "}
                <strong className="ChallengeBanner-opponent">
                  {opponentName}
                </strong>
                {"... Awaiting response"}
              </span>
            ) : (
              <span>Awaiting challengers...</span>
            )}
          </span>
        </div>
        <div className="ChallengeBanner-actions">
          <Button
            primary
            onClick={onRestore}
            className="ChallengeBanner-open-btn">
            Open
          </Button>
          <Button muted onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }
}
