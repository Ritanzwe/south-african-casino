import { useEffect, useMemo, useState } from "react";
import { chooseBotMove, getLoserId, getPlayer, type GameState, type Move } from "@sa-casino/engine";
import { GameScreen } from "../components/GameScreen";
import { PassDevice } from "../components/PassDevice";
import { playMove, startLocalGame, startNextGame, type SeatSetup } from "../services/gameService";
import { Results } from "./Results";

interface LocalGameProps {
  seats: SeatSetup[];
  /** Hide the next person's hand until they say they have the device. */
  hideHands: boolean;
  onExit: () => void;
}

/** How long a bot waits before moving, so people can follow what it does. */
const BOT_MOVE_DELAY_MS = 1000;

/** The log messages since this player last did something, oldest first. */
function eventsSinceLastTurn(state: GameState, playerId: string): string[] {
  let lastOwnEntry = -1;
  state.log.forEach((entry, index) => {
    if (entry.playerId === playerId) lastOwnEntry = index;
  });
  return state.log.slice(lastOwnEntry + 1).map((entry) => entry.message);
}

/**
 * A game on this device: against bots, or passing the device between people.
 * The engine runs right here in the browser.
 */
export function LocalGame({ seats, hideHands, onExit }: LocalGameProps) {
  // Hiding hands only matters when more than one person shares the device.
  const passAndPlay = hideHands && seats.filter((seat) => !seat.bot).length > 1;
  const [state, setState] = useState<GameState>(() => startLocalGame(seats));
  const [handHidden, setHandHidden] = useState(passAndPlay);

  const currentPlayer = getPlayer(state, state.currentPlayerId);
  const people = state.players.filter((player) => !player.bot);
  // Whose hand is shown: the only person playing, or the person whose turn it is.
  const viewer = people.length === 1 ? people[0] : currentPlayer.bot ? undefined : currentPlayer;
  const canAct = state.status === "playing" && viewer?.id === currentPlayer.id && !handHidden;
  // A tie for the fewest points is broken at random, so decide once per finished game.
  const nextStarterId = useMemo(() => (state.status === "finished" ? getLoserId(state) : undefined), [state]);

  function play(move: Move, playerId: string): string | null {
    const result = playMove(state, playerId, move);
    if (!result.ok) {
      return result.error;
    }
    setState(result.state);
    setHandHidden(passAndPlay);
    return null;
  }

  // When it's a bot's turn, let it move after a short pause.
  useEffect(() => {
    const mover = getPlayer(state, state.currentPlayerId);
    const level = mover.bot;
    if (state.status !== "playing" || !level) {
      return;
    }
    const timer = setTimeout(() => play(chooseBotMove(state, mover.id, level), mover.id), BOT_MOVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <GameScreen
      state={state}
      viewerId={viewer?.id}
      canAct={canAct}
      onMove={async (move) => play(move, currentPlayer.id)}
      handCover={
        handHidden && viewer?.id === currentPlayer.id ? (
          <PassDevice
            playerName={viewer.name}
            recentEvents={eventsSinceLastTurn(state, viewer.id)}
            onReady={() => setHandHidden(false)}
          />
        ) : undefined
      }
      results={
        nextStarterId && (
          <Results
            state={state}
            nextStarterId={nextStarterId}
            onPlayAgain={() => {
              setState(startNextGame(state, nextStarterId));
              setHandHidden(passAndPlay);
            }}
            onExit={onExit}
            exitLabel="New game"
          />
        )
      }
      exitLabel="New game"
      onExit={onExit}
    />
  );
}
