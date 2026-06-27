import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { aiLimiter } from '../middleware/rateLimit.js'
import { requireAiQuota } from '../middleware/aiQuota.js'
import {
  AI_FEATURES,
  getAiQuota,
  recordAiUsage,
} from '../lib/aiQuota.js'

const router = express.Router()
router.use(authMiddleware)
router.use(aiLimiter)

router.get('/quota', async (req, res) => {
  try {
    const quota = await getAiQuota(req.userId, req.userEmail)
    res.json(quota)
  } catch (err) {
    console.error('AI quota fetch error:', err)
    res.status(500).json({ error: err.message })
  }
})

function parseClaudeJson(text) {
  let raw = text.replace(/^```(?:json)?\s*\n?|\n?```\s*$/gm, '').trim()
  const start = raw.indexOf('{')
  if (start === -1) throw new Error('No JSON found in AI response')
  raw = raw.slice(start)
  const end = raw.lastIndexOf('}')
  if (end !== -1) raw = raw.slice(0, end + 1)

  const fixCommas = (s) => s.replace(/,\s*([}\]])/g, '$1')

  const tryParse = (s) => JSON.parse(fixCommas(s))

  try {
    return tryParse(raw)
  } catch (firstErr) {
    // Response was likely truncated mid-stream — strip incomplete tail and close brackets
    let fixed = raw
      .replace(/,\s*"[^"]*"?\s*:?\s*"[^"\\]*(?:\\.[^"\\]*)*$/, '')
      .replace(/,\s*\{[^}]*$/, '')
      .replace(/,\s*"[^"\\]*(?:\\.[^"\\]*)*$/, '')
      .replace(/,\s*$/, '')

    const openBrackets = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length
    const openBraces = (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length
    fixed += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces))

    try {
      return tryParse(fixed)
    } catch {
      throw firstErr
    }
  }
}

async function callClaude(systemPrompt, userMessage, maxTokens = 4096) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  if (!data.content?.[0]?.text) throw new Error('Empty response from AI')
  return data.content[0].text
}

// วิเคราะห์พอร์ตและแนะนำ rebalancing
router.post('/analyze', requireAiQuota(AI_FEATURES.ANALYZE), async (req, res) => {
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
ตอบด้วย valid JSON เท่านั้น ห้ามมี markdown หรือข้อความนอก JSON
แต่ละ string ไม่เกิน 120 ตัวอักษร recommendations ไม่เกิน 5 รายการ`

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
    const analysis = parseClaudeJson(text)
    await recordAiUsage(req.userId, AI_FEATURES.ANALYZE)
    res.json(analysis)
  } catch (err) {
    console.error('AI analyze error:', err)
    res.status(500).json({ error: err.message })
  }
})

// สรุปข่าวกระทบพอร์ต
router.post('/news-summary', requireAiQuota(AI_FEATURES.NEWS_SUMMARY), async (req, res) => {
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

    const text = await callClaude(systemPrompt, userMessage, 2048)
    const result = parseClaudeJson(text)
    await recordAiUsage(req.userId, AI_FEATURES.NEWS_SUMMARY)
    res.json(result)
  } catch (err) {
    console.error('News summary error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/ticker-journal', async (req, res) => {
  try {
    const { ticker, thesis = {}, journal = [] } = req.body
    if (!ticker) return res.status(400).json({ error: 'ต้องระบุ ticker' })
    if (!journal.length && !thesis.thesis) {
      return res.json({ summary: 'ยังไม่มี journal หรือ thesis สำหรับหุ้นนี้ — ลองเขียนเหตุผลถือหุ้นก่อน' })
    }

    const journalText = journal.slice(0, 12).map((j, i) => {
      const d = j.date?.split?.('T')?.[0] || j.date || ''
      return `${i + 1}. [${d}] ${j.title || '—'} (${j.tag || 'ไม่มี tag'}): ${String(j.content || '').slice(0, 400)}`
    }).join('\n')

    const systemPrompt = `คุณคือผู้ช่วยนักลงทุนระยะยาวที่สรุปบันทึกส่วนตัว
ตอบเป็นภาษาไทย กระชับ 2-4 ประโยค อ้างอิงเฉพาะข้อมูลที่ให้
ไม่ใช่คำแนะนำซื้อขาย — เป็นการช่วยทบทวนความคิดของ user เท่านั้น
ตอบ plain text ไม่ใช่ JSON`

    const userMessage = `หุ้น: ${ticker}

Thesis (เหตุผลถือ):
${thesis.thesis || '— ยังไม่ได้บันทึก'}

เงื่อนไขเปลี่ยนใจ:
${thesis.invalidation || '—'}

ระยะเวลาที่ตั้งใจถือ: ${thesis.horizon || '—'}

Journal ที่เกี่ยวข้อง:
${journalText || '— ไม่มี'}

สรุปให้ user ทบทวน: เขาเคยคิดอะไร thesis กับ journal สอดคล้องกันไหม มีอะไรที่ควรจดจำหรือทบทวน`

    const text = await callClaude(systemPrompt, userMessage, 1024)
    res.json({ summary: text.trim() })
  } catch (err) {
    console.error('Ticker journal summary error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
