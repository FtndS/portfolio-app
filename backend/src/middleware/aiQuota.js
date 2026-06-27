import {
  getFeatureQuota,
  quotaExceededMessage,
} from '../lib/aiQuota.js'

export function requireAiQuota(feature) {
  return async (req, res, next) => {
    try {
      const status = await getFeatureQuota(req.userId, req.userEmail, feature, req.userRole)
      if (!status.allowed) {
        return res.status(429).json({
          error: quotaExceededMessage(feature, status.nextAvailableAt),
          code: 'AI_QUOTA_EXCEEDED',
          feature,
          nextAvailableAt: status.nextAvailableAt,
        })
      }
      next()
    } catch (err) {
      console.error('AI quota check error:', err)
      res.status(500).json({ error: err.message })
    }
  }
}
