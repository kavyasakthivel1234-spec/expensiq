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

    const systemPrompt = `You are an experienced Indian personal finance advisor (equivalent to a SEBI-registered investment advisor).
You specialize in analyzing individual spending behaviour and recommending personalized, realistic saving and investment plans.

CRITICAL RULES — follow strictly:
1. Study the user's ACTUAL expense categories before recommending anything.
   - High Entertainment spending → suggest reducing OTT/outings, recommend Liquid Fund or RD first
   - High Food/Dining → suggest meal planning, recommend disciplined RD or SIP after food savings
   - High Shopping → suggest impulse-control strategies, short-term FD or RD
   - High Travel → suggest transport optimization, NSC or FD for travel fund
   - High Bills → suggest bill reduction, PPF for long-term after bills managed
   - Low overall expenses → user is already saving well → recommend growth-oriented SIP/ELSS
2. The GOAL changes everything:
   - Emergency Fund goal → Liquid Fund + Savings Account + RD (short-term only)
   - Retirement / Long-term → PPF + NPS + SIP Index Fund
   - Short-term (1-3 years) → RD + FD + NSC
   - Tax Saving → ELSS + PPF + NPS
   - Child Education → PPF + SIP + NSC
   - Home Purchase → FD + RD + SGB
3. RISK changes everything:
   - Low risk → PPF, NSC, RD, FD, Emergency Fund ONLY
   - Medium risk → Mix of PPF/NSC + Index Fund SIP + ELSS
   - High risk → Index Fund SIP, ELSS, Large Cap SIP, SGB — no FD/RD as primary
4. Monthly saving amount drives allocation:
   - Savings < ₹2000 → max 2 schemes, small amounts
   - Savings ₹2000–₹5000 → 3 schemes
   - Savings > ₹5000 → 4-5 schemes
5. NEVER recommend PPF + NPS + SIP every time. Choose what actually fits this user.
6. Only use real Indian schemes: PPF, NPS, APY, SGB, NSC, FD, RD, ELSS, Index Fund SIP, Liquid Fund, Emergency Fund
7. Never promise returns. Use: "you may consider", "based on your profile", "suitable for"
8. Return ONLY valid JSON. No markdown, no explanation text outside JSON.`;

    // Build a rich, unambiguous description of the user's situation
    const savingAmount  = Math.max(0, income - totalExpense);
    const savingRate    = income > 0 ? Math.round((savingAmount / income) * 100) : 0;
    const topCatName    = topCategory?._id || "None";
    const topCatPct     = income > 0 && topCategory
      ? Math.round((topCategory.total / income) * 100) : 0;
    const isEmergency   = goal.toLowerCase().includes("emergency");
    const isRetirement  = goal.toLowerCase().includes("retirement");
    const isShortTerm   = goal.toLowerCase().includes("short");
    const isTaxSaving   = goal.toLowerCase().includes("tax");

    // Describe spending pattern in plain language so AI understands it clearly
    const spendingPattern = categoryBreakdown.length > 0
      ? `The user's top spending category is "${topCatName}" at ${topCatPct}% of their income. ` +
        (topCatPct > 25 ? `This is unusually high and needs reduction. ` : `This is within a normal range. `) +
        `All categories: ${categoryBreakdown.map(c => `${c._id} ₹${Math.round(c.total)}`).join(", ")}.`
      : "No expense data available this month — give general advice for their income and goal.";

    const userPrompt = `Generate a personalized investment recommendation for this specific Indian user. Do NOT use a generic template — tailor every field to their actual numbers and situation.

USER'S EXACT FINANCIAL PROFILE:
- Monthly Income   : ₹${Math.round(income)}
- Monthly Expenses : ₹${Math.round(totalExpense)}
- Monthly Savings  : ₹${Math.round(savingAmount)} per month (${savingRate}% saving rate)
- Financial Goal   : "${goal}"
- Risk Appetite    : ${risk}
${age ? `- Age : ${age} years` : ""}

SPENDING PATTERN:
${spendingPattern}

OVERSPENDING:
${overspendText}

WHAT THE AI MUST DO:
1. Look at the top expense category "${topCatName}" — your recommendations must address WHY this category is high and HOW saving from it helps
2. Choose investment schemes ONLY suitable for ${risk} risk + goal "${goal}"
3. Split ₹${Math.round(savingAmount)}/month across 3-5 schemes with realistic amounts that add up to approximately ₹${Math.round(savingAmount)}
4. Each "reason" field MUST mention the user's actual income ₹${Math.round(income)}, savings ₹${Math.round(savingAmount)}, or top category "${topCatName}" — make it feel personal
5. The "steps" in monthlyPlan must be specific to reducing "${topCatName}" expenses
6. The "summary" must be 2-3 sentences using the user's actual numbers — not generic text

Return ONLY this JSON (no markdown, no extra text):
{
  "analysis": {
    "highestExpenseCategory": "<compute from data above>",
    "currentExpense": <actual amount spent on top category>,
    "recommendedExpense": <realistic reduced target — typically 70-80% of current>,
    "possibleSaving": <difference between current and recommended top-category spend>,
    "overspendingCategories": [<list categories where spending is excessive>],
    "spendingHealthScore": <integer 1-10: 10=excellent saver, 1=spending all income. Base on ${savingRate}% saving rate>,
    "savingRatePercent": ${savingRate}
  },
  "recommendations": [
    {
      "scheme": "<real Indian scheme — must fit ${risk} risk AND '${goal}' goal>",
      "type": "<Government Scheme|Investment|Banking|Emergency>",
      "reason": "<1-2 sentences: WHY this scheme fits income ₹${Math.round(income)}, savings ₹${Math.round(savingAmount)}, goal '${goal}', and how it relates to the '${topCatName}' spending issue>",
      "recommendedAmount": <monthly rupees — realistic for their savings of ₹${Math.round(savingAmount)}>,
      "riskLevel": "<Low|Medium|High>",
      "tenure": "<specific realistic period>"
    }
  ],
  "monthlyPlan": {
    "currentSavings": ${Math.round(savingAmount)},
    "targetSavings": ${Math.round(savingAmount * 1.1)},
    "totalInvestRecommended": <sum all recommendedAmounts>,
    "steps": [
      "<Specific action to reduce '${topCatName}' expenses — mention actual amount>",
      "<Specific step to start the first recommended investment — mention scheme name and amount>",
      "<How to track progress next month using ExpenseIQ>"
    ]
  },
  "summary": "<2-3 sentences: state the user's income ₹${Math.round(income)}, monthly savings ₹${Math.round(savingAmount)}, and what makes their spending unique (top category '${topCatName}'). Then explain why you chose these specific schemes for '${goal}' goal with ${risk} risk. End with one encouraging sentence.>"
}`;

    // ── Call Groq (JSON mode) ─────────────────────────────
    let advisorData = null;
    let source      = "mock";

    const rawText = await groqService.chat(systemPrompt, userPrompt, {
      temperature: 0.75, // high enough to produce varied, personalized output per user
      maxTokens:   1800,
      jsonMode:    true,
    });

    if (rawText) {
      try {
        // Strip any markdown code fences the model might add despite jsonMode
        let cleaned = rawText.trim();
        const fenceStart = cleaned.match(/^```(?:json)?\s*/i);
        if (fenceStart) cleaned = cleaned.slice(fenceStart[0].length);
        const fenceEnd = cleaned.match(/\s*```\s*$/);
        if (fenceEnd) cleaned = cleaned.slice(0, cleaned.length - fenceEnd[0].length);
        cleaned = cleaned.trim();

        // Find first { and last } to extract pure JSON even if there's surrounding text
        const jsonStart = cleaned.indexOf("{");
        const jsonEnd   = cleaned.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
        }

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
  const saving      = Math.max(potentialSaving, Math.round(income * 0.10), 500);
  const topCat      = topCategory?._id || "General";
  const topSpent    = topCategory?.total || 0;
  const recSpend    = Math.round(topSpent * 0.75);
  const savingRate  = income > 0 ? Math.round(((income - totalExpense) / income) * 100) : 0;
  const healthScore = Math.max(1, Math.min(10, Math.round(savingRate / 10)));

  const goalL = (goal || "").toLowerCase();
  const isEmergency  = goalL.includes("emergency");
  const isRetirement = goalL.includes("retirement") || goalL.includes("long");
  const isShortTerm  = goalL.includes("short") || goalL.includes("1-3");
  const isTaxSaving  = goalL.includes("tax");
  const isEducation  = goalL.includes("education") || goalL.includes("child");

  // ── Category-specific advice wording ──────────────────────
  const catAdvice = {
    Food:          `Your Food spending of ₹${topSpent.toLocaleString("en-IN")} is your highest expense. Reducing food delivery orders and planning weekly meals could save ₹${Math.round(topSpent * 0.25).toLocaleString("en-IN")}/month.`,
    Shopping:      `Your Shopping spend of ₹${topSpent.toLocaleString("en-IN")} suggests impulse buying. A 30-day rule before non-essential purchases can redirect ₹${Math.round(topSpent * 0.30).toLocaleString("en-IN")}/month to investments.`,
    Entertainment: `Your Entertainment spend of ₹${topSpent.toLocaleString("en-IN")} is high. Consolidating OTT subscriptions and reducing outings could free ₹${Math.round(topSpent * 0.35).toLocaleString("en-IN")}/month.`,
    Travel:        `Your Travel expenses of ₹${topSpent.toLocaleString("en-IN")} are significant. Using public transport and carpooling can save ₹${Math.round(topSpent * 0.25).toLocaleString("en-IN")}/month.`,
    Bills:         `Your Bills of ₹${topSpent.toLocaleString("en-IN")} are your largest category. Reviewing subscriptions and switching to energy-efficient appliances can reduce this.`,
    Health:        `Your Health spending of ₹${topSpent.toLocaleString("en-IN")} is important. Ensure you have health insurance to avoid large unplanned expenses.`,
    Education:     `Your Education investment of ₹${topSpent.toLocaleString("en-IN")} is positive. Consider PPF or NSC for tax-efficient long-term education savings.`,
    Others:        `Your miscellaneous expenses of ₹${topSpent.toLocaleString("en-IN")} can be reduced by tracking daily spends. A savings of 20% here adds up quickly.`,
  };
  const catMsg = catAdvice[topCat] || `Reviewing your ${topCat} spending can help free up funds for investment.`;

  // ── Dynamic scheme pool: select based on goal + risk + category ──
  const ALL_SCHEMES = {
    ppf:       { scheme: "Public Provident Fund (PPF)", type: "Government Scheme",  riskLevel: "Low",    tenure: "15 years",    tags: ["low", "longterm", "tax"] },
    nps:       { scheme: "National Pension System (NPS)", type: "Government Scheme", riskLevel: "Low",   tenure: "Till 60 years", tags: ["low", "retirement", "tax"] },
    nsc:       { scheme: "National Savings Certificate (NSC)", type: "Government Scheme", riskLevel: "Low", tenure: "5 years",  tags: ["low", "shortterm", "tax"] },
    apY:       { scheme: "Atal Pension Yojana (APY)", type: "Government Scheme",    riskLevel: "Low",    tenure: "Till 60 years", tags: ["low", "retirement"] },
    sgb:       { scheme: "Sovereign Gold Bond (SGB)", type: "Government Scheme",    riskLevel: "Medium", tenure: "8 years",    tags: ["medium", "longterm"] },
    fd:        { scheme: "Fixed Deposit (FD)", type: "Banking",                     riskLevel: "Low",    tenure: "1-5 years",  tags: ["low", "shortterm"] },
    rd:        { scheme: "Recurring Deposit (RD)", type: "Banking",                 riskLevel: "Low",    tenure: "1-3 years",  tags: ["low", "shortterm", "discipline"] },
    liquid:    { scheme: "Liquid Mutual Fund", type: "Investment",                  riskLevel: "Low",    tenure: "Open-ended", tags: ["low", "emergency", "shortterm"] },
    elss:      { scheme: "ELSS Mutual Fund", type: "Investment",                    riskLevel: "Medium", tenure: "3+ years",   tags: ["medium", "tax", "longterm"] },
    indexSip:  { scheme: "Index Fund SIP (Nifty 50)", type: "Investment",           riskLevel: "Medium", tenure: "5+ years",   tags: ["medium", "high", "longterm"] },
    largeCap:  { scheme: "Large Cap SIP", type: "Investment",                       riskLevel: "High",   tenure: "5+ years",   tags: ["high", "longterm"] },
    emergency: { scheme: "Emergency Fund", type: "Emergency",                       riskLevel: "Low",    tenure: "Ongoing",    tags: ["emergency", "low"] },
  };

  // Select schemes intelligently based on profile
  let chosen = [];

  // Emergency fund always first if saving rate is low or goal is emergency
  if (savingRate < 20 || isEmergency) {
    chosen.push({ ...ALL_SCHEMES.emergency,
      reason: `With a ${savingRate}% saving rate, building an emergency fund of 3-6 months of expenses (₹${Math.round(totalExpense * 3).toLocaleString("en-IN")}) should be your immediate priority before any other investment.`,
      recommendedAmount: Math.round(saving * 0.40) });
    chosen.push({ ...ALL_SCHEMES.liquid,
      reason: `A Liquid Fund keeps your emergency corpus accessible while earning slightly more than a savings account. Suitable for your current income of ₹${income.toLocaleString("en-IN")}.`,
      recommendedAmount: Math.round(saving * 0.30) });
    chosen.push({ ...ALL_SCHEMES.rd,
      reason: `A small Recurring Deposit builds the savings habit and provides guaranteed returns without risk.`,
      recommendedAmount: Math.round(saving * 0.30) });
  } else if (isRetirement) {
    chosen.push({ ...ALL_SCHEMES.nps,
      reason: `NPS is ideal for retirement planning. With income of ₹${income.toLocaleString("en-IN")}, contributions now will compound significantly by retirement.`,
      recommendedAmount: Math.round(saving * 0.30) });
    chosen.push({ ...ALL_SCHEMES.ppf,
      reason: `PPF gives tax-free returns and Section 80C benefit. A 15-year horizon aligns perfectly with retirement planning.`,
      recommendedAmount: Math.round(saving * 0.30) });
    chosen.push({ ...ALL_SCHEMES.indexSip,
      reason: `Index Fund SIP provides equity growth over the long term, essential to beat inflation in a retirement corpus.`,
      recommendedAmount: risk === "Low" ? 0 : Math.round(saving * 0.25) });
    if (risk !== "Low") {
      chosen.push({ ...ALL_SCHEMES.emergency,
        reason: `Always maintain a liquid emergency buffer even while investing for retirement.`,
        recommendedAmount: Math.round(saving * 0.15) });
    } else {
      chosen.push({ ...ALL_SCHEMES.nsc,
        reason: `NSC provides guaranteed returns with Section 80C benefit and no lock-in risk.`,
        recommendedAmount: Math.round(saving * 0.25) });
      chosen.push({ ...ALL_SCHEMES.emergency,
        reason: `Emergency fund ensures you never need to break long-term investments unexpectedly.`,
        recommendedAmount: Math.round(saving * 0.15) });
    }
  } else if (isShortTerm) {
    chosen.push({ ...ALL_SCHEMES.rd,
      reason: `For a short-term goal (1-3 years), RD provides guaranteed monthly accumulation with predictable returns.`,
      recommendedAmount: Math.round(saving * 0.40) });
    chosen.push({ ...ALL_SCHEMES.fd,
      reason: `FD gives a lump-sum guarantee at the end of your short-term period — safe and predictable.`,
      recommendedAmount: Math.round(saving * 0.35) });
    chosen.push({ ...ALL_SCHEMES.liquid,
      reason: `Liquid Fund provides easy access and slightly higher returns than a savings account for your remaining savings.`,
      recommendedAmount: Math.round(saving * 0.25) });
  } else if (isTaxSaving) {
    chosen.push({ ...ALL_SCHEMES.elss,
      reason: `ELSS is the best tax-saving investment under Section 80C — 3-year lock-in with equity growth potential.`,
      recommendedAmount: Math.round(saving * 0.35) });
    chosen.push({ ...ALL_SCHEMES.ppf,
      reason: `PPF gives tax-free returns and Section 80C deduction. Essential in any tax-saving portfolio.`,
      recommendedAmount: Math.round(saving * 0.30) });
    if (risk !== "Low") {
      chosen.push({ ...ALL_SCHEMES.nps,
        reason: `NPS offers additional ₹50,000 deduction under Section 80CCD(1B) beyond the 80C limit.`,
        recommendedAmount: Math.round(saving * 0.20) });
    } else {
      chosen.push({ ...ALL_SCHEMES.nsc,
        reason: `NSC qualifies for Section 80C and provides safe, guaranteed returns.`,
        recommendedAmount: Math.round(saving * 0.20) });
    }
    chosen.push({ ...ALL_SCHEMES.emergency,
      reason: `Emergency fund ensures tax-saving investments are never broken prematurely.`,
      recommendedAmount: Math.round(saving * 0.15) });
  } else if (isEducation) {
    chosen.push({ ...ALL_SCHEMES.ppf,
      reason: `PPF is one of the best long-term education savings options — tax-free and government-backed.`,
      recommendedAmount: Math.round(saving * 0.35) });
    chosen.push({ ...ALL_SCHEMES.nsc,
      reason: `NSC provides fixed guaranteed returns over 5 years, ideal for planning education expenses.`,
      recommendedAmount: Math.round(saving * 0.25) });
    chosen.push({ ...ALL_SCHEMES.rd,
      reason: `RD builds a dedicated monthly corpus for upcoming education fees.`,
      recommendedAmount: Math.round(saving * 0.25) });
    chosen.push({ ...ALL_SCHEMES.emergency,
      reason: `An emergency fund prevents breaking education savings in case of unexpected expenses.`,
      recommendedAmount: Math.round(saving * 0.15) });
  } else {
    // General savings — differentiate by risk
    if (risk === "Low") {
      chosen.push({ ...ALL_SCHEMES.ppf,
        reason: `With a ${risk} risk preference and income of ₹${income.toLocaleString("en-IN")}, PPF offers safe, tax-free long-term growth — a foundational investment.`,
        recommendedAmount: Math.round(saving * 0.35) });
      chosen.push({ ...ALL_SCHEMES.rd,
        reason: `RD addresses your ${topCat} overspending by converting saved amounts into guaranteed monthly deposits.`,
        recommendedAmount: Math.round(saving * 0.25) });
      chosen.push({ ...ALL_SCHEMES.nsc,
        reason: `NSC provides 5-year guaranteed returns with Section 80C benefit. Safe for medium-term savings.`,
        recommendedAmount: Math.round(saving * 0.20) });
      chosen.push({ ...ALL_SCHEMES.emergency,
        reason: `Given your ${topCat} expenses, an emergency fund protects against sudden large costs in that category.`,
        recommendedAmount: Math.round(saving * 0.20) });
    } else if (risk === "Medium") {
      chosen.push({ ...ALL_SCHEMES.indexSip,
        reason: `Index Fund SIP on Nifty 50 is suitable for your medium risk profile — diversified, low-cost equity exposure for long-term wealth creation.`,
        recommendedAmount: Math.round(saving * 0.35) });
      chosen.push({ ...ALL_SCHEMES.ppf,
        reason: `PPF provides a guaranteed, risk-free anchor to your portfolio. With ₹${income.toLocaleString("en-IN")} income, the Section 80C benefit is significant.`,
        recommendedAmount: Math.round(saving * 0.25) });
      chosen.push({ ...ALL_SCHEMES.elss,
        reason: `ELSS balances tax saving and equity growth — ideal for your ${goal} goal.`,
        recommendedAmount: Math.round(saving * 0.20) });
      chosen.push({ ...ALL_SCHEMES.emergency,
        reason: `Your ${topCat} spending pattern suggests occasional large expenses — an emergency fund prevents disrupting your investments.`,
        recommendedAmount: Math.round(saving * 0.20) });
    } else {
      // High risk
      chosen.push({ ...ALL_SCHEMES.indexSip,
        reason: `For a high-risk appetite, Nifty 50 Index Fund SIP gives the best long-term risk-adjusted returns with low expense ratio.`,
        recommendedAmount: Math.round(saving * 0.40) });
      chosen.push({ ...ALL_SCHEMES.elss,
        reason: `ELSS Mutual Fund combines Section 80C tax saving with equity growth — best for aggressive investors.`,
        recommendedAmount: Math.round(saving * 0.25) });
      chosen.push({ ...ALL_SCHEMES.sgb,
        reason: `Sovereign Gold Bond provides 2.5% annual interest + gold price appreciation. Good inflation hedge for a high-risk portfolio.`,
        recommendedAmount: Math.round(saving * 0.15) });
      chosen.push({ ...ALL_SCHEMES.emergency,
        reason: `Even aggressive investors need a liquid safety net to avoid selling investments during market downturns.`,
        recommendedAmount: Math.round(saving * 0.20) });
    }
  }

  // Remove zero-amount schemes
  chosen = chosen.filter(s => s.recommendedAmount > 0);
  const totalInvest = chosen.reduce((s, r) => s + r.recommendedAmount, 0);

  return {
    analysis: {
      highestExpenseCategory:  topCat,
      currentExpense:          topSpent,
      recommendedExpense:      recSpend,
      possibleSaving:          saving,
      overspendingCategories:  topCat !== "General" ? [topCat] : [],
      spendingHealthScore:     healthScore,
      savingRatePercent:       savingRate,
    },
    recommendations: chosen,
    monthlyPlan: {
      currentSavings:          Math.max(0, income - totalExpense),
      targetSavings:           Math.round(saving * 1.1),
      totalInvestRecommended:  totalInvest,
      steps: [
        catMsg,
        `Set up auto-debit for ${chosen[0]?.scheme || "your first investment"} of ₹${chosen[0]?.recommendedAmount?.toLocaleString("en-IN") || 0}/month on your salary credit date.`,
        `Review your ${topCat} expenses weekly using the ExpenseIQ expense tracker to stay on budget.`,
      ],
    },
    summary: `Based on your monthly income of ₹${income.toLocaleString("en-IN")}, expenses of ₹${totalExpense.toLocaleString("en-IN")}, and a ${risk.toLowerCase()} risk appetite with a goal of "${goal}", you have ₹${Math.round(income - totalExpense).toLocaleString("en-IN")}/month available to invest. ${catMsg} You may consider allocating across ${chosen.length} schemes totalling ₹${totalInvest.toLocaleString("en-IN")}/month — this is a personalized educational guidance based on your financial profile.`,
  };
}

module.exports = { getAIInsights, getAdvisor };
