import pool from '../db/index.js'

export const AI_FEATURES = {
  ANALYZE: 'analyze',
  NEWS_SUMMARY: 'news-summary',
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function getAiOwnerEmail() {
  return (process.env.AI_OWNER_EMAIL || 'tanadon.sangkhatorn@gmail.com').trim().toLowerCase()
}

export function isAiOwner(email) {
  if (!email) return false
  return String(email).trim().toLowerCase() === getAiOwnerEmail()
}

function nextAvailableAt(usedAt) {
  return new Date(new Date(usedAt).getTime() + WEEK_MS).toISOString()
}

async function getLastUsage(userId, feature) {
  const result = await pool.query(
    `SELECT used_at FROM ai_usage
     WHERE user_id = $1 AND feature = $2
       AND used_at > NOW() - INTERVAL '7 days'
     ORDER BY used_at DESC
     LIMIT 1`,
    [userId, feature]
  )
  return result.rows[0]?.used_at || null
}

export async function getFeatureQuota(userId, email, feature, role) {
  if (role === 'admin' || isAiOwner(email)) {
    return { allowed: true, isOwner: true, nextAvailableAt: null, lastUsedAt: null }
  }

  const lastUsedAt = await getLastUsage(userId, feature)
  if (!lastUsedAt) {
    return { allowed: true, isOwner: false, nextAvailableAt: null, lastUsedAt: null }
  }

  return {
    allowed: false,
    isOwner: false,
    lastUsedAt: new Date(lastUsedAt).toISOString(),
    nextAvailableAt: nextAvailableAt(lastUsedAt),
  }
}

export async function getAiQuota(userId, email, role) {
  const owner = role === 'admin' || isAiOwner(email)
  const [analyze, newsSummary] = await Promise.all([
    getFeatureQuota(userId, email, AI_FEATURES.ANALYZE, role),
    getFeatureQuota(userId, email, AI_FEATURES.NEWS_SUMMARY, role),
  ])

  return {
    isOwner: owner,
    weeklyLimit: owner ? null : 1,
    analyze,
    newsSummary,
  }
}

export function quotaExceededMessage(feature, nextAvailableAt) {
  const labels = {
    [AI_FEATURES.ANALYZE]: 'วิเคราะห์พอร์ต',
    [AI_FEATURES.NEWS_SUMMARY]: 'สรุปข่าว',
  }
  const label = labels[feature] || 'ใช้ AI'
  if (!nextAvailableAt) {
    return `ใช้ ${label} ครบโควต้าสัปดาห์นี้แล้ว — ลองใหม่สัปดาห์หน้า`
  }
  const when = new Date(nextAvailableAt).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return `ใช้ ${label} ครบโควต้าสัปดาห์นี้แล้ว — ใช้ได้อีกครั้งหลัง ${when}`
}

export async function recordAiUsage(userId, feature) {
  await pool.query(
    'INSERT INTO ai_usage (user_id, feature) VALUES ($1, $2)',
    [userId, feature]
  )
}
