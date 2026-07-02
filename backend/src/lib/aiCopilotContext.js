import { buildAnalyzePayload } from './aiAnalyzeContext.js'

export const COPILOT_PRESETS = {
  portfolio_summary: {
    label: 'สรุปภาพรวมพอร์ต',
    prompt: 'สรุปภาพรวมพอร์ตสั้นๆ 3-5 ประโยค: มูลค่า การกระจาย sector หุ้นที่โดดเด่น และสิ่งที่ควรจำวันนี้',
  },
  sector_risk: {
    label: 'Sector ไหนเสี่ยงเกิน',
    prompt: 'sector ไหนในพอร์ตนี้เสี่ยงกระจุกตัวหรือสูงเกินไป อธิบายสั้นๆ พร้อมสิ่งที่ควรทบทวน (ไม่ใช่คำสั่งซื้อขาย)',
  },
  trading_review: {
    label: 'ทบทวนการซื้อขาย',
    prompt: 'จากประวัติ transaction สรุปพฤติกรรมซื้อขาย มีการซื้อขายบ่อยเกินไปไหม จุดที่ทำกำไร/ขาดทุนชัดเจนไหม',
  },
  weekly_focus: {
    label: 'โฟกัสสัปดาห์นี้',
    prompt: 'จากข้อมูลพอร์ตและ journal แนะนำ 3 สิ่งที่ควรโฟกัสหรือทบทวนในสัปดาห์นี้ กระชับ เป็น bullet',
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
