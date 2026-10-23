const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "koin-WMS/1.0 (internal branch setup; +https://openstreetmap.org/copyright)",
  "Accept-Language": "en",
};

const trimDisplayName = (display) => {
  const parts = String(display || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  const noCountry = /kenya/i.test(parts[parts.length - 1]) ? parts.slice(0, -1) : parts;
  return noCountry.slice(0, 5).join(", ");
};

/**
 * Proxy Nominatim (OSM) search — admin only. Respects usage policy via User-Agent.
 */
exports.searchPlaces = async (req, res) => {
  try {
    let q = String(req.query.q || "").trim();
    if (q.length < 3)
      return res.status(400).json({ success: false, message: "Search query must be at least 3 characters." });
    if (q.length > 200)
      return res.status(400).json({ success: false, message: "Search query too long (max 200)." });
    if (/[$]|\.\./.test(q))
      return res.status(400).json({ success: false, message: "Invalid characters in search query." });

    // Improve accuracy by requesting address + limiting results.
    // Nominatim is often "too global" without country scoping; default to Kenya unless explicitly overridden.
    const countrycodesRaw =
      process.env.NOMINATIM_COUNTRYCODES !== undefined
        ? String(process.env.NOMINATIM_COUNTRYCODES).trim()
        : "ke";
    const cc = countrycodesRaw ? `&countrycodes=${encodeURIComponent(countrycodesRaw)}` : "";

    // Extra knobs: namedetails + extratags help with POIs like malls.
    const baseParams = "&format=json&limit=10&addressdetails=1&namedetails=1&extratags=1";

    async function doSearch(query, countryParam) {
      const url = `${NOMINATIM}?q=${encodeURIComponent(query)}${baseParams}${countryParam || ""}`;
      const r = await fetch(url, { headers: NOMINATIM_HEADERS });
      if (!r.ok) return { ok: false, status: r.status, raw: [] };
      const raw = await r.json();
      return { ok: true, raw: Array.isArray(raw) ? raw : [] };
    }

    // Attempt 1: scoped to country (default ke)
    let out = await doSearch(q, cc);
    if (!out.ok) {
      return res.status(502).json({ success: false, message: "Geocoding service temporarily unavailable." });
    }

    // If no results, fall back to broader search (no countrycodes) and also try adding ", Kenya".
    if (out.raw.length === 0) {
      const broaden = await doSearch(q, "");
      if (broaden.ok && broaden.raw.length) out = broaden;
      else {
        const withKenya = /kenya/i.test(q) ? null : await doSearch(`${q}, Kenya`, "");
        if (withKenya && withKenya.ok && withKenya.raw.length) out = withKenya;
      }
    }

    const raw = out.raw;

    const data = raw.map((item) => ({
      display_name: trimDisplayName(item.display_name),
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      place_id: item.place_id,
      type: item.type,
      address: item.address || {},
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error("[geo.searchPlaces]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * Reverse geocode proxy for admin/staff geolocation UX.
 */
exports.reversePlace = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ success: false, message: "Invalid lat/lon.", code: "ERR_INVALID_COORDS" });
    }
    const url = `${NOMINATIM_REVERSE}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1`;
    const r = await fetch(url, { headers: NOMINATIM_HEADERS });
    if (!r.ok) {
      return res.status(502).json({ success: false, message: "Geocoding service unavailable.", code: "ERR_GEOCODE_DOWN" });
    }
    const j = await r.json();
    return res.json({
      success: true,
      data: {
        display_name: trimDisplayName(j?.display_name || ""),
        raw_display_name: j?.display_name || "",
      },
    });
  } catch (err) {
    console.error("[geo.reversePlace]", err);
    return res.status(500).json({ success: false, message: "Server error.", code: "ERR_SERVER" });
  }
};
