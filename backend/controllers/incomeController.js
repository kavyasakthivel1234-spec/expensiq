// ============================================================
// FILE   : backend/controllers/incomeController.js
// PURPOSE: CRUD operations for Income
// ============================================================
const Income = require("../models/Income");

const findOwnedIncome = async (id, userId, res) => {
  const income = await Income.findById(id);
  if (!income) {
    res.status(404).json({ success: false, message: "Income not found" });
    return null;
  }
  if (income.user.toString() !== userId.toString()) {
    res.status(403).json({ success: false, message: "Not authorized" });
    return null;
  }
  return income;
};

// @desc    Create income
// @route   POST /api/income
const createIncome = async (req, res) => {
  try {
    const { title, amount, category, date, notes } = req.body;

    if (!title || !amount || !category) {
      return res.status(400).json({
        success: false,
        message: "Title, amount, and category are required",
      });
    }

    const income = await Income.create({
      user: req.user._id,
      title,
      amount,
      category,
      date: date || Date.now(),
      notes,
    });

    res.status(201).json({ success: true, message: "Income added successfully", income });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get all income for user
// @route   GET /api/income
const getIncome = async (req, res) => {
  try {
    const { search, category, startDate, endDate, sortBy, order, page, limit } = req.query;
    const query = { user: req.user._id };

    if (search)                        query.title    = { $regex: search, $options: "i" };
    if (category && category !== "All") query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate)   query.date.$lte = new Date(endDate);
    }

    const sortField = sortBy === "amount" ? "amount" : "date";
    const sortOrder = order === "asc" ? 1 : -1;
    const pageNum   = parseInt(page) || 1;
    const limitNum  = parseInt(limit) || 20;
    const skip      = (pageNum - 1) * limitNum;

    const [incomes, total] = await Promise.all([
      Income.find(query).sort({ [sortField]: sortOrder }).skip(skip).limit(limitNum),
      Income.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: incomes.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      incomes,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get single income
// @route   GET /api/income/:id
const getIncomeById = async (req, res) => {
  try {
    const income = await findOwnedIncome(req.params.id, req.user._id, res);
    if (!income) return;
    res.status(200).json({ success: true, income });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid ID" });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update income
// @route   PUT /api/income/:id
const updateIncome = async (req, res) => {
  try {
    const income = await findOwnedIncome(req.params.id, req.user._id, res);
    if (!income) return;

    const { title, amount, category, date, notes } = req.body;
    if (title)              income.title    = title;
    if (amount)             income.amount   = amount;
    if (category)           income.category = category;
    if (date)               income.date     = date;
    if (notes !== undefined) income.notes   = notes;

    const updated = await income.save();
    res.status(200).json({ success: true, message: "Income updated successfully", income: updated });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete income
// @route   DELETE /api/income/:id
const deleteIncome = async (req, res) => {
  try {
    const income = await findOwnedIncome(req.params.id, req.user._id, res);
    if (!income) return;
    await income.deleteOne();
    res.status(200).json({ success: true, message: "Income deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { createIncome, getIncome, getIncomeById, updateIncome, deleteIncome };
