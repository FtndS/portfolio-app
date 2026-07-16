import express from 'express'
import { serverError } from '../lib/httpErrors.js'
import { authMiddleware } from '../middleware/auth.js'
import { aiLimiter } from '../middleware/rateLimit.js'
import { requireAiQuota } from '../middleware/aiQuota.js'
import {
  AI_FEATURES,
  getAiQuota,
  getFeatureQuota,
  quotaExceededMessage,
  reserveAiQuota,
} from '../lib/aiQuota.js'
import { getPlanConfigForUser } from '../lib/aiPlan.js'
import { buildAnalyzePayload } from '../lib/aiAnalyzeContext.js'
import { buildCopilotContext, resolveCopilotQuestion } from '../lib/aiCopilotContext.js'
import {
  applyAiTripPlan,
  buildTripPlanSystemPrompt,
  enrichPlanPlaces,
  normalizeAiPlanResponse,
  normalizeAiTripPlanMessages,
} from '../lib/aiTripPlan.js'
import pool from '../db/index.js'

const router = express.Router()
router.use(authMiddleware)
router.use(aiLimiter)

router.get('/quota', async (req, res) => {
  try {
    const quota = await getAiQuota(
      req.userId,
      req.userEmail,
      req.userRole,
      req.userPlan,
      req.userPlanExpiresAt
    )
    res.json(quota)
  } catch (err) {
    console.error('AI quota fetch error:', err)
    serverError(res, err)
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
  return callClaudeMessages(systemPrompt, [{ role: 'user', content: userMessage }], maxTokens)
}

async function callClaudeMessages(systemPrompt, messages, maxTokens = 4096) {
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
      messages: messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    }),
    signal: AbortSignal.timeout(180_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error?.message || `AI request failed (${res.status})`)
  }
  if (data.error) throw new Error(data.error.message)
  if (!data.content?.[0]?.text) throw new Error('Empty response from AI')
  return data.content[0].text
}

const compactJson = (value) => JSON.stringify(value)

