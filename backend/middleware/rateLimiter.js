const rateLimit = require("express-rate-limit");
const { recordEvent } = require("../utils/intrusion");

const makeLimit = (options) =>
  rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res) => {
      await recordEvent("rate_limit_breach", {
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        metadata: { path: req.path, windowMs: options.windowMs, max: options.max },
      });
      res.status(429).json({
        success: false,
        message: options.message || "Too many requests. Please slow down.",
      });
    },
  });

// Login: only FAILED attempts count. Counting successes too meant a whole branch signing in from one
// office Wi-Fi (or one mobile-carrier NAT address) at 8am shared a budget of 5 logins/minute and locked
// itself out. Targeted guessing against one account is still stopped by the per-account lockout.
const loginLimiter = makeLimit({
  windowMs: 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: "Too many failed login attempts. Wait 1 minute.",
});

// Endpoints that send email or mint tokens (signup, forgot/reset password, email verification).
// These return 200 even on "success", so every request counts — otherwise they'd be free mail-bombers.
const sensitiveLimiter = makeLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many requests. Please try again in a few minutes.",
});

const apiLimiter = makeLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});

const destructiveLimiter = makeLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: "Too many destructive actions. Slow down.",
});

const geoSearchLimiter = makeLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many map searches. Wait a moment.",
});

const geoReverseLimiter = makeLimit({
  windowMs: 1000,
  max: 1,
  message: "Too many reverse-geocode requests. Slow down.",
});

const exportLimiter = makeLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many export requests. Try again later.",
});

module.exports = { loginLimiter, sensitiveLimiter, apiLimiter, destructiveLimiter, geoSearchLimiter, geoReverseLimiter, exportLimiter };
