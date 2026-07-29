// @flow
import React, { useState, useRef, useEffect } from "react";
import { Button, SelectInput } from "../common";
import { formatGameScore, formatGameType } from "../../model/game";
import { formatLocaleDate } from "../../util/date";
import type { GameSummary, GameChannel, Room } from "../../model";

type Props = {
  activeConversationId: ?number,
  game: GameSummary,
  onCloseUserDetail: () => void,
  onJoinGame: (gameId: number | string) => void,
  onLoadGame: (
    timestamp: string,
    channelId: number,
    privateGame: boolean,
    archiveSummary?: GameSummary
  ) => void,
  onLeaveGame: (game: GameChannel | number) => void,
  reviewGameId: ?number,
  // Rooms the user has joined — the server only loads a game into a joined room.
  rooms?: Room[],
};

export default function UserGameSummary(props: Props) {
  let {
    onCloseUserDetail,
    onLoadGame,
    onJoinGame,
    rooms: roomsProp = [],
    activeConversationId,
    game,
    reviewGameId,
    onLeaveGame,
  } = props;
  let rooms = roomsProp.filter(Boolean);
  let [privateGame, setPrivate] = useState(true);
  let [showSpinner, setShowSpinner] = useState(false);
  let reviewGameIdRef = useRef(reviewGameId);
  // The target must be a real joined room. activeConversationId can be a DM
  // conversation (not a room), which would leave the select blank and break the
  // load — so only use it if it matches a room, else fall back to the first.
  let isRoom = (id) => rooms.some((r) => r.id === id);
  let defaultTargetRoom =
    activeConversationId && isRoom(activeConversationId)
      ? activeConversationId
      : rooms.length
        ? rooms[0].id
        : null;

  let [targetRoom, setTargetRoom] = useState(defaultTargetRoom);

  useEffect(() => {
    if (reviewGameId && reviewGameIdRef.current !== reviewGameId) {
      // A new review game has been loaded.
      if (reviewGameIdRef.current) {
        // Leave the game that is currently being reviewed.
        onLeaveGame(reviewGameIdRef.current);
      }

      onJoinGame(reviewGameId);
      onCloseUserDetail();
    }
  }, [reviewGameId, onLeaveGame, onJoinGame, onCloseUserDetail]);

  return (
    <div className="UserGameSummary">
      <div className="UserGameSummary-players">
        <div className="UserGameSummary-player UserGameSummary-white">
          <div className="UserGameSummary-stone UserGameSummary-stone-white" />
          <span>{game.players.white && game.players.white.name}</span>
        </div>
        <div className="UserGameSummary-vs">vs</div>
        <div className="UserGameSummary-player UserGameSummary-black">
          <div className="UserGameSummary-stone UserGameSummary-stone-black" />
          <span>{game.players.black && game.players.black.name}</span>
        </div>
      </div>

      <div className="UserGameSummary-meta">
        {game.score && (
          <div className="UserGameSummary-meta-item">
            <span className="UserGameSummary-meta-label">Result</span>
            <span className="UserGameSummary-meta-value">
              {formatGameScore(game.score)}
            </span>
          </div>
        )}
        <div className="UserGameSummary-meta-item">
          <span className="UserGameSummary-meta-label">Date</span>
          <span className="UserGameSummary-meta-value">
            {formatLocaleDate(game.timestamp)}
          </span>
        </div>
        <div className="UserGameSummary-meta-item">
          <span className="UserGameSummary-meta-label">Type</span>
          <span className="UserGameSummary-meta-value">
            {formatGameType(game.type)}
          </span>
        </div>
      </div>

      <div className="UserGameSummary-divider" />

      {!targetRoom && (
        <p>
          <strong>Please join a room in order to load a game.</strong>
        </p>
      )}

      {targetRoom && !showSpinner && (
        <form>
          {rooms.length > 1 && (
            <div className="UserGameLoadForm-room">
              <label htmlFor="game-load-room">Load game in:</label>
              <SelectInput
                name="rooms"
                id="game-load-room"
                value={targetRoom}
                onChange={(e: { target: { value: string } }) => {
                  setTargetRoom(Number(e.target.value));
                }}>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </SelectInput>
            </div>
          )}

          {rooms.length === 1 && (
            <p>
              Game will be loaded in <strong>{rooms[0].name}</strong>
            </p>
          )}

          <div className="UserGameLoadForm-fields">
            <div className="ToggleSwitch">
              <span className="ToggleSwitch-label">Private</span>
              <label className="ToggleSwitch-control">
                <input
                  type="checkbox"
                  name="privateGame"
                  checked={privateGame}
                  onChange={() => setPrivate(!privateGame)}
                />
                <span className="ToggleSwitch-slider" />
              </label>
            </div>
          </div>

          <div className="UserGameLoadForm-action">
            <Button
              primary
              disabled={!isRoom(targetRoom)}
              onClick={() => {
                if (!isRoom(targetRoom)) {
                  return;
                }
                setShowSpinner(true);
                onLoadGame(game.timestamp, targetRoom, privateGame, game);
              }}>
              Load game
            </Button>
          </div>
        </form>
      )}

      {showSpinner && (
        <div className="BoardLoading UserGameSummary-loading">
          <div className="BoardLoading-dot" />
          <div className="BoardLoading-dot" />
          <div className="BoardLoading-dot" />
        </div>
      )}
    </div>
  );
}