// Copilot Lite — คำถามสั้นๆ จากข้อมูลพอร์ต (context กระชับ ไม่ใช่แชทยาว)
router.post('/copilot', requireAiQuota(AI_FEATURES.COPILOT), async (req, res) => {
  try {
    const {
      holdings,
      prices,
      displayCurrency,
      fxRate,
      transactions = [],
      journal = [],
      inSectorNews = [],
      preset,
      question,
    } = req.body
    if (!holdings?.length) return res.status(400).json({ error: 'ไม่มี holdings' })

    const planConfig = getPlanConfigForUser(
      req.userRole,
      req.userEmail,
      req.userPlan,
      req.userPlanExpiresAt
    )
    const resolved = resolveCopilotQuestion(preset, question, planConfig)
    if (resolved.error) {
      return res.status(403).json({ error: resolved.error, code: 'COPILOT_CUSTOM_PRO_ONLY' })
    }

    const { context, dataScope } = buildCopilotContext({
      holdings,
      prices,
      displayCurrency,
      fxRate,
      transactions,
      journal,
      planConfig,
    })

    const relevantNews = (Array.isArray(inSectorNews) ? inSectorNews : [])
      .slice(0, planConfig.copilot.maxNews || 8)
      .map((n) => ({
        title: String(n?.title || '').trim(),
        source: String(n?.source?.name || n?.source || 'Unknown'),
        publishedAt: String(n?.publishedAt || ''),
        url: String(n?.url || ''),
      }))
      .filter((n) => n.title)

    const systemPrompt = `คุณคือ Copilot ผู้ช่วยนักลงทุนระยะยาวของ PortDiary
ตอบเป็นภาษาไทย กระชับ อ่านง่าย ใช้ bullet ได้ถ้าเหมาะสม
อ้างอิงเฉพาะข้อมูลพอร์ตและข่าวที่ให้ — ห้ามแต่งตัวเลข/ข่าว/เหตุการณ์
ถ้าคำถามเกี่ยวกับ "ทำไมราคาขึ้น/ลง" ให้เน้นเหตุผลเชิงเหตุการณ์จากข่าวล่าสุดก่อนทฤษฎีทั่วไป
ถ้ามีข่าวรองรับ ให้ยก headline สั้นๆ พร้อมแหล่งข่าว/เวลา
ถ้าข่าวที่ให้ยังไม่พอหรือไม่เจอเหตุผลชัด ให้บอกตรงๆ ว่า "ยังไม่พบหลักฐานข่าวที่ยืนยัน"
รูปแบบที่ต้องการ:
1) เหตุผลที่เป็นไปได้ (เฉพาะที่มีหลักฐานข่าว)
2) หลักฐานข่าว (bullet: หัวข้อ | แหล่งข่าว | เวลา)
3) ระดับความมั่นใจ: สูง/กลาง/ต่ำ
ไม่ใช่คำแนะนำซื้อขาย — ช่วยทบทวนและสรุปเท่านั้น
ตอบ plain text ไม่ใช่ JSON ไม่เกิน ${Math.floor(planConfig.copilot.maxTokens / 3)} คำโดยประมาณ`

    const userMessage = `${context}

ข่าวล่าสุดที่เกี่ยวข้องจากอินเทอร์เน็ต:
${compactJson(relevantNews)}

คำถาม: ${resolved.question}`

    const text = await callClaude(systemPrompt, userMessage, planConfig.copilot.maxTokens)
    res.json({
      answer: text.trim(),
      preset: resolved.preset,
      newsUsed: relevantNews,
      dataScope: {
        ...dataScope,
        internetNewsIncluded: relevantNews.length,
      },
    })
  } catch (err) {
    console.error('AI copilot error:', err)
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({ error: 'AI ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง', code: 'AI_TIMEOUT' })
    }
    serverError(res, err)
  }
})

