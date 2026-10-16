/**
 * Prompt + response shape for POST /api/ai/analyze ("AI วิเคราะห์พอร์ต").
 *
 * PortDiary is not an investment adviser (terms ข้อ 1-2). The analysis is a
 * review aid for the user's own records: it describes the portfolio and raises
 * questions to review. It must not score the portfolio or tell the user to
 * buy, sell, hold, or resize any position.
 */

const compactJson = (value) => JSON.stringify(value)

/** Fields the client may receive. Anything else Claude returns is dropped. */
export const ANALYZE_RESPONSE_FIELDS = [
  'summary',
  'composition',
  'observations',
  'riskNotes',
  'tradingPattern',
  'journalInsights',
  'reviewPoints',
  'reviewSteps',
]

export const REVIEW_TOPICS = ['sector', 'concentration', 'currency', 'trading', 'journal', 'other']

/** Share of portfolio value per holding currency (THB ≈ Thai market, USD ≈ US market). */
export function currencyAllocation(portfolioWithPct, totalValue) {
  const map = {}
  for (const h of portfolioWithPct) {
    const ccy = h.currency || 'Unknown'
    map[ccy] = (map[ccy] || 0) + (Number(h.value) || 0)
  }
  return Object.entries(map).map(([currency, value]) => ({
    currency,
    pct: totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0',
  }))
}

export function buildAnalyzeSystemPrompt({ maxLen, maxRec }) {
  return `คุณคือผู้ช่วยทบทวนพอร์ตและบันทึกการลงทุนของ PortDiary เพื่อการศึกษา ผลลัพธ์ไม่ใช่คำแนะนำการลงทุน
หน้าที่: สรุปข้อเท็จจริงจากข้อมูลพอร์ต ประวัติซื้อขาย และ journal ที่ user บันทึกเอง แล้วตั้งประเด็นให้ user ทบทวนด้วยตัวเอง
ตอบเป็นภาษาไทย ตรงประเด็น ใช้ข้อมูลที่ให้มาเท่านั้น ห้ามแต่งตัวเลขหรือเหตุการณ์
ข้อห้าม:
- ห้ามบอกให้ซื้อ ขาย ถือต่อ เพิ่ม หรือลดสัดส่วนหุ้นตัวใด และห้ามพูดถึงหุ้นที่ไม่อยู่ในพอร์ต
- ห้ามให้คะแนน จัดอันดับ หรือตัดสินว่าพอร์ตหรือหุ้นตัวใดดีหรือแย่
- ห้ามเสนอสัดส่วนเป้าหมายหรือแผนปรับพอร์ต
- ประเด็นทบทวนให้เขียนเป็นข้อสังเกตจากข้อมูลและคำถามปลายเปิด เช่น "สัดส่วนหมวด X อยู่ที่ 60% ตั้งใจไว้แบบนี้หรือไม่" ไม่ใช่ "ควรลดหมวด X"
ถ้ามี transaction บ่อยหรือซื้อขายวน ให้ชี้ข้อเท็จจริงนั้นและตั้งคำถามว่าสอดคล้องกับแผนของ user หรือไม่
ถ้ามี journal ให้เทียบว่าเหตุผลที่บันทึกไว้สอดคล้องกับการซื้อขายจริงหรือไม่
ตอบด้วย valid JSON เท่านั้น ห้ามมี markdown หรือข้อความนอก JSON
แต่ละ string ไม่เกิน ${maxLen} ตัวอักษร reviewPoints ไม่เกิน ${maxRec} รายการ reviewSteps ไม่เกิน 4 ข้อ`
}

