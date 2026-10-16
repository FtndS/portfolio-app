/**
 * Prompt + response shape for POST /api/ai/news-summary ("AI สรุปข่าว").
 *
 * PortDiary is not an investment adviser (terms ข้อ 1-2). The summary only says
 * what each headline is about and which holdings it mentions, with a link to
 * the source. It must not judge news as good or bad for the portfolio, predict
 * prices, or tell the user to buy, sell, or hold.
 */

export const MAX_NEWS = 8

/** Fields the client may receive. Anything else Claude returns is dropped. */
export const NEWS_SUMMARY_RESPONSE_FIELDS = ['summary', 'newsItems', 'mentionedTickers', 'readMore']

/** Normalize client news items to { id, title, source, url, publishedAt }. */
export function normalizeNews(news) {
  return (Array.isArray(news) ? news : [])
    .map((n) => ({
      title: String(n?.title || '').trim(),
      source: String(n?.source?.name || n?.source || '').trim() || null,
      url: /^https?:\/\//i.test(String(n?.url || '')) ? String(n.url) : null,
      publishedAt: String(n?.publishedAt || '').trim() || null,
    }))
    .filter((n) => n.title)
    .slice(0, MAX_NEWS)
    .map((n, i) => ({ id: i + 1, ...n }))
}

export function portfolioTickers(holdings) {
  return [...new Set((Array.isArray(holdings) ? holdings : [])
    .map((h) => String(h?.ticker || '').trim().toUpperCase())
    .filter(Boolean))]
}

export function buildNewsSummarySystemPrompt() {
  return `คุณคือผู้ช่วยสรุปข่าวที่เกี่ยวกับหุ้นในพอร์ตของ PortDiary ผลลัพธ์ไม่ใช่คำแนะนำการลงทุน
หน้าที่: สรุปว่าแต่ละข่าวพูดถึงอะไร และพูดถึงหุ้นตัวไหนในพอร์ตของ user
ตอบเป็นภาษาไทย กระชับ อ่านง่าย ใช้เฉพาะหัวข้อข่าวที่ให้มา ห้ามแต่งเนื้อข่าว ตัวเลข หรือเหตุการณ์ที่ไม่มีในหัวข้อข่าว
ข้อห้าม:
- ห้ามบอกว่าข่าวดีหรือร้าย เป็นบวกหรือลบ ต่อพอร์ต หุ้น หรือการลงทุน
- ห้ามคาดการณ์ราคาหรือทิศทางหุ้น
- ห้ามบอกให้ซื้อ ขาย ถือ เพิ่ม หรือลดสัดส่วนหุ้นตัวใด
- ประเด็นอ่านเพิ่มให้เขียนเป็นคำถามปลายเปิดเกี่ยวกับเนื้อข่าว เช่น "ข่าวนี้พูดถึงตัวเลขไตรมาสไหน" ไม่ใช่ "ควรระวังหุ้น X"
ตอบด้วย valid JSON เท่านั้น ห้ามมี markdown หรือข้อความนอก JSON`
}

export function buildNewsSummaryUserMessage({ tickers, news }) {
  const newsText = news.map((n) => `${n.id}. ${n.title}${n.source ? ` (${n.source})` : ''}`).join('\n')
  return `หุ้นในพอร์ตของ user: ${tickers.join(', ')}

หัวข้อข่าวล่าสุด (เลขหน้าข่าวคือ id):
${newsText}

ตอบด้วย JSON นี้เท่านั้น:
{
  "summary": "สรุปว่าข่าวชุดนี้พูดถึงเรื่องอะไรบ้าง 2-3 ประโยค โดยไม่ตัดสินว่าดีหรือร้าย",
  "newsItems": [
    { "id": 1, "gist": "ข่าวนี้พูดถึงอะไร 1 ประโยค", "tickers": ["หุ้นในพอร์ตที่ข่าวนี้พูดถึง หรือ [] ถ้าไม่มี"] }
  ],
  "readMore": ["ประเด็นที่อาจอยากอ่านเพิ่มจากต้นข่าว เป็นคำถามปลายเปิด 1", "2"]
}`
}

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/**
 * Keep only the fact-shaped fields. Drops anything evaluative Claude might
 * still emit (impact, watchOut, highlights, …). Titles and links come from the
 * news the client sent, not from Claude.
 */
export function sanitizeNewsSummary(raw, { news = [], tickers = [] } = {}) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const byId = new Map(news.map((n) => [n.id, n]))
  const allowed = new Set(tickers)
  const seen = new Set()

  const newsItems = []
  for (const item of Array.isArray(src.newsItems) ? src.newsItems : []) {
    const n = byId.get(Number(item?.id))
    if (!n || seen.has(n.id)) continue
    seen.add(n.id)
    const itemTickers = [...new Set((Array.isArray(item.tickers) ? item.tickers : [])
      .map((t) => String(t || '').trim().toUpperCase())
      .filter((t) => allowed.has(t)))]
    newsItems.push({
      id: n.id,
      title: n.title,
      source: n.source,
      url: n.url,
      publishedAt: n.publishedAt,
      gist: str(item.gist),
      tickers: itemTickers,
    })
  }

  const mentionedTickers = tickers.filter((t) => newsItems.some((n) => n.tickers.includes(t)))

  return {
    summary: str(src.summary) || '',
    newsItems,
    mentionedTickers,
    readMore: (Array.isArray(src.readMore) ? src.readMore : []).map(str).filter(Boolean).slice(0, 3),
  }
}
