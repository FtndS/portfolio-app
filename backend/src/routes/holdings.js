import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
router.use(authMiddleware)

// ฟังก์ชันดึงชื่อเต็มและ Sector อัตโนมัติจากอินเทอร์เน็ต (Yahoo Finance API)
async function fetchCompanyProfileFromInternet(ticker) {
  const defaultResult = { name: '', sector: 'Other' };
  try {
    // ใช้ Endpoint สากลของ Yahoo Finance ในการดึงข้อมูล Asset Profile
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=assetProfile,price`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    
    if (!response.ok) return defaultResult;
    
    const data = await response.json();
    const result = data.quoteSummary?.result?.[0];
    
    if (!result) return defaultResult;
    
    // ดึงข้อมูล Sector และ ชื่อบริษัทจริงจากโครงสร้าง JSON
    const sector = result.assetProfile?.sector || 'Other';
    const name = result.price?.longName || result.price?.shortName || '';
    
    return { name, sector };
  } catch (e) {
    console.error(`Failed to fetch live profile for ${ticker}:`, e);
    return defaultResult;
  }
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM holdings WHERE user_id = $1 ORDER BY ticker',
      [req.userId]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { ticker, name, shares, avg_cost, currency } = req.body
  const sanitizedTicker = ticker ? ticker.toUpperCase().replace(/\./g, '-') : ticker

  // 🌟 เงื่อนไขอัปเกรด: ค้นหาข้อมูลชื่อบริษัทและ Sector สดๆ จากอินเทอร์เน็ตโดยตรง
  const profile = await fetchCompanyProfileFromInternet(sanitizedTicker);
  const finalName = name || profile.name || sanitizedTicker;
  const finalSector = profile.sector || 'Other';

  try {
    const result = await pool.query(
      `INSERT INTO holdings (user_id, ticker, name, shares, avg_cost, sector, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.userId, sanitizedTicker, finalName, shares, avg_cost, finalSector, currency || 'USD']
    )
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  const { ticker, name, shares, avg_cost, currency } = req.body
  const sanitizedTicker = ticker ? ticker.toUpperCase().replace(/\./g, '-') : ticker

  // 🌟 ดึงข้อมูลจากอินเทอร์เน็ตมาเช็กกรณีการอัปเดตข้อมูลหุ้น
  const profile = await fetchCompanyProfileFromInternet(sanitizedTicker);
  const finalName = name || profile.name || sanitizedTicker;
  const finalSector = profile.sector || 'Other';

  try {
    const result = await pool.query(
      `UPDATE holdings SET ticker=$1, name=$2, shares=$3, avg_cost=$4, sector=$5, currency=$6, updated_at=NOW()
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [sanitizedTicker, finalName, shares, avg_cost, finalSector, currency || 'USD', req.params.id, req.userId]
    )
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM holdings WHERE id=$1 AND user_id=$2', [req.params.id, req.userId])
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
