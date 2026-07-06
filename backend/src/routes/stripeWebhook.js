import express from 'express'
import pool from '../db/index.js'
import { getStripe } from '../lib/stripeClient.js'
import { handleStripeWebhookEvent } from '../lib/stripeSubscription.js'
import { serverError } from '../lib/httpErrors.js'

const router = express.Router()

router.post('/', async (req, res) => {
  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!stripe || !secret) {
    return res.status(503).json({ error: 'Stripe webhook not configured' })
  }

  const signature = req.headers['stripe-signature']
  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature' })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, secret)
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message)
    return res.status(400).json({ error: 'Invalid webhook signature' })
  }

  try {
    const result = await handleStripeWebhookEvent(pool, event)
    res.json({ received: true, ...result })
  } catch (err) {
    serverError(res, err, 'Stripe webhook handler error:')
  }
})

export default router
