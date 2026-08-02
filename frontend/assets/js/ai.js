// ============================================================
// FILE   : frontend/assets/js/ai.js
// PURPOSE: AI Financial Advisor + Scheme Recommendations page
// ============================================================
requireAuth();
initTheme();
initSidebar();

// ── Scheme type → CSS class mapping ──────────────────────────
const SCHEME_CLASS = {
  "Government Scheme": "gov",
  "Investment":        "invest",
  "Banking":           "bank",
  "Emergency":         "emergency",
};

// ── Risk → color ──────────────────────────────────────────────
const RISK_COLOR = { Low: "#28a745", Medium: "#ffc107", High: "#dc3545" };

// ── Load financial snapshot on page load ─────────────────────
async function loadSnapshot() {
  const res = await apiFetch("/dashboard/summary");
  if (!res?.ok) return;

  const s = res.data.summary;
  document.getElementById("snap-income").textContent  = formatCurrency(s.totalIncome);
  document.getElementById("snap-expense").textContent = formatCurrency(s.totalExpense);

  const balEl = document.getElementById("snap-balance");
  balEl.textContent = formatCurrency(s.balance);
  balEl.className   = "stat-value " + (s.balance >= 0 ? "text-success" : "text-danger");

  // Pre-fill income field
  if (s.totalIncome > 0) {
    document.getElementById("prof-income").value = Math.round(s.totalIncome);
  }

  // Saving potential shown as 15% of income as a starter estimate
  const potential = Math.round(s.totalIncome * 0.15);
  document.getElementById("snap-saving").textContent = formatCurrency(potential);
}

// ── Main: Run AI Advisor ──────────────────────────────────────
async function runAdvisor() {
  const btn = document.getElementById("advisor-btn");
  btn.textContent = "⏳ Analyzing...";
  btn.disabled    = true;

  // Hide previous results, show loading
  document.getElementById("advisor-results").style.display = "none";
  document.getElementById("initial-state").style.display   = "none";

  // Show loading card
  const loading = document.createElement("div");
  loading.id = "ai-loading";
  loading.className = "card mb-3";
  loading.innerHTML = `
    <div class="loading-center" style="padding:32px;flex-direction:column;gap:12px">
      <div class="spinner"></div>
      <p style="color:var(--text-muted);font-size:14px">🤖 AI is analyzing your spending patterns...</p>
      <p style="color:var(--text-muted);font-size:12px">This may take 10–20 seconds</p>
    </div>`;
  document.querySelector(".main-content").appendChild(loading);

  // Gather user profile inputs
  const income = parseFloat(document.getElementById("prof-income").value) || 0;
  const goal   = document.getElementById("prof-goal").value;
  const risk   = document.getElementById("prof-risk").value;
  const age    = parseInt(document.getElementById("prof-age").value) || null;

  const body = { goal, risk };
  if (income > 0) body.income = income;
  if (age)        body.age    = age;

  const res = await apiFetch("/ai/advisor", { method: "POST", body });

  // Cleanup
  loading.remove();
  btn.textContent = "✨ Get Recommendations";
  btn.disabled    = false;

  if (!res?.ok) {
    document.getElementById("initial-state").style.display = "block";
    showToast(res?.data?.message || "Failed to generate recommendations", "error");
    return;
  }

  renderAdvisor(res.data);
}

