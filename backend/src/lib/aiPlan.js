/**
 * AI plan limits — tuned for Anthropic API unit economics.
 *
 * Rough cost per call (Claude Sonnet, order of magnitude):
 *   analyze      ~$0.04–0.08  (large context + JSON)
 *   news-summary ~$0.01–0.02
 *   copilot      ~$0.01–0.03  (compact context + short answer)
 *
 * Target max AI spend per subscriber month (heavy usage):
 *   Free  ~$0.10–0.15
 *   Pro @ ฿149 (~$4)  ~$0.60–1.00  (≈ 20–25% of revenue)
 */
export const AI_PLANS = {
  free: {
    id: 'free',
    label: 'Free',
    weeklyLimit: {
      analyze: 1,
      'news-summary': 1,
      copilot: 2,
      'ticker-journal': 2,
      'trip-plan': 1,
    },
    analyze: {
      maxTransactions: 30,
      maxRecentInPrompt: 20,
      maxJournal: 12,
      maxTokens: 4096,
      maxRecommendations: 5,
      maxStringLen: 180,
    },
    copilot: {
      maxHoldings: 8,
      maxTransactions: 12,
      maxJournal: 4,
      maxNews: 6,
      maxTokens: 1200,
      maxQuestionLen: 0,
      allowCustomQuestion: false,
    },
    tripPlan: {
      maxTokens: 4096,
      maxEnrich: 8,
    },
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    weeklyLimit: {
      analyze: 8,
      'news-summary': 4,
      copilot: 6,
      'ticker-journal': 6,
      'trip-plan': 4,
    },
    analyze: {
      maxTransactions: 120,
      maxRecentInPrompt: 45,
      maxJournal: 40,
      maxTokens: 6144,
      maxRecommendations: 8,
      maxStringLen: 280,
    },
    copilot: {
      maxHoldings: 16,
      maxTransactions: 25,
      maxJournal: 8,
      maxNews: 12,
      maxTokens: 1800,
      maxQuestionLen: 240,
      allowCustomQuestion: true,
    },
    tripPlan: {
      maxTokens: 6144,
      maxEnrich: 8,
    },
  },
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function resolveEffectivePlan(plan, planExpiresAt) {
  const id = plan === 'pro' ? 'pro' : 'free'
  if (id === 'pro' && planExpiresAt) {
    const expires = new Date(planExpiresAt)
    if (!Number.isNaN(expires.getTime()) && expires.getTime() < Date.now()) {
      return 'free'
    }
  }
  return id
}

export function getAiOwnerEmail() {
  return (process.env.AI_OWNER_EMAIL || 'tanadon.sangkhatorn@gmail.com').trim().toLowerCase()
}

export function isAiPrivilegedUser(role, email) {
  if (role === 'admin') return true
  if (!email) return false
  return String(email).trim().toLowerCase() === getAiOwnerEmail()
}

export function getPlanConfig(plan, planExpiresAt) {
  const effective = resolveEffectivePlan(plan, planExpiresAt)
  return AI_PLANS[effective] || AI_PLANS.free
}

export function getPlanConfigForUser(role, email, plan, planExpiresAt) {
  if (isAiPrivilegedUser(role, email)) return AI_PLANS.pro
  return getPlanConfig(plan, planExpiresAt)
}

export function getWeeklyLimit(plan, planExpiresAt, feature) {
  return getPlanConfig(plan, planExpiresAt).weeklyLimit[feature] ?? 1
}

export function nextAvailableFromOldest(oldestUsedAt) {
  return new Date(new Date(oldestUsedAt).getTime() + WEEK_MS).toISOString()
}

/** Estimated weekly AI calls at plan ceiling (for ops dashboards). */
export function estimateWeeklyAiCalls(plan, planExpiresAt) {
  const cfg = getPlanConfig(plan, planExpiresAt)
  const w = cfg.weeklyLimit
  return (w.analyze || 0) + (w['news-summary'] || 0) + (w.copilot || 0) + (w['ticker-journal'] || 0) + (w['trip-plan'] || 0)
}
