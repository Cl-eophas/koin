const express = require("express");
const { authenticate } = require("../middleware/auth");
const prefs = require("../controllers/preferencesController");

const router = express.Router();
router.get("/notifications", authenticate, prefs.getPrefs);
router.put("/notifications", authenticate, prefs.updatePrefs);
module.exports = router;
