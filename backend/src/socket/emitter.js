let io = null;

export const userRoom = (userId) => `user:${userId}`;

export function setIo(instance) {
  io = instance;
}

export function emitToUser(userId, event, payload) {
  io?.to(userRoom(userId)).emit(event, payload);
}

/** True while the member has at least one tab or device connected. */
export function isUserConnected(userId) {
  return Boolean(io?.sockets.adapter.rooms.get(userRoom(userId))?.size);
}

export function broadcast(event, payload) {
  io?.emit(event, payload);
}

export const sessionRoom = (sessionId) => `session:${sessionId}`;

/** Force every open tab/device of a user to reconnect (and re-authenticate). */
export function disconnectUser(userId) {
  io?.in(userRoom(userId)).disconnectSockets(true);
}

/** Close the live connections that belong to one signed-in session. */
export function disconnectSession(sessionId) {
  io?.in(sessionRoom(sessionId)).disconnectSockets(true);
}
