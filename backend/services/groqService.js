// ============================================================
// FILE   : backend/services/groqService.js
// PURPOSE: Centralized Groq API communication layer
//          All AI prompts flow through here — controllers
//          stay clean and this service handles retries,
//          model selection, and error normalization.
// ============================================================
const Groq = require("groq-sdk");

// Current supported models on Groq (Aug 2026)
// Listed in priority order — first available is used
const MODELS = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "gemma2-9b-it",
];

// ── Get a working Groq client ─────────────────────────────────
function getClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === "your_groq_api_key_here") {
    return null; // triggers mock fallback in controllers
  }
  return new Groq({ apiKey: key });
}

// ── Core chat completion with model fallback ──────────────────
// Tries each model in MODELS array until one succeeds.
// Returns the response text string.
async function chat(systemPrompt, userPrompt, options = {}) {
  const groq = getClient();
  if (!groq) return null; // no API key → use mock

  const { temperature = 0.4, maxTokens = 1200 } = options;

  let lastError;
  for (const model of MODELS) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
        temperature,
        max_tokens: maxTokens,
        // Ask Groq to return JSON when the prompt requests it
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      });
      return completion.choices[0]?.message?.content || "";
    } catch (err) {
      // Model decommissioned or unavailable → try next model
      if (
        err.status === 400 ||
        err.message?.includes("decommissioned") ||
        err.message?.includes("not found") ||
        err.message?.includes("model")
      ) {
        lastError = err;
        continue; // try next model
      }
      // Non-model error (auth, rate limit, network) → throw immediately
      throw err;
    }
  }
  // All models failed
  throw lastError || new Error("No available AI model");
}

module.exports = { getClient, chat, hasApiKey: () => !!getClient() };
