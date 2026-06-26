import { useState } from 'react'
import { api } from '../../lib/api'

export default function AIPanel({ holdings, prices, displayCurrency, fxRate, inSectorNews }) {
  const [analysis, setAnalysis] = useState(null)
  const [newsSummary, setNewsSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingNews, setLoadingNews] = useState(false)
  const [error, setError] = useState('')

  const analyze = async () => {
    if (!holdings.length) return
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/ai/analyze', { holdings, prices, displayCurrency, fxRate })
      if (res.error) setError(res.error)
      else setAnalysis(res)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
    setLoading(false)
  }

  const summarizeNews = async () => {
    if (!inSectorNews.length) return
    setLoadingNews(true)
    try {
      const res = await api.post('/ai/news-summary', { holdings, news: inSectorNews })
      setNewsSummary(res)
    } catch {}
    setLoadingNews(false)
  }

  const scoreColor = (s) => (s >= 8 ? 'var(--gain)' : s >= 6 ? 'var(--warn)' : 'var(--loss)')
  const impactColor = (i) => (i === 'positive' ? 'var(--gain)' : i === 'negative' ? 'var(--loss)' : 'var(--warn)')
  const impactLabel = (i) => (i === 'positive' ? '📈 บวก' : i === 'negative' ? '📉 ลบ' : '➡️ กลางๆ')
  const typeColor = (t) => (t === 'hold' ? 'var(--gain)' : t === 'reduce' ? 'var(--loss)' : 'var(--warn)')
  const typeLabel = (t) => (t === 'hold' ? '✋ Hold' : t === 'reduce' ? '📉 Reduce' : '⚖️ Rebalance')

  const emptyState = (icon, text) => (
    <div className="dash-empty-state" style={{ padding: '24px' }}>
      <p style={{ fontSize: '32px', marginBottom: '8px' }}>{icon}</p>
      <p style={{ fontSize: '13px' }}>{text}</p>
    </div>
  )

  return (
    <div style={{ marginTop: '8px' }}>
      <div className="dash-card">
        <div className="dash-ai-header">
          <div>
            <h3 className="dash-card-title">🤖 AI วิเคราะห์พอร์ต</h3>
            <p className="dash-card-sub" style={{ marginBottom: '4px' }}>Claude วิเคราะห์ risk, concentration และแนะนำ rebalancing</p>
            <p className="dash-text-faint" style={{ fontSize: '11px', margin: 0 }}>⚠️ ไม่ใช่คำแนะนำการลงทุน — ใช้เพื่อการศึกษาและบันทึกส่วนตัวเท่านั้น</p>
          </div>
          <button type="button" onClick={analyze} disabled={loading || !holdings.length} className="dash-ai-btn dash-ai-btn--primary">
            {loading ? '⏳ กำลังวิเคราะห์...' : '✨ วิเคราะห์พอร์ต'}
          </button>
        </div>

        {error && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
        {!analysis && !loading && emptyState('🧠', 'กด "วิเคราะห์พอร์ต" เพื่อให้ Claude ช่วยวิเคราะห์')}
        {loading && emptyState('⏳', 'Claude กำลังวิเคราะห์พอร์ตของคุณ...')}

        {analysis && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div className="dash-inset" style={{ borderColor: scoreColor(analysis.score), padding: '14px 18px', flex: '0 0 auto' }}>
                <div className="dash-text-muted" style={{ fontSize: '11px', marginBottom: '4px' }}>คะแนนพอร์ต</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: scoreColor(analysis.score) }}>
                  {analysis.score}<span className="dash-text-muted" style={{ fontSize: '14px' }}>/10</span>
                </div>
                <div className="dash-text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>{analysis.scoreReason}</div>
              </div>
              <div className="dash-inset" style={{ padding: '14px 18px', flex: 1 }}>
                <div className="dash-text-muted" style={{ fontSize: '11px', marginBottom: '6px' }}>สรุปภาพรวม</div>
                <p className="dash-text-secondary" style={{ fontSize: '13px', lineHeight: 1.7, margin: 0 }}>{analysis.summary}</p>
              </div>
            </div>

            <div className="dash-ai-grid">
              <div className="dash-inset dash-inset--gain" style={{ padding: '14px' }}>
                <div className="dash-text-gain" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>✅ จุดแข็ง</div>
                {analysis.strengths?.map((s, i) => (
                  <div key={i} className="dash-text-secondary" style={{ fontSize: '13px', marginBottom: '6px', paddingLeft: '8px', borderLeft: '2px solid var(--gain)' }}>{s}</div>
                ))}
              </div>
              <div className="dash-inset dash-inset--loss" style={{ padding: '14px' }}>
                <div className="dash-text-loss" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>⚠️ ความเสี่ยง</div>
                {analysis.risks?.map((r, i) => (
                  <div key={i} className="dash-text-secondary" style={{ fontSize: '13px', marginBottom: '6px', paddingLeft: '8px', borderLeft: '2px solid var(--loss)' }}>{r}</div>
                ))}
              </div>
            </div>

            {analysis.recommendations?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div className="dash-text-accent" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>💡 คำแนะนำรายหุ้น</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analysis.recommendations.map((r, i) => (
                    <div key={i} className="dash-inset" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px' }}>
                      <div style={{ flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>{r.ticker}</span>
                        <span style={{ display: 'block', fontSize: '11px', color: typeColor(r.type), marginTop: '2px' }}>{typeLabel(r.type)}</span>
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', marginBottom: '3px' }}>{r.action}</p>
                        <p className="dash-text-muted" style={{ fontSize: '12px', margin: 0 }}>{r.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.rebalanceSuggestion && (
              <div className="dash-inset dash-inset--accent" style={{ padding: '14px' }}>
                <div className="dash-text-accent" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>🔄 แนะนำ Rebalance</div>
                <p className="dash-text-secondary" style={{ fontSize: '13px', lineHeight: 1.7, margin: 0 }}>{analysis.rebalanceSuggestion}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="dash-card" style={{ marginBottom: 0 }}>
        <div className="dash-ai-header">
          <div>
            <h3 className="dash-card-title">📰 AI สรุปข่าวกระทบพอร์ต</h3>
            <p className="dash-card-sub" style={{ marginBottom: 0 }}>Claude วิเคราะห์ข่าวล่าสุดและผลกระทบต่อ holdings</p>
          </div>
          <button type="button" onClick={summarizeNews} disabled={loadingNews || !inSectorNews.length} className="dash-ai-btn dash-ai-btn--news">
            {loadingNews ? '⏳ กำลังสรุป...' : '📋 สรุปข่าว'}
          </button>
        </div>

        {!newsSummary && !loadingNews && emptyState('📰', 'กด "สรุปข่าว" เพื่อให้ Claude วิเคราะห์ข่าวที่กระทบพอร์ต')}
        {loadingNews && emptyState('⏳', 'Claude กำลังอ่านข่าวและวิเคราะห์ผลกระทบ...')}

        {newsSummary && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: impactColor(newsSummary.impact) }}>{impactLabel(newsSummary.impact)}</span>
              <span className="dash-text-muted" style={{ fontSize: '12px' }}>ผลกระทบต่อพอร์ต</span>
            </div>
            <p className="dash-text-secondary" style={{ fontSize: '13px', lineHeight: 1.7, marginBottom: '14px' }}>{newsSummary.summary}</p>
            {newsSummary.highlights?.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                {newsSummary.highlights.map((h, i) => (
                  <div key={i} className="dash-text-secondary" style={{ fontSize: '13px', padding: '6px 0 6px 12px', borderLeft: '2px solid var(--accent-text)', marginBottom: '6px' }}>{h}</div>
                ))}
              </div>
            )}
            {newsSummary.watchOut && (
              <div className="dash-inset dash-inset--warn" style={{ padding: '12px' }}>
                <span className="dash-text-loss" style={{ fontSize: '12px', fontWeight: 600 }}>⚠️ ควรระวัง: </span>
                <span className="dash-text-secondary" style={{ fontSize: '13px' }}>{newsSummary.watchOut}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
