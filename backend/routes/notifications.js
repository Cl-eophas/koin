const express = require("express");
const router = express.Router();
const { authenticate, staffSupervisorOrGeneral } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { body } = require("express-validator");
const notif = require("../controllers/notificationController");

router.get("/", authenticate, staffSupervisorOrGeneral, notif.getNotifications);

router.patch(
  "/read",
  authenticate,
  staffSupervisorOrGeneral,
  [body("notification_ids").optional().isArray()],
  validate,
  notif.markAsRead
);

module.exports = router;
