import {
  getFeatureQuota,
  quotaExceededMessage,
  reserveAiQuota,
} from '../lib/aiQuota.js'
import { serverError } from '../lib/httpErrors.js'

export function requireAiQuota(feature) {
  return async (req, res, next) => {
    try {
      const status = await reserveAiQuota(
        req.userId,
        req.userEmail,
        feature,
        req.userRole,
        req.userPlan,
        req.userPlanExpiresAt
      )
      if (!status.allowed) {
        return res.status(429).json({
          error: quotaExceededMessage(feature, status.nextAvailableAt, { limit: status.limit }),
          code: 'AI_QUOTA_EXCEEDED',
          feature,
          nextAvailableAt: status.nextAvailableAt,
        })
      }
      next()
    } catch (err) {
      serverError(res, err, 'AI quota check error:')
    }
  }
}
