// ============================================================
// FILE   : backend/controllers/aiController.js
// PURPOSE: AI-powered financial features
//
//  getAIInsights  → POST /api/ai/insights   (existing — spending analysis)
//  getAdvisor     → POST /api/ai/advisor    (NEW — scheme recommendations)
// ============================================================
const Expense      = require("../models/Expense");
const Income       = require("../models/Income");
const groqService  = require("../services/groqService");

// ─────────────────────────────────────────────────────────────
// HELPER: Gather 30-day financial data for the logged-in user
// ─────────────────────────────────────────────────────────────
async function gatherFinancialData(userId) {
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

  return { expenses, incomes, categoryBreakdown, totalExpense, totalIncome, balance };
}

// ─────────────────────────────────────────────────────────────
// CONTROLLER 1: getAIInsights
// @desc    Spending analysis — existing feature
// @route   POST /api/ai/insights
// @access  Private
// ─────────────────────────────────────────────────────────────
const getAIInsights = async (req, res) => {
  try {
    const fin = await gatherFinancialData(req.user._id);
    const { totalExpense, totalIncome, balance, categoryBreakdown } = fin;

    const categoryText = categoryBreakdown
      .map((c) => `${c._id}: ₹${c.total.toFixed(2)} (${c.count} transactions)`)
      .join("\n") || "No expenses recorded";

    const systemPrompt =
      "You are a helpful personal finance advisor. Be concise, practical, and encouraging.";

    const userPrompt = `Analyze this user's last 30 days of spending and give actionable insights.

FINANCIAL SUMMARY:
- Monthly Income  : ₹${totalIncome.toFixed(2)}
- Monthly Expenses: ₹${totalExpense.toFixed(2)}
- Balance         : ₹${balance.toFixed(2)}
- Total transactions: ${fin.expenses.length}

EXPENSE BREAKDOWN BY CATEGORY:
${categoryText}

Provide:
1. Spending summary (2-3 sentences)
2. Highest spending category and its percentage
3. 2-3 specific saving suggestions
4. One personalized action this week

Use ₹ symbol. Be concise. Use clear section headings.`;

    // Try real AI, fall back to mock if no key
    const rawInsights = await groqService.chat(systemPrompt, userPrompt, {
      temperature: 0.5,
      maxTokens: 800,
    });

    const insights = rawInsights || generateMockInsights(totalExpense, totalIncome, categoryBreakdown);
    const source   = rawInsights ? "groq" : "mock";

    res.status(200).json({
      success: true,
      source,
      insights,
      data: { totalExpense, totalIncome, balance, categoryBreakdown, period: "Last 30 days" },
    });

  } catch (error) {
    console.error("getAIInsights error:", error.message);

    if (error.status === 401) return res.status(500).json({ success: false, message: "Invalid Groq API key." });
    if (error.status === 429) return res.status(429).json({ success: false, message: "AI rate limit. Try again shortly." });

    // Always return something useful
    try {
      const fin = await gatherFinancialData(req.user._id);
      res.status(200).json({
        success: true,
        source: "mock-fallback",
        insights: generateMockInsights(fin.totalExpense, fin.totalIncome, fin.categoryBreakdown),
        data: fin,
      });
    } catch {
      res.status(500).json({ success: false, message: "Failed to generate insights" });
    }
  }
};