// ── Render the full advisor UI ────────────────────────────────
function renderAdvisor(response) {
  const { advisor, context, source } = response;
  if (!advisor) {
    showToast("Incomplete AI response. Try again.", "error");
    document.getElementById("initial-state").style.display = "block";
    return;
  }

  // ── Update snapshot stats with real 30-day data ───────────
  if (context) {
    document.getElementById("snap-income").textContent  = formatCurrency(context.totalIncome);
    document.getElementById("snap-expense").textContent = formatCurrency(context.totalExpense);
    const balEl = document.getElementById("snap-balance");
    balEl.textContent = formatCurrency(context.balance);
    balEl.className   = "stat-value " + (context.balance >= 0 ? "text-success" : "text-danger");
    document.getElementById("snap-saving").textContent  = formatCurrency(context.potentialSaving || 0);
  }

  // ── Health Score ─────────────────────────────────────────
  const score    = advisor.analysis?.spendingHealthScore || 5;
  const scoreEl  = document.getElementById("health-score");
  const ringEl   = document.getElementById("health-ring");
  const barEl    = document.getElementById("health-bar");
  const labelEl  = document.getElementById("health-label");

  scoreEl.textContent = score;
  ringEl.style.setProperty("--pct", score * 10);

  const healthColor = score >= 7 ? "#28a745" : score >= 4 ? "#ffc107" : "#dc3545";
  ringEl.style.background = `conic-gradient(${healthColor} ${score * 36}deg, var(--border) 0deg)`;
  barEl.style.width        = (score * 10) + "%";
  barEl.style.background   = healthColor;

  labelEl.textContent = score >= 7 ? "Good 👍" : score >= 4 ? "Average ⚠️" : "Needs Work ❗";
  labelEl.style.color  = healthColor;

  // ── Analysis numbers ──────────────────────────────────────
  document.getElementById("res-top-cat").textContent  = advisor.analysis?.highestExpenseCategory || "—";
  document.getElementById("res-curr-exp").textContent = formatCurrency(advisor.analysis?.currentExpense);
  document.getElementById("res-rec-exp").textContent  = formatCurrency(advisor.analysis?.recommendedExpense);
  document.getElementById("res-saving").textContent   = formatCurrency(advisor.analysis?.possibleSaving);
  document.getElementById("res-saving-rate").textContent = (advisor.analysis?.savingRatePercent || 0) + "%";

  // ── Overspending detection ────────────────────────────────
  const ovEl = document.getElementById("overspend-list");
  const ovData = context?.overspending || [];

  if (ovData.length) {
    ovEl.innerHTML = ovData.map(o => `
      <div class="overspend-row">
        <div style="min-width:90px">${getCategoryBadge(o.category)}</div>
        <div class="overspend-bar">
          <div class="flex-between" style="font-size:12px;margin-bottom:3px">
            <span>₹${o.spent.toFixed(0)} spent</span>
            <span class="text-muted">Limit ₹${o.recommended.toFixed(0)}</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill exceeded" style="width:${Math.min(100, o.pct)}%"></div>
          </div>
        </div>
        <div style="min-width:70px;text-align:right">
          <span class="text-danger" style="font-size:12px;font-weight:700">+₹${o.excess.toFixed(0)}</span>
        </div>
      </div>`).join("");
  } else {
    ovEl.innerHTML = `<div class="empty-state" style="padding:20px"><i>✅</i><p>No overspending detected this month!</p></div>`;
  }

  // ── Scheme Recommendations ────────────────────────────────
  const schemeGrid = document.getElementById("scheme-grid");
  const recs = advisor.recommendations || [];

  if (recs.length) {
    schemeGrid.innerHTML = recs.map(rec => {
      const cssClass = SCHEME_CLASS[rec.type] || "other";
      const riskColor = RISK_COLOR[rec.riskLevel] || "#6c757d";
      return `
        <div class="scheme-card ${cssClass}">
          <div class="scheme-header">
            <div>
              <div class="scheme-type text-muted">${rec.type}</div>
              <div class="scheme-name">${rec.scheme}</div>
            </div>
            <div class="scheme-amount">${formatCurrency(rec.recommendedAmount)}<div style="font-size:10px;font-weight:400;color:var(--text-muted);text-align:right">/month</div></div>
          </div>
          <div class="scheme-reason">${rec.reason}</div>
          <div class="scheme-meta">
            <span>Risk: <strong style="color:${riskColor}">${rec.riskLevel}</strong></span>
            ${rec.tenure ? `<span>Tenure: <strong>${rec.tenure}</strong></span>` : ""}
          </div>
        </div>`;
    }).join("");
  } else {
    schemeGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i>📊</i><p>No recommendations generated. Add expenses first.</p></div>`;
  }

  // Source badge
  const badge = document.getElementById("scheme-source-badge");
  badge.textContent = source === "groq" ? "🤖 Groq AI" : "📊 Offline Analysis";
  badge.style.background = source === "groq" ? "#e8e6ff" : "#e2e3e5";

  // ── Monthly Action Plan ───────────────────────────────────
  const plan = advisor.monthlyPlan;
  if (plan) {
    document.getElementById("plan-total").textContent = formatCurrency(plan.totalInvestRecommended);
    document.getElementById("plan-steps").innerHTML = (plan.steps || [])
      .map((step, i) => `
        <div class="plan-step">
          <div class="step-num">${i + 1}</div>
          <div style="font-size:13px;line-height:1.5">${step}</div>
        </div>`)
      .join("");
  }

  // ── AI Summary ────────────────────────────────────────────
  document.getElementById("ai-summary").textContent = advisor.summary || "Analysis complete.";

  // ── Category Breakdown ────────────────────────────────────
  const cats = context?.categoryBreakdown || [];
  const catEl = document.getElementById("category-breakdown");
  if (cats.length) {
    const grandTotal = cats.reduce((s, c) => s + c.total, 0);
    catEl.innerHTML = cats.map(c => {
      const pct = grandTotal > 0 ? Math.round((c.total / grandTotal) * 100) : 0;
      return `
        <div style="margin-bottom:14px">
          <div class="flex-between mb-1">
            <span>${getCategoryBadge(c._id)} <small class="text-muted">(${c.count} transactions)</small></span>
            <strong>${formatCurrency(c.total)} <small class="text-muted">${pct}%</small></strong>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join("");
  } else {
    catEl.innerHTML = `<div class="empty-state"><i>📊</i><p>No expense data for last 30 days</p></div>`;
  }

  // ── Show results ──────────────────────────────────────────
  document.getElementById("initial-state").style.display   = "none";
  document.getElementById("advisor-results").style.display = "block";

  showToast(
    source === "groq"
      ? "AI recommendations ready! 🎉"
      : "Offline recommendations generated",
    "success"
  );

  // Scroll to results
  document.getElementById("advisor-results").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Load snapshot stats immediately on page open
loadSnapshot();
