const User = require("../models/User");
const Notification = require("../models/Notification");
const { NOTICE_DAYS } = require("../utils/employment");

const DAY = 24 * 60 * 60 * 1000;

// Resignation: 7 days' notice. The last working day is 7 days after the request; clock-in closes after it.
exports.resign = async (req, res) => {
  try {
    const me = await User.findById(req.user._id);
    if (!me || me.role !== "staff") return res.status(403).json({ success: false, message: "Only staff can resign here." });
    if (me.resignation && me.resignation.status === "notice") {
      return res.status(409).json({ success: false, message: "You already have a resignation on notice." });
    }
    if (me.resignation && me.resignation.status === "ended") {
      return res.status(409).json({ success: false, message: "Your employment has already ended." });
    }
    const now = new Date();
    const lastDay = new Date(now.getTime() + NOTICE_DAYS * DAY);
    me.resignation = { status: "notice", submitted_at: now, last_working_day: lastDay, reason: String(req.body.reason || "").trim() };
    await me.save({ validateModifiedOnly: true });

    try {
      const recipients = await User.find({
        is_active: true,
        deleted_at: null,
        $or: [{ role: "admin" }, ...(me.branch_id ? [{ role: "supervisor", branch_id: me.branch_id }] : [])],
      }).select("_id").lean();
      await Notification.insertMany(
        recipients.map((u) => ({
          user_id: u._id,
          message: `${me.name} has resigned. Notice runs to ${lastDay.toLocaleDateString()} (${NOTICE_DAYS} days).`,
          type: "info",
        }))
      );
    } catch (e) {
      console.error("[resign notify]", e.message);
    }
    res.json({ success: true, message: `Resignation recorded. Your last working day is ${lastDay.toLocaleDateString()}.`, data: me.resignation });
  } catch (err) {
    console.error("[employment.resign]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.withdrawResignation = async (req, res) => {
  try {
    const me = await User.findById(req.user._id);
    if (!me || !me.resignation || me.resignation.status !== "notice") {
      return res.status(400).json({ success: false, message: "There is no resignation on notice." });
    }
    me.resignation = { ...me.resignation, status: "withdrawn", withdrawn_at: new Date() };
    await me.save({ validateModifiedOnly: true });
    res.json({ success: true, message: "Resignation withdrawn.", data: me.resignation });
  } catch (err) {
    console.error("[employment.withdraw]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
