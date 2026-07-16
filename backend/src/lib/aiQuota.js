import pool from '../db/index.js'
import {
  getPlanConfig,
  getWeeklyLimit,
  isAiPrivilegedUser,
  nextAvailableFromOldest,
} from './aiPlan.js'

export const AI_FEATURES = {
  ANALYZE: 'analyze',
  NEWS_SUMMARY: 'news-summary',
  COPILOT: 'copilot',
  TICKER_JOURNAL: 'ticker-journal',
  TRIP_PLAN: 'trip-plan',
}

const WINDOW_SQL = `used_at > NOW() - INTERVAL '7 days'`

const FEATURE_LOCK_IDS = {
  [AI_FEATURES.ANALYZE]: 1,
  [AI_FEATURES.NEWS_SUMMARY]: 2,
  [AI_FEATURES.COPILOT]: 3,
  [AI_FEATURES.TICKER_JOURNAL]: 4,
  [AI_FEATURES.TRIP_PLAN]: 5,
}

export { getAiOwnerEmail } from './aiPlan.js'

export function isAiOwner(email) {
  return isAiPrivilegedUser('user', email)
}

async function getRecentUsagesWithClient(client, userId, feature) {
  const result = await client.query(
    `SELECT used_at FROM ai_usage
     WHERE user_id = $1 AND feature = $2 AND ${WINDOW_SQL}
     ORDER BY used_at ASC`,
    [userId, feature]
  )
  return result.rows.map((r) => r.used_at)
}

function buildQuotaStatus({ allowed, isOwner, usages, limit }) {
  const used = usages.length
  const lastUsedAt = usages.length ? new Date(usages[usages.length - 1]).toISOString() : null

  if (isOwner) {
    return {
      allowed: true,
      isOwner: true,
      nextAvailableAt: null,
      lastUsedAt: null,
      used: 0,
      limit: null,
      remaining: null,
    }
  }

  if (!allowed) {
    return {
      allowed: false,
      isOwner: false,
      lastUsedAt,
      nextAvailableAt: nextAvailableFromOldest(usages[0]),
      used,
      limit,
      remaining: 0,
    }
  }

  return {
    allowed: true,
    isOwner: false,
    nextAvailableAt: null,
    lastUsedAt,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  }
}

export async function getFeatureQuota(userId, email, feature, role, plan, planExpiresAt) {
  if (isAiPrivilegedUser(role, email)) {
    return buildQuotaStatus({ allowed: true, isOwner: true, usages: [], limit: null })
  }

  const limit = getWeeklyLimit(plan, planExpiresAt, feature)
  const usages = await getRecentUsagesWithClient(pool, userId, feature)
  const allowed = usages.length < limit
  return buildQuotaStatus({ allowed, isOwner: false, usages, limit })
}

/** Atomically check quota and record usage (prevents parallel bypass). */
export async function reserveAiQuota(userId, email, feature, role, plan, planExpiresAt) {
  if (isAiPrivilegedUser(role, email)) {
    return buildQuotaStatus({ allowed: true, isOwner: true, usages: [], limit: null })
  }

  const limit = getWeeklyLimit(plan, planExpiresAt, feature)
  const lockId = FEATURE_LOCK_IDS[feature] ?? 99
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [userId, lockId])

    const usages = await getRecentUsagesWithClient(client, userId, feature)
    if (usages.length >= limit) {
      await client.query('ROLLBACK')
      return buildQuotaStatus({ allowed: false, isOwner: false, usages, limit })
    }

    await client.query(
      'INSERT INTO ai_usage (user_id, feature) VALUES ($1, $2)',
      [userId, feature]
    )
    await client.query('COMMIT')

    const nextUsages = [...usages, new Date()]
    return buildQuotaStatus({ allowed: true, isOwner: false, usages: nextUsages, limit })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export async function getAiQuota(userId, email, role, plan, planExpiresAt) {
  const owner = isAiPrivilegedUser(role, email)
  const planConfig = getPlanConfig(plan, planExpiresAt)
  const [analyze, newsSummary, copilot, tickerJournal, tripPlan] = await Promise.all([
    getFeatureQuota(userId, email, AI_FEATURES.ANALYZE, role, plan, planExpiresAt),
    getFeatureQuota(userId, email, AI_FEATURES.NEWS_SUMMARY, role, plan, planExpiresAt),
    getFeatureQuota(userId, email, AI_FEATURES.COPILOT, role, plan, planExpiresAt),
    getFeatureQuota(userId, email, AI_FEATURES.TICKER_JOURNAL, role, plan, planExpiresAt),
    getFeatureQuota(userId, email, AI_FEATURES.TRIP_PLAN, role, plan, planExpiresAt),
  ])

  return {
    isOwner: owner,
    plan: planConfig.id,
    planLabel: planConfig.label,
    limits: {
      analyze: owner ? null : planConfig.weeklyLimit.analyze,
      newsSummary: owner ? null : planConfig.weeklyLimit['news-summary'],
      copilot: owner ? null : planConfig.weeklyLimit.copilot,
      tickerJournal: owner ? null : planConfig.weeklyLimit['ticker-journal'],
      tripPlan: owner ? null : planConfig.weeklyLimit['trip-plan'],
    },
    analyze,
    newsSummary,
    copilot,
    tickerJournal,
    tripPlan,
  }
}

export function quotaExceededMessage(feature, nextAvailableAt, { limit } = {}) {
  const labels = {
    [AI_FEATURES.ANALYZE]: 'วิเคราะห์พอร์ต',
    [AI_FEATURES.NEWS_SUMMARY]: 'สรุปข่าว',
    [AI_FEATURES.COPILOT]: 'Copilot',
    [AI_FEATURES.TICKER_JOURNAL]: 'สรุป journal หุ้น',
    [AI_FEATURES.TRIP_PLAN]: 'AI จัดทริป',
  }
  const label = labels[feature] || 'ใช้ AI'
  const quotaText = limit ? `ครบ ${limit} ครั้ง/สัปดาห์` : 'ครบโควต้าสัปดาห์นี้'
  if (!nextAvailableAt) {
    return `ใช้ ${label} ${quotaText}แล้ว — ลองใหม่สัปดาห์หน้า`
  }
  const when = new Date(nextAvailableAt).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return `ใช้ ${label} ${quotaText}แล้ว — ใช้ได้อีกครั้งหลัง ${when}`
}

/** @deprecated Usage is recorded atomically by reserveAiQuota in middleware. */
export async function recordAiUsage(userId, feature) {
  await pool.query(
    'INSERT INTO ai_usage (user_id, feature) VALUES ($1, $2)',
    [userId, feature]
  )
}
