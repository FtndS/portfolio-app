export function computeProExpiry({ currentExpiresAt, extendMonths, planExpiresAt }) {
  if (planExpiresAt) {
    const d = new Date(planExpiresAt)
    if (Number.isNaN(d.getTime())) return null
    return d
  }

  const months = Number(extendMonths) > 0 ? Number(extendMonths) : 1
  const now = new Date()
  const current = currentExpiresAt ? new Date(currentExpiresAt) : null
  const base = current && !Number.isNaN(current.getTime()) && current > now ? current : now
  const next = new Date(base)
  next.setMonth(next.getMonth() + months)
  return next
}

export function normalizePlanId(plan) {
  return plan === 'pro' ? 'pro' : 'free'
}
