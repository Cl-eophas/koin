const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const SecurityEvent = require("../models/SecurityEvent");
const AttendanceReport = require("../models/AttendanceReport");
const StaffRequest = require("../models/StaffRequest");
const BranchMoveRequest = require("../models/BranchMoveRequest");
const User = require("../models/User");
const Leave = require("../models/Leave");
const { uploadDir } = require("../utils/upload");
const { storageInfo } = require("../utils/storage");

const DAY = 24 * 60 * 60 * 1000;
const MIN_AGE_DAYS = 30; // nothing newer than this can be removed
const MAX_EXPORT_ROWS = 200000; // one export file holds at most this many records
const TOKEN_MINUTES = 30; // how long a finished export allows its matching delete

// Each category says exactly what it removes. "filter" receives the cutoff Date.
const CATEGORIES = {
  notifications_read: { label: "Read notifications", note: "Notifications a user has already read.", model: Notification, filter: (b) => ({ is_read: true, createdAt: { $lt: b } }) },
  security_events_resolved: { label: "Resolved security events", note: "Security events that have been resolved.", model: SecurityEvent, filter: (b) => ({ resolved: true, created_at: { $lt: b } }) },
  attendance_reports: { label: "Saved attendance reports", note: "Stored report snapshots. They are rebuilt from attendance records when needed.", model: AttendanceReport, filter: (b) => ({ $or: [{ createdAt: { $lt: b } }, { created_at: { $lt: b } }] }) },
  closed_staff_requests: { label: "Closed staff requests", note: "Supervisor staff requests that were fulfilled or rejected.", model: StaffRequest, filter: (b) => ({ status: { $in: ["fulfilled", "rejected"] }, createdAt: { $lt: b } }) },
  closed_branch_moves: { label: "Closed branch move requests", note: "Casual branch move requests that were approved or rejected.", model: BranchMoveRequest, filter: (b) => ({ status: { $in: ["approved", "rejected"] }, createdAt: { $lt: b } }) },
  audit_logs: { label: "Audit log", note: "The record of who changed what. Export and delete only if your policy allows it.", model: AuditLog, filter: (b) => ({ timestamp: { $lt: b } }) },
  attendance_records: { label: "Attendance records", note: "Clock-in and clock-out history. Payroll and reports use this. Needs at least a year of age and the phrase DELETE ATTENDANCE.", model: Attendance, minAgeDays: 365, confirmPhrase: "DELETE ATTENDANCE", filter: (b) => ({ date: { $lt: b.toISOString().slice(0, 10) } }) },
  orphan_files: { label: "Unused uploaded files", note: "Files in the uploads folder that no user or leave request refers to any more. The export lists them.", special: true },
};

// One-time tokens: a finished export unlocks exactly one matching delete, for a short time.
const exportTokens = new Map();

const uploadsList = () => {
  if (!fs.existsSync(uploadDir)) return [];
  return fs.readdirSync(uploadDir).filter((f) => f !== ".gitkeep").map((f) => ({ name: f, full: path.join(uploadDir, f) })).filter((f) => fs.statSync(f.full).isFile());
};

async function referencedFiles() {
  const refs = new Set();
  const users = await User.find({ documents: { $exists: true } }).select("documents").lean();
  for (const u of users) for (const v of Object.values(u.documents || {})) if (v) refs.add(v);
  const leaves = await Leave.find({ medical_document: { $ne: null } }).select("medical_document").lean();
  for (const l of leaves) if (l.medical_document) refs.add(l.medical_document);
  return refs;
}

async function orphanFiles() {
  const refs = await referencedFiles();
  return uploadsList().filter((f) => !refs.has(f.name));
}

async function storeSize(model) {
  try {
    const stats = await model.collection.stats();
    return { bytes: stats.storageSize || stats.size || 0, measured: true };
  } catch {
    return { bytes: null, measured: false };
  }
}

function parseCutoff(category, before) {
  const cat = CATEGORIES[category];
  if (!cat || cat.special) return null;
  const minDays = cat.minAgeDays || MIN_AGE_DAYS;
  const latest = new Date(Date.now() - minDays * DAY);
  const cutoff = before ? new Date(before) : latest;
  if (Number.isNaN(cutoff.getTime())) return { error: "Choose a valid cutoff date." };
  if (cutoff > latest) return { error: `Only data older than ${minDays} days can be removed.` };
  return { cutoff };
}

function cleanExpiredTokens() {
  const now = Date.now();
  for (const [k, v] of exportTokens) if (v.exp < now) exportTokens.delete(k);
}

