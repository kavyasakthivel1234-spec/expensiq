// ============================================================
// FILE   : backend/utils/generateToken.js
// PURPOSE: Generate a signed JWT token for a given user ID
// USED BY: authController.js (Register + Login)
// ============================================================

// jsonwebtoken is the library that creates and verifies JWT tokens
const jwt = require("jsonwebtoken");

// ============================================================
// WHAT IS A JWT (JSON Web Token)?
//
// A JWT is a compact, self-contained string that proves identity.
// It has 3 parts separated by dots:
//
//   HEADER.PAYLOAD.SIGNATURE
//
//   eyJhbGciOiJIUzI1NiJ9   ← Header  (algorithm used)
//   .eyJpZCI6IjY2YWJjZCJ9  ← Payload (data we stored: user id)
//   .SflKxwRJSMeKKF2QT4fw  ← Signature (proves it wasn't tampered with)
//
// The server signs the token with JWT_SECRET.
// On every future request, the server verifies the signature.
// If the signature matches → token is valid → user is authenticated.
// If anyone tampers with the payload → signature breaks → rejected.
//
// IMPORTANT: JWT is NOT encrypted — the payload is base64 encoded.
// Anyone can decode and read it. So NEVER store sensitive data
// (passwords, credit cards) in the JWT payload.
// Only store: user ID, role — non-sensitive identity data.
// ============================================================

// generateToken receives the MongoDB user _id
// Returns a signed JWT string
const generateToken = (userId) => {
  // jwt.sign() takes 3 arguments:
  //
  // 1. PAYLOAD — data embedded inside the token
  //    { id: userId } means we store the user's MongoDB _id
  //    This is what we read later in authMiddleware to find the user
  //
  // 2. SECRET — process.env.JWT_SECRET from .env
  //    This secret is used to sign the token mathematically
  //    Anyone with this secret can verify OR create tokens
  //    → Keep it private, never commit to GitHub
  //
  // 3. OPTIONS — { expiresIn } tells when the token expires
  //    "7d"  = 7 days
  //    "1h"  = 1 hour
  //    "30m" = 30 minutes
  //    After expiry, the token is rejected even if signature is valid
  const token = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );

  return token;
};

module.exports = generateToken;
