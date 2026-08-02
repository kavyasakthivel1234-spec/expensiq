// ============================================================
// FILE   : backend/models/Budget.js
// PURPOSE: Monthly budget limits per category per user
// ============================================================
const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["Food", "Travel", "Shopping", "Bills", "Health", "Entertainment", "Education", "Others", "Total"],
    },
    limitAmount: {
      type: Number,
      required: [true, "Budget limit is required"],
      min: [1, "Budget must be at least 1"],
    },
    month: {
      type: Number, // 1–12
      required: [true, "Month is required"],
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: [true, "Year is required"],
    },
  },
  { timestamps: true }
);

// One budget per category per month per year per user
budgetSchema.index({ user: 1, category: 1, month: 1, year: 1 }, { unique: true });

const Budget = mongoose.model("Budget", budgetSchema);
module.exports = Budget;
