const KEY = 'ph_onboarded';

export function markOnboarded(user) {
  if (user?.id) localStorage.setItem(`${KEY}:${user.id}`, '1');
}

/** New members (no profession or role yet) who haven't finished or skipped the welcome steps. */
export function needsOnboarding(user) {
  if (!user || localStorage.getItem(`${KEY}:${user.id}`)) return false;
  return user.profession === 'other' && !user.roleTitle;
}