// ─────────────────────────────────────────────────────────────
// CONTROLLER 2: getAdvisor  ← NEW
// @desc    Smart Saving & Scheme Recommendation Engine
// @route   POST /api/ai/advisor
// @access  Private
//
// Body (all optional — we enrich from DB):
//   income  : number  (overrides DB income if provided)
//   goal    : string  "Long-term wealth creation" | "Emergency fund" | etc.
//   risk    : string  "Low" | "Medium" | "High"
//   age     : number
// ─────────────────────────────────────────────────────────────
const getAdvisor = async (req, res) => {
  try {
    const userId = req.user._id;
    const fin    = await gatherFinancialData(userId);
    const { totalExpense, totalIncome, balance, categoryBreakdown } = fin;

    // User-provided context (optional extras)
    const income = req.body.income || totalIncome || 0;
    const goal   = req.body.goal   || "General savings and wealth building";
    const risk   = req.body.risk   || "Low";
    const age    = req.body.age    || null;

    // Compute per-category benchmarks
    // Indian average spending benchmarks (% of income)
    const BENCHMARKS = {
      Food:          0.30, // 30% of income is the upper limit
      Travel:        0.10,
      Shopping:      0.10,
      Bills:         0.15,
      Health:        0.08,
      Entertainment: 0.05,
      Education:     0.10,
      Others:        0.10,
    };

    const incomeBase = income || 1; // avoid div by zero
    const overspending = categoryBreakdown
      .filter(c => {
        const limit = (BENCHMARKS[c._id] || 0.10) * incomeBase;
        return c.total > limit;
      })
      .map(c => {
        const limit     = Math.round((BENCHMARKS[c._id] || 0.10) * incomeBase);
        const excess    = Math.max(0, c.total - limit);
        const pct       = Math.round((c.total / incomeBase) * 100);
        return { category: c._id, spent: c.total, recommended: limit, excess, pct };
      });

    const potentialSaving = overspending.reduce((s, c) => s + c.excess, 0);
    const topCategory     = categoryBreakdown[0] || null;

    // ── Build Advisor Prompt ──────────────────────────────
    const categoryText = categoryBreakdown
      .map(c => `  ${c._id}: ₹${c.total.toFixed(0)} (${c.count} txns)`)
      .join("\n") || "  No expenses recorded this month";

    const overspendText = overspending.length
      ? overspending.map(c =>
          `  ${c.category}: spent ₹${c.spent.toFixed(0)}, recommended ≤₹${c.recommended}, excess ₹${c.excess.toFixed(0)}`
        ).join("\n")
      : "  No overspending detected";

    const systemPrompt = `You are a certified Indian personal finance advisor (like a SEBI-registered advisor).
Your job is to analyze spending patterns and recommend suitable Indian saving/investment schemes.
IMPORTANT RULES:
- Never promise guaranteed returns or profits
- Always use phrases like "you may consider", "suitable for your profile", "based on your spending"
- Recommend only real Indian schemes: PPF, NPS, APY, SGB, NSC, FD, RD, SIP, ELSS, Liquid Fund, Emergency Fund
- Be specific about monthly amounts to invest in each scheme
- Keep advice practical, concise, and encouraging
- Return ONLY valid JSON, no extra text`;

    const userPrompt = `Analyze this Indian user's financial profile and return a JSON recommendation.

USER PROFILE:
- Monthly Income  : ₹${income.toFixed ? income.toFixed(0) : income}
- Monthly Expenses: ₹${totalExpense.toFixed(0)}
- Current Balance : ₹${balance.toFixed(0)}
- Financial Goal  : ${goal}
- Risk Appetite   : ${risk}
${age ? `- Age             : ${age}` : ""}

EXPENSE BREAKDOWN (last 30 days):
${categoryText}

OVERSPENDING ANALYSIS:
${overspendText}

ESTIMATED MONTHLY SAVING POTENTIAL: ₹${potentialSaving.toFixed(0)}

Return EXACTLY this JSON structure (no extra keys, no markdown, raw JSON only):
{
  "analysis": {
    "highestExpenseCategory": "<category name>",
    "currentExpense": <number>,
    "recommendedExpense": <number>,
    "possibleSaving": <number>,
    "overspendingCategories": ["<cat1>", "<cat2>"],
    "spendingHealthScore": <number 1-10>,
    "savingRatePercent": <number>
  },
  "recommendations": [
    {
      "scheme": "<full scheme name>",
      "type": "<Government Scheme|Investment|Banking|Emergency>",
      "reason": "<why this matches the user's profile, 1-2 sentences>",
      "recommendedAmount": <monthly rupee amount as number>,
      "riskLevel": "<Low|Medium|High>",
      "tenure": "<e.g. 15 years|Open-ended|1-5 years>"
    }
  ],
  "monthlyPlan": {
    "currentSavings": <number>,
    "targetSavings": <number>,
    "totalInvestRecommended": <number>,
    "steps": ["<step 1>", "<step 2>", "<step 3>"]
  },
  "summary": "<2-3 sentence overall advice paragraph using ₹ symbol>"
}

Recommendations count: 3-5 schemes appropriate for the user's risk level and goal.
All amounts must be realistic and fit within the estimated saving of ₹${potentialSaving.toFixed(0)}/month.`;

    // ── Call Groq (JSON mode) ─────────────────────────────
    let advisorData = null;
    let source      = "mock";

    const rawText = await groqService.chat(systemPrompt, userPrompt, {
      temperature: 0.3, // lower temp → more consistent JSON
      maxTokens:   1500,
      jsonMode:    true,
    });

    if (rawText) {
      try {
        // Strip any markdown code fences if model adds them
        const cleaned = rawText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        const parsed = JSON.parse(cleaned);

        // ── Normalize: fill missing fields & fix zero amounts ──
        advisorData = normalizeAdvisorResponse(
          parsed, potentialSaving, income, totalExpense, topCategory, goal, risk
        );
        source = "groq";
      } catch (parseErr) {
        console.warn("JSON parse failed, using mock:", parseErr.message);
        // Fall through to mock
      }
    }

    // Use mock if AI failed or JSON was invalid
    if (!advisorData) {
      advisorData = generateMockAdvisor(
        totalExpense, income, potentialSaving, topCategory, goal, risk
      );
      source = "mock";
    }

    res.status(200).json({
      success: true,
      source,
      advisor: advisorData,
      context: {
        totalIncome:      totalIncome,
        totalExpense:     totalExpense,
        balance:          balance,
        potentialSaving:  potentialSaving,
        overspending:     overspending,
        categoryBreakdown,
        period: "Last 30 days",
        goal,
        risk,
      },
    });

  } catch (error) {
    console.error("getAdvisor error:", error.message);

    if (error.status === 401) return res.status(500).json({ success: false, message: "Invalid Groq API key." });
    if (error.status === 429) return res.status(429).json({ success: false, message: "AI rate limit. Try again shortly." });

    // Always return a mock so the page never breaks
    try {
      const fin = await gatherFinancialData(req.user._id);
      const mock = generateMockAdvisor(
        fin.totalExpense, fin.totalIncome, 0,
        fin.categoryBreakdown[0], req.body.goal || "savings", req.body.risk || "Low"
      );
      res.status(200).json({ success: true, source: "mock-fallback", advisor: mock, context: fin });
    } catch {
      res.status(500).json({ success: false, message: "Failed to generate advisor recommendations" });
    }
  }
};

