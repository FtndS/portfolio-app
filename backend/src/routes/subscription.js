import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { getAiQuota } from '../lib/aiQuota.js'
import { isAiPrivilegedUser, resolveEffectivePlan } from '../lib/aiPlan.js'
import { buildSubscriptionCatalog } from '../lib/subscriptionCatalog.js'
import { appBaseUrl, getStripe, isStripeConfigured } from '../lib/stripeClient.js'
import { serverError } from '../lib/httpErrors.js'
import pool from '../db/index.js'

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

    const stripeConfigured = isStripeConfigured()
    const userRow = await pool.query(
      'SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = $1',
      [req.userId]
    )
    const stripeCustomerId = userRow.rows[0]?.stripe_customer_id || null
    const hasStripeSubscription = !!userRow.rows[0]?.stripe_subscription_id

    const pendingUpgrade = await pool.query(
      `SELECT id, status, created_at
       FROM support_tickets
       WHERE user_id = $1 AND category = 'upgrade' AND status IN ('open', 'in_progress')
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.userId]
    )

    const effectiveForSource = resolveEffectivePlan(req.userPlan, req.userPlanExpiresAt)
    let proPaymentSource = null
    if (effectiveForSource === 'pro' && !isOwner) {
      proPaymentSource = hasStripeSubscription ? 'stripe' : 'manual'
    }

    res.json({
      plan: isOwner ? 'pro' : effective,
      planLabel: isOwner ? 'Owner' : (effective === 'pro' ? 'Pro' : 'Free'),
      planExpiresAt: req.userPlanExpiresAt || null,
      isOwner,
      paymentEnabled: stripeConfigured,
      paymentMode: stripeConfigured ? 'stripe' : 'manual',
      manualPaymentEnabled: true,
      stripeCustomerId,
      hasStripeSubscription,
      proPaymentSource,
      pendingUpgradeTicket: pendingUpgrade.rows[0] || null,
      paymentQrUrl: process.env.PRO_PAYMENT_QR_URL || '/promptpay-qr-99.png',
      paymentInstructions: process.env.PRO_PAYMENT_INSTRUCTIONS || null,
      catalog: buildSubscriptionCatalog(),
      quota,
    })
  } catch (err) {
    serverError(res, err, 'GET subscription error:')
  }
})

router.post('/checkout', async (req, res) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'ระบบชำระเงินอัตโนมัติยังไม่พร้อม — ติดต่อทีมงาน' })
    }

    const stripe = getStripe()
    const effective = resolveEffectivePlan(req.userPlan, req.userPlanExpiresAt)
    const userRow = await pool.query(
      'SELECT email, stripe_customer_id, stripe_subscription_id FROM users WHERE id = $1',
      [req.userId]
    )
    const user = userRow.rows[0]
    if (!user?.email) return res.status(400).json({ error: 'ไม่พบอีเมลบัญชี' })

    if (
      effective === 'pro'
      && !isAiPrivilegedUser(req.userRole, req.userEmail)
      && user.stripe_subscription_id
    ) {
      return res.status(400).json({ error: 'บัญชีนี้เป็น Pro อยู่แล้ว — ใช้จัดการการต่ออายุด้านล่าง' })
    }

    const base = appBaseUrl()
    const sessionParams = {
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID.trim(), quantity: 1 }],
      success_url: `${base}/?subscription=success`,
      cancel_url: `${base}/?subscription=cancel`,
      client_reference_id: String(req.userId),
      metadata: { userId: String(req.userId) },
      subscription_data: {
        metadata: { userId: String(req.userId) },
      },
    }

    if (user.stripe_customer_id) {
      sessionParams.customer = user.stripe_customer_id
    } else {
      sessionParams.customer_email = user.email
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    res.json({ url: session.url })
  } catch (err) {
    serverError(res, err, 'POST subscription/checkout error:')
  }
})

router.post('/portal', async (req, res) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'ระบบชำระเงินอัตโนมัติยังไม่พร้อม' })
    }

    const stripe = getStripe()
    const userRow = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [req.userId]
    )
    const customerId = userRow.rows[0]?.stripe_customer_id
    if (!customerId) {
      return res.status(400).json({ error: 'ยังไม่มีข้อมูลการชำระเงิน — อัปเกรด Pro ก่อน' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appBaseUrl()}/?tab=subscription`,
    })
    res.json({ url: session.url })
  } catch (err) {
    serverError(res, err, 'POST subscription/portal error:')
  }
})

export default router
