const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const { authenticate, staffOrSupervisor } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { upload, verifyFileSignature } = require("../utils/upload");
const leave = require("../controllers/leaveController");

router.get("/balance", authenticate, staffOrSupervisor, leave.getBalance);
router.get("/history", authenticate, staffOrSupervisor, leave.getLeaveHistory);

router.post(
  "/request",
  authenticate,
  staffOrSupervisor,
  [
    body("type").isIn(["annual", "sick_full", "sick_half"]),
    body("start_date").isISO8601(),
    body("end_date").isISO8601(),
  ],
  validate,
  leave.requestLeave
);

router.post(
  "/upload-document",
  authenticate,
  staffOrSupervisor,
  upload.single("document"),
  verifyFileSignature,
  [body("leave_id").notEmpty()],
  validate,
  leave.uploadDocument
);

module.exports = router;
