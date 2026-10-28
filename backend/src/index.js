import http from 'node:http';
import { env } from './config/env.js';
import { initDb } from './models/index.js';
import { createApp } from './app.js';
import { initSocket, resetPresence } from './socket/index.js';

async function main() {
  await initDb();
  await resetPresence();

  const server = http.createServer(createApp());
  const io = initSocket(server);

  server.listen(env.port, () => {
    console.log(`ProfileHUB API listening on http://localhost:${env.port}`);
  });

  // Sockets and keep-alive connections never close on their own, so a plain server.close()
  // can hang and keep the port busy, which breaks watch-mode restarts.
  const shutdown = () => {
    setTimeout(() => process.exit(0), 3000).unref();
    io.close();
    server.close(() => process.exit(0));
    server.closeAllConnections();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
