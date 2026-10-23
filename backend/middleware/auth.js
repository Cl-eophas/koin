const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { recordEvent } = require("../utils/intrusion");

const getIP = (req) => req.ip || req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    let token =
      header && header.startsWith("Bearer ") ? header.slice(7) : req.cookies?.token || req.cookies?.access_token || null;
    if (!token) return res.status(401).json({ success: false, message: "No access token provided." });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      if (e.name === "TokenExpiredError")
        return res.status(401).json({
          success: false,
          message: "Access token expired. Refresh required.",
          code: "TOKEN_EXPIRED",
        });
      return res.status(401).json({ success: false, message: "Invalid token." });
    }

    const user = await User.findById(decoded.id).select("-password -refresh_token_hash -totp_secret");
    if (!user) return res.status(401).json({ success: false, message: "User not found." });
    if (!user.is_active) return res.status(401).json({ success: false, message: "Account deactivated." });
    if (user.isLocked()) return res.status(429).json({ success: false, message: "Account is locked." });

    if (user.password_changed_at) {
      const changedAt = Math.floor(user.password_changed_at.getTime() / 1000);
      if (decoded.iat < changedAt)
        return res.status(401).json({ success: false, message: "Password was changed. Please log in again." });
    }

    req.user = user;
    req.token_jti = decoded.jti;

    // Seeded / admin-created accounts must change password before using the app.
    if (user.force_password_reset) {
      const path = (req.originalUrl || req.path || "").split("?")[0];
      const allowed =
        path.endsWith("/auth/change-password") ||
        path.endsWith("/auth/logout") ||
        path.endsWith("/auth/me");
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Password change required before continuing.",
          code: "FORCE_PASSWORD_RESET",
        });
      }
    }

    next();
  } catch (err) {
    console.error("[authenticate]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/** Authenticate even if pending/inactive (for onboarding flows only). */
const authenticateAnyStatus = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    let token =
      header && header.startsWith("Bearer ") ? header.slice(7) : req.cookies?.token || req.cookies?.access_token || null;
    if (!token) return res.status(401).json({ success: false, message: "No access token provided." });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      if (e.name === "TokenExpiredError")
        return res.status(401).json({
          success: false,
          message: "Access token expired. Refresh required.",
          code: "TOKEN_EXPIRED",
        });
      return res.status(401).json({ success: false, message: "Invalid token." });
    }

    const user = await User.findById(decoded.id).select("-password -refresh_token_hash -totp_secret");
    if (!user) return res.status(401).json({ success: false, message: "User not found." });
    if (user.isLocked()) return res.status(429).json({ success: false, message: "Account is locked." });

    req.user = user;
    req.token_jti = decoded.jti;
    next();
  } catch (err) {
    console.error("[authenticateAnyStatus]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const requireRole =
  (...roles) =>
  async (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized." });
    if (!roles.includes(req.user.role)) {
      await recordEvent("privilege_escalation_attempt", {
        user_id: req.user._id,
        ip_address: getIP(req),
        user_agent: req.headers["user-agent"],
        metadata: { attempted: roles, actual: req.user.role, path: req.path },
      });
      return res.status(403).json({ success: false, message: "Forbidden. Insufficient permissions." });
    }
    next();
  };

const staffOnly = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized." });
  if (req.user.role !== "staff") return res.status(403).json({ success: false, message: "Staff access only." });
  next();
};

/** Branch supervisors inherit staff app capabilities (clock, leave, pay, etc.). General supervisors do not use this middleware. */
const staffOrSupervisor = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized." });
  if (!["staff", "supervisor"].includes(req.user.role))
    return res.status(403).json({ success: false, message: "Staff or supervisor access only." });
  next();
};

const staffSupervisorOrGeneral = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized." });
  if (!["staff", "supervisor", "general_supervisor"].includes(req.user.role)) {
    return res
      .status(403)
      .json({ success: false, message: "Staff, supervisor, or general supervisor access only." });
  }
  next();
};

module.exports = {
  authenticate,
  authenticateAnyStatus,
  requireRole,
  staffOnly,
  staffOrSupervisor,
  staffSupervisorOrGeneral,
};
