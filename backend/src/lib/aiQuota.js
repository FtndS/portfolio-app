import pool from '../db/index.js'
import {
  getPlanConfig,
  getWeeklyLimit,
  nextAvailableFromOldest,
} from './aiPlan.js'

export const AI_FEATURES = {
  ANALYZE: 'analyze',
  NEWS_SUMMARY: 'news-summary',
  COPILOT: 'copilot',
}

const WINDOW_SQL = `used_at > NOW() - INTERVAL '7 days'`

export function getAiOwnerEmail() {
  return (process.env.AI_OWNER_EMAIL || 'tanadon.sangkhatorn@gmail.com').trim().toLowerCase()
}

export function isAiOwner(email) {
  if (!email) return false
  return String(email).trim().toLowerCase() === getAiOwnerEmail()
}

async function getRecentUsages(userId, feature) {
  const result = await pool.query(
    `SELECT used_at FROM ai_usage
     WHERE user_id = $1 AND feature = $2 AND ${WINDOW_SQL}
     ORDER BY used_at ASC`,
    [userId, feature]
  )
  return result.rows.map((r) => r.used_at)
}

export async function getFeatureQuota(userId, email, feature, role, plan, planExpiresAt) {
  if (role === 'admin' || isAiOwner(email)) {
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

  const limit = getWeeklyLimit(plan, planExpiresAt, feature)
  const usages = await getRecentUsages(userId, feature)
  const used = usages.length
  const remaining = Math.max(0, limit - used)
  const lastUsedAt = usages.length ? new Date(usages[usages.length - 1]).toISOString() : null

  if (used < limit) {
    return {
      allowed: true,
      isOwner: false,
      nextAvailableAt: null,
      lastUsedAt,
      used,
      limit,
      remaining,
    }
  }

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

export async function getAiQuota(userId, email, role, plan, planExpiresAt) {
  const owner = role === 'admin' || isAiOwner(email)
  const planConfig = getPlanConfig(plan, planExpiresAt)
  const [analyze, newsSummary, copilot] = await Promise.all([
    getFeatureQuota(userId, email, AI_FEATURES.ANALYZE, role, plan, planExpiresAt),
    getFeatureQuota(userId, email, AI_FEATURES.NEWS_SUMMARY, role, plan, planExpiresAt),
    getFeatureQuota(userId, email, AI_FEATURES.COPILOT, role, plan, planExpiresAt),
  ])

  return {
    isOwner: owner,
    plan: planConfig.id,
    planLabel: planConfig.label,
    limits: {
      analyze: owner ? null : planConfig.weeklyLimit.analyze,
      newsSummary: owner ? null : planConfig.weeklyLimit['news-summary'],
      copilot: owner ? null : planConfig.weeklyLimit.copilot,
    },
    analyze,
    newsSummary,
    copilot,
  }
}

export function quotaExceededMessage(feature, nextAvailableAt, { limit } = {}) {
  const labels = {
    [AI_FEATURES.ANALYZE]: 'วิเคราะห์พอร์ต',
    [AI_FEATURES.NEWS_SUMMARY]: 'สรุปข่าว',
    [AI_FEATURES.COPILOT]: 'Copilot',
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

export async function recordAiUsage(userId, feature) {
  await pool.query(
    'INSERT INTO ai_usage (user_id, feature) VALUES ($1, $2)',
    [userId, feature]
  )
}
