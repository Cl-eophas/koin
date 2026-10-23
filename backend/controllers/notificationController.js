const Notification = require("../models/Notification");

exports.getNotifications = async (req, res) => {
  try {
    const list = await Notification.find({ user_id: req.user._id }).sort({ createdAt: -1 }).limit(50);
    const unread_count = await Notification.countDocuments({ user_id: req.user._id, is_read: false });
    res.json({ success: true, data: list, unread_count });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { notification_ids } = req.body;
    const filter = { user_id: req.user._id };
    if (Array.isArray(notification_ids) && notification_ids.length > 0) filter._id = { $in: notification_ids };

    await Notification.updateMany(filter, { $set: { is_read: true, read_at: new Date() } });
    res.json({ success: true, message: "Notifications updated." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};
