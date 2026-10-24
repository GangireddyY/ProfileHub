let io = null;

export const userRoom = (userId) => `user:${userId}`;

export function setIo(instance) {
  io = instance;
}

export function emitToUser(userId, event, payload) {
  io?.to(userRoom(userId)).emit(event, payload);
}

export function broadcast(event, payload) {
  io?.emit(event, payload);
}
