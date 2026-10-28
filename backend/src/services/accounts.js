import { Op } from 'sequelize';
import {
  sequelize,
  User,
  Connection,
  Message,
  Experience,
  Notification,
  Listing,
  ProfessionRequest,
  PlanRequest,
  Plan,
  Session,
  Block,
  Report,
  ChatClear,
  Review,
  PushSubscription,
  AuthToken,
} from '../models/index.js';
import { removeListingImages } from './listingImages.js';
import { removeChatImages } from './chatImages.js';
import { removeAvatarFile } from './avatars.js';
import { disconnectUser, broadcast } from '../socket/emitter.js';

/** Permanently removes an account with everything it owns, then signs out its live sessions. */
export async function deleteAccount(user) {
  const id = user.id;
  const listingImages = (await Listing.findAll({ where: { sellerId: id }, attributes: ['images'] })).flatMap((l) => l.images);
  const chatPhotos = (
    await Message.findAll({ where: { [Op.or]: [{ senderId: id }, { receiverId: id }], attachments: { [Op.ne]: null } }, attributes: ['attachments'] })
  ).flatMap((m) => m.attachments || []);
  await sequelize.transaction(async (transaction) => {
    await Message.destroy({ where: { [Op.or]: [{ senderId: id }, { receiverId: id }] }, transaction });
    await ChatClear.destroy({ where: { [Op.or]: [{ userId: id }, { otherId: id }] }, transaction });
    await Review.destroy({ where: { [Op.or]: [{ reviewerId: id }, { revieweeId: id }] }, transaction });
    await PushSubscription.destroy({ where: { userId: id }, transaction });
    await AuthToken.destroy({ where: { userId: id }, transaction });
    await Connection.destroy({ where: { [Op.or]: [{ requesterId: id }, { addresseeId: id }] }, transaction });
    await Notification.destroy({ where: { [Op.or]: [{ userId: id }, { actorId: id }] }, transaction });
    await Experience.destroy({ where: { userId: id }, transaction });
    await Listing.destroy({ where: { sellerId: id }, transaction });
    await ProfessionRequest.destroy({ where: { userId: id }, transaction });
    await ProfessionRequest.update({ reviewedById: null }, { where: { reviewedById: id }, transaction });
    await PlanRequest.destroy({ where: { userId: id }, transaction });
    await PlanRequest.update({ reviewedById: null }, { where: { reviewedById: id }, transaction });
    await Session.destroy({ where: { userId: id }, transaction });
    await Block.destroy({ where: { [Op.or]: [{ blockerId: id }, { blockedId: id }] }, transaction });
    // Reports stay for the admins' records, without pointing at the deleted account.
    await Report.update({ reporterId: null }, { where: { reporterId: id }, transaction });
    await Report.update({ targetUserId: null }, { where: { targetUserId: id }, transaction });
    await Report.update({ reviewedById: null }, { where: { reviewedById: id }, transaction });
    await user.destroy({ transaction });
  });
  await removeAvatarFile(user.avatarUrl);
  await removeListingImages(listingImages);
  await removeChatImages(chatPhotos);

  disconnectUser(id);
  broadcast('presence', { userId: id, online: false, lastSeenAt: null });
}

/** Everything ProfileHUB holds about a member, for "Download my data". */
export async function exportAccountData(user) {
  const id = user.id;
  const [experiences, connections, messages, listings, professionRequests, planRequests, sessions, blocks, plan] =
    await Promise.all([
      Experience.findAll({ where: { userId: id }, raw: true }),
      Connection.findAll({ where: { [Op.or]: [{ requesterId: id }, { addresseeId: id }] }, raw: true }),
      Message.findAll({ where: { [Op.or]: [{ senderId: id }, { receiverId: id }] }, order: [['createdAt', 'ASC']], raw: true }),
      Listing.findAll({ where: { sellerId: id }, raw: true }),
      ProfessionRequest.findAll({ where: { userId: id }, raw: true }),
      PlanRequest.findAll({ where: { userId: id }, include: [{ model: Plan, as: 'plan', attributes: ['name'] }] }),
      Session.findAll({ where: { userId: id }, attributes: ['userAgent', 'ip', 'createdAt', 'lastSeenAt', 'expiresAt', 'revokedAt'], raw: true }),
      Block.findAll({ where: { blockerId: id }, include: [{ model: User, as: 'blocked', attributes: ['name'] }] }),
      user.planId ? Plan.findByPk(user.planId) : null,
    ]);
  const [reviewsWritten, reviewsReceived] = await Promise.all([
    Review.findAll({ where: { reviewerId: id }, raw: true }),
    Review.findAll({ where: { revieweeId: id }, raw: true }),
  ]);

  const otherIds = new Set();
  for (const r of reviewsWritten) otherIds.add(r.revieweeId);
  for (const r of reviewsReceived) otherIds.add(r.reviewerId);
  for (const c of connections) otherIds.add(c.requesterId === id ? c.addresseeId : c.requesterId);
  for (const m of messages) otherIds.add(m.senderId === id ? m.receiverId : m.senderId);
  const names = new Map((await User.findAll({ where: { id: { [Op.in]: [...otherIds] } }, attributes: ['id', 'name'] })).map((u) => [u.id, u.name]));
  const nameOf = (otherId) => names.get(otherId) || 'Deleted member';

  return {
    exportedAt: new Date().toISOString(),
    account: { ...user.toSelf(), plan: plan?.toPublic() ?? null },
    experiences,
    connections: connections.map((c) => {
      const otherId = c.requesterId === id ? c.addresseeId : c.requesterId;
      return { with: nameOf(otherId), status: c.status, sentByYou: c.requesterId === id, since: c.respondedAt || c.createdAt };
    }),
    messages: messages.map((m) => ({
      direction: m.senderId === id ? 'sent' : 'received',
      with: nameOf(m.senderId === id ? m.receiverId : m.senderId),
      body: m.body,
      photos: (m.attachments || []).map((a) => a.url),
      sentAt: m.createdAt,
      editedAt: m.editedAt,
      deleted: Boolean(m.deletedAt),
      readAt: m.readAt,
    })),
    reviewsWritten: reviewsWritten.map((r) => ({ about: nameOf(r.revieweeId), rating: r.rating, comment: r.comment, at: r.createdAt })),
    reviewsReceived: reviewsReceived.map((r) => ({ from: nameOf(r.reviewerId), rating: r.rating, comment: r.comment, at: r.createdAt })),
    listings: listings.map(({ latitude, longitude, ...l }) => ({ ...l, pinned: latitude != null })),
    professionRequests,
    planRequests: planRequests.map((r) => ({ ...r.toPublic(), plan: r.plan?.name ?? null })),
    blockedMembers: blocks.map((b) => ({ name: b.blocked?.name ?? 'Deleted member', since: b.createdAt })),
    signInSessions: sessions,
  };
}
