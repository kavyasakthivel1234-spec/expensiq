const express = require("express");
const router  = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  createIncome,
  getIncome,
  getIncomeById,
  updateIncome,
  deleteIncome,
} = require("../controllers/incomeController");

router.use(protect);

router.route("/")
  .get(getIncome)
  .post(createIncome);

router.route("/:id")
  .get(getIncomeById)
  .put(updateIncome)
  .delete(deleteIncome);

module.exports = router;
