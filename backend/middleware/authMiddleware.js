// ============================================================
// FILE   : backend/middleware/authMiddleware.js
// PURPOSE: Verify JWT token and protect private routes
// USED BY: All protected routes (expenses, income, dashboard...)
// ============================================================

const jwt  = require("jsonwebtoken");
const User = require("../models/User");

// ============================================================
// WHAT IS MIDDLEWARE?
//
// Middleware is a function that sits BETWEEN the request
// and the route handler. It runs before the controller.
//
// Express middleware signature:
//   (req, res, next) => { }
//    │    │    │
//    │    │    └── next() = call this to pass control forward
//    │    │         If you forget next(), the request hangs forever
//    │    └── res  = response object (to send 401 errors)
//    └── req  = request object (we READ the token, WRITE req.user)
//
// HOW IT PLUGS INTO A ROUTE:
//   router.get("/expenses", protect, getExpenses)
//                            │         │
//                            │         └── controller (runs AFTER middleware)
//                            └── middleware runs FIRST
//
// FLOW:
//   Request arrives
//       ↓
//   protect() middleware runs
//       ↓ (token valid)
//   next() is called
//       ↓
//   getExpenses() controller runs
// ============================================================

// @desc   Verify JWT token — protect private routes
// @usage  router.get("/me", protect, getProfile)
const protect = async (req, res, next) => {
  try {

    // ── STEP 1: Read the Authorization header ───────────────
    //
    // When the frontend calls a protected route, it must send:
    //   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    //
    // The header format is always: "Bearer <token>"
    // "Bearer" is a standard prefix for JWT tokens in HTTP
    //
    // req.headers is an object of ALL request headers:
    //   {
    //     "content-type": "application/json",
    //     "authorization": "Bearer eyJhbGci..."
    //   }
    //
    // We access it via req.headers.authorization
    const authHeader = req.headers.authorization;

    // ── STEP 2: Check header exists and has correct format ──
    //
    // !authHeader           → header is missing entirely
    // !authHeader.startsWith("Bearer ") → wrong format
    //
    // Common mistakes from frontend developers:
    //   ❌  "token eyJhbGci..."    (wrong prefix)
    //   ❌  "eyJhbGci..."          (no prefix at all)
    //   ✅  "Bearer eyJhbGci..."   (correct)
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
        hint: "Add header: Authorization: Bearer <your_token>",
      });
    }

    // ── STEP 3: Extract the token string ────────────────────
    //
    // authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    // .split(" ") = ["Bearer", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."]
    // [1]         = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    //
    // We only want the token part — not the "Bearer " prefix
    const token = authHeader.split(" ")[1];

    // Edge case: header was "Bearer " with nothing after it
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Token is empty.",
      });
    }

    // ── STEP 4: Verify the token using jwt.verify() ─────────
    //
    // jwt.verify() does THREE things simultaneously:
    //
    //   1. DECODES the token — reads the payload { id, iat, exp }
    //   2. VALIDATES the signature — checks it was signed with our JWT_SECRET
    //      If someone tampered with the payload → signature breaks → throws error
    //   3. CHECKS expiry — if token is past its exp time → throws error
    //
    // If ALL three pass → returns the decoded payload object
    // If ANY fails → throws a specific error (handled in catch below)
    //
    // decoded = { id: "64abc123...", iat: 1722595200, exp: 1723200000 }
    //              │                  │                 │
    //              │                  │                 └── expiry timestamp
    //              │                  └── issued at timestamp
    //              └── the user's MongoDB _id (we stored this in generateToken)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ── STEP 5: Fetch the user from MongoDB ─────────────────
    //
    // WHY fetch the user again? Can't we just use decoded.id?
    //
    // Reasons we always fetch from DB:
    //   1. User might have been DELETED after the token was issued
    //   2. User's ROLE might have changed (user → admin or banned)
    //   3. We need the full user object (name, email, role) in controllers
    //   4. It ensures we always have CURRENT user data, not stale token data
    //
    // .select("-password") explicitly EXCLUDES the password hash
    // We don't need it here and never want it accidentally in req.user
    //
    // decoded.id is the userId we stored in generateToken.js:
    //   jwt.sign({ id: userId }, secret, options)
    const user = await User.findById(decoded.id).select("-password");

    // ── STEP 6: Handle deleted/invalid user ─────────────────
    //
    // Token is valid but the user no longer exists in DB
    // This can happen if an admin deleted the account
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Access denied. User no longer exists.",
      });
    }

    // ── STEP 7: Attach user to the request object ───────────
    //
    // This is the KEY step that makes middleware useful.
    // We attach the full user object to req.user
    //
    // Every controller that comes AFTER this middleware can now do:
    //   req.user._id     → the logged-in user's MongoDB ID
    //   req.user.email   → their email
    //   req.user.role    → "user" or "admin"
    //   req.user.fullName → their name
    //
    // Example usage in expenseController.js:
    //   const expenses = await Expense.find({ user: req.user._id });
    //   ↑ Only fetches expenses BELONGING to the logged-in user
    req.user = user;

    // ── STEP 8: Call next() ──────────────────────────────────
    //
    // next() tells Express: "middleware is done, move to the next handler"
    // Without this call, the request would hang and never get a response
    // The "next handler" is the actual route controller
    next();

  } catch (error) {
    // ── CATCH BLOCK: Handle JWT-specific errors ──────────────
    //
    // jwt.verify() throws specific named errors we can identify:

    if (error.name === "JsonWebTokenError") {
      // Happens when:
      //   - Token was tampered with (payload modified)
      //   - Token is completely invalid/random string
      //   - Token was signed with a different secret
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
      });
    }

    if (error.name === "TokenExpiredError") {
      // Happens when:
      //   - Current time is past the token's exp timestamp
      //   - Token was issued 7+ days ago (our JWT_EXPIRE setting)
      // User needs to login again to get a fresh token
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }

    if (error.name === "NotBeforeError") {
      // Happens when:
      //   - Token has a "nbf" (not before) claim set in the future
      //   - Token is not yet valid
      return res.status(401).json({
        success: false,
        message: "Token not yet valid.",
      });
    }

    // Any other unexpected error
    console.error("Auth Middleware Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Authentication error. Please try again.",
    });
  }
};

// ============================================================
// OPTIONAL MIDDLEWARE: restrictTo (Role-Based Access Control)
//
// Use this to restrict certain routes to specific roles.
// Example: Only admins can delete any user.
//
// Usage:
//   router.delete("/users/:id", protect, restrictTo("admin"), deleteUser)
//
// restrictTo returns a middleware function (closure pattern)
// The outer function receives roles, inner function is the middleware
// ============================================================
const restrictTo = (...roles) => {
  // roles = ["admin"] or ["admin", "moderator"] etc.
  return (req, res, next) => {
    // protect middleware already ran, so req.user is available
    // Check if the logged-in user's role is in the allowed roles array
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        // 403 Forbidden = authenticated but not authorized
        // Different from 401 Unauthorized = not authenticated at all
        success: false,
        message: `Access denied. Required role: ${roles.join(" or ")}`,
      });
    }
    next();
  };
};

// Export both middlewares
module.exports = { protect, restrictTo };
