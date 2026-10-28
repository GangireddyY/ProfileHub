import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { resolveSession, tokenFrom } from '../services/sessions.js';
import { accessProblem } from '../middleware/auth.js';
import { sendMessage } from '../services/messages.js';
import { areConnected } from '../services/social.js';
import { setIo, userRoom, sessionRoom, broadcast } from './emitter.js';

/** userId -> Set of socket ids; a user is online while at least one tab/device is connected. */
const sockets = new Map();

export async function broadcastPresence(userId) {
  const user = await User.findByPk(userId);
  if (!user) return;
  broadcast('presence', {
    userId,
    online: user.visiblyOnline,
    lastSeenAt: user.showOnlineStatus ? user.lastSeenAt : null,
  });
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
  });
  setIo(io);

  // Same httpOnly session cookie as the REST API; the tab tells us which slot (account) it uses.
  io.use(async (socket, next) => {
    try {
      const token = tokenFrom(socket.handshake.headers.cookie, socket.handshake.auth?.slot);
      const found = await resolveSession(token);
      if (!found || accessProblem(found.user)) throw new Error('invalid session');
      socket.data.userId = found.user.id;
      socket.data.sessionId = found.session.id;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    socket.join(userRoom(userId));
    socket.join(sessionRoom(socket.data.sessionId));

    const isFirstSocket = !sockets.has(userId);
    if (isFirstSocket) sockets.set(userId, new Set());
    sockets.get(userId).add(socket.id);

    if (isFirstSocket) {
      await User.update({ isOnline: true }, { where: { id: userId } });
      await broadcastPresence(userId);
    }

    socket.on('message:send', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const message = await sendMessage(userId, payload?.to, payload?.body);
        reply({ ok: true, message });
      } catch (err) {
        reply({ ok: false, message: err.status ? err.message : 'Could not send message' });
      }
    });

    // Typing is throttled client-side; only forward between connected members.
    const typingAllowed = new Map();
    socket.on('typing', async ({ to, typing } = {}) => {
      if (!to || to === userId) return;
      if (!typingAllowed.has(to)) typingAllowed.set(to, await areConnected(userId, to));
      if (!typingAllowed.get(to)) return;
      io.to(userRoom(to)).emit('typing', { from: userId, typing: Boolean(typing) });
    });

    socket.on('disconnect', async () => {
      const set = sockets.get(userId);
      if (!set) return;
      set.delete(socket.id);
      if (set.size > 0) return;
      sockets.delete(userId);
      await User.update({ isOnline: false, lastSeenAt: new Date() }, { where: { id: userId } });
      await broadcastPresence(userId);
    });
  });

  return io;
}

/** After a crash/restart nobody is connected yet, so clear stale online flags. */
export async function resetPresence() {
  await User.update({ isOnline: false }, { where: { isOnline: true } });
}
