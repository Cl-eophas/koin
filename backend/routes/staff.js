const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const { authenticate, staffOrSupervisor, staffOnly } = require("../middleware/auth");
const branchMove = require("../controllers/branchMoveController");
const { body: bodyV } = require("express-validator");
const { validate } = require("../middleware/validate");
const staff = require("../controllers/staffController");

router.get("/dashboard", authenticate, staffOrSupervisor, staff.getDashboard);
router.get("/branches/available", authenticate, staffOrSupervisor, staff.listBranchesAvailable);
router.put(
  "/my-branch",
  authenticate,
  staffOrSupervisor,
  [body("branch_id").isMongoId()],
  validate,
  staff.selectCasualBranch
);

router.get("/opportunities", authenticate, staffOnly, branchMove.opportunities);
router.get("/branch-requests", authenticate, staffOnly, branchMove.myBranchRequests);
router.post(
  "/branch-requests",
  authenticate,
  staffOnly,
  [
    bodyV("to_branch_id").isMongoId().withMessage("Choose a branch."),
    bodyV("reason").trim().isLength({ min: 5, max: 300 }).withMessage("Give a short reason (5-300 characters)."),
  ],
  validate,
  branchMove.createBranchRequest
);

router.get("/branches/:id/members", authenticate, staffOnly, branchMove.branchMembers);

const employment = require("../controllers/employmentController");
router.post("/resign", authenticate, staffOnly, [bodyV("reason").optional().trim().isLength({ max: 300 })], validate, employment.resign);
router.post("/resign/withdraw", authenticate, staffOnly, employment.withdrawResignation);

module.exports = router;
