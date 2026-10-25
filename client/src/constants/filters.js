/** Non-linear distance scale (km) for the radius slider; `null` means "any distance". */
export const DISTANCE_STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500, null];

/** Max-rate choices; rates are compared as-is, whatever unit the member charges in. */
export const RATE_STEPS = [null, 200, 500, 1000, 2000, 5000, 10000];

export const DEFAULT_FILTERS = {
  q: '',
  professions: [],
  categories: [],
  distanceIdx: DISTANCE_STEPS.length - 1,
  onlineOnly: false,
  availableOnly: false,
  maxRate: null,
  sort: 'recommended',
};

/** Closest slider step for a radius in km (used to seed the filter from the user's default radius). */
export function stepForRadius(km) {
  if (!km) return DISTANCE_STEPS.length - 1;
  let best = 0;
  DISTANCE_STEPS.forEach((step, i) => {
    if (step != null && Math.abs(step - km) < Math.abs(DISTANCE_STEPS[best] - km)) best = i;
  });
  return best;
}
