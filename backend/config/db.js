// ============================================================
// FILE   : backend/config/db.js
// PURPOSE: Connect Node.js application to MongoDB Atlas
// ============================================================

// mongoose is the ODM (Object Data Modeling) library for MongoDB
// It lets us define schemas, models, and query the DB using JS objects
const mongoose = require("mongoose");

// connectDB is an async function because mongoose.connect() returns a Promise
// We use async/await instead of .then()/.catch() for cleaner, readable code
const connectDB = async () => {

  try {
    // ── mongoose.connect() ──────────────────────────────────
    // First argument  : The MongoDB Atlas connection string from .env
    // Second argument : Options object to fine-tune the connection

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // serverSelectionTimeoutMS:
      // How long (in ms) Mongoose waits to find an available MongoDB server
      // Default is 30,000ms (30 sec) — we set 5,000ms to fail faster
      // This gives a quick error instead of hanging for half a minute
      serverSelectionTimeoutMS: 5000,
    });

    // conn.connection.host : the actual Atlas cluster address we connected to
    // Example: "cluster0-shard-00-00.pwrn6rh.mongodb.net"
    // This confirms WHICH cluster is connected — useful if you have multiple
    console.log(`✅ MongoDB Connected Successfully`);
    console.log(`📦 Host: ${conn.connection.host}`);
    console.log(`🗄️  Database: ${conn.connection.name}`);

  } catch (error) {
    // ── Error Handling ──────────────────────────────────────
    // Common causes of failure:
    // 1. Wrong password in MONGODB_URI
    // 2. Your IP is not whitelisted in Atlas Network Access
    // 3. No internet connection
    // 4. MONGODB_URI variable missing in .env
    console.error(`❌ MongoDB Connection Failed!`);
    console.error(`📋 Reason: ${error.message}`);

    // process.exit(1) shuts down the Node.js process immediately
    // "1" means "exited with an error" (0 means success)
    // We exit because without a database, the app cannot function at all
    process.exit(1);
  }
};

// Export the function so server.js can import and call it
module.exports = connectDB;
