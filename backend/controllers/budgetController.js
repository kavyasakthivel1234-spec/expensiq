// ============================================================
// FILE   : backend/controllers/budgetController.js
// PURPOSE: Set and manage monthly budgets per category
// ============================================================
const Budget  = require("../models/Budget");
const Expense = require("../models/Expense");

// @desc    Set/create budget
// @route   POST /api/budget
const createBudget = async (req, res) => {
  try {
    const { category, limitAmount, month, year } = req.body;

    if (!category || !limitAmount || !month || !year) {
      return res.status(400).json({
        success: false,
        message: "Category, limitAmount, month, and year are required",
      });
    }

    // Upsert: update if exists, create if not
    const budget = await Budget.findOneAndUpdate(
      { user: req.user._id, category, month, year },
      { limitAmount },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json({
      success: true,
      message: "Budget saved successfully",
      budget,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get budgets with actual spending and warning flags
// @route   GET /api/budget
const getBudgets = async (req, res) => {
  try {
    const now   = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year  = parseInt(req.query.year)  || now.getFullYear();

    const budgets = await Budget.find({ user: req.user._id, month, year });

    if (!budgets.length) {
      return res.status(200).json({
        success: true,
        message: "No budgets set for this period",
        budgets: [],
      });
    }

    // For each budget, calculate actual spending in that category/month/year
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month, 0, 23, 59, 59);

    const enriched = await Promise.all(
      budgets.map(async (budget) => {
        const matchStage =
          budget.category === "Total"
            ? { user: req.user._id, date: { $gte: monthStart, $lte: monthEnd } }
            : { user: req.user._id, category: budget.category, date: { $gte: monthStart, $lte: monthEnd } };

        const result = await Expense.aggregate([
          { $match: matchStage },
          { $group: { _id: null, spent: { $sum: "$amount" } } },
        ]);

        const spent      = result[0]?.spent || 0;
        const remaining  = budget.limitAmount - spent;
        const percentage = Math.round((spent / budget.limitAmount) * 100);
        const warning    = percentage >= 80; // warn at 80%
        const exceeded   = spent > budget.limitAmount;

        return {
          _id:         budget._id,
          category:    budget.category,
          limitAmount: budget.limitAmount,
          spent,
          remaining,
          percentage,
          warning,
          exceeded,
          month,
          year,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: enriched.length,
      budgets: enriched,
    });
  } catch (error) {
    console.error("getBudgets:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update budget limit
// @route   PUT /api/budget/:id
const updateBudget = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) {
      return res.status(404).json({ success: false, message: "Budget not found" });
    }
    if (budget.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    budget.limitAmount = req.body.limitAmount || budget.limitAmount;
    const updated = await budget.save();

    res.status(200).json({ success: true, message: "Budget updated", budget: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete budget
// @route   DELETE /api/budget/:id
const deleteBudget = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) {
      return res.status(404).json({ success: false, message: "Budget not found" });
    }
    if (budget.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    await budget.deleteOne();
    res.status(200).json({ success: true, message: "Budget deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { createBudget, getBudgets, updateBudget, deleteBudget };
