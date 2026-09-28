# South African Casino

A digital version of the South African Casino card game: play on one device against bots or
friends, or online with other people through a private room link.

- **[RULES.md](RULES.md)**: the confirmed house rules. The engine follows this file.
- **[todo.md](todo.md)**: build progress, stage by stage.

## Project layout

```
packages/engine/   The rules engine: pure TypeScript with no UI. All game logic lives here,
                   plus the bots and the messages the browser and server exchange.
client/            React + Tailwind app. It shows the game and sends the player's moves.
server/            Express + Socket.IO game server. It runs the engine, checks every move,
                   and sends each player only their own cards.
```

## Commands

Run these from the project root:

```
npm install         install everything
npm run dev         start the game server (port 4100) and the app (http://localhost:5173)
npm test            run the engine and server tests
npm run typecheck   type-check every package
npm run build       production build of the app
npm start           run the game server, which also serves the built app (after npm run build)
```

## Trying online play on your own computer

1. `npm run dev`, then open http://localhost:5173.
2. Type your name and press **Create a room**.
3. Open the invite link in a second browser window (or a private window) and join with another name.
4. Add bots if you like, then press **Start game**.

## Putting it online (free, with Render)

You need a free [GitHub](https://github.com) account and a free [Render](https://render.com) account.

1. Create an empty repository on GitHub and push this project to it.
2. Sign in to Render with GitHub, then choose **New → Blueprint** and pick the repository.
   Render reads `render.yaml`, builds the app and starts the server.
3. When the deploy finishes, open the address Render gives you (something like
   `https://south-african-casino.onrender.com`), create a room and send the link to your friends.

Things to know about the free plan:

- The server goes to sleep after 15 minutes without visitors. The next visit wakes it up, which
  takes about a minute.
- Games are kept in the server's memory, so a game in progress is lost if the server restarts or
  goes to sleep. Saving games in MongoDB is planned for Stage 19.
