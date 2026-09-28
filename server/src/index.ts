import { createGameServer } from "./app";

// Hosting services such as Render tell the server which port to use through PORT.
// On your own computer it uses 4100 (client/vite.config.ts sends /socket.io there).
const port = Number(process.env.PORT) || 4100;

const server = createGameServer();
const actualPort = await server.listen(port);
console.log(`South African Casino server running on http://localhost:${actualPort}`);
