const { sanitizeInput } = require("../utils/sanitize");

const sanitizeBody = (req, _res, next) => {
  if (req.body && typeof req.body === "object") req.body = sanitizeInput(req.body);
  next();
};

module.exports = { sanitizeBody };
