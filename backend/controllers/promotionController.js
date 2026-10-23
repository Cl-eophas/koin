const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const promotionService = require("../services/promotionService");

const getIP = (req) => req.ip || req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
const getUA = (req) => req.headers["user-agent"] || "unknown";

async function writePromotionAudit(req, action, user_id, old_value, new_value, extra = {}) {
  try {
    await AuditLog.create({
      action,
      admin_id: req.user._id,
      target_id: new mongoose.Types.ObjectId(user_id),
      target_type: "user",
      module: "promotion",
      ip_address: getIP(req),
      user_agent: getUA(req),
      metadata: { admin_id: req.user._id.toString(), user_id, old_value, new_value, ...extra },
    });
  } catch (e) {
    console.error("[promotion audit]", e.message);
  }
}

exports.promoteRole = async (req, res) => {
  try {
    const { user_id, new_role, branch_id } = req.body;
    const r = await promotionService.promoteRole({ user_id, new_role, branch_id });
    if (!r.ok) return res.status(r.code).json({ success: false, message: r.message });
    await writePromotionAudit(req, "PROMOTION", user_id, r.old_value, r.new_value, { kind: "role" });
    res.json({
      success: true,
      message: "Role updated.",
      data: { user: r.user, condition_warnings: r.condition_warnings },
    });
  } catch (err) {
    console.error("[promoteRole]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.demoteRole = async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: "user_id required." });
    const r = await promotionService.demoteRole({ user_id });
    if (!r.ok) return res.status(r.code).json({ success: false, message: r.message });
    await writePromotionAudit(req, "PROMOTION", user_id, r.old_value, r.new_value, { kind: "role_demote" });
    res.json({
      success: true,
      message: "Supervisor demoted to staff.",
      data: { user: r.user, condition_warnings: r.condition_warnings },
    });
  } catch (err) {
    console.error("[demoteRole]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.promoteEmployment = async (req, res) => {
  try {
    const { staff_id, new_type, branch_id } = req.body;
    const r = await promotionService.promoteEmployment({ staff_id, new_type, branch_id });
    if (!r.ok) return res.status(r.code).json({ success: false, message: r.message });
    await writePromotionAudit(req, "PROMOTION", staff_id, r.old_value, r.new_value, { kind: "employment" });
    res.json({
      success: true,
      message: "Employment type upgraded.",
      data: { profile: r.profile, condition_warnings: r.condition_warnings },
    });
  } catch (err) {
    console.error("[promoteEmployment]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.promoteOneLevel = async (req, res) => {
  try {
    const { user_id, branch_id } = req.body;
    const r = await promotionService.promoteOneLevel({ user_id, branch_id });
    if (!r.ok) return res.status(r.code).json({ success: false, message: r.message });
    await writePromotionAudit(req, "PROMOTION", user_id, r.from.level, r.to.level, {
      kind: "ladder",
      branch_id: r.to.branch_id || null,
    });
    res.json({
      success: true,
      message: `Promoted to ${r.to.level.replace(/_/g, " ")}.${r.demoted && r.demoted.length ? ` ${r.demoted.join(", ")} moved back to Staff.` : ""}`,
      data: { user: r.user, from: r.from.level, to: r.to.level, condition_warnings: r.condition_warnings },
    });
  } catch (err) {
    console.error("[promoteOneLevel]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
