import { buildAnalyzePayload } from './aiAnalyzeContext.js'

export const COPILOT_PRESETS = {
  portfolio_summary: {
    label: 'สรุปภาพรวมพอร์ต',
    prompt: 'สรุปข้อเท็จจริงของพอร์ต 3-5 ประโยค: มูลค่า การกระจายตามหมวด หุ้นที่สัดส่วนใหญ่สุด และข่าวที่พูดถึงหุ้นในพอร์ต (ถ้ามี)',
  },
  sector_risk: {
    label: 'สัดส่วนตามหมวด',
    prompt: 'สรุปสัดส่วนแต่ละหมวดและหุ้นที่สัดส่วนใหญ่สุดพร้อมตัวเลข แล้วตั้งคำถามให้ทบทวนว่าสัดส่วนนี้ตั้งใจไว้หรือไม่ (ไม่ต้องตัดสินว่าหมวดไหนเสี่ยงเกิน)',
  },
  trading_review: {
    label: 'ทบทวนการซื้อขาย',
    prompt: 'จากประวัติ transaction สรุปข้อเท็จจริงของการซื้อขาย: จำนวนครั้ง ช่วงเวลา หุ้นที่ซื้อขายบ่อย และที่ขายไปแล้วกำไรหรือขาดทุน แล้วตั้งคำถามให้ทบทวนว่าสอดคล้องกับแผนของตัวเองหรือไม่',
  },
  weekly_focus: {
    label: 'ทบทวนบันทึกสัปดาห์นี้',
    prompt: 'จากข้อมูลพอร์ตและ journal ตั้ง 3 คำถามให้ทบทวนบันทึกของตัวเองสัปดาห์นี้ เช่น หุ้นที่ยังไม่มีเหตุผลถือ หรือ journal ที่ไม่ตรงกับการซื้อขายจริง เป็น bullet',
  },
}

export function buildCopilotContext({
  holdings,
  prices,
  displayCurrency,
  fxRate,
  transactions,
  journal,
  planConfig,
}) {
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
    planConfig: {
      ...planConfig,
      analyze: {
        ...planConfig.analyze,
        maxTransactions: planConfig.copilot.maxTransactions,
        maxJournal: planConfig.copilot.maxJournal,
      },
    },
  })

  const topHoldings = portfolioWithPct
    .slice()
    .sort((a, b) => Number(b.allocation) - Number(a.allocation))
    .slice(0, planConfig.copilot.maxHoldings)
    .map((h) => ({
      ticker: h.ticker,
      allocation: h.allocation,
      pnlPct: h.pnlPct,
      sector: h.sector,
    }))

  const context = `ข้อมูลพอร์ต (${displayCurrency}) ณ ขณะนี้:
มูลค่ารวม: ${totalValue.toFixed(2)} ${displayCurrency}

หุ้นหลัก:
${JSON.stringify(topHoldings)}

Sector:
${JSON.stringify(sectorAlloc)}

สถิติ Transaction:
${JSON.stringify(txSummary.stats)}

Transaction ล่าสุด:
${JSON.stringify(txSummary.recent.slice(0, planConfig.copilot.maxTransactions))}

Journal ล่าสุด:
${JSON.stringify(journalSummary.entries)}`

  return {
    context,
    dataScope: {
      ...dataScope,
      holdingsShown: topHoldings.length,
      holdingsTotal: portfolioWithPct.length,
    },
  }
}

export function resolveCopilotQuestion(preset, question, planConfig) {
  const custom = String(question || '').trim()
  if (custom) {
    if (!planConfig.copilot.allowCustomQuestion) {
      return { error: 'คำถามกำหนดเองใช้ได้เฉพาะแผน Pro — Free ใช้ปุ่มคำถามแนะนำได้' }
    }
    if (custom.length > planConfig.copilot.maxQuestionLen) {
      return { error: `คำถามยาวเกินไป (สูงสุด ${planConfig.copilot.maxQuestionLen} ตัวอักษร)` }
    }
    return { question: custom, preset: 'custom' }
  }

  const key = preset && COPILOT_PRESETS[preset] ? preset : 'portfolio_summary'
  return { question: COPILOT_PRESETS[key].prompt, preset: key }
}
