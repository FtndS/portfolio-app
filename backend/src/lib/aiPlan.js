export const AI_PLANS = {
  free: {
    id: 'free',
    label: 'Free',
    weeklyLimit: {
      analyze: 1,
      'news-summary': 1,
    },
    analyze: {
      maxTransactions: 30,
      maxJournal: 12,
      maxTokens: 4096,
      maxRecommendations: 5,
      maxStringLen: 180,
    },
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    weeklyLimit: {
      analyze: 8,
      'news-summary': 4,
    },
    analyze: {
      maxTransactions: 120,
      maxJournal: 40,
      maxTokens: 6144,
      maxRecommendations: 8,
      maxStringLen: 280,
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

export function getPlanConfig(plan, planExpiresAt) {
  const effective = resolveEffectivePlan(plan, planExpiresAt)
  return AI_PLANS[effective] || AI_PLANS.free
}

export function getWeeklyLimit(plan, planExpiresAt, feature) {
  return getPlanConfig(plan, planExpiresAt).weeklyLimit[feature] ?? 1
}

export function nextAvailableFromOldest(oldestUsedAt) {
  return new Date(new Date(oldestUsedAt).getTime() + WEEK_MS).toISOString()
}
