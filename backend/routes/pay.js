const express = require("express");
const router = express.Router();
const { authenticate, staffOrSupervisor } = require("../middleware/auth");
const pay = require("../controllers/payController");

router.get("/summary", authenticate, staffOrSupervisor, pay.getPaySummary);
router.get("/payslip", authenticate, staffOrSupervisor, pay.getMyPayslip);
router.get("/history", authenticate, staffOrSupervisor, pay.getMyPayslipHistory);

module.exports = router;
