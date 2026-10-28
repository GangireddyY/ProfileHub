import { t, intlLocale } from '@/i18n';

const relativeFormats = new Map();
const rtf = () => {
  const locale = intlLocale();
  if (!relativeFormats.has(locale)) relativeFormats.set(locale, new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }));
  return relativeFormats.get(locale);
};

export function timeAgo(date) {
  if (!date) return '';
  const diff = (new Date(date).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return t('common.justNow');
  const units = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2629800],
    ['year', 31557600],
  ];
  let unit = units[0];
  for (const u of units) if (abs >= u[1]) unit = u;
  return rtf().format(Math.round(diff / unit[1]), unit[0]);
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString(intlLocale(), { hour: 'numeric', minute: '2-digit' });
}

export function formatDay(date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return t('common.today');
  if (d.toDateString() === yesterday.toDateString()) return t('common.yesterday');
  return d.toLocaleDateString(intlLocale(), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

/** Compact chat-list stamp: time today, weekday this week, date otherwise. */
export function formatStamp(date) {
  const d = new Date(date);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return formatTime(d);
  const days = (now - d) / 86400000;
  if (days < 7) return d.toLocaleDateString(intlLocale(), { weekday: 'short' });
  return d.toLocaleDateString(intlLocale(), { month: 'short', day: 'numeric' });
}

export function formatDistance(km) {
  if (km == null) return '';
  if (km < 1) return t('common.mAway', { m: Math.max(100, Math.round((km * 1000) / 100) * 100) });
  return t('common.kmAway', { km: km < 10 ? km.toFixed(1) : Math.round(km) });
}

const moneyFormats = new Map();
export function formatMoney(amount, currency = 'INR') {
  if (amount == null) return '';
  if (!moneyFormats.has(currency)) {
    moneyFormats.set(
      currency,
      new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : undefined, { style: 'currency', currency, maximumFractionDigits: 0 }),
    );
  }
  return moneyFormats.get(currency).format(amount);
}

const RATE_SHORT = { hour: 'hr', day: 'day', job: 'job', month: 'month' };
/** '₹350/hr' for a member's rate, or '' when they haven't set one. */
export function formatRate(user) {
  if (!user?.rateAmount) return '';
  return `${formatMoney(user.rateAmount, user.currency)}/${RATE_SHORT[user.rateUnit] || user.rateUnit}`;
}

export function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n ?? 0);
}

export function lastSeenLabel(online, lastSeenAt) {
  if (online) return t('common.online');
  if (!lastSeenAt) return t('common.offline');
  return t('common.activeAgo', { time: timeAgo(lastSeenAt) });
}

/** '2024-03' -> 'Mar 2024' */
export function formatMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/** Inclusive month span, e.g. '2 yrs 3 mos'. */
export function formatDuration(start, end) {
  if (!start) return '';
  const [sy, sm] = start.split('-').map(Number);
  const now = new Date();
  const [ey, em] = end ? end.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const total = Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
  const years = Math.floor(total / 12);
  const months = total % 12;
  return [years && `${years} yr${years > 1 ? 's' : ''}`, months && `${months} mo${months > 1 ? 's' : ''}`]
    .filter(Boolean)
    .join(' ');
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function hashHue(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}
