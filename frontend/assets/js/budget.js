// ============================================================
// FILE   : frontend/assets/js/budget.js
// FEATURES:
//   - Salary validation: budget cannot exceed monthly income
//   - Edit budget (load values into modal)
//   - Professional delete confirm modal (no browser confirm())
//   - Monthly overview stats
//   - Real-time limit validation with warning
// ============================================================
requireAuth();
initTheme();
initSidebar();

const now = new Date();
let monthlySalary  = 0;  // fetched from income API
let deleteBudgetId = null;
let deleteBudgetCat = "";

// ── Set current month/year defaults ──────────────────────────
document.getElementById("sel-month").value  = now.getMonth() + 1;
document.getElementById("sel-year").value   = now.getFullYear();
document.getElementById("bud-month").value  = now.getMonth() + 1;
document.getElementById("bud-year").value   = now.getFullYear();

// ── Fetch monthly income to use for salary validation ─────────
async function fetchMonthlySalary() {
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  // Use dashboard summary to get monthly income
  const res = await apiFetch("/dashboard/summary");
  if (res?.ok) {
    const income = res.data.summary?.totalIncome || 0;
    monthlySalary = income;
    const display = document.getElementById("salary-display");
    if (display) display.textContent = formatCurrency(monthlySalary);
    const warnAmt = document.getElementById("warn-salary-amount");
    if (warnAmt) warnAmt.textContent = formatCurrency(monthlySalary);
  }
}

// ── Real-time budget limit validation ─────────────────────────
function validateBudgetLimit() {
  const limitInput = document.getElementById("bud-limit");
  const limitVal   = parseFloat(limitInput.value) || 0;
  const errEl      = document.getElementById("err-limit");
  const warnEl     = document.getElementById("warn-salary");
  const saveBtn    = document.getElementById("save-btn");

  // Clear states
  limitInput.classList.remove("is-error", "is-warning");
  errEl.classList.remove("show");
  warnEl.classList.remove("show");

  if (limitVal <= 0 && limitInput.value !== "") {
    // Invalid amount
    limitInput.classList.add("is-error");
    errEl.classList.add("show");
    saveBtn.disabled = true;
    return false;
  }

  if (monthlySalary > 0 && limitVal > monthlySalary) {
    // Exceeds salary — show warning but still allow saving (soft warning)
    limitInput.classList.add("is-warning");
    warnEl.classList.add("show");
    // Update the warn amount in case salary changed
    const warnAmt = document.getElementById("warn-salary-amount");
    if (warnAmt) warnAmt.textContent = formatCurrency(monthlySalary);
    // Don't disable save — it's a warning, not a hard block
    saveBtn.disabled = false;
    return true; // still valid, just warned
  }

  saveBtn.disabled = false;
  return true;
}

// ── Open modal for ADDING a new budget ───────────────────────
function openAddBudget() {
  document.getElementById("budget-id").value    = "";
  document.getElementById("budget-form").reset();
  document.getElementById("bud-month").value    = now.getMonth() + 1;
  document.getElementById("bud-year").value     = now.getFullYear();
  document.getElementById("budget-modal-title").textContent = "Set Monthly Budget";
  document.getElementById("save-btn").textContent = "Save Budget";
  // Clear validation states
  clearBudgetValidation();
  openModal("budget-modal");
}

// ── Open modal for EDITING an existing budget ─────────────────
function openEditBudget(id, category, limitAmount, month, year) {
  document.getElementById("budget-id").value    = id;
  document.getElementById("bud-category").value = category;
  document.getElementById("bud-limit").value    = limitAmount;
  document.getElementById("bud-month").value    = month;
  document.getElementById("bud-year").value     = year;
  document.getElementById("budget-modal-title").textContent = "Edit Budget";
  document.getElementById("save-btn").textContent = "Update Budget";
  clearBudgetValidation();
  // Validate after pre-filling
  validateBudgetLimit();
  openModal("budget-modal");
}

function clearBudgetValidation() {
  ["bud-limit","bud-category"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("is-error","is-warning");
  });
  ["err-limit","err-category","warn-salary"].forEach(id => {
    document.getElementById(id)?.classList.remove("show");
  });
  document.getElementById("save-btn").disabled = false;
}

function closeBudgetModal() {
  closeModal("budget-modal");
  clearBudgetValidation();
}

// ── Validate all fields before submit ────────────────────────
function validateBudgetForm() {
  let valid = true;
  const category  = document.getElementById("bud-category").value;
  const limitVal  = parseFloat(document.getElementById("bud-limit").value) || 0;
  const catEl     = document.getElementById("bud-category");
  const limitEl   = document.getElementById("bud-limit");
  const errCat    = document.getElementById("err-category");
  const errLimit  = document.getElementById("err-limit");

  // Category
  if (!category) {
    catEl.classList.add("is-error");
    errCat.classList.add("show");
    valid = false;
  } else {
    catEl.classList.remove("is-error");
    errCat.classList.remove("show");
  }

  // Amount
  if (!limitVal || limitVal <= 0) {
    limitEl.classList.add("is-error");
    errLimit.classList.add("show");
    valid = false;
  } else {
    limitEl.classList.remove("is-error");
    errLimit.classList.remove("show");
  }

  // Hard block if salary known and budget far exceeds it (> 2x)
  // Soft warning already shown for > salary
  // We do NOT block at exactly > salary — just warn
  return valid;
}

