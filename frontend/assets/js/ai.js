// ============================================================
// FILE   : frontend/assets/js/ai.js
// ============================================================
requireAuth();
initTheme();
initSidebar();

async function generateInsights() {
  const btn     = document.getElementById("ai-btn");
  const content = document.getElementById("insights-content");

  btn.textContent = "⏳ Analyzing...";
  btn.disabled    = true;
  content.innerHTML = `<div class="loading-center"><div class="spinner"></div><p style="margin-left:12px;color:var(--text-muted)">AI is analyzing your spending...</p></div>`;

  const res = await apiFetch("/ai/insights", { method: "POST", body: {} });

  btn.textContent = "✨ Generate Insights";
  btn.disabled    = false;

  if (!res?.ok) {
    content.innerHTML = `<div class="empty-state"><i>❌</i><p>${res?.data?.message || "Failed to generate insights"}</p></div>`;
    return;
  }

  const { insights, data } = res.data;

  // Update stats
  if (data) {
    document.getElementById("ai-expense").textContent = formatCurrency(data.totalExpense);
    document.getElementById("ai-income").textContent  = formatCurrency(data.totalIncome);
    const balEl = document.getElementById("ai-balance");
    balEl.textContent = formatCurrency(data.balance);
    balEl.className   = "stat-value " + (data.balance >= 0 ? "text-success" : "text-danger");
  }

  // Show insights
  content.innerHTML = `<div class="insights-box">${insights}</div>`;

  // Show category breakdown
  if (data?.categoryBreakdown?.length) {
    const card = document.getElementById("category-card");
    card.style.display = "block";
    const grandTotal = data.categoryBreakdown.reduce((s, c) => s + c.total, 0);
    document.getElementById("category-list").innerHTML = data.categoryBreakdown.map(c => {
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
  }

  showToast("AI insights generated!", "success");
}
