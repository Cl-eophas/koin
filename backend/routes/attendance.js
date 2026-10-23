const express = require("express");
const { body, query } = require("express-validator");
const router = express.Router();
const { authenticate, staffOrSupervisor } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const att = require("../controllers/attendanceController");

router.get(
  "/reverse-geocode",
  authenticate,
  staffOrSupervisor,
  [query("lat").isFloat({ min: -90, max: 90 }), query("lon").isFloat({ min: -180, max: 180 })],
  validate,
  att.reverseGeocode
);

router.post(
  "/clock-in-precheck",
  authenticate,
  staffOrSupervisor,
  [
    body("latitude").isFloat({ min: -90, max: 90 }),
    body("longitude").isFloat({ min: -180, max: 180 }),
    body("accuracy").isFloat({ gt: 0 }),
  ],
  validate,
  att.clockInPrecheck
);

router.post(
  "/clock-in",
  authenticate,
  staffOrSupervisor,
  [
    body("latitude").isFloat({ min: -90, max: 90 }),
    body("longitude").isFloat({ min: -180, max: 180 }),
    body("accuracy").isFloat({ gt: 0 }),
    body("locationName").optional().isString().isLength({ max: 500 }),
    body("deviceMeta").optional().isObject(),
  ],
  validate,
  att.clockIn
);

router.post(
  "/clock-out",
  authenticate,
  staffOrSupervisor,
  [
    body("latitude").isFloat({ min: -90, max: 90 }),
    body("longitude").isFloat({ min: -180, max: 180 }),
    body("accuracy").optional().isFloat({ gt: 0, max: 10000 }),
  ],
  validate,
  att.clockOut
);

router.get("/history", authenticate, staffOrSupervisor, att.getHistory);
router.post(
  "/force-clock-in/request",
  authenticate,
  staffOrSupervisor,
  [body("reason").trim().isLength({ min: 5, max: 500 })],
  validate,
  att.requestForcedClockIn
);

module.exports = router;
