import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { storageTicker, defaultCurrency, detectMarket } from '../lib/ticker.js'
import { resolvePortfolioId, repairAllPortfolioLinks } from '../lib/portfolio.js'
import { syncHoldingFromTransactions } from '../lib/holdingSync.js'
import { parseTransactionCsv } from '../lib/csvImport.js'
import { parseFee } from '../lib/validate.js'

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

router.post('/import', async (req, res) => {
  const { csv, portfolio_id, dry_run } = req.body
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'กรุณาส่งไฟล์ CSV' })
  }

  try {
    const portfolioId = await resolvePortfolioId(req.userId, portfolio_id)
    const portfolio = await pool.query(
      'SELECT currency FROM portfolios WHERE id = $1 AND user_id = $2',
      [portfolioId, req.userId]
    )
    const defaultCurrency = portfolio.rows[0]?.currency || 'USD'
    const parsed = parseTransactionCsv(csv, { defaultCurrency })

    if (parsed.errors.length && !parsed.validCount) {
      return res.status(400).json({
        error: 'ไม่พบรายการที่นำเข้าได้',
        ...parsed,
      })
    }

    if (dry_run) {
      return res.json(parsed)
    }

    if (!parsed.validCount) {
      return res.status(400).json({ error: 'ไม่มีรายการที่ถูกต้อง', ...parsed })
    }

    const sorted = [...parsed.validRows].sort((a, b) => {
      const d = a.date.localeCompare(b.date)
      return d !== 0 ? d : a.line - b.line
    })

    const client = await pool.connect()
    const imported = []
    const tickers = new Set()

    try {
      await client.query('BEGIN')

      for (const row of sorted) {
        const total = row.shares * row.price
        const fee = row.fee ?? 0
        const txCurrency = row.currency || defaultCurrency
        const result = await client.query(
          `INSERT INTO transactions (user_id, portfolio_id, holding_id, ticker, type, shares, price, total, fee, note, date, currency)
           VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, ticker, date, type`,
          [
            req.userId, portfolioId, row.ticker, row.type,
            row.shares, row.price, total, fee, row.note, row.date, txCurrency,
          ]
        )
        imported.push(result.rows[0])
        tickers.add(row.ticker)
      }

      for (const ticker of tickers) {
        const holdingRow = await client.query(
          'SELECT currency FROM holdings WHERE user_id = $1 AND portfolio_id = $2 AND ticker = $3 LIMIT 1',
          [req.userId, portfolioId, ticker]
        )
        const rowMatch = sorted.find((r) => r.ticker === ticker)
        const txCurrency = rowMatch?.currency
          || holdingRow.rows[0]?.currency
          || defaultCurrency
        await syncHoldingFromTransactions(client, req.userId, portfolioId, ticker, null, txCurrency)
      }

      await client.query('COMMIT')
      res.json({
        imported: imported.length,
        skipped: parsed.total - parsed.validCount,
        errors: parsed.errors,
        tickers: [...tickers],
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('CSV import error:', err)
    res.status(500).json({ error: err.message || 'นำเข้าไม่สำเร็จ' })
  }
})

router.post('/', async (req, res) => {
  const { ticker, type, shares, price, fee, note, date, holding_id, portfolio_id, currency } = req.body
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
  const feeNum = parseFee(fee)
  if (feeNum == null) {
    return res.status(400).json({ error: 'ค่าธรรมเนียมต้องเป็นตัวเลข 0 ขึ้นไป' })
  }

  let txCurrency = currency
  if (!txCurrency && holding_id) {
    const holdingRow = await pool.query(
      'SELECT currency FROM holdings WHERE id = $1 AND user_id = $2',
      [holding_id, req.userId]
    )
    txCurrency = holdingRow.rows[0]?.currency
  }
  if (!txCurrency) txCurrency = defaultCurrency(detectMarket(ticker, null))
  if (!txCurrency) txCurrency = 'USD'

  const sanitizedTicker = storageTicker(ticker, null, txCurrency)
  const total = shareNum * priceNum
  const client = await pool.connect()
  try {
    const portfolioId = await resolvePortfolioId(req.userId, portfolio_id)
    await client.query('BEGIN')

    const txResult = await client.query(
      `INSERT INTO transactions (user_id, portfolio_id, holding_id, ticker, type, shares, price, total, fee, note, date, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [req.userId, portfolioId, holding_id || null, sanitizedTicker, type,
        shareNum, priceNum, total, feeNum, note || null, date, txCurrency]
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
  const { ticker, type, shares, price, fee, note, date, holding_id, currency } = req.body
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
  const feeNum = parseFee(fee)
  if (feeNum == null) {
    return res.status(400).json({ error: 'ค่าธรรมเนียมต้องเป็นตัวเลข 0 ขึ้นไป' })
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
    if (!txCurrency) {
      txCurrency = (await client.query(
        'SELECT currency FROM transactions WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
      )).rows[0]?.currency
    }
    if (!txCurrency) txCurrency = defaultCurrency(detectMarket(ticker, null))
    txCurrency = txCurrency || 'USD'

    const sanitizedTicker = storageTicker(ticker, null, txCurrency)
    const total = shareNum * priceNum

    const txResult = await client.query(
      `UPDATE transactions
       SET ticker = $1, type = $2, shares = $3, price = $4, total = $5, fee = $6,
           note = $7, date = $8, holding_id = $9, currency = $10
       WHERE id = $11 AND user_id = $12
       RETURNING *`,
      [
        sanitizedTicker, type, shareNum, priceNum, total, feeNum,
        note || null, date, holding_id || null, txCurrency,
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
