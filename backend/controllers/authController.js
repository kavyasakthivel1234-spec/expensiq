// ============================================================
// FILE   : backend/controllers/authController.js
// PURPOSE: Handle all authentication logic
//          - register()  → POST /api/auth/register
//          - login()     → POST /api/auth/login  (Step 3)
// ============================================================

// ── WHY IMPORT User MODEL? ───────────────────────────────────
// User is our Mongoose model — it gives us methods to interact
// with the "users" collection in MongoDB:
//   User.findOne()  → search for a user
//   User.create()   → insert a new user document
//   User.findById() → find by MongoDB _id
const User = require("../models/User");

// ── WHY IMPORT generateToken? ────────────────────────────────
// After a user registers or logs in, we generate a JWT token
// and send it back so the frontend can store it and use it
// for all future authenticated requests
const generateToken = require("../utils/generateToken");

// ============================================================
// CONTROLLER FUNCTION: register
//
// A controller is just an async function that:
//   1. Reads data from req (the incoming request)
//   2. Does business logic (validate, save to DB, etc.)
//   3. Sends a response using res
//
// WHY async? Because all database operations (findOne, create)
// are asynchronous — they talk to MongoDB over the network.
// async/await makes this code read like synchronous code
// but works asynchronously under the hood.
// ============================================================

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public (no token required)
const register = async (req, res) => {
  // ── STEP 1: Wrap everything in try-catch ─────────────────
  // try  → run our code
  // catch → if anything throws an error, handle it gracefully
  // Without try-catch, an unhandled error would crash the server
  try {

    // ── STEP 2: Extract data from request body ─────────────
    // When a user sends a POST request, the data comes in req.body
    // express.json() middleware (in server.js) parses the JSON
    // and makes it available as req.body
    //
    // EXAMPLE: Postman sends this JSON body:
    // {
    //   "fullName": "John Doe",
    //   "email": "john@gmail.com",
    //   "password": "123456"
    // }
    // → req.body.fullName = "John Doe"
    // → req.body.email    = "john@gmail.com"
    // → req.body.password = "123456"
    const { fullName, email, password } = req.body;

    // ── STEP 3: Validate required fields ───────────────────
    // We check if any of the three required fields are missing
    // !fullName is true when fullName is: undefined, null, "", 0, false
    //
    // WHY validate here AND in the model?
    //   Model validation = database-level rules (last line of defense)
    //   Controller validation = API-level rules (first line of defense)
    //   The controller gives us FRIENDLY error messages BEFORE hitting DB
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
        // Tell frontend exactly which fields are needed
        required: ["fullName", "email", "password"],
      });
      // WHY return? Without return, JavaScript continues running the
      // rest of the function even after sending the response.
      // That would cause "Cannot set headers after they are sent" error.
    }

    // ── STEP 4: Validate password length ───────────────────
    // Give a specific message instead of the generic Mongoose error
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // ── STEP 5: Check if email already exists ──────────────
    // WHY: MongoDB has unique:true on email, but if we let it hit
    // the DB and fail, the error message is cryptic (duplicate key error).
    // By checking first, we can return a clear, friendly message.
    //
    // User.findOne({ email }) translates to this MongoDB query:
    //   db.users.findOne({ email: "john@gmail.com" })
    //
    // WHY findOne and not find?
    //   find() returns an ARRAY of all matching documents
    //   findOne() returns the FIRST matching document or null
    //   We only need to know if ONE user exists with this email
    //
    // .lean() makes Mongoose return a plain JS object instead of
    // a full Mongoose document — faster for existence checks
    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    // If existingUser is NOT null, a user with this email exists
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email is already registered. Please login instead.",
      });
    }

    // ── STEP 6: Create the new user ────────────────────────
    // User.create() does two things in one step:
    //   1. Creates a new User instance with the provided data
    //   2. Calls .save() which:
    //      a. Runs Mongoose validations (required, minlength, etc.)
    //      b. Triggers the pre("save") hook in User.js
    //      c. pre-save hook runs bcrypt.hash() on the password
    //      d. Saves the document to MongoDB Atlas
    //
    // WHY NOT do: new User({ fullName, email, password }) + user.save()?
    // User.create() is shorthand for exactly that.
    // Both are correct — User.create() is just cleaner.
    //
    // Password flow during User.create():
    //   "123456"  ← plain text from req.body
    //      ↓
    //   pre("save") hook in User.js triggers
    //      ↓
    //   bcrypt.genSalt(10) → random salt
    //      ↓
    //   bcrypt.hash("123456", salt) → "$2a$10$xK9..."
    //      ↓
    //   this.password = "$2a$10$xK9..."  ← hashed version saved
    //      ↓
    //   MongoDB stores the hashed password, NEVER the plain text
    const user = await User.create({
      fullName,
      email,
      password, // plain text goes in, hashed version gets stored
    });

    // ── STEP 7: Generate JWT token ──────────────────────────
    // We pass user._id (the MongoDB-generated unique ID)
    // The token embeds this ID in its payload
    // Later, authMiddleware decodes the token, reads the ID,
    // and fetches the full user from DB
    //
    // WHY generate token right after registration?
    // Good UX — user doesn't have to log in separately after registering.
    // They register and are immediately "logged in" with a valid token.
    const token = generateToken(user._id);

    // ── STEP 8: Send success response ──────────────────────
    // HTTP 201 = "Created" — specifically means a new resource was created
    // (as opposed to 200 which means "OK" for general success)
    //
    // WHY not send password in response?
    // Even though it's hashed, there's no reason for the frontend
    // to receive a password hash. We only send what's needed.
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token, // Frontend stores this in localStorage
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        profileImage: user.profileImage,
        role: user.role,
        createdAt: user.createdAt,
      },
    });

  } catch (error) {
    // ── CATCH BLOCK: Handle all errors ──────────────────────

    // Mongoose Validation Error
    // Happens when: required field missing, minlength violated, etc.
    // error.name === "ValidationError" identifies it
    if (error.name === "ValidationError") {
      // Extract all validation messages into a clean array
      // Object.values gets all validation error objects
      // .map() pulls out just the .message from each
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
        // Example: ["Full name is required", "Please enter a valid email"]
      });
    }

    // MongoDB Duplicate Key Error
    // Happens when: email already exists (unique:true in schema)
    // MongoDB error code 11000 = duplicate key violation
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email is already registered. Please login instead.",
      });
    }

    // Any other unexpected error
    // Log it for debugging, but don't expose internal details to client
    console.error("Register Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error during registration. Please try again.",
    });
  }
};

