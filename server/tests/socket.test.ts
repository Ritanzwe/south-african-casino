import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import {
  getLegalMoves,
  type ClientToServerEvents,
  type PlayerView,
  type ServerToClientEvents,
} from "@sa-casino/engine";
import { createGameServer } from "../src/app";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: ReturnType<typeof createGameServer>;
let url = "";
const clients: ClientSocket[] = [];

beforeAll(async () => {
  server = createGameServer({ botDelayMs: 0 });
  url = `http://localhost:${await server.listen(0)}`;
});

afterAll(async () => {
  clients.forEach((client) => client.disconnect());
  await server.close();
});

function newClient(): ClientSocket {
  const client: ClientSocket = connect(url, { transports: ["websocket"], forceNew: true });
  clients.push(client);
  return client;
}

/** Plays the first legal move whenever it's this player's turn. Resolves with the last view once the game ends. */
function playUntilTheEnd(client: ClientSocket, playerId: string, views: PlayerView[]): Promise<PlayerView> {
  return new Promise((resolve) => {
    let playedAtLogLength = -1;
    client.on("game:update", (view) => {
      views.push(view);
      if (view.status === "finished") {
        resolve(view);
      } else if (view.currentPlayerId === playerId && view.log.length > playedAtLogLength) {
        playedAtLogLength = view.log.length;
        client.emit("game:move", { move: getLegalMoves(view, playerId)[0] }, () => {});
      }
    });
  });
}

describe("an online game", () => {
  it("lets two people and a bot play a whole game without seeing each other's cards", async () => {
    const ann = newClient();
    const ben = newClient();

    const created = await ann.emitWithAck("room:create", { name: "Ann" });
    if (!created.ok) throw new Error(created.error);
    const joined = await ben.emitWithAck("room:join", { code: created.code.toLowerCase(), name: "Ben" });
    if (!joined.ok) throw new Error(joined.error);
    expect(joined.playerId).toBe("p2");

    expect(await ann.emitWithAck("room:addBot", { level: "medium" })).toEqual({ ok: true });
    expect(await ben.emitWithAck("game:start", {})).toEqual({ ok: false, error: "Only the host can do that." });

    const annViews: PlayerView[] = [];
    const benViews: PlayerView[] = [];
    const annFinished = playUntilTheEnd(ann, "p1", annViews);
    const benFinished = playUntilTheEnd(ben, "p2", benViews);
    expect(await ann.emitWithAck("game:start", {})).toEqual({ ok: true });

    const [annLast, benLast] = await Promise.all([annFinished, benFinished]);
    expect(annLast.status).toBe("finished");
    expect(benLast.log).toEqual(annLast.log);

    // Nobody ever received another player's cards or the deck.
    for (const [viewerId, views] of [["p1", annViews], ["p2", benViews]] as const) {
      for (const view of views) {
        expect(view.players.filter((p) => p.id !== viewerId).every((p) => p.hand.length === 0)).toBe(true);
        expect(view.deck).toEqual([]);
      }
    }
  }, 20_000);

  it("refuses moves that break the rules", async () => {
    const ann = newClient();
    const ben = newClient();
    const created = await ann.emitWithAck("room:create", { name: "Ann" });
    if (!created.ok) throw new Error(created.error);
    await ben.emitWithAck("room:join", { code: created.code, name: "Ben" });

    const firstView = new Promise<PlayerView>((resolve) => ben.once("game:update", resolve));
    await ann.emitWithAck("game:start", {});
    const view = await firstView;
    const waitingPlayer = view.currentPlayerId === "p2" ? ann : ben;
    const reply = await waitingPlayer.emitWithAck("game:move", { move: { action: "DRIFT", cardId: "A-spades" } });
    expect(reply).toEqual({ ok: false, error: "It's not your turn." });
  });

  it("gives a person their seat back when they reconnect", async () => {
    const first = newClient();
    const created = await first.emitWithAck("room:create", { name: "Ann" });
    if (!created.ok) throw new Error(created.error);
    first.disconnect();

    const again = newClient();
    const rejoined = await again.emitWithAck("room:join", { code: created.code, token: created.token });
    expect(rejoined).toMatchObject({ ok: true, playerId: "p1" });
  });

  it("answers nonsense with an error instead of crashing", async () => {
    const client = newClient();
    expect(await client.emitWithAck("game:move", { move: { action: "CHEAT" } } as never)).toMatchObject({ ok: false });
    expect(await client.emitWithAck("room:join", { code: 42 } as never)).toMatchObject({ ok: false });
    expect(await client.emitWithAck("room:addBot", { level: "genius" } as never)).toMatchObject({ ok: false });
  });
});
