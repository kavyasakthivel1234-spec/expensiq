// ============================================================
// FILE   : frontend/assets/js/income.js
// ============================================================
requireAuth();
initTheme();
initSidebar();

let deleteId = null;
let debounceTimer;
document.getElementById("inc-date").value = new Date().toISOString().split("T")[0];

async function loadIncome() {
  const tbody = document.getElementById("income-tbody");
  tbody.innerHTML = `<tr><td colspan="6"><div class="loading-center"><div class="spinner"></div></div></td></tr>`;

  const search   = document.getElementById("search").value.trim();
  const category = document.getElementById("filter-category").value;
  const start    = document.getElementById("filter-start").value;
  const end      = document.getElementById("filter-end").value;

  const params = new URLSearchParams({ sortBy: "date", order: "desc", limit: 50 });
  if (search)   params.set("search",    search);
  if (category) params.set("category",  category);
  if (start)    params.set("startDate", start);
  if (end)      params.set("endDate",   end);

  const res = await apiFetch(`/income?${params}`);
  if (!res?.ok) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i>❌</i><p>Failed to load</p></div></td></tr>`;
    return;
  }

  const { incomes, total } = res.data;
  const grandTotal = incomes.reduce((s, i) => s + i.amount, 0);

  // Update stat cards
  document.getElementById("total-income").textContent = formatCurrency(grandTotal);
  document.getElementById("count-income").textContent = total;

  // This month total
  const now = new Date();
  const monthTotal = incomes
    .filter(i => {
      const d = new Date(i.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, i) => s + i.amount, 0);
  document.getElementById("month-income").textContent = formatCurrency(monthTotal);

  if (!incomes.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i>💵</i><p>No income records. Add your first one!</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = incomes.map(i => `
    <tr>
      <td><strong>${i.title}</strong></td>
      <td>${getCategoryBadge(i.category)}</td>
      <td>${formatDate(i.date)}</td>
      <td><small class="text-muted">${i.notes || "—"}</small></td>
      <td class="text-right text-success"><strong>${formatCurrency(i.amount)}</strong></td>
      <td>
        <button class="btn btn-outline btn-icon btn-sm" onclick="editIncome('${i._id}')">✏️</button>
        <button class="btn btn-danger btn-icon btn-sm"  onclick="confirmDelete('${i._id}')">🗑️</button>
      </td>
    </tr>`).join("");
}

function debounceLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadIncome, 400);
}

function clearFilters() {
  document.getElementById("search").value = "";
  document.getElementById("filter-category").value = "";
  document.getElementById("filter-start").value = "";
  document.getElementById("filter-end").value = "";
  loadIncome();
}

// Save
document.getElementById("income-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("save-btn");
  btn.textContent = "Saving..."; btn.disabled = true;

  const id   = document.getElementById("income-id").value;
  const body = {
    title:    document.getElementById("inc-title").value.trim(),
    amount:   parseFloat(document.getElementById("inc-amount").value),
    category: document.getElementById("inc-category").value,
    date:     document.getElementById("inc-date").value,
    notes:    document.getElementById("inc-notes").value.trim(),
  };

  const res = await apiFetch(id ? `/income/${id}` : "/income", {
    method: id ? "PUT" : "POST",
    body,
  });

  btn.textContent = "Save Income"; btn.disabled = false;

  if (res?.ok) {
    showToast(id ? "Income updated!" : "Income added!", "success");
    closeModal("income-modal");
    resetForm();
    loadIncome();
  } else {
    showToast(res?.data?.message || "Failed to save", "error");
  }
});

async function editIncome(id) {
  const res = await apiFetch(`/income/${id}`);
  if (!res?.ok) return showToast("Could not load", "error");
  const i = res.data.income;
  document.getElementById("income-id").value    = i._id;
  document.getElementById("inc-title").value    = i.title;
  document.getElementById("inc-amount").value   = i.amount;
  document.getElementById("inc-category").value = i.category;
  document.getElementById("inc-date").value     = formatDateInput(i.date);
  document.getElementById("inc-notes").value    = i.notes || "";
  document.getElementById("modal-title").textContent = "Edit Income";
  openModal("income-modal");
}

function confirmDelete(id) {
  deleteId = id;
  openModal("delete-modal");
}

document.getElementById("confirm-delete-btn").addEventListener("click", async () => {
  if (!deleteId) return;
  const res = await apiFetch(`/income/${deleteId}`, { method: "DELETE" });
  closeModal("delete-modal");
  if (res?.ok) { showToast("Income deleted", "success"); loadIncome(); }
  else showToast("Failed to delete", "error");
  deleteId = null;
});

function resetForm() {
  document.getElementById("income-form").reset();
  document.getElementById("income-id").value = "";
  document.getElementById("inc-date").value  = new Date().toISOString().split("T")[0];
  document.getElementById("modal-title").textContent = "Add Income";
}

loadIncome();