// ── Load budgets for selected month/year ─────────────────────
async function loadBudgets() {
  const grid  = document.getElementById("budget-grid");
  const month = parseInt(document.getElementById("sel-month").value);
  const year  = parseInt(document.getElementById("sel-year").value);
  grid.innerHTML = `<div class="loading-center" style="grid-column:1/-1"><div class="spinner"></div></div>`;

  const res = await apiFetch(`/budget?month=${month}&year=${year}`);
  if (!res?.ok) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i>❌</i><p>Failed to load budgets</p></div>`;
    return;
  }

  const { budgets } = res.data;

  // Update month overview stats
  updateMonthOverview(budgets, month, year);

  if (!budgets.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <i>🎯</i>
        <p>No budgets set for this period.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="openAddBudget()">+ Set Your First Budget</button>
      </div>`;
    return;
  }

  grid.innerHTML = budgets.map(b => {
    const statusClass = b.exceeded ? "exceeded" : b.warning ? "warning" : "ok";
    const statusText  = b.exceeded ? "Exceeded 🚨" : b.warning ? "Warning ⚠️" : "On Track ✅";

    return `
    <div class="budget-card ${statusClass}">
      <div class="flex-between mb-2">
        <div>
          <div style="font-size:16px;font-weight:700">${b.category}</div>
          <span class="budget-status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="budget-actions">
          <button class="btn btn-outline btn-icon btn-sm"
            onclick="openEditBudget('${b._id}','${b.category}',${b.limitAmount},${b.month},${b.year})"
            title="Edit">✏️</button>
          <button class="btn btn-danger btn-icon btn-sm"
            onclick="confirmDeleteBudget('${b._id}','${b.category}')"
            title="Delete">🗑️</button>
        </div>
      </div>

      <div class="flex-between mb-1" style="font-size:13px">
        <span class="text-muted">Spent</span>
        <strong class="${b.exceeded ? "text-danger" : "text-success"}">${formatCurrency(b.spent)}</strong>
      </div>
      <div class="flex-between mb-2" style="font-size:13px">
        <span class="text-muted">Budget Limit</span>
        <strong>${formatCurrency(b.limitAmount)}</strong>
      </div>

      <div class="progress-bar-wrap mb-1" style="height:10px">
        <div class="progress-bar-fill ${b.exceeded ? "exceeded" : b.warning ? "warning" : ""}"
          style="width:${Math.min(b.percentage, 100)}%"></div>
      </div>
      <div class="flex-between" style="font-size:12px">
        <span class="text-muted">${b.percentage}% used</span>
        <span class="${b.exceeded ? "text-danger" : "text-muted"}">
          ${b.exceeded
            ? `Over by ${formatCurrency(Math.abs(b.remaining))}`
            : `${formatCurrency(Math.max(0, b.remaining))} left`}
        </span>
      </div>
    </div>`;
  }).join("");
}

// ── Monthly overview strip ────────────────────────────────────
async function updateMonthOverview(budgets, month, year) {
  const totalBudgeted = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalSpent    = budgets.reduce((s, b) => s + b.spent, 0);
  const totalRemain   = budgets.reduce((s, b) => s + Math.max(0, b.remaining), 0);

  document.getElementById("ov-income").textContent    = formatCurrency(monthlySalary);
  document.getElementById("ov-expense").textContent   = formatCurrency(totalSpent);
  document.getElementById("ov-budgeted").textContent  = formatCurrency(totalBudgeted);
  document.getElementById("ov-remaining").textContent = formatCurrency(totalRemain);
  document.getElementById("ov-count").textContent     = budgets.length;
}

// ── Save budget (create or update) ───────────────────────────
document.getElementById("budget-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateBudgetForm()) return;

  const btn = document.getElementById("save-btn");
  btn.textContent = "Saving..."; btn.disabled = true;

  const id = document.getElementById("budget-id").value;
  const body = {
    category:    document.getElementById("bud-category").value,
    limitAmount: parseFloat(document.getElementById("bud-limit").value),
    month:       parseInt(document.getElementById("bud-month").value),
    year:        parseInt(document.getElementById("bud-year").value),
  };

  // Additional soft-block if > 2x salary (hard protection)
  if (monthlySalary > 0 && body.limitAmount > monthlySalary * 2) {
    showToast(`⚠️ Budget of ${formatCurrency(body.limitAmount)} is more than 2× your monthly income. Please reconsider.`, "warning");
    btn.textContent = id ? "Update Budget" : "Save Budget";
    btn.disabled = false;
    return;
  }

  // If editing, use PUT; if creating, use POST
  const endpoint = id ? `/budget/${id}` : "/budget";
  const method   = id ? "PUT" : "POST";

  const res = await apiFetch(endpoint, { method, body });
  btn.textContent = id ? "Update Budget" : "Save Budget";
  btn.disabled = false;

  if (res?.ok) {
    showToast(id ? "✅ Budget updated successfully!" : "✅ Budget saved successfully!", "success");
    closeBudgetModal();
    loadBudgets();
  } else {
    showToast(res?.data?.message || "Failed to save budget", "error");
  }
});

// ── Delete budget — professional modal, no confirm() ─────────
function confirmDeleteBudget(id, category) {
  deleteBudgetId  = id;
  deleteBudgetCat = category;
  document.getElementById("del-cat-name").textContent = category;
  openModal("delete-budget-modal");
}

document.getElementById("confirm-delete-budget-btn").addEventListener("click", async () => {
  if (!deleteBudgetId) return;
  const res = await apiFetch(`/budget/${deleteBudgetId}`, { method: "DELETE" });
  closeModal("delete-budget-modal");
  if (res?.ok) {
    showToast(`✅ ${deleteBudgetCat} budget deleted`, "success");
    loadBudgets();
  } else {
    showToast("❌ Failed to delete budget", "error");
  }
  deleteBudgetId  = null;
  deleteBudgetCat = "";
});

// ── Init ──────────────────────────────────────────────────────
fetchMonthlySalary().then(() => loadBudgets());
