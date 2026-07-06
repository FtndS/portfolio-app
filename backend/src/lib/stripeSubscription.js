import { getStripe } from './stripeClient.js'
import { sendEmail } from './email.js'

export async function grantProToUser(pool, userId, {
  expiresAt,
  planNote = null,
  stripeCustomerId = null,
  stripeSubscriptionId = null,
}) {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt)
  if (Number.isNaN(expiry.getTime())) {
    throw new Error('Invalid Pro expiry date')
  }

  const result = await pool.query(
    `UPDATE users
     SET plan = 'pro',
         plan_expires_at = $2,
         plan_note = COALESCE($3, plan_note),
         plan_updated_at = NOW(),
         stripe_customer_id = COALESCE($4, stripe_customer_id),
         stripe_subscription_id = COALESCE($5, stripe_subscription_id)
     WHERE id = $1
     RETURNING id, email, name, plan, plan_expires_at`,
    [userId, expiry.toISOString(), planNote, stripeCustomerId, stripeSubscriptionId]
  )

  return result.rows[0] || null
}

export async function notifyProActivated(user) {
  if (!user?.email) return
  const expires = user.plan_expires_at
    ? new Date(user.plan_expires_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'
  const appUrl = (process.env.APP_URL || 'https://portdiary.com').replace(/\/$/, '')
  const subject = 'เปิดแผน PortDiary Pro แล้ว'
  const text = [
    `สวัสดี ${user.name || ''}`.trim(),
    '',
    'การชำระเงินสำเร็จ — บัญชีของคุณเป็นแผน Pro แล้ว',
    `ใช้งานได้ถึง: ${expires}`,
    '',
    `เข้าใช้งาน: ${appUrl}`,
  ].join('\n')
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#222">
      <h2 style="color:#6c5ce7">PortDiary Pro</h2>
      <p>การชำระเงินสำเร็จ — บัญชีของคุณเป็นแผน <strong>Pro</strong> แล้ว</p>
      <p>ใช้งานได้ถึง: <strong>${expires}</strong></p>
      <p><a href="${appUrl}" style="color:#6c5ce7">เปิด PortDiary</a></p>
    </div>
  `
  await sendEmail({ to: user.email, subject, text, html })
}

async function markWebhookProcessed(pool, eventId) {
  const inserted = await pool.query(
    `INSERT INTO stripe_webhook_events (event_id) VALUES ($1)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [eventId]
  )
  return inserted.rows.length > 0
}

async function resolveUserIdFromSubscription(pool, subscription, session = null) {
  const metaUserId = Number(subscription?.metadata?.userId || session?.metadata?.userId || session?.client_reference_id)
  if (metaUserId) {
    const byId = await pool.query('SELECT id FROM users WHERE id = $1', [metaUserId])
    if (byId.rows.length) return byId.rows[0].id
  }

  const customerId = subscription?.customer || session?.customer
  if (customerId) {
    const byCustomer = await pool.query(
      'SELECT id FROM users WHERE stripe_customer_id = $1',
      [String(customerId)]
    )
    if (byCustomer.rows.length) return byCustomer.rows[0].id
  }

  const email = session?.customer_details?.email || session?.customer_email
  if (email) {
    const byEmail = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [String(email).trim()]
    )
    if (byEmail.rows.length) return byEmail.rows[0].id
  }

  return null
}

export async function applySubscriptionPeriod(pool, userId, subscription, notePrefix = 'Stripe') {
  const stripe = getStripe()
  if (!stripe) throw new Error('Stripe not configured')

  const sub = typeof subscription === 'string'
    ? await stripe.subscriptions.retrieve(subscription)
    : subscription

  const periodEnd = new Date(sub.current_period_end * 1000)
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id

  const user = await grantProToUser(pool, userId, {
    expiresAt: periodEnd,
    planNote: `${notePrefix} · sub ${sub.id}`,
    stripeCustomerId: customerId || null,
    stripeSubscriptionId: sub.id,
  })

  return { user, subscription: sub }
}

export async function handleStripeWebhookEvent(pool, event) {
  const fresh = await markWebhookProcessed(pool, event.id)
  if (!fresh) return { duplicate: true }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.mode !== 'subscription' || !session.subscription) {
        return { skipped: true, reason: 'not_subscription_checkout' }
      }

      const stripe = getStripe()
      const subscription = await stripe.subscriptions.retrieve(String(session.subscription))
      const userId = await resolveUserIdFromSubscription(pool, subscription, session)
      if (!userId) return { error: 'user_not_found' }

      const { user } = await applySubscriptionPeriod(pool, userId, subscription, 'Stripe checkout')
      notifyProActivated(user).catch((e) => console.error('Pro activation email error:', e))
      return { ok: true, userId }
    }

    case 'invoice.paid': {
      const invoice = event.data.object
      if (!invoice.subscription) return { skipped: true, reason: 'not_subscription_invoice' }

      const stripe = getStripe()
      const subscription = await stripe.subscriptions.retrieve(String(invoice.subscription))
      const userId = await resolveUserIdFromSubscription(pool, subscription)
      if (!userId) return { error: 'user_not_found' }

      await applySubscriptionPeriod(pool, userId, subscription, 'Stripe renewal')
      return { ok: true, userId, renewed: true }
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const userId = await resolveUserIdFromSubscription(pool, subscription)
      if (!userId) return { skipped: true, reason: 'user_not_found' }

      await pool.query(
        `UPDATE users
         SET stripe_subscription_id = NULL,
             plan_note = COALESCE(plan_note, '') || ' · subscription cancelled',
             plan_updated_at = NOW()
         WHERE id = $1`,
        [userId]
      )
      return { ok: true, userId, cancelled: true }
    }

    default:
      return { ignored: true, type: event.type }
  }
}
