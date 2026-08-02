// ============================================================
// FILE   : frontend/assets/js/auth.js
// PURPOSE: Login and Register page logic
// ============================================================

// Redirect if already logged in
redirectIfAuth();
initTheme();

// ── Tab switcher ──────────────────────────────────────────────
function switchTab(tab) {
  const isLogin = tab === "login";
  document.getElementById("login-form").style.display    = isLogin ? "block" : "none";
  document.getElementById("register-form").style.display = isLogin ? "none"  : "block";

  document.getElementById("tab-login").style.background    = isLogin ? "var(--primary)" : "transparent";
  document.getElementById("tab-login").style.color         = isLogin ? "#fff"            : "var(--text)";
  document.getElementById("tab-register").style.background = isLogin ? "transparent"     : "var(--primary)";
  document.getElementById("tab-register").style.color      = isLogin ? "var(--text)"     : "#fff";
}

// ── Login ─────────────────────────────────────────────────────
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn   = document.getElementById("login-btn");
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  btn.textContent = "Logging in...";
  btn.disabled    = true;

  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
  });

  btn.textContent = "Login";
  btn.disabled    = false;

  if (!res) return;

  if (res.ok) {
    saveAuth(res.data.token, res.data.user);
    showToast("Welcome back! Redirecting...", "success");
    setTimeout(() => { window.location.href = "/frontend/dashboard.html"; }, 800);
  } else {
    showToast(res.data.message || "Login failed", "error");
  }
});

// ── Register ──────────────────────────────────────────────────
document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn  = document.getElementById("reg-btn");
  const fullName = document.getElementById("reg-name").value.trim();
  const email    = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;

  if (password.length < 6) {
    showToast("Password must be at least 6 characters", "warning");
    return;
  }

  btn.textContent = "Creating account...";
  btn.disabled    = true;

  const res = await apiFetch("/auth/register", {
    method: "POST",
    body: { fullName, email, password },
  });

  btn.textContent = "Create Account";
  btn.disabled    = false;

  if (!res) return;

  if (res.ok) {
    saveAuth(res.data.token, res.data.user);
    showToast("Account created! Redirecting...", "success");
    setTimeout(() => { window.location.href = "/frontend/dashboard.html"; }, 800);
  } else {
    showToast(res.data.message || "Registration failed", "error");
  }
});
