const path = require("path");
const fs = require("fs");
const Leave = require("../models/Leave");
const User = require("../models/User");
const { uploadDir } = require("../utils/upload");

// Files are named doc_<ownerUserId>_<timestamp>.<ext> (see utils/upload.js).
const NAME_RE = /^doc_([a-f0-9]{24})_(\d{10,16})\.(pdf|jpe?g|png)$/i;
const MIME = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };

// GET /api/files/:filename — authenticated, authorised download of an uploaded document.
//
// Who may read a file:
//   • the person it belongs to
//   • an admin
//   • a branch supervisor, but ONLY for a leave-request medical document belonging to
//     someone in their own branch (they need it to approve sick leave). They can never
//     read national-ID / KRA / photo documents.
exports.getFile = async (req, res) => {
  try {
    const filename = String(req.params.filename || "");
    const m = filename.match(NAME_RE);
    // Strict allow-list of the exact generated shape: also rules out "..", slashes, NULs.
    if (!m) return res.status(404).json({ success: false, message: "File not found." });

    const ownerId = m[1];
    const me = req.user;
    let allowed = me.role === "admin" || String(me._id) === ownerId;

    if (!allowed && me.role === "supervisor" && me.branch_id) {
      const leave = await Leave.findOne({ medical_document: filename }).select("staff_id").lean();
      if (leave) {
        const owner = await User.findById(leave.staff_id).select("branch_id").lean();
        allowed = Boolean(owner?.branch_id) && String(owner.branch_id) === String(me.branch_id);
      }
    }

    // Same answer for "missing" and "not yours" so file names can't be probed.
    if (!allowed) return res.status(404).json({ success: false, message: "File not found." });

    const full = path.resolve(uploadDir, filename);
    if (!full.startsWith(path.resolve(uploadDir) + path.sep) || !fs.existsSync(full)) {
      return res.status(404).json({ success: false, message: "File not found." });
    }

    res.setHeader("Content-Type", MIME[path.extname(filename).toLowerCase()] || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    return res.sendFile(full, { dotfiles: "deny" });
  } catch (err) {
    console.error("[getFile]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.NAME_RE = NAME_RE;
