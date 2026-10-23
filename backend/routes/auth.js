const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const auth = require("../controllers/authController");
const { authenticate, authenticateAnyStatus, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { loginLimiter, sensitiveLimiter } = require("../middleware/rateLimiter");
const { upload, verifyFileSignature } = require("../utils/upload");
const { passport } = require("../config/passport");
const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const requireGoogleEnabled = (_req, res, next) => {
  if (!googleEnabled) {
    return res.status(503).json({ success: false, message: "Google OAuth is not configured." });
  }
  return next();
};

router.post(
  "/login",
  loginLimiter,
  [
    body("identifier").optional().trim().isLength({ min: 2, max: 200 }),
    body("email").optional().trim().isLength({ min: 2, max: 200 }),
    body("password").notEmpty(),
  ],
  validate,
  auth.login
);

router.post("/refresh", [body("user_id").optional().notEmpty()], validate, auth.refresh);
router.get("/google", requireGoogleEnabled, passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get(
  "/google/callback",
  requireGoogleEnabled,
  passport.authenticate("google", { session: false, failureRedirect: "/api/auth/google/failure" }),
  auth.googleOAuthSuccess
);
router.get("/google/status", (_req, res) => {
  res.json({ success: true, data: { enabled: googleEnabled } });
});
router.get("/google/failure", (_req, res) => {
  res.status(401).json({ success: false, message: "Google authentication failed." });
});

router.post("/logout", authenticate, auth.logout);

router.get("/me", authenticate, auth.getMe);

router.get("/sessions", authenticate, auth.getSessions);

router.post(
  "/change-password",
  authenticate,
  [
    body("current_password").notEmpty(),
    body("new_password").isLength({ min: 8 }).withMessage("New password must be at least 8 characters."),
  ],
  validate,
  auth.changePassword
);

router.post(
  "/register",
  authenticate,
  requireRole("admin"),
  [
    body("name").trim().notEmpty(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
    body("role").optional().isIn(["admin", "general_supervisor", "supervisor", "staff"]),
  ],
  validate,
  auth.register
);

// Public onboarding signup (pending by default)
router.post(
  "/signup",
  sensitiveLimiter,
  [
    body("fullName").trim().isLength({ min: 2, max: 120 }),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
    body("phone").optional().trim().isLength({ min: 7, max: 40 }),
    body("idNumber").optional().trim().isLength({ min: 3, max: 40 }),
    body("kraPin").optional().trim().isLength({ min: 3, max: 40 }),
    body("nssf").optional().trim().isLength({ min: 3, max: 40 }),
    body("nhif").optional().trim().isLength({ min: 3, max: 40 }),
    body("bankName").optional().trim().isLength({ min: 2, max: 120 }),
    body("bankBranch").optional().trim().isLength({ min: 2, max: 120 }),
    body("accountNumber").optional().trim().isLength({ min: 4, max: 40 }),
    body("role").not().exists().withMessage("Role assignment is not allowed at signup."),
  ],
  validate,
  auth.signup
);

// Complete profile for pending users (e.g. google sign-in onboarding)
router.post(
  "/complete-profile",
  authenticateAnyStatus,
  [
    body("phone").trim().isLength({ min: 7, max: 40 }),
    body("idNumber").trim().isLength({ min: 3, max: 40 }),
    body("kraPin").trim().isLength({ min: 3, max: 40 }),
    body("nssf").trim().isLength({ min: 3, max: 40 }),
    body("nhif").trim().isLength({ min: 3, max: 40 }),
    body("bankName").trim().isLength({ min: 2, max: 120 }),
    body("bankBranch").trim().isLength({ min: 2, max: 120 }),
    body("accountNumber").trim().isLength({ min: 4, max: 40 }),
  ],
  validate,
  auth.completeProfile
);

// ─── Email-based password reset ────────────────────────────────────────────
router.post(
  "/forgot-password",
  sensitiveLimiter,
  [body("email").isEmail().withMessage("A valid email is required.")],
  validate,
  auth.forgotPassword
);

router.post(
  "/reset-password",
  sensitiveLimiter,
  [
    body("uid").notEmpty(),
    body("token").notEmpty(),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters."),
  ],
  validate,
  auth.resetPassword
);

// ─── Email ownership verification ──────────────────────────────────────────
router.post(
  "/verify-email",
  sensitiveLimiter,
  [body("uid").isMongoId(), body("token").isString().isLength({ min: 20, max: 200 })],
  validate,
  auth.verifyEmail
);

router.post(
  "/resend-verification",
  sensitiveLimiter,
  [body("email").isEmail().withMessage("A valid email is required.")],
  validate,
  auth.resendVerification
);

// ─── Onboarding document upload ────────────────────────────────────────────
router.post(
  "/upload-document",
  authenticateAnyStatus,
  upload.single("document"),
  verifyFileSignature,
  [body("doc_type").isIn(["national_id", "kra_pin_certificate", "profile_photo"])],
  validate,
  auth.uploadOnboardingDocument
);

module.exports = router;