// วิเคราะห์พอร์ตและแนะนำ rebalancing (รวม transaction + journal)
router.post('/analyze', requireAiQuota(AI_FEATURES.ANALYZE), async (req, res) => {
  try {
    const { holdings, prices, displayCurrency, fxRate, transactions = [], journal = [] } = req.body
    if (!holdings?.length) return res.status(400).json({ error: 'ไม่มี holdings' })

    const planConfig = getPlanConfigForUser(
      req.userRole,
      req.userEmail,
      req.userPlan,
      req.userPlanExpiresAt
    )
    const {
      portfolioWithPct,
      sectorAlloc,
      totalValue,
      txSummary,
      journalSummary,
      dataScope,
    } = buildAnalyzePayload({
      holdings,
      prices,
      displayCurrency,
      fxRate,
      transactions,
      journal,
      planConfig,
    })

    const maxRec = planConfig.analyze.maxRecommendations
    const maxLen = planConfig.analyze.maxStringLen
    const maxTokens = planConfig.analyze.maxTokens

    const systemPrompt = `คุณคือที่ปรึกษาการลงทุนผู้เชี่ยวชาญที่วิเคราะห์พอร์ตแบบ Value Investing และพฤติกรรมการซื้อขายจริงของนักลงทุน
ตอบเป็นภาษาไทย ละเอียดพอสมควร ตรงประเด็น ใช้ข้อมูลที่ให้มาเท่านั้น
ห้ามแนะนำให้ซื้อหรือขายหุ้นที่ไม่ได้อยู่ในพอร์ต
ถ้ามี transaction บ่อยหรือซื้อขายวน ให้ช่วยชี้ว่าอาจทำให้หาจุดทำกำไรยาก และควรทบทวนอะไร
ถ้ามี journal ให้เชื่อมโยงกับพฤติกรรมซื้อขายจริงว่าสอดคล้องกับ thesis หรือไม่
ตอบด้วย valid JSON เท่านั้น ห้ามมี markdown หรือข้อความนอก JSON
แต่ละ string ไม่เกิน ${maxLen} ตัวอักษร recommendations ไม่เกิน ${maxRec} รายการ actionPlan ไม่เกิน 4 ข้อ`

    const userMessage = `วิเคราะห์พอร์ตนี้อย่างละเอียดและตอบด้วย JSON ตามรูปแบบที่กำหนด:

พอร์ตการลงทุน (${displayCurrency}):
${compactJson(portfolioWithPct)}

การกระจาย Sector:
${compactJson(sectorAlloc)}

มูลค่ารวม: ${totalValue.toFixed(2)} ${displayCurrency}

สถิติ Transaction (ซื้อ/ขาย):
${compactJson(txSummary.stats)}

สรุปรายหุ้นจาก Transaction:
${compactJson(txSummary.byTicker)}

Transaction ล่าสุด (${txSummary.recent.length} รายการ):
${compactJson(txSummary.recent)}

Journal (${journalSummary.entries.length} รายการล่าสุด จากทั้งหมด ${journalSummary.stats.total}):
${compactJson(journalSummary.entries)}

ขอบเขตข้อมูลที่ส่ง (แผน ${dataScope.plan}): ${compactJson(dataScope)}

ตอบในรูปแบบ JSON นี้เท่านั้น:
{
  "summary": "สรุปภาพรวมพอร์ต 3-4 ประโยค",
  "score": 7,
  "scoreReason": "เหตุผลคะแนน 1-2 ประโยค",
  "strengths": ["จุดแข็ง 1", "จุดแข็ง 2", "จุดแข็ง 3"],
  "risks": ["ความเสี่ยง 1", "ความเสี่ยง 2", "ความเสี่ยง 3"],
  "tradingPattern": {
    "summary": "สรุปพฤติกรรมซื้อขายจาก transaction",
    "profitabilityNote": "ช่วยชี้จุดทำกำไร/ขาดทุนที่เห็นจากประวัติ หรือว่าซื้อขายบ่อยจนติดตามยาก",
    "frequencyWarning": "คำเตือนถ้าซื้อขายบ่อย หรือ null ถ้าไม่มี"
  },
  "journalInsights": {
    "summary": "สรุปจาก journal ที่ให้มา",
    "thesisAlignment": "thesis/ความคิดใน journal สอดคล้องกับการซื้อขายจริงหรือไม่",
    "gaps": ["สิ่งที่ควรจดบันทึกหรือทบทวนเพิ่ม 1", "2"]
  },
  "recommendations": [
    {
      "type": "rebalance/hold/reduce/review",
      "ticker": "TICKER",
      "action": "คำแนะนำที่ทำได้จริง",
      "reason": "เหตุผลจากข้อมูล holdings/transaction/journal"
    }
  ],
  "rebalanceSuggestion": "คำแนะนำ rebalance ภาพรวม 2-4 ประโยค",
  "actionPlan": ["ขั้นตอนทบทวนที่แนะนำ 1", "2", "3"]
}`

    const text = await callClaude(systemPrompt, userMessage, maxTokens)
    const analysis = parseClaudeJson(text)
    res.json({ ...analysis, dataScope })
  } catch (err) {
    console.error('AI analyze error:', err)
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({ error: 'AI ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง', code: 'AI_TIMEOUT' })
    }
    serverError(res, err)
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
    res.json(result)
  } catch (err) {
    console.error('News summary error:', err)
    serverError(res, err)
  }
})

