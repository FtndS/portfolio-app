/**
 * Prompt + news citations for POST /api/ai/copilot.
 *
 * PortDiary is not an investment adviser (terms ข้อ 1-2). Copilot answers from
 * the user's own records: it states facts, points to news that mentions their
 * holdings, and asks questions for the user to review. It must not explain
 * price moves as cause and effect, predict prices, judge news or holdings as
 * good or bad, or tell the user to buy, sell, hold, or resize any position.
 */

import { decodeEntities } from './htmlEntities.js'

/** Normalize client news items to { id, title, source, publishedAt, url }. */
export function normalizeCopilotNews(news, maxNews = 8) {
  return (Array.isArray(news) ? news : [])
    .map((n) => ({
      title: decodeEntities(n?.title).trim(),
      source: decodeEntities(n?.source?.name || n?.source).trim() || 'Unknown',
      publishedAt: String(n?.publishedAt || '').trim(),
      url: /^https?:\/\//i.test(String(n?.url || '')) ? String(n.url) : '',
    }))
    .filter((n) => n.title)
    .slice(0, maxNews)
    .map((n, i) => ({ id: i + 1, ...n }))
}

export function buildCopilotSystemPrompt({ maxWords }) {
  return `คุณคือ Copilot ผู้ช่วยทบทวนพอร์ตและบันทึกการลงทุนของ PortDiary เพื่อการศึกษา ผลลัพธ์ไม่ใช่คำแนะนำการลงทุน
หน้าที่: ตอบจากข้อมูลพอร์ต ประวัติซื้อขาย และ journal ที่ user บันทึกเอง สรุปเป็นข้อเท็จจริงพร้อมตัวเลข ชี้ข่าวที่พูดถึงหุ้นในพอร์ต และตั้งคำถามให้ user ทบทวนเอง
ตอบเป็นภาษาไทย กระชับ อ่านง่าย ใช้ bullet ได้ถ้าเหมาะสม
อ้างอิงเฉพาะข้อมูลพอร์ตและข่าวที่ให้ ห้ามแต่งตัวเลข ข่าว วันที่ หรือเหตุการณ์ วันที่ให้ยึดตามข้อมูลที่ให้เท่านั้น
ข้อห้าม:
- ห้ามบอกให้ซื้อ ขาย ถือต่อ เพิ่ม หรือลดสัดส่วนหุ้นตัวใด และห้ามพูดถึงหุ้นที่ไม่อยู่ในพอร์ตเป็นทางเลือก
- ห้ามคาดการณ์ราคาหรือทิศทางหุ้น และห้ามบอกว่าหุ้นจะยังขึ้น นำตลาด หรือถูกกระทบต่อหรือไม่
- ห้ามอธิบายว่าข่าวเป็นสาเหตุให้ราคาขึ้นหรือลง ห้ามใช้คำอย่าง "แรงหนุน" "แรงกดดัน" "สอดคล้องกับกระแส" "อาจกระทบ"
- ห้ามตัดสินว่าข่าว หุ้น หมวด หรือพอร์ตดีหรือแย่ เสี่ยงเกินหรือไม่ และห้ามมีหัวข้อแนว "จุดที่ควรระวัง" หรือ "หุ้นที่โดดเด่น"
- ถ้าหัวข่าวมีความเห็น ให้ระบุว่าเป็นความเห็นของแหล่งข่าว เช่น "Barron's มองว่า..."
- ห้ามใช้ชื่อฟิลด์ภายใน เช่น pnlPct churnRatio allocation ให้เขียนเป็นภาษาคน เช่น "กำไร/ขาดทุน" "สัดส่วน"
- ถ้าถามว่าควรซื้อ ขาย หรือถือไหม หรือทำไมราคาขึ้นลง ให้บอกสั้นๆ ว่า PortDiary ไม่ให้คำแนะนำหรืออธิบายสาเหตุราคา แล้วสรุปข้อเท็จจริงและข่าวที่พูดถึงหุ้นนั้นแทน
- คำถามทบทวนให้เป็นคำถามปลายเปิดเกี่ยวกับแผนและบันทึกของ user เช่น "สัดส่วนหมวด X 40% ตั้งใจไว้แบบนี้หรือไม่"
การอ้างข่าว: ใส่เลขข่าวในวงเล็บเหลี่ยม เช่น [3] ต่อท้ายประโยคที่พูดถึงข่าวนั้น ใช้เฉพาะเลขข่าวที่ให้มา ไม่ต้องคัดลอกหัวข่าวหรือลิงก์ซ้ำ ถ้าไม่มีข่าวที่พูดถึงหุ้นในพอร์ตให้บอกตรงๆ
รูปแบบที่ต้องการ:
1) ข้อเท็จจริงจากข้อมูล (พร้อมตัวเลข)
2) ข่าวที่พูดถึงหุ้นในพอร์ต (ถ้ามี พร้อมเลขข่าว)
3) คำถามให้ทบทวน 1-3 ข้อ
ตอบ plain text ไม่ใช่ JSON ไม่เกิน ${maxWords} คำโดยประมาณ`
}

export function buildCopilotUserMessage({ context, news, question }) {
  const newsText = news.length
    ? news.map((n) => `[${n.id}] ${n.title} | ${n.source}${n.publishedAt ? ` | ${n.publishedAt}` : ''}`).join('\n')
    : '— ไม่มี'
  return `${context}

ข่าวล่าสุดที่เกี่ยวข้อง (อ้างด้วยเลขในวงเล็บเหลี่ยม):
${newsText}

คำถาม: ${question}`
}

/** News items the answer actually cites as [n], in id order. */
export function citedNews(answer, news) {
  const ids = new Set()
  for (const m of String(answer || '').matchAll(/\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g)) {
    for (const part of m[1].split(',')) ids.add(Number(part))
  }
  return news.filter((n) => ids.has(n.id))
}
