const mongoose = require("mongoose");
const Branch = require("../models/Branch");

/**
 * Prefer the populated Branch document (geo fields) over a raw ObjectId.
 * Fixes: user.branch === ObjectId shadowing populated branch_id.
 */
function resolveBranchDocument(user) {
  if (!user) return null;
  const a = user.branch_id;
  const b = user.branch;
  const isDoc = (x) => x && typeof x === "object" && x._id;
  const hasGeo = (x) => {
    if (!x) return false;
    if (Number.isFinite(Number(x.branchLocation?.lat)) && Number.isFinite(Number(x.branchLocation?.lng))) return true;
    return Number.isFinite(Number(x.latitude)) && Number.isFinite(Number(x.longitude));
  };

  if (isDoc(a) && hasGeo(a)) return a;
  if (isDoc(b) && hasGeo(b)) return b;
  if (isDoc(a)) return a;
  if (isDoc(b)) return b;
  return null;
}

async function resolveBranchForUser(user) {
  const doc = resolveBranchDocument(user);
  if (doc) return doc;
  const rawId = user.branch_id || user.branch;
  if (!rawId) return null;
  const id = rawId._id ? rawId._id : rawId;
  if (!mongoose.isValidObjectId(id)) return null;
  return Branch.findById(id).lean();
}

module.exports = { resolveBranchDocument, resolveBranchForUser };
