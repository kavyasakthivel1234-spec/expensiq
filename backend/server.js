// ============================================================
// FILE: backend/server.js
// PURPOSE: Entry point — boots Express, connects DB, mounts routes
// ============================================================

// ── 1. Load environment variables ───────────────────────────
// dotenv reads the .env file and attaches every key to process.env
// MUST be called before anything else that reads process.env
const dotenv = require("dotenv");
dotenv.config();

// ── 2. Validate that critical env variables are present ─────
// If MONGO_URI is missing the app would silently fail later
// We catch it immediately and give a helpful message
const requiredEnvVars = ["MONGO_URI", "JWT_SECRET"];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

// ── 3. Core imports ──────────────────────────────────────────
const express = require("express");
const cors    = require("cors");
const connectDB = require("./config/db");

// ── 4. Connect to MongoDB Atlas ──────────────────────────────
// This is async internally — Express starts regardless, but
// any DB query before connection resolves will queue up safely
connectDB();

// ── 5. Initialize Express app ────────────────────────────────
const app = express();

// ── 6. Global Middleware ─────────────────────────────────────

// express.json() parses incoming requests with JSON payloads
// Without this, req.body would be undefined for POST/PUT requests
app.use(express.json());

// express.urlencoded() parses form data (x-www-form-urlencoded)
// { extended: true } allows nested objects in form data
app.use(express.urlencoded({ extended: true }));

// cors() allows the frontend (running on a different origin/port)
// to make HTTP requests to this API without being blocked by browsers
app.use(
  cors({
    // In production, replace "*" with your actual frontend URL
    // e.g. "https://expenseiq.vercel.app"
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── 7. API Routes ─────────────────────────────────────────────
// Will be imported phase by phase — placeholders shown here

// Health check — tells us the server + env are wired correctly
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ExpenseIQ API is running 🚀",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// API status route — useful for deployment health checks
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy ✅",
    uptime: `${Math.floor(process.uptime())} seconds`,
  });
});

// ── 8. 404 Handler ────────────────────────────────────────────
// Any request that doesn't match a defined route lands here
// "next" is not needed because this is the terminal handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ── 9. Global Error Handler ───────────────────────────────────
// Express recognizes a function with 4 parameters as an error handler
// Any controller that calls next(error) will reach this middleware
app.use((err, req, res, next) => {
  // Log the full stack trace in development for debugging
  if (process.env.NODE_ENV === "development") {
    console.error("🔥 Error:", err.stack);
  }

  // Use the error's own status code if set, otherwise default to 500
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    // Only expose stack trace in development — never in production
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ── 10. Start Server ──────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("─────────────────────────────────────────");
  console.log(`🚀 Server     : http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  console.log(`📅 Started at : ${new Date().toLocaleTimeString()}`);
  console.log("─────────────────────────────────────────");
});
