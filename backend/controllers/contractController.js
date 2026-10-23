const Contract = require("../models/Contract");
const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const Notification = require("../models/Notification");
const { buildEmploymentAgreement } = require("../utils/contractTemplate");
const AuditLog = require("../models/AuditLog");

const getIP = (req) => req.ip || req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";

// Contracts are for the permanent staff level. That level is stored as employment type
// "contract" (older records may say "permanent"). One rule is used everywhere: the form,
// the list of people you can pick, and the create check.
const CONTRACT_TYPES = ["contract", "permanent"];
const isContractStaff = (user, profile) =>
  user.role === "staff" && (CONTRACT_TYPES.includes(user.employment_type) || profile?.type === "contract");
const getUA = (req) => req.headers["user-agent"] || "unknown";

const writeAudit = async (action, req, targetId, targetType, before, after, metadata = {}) => {
  try {
    await AuditLog.create({
      action,
      admin_id: req.user._id,
      target_id: targetId,
      target_type: targetType,
      module: "contracts",
      ip_address: getIP(req),
      user_agent: getUA(req),
      before,
      after,
      metadata,
    });
  } catch (e) {
    console.error("[audit contract]", e.message);
  }
};

exports.createContract = async (req, res) => {
  try {
    let { staff_id, start_date, end_date } = req.body;
    let contract_text = req.body.contract_text;
    const useTemplate = !contract_text || req.body.use_template === true;

    const user = await User.findById(staff_id);
    if (!user || user.role !== "staff")
      return res.status(400).json({ success: false, message: "Target must be an active staff user." });

    if (!user.is_active || user.status !== "approved")
      return res.status(400).json({ success: false, message: "Only approved, active staff can be given a contract." });

    const profile = await StaffProfile.findOne({ user_id: staff_id });
    if (!isContractStaff(user, profile))
      return res.status(400).json({ success: false, message: "Contracts can only be given to permanent (contract-level) staff." });

    if (useTemplate) {
      const position = String(req.body.position || "Trolley Boy").trim();
      const salary = Number(req.body.salary) || 17482;
      const termMonths = Number(req.body.term_months) || 3;
      const placeOfWork = String(req.body.place_of_work || "").trim();
      if (position.length < 2 || position.length > 60)
        return res.status(400).json({ success: false, message: "Position must be 2–60 characters." });
      if (!Number.isFinite(salary) || salary < 1000 || salary > 10000000)
        return res.status(400).json({ success: false, message: "Monthly salary must be between 1,000 and 10,000,000." });
      if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 36)
        return res.status(400).json({ success: false, message: "Term must be 1–36 months." });
      if (!start_date || Number.isNaN(new Date(start_date).getTime()))
        return res.status(400).json({ success: false, message: "Choose a start date." });
      const startAt = new Date(start_date);
      const endAt = new Date(startAt);
      endAt.setMonth(endAt.getMonth() + termMonths);
      end_date = endAt.toISOString();
      contract_text = buildEmploymentAgreement({
        employeeName: user.name,
        idNumber: user.idNumber,
        position,
        salary,
        startDate: startAt,
        termMonths,
        placeOfWork: placeOfWork || undefined,
      });
    }
    if (!contract_text || contract_text.length < 10)
      return res.status(400).json({ success: false, message: "Contract text is required." });

    if (useTemplate && profile) {
      profile.monthly_salary = Number(req.body.salary) || 17482;
      profile.position = String(req.body.position || "Trolley Boy").trim();
      await profile.save();
    }
    const waiting = await Contract.findOne({ staff_id, accepted: false }).lean();
    if (waiting)
      return res.status(409).json({ success: false, message: "This person already has a contract waiting to be signed. Wait for it to be signed or ask them to contact admin." });

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (end <= start) return res.status(400).json({ success: false, message: "End date must be after start date." });

    const doc = await Contract.create({
      staff_id,
      contract_text,
      start_date: start,
      end_date: end,
      accepted: false,
      created_by: req.user._id,
    });

    await writeAudit("CREATE_CONTRACT", req, doc._id, "contract", null, { staff_id, start_date: start, end_date: end });
    // The contract is already saved, so a notification problem must not report the whole request as failed.
    try {
      await Notification.create({
        user_id: staff_id,
        message: "You have a new employment contract to read and accept before clocking in.",
        type: "warning",
      });
    } catch (e) {
      console.error("[createContract notification]", e.message);
    }

    res.status(201).json({ success: true, message: "Contract created. Staff must accept it to work.", data: doc });
  } catch (err) {
    console.error("[createContract]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.listContracts = async (req, res) => {
  try {
    const { staff_id, accepted } = req.query;
    const q = {};
    if (staff_id) q.staff_id = staff_id;
    if (accepted !== undefined) q.accepted = accepted === "true";

    const list = await Contract.find(q)
      .populate("staff_id", "name email")
      .populate("created_by", "name")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getMyContract = async (req, res) => {
  try {
    const pending = await Contract.findOne({
      staff_id: req.user._id,
      accepted: false,
    }).sort({ createdAt: -1 });

    const activeSigned = await Contract.findOne({
      staff_id: req.user._id,
      accepted: true,
    })
      .sort({ signed_at: -1 })
      .limit(1);

    const profile = await StaffProfile.findOne({ user_id: req.user._id });

    res.json({
      success: true,
      data: {
        staff_type: profile?.type || null,
        pending_contract: pending,
        latest_signed: activeSigned,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.acceptContract = async (req, res) => {
  try {
    const { contract_id } = req.body;
    if (!contract_id) return res.status(400).json({ success: false, message: "contract_id required." });

    const c = await Contract.findOne({ _id: contract_id, staff_id: req.user._id, accepted: false });
    if (!c) return res.status(404).json({ success: false, message: "No pending contract found for you." });

    c.accepted = true;
    c.signed_at = new Date();
    await c.save();

    await AuditLog.create({
      action: "ACCEPT_CONTRACT",
      admin_id: req.user._id,
      target_id: c._id,
      target_type: "contract",
      module: "contracts",
      ip_address: getIP(req),
      user_agent: getUA(req),
      after: { accepted: true, signed_at: c.signed_at },
    });

    await Notification.create({
      user_id: req.user._id,
      message: "You accepted your employment contract. You may clock in when within branch geofence.",
      type: "info",
    });

    res.json({ success: true, message: "Contract accepted.", data: c });
  } catch (err) {
    console.error("[acceptContract]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// People the contract form can offer: approved, active staff at contract level, with whether
// they already have a contract waiting to be signed.
exports.contractCandidates = async (req, res) => {
  try {
    const users = await User.find({
      role: "staff",
      status: "approved",
      is_active: true,
      deleted_at: null,
      employment_type: { $in: CONTRACT_TYPES },
    })
      .select("name email staffId employment_type branch_id")
      .populate("branch_id", "name")
      .sort({ name: 1 })
      .limit(500)
      .lean();
    const ids = users.map((u) => u._id);
    const waiting = await Contract.find({ staff_id: { $in: ids }, accepted: false }).select("staff_id").lean();
    const waitingSet = new Set(waiting.map((c) => String(c.staff_id)));
    res.json({
      success: true,
      data: users.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        staffId: u.staffId || null,
        branch: u.branch_id && u.branch_id.name ? u.branch_id.name : null,
        has_waiting_contract: waitingSet.has(String(u._id)),
      })),
    });
  } catch (err) {
    console.error("[contractCandidates]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports.isContractStaff = isContractStaff;

