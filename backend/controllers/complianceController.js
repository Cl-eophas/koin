const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const PerformanceReview = require("../models/PerformanceReview");
const SalaryAdjustment = require("../models/SalaryAdjustment");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const { probationStatus, NOTICE_DAYS, PROBATION_DAYS } = require("../utils/employment");

const DAY = 24 * 60 * 60 * 1000;
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

async function audit(req, action, target, metadata) {
  try {
    await AuditLog.create({ action, admin_id: req.user._id, target_id: target, target_type: "user", module: "compliance", ip_address: req.ip, user_agent: req.headers["user-agent"], metadata });
  } catch (e) {
    console.error("[compliance audit]", e.message);
  }
}

// Clause 9: a review at least every six months. Counted from the last review, or from joining if there is none.
exports.reviewsDue = async (req, res) => {
  try {
    const now = new Date();
    const staff = await User.find({ role: "staff", status: "approved", is_active: true, deleted_at: null }).select("name staffId employment_type").lean();
    const ids = staff.map((s) => s._id);
    const profiles = await StaffProfile.find({ user_id: { $in: ids } }).select("user_id join_date").lean();
    const joinBy = new Map(profiles.map((p) => [String(p.user_id), p.join_date]));
    const last = await PerformanceReview.aggregate([{ $match: { staff_id: { $in: ids } } }, { $group: { _id: "$staff_id", last: { $max: "$reviewed_on" } } }]);
    const lastBy = new Map(last.map((l) => [String(l._id), l.last]));
    const rows = staff
      .map((s) => {
        const key = String(s._id);
        const baseline = lastBy.get(key) || joinBy.get(key);
        const due = baseline ? addMonths(baseline, 6) : null;
        return {
          _id: s._id,
          name: s.name,
          staffId: s.staffId || null,
          last_review: lastBy.get(key) || null,
          joined: joinBy.get(key) || null,
          due_on: due,
          overdue: due ? now > due : false,
        };
      })
      .sort((a, b) => (a.due_on ? new Date(a.due_on) : 0) - (b.due_on ? new Date(b.due_on) : 0));
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("[compliance.reviewsDue]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.recordReview = async (req, res) => {
  try {
    const { staff_id, rating, summary } = req.body;
    const doc = await PerformanceReview.create({
      staff_id,
      reviewed_on: req.body.reviewed_on ? new Date(req.body.reviewed_on) : new Date(),
      reviewer_id: req.user._id,
      rating: Number(rating),
      summary: String(summary).trim(),
    });
    await audit(req, "PERFORMANCE_REVIEW_RECORDED", staff_id, { rating: doc.rating });
    res.status(201).json({ success: true, message: "Review recorded.", data: { _id: doc._id } });
  } catch (err) {
    console.error("[compliance.recordReview]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.listReviews = async (req, res) => {
  try {
    const rows = await PerformanceReview.find({ staff_id: req.query.staff_id }).sort({ reviewed_on: -1 }).limit(50).lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("[compliance.listReviews]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.addAdjustment = async (req, res) => {
  try {
    const { user_id, type, amount, period, reason } = req.body;
    const person = await User.findById(user_id).select("role status is_active").lean();
    if (!person || person.role !== "staff" || person.status !== "approved" || !person.is_active) {
      return res.status(400).json({ success: false, message: "Adjustments can only be made for active, approved staff." });
    }
    const doc = await SalaryAdjustment.create({ user_id, period, type, amount: Number(amount), reason: String(reason).trim(), created_by: req.user._id });
    await audit(req, "SALARY_ADJUSTMENT", user_id, { period, type, amount: doc.amount, reason: doc.reason });
    res.status(201).json({ success: true, message: `${type === "deduction" ? "Deduction" : "Addition"} recorded for ${period}. It applies on the next payroll run for that month.`, data: { _id: doc._id } });
  } catch (err) {
    console.error("[compliance.addAdjustment]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.listAdjustments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.user_id) filter.user_id = req.query.user_id;
    if (req.query.period) filter.period = req.query.period;
    const rows = await SalaryAdjustment.find(filter).sort({ createdAt: -1 }).limit(200).populate("user_id", "name").lean();
    res.json({ success: true, data: rows.map((r) => ({ _id: r._id, name: r.user_id?.name || "—", period: r.period, type: r.type, amount: r.amount, reason: r.reason })) });
  } catch (err) {
    console.error("[compliance.listAdjustments]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Clause 11 and 12: how employment ends.
//  - misconduct (11 a iii): dismissed without notice, effective at once
//  - ill health (12): 7 days' notice of the date
//  - other (11 c, 8): during probation, effective at once; after probation, 7 days' notice
exports.terminate = async (req, res) => {
  try {
    const { user_id, reason_type, reason } = req.body;
    const person = await User.findById(user_id);
    if (!person || person.role !== "staff") return res.status(400).json({ success: false, message: "Only staff can be terminated here." });
    if (person.resignation && ["notice", "ended"].includes(person.resignation.status)) {
      return res.status(409).json({ success: false, message: "This person already has employment ending." });
    }
    const profile = await StaffProfile.findOne({ user_id }).select("join_date").lean();
    const now = new Date();
    const onProbation = probationStatus(profile?.join_date, now).on_probation;

    let status;
    let lastDay = null;
    if (reason_type === "misconduct" || (reason_type === "employer_other" && onProbation)) {
      status = "ended";
    } else {
      status = "notice";
      lastDay = new Date(now.getTime() + NOTICE_DAYS * DAY);
    }
    person.resignation = {
      type: "employer",
      status,
      submitted_at: now,
      last_working_day: lastDay,
      reason_type,
      reason: String(reason).trim(),
    };
    await person.save({ validateModifiedOnly: true });

    try {
      const admins = await User.find({ role: "admin", is_active: true, deleted_at: null }).select("_id").lean();
      await Notification.insertMany(admins.map((a) => ({
        user_id: a._id,
        message: `${person.name}'s employment ${status === "ended" ? "has ended" : `ends ${lastDay.toLocaleDateString()}`} (${reason_type.replace(/_/g, " ")}).`,
        type: "info",
      })));
    } catch (e) {
      console.error("[terminate notify]", e.message);
    }
    await audit(req, "EMPLOYMENT_ENDED", user_id, { reason_type, status, last_working_day: lastDay });
    res.json({
      success: true,
      message: status === "ended" ? "Employment ended. Clock-in is closed." : `Notice given. Last working day is ${lastDay.toLocaleDateString()}.`,
      data: person.resignation,
    });
  } catch (err) {
    console.error("[compliance.terminate]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
