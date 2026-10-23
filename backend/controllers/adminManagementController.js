const User = require("../models/User");

exports.listAdmins = async (req, res) => {
  try {
    const rows = await User.find({ role: "admin", deleted_at: null }).select("name email is_active createdAt").sort({ name: 1 }).lean();
    res.json({ success: true, data: rows.map((a) => ({ _id: a._id, name: a.name, email: a.email, is_active: a.is_active !== false, you: String(a._id) === String(req.user._id) })) });
  } catch (err) {
    console.error("[admins.list]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
