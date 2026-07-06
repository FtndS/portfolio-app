import { getStripe } from './stripeClient.js'
import { sendProActivatedEmail } from './email.js'
import { ensureStripeCustomer } from './stripeCustomer.js'

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
  return sendProActivatedEmail(user, { source: 'stripe' })
}

/** Stripe Basil+ moved period end to subscription items; keep legacy fallback. */
export function getSubscriptionPeriodEnd(sub) {
  if (sub?.current_period_end) {
    return new Date(sub.current_period_end * 1000)
  }
  const items = sub?.items?.data || []
  let maxEnd = 0
  for (const item of items) {
    const end = item?.current_period_end
    if (typeof end === 'number' && end > maxEnd) maxEnd = end
  }
  if (maxEnd) return new Date(maxEnd * 1000)
  throw new Error('Subscription period end not found')
}

const MS_PER_DAY = 86400000

/** Credit unused manual Pro time when user first subscribes via Stripe. */
export function applyManualProCredit(stripePeriodEnd, previousExpiresAt, now = new Date()) {
  const stripeEnd = new Date(stripePeriodEnd)
  const prev = previousExpiresAt ? new Date(previousExpiresAt) : null
  if (!prev || prev.getTime() <= now.getTime()) {
    return { expiresAt: stripeEnd, extraMs: 0, extraDays: 0 }
  }
  const extraMs = prev.getTime() - now.getTime()
  return {
    expiresAt: new Date(stripeEnd.getTime() + extraMs),
    extraMs,
    extraDays: Math.round(extraMs / MS_PER_DAY),
  }
}

async function getManualProRemainderMs(pool, userId, atDate) {
  const at = atDate instanceof Date ? atDate : new Date(atDate)
  const row = await pool.query(
    `SELECT updated_at FROM support_tickets
     WHERE user_id = $1 AND category = 'upgrade'
       AND status IN ('resolved', 'closed')
       AND updated_at < $2
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, at.toISOString()]
  )
  if (!row.rows.length) return 0

  const grantAt = new Date(row.rows[0].updated_at)
  const manualEnd = new Date(grantAt)
  manualEnd.setMonth(manualEnd.getMonth() + 1)
  if (manualEnd.getTime() <= at.getTime()) return 0
  return manualEnd.getTime() - at.getTime()
}

function manualCreditAlreadyApplied(planNote) {
  return String(planNote || '').includes('manual credit')
}

export async function getStripeSubscriptionFlags(stripe, subscriptionId) {
  if (!stripe || !subscriptionId) return null
  const sub = await stripe.subscriptions.retrieve(String(subscriptionId))
  return {
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    currentPeriodEnd: getSubscriptionPeriodEnd(sub).toISOString(),
    status: sub.status,
  }
}

async function wasWebhookProcessed(pool, eventId) {
  const r = await pool.query(
    'SELECT 1 FROM stripe_webhook_events WHERE event_id = $1',
    [eventId]
  )
  return r.rows.length > 0
}

async function markWebhookProcessed(pool, eventId) {
  await pool.query(
    `INSERT INTO stripe_webhook_events (event_id) VALUES ($1)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId]
  )
}

async function resolveUserIdFromSubscription(pool, subscription, session = null) {
  const metaUserId = Number(subscription?.metadata?.userId || session?.metadata?.userId || session?.client_reference_id)
  if (metaUserId) {
    const byId = await pool.query('SELECT id FROM users WHERE id = $1', [metaUserId])
    if (byId.rows.length) return byId.rows[0].id
  }

  const customerId = subscription?.customer || session?.customer
  if (customerId) {
    const cid = typeof customerId === 'string' ? customerId : customerId?.id
    if (cid) {
      const byCustomer = await pool.query(
        'SELECT id FROM users WHERE stripe_customer_id = $1',
        [String(cid)]
      )
      if (byCustomer.rows.length) return byCustomer.rows[0].id

      const stripe = getStripe()
      if (stripe) {
        try {
          const customer = await stripe.customers.retrieve(String(cid))
          if (customer.email) {
            const byCustEmail = await pool.query(
              'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
              [String(customer.email).trim()]
            )
            if (byCustEmail.rows.length) return byCustEmail.rows[0].id
          }
        } catch (e) {
          console.error('Stripe customer lookup error:', e.message)
        }
      }
    }
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

  const periodEnd = getSubscriptionPeriodEnd(sub)
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id

  const existing = await pool.query(
    'SELECT plan_expires_at, stripe_subscription_id, plan_note FROM users WHERE id = $1',
    [userId]
  )
  const prev = existing.rows[0]
  const isRenewal = notePrefix === 'Stripe renewal'
  const hadStripe = !!prev?.stripe_subscription_id
  const creditApplied = manualCreditAlreadyApplied(prev?.plan_note)

  let finalExpiry = periodEnd
  let extraNote = ''

  if (isRenewal) {
    finalExpiry = periodEnd
  } else if (!hadStripe && !creditApplied) {
    const credited = applyManualProCredit(periodEnd, prev?.plan_expires_at)
    if (credited.extraMs > 0) {
      finalExpiry = credited.expiresAt
      extraNote = ` · manual credit +${credited.extraDays}d`
    }
  } else if (hadStripe && !creditApplied) {
    const signupAt = sub.created ? new Date(sub.created * 1000) : new Date()
    const remainderMs = await getManualProRemainderMs(pool, userId, signupAt)
    const currentMs = prev?.plan_expires_at ? new Date(prev.plan_expires_at).getTime() : 0
    const stripeMs = periodEnd.getTime()
    if (remainderMs > 0 && currentMs <= stripeMs + 3600000) {
      finalExpiry = new Date(stripeMs + remainderMs)
      extraNote = ` · manual credit +${Math.round(remainderMs / MS_PER_DAY)}d`
    } else if (currentMs > stripeMs) {
      finalExpiry = new Date(currentMs)
    }
  }

  const user = await grantProToUser(pool, userId, {
    expiresAt: finalExpiry,
    planNote: `${notePrefix} · sub ${sub.id}${extraNote}`,
    stripeCustomerId: customerId || null,
    stripeSubscriptionId: sub.id,
  })

  return { user, subscription: sub }
}

export async function syncUserSubscriptionFromStripe(pool, userId, email) {
  const stripe = getStripe()
  if (!stripe) return { synced: false, reason: 'stripe_not_configured' }

  const userRow = await pool.query(
    'SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = $1',
    [userId]
  )
  let customerId = userRow.rows[0]?.stripe_customer_id || null

  if (!customerId && email) {
    const customers = await stripe.customers.list({ email: String(email).trim(), limit: 5 })
    customerId = customers.data.find((c) => !c.deleted)?.id || null
  }

  if (!customerId) {
    return { synced: false, reason: 'no_stripe_customer' }
  }

  await pool.query(
    'UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, $2) WHERE id = $1',
    [userId, customerId]
  )

  await ensureStripeCustomer(stripe, pool, userId)

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  })

  const active = subs.data.find((s) => s.status === 'active' || s.status === 'trialing')
  if (!active) {
    return { synced: false, reason: 'no_active_subscription', customerId }
  }

  const { user, subscription } = await applySubscriptionPeriod(pool, userId, active, 'Stripe sync')
  return {
    synced: true,
    customerId,
    subscriptionId: subscription.id,
    planExpiresAt: user?.plan_expires_at,
  }
}

