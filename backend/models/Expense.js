// ============================================================
// FILE   : backend/models/Expense.js
// PURPOSE: Defines the Expense document structure in MongoDB
// ============================================================
const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    // Which user owns this expense — links to the User collection
    user: {
      type: mongoose.Schema.Types.ObjectId, // MongoDB ObjectId reference
      ref: "User",                           // points to the User model
      required: [true, "User is required"],
    },
    title: {
      type: String,
      required: [true, "Expense title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: [
          "Food", "Travel", "Shopping", "Bills",
          "Health", "Entertainment", "Education", "Others"
        ],
        message: "{VALUE} is not a valid category",
      },
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Card", "UPI", "Net Banking", "Other"],
      default: "Cash",
    },
  },
  { timestamps: true }
);

// Index: speeds up queries like "get all expenses for user X"
expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ user: 1, category: 1 });

const Expense = mongoose.model("Expense", expenseSchema);
module.exports = Expense;
