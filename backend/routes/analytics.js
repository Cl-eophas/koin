const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { exportLimiter } = require("../middleware/rateLimiter");
const analytics = require("../controllers/analyticsController");

const guard = [authenticate, requireRole("admin", "supervisor")];

router.get("/attendance/daily", guard, analytics.validators.dailyQuery, validate, analytics.getDaily);
router.get("/summary/daily", guard, analytics.validators.dailyQuery, validate, analytics.getDailySummary);
router.get("/attendance/weekly", guard, analytics.getWeekly);
router.get("/attendance/monthly", guard, analytics.getMonthly);
router.get(
  "/export",
  guard,
  exportLimiter,
  analytics.validators.exportQuery,
  validate,
  analytics.exportReport
);
router.get(
  "/branch/overview",
  guard,
  analytics.validators.branchOverviewQuery,
  validate,
  analytics.getBranchOverview
);

module.exports = router;
