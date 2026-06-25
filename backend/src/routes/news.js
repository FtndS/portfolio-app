import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
router.use(authMiddleware)

// ฟังก์ชันช่วยดึงข้อมูลแบบถึกทน ไม่พึ่งพาคีย์ภายนอก ป้องกัน IP VPS โดนบล็อก
async function fetchRSSAsJson(url) {
  try {
    const res = await fetch(url)
    const text = await res.text()
    
    // ดึงข้อมูลพาดหัวข่าวแบบง่ายๆ จากโครงสร้าง XML RSS ของ Yahoo Finance
    const items = []
    const matches = text.matchAll(/<item>([\s\S]*?)<\/item>/g)
    
    for (const m of matches) {
      const itemText = m[1]
      const title = itemText.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''
      const link = itemText.match(/<link>([\s\S]*?)<\/link>/)?.[1] || ''
      const pubDate = itemText.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || ''
      const source = itemText.match(/<source[\s\S]*?>([\s\S]*?)<\/source>/)?.[1] || 'Yahoo Finance'
      
      if (title && link) {
        items.push({
          title: title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
          url: link.trim(),
          publishedAt: pubDate,
          source: { name: source }
        })
      }
    }
    return items
  } catch (e) {
    console.error('RSS Fetch Error:', e)
    return []
  }
}

// 1. ดึงข้อมูลข่าวสารหน้าแรก แยก 2 ช่อง
router.get('/dashboard', async (req, res) => {
  try {
    // ดึง Sector ของผู้ใช้
    const holdRes = await pool.query(
      'SELECT DISTINCT sector, ticker FROM holdings WHERE user_id = $1 AND sector IS NOT NULL AND sector != \'\'', 
      [req.userId]
    )
    const mySectors = holdRes.rows.map(r => r.sector)
    const myTickers = holdRes.rows.map(r => r.ticker)

    // ดึงข่าวเศรษฐกิจภาพรวมตลาดจาก Yahoo Finance RSS (ปลอดภัยจากการล็อก IP 100%)
    const articles = await fetchRSSAsJson('https://finance.yahoo.com/news/rssindex')

    let inSectorNews = []
    let outSectorNews = []

    if (articles.length > 0) {
      articles.forEach(a => {
        const text = `${a.title}`.toLowerCase()
        
        // ตรวจสอบว่าข่าวตรงกับสัญลักษณ์หุ้นที่เราถือ หรือคำสำคัญของ Sector หรือไม่
        const matchesPortfolio = myTickers.some(t => text.includes(t.toLowerCase())) || 
          mySectors.some(s => {
            const lowerS = s.toLowerCase()
            if (lowerS === 'finance') return text.includes('bank') || text.includes('fed') || text.includes('finance') || text.includes('market') || text.includes('rate') || text.includes('inflation')
            if (lowerS === 'technology') return text.includes('tech') || text.includes('ai') || text.includes('chip') || text.includes('nvidia') || text.includes('apple') || text.includes('google') || text.includes('microsoft')
            if (lowerS === 'healthcare') return text.includes('health') || text.includes('drug') || text.includes('medical') || text.includes('pharma') || text.includes('lly')
            return text.includes(lowerS)
          })

        if (matchesPortfolio) {
          inSectorNews.push(a)
        } else {
          outSectorNews.push(a)
        }
      })
    }

    // ป้องกันหน้าแรกว่างเปล่า หากฝั่งใดฝั่งหนึ่งไม่มีข่าว ให้แชร์ข้อมูลร่วมกัน
    if (inSectorNews.length === 0 && outSectorNews.length > 0) {
      inSectorNews = outSectorNews.slice(0, 6)
    }

    res.json({
      mySectors,
      inSectorNews: inSectorNews.slice(0, 15),
      outSectorNews: outSectorNews.slice(0, 15)
    })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 2. ข่าวสารเจาะลึกรายหุ้นรายตัวเมื่อกดคลิกที่ชื่อหุ้น (เช่น NVDA, BRK-B)
router.get('/ticker/:symbol', async (req, res) => {
  let { symbol } = req.params
  // แปลงกลับเป็นฟอร์แมตขีดกลางเพื่อส่งไปหา Yahoo RSS
  const searchSymbol = symbol.replace('.', '-')
  
  try {
    const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${searchSymbol}`
    const articles = await fetchRSSAsJson(url)
    res.json(articles)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