// ─────────────────────────────────────────────────────────────
// NORMALIZER — Ensures AI response always has all required fields
// and corrects zero/missing amounts
// ─────────────────────────────────────────────────────────────
function normalizeAdvisorResponse(parsed, potentialSaving, income, totalExpense, topCategory, goal, risk) {
  const saving   = potentialSaving || Math.round(income * 0.10) || 1000;
  const topCat   = topCategory?._id || "Food";
  const topSpent = topCategory?.total || 0;

  // ── Fix analysis ─────────────────────────────────────────
  const analysis = {
    highestExpenseCategory:  parsed.analysis?.highestExpenseCategory  || topCat,
    currentExpense:          parsed.analysis?.currentExpense           || topSpent,
    recommendedExpense:      parsed.analysis?.recommendedExpense       || Math.round(topSpent * 0.75),
    possibleSaving:          parsed.analysis?.possibleSaving           || saving,
    overspendingCategories:  parsed.analysis?.overspendingCategories   || [topCat],
    spendingHealthScore:     parsed.analysis?.spendingHealthScore      || 5,
    savingRatePercent:       parsed.analysis?.savingRatePercent        || (income > 0 ? Math.round(((income - totalExpense) / income) * 100) : 0),
  };

  // ── Fix recommendations — distribute saving across schemes ─
  const recs = (parsed.recommendations || []).filter(r => r.scheme);
  const count = recs.length || 1;

  // Sensible allocation weights
  const weights = [0.35, 0.25, 0.20, 0.15, 0.05];

  const recommendations = recs.map((rec, i) => ({
    scheme:            rec.scheme,
    type:              rec.type              || "Investment",
    reason:            rec.reason            || `Suitable for your ${risk} risk profile.`,
    recommendedAmount: rec.recommendedAmount > 0
                         ? rec.recommendedAmount
                         : Math.round(saving * (weights[i] || 0.10)),
    riskLevel:         rec.riskLevel         || risk,
    tenure:            rec.tenure            || "Open-ended",
  }));

  const totalInvest = recommendations.reduce((s, r) => s + r.recommendedAmount, 0);

  // ── Fix monthlyPlan ──────────────────────────────────────
  const monthlyPlan = parsed.monthlyPlan
    ? {
        currentSavings:         parsed.monthlyPlan.currentSavings         || Math.max(0, income - totalExpense),
        targetSavings:          parsed.monthlyPlan.targetSavings           || saving,
        totalInvestRecommended: parsed.monthlyPlan.totalInvestRecommended  || totalInvest,
        steps:                  (parsed.monthlyPlan.steps || []).length > 0
                                  ? parsed.monthlyPlan.steps
                                  : [
                                      `Reduce ${topCat} spending from ₹${topSpent} to ₹${Math.round(topSpent * 0.75)}/month`,
                                      "Set up auto-debit on your salary credit date for all investments",
                                      `Build ₹${Math.round(totalExpense * 3).toLocaleString("en-IN")} emergency fund (3 months expenses)`,
                                    ],
      }
    : {
        currentSavings:         Math.max(0, income - totalExpense),
        targetSavings:          saving,
        totalInvestRecommended: totalInvest,
        steps: [
          `Reduce ${topCat} spending from ₹${topSpent} to ₹${Math.round(topSpent * 0.75)}/month`,
          "Set up auto-debit on salary credit date for all investments",
          `Build ₹${Math.round(totalExpense * 3).toLocaleString("en-IN")} emergency fund first`,
        ],
      };

  // ── Fix summary ───────────────────────────────────────────
  const summary = parsed.summary && parsed.summary.length > 20
    ? parsed.summary
    : `Based on your ${risk.toLowerCase()} risk appetite and goal of "${goal}", you may consider allocating ₹${totalInvest.toLocaleString("en-IN")}/month across ${recommendations.length} recommended schemes. Reducing ${topCat} expenses can free up approximately ₹${saving.toLocaleString("en-IN")} per month. This is an educational recommendation — consult a SEBI-registered advisor for personalized planning.`;

  return { analysis, recommendations, monthlyPlan, summary };
}

