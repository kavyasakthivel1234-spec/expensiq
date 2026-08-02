// ============================================================
// FILE   : frontend/assets/js/budget.js
// ============================================================
requireAuth();
initTheme();
initSidebar();

// Set current month/year as defaults
const now = new Date();
document.getElementById("sel-month").value = now.getMonth() + 1;
document.getElementById("sel-year").value  = now.getFullYear();
document.getElementById("bud-month").value = now.getMonth() + 1;
document.getElementById("bud-year").value  = now.getFullYear();

async function loadBudgets() {
  const grid  = document.getElementById("budget-grid");
  const month = document.getElementById("sel-month").value;
  const year  = document.getElementById("sel-year").value;
  grid.innerHTML = `<div class="loading-center" style="grid-column:1/-1"><div class="spinner"></div></div>`;

  const res = await apiFetch(`/budget?month=${month}&year=${year}`);
  if (!res?.ok) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i>❌</i><p>Failed to load budgets</p></div>`;
    return;
  }

  const { budgets } = res.data;
  if (!budgets.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i>🎯</i><p>No budgets set for this period.<br>Click "+ Set Budget" to get started.</p></div>`;
    return;
  }

  grid.innerHTML = budgets.map(b => {
    const fillClass = b.exceeded ? "exceeded" : b.warning ? "warning" : "";
    const statusIcon = b.exceeded ? "🚨" : b.warning ? "⚠️" : "✅";
    const statusText = b.exceeded ? "Budget exceeded!" : b.warning ? "Over 80% used" : "On track";
    return `
    <div class="card">
      <div class="flex-between mb-1">
        <strong>${b.category}</strong>
        <span style="font-size:18px">${statusIcon}</span>
      </div>
      <div class="flex-between mb-1">
        <span class="text-muted" style="font-size:13px">Spent</span>
        <span class="${b.exceeded ? "text-danger" : "text-success"}" style="font-weight:700">${formatCurrency(b.spent)}</span>
      </div>
      <div class="flex-between mb-2">
        <span class="text-muted" style="font-size:13px">Limit</span>
        <span style="font-weight:700">${formatCurrency(b.limitAmount)}</span>
      </div>
      <div class="progress-bar-wrap mb-1">
        <div class="progress-bar-fill ${fillClass}" style="width:${Math.min(b.percentage,100)}%"></div>
      </div>
      <div class="flex-between">
        <small class="text-muted">${b.percentage}% used</small>
        <small class="${b.exceeded ? "text-danger" : b.warning ? "text-warning" : "text-success"}">${statusText}</small>
      </div>
      <div class="flex-between mt-2">
        <small class="text-muted">Remaining: <strong>${formatCurrency(Math.max(0, b.remaining))}</strong></small>
        <button class="btn btn-danger btn-sm" onclick="deleteBudget('${b._id}')">🗑️</button>
      </div>
    </div>`;
  }).join("");
}

// Save budget
document.getElementById("budget-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("save-btn");
  btn.textContent = "Saving..."; btn.disabled = true;

  const body = {
    category:    document.getElementById("bud-category").value,
    limitAmount: parseFloat(document.getElementById("bud-limit").value),
    month:       parseInt(document.getElementById("bud-month").value),
    year:        parseInt(document.getElementById("bud-year").value),
  };

  const res = await apiFetch("/budget", { method: "POST", body });
  btn.textContent = "Save Budget"; btn.disabled = false;

  if (res?.ok) {
    showToast("Budget saved!", "success");
    closeModal("budget-modal");
    document.getElementById("budget-form").reset();
    document.getElementById("bud-month").value = now.getMonth() + 1;
    document.getElementById("bud-year").value  = now.getFullYear();
    loadBudgets();
  } else {
    showToast(res?.data?.message || "Failed to save", "error");
  }
});

async function deleteBudget(id) {
  if (!confirm("Delete this budget?")) return;
  const res = await apiFetch(`/budget/${id}`, { method: "DELETE" });
  if (res?.ok) { showToast("Budget deleted", "success"); loadBudgets(); }
  else showToast("Failed to delete", "error");
}

loadBudgets();
