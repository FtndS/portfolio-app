/** Display name on Stripe invoices — PortDiary username, not cardholder legal name. */
export function stripeCustomerDisplayName({ name, email }) {
  const trimmed = String(name || '').trim()
  if (trimmed) return trimmed.slice(0, 120)
  const local = String(email || '').split('@')[0]?.trim()
  return (local || 'PortDiary member').slice(0, 120)
}

export async function ensureStripeCustomer(stripe, pool, userId) {
  const row = await pool.query(
    'SELECT email, name, stripe_customer_id FROM users WHERE id = $1',
    [userId]
  )
  const user = row.rows[0]
  if (!user?.email) return null

  const displayName = stripeCustomerDisplayName({ name: user.name, email: user.email })

  if (user.stripe_customer_id) {
    await stripe.customers.update(user.stripe_customer_id, { name: displayName })
    return user.stripe_customer_id
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: displayName,
    metadata: { userId: String(userId) },
  })
  await pool.query(
    'UPDATE users SET stripe_customer_id = $2 WHERE id = $1',
    [userId, customer.id]
  )
  return customer.id
}

export function checkoutPrivacyParams() {
  return {
    customer_update: {
      name: 'never',
      address: 'never',
    },
    name_collection: {
      individual: { enabled: false },
      business: { enabled: false },
    },
  }
}