export function buildAnalyzeUserMessage({
  displayCurrency,
  portfolioWithPct,
  sectorAlloc,
  totalValue,
  txSummary,
  journalSummary,
  dataScope,
}) {
  return `สรุปข้อเท็จจริงของพอร์ตนี้และตั้งประเด็นให้ทบทวน ตอบด้วย JSON ตามรูปแบบที่กำหนด:

พอร์ตการลงทุน (${displayCurrency}):
${compactJson(portfolioWithPct)}

การกระจาย Sector:
${compactJson(sectorAlloc)}

การกระจายตามสกุลเงิน:
${compactJson(currencyAllocation(portfolioWithPct, totalValue))}

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
  "summary": "สรุปข้อเท็จจริงของพอร์ต 3-4 ประโยค (จำนวนหุ้น มูลค่า การกระจาย) ไม่ตัดสินว่าดีหรือแย่",
  "composition": {
    "sector": "การกระจายตามหมวด 1-2 ประโยค พร้อมตัวเลข",
    "currency": "การกระจายตามสกุลเงิน/ตลาด 1-2 ประโยค พร้อมตัวเลข",
    "concentration": "สัดส่วนหุ้นตัวใหญ่สุด 1-3 ตัว พร้อมตัวเลข"
  },
  "observations": ["ข้อสังเกตจากข้อมูล 1", "2", "3"],
  "riskNotes": ["ลักษณะที่ทำให้พอร์ตผันผวนตามปัจจัยเดียว เช่น กระจุกหมวด/สกุลเงิน พร้อมตัวเลข 1", "2"],
  "tradingPattern": {
    "summary": "สรุปพฤติกรรมซื้อขายจาก transaction",
    "realizedNote": "สิ่งที่เห็นจากประวัติ เช่น ขายแล้วกำไร/ขาดทุนกี่ครั้ง หรือซื้อขายบ่อยจนติดตามยาก",
    "frequencyWarning": "ข้อสังเกตถ้าซื้อขายบ่อยหรือวน หรือ null ถ้าไม่มี"
  },
  "journalInsights": {
    "summary": "สรุปจาก journal ที่ให้มา",
    "thesisAlignment": "เหตุผลใน journal สอดคล้องกับการซื้อขายจริงหรือไม่",
    "gaps": ["สิ่งที่ยังไม่ได้บันทึกและอาจช่วยให้ทบทวนง่ายขึ้น 1", "2"]
  },
  "reviewPoints": [
    {
      "topic": "${REVIEW_TOPICS.join('/')}",
      "ticker": "TICKER หรือ null ถ้าเป็นประเด็นทั้งพอร์ต",
      "observation": "ข้อเท็จจริงที่เห็นจากข้อมูล พร้อมตัวเลข",
      "question": "คำถามให้ user ทบทวนเอง"
    }
  ],
  "reviewSteps": ["ขั้นตอนทบทวนบันทึกของตัวเอง เช่น เขียนเหตุผลถือของหุ้นที่ยังไม่มี thesis 1", "2", "3"]
}`
}

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const strList = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])

/**
 * Keep only the review-shaped fields. Drops anything advisory Claude might
 * still emit (score, recommendations, rebalanceSuggestion, …).
 */
export function sanitizeAnalysis(raw, { maxRec = 8 } = {}) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const out = {}

  out.summary = str(src.summary) || ''

  const c = src.composition && typeof src.composition === 'object' ? src.composition : {}
  out.composition = {
    sector: str(c.sector),
    currency: str(c.currency),
    concentration: str(c.concentration),
  }

  out.observations = strList(src.observations)
  out.riskNotes = strList(src.riskNotes)

  if (src.tradingPattern && typeof src.tradingPattern === 'object') {
    out.tradingPattern = {
      summary: str(src.tradingPattern.summary),
      realizedNote: str(src.tradingPattern.realizedNote),
      frequencyWarning: str(src.tradingPattern.frequencyWarning),
    }
  } else {
    out.tradingPattern = null
  }

  if (src.journalInsights && typeof src.journalInsights === 'object') {
    out.journalInsights = {
      summary: str(src.journalInsights.summary),
      thesisAlignment: str(src.journalInsights.thesisAlignment),
      gaps: strList(src.journalInsights.gaps),
    }
  } else {
    out.journalInsights = null
  }

  out.reviewPoints = (Array.isArray(src.reviewPoints) ? src.reviewPoints : [])
    .filter((p) => p && typeof p === 'object' && (str(p.observation) || str(p.question)))
    .slice(0, maxRec)
    .map((p) => ({
      topic: REVIEW_TOPICS.includes(p.topic) ? p.topic : 'other',
      ticker: str(p.ticker) && p.ticker !== 'null' ? str(p.ticker) : null,
      observation: str(p.observation),
      question: str(p.question),
    }))

  out.reviewSteps = strList(src.reviewSteps).slice(0, 4)

  return out
}
