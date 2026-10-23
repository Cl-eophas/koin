const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const Attendance = require("../models/Attendance");
const SecurityEvent = require("../models/SecurityEvent");
const { assertActiveBranch } = require("../utils/branchEmployment");

const EMP_ORDER = { casual: 0, reliever: 1, contract: 2 };

/**
 * Optional promotion gates (Step 16): attendance ratio last 30 days, no open security events.
 * Set ENFORCE_PROMOTION_CONDITIONS=true to block unless conditions pass.
 */
async function checkOptionalPromotionConditions(userId) {
  const enforce = process.env.ENFORCE_PROMOTION_CONDITIONS === "true";
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);

  const records = await Attendance.find({
    staff_id: userId,
    date: { $gte: sinceStr },
    clock_in: { $exists: true, $ne: null },
  }).lean();

  const worked = records.length;
  const presentLike = records.filter((r) => ["present", "late", "forced", "supervisor_assisted"].includes(r.status)).length;
  const ratio = worked ? presentLike / worked : 1;

  const badSecurity = await SecurityEvent.countDocuments({ user_id: userId, resolved: false });

  const warnings = [];
  if (ratio < 0.8) warnings.push(`Attendance quality in last 30 days below 80% (${Math.round(ratio * 100)}%).`);
  if (badSecurity > 0) warnings.push("Open discipline-related security events exist.");

  const ok = ratio >= 0.8 && badSecurity === 0;
  return { ok, enforce, warnings };
}

async function promoteRole({ user_id, new_role, branch_id }) {
  const user = await User.findById(user_id);
  if (!user) return { ok: false, code: 404, message: "User not found." };
  if (user.role === "admin") return { ok: false, code: 400, message: "Cannot change admin role via promotion API." };
  if (!["staff", "supervisor"].includes(new_role))
    return { ok: false, code: 400, message: "new_role must be staff or supervisor." };

  if (user.role === "supervisor" && new_role === "staff")
    return { ok: false, code: 400, message: "Use POST /admin/demote-role to demote a supervisor." };

  if (user.role === new_role) return { ok: false, code: 409, message: "User already has this role." };

  if (new_role === "supervisor") {
    if (!branch_id) return { ok: false, code: 400, message: "branch_id is required when promoting to supervisor." };
    const Branch = require("../models/Branch");
    const br = await Branch.findById(branch_id);
    if (!br) return { ok: false, code: 400, message: "Invalid branch_id." };
  }

  const cond = await checkOptionalPromotionConditions(user_id);
  if (cond.enforce && !cond.ok) {
    return { ok: false, code: 400, message: cond.warnings.join(" ") || "Promotion conditions not met." };
  }

  const oldRole = user.role;
  user.role = new_role;
  if (new_role === "supervisor") user.branch_id = branch_id;
  await user.save();

  return { ok: true, user, old_value: oldRole, new_value: new_role, condition_warnings: cond.warnings };
}

async function demoteRole({ user_id }) {
  const user = await User.findById(user_id);
  if (!user) return { ok: false, code: 404, message: "User not found." };
  if (user.role === "admin") return { ok: false, code: 400, message: "Cannot demote admin." };
  if (user.role !== "supervisor") return { ok: false, code: 409, message: "User is not a supervisor." };

  if (user.branch_id) {
    const others = await User.countDocuments({
      branch_id: user.branch_id,
      role: "supervisor",
      is_active: true,
      _id: { $ne: user._id },
    });
    if (others < 1)
      return {
        ok: false,
        code: 400,
        message: "Cannot demote the last supervisor for this branch. Assign another supervisor first.",
      };
  }

  const cond = await checkOptionalPromotionConditions(user_id);
  if (cond.enforce && !cond.ok) {
    return { ok: false, code: 400, message: cond.warnings.join(" ") || "Demotion conditions not met." };
  }

  const oldRole = user.role;
  user.role = "staff";
  await user.save();

  return { ok: true, user, old_value: oldRole, new_value: "staff", condition_warnings: cond.warnings };
}