// ─────────────────────────────────────────────────────────────
// MOCK GENERATOR — for when AI key is missing or call fails
// ─────────────────────────────────────────────────────────────
function generateMockInsights(totalExpense, totalIncome, categories) {
  const top     = categories[0];
  const topPct  = totalExpense > 0 && top
    ? Math.round((top.total / totalExpense) * 100) : 0;
  const saving  = (totalExpense * 0.15).toFixed(0);

  return `📊 SPENDING SUMMARY
You spent ₹${totalExpense.toFixed(2)} over the last 30 days against an income of ₹${totalIncome.toFixed(2)}.
${totalIncome > totalExpense
    ? "Great job — you're saving money this month! 🎉"
    : "Your expenses exceeded income. Let's find ways to reduce costs."}

🏆 HIGHEST SPENDING CATEGORY
${top ? `${top._id} accounts for ${topPct}% of your expenses (₹${top.total.toFixed(2)}).` : "No expenses recorded yet."}

💡 SAVING SUGGESTIONS
1. Review your ${top?._id || "largest"} category — small cuts add up fast.
2. Set a monthly budget for each category and track against it.
3. Switch subscriptions to annual plans to save 15–20%.

🎯 THIS WEEK'S ACTION
Start by reducing ${top?._id || "your top"} spending by ₹${saving}/month to build savings.

(Add your GROQ_API_KEY in .env for personalized AI analysis.)`;
}

