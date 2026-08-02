// ============================================================
// FILE   : frontend/assets/js/utils.js
// PURPOSE: Shared helpers used across every page
// ============================================================

// Dynamically determine the backend API base URL.
// If running locally in a browser on a port other than 5000 (e.g. Live Server on 5500)
// or opened from file:// protocol, fallback to localhost:5000/api.
// In production unified deployment, use the same origin where the frontend is served.
const API_BASE = 
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && window.location.port !== "5000"
    ? "http://localhost:5000/api"
    : window.location.origin === "null"
      ? "http://localhost:5000/api"
      : `${window.location.origin}/api`;

// ── Page navigation ───────────────────────────────────────────
// Using relative names works with Live Server, file://, and any web server
const PAGE = {
  login:     "index.html",
  dashboard: "dashboard.html",
  expenses:  "expenses.html",
  income:    "income.html",
  budget:    "budget.html",
  ai:        "ai-insights.html",
  profile:   "profile.html",
};
const goTo = (page) => { window.location.href = PAGE[page] || page; };

// ── Token / Auth helpers ──────────────────────────────────────
const getToken = ()            => localStorage.getItem("token");
const getUser  = ()            => JSON.parse(localStorage.getItem("user") || "null");
const saveAuth = (token, user) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user",  JSON.stringify(user));
};
const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

// Redirect to login if not logged in
const requireAuth = () => {
  if (!getToken()) { goTo("login"); return false; }
  return true;
};

// Redirect to dashboard if already logged in
const redirectIfAuth = () => {
  if (getToken()) goTo("dashboard");
};

// ── API fetch wrapper ─────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token   = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json();

    // Token expired or invalid → force logout
    if (response.status === 401) {
      clearAuth();
      goTo("login");
      return null;
    }

    return { ok: response.ok, status: response.status, data };

  } catch (err) {
    // Network error — backend unreachable
    showToast(
      "Cannot connect to server. Make sure the backend is running on port 5000.",
      "error"
    );
    console.error("Network error:", err.message);
    return null;
  }
}

// ── Toast notifications ───────────────────────────────────────
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id        = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity    = "0";
    toast.style.transition = "opacity 0.4s";
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ── Spinner / empty helpers ───────────────────────────────────
function showSpinner(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="loading-center"><div class="spinner"></div></div>`;
}
function showEmpty(containerId, message = "No data found") {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="empty-state"><i>📭</i><p>${message}</p></div>`;
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
  const key = (category || "others").toLowerCase().replace(/\s+/g, "");
  return `<span class="badge badge-${key}">${category || "Others"}</span>`;
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

// ── Sidebar setup ─────────────────────────────────────────────
const initSidebar = () => {
  // Highlight the active nav link by matching filename
  const currentFile = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".sidebar-nav a").forEach(link => {
    const linkFile = link.getAttribute("href").split("/").pop();
    link.classList.toggle("active", linkFile === currentFile);
  });

  // Fill user info from localStorage
  const user   = getUser();
  const nameEl  = document.getElementById("sidebar-user-name");
  const emailEl = document.getElementById("sidebar-user-email");
  if (nameEl  && user) nameEl.textContent  = user.fullName || "User";
  if (emailEl && user) emailEl.textContent = user.email    || "";

  // Mobile hamburger toggle — re-attach safely
  const btn     = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");
  if (btn && sidebar) {
    const fresh = btn.cloneNode(true);
    btn.replaceWith(fresh);
    fresh.addEventListener("click", () => sidebar.classList.toggle("open"));
  }
};

// ── Logout ────────────────────────────────────────────────────
const logout = () => {
  clearAuth();
  goTo("login");
};

// ── Modal helpers ─────────────────────────────────────────────
const openModal  = (id) => document.getElementById(id)?.classList.add("show");
const closeModal = (id) => document.getElementById(id)?.classList.remove("show");

// Click on dark backdrop → close modal
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("show");
  }
});
