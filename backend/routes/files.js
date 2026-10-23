const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const files = require("../controllers/fileController");

// Uploaded documents are private. This replaces the old unauthenticated
// express.static("/uploads") mount.
router.get("/:filename", authenticate, files.getFile);

module.exports = router;
