import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { getAiQuota } from '../lib/aiQuota.js'
import { isAiPrivilegedUser, resolveEffectivePlan } from '../lib/aiPlan.js'
import { buildSubscriptionCatalog } from '../lib/subscriptionCatalog.js'

const router = express.Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const effective = resolveEffectivePlan(req.userPlan, req.userPlanExpiresAt)
    const isOwner = isAiPrivilegedUser(req.userRole, req.userEmail)
    const quota = await getAiQuota(
      req.userId,
      req.userEmail,
      req.userRole,
      req.userPlan,
      req.userPlanExpiresAt
    )

    res.json({
      plan: isOwner ? 'pro' : effective,
      planLabel: isOwner ? 'Owner' : (effective === 'pro' ? 'Pro' : 'Free'),
      planExpiresAt: req.userPlanExpiresAt || null,
      isOwner,
      paymentEnabled: process.env.STRIPE_ENABLED === 'true',
      paymentInstructions: process.env.PRO_PAYMENT_INSTRUCTIONS || null,
      catalog: buildSubscriptionCatalog(),
      quota,
    })
  } catch (err) {
    console.error('GET subscription error:', err)
    res.status(500).json({ error: 'โหลดข้อมูลแผนไม่สำเร็จ' })
  }
})

export default router
