// ============================================================
// FILE   : backend/routes/authRoutes.js
// PURPOSE: Define URL paths for authentication endpoints
// ============================================================

const express = require("express");
const router  = express.Router();

// Controller functions
const { register, login, getMe, updateProfile } = require("../controllers/authController");

// ── Import protect middleware ─────────────────────────────────
// protect = the JWT verification middleware from Step 4
// We import it here and apply it to routes that require login
const { protect } = require("../middleware/authMiddleware");

// ============================================================
// PUBLIC ROUTES — No token required
// Anyone can call these endpoints
// ============================================================

// POST /api/auth/register → create new account
router.post("/register", register);

// POST /api/auth/login → login and receive JWT token
router.post("/login", login);

// ============================================================
// PROTECTED ROUTES — JWT token required
//
// Pattern:  router.METHOD("path", protect, controllerFunction)
//                                  │
//                                  └── protect runs BEFORE the controller
//                                      If token invalid → 401, controller never runs
//                                      If token valid   → next() → controller runs
// ============================================================

// GET /api/auth/me → fetch logged-in user's profile
// protect runs first → verifies token → attaches req.user → getMe runs
router.get("/me",      protect, getMe);
router.put("/profile", protect, updateProfile);

module.exports = router;
