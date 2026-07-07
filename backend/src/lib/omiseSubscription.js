import { createOmiseCharge, createOmiseSource, getOmiseCharge, isOmiseConfigured } from './omiseClient.js'
import { sendProActivatedEmail } from './email.js'

const THB_MULTIPLIER = 100
const PRO_PERIOD_DAYS = 30

function toSatang(amountThb) {
  const n = Number(amountThb)
  if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid amount')
  return Math.round(n * THB_MULTIPLIER)
}

function pickPromptPayQr(charge) {
  return (
    charge?.source?.scannable_code?.image?.download_uri
    || charge?.source?.scannable_code?.image?.uri
    || null
  )
}

function pickSourceExpiresAt(charge) {
  return charge?.source?.expires_at || null
}

async function grantProFromPromptPay(pool, userId, chargeId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const chargeRow = await client.query(
      'SELECT granted_at FROM omise_promptpay_charges WHERE charge_id = $1 FOR UPDATE',
      [chargeId]
    )
    if (!chargeRow.rows[0]) {
      await client.query('ROLLBACK')
      return { granted: false, reason: 'charge_not_found' }
    }
    if (chargeRow.rows[0].granted_at) {
      await client.query('COMMIT')
      return { granted: false, reason: 'already_granted' }
    }

    const userResult = await client.query(
      'SELECT id, email, name, plan_expires_at FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    )
    const user = userResult.rows[0]
    if (!user) throw new Error('User not found for promptpay grant')

    const now = new Date()
    const base = user.plan_expires_at && new Date(user.plan_expires_at) > now
      ? new Date(user.plan_expires_at)
      : now
    const nextExpiry = new Date(base.getTime() + PRO_PERIOD_DAYS * 86400000)

    const updated = await client.query(
      `UPDATE users
       SET plan = 'pro',
           plan_expires_at = $2,
           plan_updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, plan_expires_at`,
      [userId, nextExpiry.toISOString()]
    )

    await client.query(
      `UPDATE omise_promptpay_charges
       SET granted_at = NOW(), status = 'successful', paid_at = COALESCE(paid_at, NOW()), updated_at = NOW()
       WHERE charge_id = $1`,
      [chargeId]
    )

    await client.query('COMMIT')
    await sendProActivatedEmail(updated.rows[0], { source: 'promptpay' })
    return { granted: true, planExpiresAt: updated.rows[0].plan_expires_at }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export async function createPromptPayCheckout(pool, user, amountThb) {
  if (!isOmiseConfigured()) throw new Error('Omise is not configured')

  const amount = toSatang(amountThb)
  const source = await createOmiseSource({
    type: 'promptpay',
    amount,
    currency: 'thb',
  })

  const charge = await createOmiseCharge({
    amount,
    currency: 'thb',
    source: source.id,
    description: 'PortDiary Pro',
    metadata: {
      userId: String(user.id),
      email: user.email,
      type: 'pro_promptpay',
    },
  })

  const qrImageUrl = pickPromptPayQr(charge)
  if (!qrImageUrl) {
    throw new Error('PromptPay QR image not found from Omise')
  }

  await pool.query(
    `INSERT INTO omise_promptpay_charges
      (user_id, charge_id, source_id, amount_satang, status, qr_image_url, source_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (charge_id) DO UPDATE
     SET status = EXCLUDED.status,
         qr_image_url = EXCLUDED.qr_image_url,
         source_expires_at = EXCLUDED.source_expires_at,
         updated_at = NOW()`,
    [
      user.id,
      charge.id,
      source.id,
      amount,
      charge.status || 'pending',
      qrImageUrl,
      pickSourceExpiresAt(charge),
    ]
  )

  return {
    chargeId: charge.id,
    amountThb,
    status: charge.status || 'pending',
    qrImageUrl,
    expiresAt: pickSourceExpiresAt(charge),
  }
}

export async function syncPromptPayCharge(pool, userId, chargeId) {
  const rowResult = await pool.query(
    'SELECT user_id FROM omise_promptpay_charges WHERE charge_id = $1',
    [chargeId]
  )
  const row = rowResult.rows[0]
  if (!row || row.user_id !== userId) return { error: 'charge_not_found' }

  const charge = await getOmiseCharge(chargeId)
  const status = charge.status || 'pending'
  const paidAt = status === 'successful' ? (charge.paid_at || new Date().toISOString()) : null
  const qrImageUrl = pickPromptPayQr(charge)
  const expiresAt = pickSourceExpiresAt(charge)

  await pool.query(
    `UPDATE omise_promptpay_charges
     SET status = $2,
         paid_at = COALESCE($3, paid_at),
         qr_image_url = COALESCE($4, qr_image_url),
         source_expires_at = COALESCE($5, source_expires_at),
         updated_at = NOW()
     WHERE charge_id = $1`,
    [chargeId, status, paidAt, qrImageUrl, expiresAt]
  )

  let granted = false
  if (status === 'successful') {
    const grant = await grantProFromPromptPay(pool, userId, chargeId)
    granted = !!grant.granted
  }

  return {
    chargeId,
    status,
    paidAt,
    qrImageUrl,
    expiresAt,
    granted,
  }
}

export async function handleOmiseWebhookEvent(pool, event) {
  const eventId = event?.key || event?.id || null
  if (!eventId) return { ignored: true, reason: 'missing_event_id' }

  const inserted = await pool.query(
    `INSERT INTO omise_webhook_events (event_id)
     VALUES ($1)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [eventId]
  )
  if (!inserted.rows.length) return { duplicate: true }

  const data = event?.data
  if (data?.object !== 'charge') return { ignored: true, reason: 'not_charge_event' }
  if (data?.status !== 'successful') return { ignored: true, reason: 'charge_not_successful' }

  const chargeId = data.id
  const rowResult = await pool.query(
    'SELECT user_id FROM omise_promptpay_charges WHERE charge_id = $1',
    [chargeId]
  )
  const row = rowResult.rows[0]
  if (!row) return { ignored: true, reason: 'charge_not_tracked' }

  await syncPromptPayCharge(pool, row.user_id, chargeId)
  return { handled: true, chargeId }
}

export async function fetchOmiseBillingHistory(pool, userId) {
  const rows = await pool.query(
    `SELECT charge_id, amount_satang, status, paid_at, created_at
     FROM omise_promptpay_charges
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  )

  return rows.rows.map((r) => ({
    id: `omise:${r.charge_id}`,
    source: 'omise_promptpay',
    status: r.status,
    description: 'PortDiary Pro (PromptPay)',
    amountThb: Number(r.amount_satang) / THB_MULTIPLIER,
    paidAt: r.paid_at,
    createdAt: r.created_at,
    invoiceUrl: null,
  }))
}
