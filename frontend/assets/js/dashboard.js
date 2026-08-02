// ============================================================
// FILE   : frontend/assets/js/dashboard.js
// ============================================================
requireAuth();
initTheme();
initSidebar();

let pieChart = null;
let barChart = null;

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
    const balEl = document.getElementById("stat-balance");
    balEl.textContent  = formatCurrency(s.balance);
    balEl.className    = "stat-value " + (s.balance >= 0 ? "text-success" : "text-danger");
    document.getElementById("stat-monthly").textContent = formatCurrency(s.monthlyExpense);
    document.getElementById("stat-txn").textContent     = `${s.totalTransactions} transactions`;
  }

  // ── Pie Chart — Category ──────────────────────────────
  if (categoryRes?.ok && categoryRes.data.categories.length) {
    const cats   = categoryRes.data.categories;
    const colors = ["#6c63ff","#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#ff922b","#cc5de8","#74c0fc"];

    if (pieChart) pieChart.destroy();
    pieChart = new Chart(document.getElementById("pie-chart"), {
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
  } else {
    document.getElementById("pie-chart").parentElement.innerHTML =
      `<div class="empty-state"><i>📊</i><p>No expense data yet</p></div>`;
  }

  // ── Bar Chart — Monthly ───────────────────────────────
  if (monthlyRes?.ok) {
    const report = monthlyRes.data.report;
    if (barChart) barChart.destroy();
    barChart = new Chart(document.getElementById("bar-chart"), {
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

  // ── Recent Transactions ───────────────────────────────
  const tbody = document.getElementById("recent-tbody");
  if (recentRes?.ok && recentRes.data.transactions.length) {
    tbody.innerHTML = recentRes.data.transactions.map(t => `
      <tr>
        <td><strong>${t.title}</strong></td>
        <td>${getCategoryBadge(t.category)}</td>
        <td><span class="badge badge-${t.type}">${t.type}</span></td>
        <td>${formatDate(t.date)}</td>
        <td class="text-right ${t.type === "income" ? "text-success" : "text-danger"}">
          ${t.type === "income" ? "+" : "-"}${formatCurrency(t.amount)}
        </td>
      </tr>`).join("");
  } else {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i>📭</i><p>No transactions yet</p></div></td></tr>`;
  }
}

loadDashboard();
