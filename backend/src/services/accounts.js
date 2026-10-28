import { Op } from 'sequelize';
import { sequelize, Connection, Message, Experience, Notification, Listing, ProfessionRequest } from '../models/index.js';
import { removeListingImages } from './listingImages.js';
import { removeAvatarFile } from './avatars.js';
import { disconnectUser, broadcast } from '../socket/emitter.js';

/** Permanently removes an account with everything it owns, then signs out its live sessions. */
export async function deleteAccount(user) {
  const id = user.id;
  const listingImages = (await Listing.findAll({ where: { sellerId: id }, attributes: ['images'] })).flatMap((l) => l.images);
  await sequelize.transaction(async (transaction) => {
    await Message.destroy({ where: { [Op.or]: [{ senderId: id }, { receiverId: id }] }, transaction });
    await Connection.destroy({ where: { [Op.or]: [{ requesterId: id }, { addresseeId: id }] }, transaction });
    await Notification.destroy({ where: { [Op.or]: [{ userId: id }, { actorId: id }] }, transaction });
    await Experience.destroy({ where: { userId: id }, transaction });
    await Listing.destroy({ where: { sellerId: id }, transaction });
    await ProfessionRequest.destroy({ where: { userId: id }, transaction });
    await ProfessionRequest.update({ reviewedById: null }, { where: { reviewedById: id }, transaction });
    await user.destroy({ transaction });
  });
  await removeAvatarFile(user.avatarUrl);
  await removeListingImages(listingImages);

  disconnectUser(id);
  broadcast('presence', { userId: id, online: false, lastSeenAt: null });
}
