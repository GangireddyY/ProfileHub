import { User } from '../models/User.js';
import { Message } from '../models/Message.js';
import { CATEGORY_OF_TYPE, wants } from '../constants/notifyPrefs.js';
import { sendEmail, appLink } from './mailer.js';
import { sendPush } from './push.js';
import { isUserConnected } from '../socket/emitter.js';

/**
 * Turns an in-app notification into the text used for email and push.
 * Returns null for types that only make sense inside the app.
 */
export function describeNotification({ type, actorName = 'Someone', data = {}, actorId, userId }) {
  const d = data || {};
  switch (type) {
    case 'connection_request':
      return { title: `${actorName} wants to connect`, body: 'Accept or decline the invitation in My network.', url: '/network', button: 'Open invitations' };
    case 'connection_accepted':
      return { title: `${actorName} accepted your invitation`, body: 'You are now connected and can message each other.', url: `/u/${actorId}`, button: 'View profile' };
    case 'review_new':
      return {
        title: `${actorName} rated you ${d.rating ?? ''}★`.trim(),
        body: d.comment ? `“${String(d.comment).slice(0, 160)}”` : 'See the review on your profile.',
        url: `/u/${userId}`,
        button: 'See your reviews',
      };
    case 'plan_approved':
      return { title: `Your ${d.planName || 'plan'} request was approved`, body: d.note || 'The new plan features are active on your account now.', url: '/plans', button: 'View your plan' };
    case 'plan_rejected':
      return { title: `Your ${d.planName || 'plan'} request was declined`, body: d.note || 'You can send a new request from the Plans page.', url: '/plans', button: 'View plans' };
    case 'plan_expiring':
      return { title: `Your ${d.planName || 'plan'} ends soon`, body: d.endsAt ? `It ends on ${new Date(d.endsAt).toDateString()}. Ask for a renewal to keep its features.` : 'Ask for a renewal to keep its features.', url: '/plans', button: 'Renew plan' };
    case 'plan_expired':
      return { title: `Your ${d.planName || 'plan'} has ended`, body: `Your account is back on the ${d.fallbackName || 'free'} plan. You can request a plan again at any time.`, url: '/plans', button: 'View plans' };
    case 'account_approved':
      return { title: 'Your ProfileHUB account is approved', body: 'Welcome! You can sign in now and start building your network.', url: '/login', button: 'Sign in' };
    case 'profession_approved':
      return { title: 'Your profession was added', body: d.label ? `“${d.label}” is now in the list.` : 'It is now available in the list.', url: '/settings', button: 'Open settings' };
    case 'profession_rejected':
      return { title: d.label ? `Your request for “${d.label}” was declined` : 'Your profession request was declined', body: d.note || 'You can pick the closest profession from the list in Settings.', url: '/settings', button: 'Open settings' };
    case 'listing_removed':
      return {
        title: `Your listing “${d.title || 'listing'}” was ${d.action === 'deleted' ? 'removed' : 'hidden'} by an admin`,
        body: d.reason ? `Reason: ${d.reason}` : 'It did not follow the marketplace rules.',
        url: '/market?mine=1',
        button: 'Open the marketplace',
      };
    case 'signup_request':
      return { title: `${actorName} signed up and is waiting for approval`, body: 'Review the new account in the admin panel.', url: '/admin?tab=approvals', button: 'Review sign-ups' };
    case 'report_new':
      return { title: `New report: ${d.targetType || 'content'} (${d.reason || 'other'})`, body: `${actorName} reported something for review.`, url: '/admin?tab=reports', button: 'Open reports' };
    case 'plan_request':
      return { title: `${actorName} asked for a plan`, body: 'Approve or decline it in the admin panel.', url: '/admin?tab=plan-requests', button: 'Open plan requests' };
    case 'profession_request':
      return { title: `${actorName} asked for a new profession`, body: 'Approve or decline it in the admin panel.', url: '/admin?tab=requests', button: 'Open requests' };
    default:
      return null;
  }
}

const canEmail = (user) => Boolean(user?.email && user.emailVerifiedAt);

