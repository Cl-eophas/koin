const express = require("express");
const { query } = require("express-validator");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { exportLimiter } = require("../middleware/rateLimiter");
const reports = require("../controllers/reportsController");

const guard = [authenticate, requireRole("admin", "supervisor")];

const common = [
  ...reports.validators.branchOptional,
  ...reports.validators.employmentOptional,
  query("use_cache").optional().isIn(["true", "false"]),
];

router.get(
  "/daily",
  guard,
  [...reports.validators.dateQuery, ...reports.validators.branchOptional, ...reports.validators.employmentOptional],
  validate,
  reports.getDaily
);

router.get("/weekly", guard, [...reports.validators.weekQuery, ...common], validate, reports.getWeekly);

router.get("/monthly", guard, [...reports.validators.monthQuery, ...common], validate, reports.getMonthly);

router.get(
  "/period",
  guard,
  [
    ...reports.validators.periodQuery,
    ...reports.validators.branchOptional,
    ...reports.validators.employmentOptional,
  ],
  validate,
  reports.getPeriod
);

router.get(
  "/daily-audit",
  guard,
  [...reports.validators.dateQuery, ...reports.validators.branchOptional, query("format").optional().isIn(["json", "csv"])],
  validate,
  reports.getDailyAudit
);

router.get(
  "/export",
  guard,
  exportLimiter,
  [...reports.validators.exportQuery, query("use_cache").optional().isIn(["true", "false"])],
  validate,
  reports.exportPayroll
);

router.get(
  "/snapshots",
  [authenticate, requireRole("admin")],
  [query("limit").optional().isInt({ min: 1, max: 100 }), query("period_type").optional().isIn(["daily", "weekly", "monthly"])],
  validate,
  reports.listSnapshots
);

module.exports = router;
