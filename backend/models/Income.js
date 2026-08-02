// ============================================================
// FILE   : backend/models/Income.js
// PURPOSE: Defines the Income document structure in MongoDB
// ============================================================
const mongoose = require("mongoose");

const incomeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    title: {
      type: String,
      required: [true, "Income title is required"],
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
        values: ["Salary", "Freelance", "Business", "Investment", "Gift", "Others"],
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
  },
  { timestamps: true }
);

incomeSchema.index({ user: 1, date: -1 });

const Income = mongoose.model("Income", incomeSchema);
module.exports = Income;
