const express = require("express");
const router  = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getSummary,
  getCategorySummary,
  getMonthlyReport,
  getRecentTransactions,
} = require("../controllers/dashboardController");

router.use(protect);

router.get("/summary",          getSummary);
router.get("/category-summary", getCategorySummary);
router.get("/monthly-report",   getMonthlyReport);
router.get("/recent",           getRecentTransactions);

module.exports = router;
