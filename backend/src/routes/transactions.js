import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { storageTicker, resolveMarket } from '../lib/ticker.js'
import { resolvePortfolioId, repairAllPortfolioLinks } from '../lib/portfolio.js'
import { syncHoldingFromTransactions } from '../lib/holdingSync.js'

const router = express.Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.query.portfolio_id)
    const result = await pool.query(
      `SELECT * FROM transactions WHERE user_id = $1 AND portfolio_id = $2
       ORDER BY date DESC, created_at DESC`,
      [req.userId, portfolioId]
    )

    res.json(result.rows)
  } catch (err) {
    console.error('GET transactions error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { ticker, type, shares, price, note, date, holding_id, portfolio_id, currency } = req.body
  if (!ticker || !type || !shares || !price || !date) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' })
  }
  if (!['BUY', 'SELL'].includes(type)) {
    return res.status(400).json({ error: 'ประเภทต้องเป็น BUY หรือ SELL' })
  }
  const shareNum = parseFloat(shares)
  const priceNum = parseFloat(price)
  if (!(shareNum > 0) || !(priceNum > 0)) {
    return res.status(400).json({ error: 'จำนวนหุ้นและราคาต้องมากกว่า 0' })
  }

  let txCurrency = currency
  if (!txCurrency && holding_id) {
    const holdingRow = await pool.query(
      'SELECT currency FROM holdings WHERE id = $1 AND user_id = $2',
      [holding_id, req.userId]
    )
    txCurrency = holdingRow.rows[0]?.currency
  }

  const sanitizedTicker = storageTicker(ticker, null, txCurrency)
  const total = shareNum * priceNum
  const client = await pool.connect()
  try {
    const portfolioId = await resolvePortfolioId(req.userId, portfolio_id)
    await client.query('BEGIN')

    const txResult = await client.query(
      `INSERT INTO transactions (user_id, portfolio_id, holding_id, ticker, type, shares, price, total, note, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.userId, portfolioId, holding_id || null, sanitizedTicker, type,
        shareNum, priceNum, total, note || null, date]
    )

    await syncHoldingFromTransactions(client, req.userId, portfolioId, sanitizedTicker, null, txCurrency)

    await client.query('COMMIT')
    res.json(txResult.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

router.put('/:id', async (req, res) => {
  const { ticker, type, shares, price, note, date, holding_id, currency } = req.body
  if (!ticker || !type || !shares || !price || !date) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' })
  }
  if (!['BUY', 'SELL'].includes(type)) {
    return res.status(400).json({ error: 'ประเภทต้องเป็น BUY หรือ SELL' })
  }
  const shareNum = parseFloat(shares)
  const priceNum = parseFloat(price)
  if (!(shareNum > 0) || !(priceNum > 0)) {
    return res.status(400).json({ error: 'จำนวนหุ้นและราคาต้องมากกว่า 0' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query(
      'SELECT id, ticker, portfolio_id FROM transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    )
    if (!existing.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'ไม่พบรายการ' })
    }

    const oldTicker = existing.rows[0].ticker
    let portfolioId = existing.rows[0].portfolio_id
    if (!portfolioId) {
      portfolioId = await repairAllPortfolioLinks(req.userId)
      await client.query(
        'UPDATE transactions SET portfolio_id = $1 WHERE id = $2 AND user_id = $3',
        [portfolioId, req.params.id, req.userId]
      )
    }

    let txCurrency = currency
    if (!txCurrency && holding_id) {
      const holdingRow = await client.query(
        'SELECT currency FROM holdings WHERE id = $1 AND user_id = $2',
        [holding_id, req.userId]
      )
      txCurrency = holdingRow.rows[0]?.currency
    }
    if (!txCurrency) {
      const holdingRow = await client.query(
        'SELECT currency FROM holdings WHERE user_id = $1 AND portfolio_id = $2 AND ticker = $3 LIMIT 1',
        [req.userId, portfolioId, oldTicker]
      )
      txCurrency = holdingRow.rows[0]?.currency
    }

    const sanitizedTicker = storageTicker(ticker, null, txCurrency)
    const total = shareNum * priceNum

    const txResult = await client.query(
      `UPDATE transactions
       SET ticker = $1, type = $2, shares = $3, price = $4, total = $5,
           note = $6, date = $7, holding_id = $8
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        sanitizedTicker, type, shareNum, priceNum, total,
        note || null, date, holding_id || null,
        req.params.id, req.userId,
      ]
    )

    await syncHoldingFromTransactions(client, req.userId, portfolioId, sanitizedTicker, null, txCurrency)
    if (oldTicker !== sanitizedTicker) {
      await syncHoldingFromTransactions(client, req.userId, portfolioId, oldTicker, null, txCurrency)
    }

    await client.query('COMMIT')
    res.json(txResult.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('PUT transaction error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

router.delete('/:id', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const tx = await client.query(
      'SELECT ticker, portfolio_id FROM transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    )
    if (!tx.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Not found' })
    }

    const { ticker, portfolio_id: rawPortfolioId } = tx.rows[0]
    let portfolioId = rawPortfolioId
    if (!portfolioId) {
      portfolioId = await repairAllPortfolioLinks(req.userId)
      await client.query(
        'UPDATE transactions SET portfolio_id = $1 WHERE id = $2 AND user_id = $3',
        [portfolioId, req.params.id, req.userId]
      )
    }
    await client.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [req.params.id, req.userId])
    await syncHoldingFromTransactions(client, req.userId, portfolioId, ticker)

    await client.query('COMMIT')
    res.json({ message: 'Deleted' })
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

export default router
