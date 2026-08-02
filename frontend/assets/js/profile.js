// ============================================================
// FILE   : frontend/assets/js/profile.js
// ============================================================
requireAuth();
initTheme();
initSidebar();

async function loadProfile() {
  const res = await apiFetch("/auth/me");
  if (!res?.ok) return showToast("Could not load profile", "error");

  const u = res.data.user;
  document.getElementById("profile-name").textContent    = u.fullName;
  document.getElementById("profile-email").textContent   = u.email;
  document.getElementById("profile-role").textContent    = u.role;
  document.getElementById("profile-since").textContent   = formatDate(u.createdAt);
  document.getElementById("profile-updated").textContent = formatDate(u.updatedAt);
  document.getElementById("prof-name").value  = u.fullName;
  document.getElementById("prof-email").value = u.email;

  // Keep localStorage in sync
  const current = getUser();
  if (current) saveAuth(getToken(), { ...current, fullName: u.fullName, email: u.email });
  initSidebar();
}

// Update profile
document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("update-btn");
  btn.textContent = "Saving..."; btn.disabled = true;

  const res = await apiFetch("/auth/profile", {
    method: "PUT",
    body: { fullName: document.getElementById("prof-name").value.trim() },
  });

  btn.textContent = "💾 Update Profile"; btn.disabled = false;

  if (res?.ok) {
    showToast("Profile updated!", "success");
    const u = res.data.user;
    saveAuth(getToken(), { ...getUser(), fullName: u.fullName });
    loadProfile();
  } else {
    showToast(res?.data?.message || "Failed to update", "error");
  }
});

// Change password
document.getElementById("password-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn  = document.getElementById("pass-btn");
  const curr = document.getElementById("curr-pass").value;
  const next = document.getElementById("new-pass").value;
  const conf = document.getElementById("conf-pass").value;

  if (next !== conf) return showToast("Passwords do not match", "error");
  if (next.length < 6) return showToast("Password must be at least 6 characters", "warning");

  btn.textContent = "Changing..."; btn.disabled = true;

  const res = await apiFetch("/auth/profile", {
    method: "PUT",
    body: { currentPassword: curr, newPassword: next },
  });

  btn.textContent = "🔒 Change Password"; btn.disabled = false;

  if (res?.ok) {
    showToast("Password changed successfully!", "success");
    document.getElementById("password-form").reset();
  } else {
    showToast(res?.data?.message || "Failed to change password", "error");
  }
});

loadProfile();
