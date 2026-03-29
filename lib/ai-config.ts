// Central AI model configuration
// Change models here to apply globally across all routes

export const AI_MODELS = {
  // Haiku — cheapest, fastest. Use for: brief gen, note parsing, quick summaries
  fast: 'claude-haiku-4-5-20251001',
  // Sonnet — balanced. Use for: audit analysis, complex reasoning
  balanced: 'claude-sonnet-4-6',
  // Opus — most capable. Use for: Guardian Agent, final reports (use sparingly)
  powerful: 'claude-opus-4-6',
} as const

export type AIModelTier = keyof typeof AI_MODELS

// Per-feature model assignments — change here to tune cost vs quality
export const FEATURE_MODELS: Record<string, AIModelTier> = {
  meetingBrief: 'balanced',   // Sonnet — Polish grammar quality, worth 3¢ per brief
  noteIngestion: 'fast',
  auditAnalysis: 'balanced',
  guardianReport: 'balanced',
  taskGeneration: 'fast',
}

export function getModel(feature: keyof typeof FEATURE_MODELS): string {
  const tier = FEATURE_MODELS[feature]
  return AI_MODELS[tier]
}

// Approximate cost per 1k output tokens (USD) — for reference only
export const APPROX_COST_PER_1K = {
  'claude-haiku-4-5-20251001': 0.00125,
  'claude-sonnet-4-6': 0.015,
  'claude-opus-4-6': 0.075,
} as const