// ============================================================
// CONTROLLER FUNCTION: login
//
// Login is different from register in one critical way:
//   Register → CREATE a new user document
//   Login    → FIND an existing user + VERIFY their password
//
// The password verification step needs bcrypt.compare()
// because passwords are stored as irreversible hashes.
// We can never "decrypt" — we can only "compare".
// ============================================================

// @desc    Login existing user
// @route   POST /api/auth/login
// @access  Public (no token required)
const login = async (req, res) => {
  try {

    // ── STEP 1: Extract email and password from request body ─
    // The user sends:
    // {
    //   "email": "john@gmail.com",
    //   "password": "123456"
    // }
    const { email, password } = req.body;

    // ── STEP 2: Validate that both fields are provided ───────
    // !email  → true when email is undefined, null, or empty string ""
    // !password → same
    // We check BOTH together — if either is missing, reject early
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // ── STEP 3: Find user by email — INCLUDING password field ─
    //
    // PROBLEM: In our User schema, password has select: false
    //   This means: User.findOne({ email }) does NOT return password
    //   The password field is hidden from ALL queries by default
    //
    //   Without select("+password"):
    //     user = { _id, fullName, email, role, createdAt }
    //     user.password = undefined ← can't compare!
    //
    // SOLUTION: .select("+password") explicitly ADDS the password
    // field back into this specific query result
    //   With select("+password"):
    //     user = { _id, fullName, email, password: "$2a$10$...", role }
    //     user.password = "$2a$10$N9qo8uLOick..." ← now we can compare!
    //
    // The "+" prefix means "include this field even though it's excluded"
    // The "-" prefix would mean "exclude this field" e.g. .select("-__v")
    //
    // WHY keep select:false on the schema?
    // Security — password hash is never accidentally sent in API responses
    // We only override it HERE where we explicitly need it for login
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+password");

    // ── STEP 4: Check if user exists ─────────────────────────
    //
    // If no user has this email → user = null
    // We return 401 (Unauthorized), not 404 (Not Found)
    //
    // WHY 401 and not 404?
    // Security best practice: Never tell the attacker whether
    // the email exists in your database or not.
    //
    // BAD:  "Email not found" → attacker knows this email isn't registered
    //       "Wrong password"  → attacker knows the email IS registered
    //
    // GOOD: "Invalid email or password" for BOTH cases
    //       → attacker learns nothing useful
    //       This is called "security through obscurity" for login
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // ── STEP 5: Verify the password using bcrypt.compare() ───
    //
    // HOW bcrypt.compare() works internally:
    //
    //   Stored hash: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZ..."
    //                  │   │  │
    //                  │   │  └── The unique SALT used during registration
    //                  │   └───── Cost factor (10 rounds)
    //                  └───────── Algorithm version (2a)
    //
    //   bcrypt.compare("123456", "$2a$10$N9qo8uLOick...")
    //     1. Extracts the salt from the stored hash
    //     2. Hashes "123456" using that EXACT same salt
    //     3. Compares the result with the stored hash
    //     4. Returns true if they match, false if they don't
    //
    // This is why you can't just compare strings:
    //   bcrypt.hash("123456", salt1) = "$2a$10$salt1hash..."
    //   bcrypt.hash("123456", salt2) = "$2a$10$salt2hash..."  ← different!
    // Only bcrypt.compare() knows how to check correctly.
    //
    // user.comparePassword() is the instance method we defined
    // in User.js that wraps bcrypt.compare() for us
    const isPasswordMatch = await user.comparePassword(password);

    // ── STEP 6: Reject wrong password ────────────────────────
    // Same generic message as "user not found" — same reason
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // ── STEP 7: Generate JWT token ────────────────────────────
    //
    // At this point we know:
    //   ✅ User exists in the database
    //   ✅ Password is correct
    // So we can safely generate a token and trust the user
    //
    // generateToken(user._id) creates a JWT with payload { id: user._id }
    // The frontend stores this token in localStorage
    // Every future protected request sends it in the Authorization header:
    //   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    const token = generateToken(user._id);

    // ── STEP 8: Send successful response ─────────────────────
    //
    // HTTP 200 = OK (general success, resource wasn't created — just found)
    // We do NOT include the password in the response — not even the hash
    // user.password exists on the object here (because we used .select("+password"))
    // but we deliberately exclude it from the response
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        profileImage: user.profileImage,
        role: user.role,
        createdAt: user.createdAt,
      },
    });

  } catch (error) {
    // ── CATCH BLOCK ───────────────────────────────────────────
    // Any unexpected error (network issue, DB timeout, etc.)
    console.error("Login Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error during login. Please try again.",
    });
  }
};

