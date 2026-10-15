import { cancelStripeSubscriptionNow } from './stripeSubscription.js'

export class BillingCancelError extends Error {
  constructor(provider, cause) {
    super(`Cancel ${provider} billing failed: ${cause?.message || cause}`)
    this.name = 'BillingCancelError'
    this.provider = provider
    this.cause = cause
  }
}

// Stops recurring billing first; the user row is deleted only if Stripe confirmed
// cancellation. Otherwise throws BillingCancelError and nothing is deleted.
export async function deleteUserAccount(pool, userId) {
  try {
    await cancelStripeSubscriptionNow(pool, userId)
  } catch (err) {
    throw new BillingCancelError('stripe', err)
  }
  await pool.query('DELETE FROM users WHERE id = $1', [userId])
}
