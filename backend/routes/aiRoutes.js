// ============================================================
// FILE   : backend/routes/aiRoutes.js
// ============================================================
const express = require("express");
const router  = express.Router();
const { protect }                  = require("../middleware/authMiddleware");
const { getAIInsights, getAdvisor } = require("../controllers/aiController");

// All AI routes require login
router.use(protect);

// POST /api/ai/insights → spending analysis (existing)
router.post("/insights", getAIInsights);

// POST /api/ai/advisor  → scheme recommendations (NEW)
router.post("/advisor", getAdvisor);

module.exports = router;
