const User = require("../models/User");
const Message = require("../models/Message");

// Who may message whom:
//  - admins and general supervisors reach everyone
//  - a supervisor reaches the staff and supervisors of their branch, plus admins and general supervisors
//  - staff reach the supervisors of their branch, plus admins and general supervisors
function canMessage(me, other) {
  if (!other || !other.is_active || other.deleted_at) return false;
  if (String(me._id) === String(other._id)) return false;
  if (["admin", "general_supervisor"].includes(me.role)) return true;
  if (["admin", "general_supervisor"].includes(other.role)) return true;
  const sameBranch = me.branch_id && other.branch_id && String(me.branch_id) === String(other.branch_id);
  if (!sameBranch) return false;
  if (me.role === "supervisor") return ["staff", "supervisor"].includes(other.role);
  if (me.role === "staff") return other.role === "supervisor";
  return false;
}

exports.canMessage = canMessage;

exports.contacts = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("role branch_id").lean();
    const filter = { is_active: true, deleted_at: null, _id: { $ne: me._id } };
    if (!["admin", "general_supervisor"].includes(me.role)) {
      filter.$or = [
        { role: { $in: ["admin", "general_supervisor"] } },
        ...(me.branch_id ? [{ branch_id: me.branch_id, role: me.role === "staff" ? "supervisor" : { $in: ["staff", "supervisor"] } }] : []),
      ];
    }
    const people = await User.find(filter).select("name role staffId branch_id").populate("branch_id", "name").sort({ name: 1 }).limit(300).lean();
    const unread = await Message.aggregate([
      { $match: { to_id: me._id, read_at: null } },
      { $group: { _id: "$from_id", n: { $sum: 1 } } },
    ]);
    const unreadBy = new Map(unread.map((u) => [String(u._id), u.n]));
    res.json({
      success: true,
      data: people.map((p) => ({
        _id: p._id,
        name: p.name,
        role: p.role,
        staffId: p.staffId || null,
        branch: p.branch_id && p.branch_id.name ? p.branch_id.name : null,
        unread: unreadBy.get(String(p._id)) || 0,
      })),
    });
  } catch (err) {
    console.error("[messages.contacts]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.thread = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("role branch_id is_active deleted_at").lean();
    const other = await User.findById(req.params.userId).select("role branch_id is_active deleted_at name").lean();
    if (!canMessage(me, other)) return res.status(403).json({ success: false, message: "You can't message this person." });
    const rows = await Message.find({
      $or: [
        { from_id: me._id, to_id: other._id },
        { from_id: other._id, to_id: me._id },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    await Message.updateMany({ from_id: other._id, to_id: me._id, read_at: null }, { $set: { read_at: new Date() } });
    res.json({
      success: true,
      data: {
        with: { _id: other._id, name: other.name },
        messages: rows.reverse().map((m) => ({ _id: m._id, mine: String(m.from_id) === String(me._id), body: m.body, at: m.createdAt })),
      },
    });
  } catch (err) {
    console.error("[messages.thread]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.send = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("role branch_id is_active deleted_at").lean();
    const other = await User.findById(req.body.to_user_id).select("role branch_id is_active deleted_at").lean();
    if (!canMessage(me, other)) return res.status(403).json({ success: false, message: "You can't message this person." });
    const doc = await Message.create({ from_id: me._id, to_id: other._id, body: String(req.body.body).trim() });
    res.status(201).json({ success: true, data: { _id: doc._id, mine: true, body: doc.body, at: doc.createdAt } });
  } catch (err) {
    console.error("[messages.send]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.unreadCount = async (req, res) => {
  const n = await Message.countDocuments({ to_id: req.user._id, read_at: null });
  res.json({ success: true, data: { unread: n } });
};