// ============================================================
// CONTROLLER FUNCTION: getMe
//
// Returns the currently logged-in user's profile.
// This is a PROTECTED route — only accessible with a valid JWT.
//
// Notice: NO database query needed here!
// The protect middleware already fetched the user from DB
// and attached it to req.user — we just return it.
// ============================================================

// @desc    Get logged-in user profile
// @route   GET /api/auth/me
// @access  Private (requires JWT token)
const getMe = async (req, res) => {
  try {
    // req.user was attached by the protect middleware
    // It contains the full user document from MongoDB (minus password)
    // We trust it completely because protect() already verified the JWT
    res.status(200).json({
      success: true,
      message: "User profile fetched successfully",
      user: {
        id          : req.user._id,
        fullName    : req.user.fullName,
        email       : req.user.email,
        profileImage: req.user.profileImage,
        role        : req.user.role,
        createdAt   : req.user.createdAt,
        updatedAt   : req.user.updatedAt,
      },
    });
  } catch (error) {
    console.error("GetMe Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error fetching profile.",
    });
  }
};

// ============================================================
// CONTROLLER FUNCTION: updateProfile
// @desc    Update logged-in user's profile
// @route   PUT /api/auth/profile
// @access  Private
// ============================================================
const updateProfile = async (req, res) => {
  try {
    // req.user._id is set by the protect middleware
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const { fullName, profileImage, currentPassword, newPassword } = req.body;

    if (fullName)     user.fullName     = fullName.trim();
    if (profileImage) user.profileImage = profileImage;

    // Password change — requires current password verification
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to set a new password",
        });
      }
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Current password is incorrect" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
      }
      user.password = newPassword; // pre-save hook hashes it automatically
    }

    const updated = await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id:           updated._id,
        fullName:     updated.fullName,
        email:        updated.email,
        profileImage: updated.profileImage,
        role:         updated.role,
        updatedAt:    updated.updatedAt,
      },
    });
  } catch (error) {
    console.error("updateProfile:", error.message);
    res.status(500).json({ success: false, message: "Server error updating profile" });
  }
};

// Export all functions
module.exports = { register, login, getMe, updateProfile };
