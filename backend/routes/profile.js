const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const { authenticate, staffSupervisorOrGeneral } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const profile = require("../controllers/profileController");

router.get("/", authenticate, staffSupervisorOrGeneral, profile.getProfile);

router.put("/profile", authenticate, staffSupervisorOrGeneral, profile.updateProfile);

router.patch(
  "/update",
  authenticate,
  staffSupervisorOrGeneral,
  [
    body("phone").trim().matches(/^(\+254|0)[0-9]{9}$/),
    body("address").optional().isString().trim().isLength({ max: 240 }),
    body("email").optional().isEmail().normalizeEmail(),
  ],
  validate,
  profile.updateContact
);

const selfService = require("../controllers/selfServiceController");
const recordsSearch = require("../controllers/recordsSearchController");
router.get("/records", authenticate, staffSupervisorOrGeneral, recordsSearch.searchMine);
router.get("/my-records", authenticate, staffSupervisorOrGeneral, selfService.exportMine);

module.exports = router;
