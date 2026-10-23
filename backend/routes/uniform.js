const express = require("express");
const { body: bodyU } = require("express-validator");
const { validate: validateU } = require("../middleware/validate");
const { authenticate: authU, staffOrSupervisor: sosU } = require("../middleware/auth");
const uniformRequests = require("../controllers/uniformRequestController");
const router = express.Router();
const { authenticate, staffOrSupervisor } = require("../middleware/auth");
const uniform = require("../controllers/uniformController");

router.get("/my", authenticate, staffOrSupervisor, uniform.getMyUniforms);

router.post(
  "/replacement-request",
  authU,
  sosU,
  [
    bodyU("item").trim().isLength({ min: 2, max: 80 }).withMessage("Say which item you need."),
    bodyU("size").optional().trim().isLength({ max: 20 }),
    bodyU("reason").trim().isLength({ min: 5, max: 300 }).withMessage("Give a short reason (5-300 characters)."),
  ],
  validateU,
  uniformRequests.createReplacementRequest
);

module.exports = router;
