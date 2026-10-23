const path = require("path");
const fs = require("fs");
const multer = require("multer");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uid = req.user?._id?.toString() || "anon";
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `doc_${uid}_${Date.now()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ok = [".pdf", ".jpg", ".jpeg", ".png"].includes(path.extname(file.originalname || "").toLowerCase());
  if (ok) return cb(null, true);
  const err = new Error("Only PDF, JPG, JPEG, PNG allowed.");
  err.status = 400; // client error, not a 500
  cb(err);
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

// The extension and Content-Type are chosen by the client, so neither proves
// what the file really is. Check the actual leading bytes against the format
// the extension claims, and delete the file if they don't match (stops e.g. an
// HTML/SVG/executable renamed to .pdf).
const SIGNATURES = {
  ".pdf": [[0x25, 0x50, 0x44, 0x46, 0x2d]], // %PDF-
  ".jpg": [[0xff, 0xd8, 0xff]],
  ".jpeg": [[0xff, 0xd8, 0xff]],
  ".png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
};

function hasValidSignature(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const sigs = SIGNATURES[ext];
  if (!sigs) return false;
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(8);
    const read = fs.readSync(fd, buf, 0, 8, 0);
    return sigs.some((sig) => read >= sig.length && sig.every((b, i) => buf[i] === b));
  } finally {
    fs.closeSync(fd);
  }
}

const verifyFileSignature = (req, res, next) => {
  if (!req.file) return next();
  try {
    if (hasValidSignature(req.file.path)) return next();
  } catch (e) {
    console.error("[verifyFileSignature]", e.message);
  }
  fs.unlink(req.file.path, () => {});
  return res.status(400).json({ success: false, message: "That file's contents don't match its type. Upload a real PDF, JPG or PNG." });
};

module.exports = { upload, verifyFileSignature, hasValidSignature, uploadDir };
