// ============================================================
// FILE: backend/config/db.js
// PURPOSE: Establishes and manages the MongoDB Atlas connection
// ============================================================

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // mongoose.connect() returns a connection object
    // We store it in `conn` to read the host name for our log
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options suppress deprecation warnings in newer Mongoose versions
      // and ensure a stable, predictable connection behavior
      serverSelectionTimeoutMS: 5000, // Fail fast if Atlas is unreachable (5 sec)
    });

    // conn.connection.host tells us WHICH Atlas cluster we connected to
    // e.g. "cluster0-shard-00-00.abc12.mongodb.net"
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

  } catch (error) {
    // Log the exact error message so we know what went wrong
    // Common causes: wrong URI, network issue, IP not whitelisted on Atlas
    console.error(`❌ MongoDB Connection Failed: ${error.message}`);

    // process.exit(1) forces Node.js to shut down with a "failure" code
    // We do this because the app is useless without a database
    process.exit(1);
  }
};

// Export so server.js can call it at startup
module.exports = connectDB;
