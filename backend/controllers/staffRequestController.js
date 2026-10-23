const StaffRequest = require("../models/StaffRequest");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const { assertActiveBranch } = require("../utils/branchEmployment");

const TYPES = ["casual", "reliever"];
const OPEN = ["pending", "partial"];

const shape = (r) => {
  const filled = r.fulfilled_count || 0;
  return {
    _id: r._id,
    employment_type: r.employment_type,
    quantity: r.quantity,
    fulfilled: filled,
    remaining: Math.max(0, r.quantity - filled),
    reason: r.reason,
    status: r.status,
    admin_note: r.admin_note || "",
    created_at: r.createdAt,
    branch: r.branch_id && r.branch_id.name ? { id: r.branch_id._id, name: r.branch_id.name } : null,
    requested_by: r.requested_by && r.requested_by.name ? r.requested_by.name : null,
  };
};

async function audit(req, action, target, metadata) {
  try {
    await AuditLog.create({
      action,
      admin_id: req.user._id,
      target_id: target,
      target_type: "user",
      module: "staff_requests",
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
      metadata,
    });
  } catch (e) {
    console.error("[staff request audit]", e.message);
  }
}

// ── Supervisor ─────────────────────────────────────────────────────────────
exports.createStaffRequest = async (req, res) => {
  try {
    const { employment_type, quantity, reason } = req.body;
    if (!TYPES.includes(employment_type)) {
      return res.status(400).json({ success: false, message: "Request casual or reliever staff only." });
    }
    const branchId = req.user.branch_id;
    if (!branchId) return res.status(400).json({ success: false, message: "Your account has no branch assigned." });
    const br = await assertActiveBranch(branchId);
    if (!br.ok) return res.status(400).json({ success: false, message: br.message });

    const doc = await StaffRequest.create({
      branch_id: branchId,
      requested_by: req.user._id,
      employment_type,
      quantity: Number(quantity),
      reason: String(reason).trim(),
      status: "pending",
    });
    res.status(201).json({ success: true, message: "Request sent to admin.", data: shape(doc.toObject()) });
  } catch (err) {
    console.error("[createStaffRequest]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.listMyStaffRequests = async (req, res) => {
  try {
    const rows = await StaffRequest.find({ branch_id: req.user.branch_id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("branch_id", "name")
      .lean();
    res.json({ success: true, data: rows.map(shape) });
  } catch (err) {
    console.error("[listMyStaffRequests]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── Admin ──────────────────────────────────────────────────────────────────
exports.listStaffRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const rows = await StaffRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("branch_id", "name")
      .populate("requested_by", "name")
      .lean();
    res.json({ success: true, data: rows.map(shape) });
  } catch (err) {
    console.error("[listStaffRequests]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// "add": approved staff of this type with no branch yet.
// "transfer": approved staff of this type currently in another branch.
exports.staffRequestCandidates = async (req, res) => {
  try {
    const doc = await StaffRequest.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, message: "Request not found." });
    const mode = req.query.mode === "transfer" ? "transfer" : "add";
    const q = { role: "staff", employment_type: doc.employment_type, status: "approved", is_active: true, deleted_at: null };
    if (mode === "add") q.branch_id = null;
    else q.branch_id = { $nin: [doc.branch_id, null] };
    const users = await User.find(q).select("name email staffId branch_id").populate("branch_id", "name").limit(300).lean();
    res.json({
      success: true,
      data: users.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        staffId: u.staffId,
        branch: u.branch_id && u.branch_id.name ? u.branch_id.name : null,
      })),
    });
  } catch (err) {
    console.error("[staffRequestCandidates]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.fulfilStaffRequest = async (req, res) => {
  try {
    const { mode } = req.body;
    const ids = [...new Set((req.body.user_ids || []).map(String))];
    const doc = await StaffRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Request not found." });
    if (!OPEN.includes(doc.status)) return res.status(400).json({ success: false, message: "This request is already closed." });

    const remaining = doc.quantity - (doc.fulfilled_count || 0);
    if (ids.length > remaining) {
      return res.status(400).json({ success: false, message: `Only ${remaining} more person(s) are needed for this request.` });
    }

    const br = await assertActiveBranch(doc.branch_id);
    if (!br.ok) return res.status(400).json({ success: false, message: br.message });

    const people = await User.find({
      _id: { $in: ids },
      role: "staff",
      employment_type: doc.employment_type,
      status: "approved",
      is_active: true,
      deleted_at: null,
    });
    if (people.length !== ids.length) {
      return res.status(400).json({
        success: false,
        message: "Some selected people are no longer eligible (wrong type, inactive or not approved). Refresh and try again.",
      });
    }
    if (mode === "add" && people.some((u) => u.branch_id)) {
      return res.status(400).json({ success: false, message: "Some selected people already have a branch. Use Transfer instead." });
    }
    if (mode === "transfer" && people.some((u) => String(u.branch_id) === String(doc.branch_id))) {
      return res.status(400).json({ success: false, message: "Some selected people already belong to this branch." });
    }

    await User.updateMany(
      { _id: { $in: ids } },
      { $set: { branch_id: doc.branch_id, branch: doc.branch_id, last_branch_change: new Date() } }
    );

    doc.fulfilled_count = (doc.fulfilled_count || 0) + ids.length;
    doc.assigned_user_ids = [...(doc.assigned_user_ids || []), ...ids];
    doc.status = doc.fulfilled_count >= doc.quantity ? "fulfilled" : "partial";
    doc.handled_by = req.user._id;
    doc.handled_at = new Date();
    await doc.save();

    await audit(req, "STAFF_REQUEST_FULFILLED", doc._id, { mode, branch_id: doc.branch_id, user_ids: ids });
    const verb = mode === "add" ? "added to" : "transferred to";
    res.json({
      success: true,
      message: `${ids.length} ${doc.employment_type} staff ${verb} ${br.branch.name}.`,
      data: shape(doc.toObject()),
    });
  } catch (err) {
    console.error("[fulfilStaffRequest]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.rejectStaffRequest = async (req, res) => {
  try {
    const doc = await StaffRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Request not found." });
    if (!OPEN.includes(doc.status)) return res.status(400).json({ success: false, message: "This request is already closed." });
    doc.status = "rejected";
    doc.admin_note = String(req.body.reason).trim();
    doc.handled_by = req.user._id;
    doc.handled_at = new Date();
    await doc.save();
    await audit(req, "STAFF_REQUEST_REJECTED", doc._id, { reason: doc.admin_note });
    res.json({ success: true, message: "Request rejected.", data: shape(doc.toObject()) });
  } catch (err) {
    console.error("[rejectStaffRequest]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
