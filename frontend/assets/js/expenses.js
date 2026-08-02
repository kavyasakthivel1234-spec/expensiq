// ============================================================
// FILE   : frontend/assets/js/expenses.js
// ============================================================
requireAuth();
initTheme();
initSidebar();

let currentPage = 1;
let totalPages  = 1;
let deleteId    = null;
let debounceTimer;

// Set today as default date in form
document.getElementById("exp-date").value = new Date().toISOString().split("T")[0];

// ── Load expenses ─────────────────────────────────────────────
async function loadExpenses() {
  const tbody = document.getElementById("expense-tbody");
  tbody.innerHTML = `<tr><td colspan="7"><div class="loading-center"><div class="spinner"></div></div></td></tr>`;

  const search   = document.getElementById("search").value.trim();
  const category = document.getElementById("filter-category").value;
  const start    = document.getElementById("filter-start").value;
  const end      = document.getElementById("filter-end").value;
  const sortBy   = document.getElementById("sort-by").value;
  const order    = document.getElementById("sort-order").value;

  const params = new URLSearchParams({ page: currentPage, limit: 15, sortBy, order });
  if (search)   params.set("search",    search);
  if (category) params.set("category",  category);
  if (start)    params.set("startDate", start);
  if (end)      params.set("endDate",   end);

  const res = await apiFetch(`/expenses?${params}`);
  if (!res?.ok) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i>❌</i><p>Failed to load expenses</p></div></td></tr>`;
    return;
  }

  const { expenses, total, pages } = res.data;
  totalPages = pages || 1;

  document.getElementById("expense-count").textContent = `${total} Expense${total !== 1 ? "s" : ""}`;
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);
  document.getElementById("expense-total").textContent = total ? `Total: ${formatCurrency(grandTotal)}` : "";

  // Pagination controls
  const pag = document.getElementById("pagination");
  if (pages > 1) {
    pag.style.setProperty("display", "flex", "important");
    document.getElementById("page-info").textContent  = `Page ${currentPage} of ${pages}`;
    document.getElementById("prev-btn").disabled      = currentPage <= 1;
    document.getElementById("next-btn").disabled      = currentPage >= pages;
  } else {
    pag.style.setProperty("display", "none", "important");
  }

  if (!expenses.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i>💸</i><p>No expenses found. Add your first one!</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = expenses.map(e => `
    <tr>
      <td><strong>${e.title}</strong></td>
      <td>${getCategoryBadge(e.category)}</td>
      <td><small>${e.paymentMethod || "Cash"}</small></td>
      <td>${formatDate(e.date)}</td>
      <td><small class="text-muted">${e.notes || "—"}</small></td>
      <td class="text-right text-danger"><strong>${formatCurrency(e.amount)}</strong></td>
      <td>
        <button class="btn btn-outline btn-icon btn-sm" onclick="editExpense('${e._id}')" title="Edit">✏️</button>
        <button class="btn btn-danger btn-icon btn-sm" onclick="confirmDelete('${e._id}')" title="Delete">🗑️</button>
      </td>
    </tr>`).join("");
}

function debounceLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadExpenses, 400);
}

function clearFilters() {
  document.getElementById("search").value            = "";
  document.getElementById("filter-category").value  = "";
  document.getElementById("filter-start").value     = "";
  document.getElementById("filter-end").value       = "";
  document.getElementById("sort-by").value          = "date";
  document.getElementById("sort-order").value       = "desc";
  currentPage = 1;
  loadExpenses();
}

function changePage(dir) {
  currentPage = Math.max(1, Math.min(totalPages, currentPage + dir));
  loadExpenses();
}

// ── Save (Create / Update) ────────────────────────────────────
document.getElementById("expense-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("save-btn");
  btn.textContent = "Saving..."; btn.disabled = true;

  const id = document.getElementById("expense-id").value;
  const body = {
    title:         document.getElementById("exp-title").value.trim(),
    amount:        parseFloat(document.getElementById("exp-amount").value),
    category:      document.getElementById("exp-category").value,
    date:          document.getElementById("exp-date").value,
    paymentMethod: document.getElementById("exp-payment").value,
    notes:         document.getElementById("exp-notes").value.trim(),
  };

  const endpoint = id ? `/expenses/${id}` : "/expenses";
  const method   = id ? "PUT" : "POST";
  const res = await apiFetch(endpoint, { method, body });

  btn.textContent = "Save Expense"; btn.disabled = false;

  if (res?.ok) {
    showToast(id ? "Expense updated!" : "Expense added!", "success");
    closeModal("expense-modal");
    resetForm();
    loadExpenses();
  } else {
    showToast(res?.data?.message || "Failed to save", "error");
  }
});

// ── Edit ──────────────────────────────────────────────────────
async function editExpense(id) {
  const res = await apiFetch(`/expenses/${id}`);
  if (!res?.ok) return showToast("Could not load expense", "error");

  const e = res.data.expense;
  document.getElementById("expense-id").value   = e._id;
  document.getElementById("exp-title").value    = e.title;
  document.getElementById("exp-amount").value   = e.amount;
  document.getElementById("exp-category").value = e.category;
  document.getElementById("exp-date").value     = formatDateInput(e.date);
  document.getElementById("exp-payment").value  = e.paymentMethod || "Cash";
  document.getElementById("exp-notes").value    = e.notes || "";
  document.getElementById("modal-title").textContent = "Edit Expense";
  openModal("expense-modal");
}

// ── Delete ────────────────────────────────────────────────────
function confirmDelete(id) {
  deleteId = id;
  openModal("delete-modal");
}

document.getElementById("confirm-delete-btn").addEventListener("click", async () => {
  if (!deleteId) return;
  const res = await apiFetch(`/expenses/${deleteId}`, { method: "DELETE" });
  closeModal("delete-modal");
  if (res?.ok) {
    showToast("Expense deleted", "success");
    loadExpenses();
  } else {
    showToast("Failed to delete", "error");
  }
  deleteId = null;
});

function resetForm() {
  document.getElementById("expense-form").reset();
  document.getElementById("expense-id").value = "";
  document.getElementById("exp-date").value   = new Date().toISOString().split("T")[0];
  document.getElementById("modal-title").textContent = "Add Expense";
}

// Reset form when modal opens fresh
document.getElementById("expense-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) resetForm();
});

loadExpenses();
