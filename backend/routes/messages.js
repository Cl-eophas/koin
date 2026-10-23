const express = require("express");
const { body } = require("express-validator");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const messages = require("../controllers/messagesController");

const router = express.Router();
router.get("/contacts", authenticate, messages.contacts);
router.get("/unread", authenticate, messages.unreadCount);
router.get("/thread/:userId", authenticate, messages.thread);
router.post(
  "/",
  authenticate,
  [body("to_user_id").isMongoId(), body("body").trim().isLength({ min: 1, max: 1000 }).withMessage("Write a message first.")],
  validate,
  messages.send
);
module.exports = router;
