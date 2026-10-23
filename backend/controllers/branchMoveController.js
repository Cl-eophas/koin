const BranchMoveRequest = require("../models/BranchMoveRequest");
const User = require("../models/User");
const Branch = require("../models/Branch");
const StaffRequest = require("../models/StaffRequest");
const AuditLog = require("../models/AuditLog");
const { assertActiveBranch } = require("../utils/branchEmployment");

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const shape = (r) => ({
  _id: r._id,
  status: r.status,
  reason: r.reason,
  created_at: r.createdAt,
  decision_note: r.decision_note || "",
  decided_role: r.decided_role || null,
  person: r.user_id && r.user_id.name ? { name: r.user_id.name, staffId: r.user_id.staffId || null, phone: r.user_id.phone || null } : null,
  from: r.from_branch_id && r.from_branch_id.name ? r.from_branch_id.name : null,
  to: r.to_branch_id && r.to_branch_id.name ? r.to_branch_id.name : null,
  to_branch_id: r.to_branch_id && r.to_branch_id._id ? r.to_branch_id._id : r.to_branch_id,
});

async function audit(req, action, target, metadata) {
  try {
    await AuditLog.create({
      action,
      admin_id: req.user._id,
      target_id: target,
      target_type: "user",
      module: "branch_moves",
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
      metadata,
    });
  } catch (e) {
    console.error("[branch move audit]", e.message);
  }
}

