// ============================================================
// FILE   : backend/controllers/expenseController.js
// PURPOSE: CRUD operations for Expenses
// ROUTES :
//   POST   /api/expenses        → createExpense
//   GET    /api/expenses        → getExpenses  (with search/filter/sort)
//   GET    /api/expenses/:id    → getExpenseById
//   PUT    /api/expenses/:id    → updateExpense
//   DELETE /api/expenses/:id    → deleteExpense
// ============================================================
const Expense = require("../models/Expense");

// ── Helper: check ownership ───────────────────────────────────
// Returns the expense if it belongs to req.user, 404/403 otherwise
const findOwnedExpense = async (id, userId, res) => {
  const expense = await Expense.findById(id);
  if (!expense) {
    res.status(404).json({ success: false, message: "Expense not found" });
    return null;
  }
  // expense.user is an ObjectId — toString() for comparison
  if (expense.user.toString() !== userId.toString()) {
    res.status(403).json({ success: false, message: "Not authorized to access this expense" });
    return null;
  }
  return expense;
};

// ─────────────────────────────────────────────────────────────
// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
// ─────────────────────────────────────────────────────────────
const createExpense = async (req, res) => {
  try {
    const { title, amount, category, date, notes, paymentMethod } = req.body;

    if (!title || !amount || !category) {
      return res.status(400).json({
        success: false,
        message: "Title, amount, and category are required",
      });
    }

    const expense = await Expense.create({
      user: req.user._id,   // always comes from JWT middleware — not req.body
      title,
      amount,
      category,
      date: date || Date.now(),
      notes,
      paymentMethod,
    });

    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      expense,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    console.error("createExpense:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Get all expenses for logged-in user
//          Supports: search, filter by category/date, sort
// @route   GET /api/expenses
// @access  Private
// ─────────────────────────────────────────────────────────────
const getExpenses = async (req, res) => {
  try {
    const {
      search,      // search by title
      category,    // filter by category
      startDate,   // filter from date
      endDate,     // filter to date
      sortBy,      // "amount" | "date" (default: date)
      order,       // "asc" | "desc" (default: desc)
      page,        // pagination
      limit,       // items per page
    } = req.query;

    // Always filter by the logged-in user first
    const query = { user: req.user._id };

    // ── Smart Search: matches title, category, AND notes ────────
    // "Pizza" matches "Pizza Hut" (title) or notes containing "pizza"
    // "Food" matches the category "Food" directly
    // This makes search feel instant and intelligent
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      query.$or = [
        { title:    searchRegex },
        { category: searchRegex },
        { notes:    searchRegex },
      ];
    }

    // Filter by category
    if (category && category !== "All") {
      query.category = category;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate)   query.date.$lte = new Date(endDate);
    }

    // Sort
    const sortField = sortBy === "amount" ? "amount" : "date";
    const sortOrder = order === "asc" ? 1 : -1;

    // Pagination
    const pageNum  = parseInt(page)  || 1;
    const limitNum = parseInt(limit) || 20;
    const skip     = (pageNum - 1) * limitNum;

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limitNum),
      Expense.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: expenses.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      expenses,
    });
  } catch (error) {
    console.error("getExpenses:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Get single expense by ID
// @route   GET /api/expenses/:id
// @access  Private
// ─────────────────────────────────────────────────────────────
const getExpenseById = async (req, res) => {
  try {
    const expense = await findOwnedExpense(req.params.id, req.user._id, res);
    if (!expense) return;

    res.status(200).json({ success: true, expense });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid expense ID" });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
// ─────────────────────────────────────────────────────────────
const updateExpense = async (req, res) => {
  try {
    const expense = await findOwnedExpense(req.params.id, req.user._id, res);
    if (!expense) return;

    const { title, amount, category, date, notes, paymentMethod } = req.body;

    // Only update fields that were actually sent
    if (title)         expense.title         = title;
    if (amount)        expense.amount        = amount;
    if (category)      expense.category      = category;
    if (date)          expense.date          = date;
    if (notes !== undefined) expense.notes   = notes;
    if (paymentMethod) expense.paymentMethod = paymentMethod;

    const updated = await expense.save();

    res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      expense: updated,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid expense ID" });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
// ─────────────────────────────────────────────────────────────
const deleteExpense = async (req, res) => {
  try {
    const expense = await findOwnedExpense(req.params.id, req.user._id, res);
    if (!expense) return;

    await expense.deleteOne();

    res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid expense ID" });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
};
