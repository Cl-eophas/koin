
const crypto = require("crypto");
const validator = require("validator");
const fs = require("fs");
const path = require("path");
const { uploadDir } = require("../utils/upload");
const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const LeaveBalance = require("../models/LeaveBalance");
const Session = require("../models/Session");
const SecurityEvent = require("../models/SecurityEvent");
const Notification = require("../models/Notification");
const { signAccess, issueRefreshToken, verifyRefreshToken,
        revokeAllSessions, setRefreshCookie, clearRefreshCookie } = require("../utils/tokens");
const { validatePassword } = require("../utils/passwordPolicy");
const { isNewDevice, recordEvent } = require("../utils/intrusion");
const { calcAnnualLeaveAccrual } = require("../utils/dateHelpers");
const { nextYPStaffId } = require("../utils/staffId");
const { nextYPStaffIdV2 } = require("../utils/staffIdV2");
const { resolveVerificationStatus, verificationPayload } = require("../utils/profileVerification");
const {
  normalizeEmploymentForRole,
  requiresFixedBranch,
  assertActiveBranch,
  staffProfileTypeFor,
} = require("../utils/branchEmployment");

const getIP = (req) => req.ip || req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
const getUA = (req) => req.headers["user-agent"] || "unknown";

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
exports.login = async (req, res) => {
  const ip = getIP(req);
  const ua = getUA(req);
  const identifier = (req.body.identifier || req.body.email || "").toString();
  const { password } = req.body;

  if (!identifier || !password)
    return res.status(400).json({ success: false, message: "identifier (email or staffId) and password required." });

  try {
    const identTrim = identifier.trim();
    const isEmail = /@/.test(identTrim);
    const query = isEmail ? { email: { $in: emailCandidates(identTrim) } } : { staffId: identTrim.toUpperCase() };
    const user = await User.findOne(query).select("+refresh_token_hash");

    // Always take the same time path to prevent user enumeration
    if (!user) {
      await new Promise(r => setTimeout(r, 300)); // constant-time delay
      await recordEvent("failed_login", { email: identTrim, ip_address: ip, user_agent: ua });
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }
    if (user.deleted_at) {
      return res.status(403).json({ success: false, message: "Account unavailable. Contact admin." });
    }

    // Lockout check
    if (user.isLocked()) {
      const remaining = Math.ceil((user.lockout_until - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Account locked. Try again in ${remaining} minute(s).`,
      });
    }

    const passwordOk = await user.comparePassword(password);
    if (!passwordOk) {
      await user.recordFailedLogin();
      if (user.failed_login_attempts >= 5) {
        await recordEvent("account_lockout", {
          user_id: user._id, email: user.email, ip_address: ip, user_agent: ua,
          metadata: { attempts: user.failed_login_attempts },
        });
        return res.status(429).json({
          success: false,
          message: "Too many failed attempts. Account locked for 15 minutes.",
        });
      }
      await recordEvent("failed_login", { user_id: user._id, email: user.email, ip_address: ip, user_agent: ua });
      return res.status(401).json({
        success: false,
        message: `Invalid credentials. ${5 - user.failed_login_attempts} attempt(s) remaining.`,
      });
    }

    const effectiveStatus = user.status || (user.is_active ? "approved" : "pending");
    if (user.status !== effectiveStatus) {
      user.status = effectiveStatus;
      await user.save({ validateModifiedOnly: true });
    }

    if (effectiveStatus === "rejected") {
      return res.status(403).json({
        success: false,
        message: "Your account registration was rejected. Contact admin if you believe this is an error.",
        code: "ACCOUNT_REJECTED",
        status: effectiveStatus,
      });
    }
    if (effectiveStatus !== "approved" || !user.is_active) {
      return res.status(403).json({
        success: false,
        message: effectiveStatus === "pending" ? "Account pending approval." : "Account not approved.",
        code: "NOT_APPROVED",
        status: effectiveStatus,
      });
    }
    if (!user.role) {
      return res.status(403).json({
        success: false,
        message: "Account approved but role assignment is missing. Contact admin.",
        code: "ROLE_NOT_ASSIGNED",
      });
    }

    // Reset failed attempts on success
    await user.resetLoginAttempts();

    if (["staff", "supervisor"].includes(user.role) && !user.employment_type) {
      const sp = await StaffProfile.findOne({ user_id: user._id });
      if (sp) {
        user.employment_type = user.role === "supervisor" ? "supervisor" : sp.type;
        await user.save({ validateModifiedOnly: true });
      }
    }

    // Anomaly: new device detection
    const newDevice = await isNewDevice(user._id, ip, ua);
    if (newDevice && user.role === "admin") {
      await recordEvent("new_device", {
        user_id: user._id, ip_address: ip, user_agent: ua,
        metadata: { role: user.role },
      });
    }

    // Issue tokens
    const { token: accessToken, jti } = signAccess(user._id, user.role);
    const { raw: refreshToken, expiresAt } = await issueRefreshToken(user._id, ip, ua);

    // Update last login meta
    user.last_ip = ip;
    user.last_login = new Date();
    await user.save({ validateModifiedOnly: true });

    // Sync leave balance for staff
    if (user.role === "staff") {
      const profile = await StaffProfile.findOne({ user_id: user._id });
      if (profile) {
        const totalAccrued = calcAnnualLeaveAccrual(profile.join_date);
        let bal = await LeaveBalance.findOne({ staff_id: user._id });
        if (!bal) {
          await LeaveBalance.create({ staff_id: user._id, annual_balance: totalAccrued });
        } else {
          const used = Math.max(0, totalAccrued - bal.annual_balance);
          bal.annual_balance = Math.max(0, totalAccrued - used);
          await bal.save();
        }
      }
    }

    setRefreshCookie(res, refreshToken, expiresAt, user._id);

    const v = resolveVerificationStatus(user);
    const profileBanner =
      !user.profileCompleted
        ? "⚠️ Complete your profile"
        : v.status === "pending"
          ? "⏳ Waiting for admin verification"
          : v.status === "rejected"
            ? `❌ Verification failed: ${v.reason || "See admin feedback"}`
            : v.status === "verified"
              ? null
              : "⚠️ Your profile is incomplete. Complete verification to enable payroll.";

    return res.json({
      success: true,
      message: user.force_password_reset
        ? "Login successful. You must change your password before continuing."
        : "Login successful.",
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 900, // 15 min in seconds
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id,
        branch: user.branch || user.branch_id || null,
        force_password_reset: Boolean(user.force_password_reset),
        new_device_warning: newDevice && user.role === "admin",
        profile_warning: profileBanner,
        ...verificationPayload(user),
      },
    });
  } catch (err) {
    console.error("[login]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── POST /api/auth/signup  (public onboarding) ───────────────────────────────
exports.signup = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
    } = req.body;

    if (!fullName || !email || !password)
      return res.status(400).json({ success: false, message: "fullName, email, and password required." });

    const { valid, errors } = validatePassword(password);
    if (!valid) return res.status(400).json({ success: false, message: "Password policy failed.", errors });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(400).json({ success: false, message: "Email already in use." });

    const staffId = await nextYPStaffIdV2();

    const user = await User.create({
      staffId,
      name: String(fullName).trim(),
      email: email.toLowerCase().trim(),
      password,
      // Keep role unassigned until admin approval.
      role: null,
      status: "pending",
      is_active: false,
      isVerified: false,
      profileCompleted: false,
    });

    // Prove the person actually controls this address before an admin spends
    // time approving them. Failure to send must not fail the registration.
    try {
      await sendEmailVerification(user);
    } catch (mailErr) {
      console.error("[signup] verification email failed:", mailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Registration received. Check your email to verify your address; your account then awaits admin approval.",
      staffId: user.staffId,
    });
  } catch (err) {
    console.error("[signup]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── POST /api/auth/complete-profile (for google/pending users) ───────────────
exports.completeProfile = async (req, res) => {
  try {
    const { phone, idNumber, kraPin, nssf, nhif, bankName, bankBranch, accountNumber } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const priorEffective = resolveVerificationStatus(user).status;

    const idOk = /^[0-9]{7,8}$/.test(String(idNumber || ""));
    const kraOk = /^[A-Z][0-9]{9}[A-Z]$/.test(String(kraPin || "").toUpperCase());
    const phoneOk = /^(\+254|0)[0-9]{9}$/.test(String(phone || ""));
    const acctOk = String(accountNumber || "").trim().length >= 6;
    if (!idOk || !kraOk || !phoneOk || !acctOk) {
      return res.status(400).json({
        success: false,
        message: "Invalid profile fields. Ensure ID, KRA PIN, phone, and bank account are valid.",
      });
    }

    Object.assign(user, { phone, idNumber, kraPin, nssf, nhif });
    user.bank = {
      ...(user.bank || {}),
      bankName,
      branch: bankBranch,
      accountNumber,
      isVerified: false,
      isActive: false,
    };
    if (!user.staffId) user.staffId = await nextYPStaffIdV2();
    const wasApproved = user.status === "approved" && user.is_active;
    if (!wasApproved) {
    user.status = "pending";
    user.is_active = false;
    user.role = null;
    }
    user.profileCompleted = true;
    user.verification_status = "pending";
    user.verification_rejection_reason = null;
    user.isVerified = false;

    await user.save();

    if (wasApproved && priorEffective !== "pending") {
      await Notification.create({
        user_id: user._id,
        type: "info",
        message: "Profile submitted for admin verification.",
      });
    }

    return res.json({
      success: true,
      message: wasApproved
        ? "Profile updated. Payroll verification is pending admin review."
        : "Profile completed. Awaiting admin approval.",
      staffId: user.staffId,
    });
  } catch (err) {
    console.error("[completeProfile]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── POST /api/auth/refresh ────────────────────────────────────────────────────
exports.refresh = async (req, res) => {
  const rawCookie = req.cookies?.wms_refresh;
  if (!rawCookie)
    return res.status(401).json({ success: false, message: "No refresh token." });

  let user_id = req.body?.user_id ? String(req.body.user_id) : null;
  let rawToken = rawCookie;

  // Preferred cookie format: "<mongoUserId>.<rawRefresh>"
  const dot = rawCookie.indexOf(".");
  if (dot > 0) {
    const maybeId = rawCookie.slice(0, dot);
    const rest = rawCookie.slice(dot + 1);
    if (/^[a-f0-9]{24}$/i.test(maybeId) && rest.length > 20) {
      if (!user_id) user_id = maybeId;
      rawToken = rest;
    }
  }

  if (!user_id)
    return res.status(400).json({ success: false, message: "user_id required." });

  try {
    const valid = await verifyRefreshToken(user_id, rawToken);
    if (!valid) {
      // Do not clear the cookie here. A second tab or request may have just rotated it,
      // and clearing it would sign the person out. The request is still refused.
      await recordEvent("token_reuse", {
        user_id,
        ip_address: getIP(req),
        metadata: { note: "Invalid refresh token" },
      });
      return res.status(401).json({ success: false, message: "Session invalid. Please log in again." });
    }

    const user = await User.findById(user_id);
    if (!user || !user.is_active || user.deleted_at) {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: "Account not available." });
    }

    const ip = getIP(req);
    const ua = getUA(req);
    const { token: accessToken } = signAccess(user._id, user.role);
    const { raw: newRefresh, expiresAt } = await issueRefreshToken(user._id, ip, ua);

    setRefreshCookie(res, newRefresh, expiresAt, user._id);

    return res.json({
      success: true,
      access_token: accessToken,
      expires_in: 900,
      force_password_reset: Boolean(user.force_password_reset),
    });
  } catch (err) {
    console.error("[refresh]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── POST /api/auth/logout ─────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    if (req.user) await revokeAllSessions(req.user._id);
    clearRefreshCookie(res);
    return res.json({ success: true, message: "Logged out." });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── POST /api/auth/register (admin-only) ─────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, branch_id, staff_type, join_date } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: "Name, email, and password required." });

    const { valid, errors } = validatePassword(password);
    if (!valid)
      return res.status(400).json({ success: false, message: "Password policy failed.", errors });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists)
      return res.status(400).json({ success: false, message: "Email already in use." });

    const assignedRole = role || "staff";
    if (!["admin", "general_supervisor", "supervisor", "staff"].includes(assignedRole)) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }

    let resolvedBranch = branch_id || undefined;
    let resolvedEmployment;
    if (assignedRole === "staff") {
      const st = staff_type || "casual";
      const norm = normalizeEmploymentForRole("staff", st);
      if (!norm.ok) return res.status(400).json({ success: false, message: norm.message });
      resolvedEmployment = norm.employment_type;
      if (resolvedEmployment === "casual") {
        if (branch_id) {
          return res.status(400).json({ success: false, message: "Casual staff cannot be assigned a fixed branch at registration." });
        }
        resolvedBranch = undefined;
      } else if (requiresFixedBranch(resolvedEmployment)) {
        const br = await assertActiveBranch(branch_id);
        if (!br.ok) return res.status(400).json({ success: false, message: br.message });
        resolvedBranch = br.branch._id;
      }
    } else if (assignedRole === "supervisor") {
      const norm = normalizeEmploymentForRole("supervisor");
      resolvedEmployment = norm.employment_type;
      const br = await assertActiveBranch(branch_id);
      if (!br.ok) return res.status(400).json({ success: false, message: br.message });
      resolvedBranch = br.branch._id;
    } else if (assignedRole === "general_supervisor") {
      const norm = normalizeEmploymentForRole("general_supervisor");
      resolvedEmployment = norm.employment_type;
      if (branch_id) {
        const br = await assertActiveBranch(branch_id);
        if (!br.ok) return res.status(400).json({ success: false, message: br.message });
        resolvedBranch = br.branch._id;
      } else {
        resolvedBranch = undefined;
      }
    }

    const userPayload = {
      name,
      email,
      password,
      role: assignedRole,
      branch_id: resolvedBranch,
      branch: resolvedBranch || null,
      status: "approved",
      is_active: true,
      isVerified: false,
      profileCompleted: false,
    };
    if (resolvedEmployment) userPayload.employment_type = resolvedEmployment;
    if (resolvedEmployment === "casual") userPayload.last_branch_change = null;

    const user = await User.create(userPayload);
    if (!user.staffId) user.staffId = await nextYPStaffIdV2();
    await user.save({ validateModifiedOnly: true });

    if (["staff", "supervisor"].includes(assignedRole)) {
      const jd = join_date ? new Date(join_date) : new Date();
      const staffId = await nextYPStaffId(jd);
      const profileType = staffProfileTypeFor(assignedRole, resolvedEmployment || staff_type || "casual");
      await StaffProfile.create({
        user_id: user._id,
        staff_id: staffId,
        type: profileType,
        join_date: jd,
        pay_rate: 0,
      });
      if (assignedRole === "staff") {
        const accrued = calcAnnualLeaveAccrual(jd);
        await LeaveBalance.create({ staff_id: user._id, annual_balance: accrued });
      }
    }

    // Audit log
    const AuditLog = require("../models/AuditLog");
    await AuditLog.create({
      action: "CREATE_USER",
      admin_id: req.user._id,
      target_id: user._id,
      target_type: "user",
      module: "users",
      ip_address: getIP(req),
      user_agent: getUA(req),
      after: { name, email, role: assignedRole, branch_id },
    });

    return res.status(201).json({
      success: true,
      message: "User created.",
      data: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("[register]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── POST /api/auth/change-password ───────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ success: false, message: "Both passwords required." });

    const { valid, errors } = validatePassword(new_password);
    if (!valid)
      return res.status(400).json({ success: false, message: "Password policy failed.", errors });

    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(current_password)))
      return res.status(401).json({ success: false, message: "Current password incorrect." });

    user.password = new_password;
    user.force_password_reset = false;
    await user.save();
    await revokeAllSessions(user._id);
    clearRefreshCookie(res);

    return res.json({ success: true, message: "Password changed. Please log in again." });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("branch_id").select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.json({ success: true, data: { ...user.toObject(), ...verificationPayload(user) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/auth/sessions ───────────────────────────────────────────────────
exports.getSessions = async (req, res) => {
  try {
    const sessions = await Session.find({
      user_id: req.user._id,
      is_revoked: false,
      expires_at: { $gt: new Date() },
    }).sort({ login_at: -1 });
    return res.json({ success: true, data: sessions });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/auth/google/callback ────────────────────────────────────────────
exports.googleOAuthSuccess = async (req, res) => {
  // After Google sign-in the browser is sent back to the app. The session cookie is set here,
  // and the app's /auth/google-done page turns it into a signed-in session.
  const app = (process.env.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const fail = (code) => res.redirect(`${app}/login?google=${code}`);
  try {
    const user = req.user;
    if (!user) return fail("failed");
    const effectiveStatus = user.status || (user.is_active ? "approved" : "pending");
    if (effectiveStatus === "rejected") return fail("rejected");
    if (effectiveStatus !== "approved" || !user.is_active) return fail("pending");
    if (!user.role) return fail("norole");

    const { raw: refreshToken, expiresAt } = await issueRefreshToken(user._id, getIP(req), getUA(req));
    setRefreshCookie(res, refreshToken, expiresAt, user._id);
    return res.redirect(`${app}/auth/google-done`);
  } catch (err) {
    console.error("[googleOAuthSuccess]", err);
    return fail("failed");
  }
};

// ─── POST /api/auth/forgot-password ────────────────────────────────────────────
// Always returns a generic success message, whether or not the email exists,
// so this endpoint can't be used to enumerate registered accounts.
exports.forgotPassword = async (req, res) => {
  try {
    const email = (req.body.email || "").toString().trim().toLowerCase();
    const generic = {
      success: true,
      message: "If an account exists for that email, reset instructions have been sent.",
    };
    if (!email) return res.json(generic);

    const user = await User.findOne({ email: { $in: emailCandidates(email) }, deleted_at: null }).select("+password_reset_expires");
    if (!user) return res.json(generic);
    // Per-account cooldown: if a link was issued in the last minute, don't send another. Stops one
    // person's inbox being flooded from many IPs (the IP limiter alone can't prevent that).
    if (user.password_reset_expires && user.password_reset_expires.getTime() - Date.now() > 59 * 60 * 1000) {
      return res.json(generic);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.password_reset_token_hash = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.password_reset_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateModifiedOnly: true });

    const baseUrl = (process.env.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const resetLink = `${baseUrl}/reset-password?uid=${user._id}&token=${rawToken}`;

    const { sendMail } = require("../utils/mailer");
    const mailResult = await sendMail({
      to: user.email,
      subject: "koin — Reset your password",
      html: `<p>Hi ${escapeHtml(user.name)},</p><p>Click below to reset your koin password. This link expires in 1 hour.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
      text: `Reset your koin password: ${resetLink} (expires in 1 hour)`,
    });

    // SMTP isn't configured in every environment (e.g. local dev without
    // mail creds) — log the link server-side so the flow is still testable.
    // Never write a live credential-bearing link to production logs.
    if (mailResult.skipped) {
      if (process.env.NODE_ENV === "production") {
        console.warn("[forgotPassword] SMTP not configured — reset email NOT sent.");
      } else {
        console.log(`[forgotPassword] (dev) SMTP not configured — reset link for ${user.email}: ${resetLink}`);
      }
    }

    return res.json(generic);
  } catch (err) {
    console.error("[forgotPassword]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── POST /api/auth/reset-password ─────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { uid, token, password } = req.body;
    if (!uid || !token || !password)
      return res.status(400).json({ success: false, message: "uid, token and password are required." });

    const { valid, errors } = validatePassword(password);
    if (!valid) return res.status(400).json({ success: false, message: "Password policy failed.", errors });

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      _id: uid,
      password_reset_token_hash: tokenHash,
      password_reset_expires: { $gt: new Date() },
      deleted_at: null,
    }).select("+password_reset_token_hash +password_reset_expires");

    if (!user)
      return res.status(400).json({ success: false, message: "This reset link is invalid or has expired." });

    user.password = password;
    user.force_password_reset = false;
    user.password_reset_token_hash = null;
    user.password_reset_expires = null;
    user.failed_login_attempts = 0;
    user.lockout_until = null;
    await user.save();
    await revokeAllSessions(user._id); // signing in again requires the new password everywhere

    return res.json({ success: true, message: "Password reset. Please log in with your new password." });
  } catch (err) {
    console.error("[resetPassword]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── POST /api/auth/upload-document ────────────────────────────────────────────
// Onboarding document upload (National ID, KRA PIN certificate, profile
// photo). Available to any authenticated account regardless of approval
// status, same scope as /complete-profile.
const ONBOARDING_DOC_FIELDS = ["national_id", "kra_pin_certificate", "profile_photo"];
exports.uploadOnboardingDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded." });
    const docType = (req.body.doc_type || "").toString();
    if (!ONBOARDING_DOC_FIELDS.includes(docType)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        message: `doc_type must be one of: ${ONBOARDING_DOC_FIELDS.join(", ")}.`,
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    user.documents = user.documents || {};
    const previous = user.documents[docType];
    user.documents[docType] = req.file.filename;
    // Don't leave superseded ID scans sitting on disk.
    if (previous && previous !== req.file.filename) {
      fs.unlink(path.join(uploadDir, path.basename(previous)), () => {});
    }
    await user.save({ validateModifiedOnly: true });

    return res.json({
      success: true,
      message: `${docType.replace(/_/g, " ")} uploaded.`,
      data: { doc_type: docType, filename: req.file.filename, url: `/uploads/${req.file.filename}` },
    });
  } catch (err) {
    console.error("[uploadOnboardingDocument]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Email helpers ──────────────────────────────────────────────────────────────
// Signup stores the *normalised* address (express-validator's normalizeEmail strips Gmail dots and
// "+tags"), so "John.Doe@gmail.com" is saved as "johndoe@gmail.com". Always look an account up by
// both the address as typed and its normalised form, or people can't sign in / reset with what they typed.
function emailCandidates(raw) {
  const lower = String(raw || "").trim().toLowerCase();
  const normalised = validator.normalizeEmail(lower) || lower;
  return [...new Set([lower, normalised])];
}

// User-controlled strings (e.g. a signup name) must never be dropped into email
// HTML raw — that would let anyone inject links/markup into mail we send.
function escapeHtml(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmailVerification(user) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  user.email_verification_token_hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  user.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await user.save({ validateModifiedOnly: true });

  const baseUrl = (process.env.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const link = `${baseUrl}/verify-email?uid=${user._id}&token=${rawToken}`;
  const { sendMail } = require("../utils/mailer");
  const result = await sendMail({
    to: user.email,
    subject: "koin — Verify your email address",
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Confirm this email address to continue your koin registration. The link expires in 24 hours.</p><p><a href="${link}">${link}</a></p>`,
    text: `Verify your koin email: ${link} (expires in 24 hours)`,
  });
  if (result.skipped && process.env.NODE_ENV !== "production") {
    console.log(`[verify-email] (dev) SMTP not configured — link for ${user.email}: ${link}`);
  }
  return result;
}

// ─── POST /api/auth/verify-email ────────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  try {
    const { uid, token } = req.body;
    if (!uid || !token) return res.status(400).json({ success: false, message: "uid and token are required." });
    const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
    const user = await User.findOne({
      _id: uid,
      email_verification_token_hash: tokenHash,
      email_verification_expires: { $gt: new Date() },
      deleted_at: null,
    }).select("+email_verification_token_hash +email_verification_expires");
    if (!user) return res.status(400).json({ success: false, message: "This verification link is invalid or has expired." });

    user.email_verified = true;
    user.email_verification_token_hash = null;
    user.email_verification_expires = null;
    await user.save({ validateModifiedOnly: true });
    return res.json({ success: true, message: "Email verified. Your account is now awaiting admin approval." });
  } catch (err) {
    console.error("[verifyEmail]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── POST /api/auth/resend-verification ─────────────────────────────────────────
// Generic response either way so it can't be used to discover registered emails.
exports.resendVerification = async (req, res) => {
  const generic = { success: true, message: "If that address is registered and unverified, a new link has been sent." };
  try {
    const email = (req.body.email || "").toString().trim().toLowerCase();
    if (!email) return res.json(generic);
    const user = await User.findOne({ email: { $in: emailCandidates(email) }, deleted_at: null }).select("+email_verification_expires");
    if (user && !user.email_verified) {
      const issuedJustNow = user.email_verification_expires && user.email_verification_expires.getTime() - Date.now() > (24 * 60 - 1) * 60 * 1000;
      if (!issuedJustNow) await sendEmailVerification(user);
    }
    return res.json(generic);
  } catch (err) {
    console.error("[resendVerification]", err);
    return res.json(generic);
  }
};
