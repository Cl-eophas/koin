const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const PaymentRecord = require("../models/PaymentRecord");
const Notification = require("../models/Notification");
const Message = require("../models/Message");
const Session = require("../models/Session");
const AuditLog = require("../models/AuditLog");
const { uploadDir } = require("../utils/upload");

async function audit(req, action, userId, metadata) {
  try {
    await AuditLog.create({ action, admin_id: req.user._id, target_id: userId, target_type: "user", module: "data_rights", ip_address: req.ip, user_agent: req.headers["user-agent"], metadata });
  } catch (e) {
    console.error("[data rights audit]", e.message);
  }
}

exports.exportUser = async (req, res) => {
  try {
    const id = req.params.id;
    const user = await User.findById(id).select("-password -refresh_token_hash -totp_secret -password_reset_token_hash -email_verification_token_hash").lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const [profile, attendance, leave, payments, notifications, messages] = await Promise.all([
      StaffProfile.findOne({ user_id: id }).lean(),
      Attendance.find({ staff_id: id }).lean(),
      Leave.find({ staff_id: id }).lean(),
      PaymentRecord.find({ user_id: id }).lean(),
      Notification.find({ user_id: id }).lean(),
      Message.find({ $or: [{ from_id: id }, { to_id: id }] }).lean(),
    ]);
    await audit(req, "DATA_EXPORTED", id, { records: { attendance: attendance.length, leave: leave.length, payments: payments.length } });
    const bundle = { exported_at: new Date().toISOString(), user, profile, attendance, leave, payments, notifications, messages };
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="data-${id}.json"`);
    res.send(JSON.stringify(bundle, null, 2));
  } catch (err) {
    console.error("[dataRights.export]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Erasure: personal details are removed. Attendance and payment history stay (needed for pay records and
// tax), but they point at an anonymous record. The person can no longer sign in.
exports.eraseUser = async (req, res) => {
  try {
    const id = req.params.id;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (String(user._id) === String(req.user._id)) return res.status(400).json({ success: false, message: "You can't erase your own account." });
    if (String(req.body.confirm || "").trim() !== String(user.name || "").trim())
      return res.status(400).json({ success: false, message: "Type the person's full name exactly to confirm." });

    const files = Object.values(user.documents || {}).filter(Boolean);
    for (const f of files) {
      const full = path.join(uploadDir, path.basename(f));
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
    await StaffProfile.updateMany({ user_id: id }, { $unset: { id_number: 1, kra_pin: 1, nssf_number: 1, nhif_number: 1, bank_name: 1, bank_branch: 1, account_number: 1, phone: 1 } }).catch(() => {});
    await Notification.deleteMany({ user_id: id });
    await Message.updateMany({ $or: [{ from_id: id }, { to_id: id }] }, { $set: { body: "[message removed]" } });
    await Session.deleteMany({ user_id: id }).catch(() => {});

    await User.updateOne(
      { _id: id },
      {
        $set: {
          name: "Erased user",
          email: `erased-${id}@erased.invalid`,
          status: "rejected",
          is_active: false,
          deleted_at: new Date(),
          notification_prefs: {},
        },
        $unset: { phone: 1, idNumber: 1, kraPin: 1, nssf: 1, nhif: 1, bank: 1, documents: 1, googleId: 1, totp_secret: 1, password_reset_token_hash: 1, password_reset_expires: 1, email_verification_token_hash: 1, email_verification_expires: 1, refresh_token_hash: 1 },
      }
    );
    await audit(req, "DATA_ERASED", id, { files_removed: files.length });
    res.json({ success: true, message: "Personal details erased. Pay and attendance history is kept without the person's name." });
  } catch (err) {
    console.error("[dataRights.erase]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
