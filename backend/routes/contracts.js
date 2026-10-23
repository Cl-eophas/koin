const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const contract = require("../controllers/contractController");

router.get("/me", authenticate, contract.getMyContract);
router.post(
  "/me/accept",
  authenticate,
  [body("contract_id").isMongoId()],
  validate,
  contract.acceptContract
);

module.exports = router;