router.post('/ticker-journal', async (req, res) => {
  try {
    const { ticker, thesis = {}, journal = [] } = req.body
    if (!ticker) return res.status(400).json({ error: 'ต้องระบุ ticker' })
    if (!journal.length && !thesis.thesis) {
      return res.json({ summary: 'ยังไม่มี journal หรือ thesis สำหรับหุ้นนี้ — ลองเขียนเหตุผลถือหุ้นก่อน' })
    }

    const status = await reserveAiQuota(
      req.userId,
      req.userEmail,
      AI_FEATURES.TICKER_JOURNAL,
      req.userRole,
      req.userPlan,
      req.userPlanExpiresAt
    )
    if (!status.allowed) {
      return res.status(429).json({
        error: quotaExceededMessage(AI_FEATURES.TICKER_JOURNAL, status.nextAvailableAt, { limit: status.limit }),
        code: 'AI_QUOTA_EXCEEDED',
        feature: AI_FEATURES.TICKER_JOURNAL,
        nextAvailableAt: status.nextAvailableAt,
      })
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
    serverError(res, err)
  }
})

// AI Trip Planner — clarify หรือสร้างแผน (นับโควต้าเมื่อ apply สำเร็จเท่านั้น)
router.post('/trip-plan', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า AI' })
    }

    const apply = !!req.body?.apply
    const messages = normalizeAiTripPlanMessages(req.body?.messages)
    if (!messages.length) {
      return res.status(400).json({ error: 'กรุณาพิมพ์ข้อความอย่างน้อยหนึ่งข้อความ' })
    }

    const planConfig = getPlanConfigForUser(
      req.userRole,
      req.userEmail,
      req.userPlan,
      req.userPlanExpiresAt
    )

    if (apply) {
      const status = await getFeatureQuota(
        req.userId,
        req.userEmail,
        AI_FEATURES.TRIP_PLAN,
        req.userRole,
        req.userPlan,
        req.userPlanExpiresAt
      )
      if (!status.allowed) {
        return res.status(429).json({
          error: quotaExceededMessage(AI_FEATURES.TRIP_PLAN, status.nextAvailableAt, { limit: status.limit }),
          code: 'AI_QUOTA_EXCEEDED',
          feature: AI_FEATURES.TRIP_PLAN,
          nextAvailableAt: status.nextAvailableAt,
        })
      }
    }

    const text = await callClaudeMessages(
      buildTripPlanSystemPrompt(),
      messages,
      planConfig.tripPlan?.maxTokens || 4096
    )
    const parsedRaw = parseClaudeJson(text)
    const normalized = normalizeAiPlanResponse(parsedRaw)
    if (normalized.error) {
      return res.status(502).json({ error: normalized.error || 'AI ตอบไม่ถูกต้อง' })
    }

    if (normalized.status === 'clarify') {
      return res.json({
        status: 'clarify',
        questions: normalized.questions,
      })
    }

    if (!apply) {
      return res.json({
        status: 'plan',
        trip: {
          title: normalized.trip.title,
          destination: normalized.trip.destination,
          start_date: normalized.trip.start_date,
          end_date: normalized.trip.end_date,
          notes: normalized.trip.notes,
          days: normalized.trip.days,
        },
      })
    }

    const enriched = await enrichPlanPlaces(normalized, {
      maxEnrich: planConfig.tripPlan?.maxEnrich || 8,
    })

    const reserved = await reserveAiQuota(
      req.userId,
      req.userEmail,
      AI_FEATURES.TRIP_PLAN,
      req.userRole,
      req.userPlan,
      req.userPlanExpiresAt
    )
    if (!reserved.allowed) {
      return res.status(429).json({
        error: quotaExceededMessage(AI_FEATURES.TRIP_PLAN, reserved.nextAvailableAt, { limit: reserved.limit }),
        code: 'AI_QUOTA_EXCEEDED',
        feature: AI_FEATURES.TRIP_PLAN,
        nextAvailableAt: reserved.nextAvailableAt,
      })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const created = await applyAiTripPlan(client, req.userId, enriched)
      await client.query('COMMIT')
      res.json({
        status: 'created',
        trip_id: created.id,
        trip: created,
      })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('AI trip-plan error:', err)
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({ error: 'AI ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง', code: 'AI_TIMEOUT' })
    }
    serverError(res, err)
  }
})

export default router