export async function fetchBillingHistory(pool, userId, { email, stripeCustomerId, proMonthlyThb }) {
  const rows = []

  const tickets = await pool.query(
    `SELECT id, subject, status, created_at, updated_at
     FROM support_tickets
     WHERE user_id = $1 AND category = 'upgrade'
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  )

  for (const t of tickets.rows) {
    const paid = t.status === 'resolved' || t.status === 'closed'
    rows.push({
      id: `ticket-${t.id}`,
      source: 'promptpay',
      amountThb: proMonthlyThb,
      currency: 'THB',
      status: paid ? 'paid' : t.status,
      description: t.subject,
      paidAt: paid ? t.updated_at : null,
      createdAt: t.created_at,
    })
  }

  const stripe = getStripe()
  if (!stripe) return rows.sort(byPaidAtDesc)

  let customerId = stripeCustomerId
  if (!customerId && email) {
    const customers = await stripe.customers.list({ email: String(email).trim(), limit: 5 })
    customerId = customers.data.find((c) => !c.deleted)?.id || null
  }

  if (!customerId) return rows.sort(byPaidAtDesc)

  const invoices = await stripe.invoices.list({ customer: customerId, limit: 36 })
  for (const inv of invoices.data) {
    const paidAt = inv.status_transitions?.paid_at
      ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
      : null
    const amount = inv.amount_paid != null ? inv.amount_paid / 100 : 0
    rows.push({
      id: `inv-${inv.id}`,
      source: 'stripe',
      amountThb: inv.currency?.toLowerCase() === 'thb' ? amount : null,
      amount,
      currency: (inv.currency || 'thb').toUpperCase(),
      status: inv.status,
      description: inv.lines?.data?.[0]?.description || 'PortDiary Pro',
      paidAt,
      createdAt: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      invoiceUrl: inv.hosted_invoice_url || null,
    })
  }

  return rows.sort(byPaidAtDesc)
}

function byPaidAtDesc(a, b) {
  const ta = new Date(a.paidAt || a.createdAt || 0).getTime()
  const tb = new Date(b.paidAt || b.createdAt || 0).getTime()
  return tb - ta
}

export async function handleStripeWebhookEvent(pool, event) {
  const duplicate = await wasWebhookProcessed(pool, event.id)
  const isPaymentEvent = event.type === 'checkout.session.completed' || event.type === 'invoice.paid'

  if (duplicate && !isPaymentEvent) {
    return { duplicate: true }
  }

  const result = await dispatchStripeWebhookEvent(pool, event)

  if (!duplicate) {
    await markWebhookProcessed(pool, event.id)
  }

  return duplicate ? { ...result, duplicate: true, recovered: true } : result
}

async function dispatchStripeWebhookEvent(pool, event) {
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
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id
      if (customerId) {
        await ensureStripeCustomer(getStripe(), pool, userId).catch((e) => {
          console.error('Stripe customer privacy sync error:', e.message)
        })
      }
      notifyProActivated(user).catch((e) => console.error('Pro activation email error:', e))
      return { ok: true, userId }
    }

    case 'invoice.paid': {
      const invoice = event.data.object
      const subRef = invoice.subscription
      if (!subRef) return { skipped: true, reason: 'not_subscription_invoice' }

      const stripe = getStripe()
      const subscription = await stripe.subscriptions.retrieve(String(subRef))
      const userId = await resolveUserIdFromSubscription(pool, subscription)
      if (!userId) return { error: 'user_not_found' }

      await applySubscriptionPeriod(pool, userId, subscription, 'Stripe renewal')
      return { ok: true, userId, renewed: true }
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object
      const userId = await resolveUserIdFromSubscription(pool, subscription)
      if (!userId) return { skipped: true, reason: 'user_not_found' }
      return { ok: true, userId, cancelAtPeriodEnd: !!subscription.cancel_at_period_end }
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
