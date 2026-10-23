const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const PaymentRecord = require("../models/PaymentRecord");
const Notification = require("../models/Notification");
const Message = require("../models/Message");

// Everything the system holds about the signed-in person, as one file they can keep.
exports.exportMine = async (req, res) => {
  try {
    const id = req.user._id;
    const [user, profile, attendance, leave, payments, notifications, messages] = await Promise.all([
      User.findById(id).select("-password -refresh_token_hash -totp_secret -password_reset_token_hash -email_verification_token_hash").lean(),
      StaffProfile.findOne({ user_id: id }).lean(),
      Attendance.find({ staff_id: id }).lean(),
      Leave.find({ staff_id: id }).lean(),
      PaymentRecord.find({ user_id: id }).lean(),
      Notification.find({ user_id: id }).lean(),
      Message.find({ $or: [{ from_id: id }, { to_id: id }] }).lean(),
    ]);
    const bundle = { exported_at: new Date().toISOString(), user, profile, attendance, leave, payments, notifications, messages };
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="my-records-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(bundle, null, 2));
  } catch (err) {
    console.error("[selfService.exportMine]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
