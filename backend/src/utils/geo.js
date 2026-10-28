const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

export function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Cheap rectangular pre-filter so the database can use the lat/lng index before the exact haversine check. */
export function boundingBox(lat, lng, radiusKm) {
  const dLat = radiusKm / 111.32;
  const cosLat = Math.max(Math.cos(toRad(lat)), 0.01);
  const dLng = radiusKm / (111.32 * cosLat);
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

export function distanceBetween(a, b) {
  if (!a?.hasLocation || !b?.hasLocation) return null;
  const km = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
  return Math.round(km * 10) / 10;
}
