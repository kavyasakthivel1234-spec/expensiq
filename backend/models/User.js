// ============================================================
// FILE   : backend/models/User.js
// PURPOSE: Defines the shape, rules, and behavior of a User
//          document stored in MongoDB
// ============================================================

const mongoose = require("mongoose");

// ============================================================
// WHAT IS A SCHEMA?
// A Schema is a blueprint that tells Mongoose:
//   - What fields a document has
//   - What TYPE each field is (String, Number, Boolean, Date...)
//   - What RULES apply (required, unique, minlength, match...)
//   - What DEFAULT VALUES to use if a field is not provided
//
// Think of it like designing a form:
//   "To register, you MUST provide: name, email, password"
//   "Email MUST be unique — no two users can share one"
//   "Password MUST be at least 6 characters"
// ============================================================

const userSchema = new mongoose.Schema(
  {
    // ── Field 1: Full Name ──────────────────────────────────
    fullName: {
      type: String,          // Must be a string
      required: [true, "Full name is required"],  // Custom error message
      trim: true,            // Removes leading/trailing spaces
                             // " John Doe " → "John Doe"
      minlength: [2, "Full name must be at least 2 characters"],
      maxlength: [50, "Full name cannot exceed 50 characters"],
    },

    // ── Field 2: Email ──────────────────────────────────────
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,          // MongoDB creates a unique index on this field
                             // Two users CANNOT have the same email
      trim: true,            // Removes extra spaces from email
      lowercase: true,       // Converts "John@GMAIL.COM" → "john@gmail.com"
                             // Ensures consistent comparison
      match: [
        // Regular expression that validates a proper email format
        // Checks for: characters @ characters . characters
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },

    // ── Field 3: Password ───────────────────────────────────
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      // select: false means this field is EXCLUDED from query results by default
      // When you do User.findOne({ email }), password is NOT returned
      // This prevents accidentally leaking passwords in API responses
      // To include it, you must explicitly write: User.findOne().select("+password")
      select: false,
    },

    // ── Field 4: Profile Image ──────────────────────────────
    profileImage: {
      type: String,
      // Not required — users can register without uploading a photo
      // We store just the URL/path of the image
      // e.g. "https://res.cloudinary.com/expenseiq/image/upload/v1/avatar.jpg"
      default: "",           // Empty string if no image uploaded
    },

    // ── Field 5: Role ────────────────────────────────────────
    // Useful for future admin features
    // For now all users are "user" — kept for scalability
    role: {
      type: String,
      enum: ["user", "admin"], // Only these two values are allowed
      default: "user",         // Every new user gets role "user" automatically
    },
  },

  // ── Schema Options ─────────────────────────────────────────
  {
    // timestamps: true automatically adds TWO fields to every document:
    //   createdAt  : Date when the document was first saved
    //   updatedAt  : Date when the document was last modified
    // Mongoose manages these automatically — you never set them manually
    // Super useful for: "Show me expenses from last 30 days" or "Sort by newest"
    timestamps: true,
  }
);

// ============================================================
// PRE-SAVE HOOK (Mongoose Middleware)
//
// A "hook" is a function that runs automatically at a specific point
// "pre" = BEFORE the action happens
// "save" = when .save() is called (i.e., creating or updating a user)
//
// WHY: We hash the password HERE instead of in the controller because:
//   1. The model is responsible for its own data integrity
//   2. If you update a user from 5 different places, the hash always happens
//   3. DRY principle — Don't Repeat Yourself
// ============================================================
userSchema.pre("save", async function (next) {
  // "this" refers to the current user document being saved

  // isModified("password") checks if the password field was changed
  // This prevents re-hashing an already-hashed password
  // Scenario: User updates their profile picture
  //   → .save() is called
  //   → but password wasn't changed
  //   → so we skip hashing (otherwise we'd double-hash it and login would break)
  if (!this.isModified("password")) {
    return next(); // Skip hashing, move to the next middleware
  }

  // bcrypt is imported here instead of at the top
  // because this hook is the ONLY place in this file that needs it
  const bcrypt = require("bcryptjs");

  // bcrypt.genSalt(10) generates a "salt" — a random string
  // Salt rounds = 10 means bcrypt runs 2^10 = 1024 iterations
  // More iterations = more secure BUT slower
  // 10 is the industry standard — good balance of security and performance
  const salt = await bcrypt.genSalt(10);

  // bcrypt.hash() combines the plain password + salt → hashed string
  // e.g. "mypassword123" → "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
  // This hash is ONE-WAY — you cannot reverse it to get the original password
  // That's why login uses bcrypt.compare() instead of decrypting
  this.password = await bcrypt.hash(this.password, salt);

  // Call next() to continue the save operation
  next();
});

// ============================================================
// INSTANCE METHOD: comparePassword
//
// An instance method is a function you can call on a specific user object
// e.g.  const user = await User.findOne({ email });
//        const isMatch = await user.comparePassword("mypassword");
//
// WHY: We define this on the model (not in the controller) for the same
// reason as the pre-save hook — keeps logic centralized and reusable
// ============================================================
userSchema.methods.comparePassword = async function (enteredPassword) {
  // bcrypt.compare() takes:
  //   1. The plain text password the user typed during login
  //   2. The hashed password stored in the database
  // It hashes the entered password the same way and compares
  // Returns true if they match, false if they don't
  const bcrypt = require("bcryptjs");
  return await bcrypt.compare(enteredPassword, this.password);
};

// ============================================================
// CREATE THE MODEL
//
// mongoose.model("User", userSchema) does THREE things:
//   1. Creates a Model class named "User"
//   2. Connects it to a MongoDB collection named "users"
//      (Mongoose automatically lowercases and pluralizes: "User" → "users")
//   3. Attaches all Schema rules and methods to the model
//
// This is what you import in your controller:
//   const User = require("../models/User");
//   const newUser = await User.create({ fullName, email, password });
// ============================================================
const User = mongoose.model("User", userSchema);

module.exports = User;
