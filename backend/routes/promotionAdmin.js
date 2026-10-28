/**
 * Admin-only role & employment promotion APIs.
 * Mounted at /api/admin (after main admin router) so these paths always resolve.
 */
const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const promotion = require("../controllers/promotionController");

const guard = [authenticate, requireRole("admin")];

router.post(
  "/promote-role",
  guard,
  [
    body("user_id").isMongoId(),
    body("new_role").isIn(["staff", "supervisor"]),
    body("branch_id").optional({ checkFalsy: true }).isMongoId(),
  ],
  validate,
  promotion.promoteRole
);

router.post(
  "/promote",
  guard,
  [body("user_id").isMongoId(), body("branch_id").optional({ checkFalsy: true }).isMongoId()],
  validate,
  promotion.promoteOneLevel
);

router.post("/demote-role", guard, [body("user_id").isMongoId()], validate, promotion.demoteRole);
router.post("/demote", guard, [body("user_id").isMongoId(), body("branch_id").optional({ checkFalsy: true }).isMongoId()], validate, promotion.demoteOneLevel);

router.post(
  "/promote-employment",
  guard,
  [
    body("staff_id").isMongoId(),
    body("new_type").isIn(["reliever", "contract"]),
    body("branch_id").optional({ checkFalsy: true }).isMongoId(),
  ],
  validate,
  promotion.promoteEmployment
);

module.exports = router;
