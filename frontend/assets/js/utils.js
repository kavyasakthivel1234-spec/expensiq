// ============================================================
// FILE   : frontend/assets/js/utils.js
// PURPOSE: Shared helpers used across all pages
// ============================================================

const API_BASE = "http://localhost:5000/api";

// ── Token helpers ─────────────────────────────────────────────
const getToken  = ()      => localStorage.getItem("token");
const getUser   = ()      => JSON.parse(localStorage.getItem("user") || "null");
const saveAuth  = (token, user) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user",  JSON.stringify(user));
};
const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

// Redirect to login if not authenticated
const requireAuth = () => {
  if (!getToken()) {
    window.location.href = "/frontend/index.html";
    return false;
  }
  return true;
};

// Redirect to dashboard if already logged in
const redirectIfAuth = () => {
  if (getToken()) {
    window.location.href = "/frontend/dashboard.html";
  }
};

// ── API fetch wrapper ─────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json();

  if (response.status === 401) {
    clearAuth();
    window.location.href = "/frontend/index.html";
    return null;
  }

  return { ok: response.ok, status: response.status, data };
}

// ── Toast notifications ───────────────────────────────────────
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.4s";
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ── Loading spinner ───────────────────────────────────────────
function showSpinner(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="loading-center"><div class="spinner"></div></div>`;
}

function showEmpty(containerId, message = "No data found") {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `
    <div class="empty-state">
      <i>📭</i>
      <p>${message}</p>
    </div>`;
}

// ── Format helpers ────────────────────────────────────────────
const formatCurrency = (amount) =>
  "₹" + Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

const formatDateInput = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().split("T")[0];
};

const getCategoryBadge = (category) => {
  const key = (category || "others").toLowerCase();
  return `<span class="badge badge-${key}">${category}</span>`;
};

// ── Dark mode ─────────────────────────────────────────────────
const initTheme = () => {
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = saved === "dark" ? "☀️ Light" : "🌙 Dark";
};

const toggleTheme = () => {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next    = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = next === "dark" ? "☀️ Light" : "🌙 Dark";
};

// ── Sidebar active link + user info ──────────────────────────
const initSidebar = () => {
  // Highlight current page
  const links = document.querySelectorAll(".sidebar-nav a");
  links.forEach(link => {
    if (link.href === window.location.href) link.classList.add("active");
  });

  // Show user name
  const user = getUser();
  const nameEl = document.getElementById("sidebar-user-name");
  const emailEl = document.getElementById("sidebar-user-email");
  if (nameEl && user) nameEl.textContent = user.fullName || "User";
  if (emailEl && user) emailEl.textContent = user.email || "";

  // Mobile toggle
  const toggleBtn = document.getElementById("sidebar-toggle");
  const sidebar   = document.getElementById("sidebar");
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
  }
};

// ── Logout ────────────────────────────────────────────────────
const logout = () => {
  clearAuth();
  window.location.href = "/frontend/index.html";
};

// ── Modal helpers ─────────────────────────────────────────────
const openModal  = (id) => document.getElementById(id)?.classList.add("show");
const closeModal = (id) => document.getElementById(id)?.classList.remove("show");

// Close modal when clicking outside the box
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("show");
  }
});
