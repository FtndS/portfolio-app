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

/** Grant or extend Pro from admin / PromptPay ticket. */
export async function grantProManually(pool, userId, {
  extendMonths = 1,
  planExpiresAt = null,
  planNote = null,
}) {
  const existing = await pool.query(
    'SELECT id, email, name, plan, plan_expires_at FROM users WHERE id = $1',
    [userId]
  )
  if (!existing.rows.length) return null

  const expiresAt = computeProExpiry({
    currentExpiresAt: existing.rows[0].plan_expires_at,
    extendMonths,
    planExpiresAt,
  })
  if (!expiresAt) return null

  const note = planNote != null
    ? String(planNote).trim().slice(0, 2000)
    : `Admin · ${new Date().toISOString().slice(0, 10)}`

  const result = await pool.query(
    `UPDATE users
     SET plan = 'pro',
         plan_expires_at = $2,
         plan_note = COALESCE($3, plan_note),
         plan_updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, name, plan, plan_expires_at`,
    [userId, expiresAt.toISOString(), note]
  )
  return result.rows[0] || null
}