// ── Casual staff ───────────────────────────────────────────────────────────
// What a casual worker sees: branches that need staff, open staff requests from supervisors,
// and who to contact (their branch's supervisor and the general supervisors).
exports.opportunities = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("employment_type branch_id").lean();
    if (!me || me.employment_type !== "casual") {
      return res.status(403).json({ success: false, message: "This section is for casual staff." });
    }

    const branches = await Branch.find({ is_active: { $ne: false } }).select("name address").lean();

    const headcounts = await User.aggregate([
      { $match: { role: { $in: ["staff", "supervisor"] }, is_active: true, status: "approved", branch_id: { $ne: null } } },
      { $group: { _id: "$branch_id", headcount: { $sum: 1 } } },
    ]);
    const headBy = new Map(headcounts.map((h) => [String(h._id), h.headcount]));

    const openReqs = await StaffRequest.find({ status: { $in: ["pending", "partial"] }, employment_type: "casual" })
      .populate("branch_id", "name")
      .sort({ createdAt: -1 })
      .lean();
    const needBy = new Map();
    for (const r of openReqs) {
      const id = String(r.branch_id && r.branch_id._id ? r.branch_id._id : r.branch_id);
      needBy.set(id, (needBy.get(id) || 0) + Math.max(0, r.quantity - (r.fulfilled_count || 0)));
    }

    const supervisors = await User.find({ role: "supervisor", is_active: true, deleted_at: null, branch_id: { $ne: null } })
      .select("name phone email branch_id")
      .lean();
    const supBy = new Map();
    for (const s of supervisors) supBy.set(String(s.branch_id), { name: s.name, phone: s.phone || null, email: s.email || null });

    const gsList = await User.find({ role: "general_supervisor", is_active: true, deleted_at: null })
      .select("name phone email")
      .lean();

    const avg = branches.length ? branches.reduce((n, b) => n + (headBy.get(String(b._id)) || 0), 0) / branches.length : 0;
    const rows = branches
      .map((b) => {
        const id = String(b._id);
        const headcount = headBy.get(id) || 0;
        const needs = needBy.get(id) || 0;
        return {
          _id: b._id,
          name: b.name,
          address: b.address || "",
          headcount,
          open_needs: needs,
          understaffed: needs > 0 || headcount < avg * 0.8,
          is_mine: me.branch_id ? String(me.branch_id) === id : false,
          supervisor: supBy.get(id) || null,
        };
      })
      .sort((a, b) => a.headcount - b.headcount);

    const openList = openReqs.map((r) => ({
      _id: r._id,
      branch_id: r.branch_id && r.branch_id._id ? r.branch_id._id : r.branch_id,
      branch: r.branch_id && r.branch_id.name ? r.branch_id.name : "—",
      remaining: Math.max(0, r.quantity - (r.fulfilled_count || 0)),
      reason: r.reason,
    }));

    res.json({
      success: true,
      data: {
        my_branch_id: me.branch_id || null,
        branches: rows,
        open_requests: openList,
        general_supervisors: gsList.map((g) => ({ name: g.name, phone: g.phone || null, email: g.email || null })),
      },
    });
  } catch (err) {
    console.error("[branchMove.opportunities]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.myBranchRequests = async (req, res) => {
  try {
    const rows = await BranchMoveRequest.find({ user_id: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("to_branch_id", "name")
      .populate("from_branch_id", "name")
      .lean();
    res.json({ success: true, data: rows.map(shape) });
  } catch (err) {
    console.error("[branchMove.myBranchRequests]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.createBranchRequest = async (req, res) => {
  try {
    const me = await User.findById(req.user._id);
    if (!me || me.employment_type !== "casual") {
      return res.status(403).json({ success: false, message: "Only casual staff request a branch move here." });
    }
    const { to_branch_id, reason } = req.body;
    const br = await assertActiveBranch(to_branch_id);
    if (!br.ok) return res.status(400).json({ success: false, message: br.message });
    if (me.branch_id && String(me.branch_id) === String(br.branch._id)) {
      return res.status(400).json({ success: false, message: "That is already your branch." });
    }

    const open = await BranchMoveRequest.findOne({ user_id: me._id, status: { $in: ["pending", "processing"] } }).lean();
    if (open) return res.status(409).json({ success: false, message: "You already have a branch request waiting for a decision." });

    const recent = await BranchMoveRequest.findOne({ user_id: me._id, createdAt: { $gte: new Date(Date.now() - WEEK_MS) } }).lean();
    if (recent) return res.status(429).json({ success: false, message: "You can send one branch request per week." });

    const doc = await BranchMoveRequest.create({
      user_id: me._id,
      from_branch_id: me.branch_id || null,
      to_branch_id: br.branch._id,
      reason: String(reason).trim(),
      status: "pending",
    });
    res.status(201).json({ success: true, message: "Request sent. A supervisor of that branch, an admin or a general supervisor will decide.", data: { _id: doc._id } });
  } catch (err) {
    console.error("[branchMove.createBranchRequest]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── Approvers: supervisor (own branch only), general supervisor and admin (any branch) ──
// The staff in a branch, shown to casual staff so they can see where they would be working.
// Names, roles and staff IDs only; phone numbers stay private.
exports.branchMembers = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("employment_type").lean();
    if (!me || me.employment_type !== "casual") {
      return res.status(403).json({ success: false, message: "This section is for casual staff." });
    }
    const br = await Branch.findById(req.params.id).select("name is_active").lean();
    if (!br || br.is_active === false) return res.status(404).json({ success: false, message: "Branch not found." });
    const members = await User.find({
      branch_id: br._id,
      role: { $in: ["staff", "supervisor"] },
      status: "approved",
      is_active: true,
      deleted_at: null,
    })
      .select("name role staffId employment_type")
      .sort({ role: -1, name: 1 })
      .limit(300)
      .lean();
    res.json({
      success: true,
      data: {
        branch: { id: br._id, name: br.name },
        members: members.map((m) => ({ name: m.name, role: m.role, staffId: m.staffId || null, employment_type: m.employment_type || null })),
      },
    });
  } catch (err) {
    console.error("[branchMove.branchMembers]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.listBranchRequests = async (req, res) => {
  try {
    const filter = { status: "pending" };
    if (req.user.role === "supervisor") filter.to_branch_id = req.user.branch_id;
    const rows = await BranchMoveRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("user_id", "name staffId phone")
      .populate("from_branch_id", "name")
      .populate("to_branch_id", "name")
      .lean();
    res.json({ success: true, data: rows.map(shape) });
  } catch (err) {
    console.error("[branchMove.listBranchRequests]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.decideBranchRequest = async (req, res) => {
  try {
    const { decision } = req.body;
    const note = String(req.body.note || "").trim();
    const doc = await BranchMoveRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Request not found." });
    if (req.user.role !== "supervisor") {
      return res.status(403).json({ success: false, message: "Only the supervisor of the requested branch approves casual branch requests. Admins and general supervisors can view them." });
    }
    if (String(req.user.branch_id) !== String(doc.to_branch_id)) {
      return res.status(403).json({ success: false, message: "You can only decide requests for your own branch." });
    }

    // Claim the request atomically so two approvers can't both move the same person.
    const claimed = await BranchMoveRequest.findOneAndUpdate(
      { _id: doc._id, status: "pending" },
      { $set: { status: "processing" } },
      { new: true }
    );
    if (!claimed) {
      const now = await BranchMoveRequest.findById(doc._id).lean();
      return res.status(409).json({ success: false, message: `This request was already ${now.status === "processing" ? "being decided" : now.status}.` });
    }

    try {
      if (decision === "approve") {
        const person = await User.findById(doc.user_id);
        if (!person || !person.is_active || person.employment_type !== "casual") {
          await BranchMoveRequest.updateOne({ _id: doc._id }, { $set: { status: "pending" } });
          return res.status(400).json({ success: false, message: "This person can no longer change branch." });
        }
        const br = await assertActiveBranch(doc.to_branch_id);
        if (!br.ok) {
          await BranchMoveRequest.updateOne({ _id: doc._id }, { $set: { status: "pending" } });
          return res.status(400).json({ success: false, message: br.message });
        }
        person.branch_id = br.branch._id;
        person.branch = br.branch._id;
        person.last_branch_change = new Date();
        await person.save();
      }

      claimed.status = decision === "approve" ? "approved" : "rejected";
      claimed.decided_by = req.user._id;
      claimed.decided_role = req.user.role;
      claimed.decided_at = new Date();
      claimed.decision_note = note;
      await claimed.save();
    } catch (inner) {
      await BranchMoveRequest.updateOne({ _id: doc._id }, { $set: { status: "pending" } });
      throw inner;
    }

    await audit(req, decision === "approve" ? "BRANCH_MOVE_APPROVED" : "BRANCH_MOVE_REJECTED", doc.user_id, {
      to_branch_id: doc.to_branch_id,
      decided_role: req.user.role,
      note,
    });
    res.json({
      success: true,
      message: decision === "approve" ? "Move approved. The person now works at the new branch." : "Request rejected.",
      data: { _id: claimed._id, status: claimed.status },
    });
  } catch (err) {
    console.error("[branchMove.decideBranchRequest]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
