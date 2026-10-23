/**
 * Profile / payroll verification (post-login, admin-gated).
 * Legacy users may only have isVerified + profileCompleted — treat as source of truth when verification_status is unset.
 */

const STATUS = {
  NOT_SUBMITTED: "not_submitted",
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
};

function resolveVerificationStatus(user) {
  if (!user) return { status: STATUS.NOT_SUBMITTED, reason: null };

  const vs = user.verification_status;
  const reason = user.verification_rejection_reason || null;

  if (vs === STATUS.REJECTED) return { status: STATUS.REJECTED, reason };

  if (vs === STATUS.VERIFIED || user.isVerified === true) return { status: STATUS.VERIFIED, reason: null };

  if (vs === STATUS.PENDING) return { status: STATUS.PENDING, reason: null };

  if (vs === STATUS.NOT_SUBMITTED) return { status: STATUS.NOT_SUBMITTED, reason: null };

  if (user.isVerified === true) return { status: STATUS.VERIFIED, reason: null };
  if (!user.profileCompleted) return { status: STATUS.NOT_SUBMITTED, reason: null };
  return { status: STATUS.PENDING, reason: null };
}

function isPayrollUnlocked(user) {
  return resolveVerificationStatus(user).status === STATUS.VERIFIED;
}

/** Fields merged into API payloads (login, /auth/me, profile, dashboard). */
function verificationPayload(user) {
  const v = resolveVerificationStatus(user);
  return {
    profile_completed: Boolean(user.profileCompleted),
    profile_verified: v.status === STATUS.VERIFIED,
    verification_status: v.status,
    verification_rejection_reason: v.reason,
    bank_status: user.bank?.isVerified ? "verified" : "pending",
    isVerified: v.status === STATUS.VERIFIED,
  };
}

module.exports = {
  STATUS,
  resolveVerificationStatus,
  isPayrollUnlocked,
  verificationPayload,
};
