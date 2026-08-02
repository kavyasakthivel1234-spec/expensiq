// ============================================================
// FILE   : backend/controllers/dashboardController.js
// PURPOSE: Analytics APIs using MongoDB aggregation pipelines
// ROUTES :
//   GET /api/dashboard/summary
//   GET /api/dashboard/category-summary
//   GET /api/dashboard/monthly-report
//   GET /api/dashboard/recent
// ============================================================
const Expense = require("../models/Expense");
const Income  = require("../models/Income");

// ─────────────────────────────────────────────────────────────
// @desc    Overall financial summary
// @route   GET /api/dashboard/summary
// ─────────────────────────────────────────────────────────────
const getSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const now    = new Date();

    // Start of today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Start of current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel for performance
    const [
      totalExpenseResult,
      totalIncomeResult,
      monthlyExpenseResult,
      todayExpenseResult,
      totalExpenseCount,
      totalIncomeCount,
    ] = await Promise.all([
      // Total all-time expense
      Expense.aggregate([
        { $match: { user: userId } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // Total all-time income
      Income.aggregate([
        { $match: { user: userId } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // This month's expense
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // Today's expense
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Expense.countDocuments({ user: userId }),
      Income.countDocuments({ user: userId }),
    ]);

    const totalExpense  = totalExpenseResult[0]?.total  || 0;
    const totalIncome   = totalIncomeResult[0]?.total   || 0;
    const monthlyExpense = monthlyExpenseResult[0]?.total || 0;
    const todayExpense  = todayExpenseResult[0]?.total  || 0;
    const balance       = totalIncome - totalExpense;

    res.status(200).json({
      success: true,
      summary: {
        totalIncome,
        totalExpense,
        balance,
        monthlyExpense,
        todayExpense,
        totalTransactions: totalExpenseCount + totalIncomeCount,
        totalExpenseCount,
        totalIncomeCount,
      },
    });
  } catch (error) {
    console.error("getSummary:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Expense breakdown by category
// @route   GET /api/dashboard/category-summary
// ─────────────────────────────────────────────────────────────
const getCategorySummary = async (req, res) => {
  try {
    const userId = req.user._id;

    // Optional: filter by month/year from query params
    const { month, year } = req.query;
    const matchStage = { user: userId };

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end   = new Date(year, month, 0, 23, 59, 59);
      matchStage.date = { $gte: start, $lte: end };
    }

    const categoryData = await Expense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } }, // highest first
      {
        $project: {
          _id: 0,
          category: "$_id",
          total: 1,
          count: 1,
        },
      },
    ]);

    // Also compute grand total for percentage calculation
    const grandTotal = categoryData.reduce((sum, item) => sum + item.total, 0);

    const result = categoryData.map((item) => ({
      ...item,
      percentage: grandTotal > 0
        ? Math.round((item.total / grandTotal) * 100)
        : 0,
    }));

    res.status(200).json({
      success: true,
      grandTotal,
      categories: result,
    });
  } catch (error) {
    console.error("getCategorySummary:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Monthly expense & income for last 6 months
// @route   GET /api/dashboard/monthly-report
// ─────────────────────────────────────────────────────────────
const getMonthlyReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const now    = new Date();

    // Go back 6 months from today
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [expenseData, incomeData] = await Promise.all([
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: {
              year:  { $year: "$date" },
              month: { $month: "$date" },
            },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      Income.aggregate([
        { $match: { user: userId, date: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: {
              year:  { $year: "$date" },
              month: { $month: "$date" },
            },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    // Build a map for easy lookup
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const expenseMap = {};
    const incomeMap  = {};

    expenseData.forEach(({ _id, total }) => {
      expenseMap[`${_id.year}-${_id.month}`] = total;
    });
    incomeData.forEach(({ _id, total }) => {
      incomeMap[`${_id.year}-${_id.month}`] = total;
    });

    // Generate last 6 months array
    const report = [];
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key   = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      report.push({
        month:   label,
        expense: expenseMap[key] || 0,
        income:  incomeMap[key]  || 0,
      });
    }

    res.status(200).json({ success: true, report });
  } catch (error) {
    console.error("getMonthlyReport:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Latest 5 transactions (expenses + income combined)
// @route   GET /api/dashboard/recent
// ─────────────────────────────────────────────────────────────
const getRecentTransactions = async (req, res) => {
  try {
    const userId = req.user._id;

    const [recentExpenses, recentIncome] = await Promise.all([
      Expense.find({ user: userId }).sort({ date: -1 }).limit(5).lean(),
      Income.find({ user: userId }).sort({ date: -1 }).limit(5).lean(),
    ]);

    // Tag each with type and merge
    const tagged = [
      ...recentExpenses.map((e) => ({ ...e, type: "expense" })),
      ...recentIncome.map((i)   => ({ ...i, type: "income"  })),
    ];

    // Sort merged list by date descending, take top 5
    tagged.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = tagged.slice(0, 5);

    res.status(200).json({
      success: true,
      count: recent.length,
      transactions: recent,
    });
  } catch (error) {
    console.error("getRecentTransactions:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getSummary,
  getCategorySummary,
  getMonthlyReport,
  getRecentTransactions,
};
