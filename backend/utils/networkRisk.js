const VPNAPI = "https://vpnapi.io/api";
const IPAPI = "http://ip-api.com/json";

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) return fwd.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "";
}

async function checkVpnProxy(ip) {
  const key = process.env.VPNAPI_KEY;
  if (!ip) return { blocked: false, flagged: false, reason: null, provider: "none" };

  if (key) {
    try {
      const r = await fetch(`${VPNAPI}/${encodeURIComponent(ip)}?key=${encodeURIComponent(key)}`);
      if (r.ok) {
        const j = await r.json();
        const sec = j?.security || {};
        const blocked = Boolean(sec.vpn || sec.proxy || sec.tor || sec.relay);
        if (blocked) {
          return { blocked: true, flagged: true, reason: "vpn_proxy_detected", provider: "vpnapi" };
        }
        return { blocked: false, flagged: false, reason: null, provider: "vpnapi" };
      }
    } catch (_) {
      // fallback below
    }
  }

  try {
    const r = await fetch(`${IPAPI}/${encodeURIComponent(ip)}?fields=proxy,hosting,status`);
    if (!r.ok) return { blocked: false, flagged: false, reason: null, provider: "ip-api" };
    const j = await r.json();
    const blocked = Boolean(j?.proxy || j?.hosting);
    return {
      blocked,
      flagged: blocked,
      reason: blocked ? "vpn_proxy_detected" : null,
      provider: "ip-api",
    };
  } catch (_) {
    return { blocked: false, flagged: false, reason: null, provider: "none" };
  }
}

module.exports = { clientIp, checkVpnProxy };

