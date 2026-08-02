const express = require("express");
const router  = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} = require("../controllers/expenseController");

// All expense routes require authentication
router.use(protect);

router.route("/")
  .get(getExpenses)
  .post(createExpense);

router.route("/:id")
  .get(getExpenseById)
  .put(updateExpense)
  .delete(deleteExpense);

module.exports = router;