/** Email + push for an in-app notification, following the recipient's preferences. Never throws. */
export async function deliverNotification(notification, actor) {
  try {
    const category = CATEGORY_OF_TYPE[notification.type];
    if (!category) return;
    const user = await User.findByPk(notification.userId);
    if (!user || (category !== 'account' && !user.isActiveMember)) return;
    const text = describeNotification({
      type: notification.type,
      actorName: actor?.name,
      actorId: notification.actorId,
      userId: notification.userId,
      data: notification.data,
    });
    if (!text) return;

    const jobs = [];
    if (wants(user, 'push', category)) {
      jobs.push(sendPush(user.id, { title: text.title, body: text.body, url: text.url, tag: `${notification.type}:${notification.entityId || notification.id}` }));
    }
    // "Approved" must reach people who can't sign in yet, so it skips the verified-address rule.
    const essential = notification.type === 'account_approved';
    if (wants(user, 'email', category) && (canEmail(user) || essential)) {
      jobs.push(
        sendEmail({
          to: user.email,
          subject: text.title,
          heading: text.title,
          lines: [`Hi ${user.name},`, text.body],
          button: { label: text.button || 'Open ProfileHUB', url: appLink(text.url) },
        }),
      );
    }
    await Promise.all(jobs);
  } catch (err) {
    console.warn(`Could not deliver notification ${notification.id}: ${err.message}`);
  }
}

/** One email per conversation at most every 30 minutes, so a busy chat doesn't flood the inbox. */
const EMAIL_GAP_MS = 30 * 60 * 1000;
/** Wait this long before emailing, in case the member reads the message in the app first. */
const EMAIL_DELAY_MS = 2 * 60 * 1000;
const lastMessageEmail = new Map();

const preview = (message) => {
  if (message.body) return message.body.length > 140 ? `${message.body.slice(0, 140)}…` : message.body;
  const photos = message.attachments?.length || 0;
  return photos ? `📷 ${photos > 1 ? `${photos} photos` : 'Photo'}` : 'New message';
};

/** Push right away when the receiver has no open tab; email later if it's still unread. Never throws. */
export async function deliverMessage(sender, message) {
  try {
    const receiver = await User.findByPk(message.receiverId);
    if (!receiver?.isActiveMember) return;
    const url = `/messages/${sender.id}`;
    if (!isUserConnected(receiver.id) && wants(receiver, 'push', 'messages')) {
      await sendPush(receiver.id, { title: sender.name, body: preview(message), url, tag: `chat:${sender.id}` });
    }
    if (!wants(receiver, 'email', 'messages') || !canEmail(receiver)) return;
    const key = `${sender.id}:${receiver.id}`;
    const last = lastMessageEmail.get(key) || 0;
    if (Date.now() - last < EMAIL_GAP_MS) return;
    lastMessageEmail.set(key, Date.now());

    setTimeout(async () => {
      try {
        const fresh = await Message.findByPk(message.id);
        if (!fresh || fresh.readAt || fresh.deletedAt) {
          lastMessageEmail.delete(key);
          return;
        }
        const unread = await Message.count({ where: { senderId: sender.id, receiverId: receiver.id, readAt: null, deletedAt: null } });
        await sendEmail({
          to: receiver.email,
          subject: `${sender.name} sent you ${unread > 1 ? `${unread} messages` : 'a message'}`,
          heading: `New message from ${sender.name}`,
          lines: [`Hi ${receiver.name},`, preview(fresh), 'Reply on ProfileHUB. Never share OTPs, passwords or bank details in chat.'],
          button: { label: 'Reply', url: appLink(url) },
        });
      } catch (err) {
        console.warn(`Message email failed: ${err.message}`);
      }
    }, EMAIL_DELAY_MS).unref();
  } catch (err) {
    console.warn(`Could not deliver message ${message.id}: ${err.message}`);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, at] of lastMessageEmail) if (now - at > EMAIL_GAP_MS) lastMessageEmail.delete(key);
}, 10 * 60 * 1000).unref();
