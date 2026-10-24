import http from 'node:http';
import { env } from './config/env.js';
import { initDb } from './models/index.js';
import { createApp } from './app.js';
import { initSocket, resetPresence } from './socket/index.js';

async function main() {
  await initDb();
  await resetPresence();

  const server = http.createServer(createApp());
  initSocket(server);

  server.listen(env.port, () => {
    console.log(`ProfileHUB API listening on http://localhost:${env.port}`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
