const User = require("../models/User");
const Notification = require("../models/Notification");

/**
 * Create an in-app notification for every admin account.
 */
async function notifyAdmins({ message, type = "info" }) {
  if (!message) return;
  const admins = await User.find({ role: "admin", deleted_at: null }).select("_id").lean();
  if (!admins.length) return;
  await Promise.all(
    admins.map((a) =>
      Notification.create({
        user_id: a._id,
        type,
        message,
      })
    )
  );
}

module.exports = { notifyAdmins };
