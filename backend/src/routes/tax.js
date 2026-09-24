import express from 'express'
import pool from '../db/index.js'
import { serverError } from '../lib/httpErrors.js'
import { estimateTax } from '../lib/taxEstimate.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
router.use(authMiddleware)

function parseYear(value) {
  const year = Number(value)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null
  return year
}

function parseIsoDate(value) {
  const s = String(value || '').trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return s
}

router.get('/estimate', async (req, res) => {
  const year = parseYear(req.query.year) || new Date().getFullYear()
  try {
    const [tx, div, facts, remits] = await Promise.all([
      pool.query(
        `SELECT id, portfolio_id, ticker, type, shares, price, fee, currency, date::text AS date
         FROM transactions
         WHERE user_id = $1
         ORDER BY date ASC, id ASC`,
        [req.userId],
      ),
      pool.query(
        `SELECT id, portfolio_id, ticker, amount, currency, pay_date::text AS pay_date
         FROM dividends
         WHERE user_id = $1`,
        [req.userId],
      ),
      pool.query(
        `SELECT tax_year, days_in_thailand, us_w8ben, set_dividend_mode,
                dividend_amount_basis, other_assessable_thb
         FROM tax_year_facts
         WHERE user_id = $1`,
        [req.userId],
      ),
      pool.query(
        `SELECT source_type, source_id, remitted_on::text AS remitted_on, fx_thb_per_unit
         FROM tax_remittances
         WHERE user_id = $1`,
        [req.userId],
      ),
    ])
    res.json(estimateTax({
      year,
      transactions: tx.rows,
      dividends: div.rows,
      yearFacts: facts.rows,
      remittances: remits.rows,
    }))
  } catch (err) {
    serverError(res, err, 'GET /tax/estimate')
  }
})

router.put('/years/:year', async (req, res) => {
  const year = parseYear(req.params.year)
  if (!year) return res.status(400).json({ error: 'ปีภาษีไม่ถูกต้อง' })

  const body = req.body || {}
  let days = null
  if (body.days_in_thailand != null && body.days_in_thailand !== '') {
    days = Number(body.days_in_thailand)
    if (!Number.isInteger(days) || days < 0 || days > 366) {
      return res.status(400).json({ error: 'จำนวนวันอยู่ในไทยต้องอยู่ระหว่าง 0 ถึง 366' })
    }
  }

  const mode = body.set_dividend_mode === 'include' ? 'include' : 'final'
  if (body.set_dividend_mode != null && body.set_dividend_mode !== 'final' && body.set_dividend_mode !== 'include') {
    return res.status(400).json({ error: 'วิธีปันผลไทยไม่ถูกต้อง' })
  }
  const basis = body.dividend_amount_basis === 'net' ? 'net' : 'gross'
  if (body.dividend_amount_basis != null && body.dividend_amount_basis !== 'gross' && body.dividend_amount_basis !== 'net') {
    return res.status(400).json({ error: 'ฐานยอดปันผลไม่ถูกต้อง' })
  }

  let other = null
  if (body.other_assessable_thb != null && body.other_assessable_thb !== '') {
    other = Number(body.other_assessable_thb)
    if (!Number.isFinite(other) || other < 0) {
      return res.status(400).json({ error: 'รายได้อื่นต้องไม่ติดลบ' })
    }
    other = Math.round(other * 100) / 100
  }

  const w8ben = Boolean(body.us_w8ben)

  try {
    const result = await pool.query(
      `INSERT INTO tax_year_facts (
         user_id, tax_year, days_in_thailand, us_w8ben, set_dividend_mode,
         dividend_amount_basis, other_assessable_thb, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id, tax_year)
       DO UPDATE SET
         days_in_thailand = EXCLUDED.days_in_thailand,
         us_w8ben = EXCLUDED.us_w8ben,
         set_dividend_mode = EXCLUDED.set_dividend_mode,
         dividend_amount_basis = EXCLUDED.dividend_amount_basis,
         other_assessable_thb = EXCLUDED.other_assessable_thb,
         updated_at = NOW()
       RETURNING tax_year, days_in_thailand, us_w8ben, set_dividend_mode,
                 dividend_amount_basis, other_assessable_thb`,
      [req.userId, year, days, w8ben, mode, basis, other],
    )
    res.json(result.rows[0])
  } catch (err) {
    serverError(res, err, 'PUT /tax/years')
  }
})

router.put('/remittances', async (req, res) => {
  const sourceType = req.body?.source_type
  const sourceId = Number(req.body?.source_id)
  if (sourceType !== 'sell' && sourceType !== 'dividend') {
    return res.status(400).json({ error: 'ประเภทต้นทางไม่ถูกต้อง' })
  }
  if (!Number.isInteger(sourceId) || sourceId <= 0) {
    return res.status(400).json({ error: 'ไม่พบรายการต้นทาง' })
  }

  try {
    if (req.body?.remitted === false) {
      await pool.query(
        `DELETE FROM tax_remittances
         WHERE user_id = $1 AND source_type = $2 AND source_id = $3`,
        [req.userId, sourceType, sourceId],
      )
      return res.json({ deleted: true })
    }

    const remittedOn = parseIsoDate(req.body?.remitted_on)
    if (!remittedOn) return res.status(400).json({ error: 'วันที่โอนไม่ถูกต้อง' })

    let fx = null
    if (req.body?.fx_thb_per_unit != null && req.body.fx_thb_per_unit !== '') {
      fx = Number(req.body.fx_thb_per_unit)
      if (!(fx > 0)) return res.status(400).json({ error: 'อัตราแลกต้องมากกว่า 0' })
    }

    const sourceSql = sourceType === 'sell'
      ? `SELECT portfolio_id FROM transactions WHERE id = $1 AND user_id = $2 AND type = 'SELL'`
      : `SELECT portfolio_id FROM dividends WHERE id = $1 AND user_id = $2`
    const source = await pool.query(sourceSql, [sourceId, req.userId])
    if (!source.rows.length) return res.status(404).json({ error: 'ไม่พบรายการขายหรือปันผล' })

    const saved = await pool.query(
      `INSERT INTO tax_remittances (
         user_id, portfolio_id, source_type, source_id, remitted_on, fx_thb_per_unit, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, source_type, source_id)
       DO UPDATE SET
         portfolio_id = EXCLUDED.portfolio_id,
         remitted_on = EXCLUDED.remitted_on,
         fx_thb_per_unit = EXCLUDED.fx_thb_per_unit,
         updated_at = NOW()
       RETURNING source_type, source_id, remitted_on::text AS remitted_on, fx_thb_per_unit`,
      [req.userId, source.rows[0].portfolio_id, sourceType, sourceId, remittedOn, fx],
    )
    res.json(saved.rows[0])
  } catch (err) {
    serverError(res, err, 'PUT /tax/remittances')
  }
})

export default router
