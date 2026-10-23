const Branch = require("../models/Branch");

const EMPLOYMENT = {
  CASUAL: "casual",
  RELIEVER: "reliever",
  CONTRACT: "contract",
  SUPERVISOR: "supervisor",
  GENERAL_SUPERVISOR: "general_supervisor",
};

const STAFF_TYPES = [EMPLOYMENT.CASUAL, EMPLOYMENT.RELIEVER, EMPLOYMENT.CONTRACT];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function requiresFixedBranch(employmentType) {
  if (!employmentType) return true;
  if (employmentType === EMPLOYMENT.CASUAL) return false;
  if (employmentType === EMPLOYMENT.GENERAL_SUPERVISOR) return false;
  return true;
}

function normalizeEmploymentForRole(role, requestedType) {
  if (role === "general_supervisor") {
    return { ok: true, employment_type: EMPLOYMENT.GENERAL_SUPERVISOR };
  }
  if (role === "supervisor") {
    if (requestedType && requestedType !== EMPLOYMENT.SUPERVISOR) {
      return { ok: false, message: "Branch supervisors must have employment_type supervisor." };
    }
    return { ok: true, employment_type: EMPLOYMENT.SUPERVISOR };
  }
  if (role === "staff") {
    if (!STAFF_TYPES.includes(requestedType)) {
      return { ok: false, message: "employment_type must be casual, reliever, or contract for staff." };
    }
    return { ok: true, employment_type: requestedType };
  }
  return { ok: false, message: "Invalid role for employment assignment." };
}

function staffProfileTypeFor(role, employment_type) {
  if (role === "supervisor") return EMPLOYMENT.SUPERVISOR;
  return employment_type;
}

async function assertActiveBranch(branchId) {
  if (!branchId) return { ok: false, message: "branch_id is required." };
  const b = await Branch.findOne({ _id: branchId, is_active: true });
  if (!b) return { ok: false, message: "Invalid or inactive branch." };
  return { ok: true, branch: b };
}

function canCasualSwitchBranch(user, newBranchId) {
  if (!user.branch_id) return { ok: true };
  if (String(user.branch_id) === String(newBranchId)) return { ok: true };
  if (!user.last_branch_change) return { ok: true };
  const elapsed = Date.now() - new Date(user.last_branch_change).getTime();
  if (elapsed < WEEK_MS) {
    return {
      ok: false,
      message: "You can only change branch once per week. Contact admin if you need an exception.",
    };
  }
  return { ok: true };
}

module.exports = {
  EMPLOYMENT,
  STAFF_TYPES,
  requiresFixedBranch,
  normalizeEmploymentForRole,
  staffProfileTypeFor,
  assertActiveBranch,
  canCasualSwitchBranch,
  WEEK_MS,
};
