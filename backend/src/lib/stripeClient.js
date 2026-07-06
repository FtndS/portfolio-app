import Stripe from 'stripe'

let client = null

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) return null
  if (!client) client = new Stripe(key)
  return client
}

export function isStripeConfigured() {
  return !!(
    process.env.STRIPE_ENABLED === 'true'
    && process.env.STRIPE_SECRET_KEY?.trim()
    && process.env.STRIPE_PRICE_ID?.trim()
  )
}

export function appBaseUrl() {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
}
