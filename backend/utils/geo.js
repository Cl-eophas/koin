const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isWithinGeofence = (uLat, uLon, bLat, bLon, radiusMeters) => {
  const distance = haversineDistance(uLat, uLon, bLat, bLon);
  return { withinFence: distance <= radiusMeters, distance: Math.round(distance) };
};

// The geofence radius of a branch: the value the admin sets (radius_meters), with fallbacks
// for older records. Clock-in, the dashboard and reports all use this single helper.
const branchRadius = (b) => {
  const r = Number(b?.radius_meters || b?.clockInRadius || 1000);
  return Number.isFinite(r) && r > 0 ? r : 1000;
};

module.exports = { haversineDistance, isWithinGeofence, branchRadius };