exports.usage = async (req, res) => {
  try {
    const stores = [];
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      if (cat.special) continue;
      const count = await cat.model.countDocuments({});
      const size = await storeSize(cat.model);
      stores.push({ key, label: cat.label, note: cat.note, count, bytes: size.bytes, size_measured: size.measured });
    }
    const files = uploadsList();
    const fileBytes = files.reduce((n, f) => n + fs.statSync(f.full).size, 0);
    const orphans = await orphanFiles();
    res.json({
      success: true,
      data: {
        stores,
        storage: await storageInfo(),
        uploads: { count: files.length, bytes: fileBytes, unused_count: orphans.length },
        min_age_days: MIN_AGE_DAYS,
      },
    });
  } catch (err) {
    console.error("[data.usage]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.preview = async (req, res) => {
  try {
    const { category, before } = req.body;
    const cat = CATEGORIES[category];
    if (!cat) return res.status(400).json({ success: false, message: "Unknown category." });
    if (cat.special) {
      const orphans = await orphanFiles();
      const bytes = orphans.reduce((n, f) => n + fs.statSync(f.full).size, 0);
      return res.json({ success: true, data: { count: orphans.length, bytes, cutoff: null, phrase: "DELETE", note: cat.note } });
    }
    const parsed = parseCutoff(category, before);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    const count = await cat.model.countDocuments(cat.filter(parsed.cutoff));
    res.json({ success: true, data: { count, cutoff: parsed.cutoff, phrase: cat.confirmPhrase || "DELETE", note: cat.note } });
  } catch (err) {
    console.error("[data.preview]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Step 1 of a delete: download every record that will be removed. The file is the admin's copy.
exports.exportCategory = async (req, res) => {
  try {
    const { category, before } = req.query;
    const cat = CATEGORIES[category];
    if (!cat) return res.status(400).json({ success: false, message: "Unknown category." });
    cleanExpiredTokens();
    const token = crypto.randomBytes(16).toString("hex");
    const today = new Date().toISOString().slice(0, 10);
    const filename = `koin-export-${category}-${today}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Access-Control-Expose-Headers", "X-Export-Token, Content-Disposition");
    res.setHeader("X-Export-Token", token);

    if (cat.special) {
      const orphans = await orphanFiles();
      exportTokens.set(token, { category, before: null, user: String(req.user._id), exp: Date.now() + TOKEN_MINUTES * 60000 });
      res.setHeader("Content-Type", "application/json");
      return res.send(JSON.stringify({ exported_at: new Date().toISOString(), category, files: orphans.map((f) => ({ name: f.name, bytes: fs.statSync(f.full).size })) }, null, 2));
    }

    const parsed = parseCutoff(category, before);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    const filter = cat.filter(parsed.cutoff);
    const total = await cat.model.countDocuments(filter);
    if (total > MAX_EXPORT_ROWS) {
      return res.status(400).json({ success: false, message: `${total.toLocaleString()} records is too many for one file. Choose an earlier cutoff date and export in parts.` });
    }
    res.setHeader("Content-Type", "application/json");
    res.write("[\n");
    let first = true;
    for await (const doc of cat.model.find(filter).lean().cursor()) {
      res.write((first ? "" : ",\n") + JSON.stringify(doc));
      first = false;
    }
    res.end("\n]\n");
    exportTokens.set(token, { category, before: parsed.cutoff.toISOString(), user: String(req.user._id), exp: Date.now() + TOKEN_MINUTES * 60000 });
    try {
      await AuditLog.create({ action: "DATA_EXPORTED_BEFORE_DELETE", admin_id: req.user._id, target_type: "user", module: "data_retention", ip_address: req.ip, user_agent: req.headers["user-agent"], metadata: { category, before: parsed.cutoff, records: total } });
    } catch (e) {
      console.error("[export audit]", e.message);
    }
  } catch (err) {
    console.error("[data.export]", err);
    if (!res.headersSent) res.status(500).json({ success: false, message: "Server error." });
    else res.end();
  }
};

// Step 2 of a delete: only allowed with the token from the export of the same selection.
exports.purge = async (req, res) => {
  try {
    const { category, before } = req.body;
    const cat = CATEGORIES[category];
    if (!cat) return res.status(400).json({ success: false, message: "Unknown category." });
    const phrase = cat.confirmPhrase || "DELETE";
    if (String(req.body.confirm || "").trim() !== phrase) return res.status(400).json({ success: false, message: `Type ${phrase} to confirm.` });

    cleanExpiredTokens();
    const token = String(req.body.export_token || "");
    const grant = exportTokens.get(token);
    const parsed = cat.special ? null : parseCutoff(category, before);
    if (parsed && parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    const wantBefore = parsed ? parsed.cutoff.toISOString() : null;
    if (!grant || grant.user !== String(req.user._id) || grant.category !== category || grant.before !== wantBefore) {
      return res.status(400).json({ success: false, message: "Download the export of this selection first. Then delete." });
    }
    exportTokens.delete(token); // one use only

    let deleted = 0;
    let freedBytes = 0;
    if (cat.special) {
      for (const f of await orphanFiles()) {
        freedBytes += fs.statSync(f.full).size;
        fs.unlinkSync(f.full);
        deleted++;
      }
    } else {
      const result = await cat.model.deleteMany(cat.filter(parsed.cutoff));
      deleted = result.deletedCount || 0;
    }
    try {
      await AuditLog.create({ action: "DATA_PURGE", admin_id: req.user._id, target_type: "user", module: "data_retention", ip_address: req.ip, user_agent: req.headers["user-agent"], metadata: { category, before: wantBefore, deleted, freed_file_bytes: freedBytes } });
    } catch (e) {
      console.error("[purge audit]", e.message);
    }
    res.json({ success: true, message: `Removed ${deleted} record(s). The database reuses this space for new data.`, data: { deleted, freed_file_bytes: freedBytes } });
  } catch (err) {
    console.error("[data.purge]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
