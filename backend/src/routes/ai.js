import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import pool from '../db/index.js'

const router = express.Router()
router.use(authMiddleware)

async function callClaude(systemPrompt, userMessage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.content[0].text
}

// วิเคราะห์พอร์ตและแนะนำ rebalancing
router.post('/analyze', async (req, res) => {
  try {
    const { holdings, prices, displayCurrency, fxRate } = req.body
    if (!holdings?.length) return res.status(400).json({ error: 'ไม่มี holdings' })

    const portfolioData = holdings.map(h => {
      const price = prices[h.ticker] || h.avg_cost
      const value = h.shares * price
      const valueDisplay = displayCurrency === 'THB'
        ? (h.currency === 'THB' ? value : value * fxRate)
        : (h.currency === 'THB' ? value / fxRate : value)
      const cost = h.shares * h.avg_cost
      const costDisplay = displayCurrency === 'THB'
        ? (h.currency === 'THB' ? cost : cost * fxRate)
        : (h.currency === 'THB' ? cost / fxRate : cost)
      const pnlPct = costDisplay > 0 ? ((valueDisplay - costDisplay) / costDisplay) * 100 : 0
      const dayChg = prices[`${h.ticker}_chg`] || 0
      return {
        ticker: h.ticker,
        name: h.name || h.ticker,
        sector: h.sector || 'Unknown',
        shares: h.shares,
        avgCost: h.avg_cost,
        currentPrice: price,
        currency: h.currency,
        value: valueDisplay,
        pnlPct: pnlPct.toFixed(2),
        dayChange: dayChg.toFixed(2)
      }
    })

    const totalValue = portfolioData.reduce((s, h) => s + h.value, 0)
    const portfolioWithPct = portfolioData.map(h => ({
      ...h,
      allocation: ((h.value / totalValue) * 100).toFixed(1)
    }))

    const sectorMap = {}
    portfolioWithPct.forEach(h => {
      sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.value
    })
    const sectorAlloc = Object.entries(sectorMap)
      .map(([s, v]) => ({ sector: s, pct: ((v / totalValue) * 100).toFixed(1) }))
      .sort((a, b) => b.pct - a.pct)

    const systemPrompt = `คุณคือที่ปรึกษาการลงทุนผู้เชี่ยวชาญที่วิเคราะห์พอร์ตการลงทุนแบบ Value Investing
ตอบเป็นภาษาไทย กระชับ ตรงประเด็น ใช้ข้อมูลที่ให้มาเท่านั้น
ห้ามแนะนำให้ซื้อหรือขายหุ้นที่ไม่ได้อยู่ในพอร์ต
จัดรูปแบบด้วย JSON ตามที่กำหนดเท่านั้น ห้ามมีข้อความนอก JSON`

    const userMessage = `วิเคราะห์พอร์ตนี้และตอบด้วย JSON ตามรูปแบบที่กำหนด:

พอร์ตการลงทุน (${displayCurrency}):
${JSON.stringify(portfolioWithPct, null, 2)}

การกระจาย Sector:
${JSON.stringify(sectorAlloc, null, 2)}

มูลค่ารวม: ${totalValue.toFixed(2)} ${displayCurrency}

ตอบในรูปแบบ JSON นี้เท่านั้น:
{
  "summary": "สรุปภาพรวมพอร์ต 2-3 ประโยค",
  "score": 7,
  "scoreReason": "เหตุผลคะแนน 1 ประโยค",
  "strengths": ["จุดแข็ง 1", "จุดแข็ง 2"],
  "risks": ["ความเสี่ยง 1", "ความเสี่ยง 2"],
  "recommendations": [
    {
      "type": "rebalance/hold/reduce",
      "ticker": "TICKER",
      "action": "คำแนะนำสั้นๆ",
      "reason": "เหตุผล"
    }
  ],
  "rebalanceSuggestion": "คำแนะนำ rebalance ภาพรวม 2-3 ประโยค"
}`

    const text = await callClaude(systemPrompt, userMessage)
    const clean = text.replace(/```json|```/g, '').trim()
    const analysis = JSON.parse(clean)
    res.json(analysis)
  } catch (err) {
    console.error('AI analyze error:', err)
    res.status(500).json({ error: err.message })
  }
})

// สรุปข่าวกระทบพอร์ต
router.post('/news-summary', async (req, res) => {
  try {
    const { holdings, news } = req.body
    if (!holdings?.length || !news?.length) {
      return res.json({ summary: 'ไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์' })
    }

    const tickers = holdings.map(h => h.ticker).join(', ')
    const newsText = news.slice(0, 8).map((n, i) => `${i+1}. ${n.title}`).join('\n')

    const systemPrompt = `คุณคือนักวิเคราะห์การลงทุนที่สรุปข่าวและผลกระทบต่อพอร์ต
ตอบเป็นภาษาไทย กระชับ อ่านง่าย ตรงประเด็น
จัดรูปแบบด้วย JSON เท่านั้น`

    const userMessage = `พอร์ตของ user ประกอบด้วย: ${tickers}

ข่าวล่าสุด:
${newsText}

ตอบด้วย JSON นี้เท่านั้น:
{
  "impact": "positive/negative/neutral",
  "summary": "สรุปผลกระทบต่อพอร์ต 2-3 ประโยค",
  "highlights": ["ประเด็นสำคัญ 1", "ประเด็นสำคัญ 2", "ประเด็นสำคัญ 3"],
  "watchOut": "สิ่งที่ควรระวัง 1 ประโยค"
}`

    const text = await callClaude(systemPrompt, userMessage)
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)
    res.json(result)
  } catch (err) {
    console.error('News summary error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
