// ============================================================
// FILE   : frontend/assets/js/dashboard.js
// ============================================================
requireAuth();
initTheme();
initSidebar();

let pieChart = null;
let barChart = null;

// ── Populate greeting with the logged-in user's name ─────────
(function setGreeting() {
  const user = getUser();
  const nameEl = document.getElementById("greeting-name");
  if (nameEl && user?.fullName) {
    nameEl.textContent = user.fullName.split(" ")[0]; // first name only
  }
})();

async function loadDashboard() {
  const [summaryRes, categoryRes, monthlyRes, recentRes] = await Promise.all([
    apiFetch("/dashboard/summary"),
    apiFetch("/dashboard/category-summary"),
    apiFetch("/dashboard/monthly-report"),
    apiFetch("/dashboard/recent"),
  ]);

  // ── Summary Cards ─────────────────────────────────────
  if (summaryRes?.ok) {
    const s = summaryRes.data.summary;
    document.getElementById("stat-income").textContent  = formatCurrency(s.totalIncome);
    document.getElementById("stat-expense").textContent = formatCurrency(s.totalExpense);

    // Income / expense transaction counts (show under card value)
    const incCountEl = document.getElementById("stat-income-count");
    const expCountEl = document.getElementById("stat-expense-count");
    if (incCountEl) incCountEl.textContent = `${s.totalIncomeCount || 0} income entries`;
    if (expCountEl) expCountEl.textContent = `${s.totalExpenseCount || 0} transactions`;

    const balEl = document.getElementById("stat-balance");
    balEl.textContent  = formatCurrency(s.balance);
    balEl.className    = "stat-value " + (s.balance >= 0 ? "text-success" : "text-danger");

    // Balance label
    const balLabelEl = document.getElementById("stat-balance-label");
    if (balLabelEl) balLabelEl.textContent = s.balance >= 0 ? "You're saving well 🎉" : "Spending exceeds income";

    document.getElementById("stat-monthly").textContent = formatCurrency(s.monthlyExpense);
    document.getElementById("stat-txn").textContent     = `${s.totalTransactions} transactions`;

    // Today's spending pill
    const pillEl = document.getElementById("today-pill");
    if (pillEl) pillEl.textContent = `📅 Today: ${formatCurrency(s.todayExpense || 0)}`;
  }

  // ── Pie Chart — Category ──────────────────────────────
  const pieWrap = document.getElementById("pie-wrap") || document.getElementById("pie-chart")?.parentElement;
  if (categoryRes?.ok && categoryRes.data.categories.length) {
    const cats   = categoryRes.data.categories;
    const colors = ["#6c63ff","#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#ff922b","#cc5de8","#74c0fc"];

    if (pieChart) pieChart.destroy();
    const canvas = document.getElementById("pie-chart");
    if (canvas) {
      pieChart = new Chart(canvas, {
        type: "doughnut",
        data: {
          labels:   cats.map(c => c.category),
          datasets: [{ data: cats.map(c => c.total), backgroundColor: colors, borderWidth: 2 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { font: { size: 12 } } } },
        },
      });
    }
  } else if (pieWrap) {
    pieWrap.innerHTML = `<div class="empty-state"><i>📊</i><p>No expense data yet. Add your first expense!</p></div>`;
  }

  // ── Bar Chart — Monthly ───────────────────────────────
  if (monthlyRes?.ok) {
    const report = monthlyRes.data.report;
    const canvas = document.getElementById("bar-chart");
    if (canvas) {
      if (barChart) barChart.destroy();
      barChart = new Chart(canvas, {
        type: "bar",
        data: {
          labels: report.map(r => r.month),
          datasets: [
            { label: "Income",  data: report.map(r => r.income),  backgroundColor: "#6bcb77", borderRadius: 6 },
            { label: "Expense", data: report.map(r => r.expense), backgroundColor: "#ff6b6b", borderRadius: 6 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: "top" } },
          scales: { y: { beginAtZero: true, ticks: { callback: v => "₹" + v.toLocaleString("en-IN") } } },
        },
      });
    }
  }

  // ── Recent Transactions ───────────────────────────────
  const tbody = document.getElementById("recent-tbody");
  if (!tbody) return;

  if (recentRes?.ok && recentRes.data.transactions.length) {
    tbody.innerHTML = recentRes.data.transactions.map(t => `
      <tr>
        <td>
          <div class="txn-title-cell">
            <strong>${t.title}</strong>
          </div>
        </td>
        <td>${getCategoryBadge(t.category)}</td>
        <td><span class="badge badge-${t.type}">${t.type}</span></td>
        <td>${formatDate(t.date)}</td>
        <td class="text-right ${t.type === "income" ? "text-success" : "text-danger"}">
          <strong>${t.type === "income" ? "+" : "-"}${formatCurrency(t.amount)}</strong>
        </td>
      </tr>`).join("");
  } else {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <i>📭</i>
            <p>No transactions yet. <a href="expenses.html" style="color:var(--primary)">Add your first expense →</a></p>
          </div>
        </td>
      </tr>`;
  }
}

loadDashboard();
