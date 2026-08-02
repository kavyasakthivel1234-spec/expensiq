// ============================================================
// FILE   : backend/controllers/aiController.js
// PURPOSE: AI spending insights using Groq API (Llama 3)
// ROUTE  : POST /api/ai/insights
// ============================================================
const Groq    = require("groq-sdk");
const Expense = require("../models/Expense");
const Income  = require("../models/Income");

// @desc    Generate AI-powered spending insights
// @route   POST /api/ai/insights
// @access  Private
const getAIInsights = async (req, res) => {
  try {
    // ── 1. Gather last 30 days of expense data ─────────────
    const userId    = req.user._id;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [expenses, incomes, categoryBreakdown] = await Promise.all([
      Expense.find({ user: userId, date: { $gte: thirtyDaysAgo } }).lean(),
      Income.find({ user: userId, date: { $gte: thirtyDaysAgo } }).lean(),
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: thirtyDaysAgo } } },
        { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
    ]);

    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const totalIncome  = incomes.reduce((s, i) => s + i.amount, 0);
    const balance      = totalIncome - totalExpense;

    // ── 2. Build prompt for Groq ───────────────────────────
    const categoryText = categoryBreakdown
      .map((c) => `${c._id}: ₹${c.total.toFixed(2)} (${c.count} transactions)`)
      .join("\n");

    const prompt = `You are a personal finance advisor. Analyze the following expense data for the last 30 days and provide actionable insights.

USER FINANCIAL SUMMARY:
- Total Income: ₹${totalIncome.toFixed(2)}
- Total Expenses: ₹${totalExpense.toFixed(2)}
- Balance: ₹${balance.toFixed(2)}
- Number of expense transactions: ${expenses.length}

SPENDING BY CATEGORY:
${categoryText || "No expenses recorded"}

Please provide:
1. A brief spending summary (2-3 sentences)
2. The highest spending category and what percentage it represents
3. 2-3 specific saving suggestions based on the data
4. One personalized recommendation

Keep the response concise, practical, and encouraging. Use ₹ for currency. Format with clear sections.`;

    // ── 3. Check if Groq API key is configured ────────────
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_groq_api_key_here") {
      // Return a mock response if no API key — useful for testing
      return res.status(200).json({
        success: true,
        source: "mock",
        message: "Add your GROQ_API_KEY in .env for real AI insights",
        insights: generateMockInsights(totalExpense, totalIncome, categoryBreakdown),
        data: { totalExpense, totalIncome, balance, categoryBreakdown },
      });
    }

    // ── 4. Call Groq API ──────────────────────────────────
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "llama3-8b-8192",  // fast and capable Llama 3 model
      messages: [
        {
          role: "system",
          content: "You are a helpful personal finance advisor who gives practical, encouraging advice.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const insights = completion.choices[0]?.message?.content || "Unable to generate insights.";

    res.status(200).json({
      success: true,
      source: "groq",
      insights,
      data: {
        totalExpense,
        totalIncome,
        balance,
        categoryBreakdown,
        period: "Last 30 days",
      },
    });

  } catch (error) {
    console.error("AI Insights Error:", error.message);

    // Groq API errors
    if (error.status === 401) {
      return res.status(500).json({ success: false, message: "Invalid Groq API key. Check your .env file." });
    }
    if (error.status === 429) {
      return res.status(429).json({ success: false, message: "AI rate limit reached. Try again in a moment." });
    }

    res.status(500).json({ success: false, message: "Failed to generate AI insights" });
  }
};

// ── Mock insights when no API key is configured ──────────────
function generateMockInsights(totalExpense, totalIncome, categories) {
  const topCategory = categories[0];
  const topPercent  = totalExpense > 0 && topCategory
    ? Math.round((topCategory.total / totalExpense) * 100)
    : 0;

  return `📊 SPENDING SUMMARY
You spent ₹${totalExpense.toFixed(2)} over the last 30 days against an income of ₹${totalIncome.toFixed(2)}.
${totalIncome > totalExpense ? "Great job — you're saving money this month! 🎉" : "You've spent more than you earned this month. Let's look at ways to reduce costs."}

🏆 HIGHEST SPENDING CATEGORY
${topCategory ? `${topCategory._id} accounts for ${topPercent}% of your expenses (₹${topCategory.total.toFixed(2)}).` : "No expenses recorded yet."}

💡 SAVING SUGGESTIONS
1. Review your ${topCategory?._id || "largest"} category — small cuts add up fast.
2. Set a monthly budget limit for each category to stay on track.
3. Track daily expenses to spot unnecessary spending patterns early.

🎯 RECOMMENDATION
Start by setting a budget for your top spending category. Even a 10% reduction could save you ₹${(totalExpense * 0.1).toFixed(0)} next month.

(This is a sample insight. Add your GROQ_API_KEY in .env for personalized AI analysis.)`;
}

module.exports = { getAIInsights };
