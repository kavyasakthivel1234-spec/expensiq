// ============================================================
// FILE   : backend/server.js
// PURPOSE: Application entry point — boots the entire backend
// ============================================================

// ── STEP A: Load Environment Variables ──────────────────────
// dotenv reads backend/.env and loads every key into process.env
// MUST be the very first line — everything below depends on process.env
const dotenv = require("dotenv");
dotenv.config();

// ── STEP B: Validate Required Environment Variables ──────────
// If a critical variable is missing, the app crashes later with
// a confusing error. We catch it here with a clear message.
const requiredEnvVars = ["MONGODB_URI", "JWT_SECRET"];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    // Tell the developer exactly which variable is missing
    console.error(`❌ Missing environment variable: ${varName}`);
    console.error(`💡 Check your backend/.env file`);
    process.exit(1); // Stop immediately — don't start a broken server
  }
});

// ── STEP C: Import Dependencies ──────────────────────────────
const express   = require("express");  // Web framework for Node.js
const cors      = require("cors");     // Enables Cross-Origin Resource Sharing
const connectDB = require("./config/db"); // Our custom DB connection function

// ── STEP D: Connect to MongoDB Atlas ─────────────────────────
// We call this before creating routes so the DB is ready when
// the first request arrives. connectDB() handles its own errors.
connectDB();

// ── STEP E: Initialize Express Application ───────────────────
// express() returns an Express application object
// All configuration, middleware, and routes are attached to `app`
const app = express();

// ============================================================
// MIDDLEWARE SECTION
// Middleware = functions that run on EVERY request before
// it reaches your route handler
// Order matters — middleware runs top to bottom
// ============================================================

// ── Middleware 1: JSON Body Parser ────────────────────────────
// Parses incoming request bodies that have Content-Type: application/json
// Without this: req.body is undefined for POST/PUT requests
// With this:    req.body = { name: "John", amount: 500 }
app.use(express.json());

// ── Middleware 2: URL-Encoded Body Parser ─────────────────────
// Parses form submissions (Content-Type: application/x-www-form-urlencoded)
// { extended: true } allows nested objects like { user: { name: "John" } }
app.use(express.urlencoded({ extended: true }));

// ── Middleware 3: CORS (Cross-Origin Resource Sharing) ────────
// Allows the frontend to call this API from any origin during development.
// In production, restrict `origin` to your actual Vercel domain.
app.use(
  cors({
    // "null" covers file:// protocol (opening HTML directly in browser)
    // "*"    covers Live Server and all other origins
    origin: (origin, callback) => callback(null, true),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

// ============================================================
// ROUTES SECTION
// Routes will be added phase by phase and mounted here
// ============================================================

// ── Test Route: GET / ─────────────────────────────────────────
// This is our "is the server alive?" route
// req = the incoming request object
// res = the outgoing response object
app.get("/", (req, res) => {
  // res.status(200) sets the HTTP status code to 200 (OK)
  // .json() converts the JS object to JSON and sends it as the response
  // It also automatically sets Content-Type: application/json
  res.status(200).json({
    success: true,
    message: "ExpenseIQ Backend is Running 🚀",
    version: "1.0.0",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── Health Check Route: GET /api/health ───────────────────────
// Used by Render (deployment platform) to check if service is alive
// process.uptime() returns how many seconds the server has been running
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy ✅",
    uptime: `${Math.floor(process.uptime())} seconds`,
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB used`,
  });
});

// ── Authentication Routes ─────────────────────────────────────
app.use("/api/auth",      require("./routes/authRoutes"));

// ── Expense Routes ────────────────────────────────────────────
app.use("/api/expenses",  require("./routes/expenseRoutes"));

// ── Income Routes ─────────────────────────────────────────────
app.use("/api/income",    require("./routes/incomeRoutes"));

// ── Dashboard Routes ──────────────────────────────────────────
app.use("/api/dashboard", require("./routes/dashboardRoutes"));

// ── Budget Routes ─────────────────────────────────────────────
app.use("/api/budget",    require("./routes/budgetRoutes"));

// ── AI Routes ────────────────────────────────────────────────
app.use("/api/ai",        require("./routes/aiRoutes"));

// ============================================================
// ERROR HANDLERS (Must be AFTER all routes)
// ============================================================

// ── 404 Handler ───────────────────────────────────────────────
// If no route above matched the request, this catches it
// Must be placed AFTER all defined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `❌ Route not found: ${req.method} ${req.originalUrl}`,
    hint: "Check the URL and HTTP method",
  });
});

// ── Global Error Handler ──────────────────────────────────────
// Express identifies this as an error handler because it has 4 parameters
// When any route/controller calls next(error), execution jumps here
// err    = the error object (has .message, .stack, .statusCode)
// req    = the request
// res    = the response
// next   = required as 4th param so Express recognizes this as error handler
app.use((err, req, res, next) => {
  // Log full stack trace only in development — too much info for production
  if (process.env.NODE_ENV === "development") {
    console.error("🔥 Unhandled Error:", err.stack);
  }

  // If the error has a statusCode (set by us in controllers), use it
  // Otherwise default to 500 Internal Server Error
  const statusCode = err.statusCode || 500;
  const message    = err.message    || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message,
    // Stack trace only visible in development — hidden in production
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ============================================================
// START SERVER
// ============================================================

// Read PORT from .env — if not set, default to 5000
const PORT = process.env.PORT || 5000;

// app.listen() starts the HTTP server and begins accepting connections
// The callback runs once after the server successfully starts
app.listen(PORT, () => {
  console.log("═══════════════════════════════════════════");
  console.log(`  🚀 ExpenseIQ Backend is Running`);
  console.log(`  📡 URL         : http://localhost:${PORT}`);
  console.log(`  🌍 Environment : ${process.env.NODE_ENV}`);
  console.log(`  📅 Started at  : ${new Date().toLocaleTimeString()}`);
  console.log("═══════════════════════════════════════════");
});