async function promoteEmployment({ staff_id, new_type, branch_id }) {
  if (!["casual", "reliever", "contract"].includes(new_type))
    return { ok: false, code: 400, message: "Invalid employment type." };

  const user = await User.findById(staff_id);
  if (!user) return { ok: false, code: 404, message: "User not found." };
  if (!["staff", "supervisor"].includes(user.role))
    return { ok: false, code: 400, message: "Employment type applies only to staff or supervisors." };

  const profile = await StaffProfile.findOne({ user_id: staff_id });
  if (!profile) return { ok: false, code: 404, message: "Staff profile not found." };
  if (profile.type === "supervisor") {
    return { ok: false, code: 400, message: "Use branch/role tools for supervisor employment." };
  }

  const cur = profile.type;
  if (cur === new_type) return { ok: false, code: 409, message: "Already at this employment type." };

  if (EMP_ORDER[new_type] !== EMP_ORDER[cur] + 1)
    return {
      ok: false,
      code: 400,
      message: "Employment progression must follow casual → reliever → contract with no skipping.",
    };

  if (cur === "casual" && new_type !== "casual") {
    const brCheck = await assertActiveBranch(branch_id || user.branch_id);
    if (!brCheck.ok) {
      return {
        ok: false,
        code: 400,
        message: "branch_id is required when promoting from casual (assign fixed branch).",
      };
    }
    user.branch_id = brCheck.branch._id;
    user.last_branch_change = new Date();
  }

  const cond = await checkOptionalPromotionConditions(staff_id);
  if (cond.enforce && !cond.ok) {
    return { ok: false, code: 400, message: cond.warnings.join(" ") || "Promotion conditions not met." };
  }

  const old_value = profile.type;
  profile.type = new_type;
  await profile.save();
  user.employment_type = user.role === "supervisor" ? "supervisor" : new_type;
  if (new_type === "casual") {
    user.branch_id = null;
    user.last_branch_change = null;
  }
  await user.save();

  return { ok: true, profile, user, old_value, new_value: new_type, condition_warnings: cond.warnings };
}

// Moves a person exactly one step up the career ladder (casual -> reliever -> staff ->
// supervisor -> general supervisor -> admin). General supervisors and admins are never
// tied to a branch: their branch is cleared. Supervisors need an active branch.
async function promoteOneLevel({ user_id, branch_id }) {
  const { currentLevelKey, nextLevel } = require("../utils/careerLadder");
  const user = await User.findOne({ _id: user_id, deleted_at: null });
  if (!user) return { ok: false, code: 404, message: "User not found." };
  if (!user.is_active) return { ok: false, code: 400, message: "Activate this account before promoting it." };

  const profile = await StaffProfile.findOne({ user_id });
  const fromKey = currentLevelKey(user, profile?.type);
  const target = nextLevel(fromKey);
  if (!target) return { ok: false, code: 400, message: "This person is already at the highest level (Admin)." };

  if (target.needsBranch) {
    const br = await assertActiveBranch(branch_id || user.branch_id);
    if (!br.ok) {
      return {
        ok: false,
        code: 400,
        message: target.key === "supervisor" ? "Choose an active branch for the new supervisor." : "Choose an active branch for this promotion.",
      };
    }
    user.branch_id = br.branch._id;
    user.branch = br.branch._id;
  } else {
    user.branch_id = null;
    user.branch = null;
  }

  const cond = await checkOptionalPromotionConditions(user_id);
  if (cond.enforce && !cond.ok) {
    return { ok: false, code: 400, message: cond.warnings.join(" ") || "Promotion conditions not met." };
  }

  const from = { level: fromKey, role: user.role, employment_type: user.employment_type, branch_id: user.branch_id };
  user.role = target.role;
  user.employment_type = target.employment_type;
  if (target.role === "staff") user.last_branch_change = new Date();
  if (profile && target.profile_type) {
    profile.type = target.profile_type;
    await profile.save();
  }
  await user.save();

  const demoted = [];

  return {
    ok: true,
    demoted,
    user,
    from,
    to: { level: target.key, role: target.role, employment_type: target.employment_type, branch_id: user.branch_id },
    condition_warnings: cond.warnings,
  };
}

module.exports = { promoteRole, demoteRole, promoteEmployment, promoteOneLevel, checkOptionalPromotionConditions };
