const User = require("../models/User");
const Branch = require("../models/Branch");

// Every branch must keep at least this many active supervisors (default 1).
// Override with MIN_SUPERVISORS_PER_BRANCH in .env.
const minSupervisorsPerBranch = () => {
  const n = parseInt(process.env.MIN_SUPERVISORS_PER_BRANCH || "1", 10);
  return Number.isFinite(n) && n >= 0 ? n : 1;
};

// Blocks any change that would leave a branch below the minimum.
async function checkSupervisorsLeaving(branchId, leavingCount) {
  const total = await User.countDocuments({ branch_id: branchId, role: "supervisor", is_active: true, deleted_at: null });
  const min = minSupervisorsPerBranch();
  const remaining = total - leavingCount;
  if (remaining < min) {
    return {
      ok: false,
      message: `Every branch must keep at least ${min} supervisor(s). This change would leave it with ${Math.max(remaining, 0)}.`,
    };
  }
  return { ok: true };
}

async function branchName(id) {
  const b = await Branch.findById(id).select("name").lean();
  return b?.name || "the current branch";
}

// Single move: one user leaving their current branch.
async function assertSupervisorMoveAllowed(user, toBranchId) {
  if (user.role !== "supervisor" || !user.branch_id) return { ok: true };
  if (String(user.branch_id) === String(toBranchId)) return { ok: true };
  const check = await checkSupervisorsLeaving(user.branch_id, 1);
  if (!check.ok) return { ok: false, message: `${check.message} (Branch: ${await branchName(user.branch_id)})` };
  return { ok: true };
}

// Bulk move: counts how many supervisors leave each source branch.
async function assertBulkSupervisorMoveAllowed(users, toBranchId) {
  const leaving = new Map();
  for (const u of users) {
    if (u.role !== "supervisor" || !u.branch_id) continue;
    if (String(u.branch_id) === String(toBranchId)) continue;
    const key = String(u.branch_id);
    leaving.set(key, (leaving.get(key) || 0) + 1);
  }
  for (const [branchId, count] of leaving) {
    const check = await checkSupervisorsLeaving(branchId, count);
    if (!check.ok) return { ok: false, message: `${check.message} (Branch: ${await branchName(branchId)})` };
  }
  return { ok: true };
}

// Deactivating a supervisor also removes them from their branch.
async function assertSupervisorCanBeDeactivated(user) {
  if (user.role !== "supervisor" || !user.branch_id) return { ok: true };
  const check = await checkSupervisorsLeaving(user.branch_id, 1);
  if (!check.ok) return { ok: false, message: `${check.message} (Branch: ${await branchName(user.branch_id)})` };
  return { ok: true };
}

module.exports = {
  assertSupervisorMoveAllowed,
  assertBulkSupervisorMoveAllowed,
  assertSupervisorCanBeDeactivated,
  minSupervisorsPerBranch,
};