function generateMockAdvisor(totalExpense, income, potentialSaving, topCategory, goal, risk) {
  const saving      = potentialSaving || Math.round(income * 0.10);
  const topCat      = topCategory?._id || "Food";
  const topSpent    = topCategory?.total || 0;
  const recommended = Math.round(topSpent * 0.75);

  const schemesByRisk = {
    Low: [
      { scheme: "Public Provident Fund (PPF)", type: "Government Scheme", reason: "Government-backed, tax-free returns under Section 80C. Ideal for risk-averse, long-term savers.", recommendedAmount: Math.round(saving * 0.40), riskLevel: "Low", tenure: "15 years" },
      { scheme: "Recurring Deposit (RD)", type: "Banking", reason: "Fixed monthly deposits with guaranteed returns. Perfect for building a disciplined saving habit.", recommendedAmount: Math.round(saving * 0.25), riskLevel: "Low", tenure: "1-3 years" },
      { scheme: "Emergency Fund", type: "Emergency", reason: "3-6 months of expenses in a liquid account. Essential financial safety net before any investment.", recommendedAmount: Math.round(saving * 0.20), riskLevel: "Low", tenure: "Ongoing" },
      { scheme: "National Savings Certificate (NSC)", type: "Government Scheme", reason: "Fixed return, tax benefit under 80C. Safe for medium-term goals.", recommendedAmount: Math.round(saving * 0.15), riskLevel: "Low", tenure: "5 years" },
    ],
    Medium: [
      { scheme: "SIP – Index Fund", type: "Investment", reason: "Tracks Nifty 50 index. Low-cost, diversified investment suitable for long-term wealth creation.", recommendedAmount: Math.round(saving * 0.35), riskLevel: "Medium", tenure: "5+ years" },
      { scheme: "Public Provident Fund (PPF)", type: "Government Scheme", reason: "Stable, tax-free foundation. Balances your portfolio with a guaranteed component.", recommendedAmount: Math.round(saving * 0.25), riskLevel: "Low", tenure: "15 years" },
      { scheme: "Emergency Fund", type: "Emergency", reason: "3-6 months of expenses as liquid backup before committing to investments.", recommendedAmount: Math.round(saving * 0.25), riskLevel: "Low", tenure: "Ongoing" },
      { scheme: "ELSS Mutual Fund", type: "Investment", reason: "Tax-saving + equity growth. 3-year lock-in with potential for inflation-beating returns.", recommendedAmount: Math.round(saving * 0.15), riskLevel: "Medium", tenure: "3+ years" },
    ],
    High: [
      { scheme: "SIP – Index Fund", type: "Investment", reason: "Core equity exposure through Nifty 50. Best risk-adjusted returns over 10+ years.", recommendedAmount: Math.round(saving * 0.40), riskLevel: "Medium", tenure: "10+ years" },
      { scheme: "ELSS Mutual Fund", type: "Investment", reason: "Tax-saving equity fund. 3-year lock-in, suitable for aggressive growth seekers.", recommendedAmount: Math.round(saving * 0.25), riskLevel: "High", tenure: "3+ years" },
      { scheme: "Sovereign Gold Bond (SGB)", type: "Government Scheme", reason: "Gold exposure with 2.5% annual interest + capital appreciation. Inflation hedge.", recommendedAmount: Math.round(saving * 0.15), riskLevel: "Medium", tenure: "8 years" },
      { scheme: "Emergency Fund", type: "Emergency", reason: "Always maintain a liquid emergency buffer regardless of investment strategy.", recommendedAmount: Math.round(saving * 0.20), riskLevel: "Low", tenure: "Ongoing" },
    ],
  };

  const schemes = schemesByRisk[risk] || schemesByRisk["Low"];
  const totalInvest = schemes.reduce((s, r) => s + r.recommendedAmount, 0);

  return {
    analysis: {
      highestExpenseCategory:  topCat,
      currentExpense:          topSpent,
      recommendedExpense:      recommended,
      possibleSaving:          saving,
      overspendingCategories:  [topCat],
      spendingHealthScore:     income > 0 ? Math.max(1, Math.min(10, Math.round(((income - totalExpense) / income) * 10))) : 5,
      savingRatePercent:       income > 0 ? Math.round(((income - totalExpense) / income) * 100) : 0,
    },
    recommendations: schemes,
    monthlyPlan: {
      currentSavings:          Math.max(0, income - totalExpense),
      targetSavings:           saving,
      totalInvestRecommended:  totalInvest,
      steps: [
        `Reduce ${topCat} spending from ₹${topSpent.toFixed(0)} to ₹${recommended.toFixed(0)}/month`,
        `Set up auto-debit SIP and RD on salary credit day`,
        `Build ₹${Math.round(totalExpense * 3).toLocaleString("en-IN")} emergency fund (3 months expenses) first`,
      ],
    },
    summary: `Based on your ${risk.toLowerCase()} risk appetite and goal of "${goal}", you may consider allocating ₹${totalInvest.toLocaleString("en-IN")}/month across the recommended schemes. Reducing ${topCat} spending can free up approximately ₹${saving.toLocaleString("en-IN")} per month for investments. This is an educational recommendation — consult a SEBI-registered advisor for personalized financial planning.`,
  };
}

module.exports = { getAIInsights, getAdvisor };
