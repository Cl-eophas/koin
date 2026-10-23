const UniformRequest = require("../models/UniformRequest");
const User = require("../models/User");
const Notification = require("../models/Notification");

exports.createReplacementRequest = async (req, res) => {
  try {
    const { item, size, reason } = req.body;
    const doc = await UniformRequest.create({
      staff_id: req.user._id,
      branch_id: req.user.branch_id || null,
      item: String(item).trim(),
      size: String(size || "").trim(),
      reason: String(reason).trim(),
    });
    // Tell the person's supervisor(s) and the admins. A notification problem must not fail the request.
    try {
      const recipients = await User.find({
        is_active: true,
        deleted_at: null,
        $or: [
          { role: "admin" },
          ...(req.user.branch_id ? [{ role: "supervisor", branch_id: req.user.branch_id }] : []),
        ],
      }).select("_id").lean();
      await Notification.insertMany(
        recipients.map((u) => ({
          user_id: u._id,
          message: `${req.user.name || "A staff member"} requested a replacement ${item}${size ? ` (size ${size})` : ""}: ${reason}`,
          type: "info",
        }))
      );
    } catch (e) {
      console.error("[uniform request notify]", e.message);
    }
    res.status(201).json({ success: true, message: "Replacement request sent to your supervisor and admin.", data: { _id: doc._id, status: doc.status } });
  } catch (err) {
    console.error("[uniformRequest.create]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
