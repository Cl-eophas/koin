const express = require("express");
const { body, param, query } = require("express-validator");
const router = express.Router();
const { authenticate, requireRole, staffOrSupervisor } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const tt = require("../controllers/timetableController");

const sup = [authenticate, requireRole("supervisor")];
const admin = [authenticate, requireRole("admin")];
const staffLike = [authenticate, staffOrSupervisor];

router.get("/supervisor/shift-templates", sup, tt.listTemplatesSupervisor);

router.post(
  "/supervisor/shift-templates",
  sup,
  [
    body("label").trim().notEmpty(),
    body("name").optional().trim(),
    body("start_time").matches(/^\d{1,2}:\d{2}$/),
    body("end_time").matches(/^\d{1,2}:\d{2}$/),
  ],
  validate,
  tt.createTemplateSupervisor
);

router.patch(
  "/supervisor/shift-templates/:id",
  sup,
  [param("id").isMongoId()],
  validate,
  tt.updateTemplateSupervisor
);

router.delete(
  "/supervisor/shift-templates/:id",
  sup,
  [param("id").isMongoId()],
  validate,
  tt.deleteTemplateSupervisor
);

router.get(
  "/supervisor/week",
  sup,
  [query("week_start").optional().matches(/^\d{4}-\d{2}-\d{2}$/)],
  validate,
  tt.getWeekDataSupervisor
);

router.put(
  "/supervisor/week",
  sup,
  [
    body("week_start").matches(/^\d{4}-\d{2}-\d{2}$/),
    body("rows").isArray({ min: 1 }),
    body("rows.*.staff_id").isMongoId(),
  ],
  validate,
  tt.saveWeekSupervisor
);

router.get(
  "/staff/my-week",
  staffLike,
  [query("week_start").optional().matches(/^\d{4}-\d{2}-\d{2}$/)],
  validate,
  tt.getMyWeekReadOnly
);

router.get(
  "/admin/week",
  admin,
  [
    query("branch_id").isMongoId(),
    query("week_start").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  ],
  validate,
  tt.getWeekDataAdmin
);

module.exports = router;
