const express = require("express");
const { body: bodyG, param: paramG, query: queryG } = require("express-validator");
const { validate: validateG } = require("../middleware/validate");
const staffRequestsG = require("../controllers/staffRequestController");
const { body, query } = require("express-validator");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const gs = require("../controllers/generalSupervisorController");

const guard = [authenticate, requireRole("general_supervisor")];

router.get(
  "/attendance",
  guard,
  [
    query("date").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query("branch_id").optional().isMongoId(),
    query("status").optional().isIn(["present", "late", "forced", "supervisor_assisted", "absent", "leave", "unscheduled"]),
  ],
  validate,
  gs.globalAttendance
);

router.get(
  "/contacts",
  guard,
  [query("role").optional().isIn(["staff", "supervisor"]), query("branch_id").optional().isMongoId()],
  validate,
  gs.contacts
);

router.get("/branches", guard, gs.listBranches);

router.get(
  "/timetable/monitor",
  guard,
  [
    query("week_start").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query("branch_id").optional().isMongoId(),
    query("q").optional().trim().isLength({ max: 120 }),
  ],
  validate,
  gs.timetableMonitor
);

router.get("/meetings", guard, gs.listMeetings);
router.post(
  "/meetings",
  guard,
  [body("title").trim().isLength({ min: 3, max: 160 }), body("date").isISO8601(), body("participants").isArray({ min: 1 }), body("participants.*").isMongoId()],
  validate,
  gs.scheduleMeeting
);

router.get("/uniforms/history", guard, gs.uniformHistory);
router.post(
  "/uniforms/assign",
  guard,
  [body("staff_id").isMongoId(), body("item").trim().isLength({ min: 2, max: 120 }), body("quantity").isInt({ min: 1, max: 1000 })],
  validate,
  gs.assignUniform
);

const branchMove = require("../controllers/branchMoveController");
router.get("/branch-requests", guard, branchMove.listBranchRequests);
router.patch(
  "/branch-requests/:id/decide",
  guard,
  [body("decision").isIn(["approve", "reject"]).withMessage("Decision must be approve or reject.")],
  validate,
  branchMove.decideBranchRequest
);

// Staff requests (same actions as admin: add staff, transfer staff, reject)
router.get("/staff-requests", guard, staffRequestsG.listStaffRequests);
router.get("/staff-requests/:id/candidates", guard, [paramG("id").isMongoId(), queryG("mode").optional().isIn(["add", "transfer"])], validateG, staffRequestsG.staffRequestCandidates);
router.post("/staff-requests/:id/fulfil", guard, [paramG("id").isMongoId(), bodyG("mode").isIn(["add", "transfer"]), bodyG("user_ids").isArray({ min: 1, max: 50 }), bodyG("user_ids.*").isMongoId()], validateG, staffRequestsG.fulfilStaffRequest);
router.patch("/staff-requests/:id/reject", guard, [paramG("id").isMongoId(), bodyG("reason").trim().isLength({ min: 3, max: 300 })], validateG, staffRequestsG.rejectStaffRequest);

module.exports = router;
