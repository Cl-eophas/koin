const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Session = require("../models/Session");

const ACCESS_TTL = "15m";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const signAccess = (userId, role) => {
  const jti = crypto.randomBytes(16).toString("hex");
  return {
    token: jwt.sign({ id: userId, role, jti }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL }),
    jti,
  };
};

const issueRefreshToken = async (userId, ipAddress, userAgent) => {
  const raw = crypto.randomBytes(40).toString("hex");
  const hash = await bcrypt.hash(raw, 10);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const deviceFingerprint = crypto.createHash("sha256").update(`${ipAddress}:${userAgent}`).digest("hex");
  const token_id = crypto.randomBytes(16).toString("hex");

  await Session.create({
    user_id: userId,
    token_id,
    ip_address: ipAddress,
    user_agent: userAgent,
    device_fingerprint: deviceFingerprint,
    expires_at: expiresAt,
  });

  const User = require("../models/User");
  await User.findByIdAndUpdate(userId, { refresh_token_hash: hash });

  return { raw, expiresAt };
};

const verifyRefreshToken = async (userId, rawToken) => {
  const User = require("../models/User");
  const user = await User.findById(userId).select("+refresh_token_hash");
  if (!user || !user.refresh_token_hash) return false;
  return bcrypt.compare(rawToken, user.refresh_token_hash);
};

const revokeAllSessions = async (userId) => {
  await Session.updateMany({ user_id: userId }, { is_revoked: true });
  const User = require("../models/User");
  await User.findByIdAndUpdate(userId, { refresh_token_hash: null });
};

const setRefreshCookie = (res, rawToken, expiresAt, userId) => {
  // Embed user id so /auth/refresh can restore a session from the cookie alone
  // (access token is memory-only and lost on refresh).
  const value = userId ? `${userId}.${rawToken}` : rawToken;
  res.cookie("wms_refresh", value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: expiresAt,
    path: "/api/auth/refresh",
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie("wms_refresh", { path: "/api/auth/refresh" });
};

module.exports = {
  signAccess,
  issueRefreshToken,
  verifyRefreshToken,
  revokeAllSessions,
  setRefreshCookie,
  clearRefreshCookie,
};
