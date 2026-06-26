import { useState, useEffect, useCallback } from 'react'
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
      const res = await api.post('/ai/analyze', {
        holdings, prices, displayCurrency, fxRate
      })
      if (res.error) setError(res.error)
      else setAnalysis(res)
    } catch (e) {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
    setLoading(false)
  }

  const summarizeNews = async () => {
    if (!inSectorNews.length) return
    setLoadingNews(true)
    try {
      const res = await api.post('/ai/news-summary', {
        holdings, news: inSectorNews
      })
      setNewsSummary(res)
    } catch (e) {}
    setLoadingNews(false)
  }

  const scoreColor = (s) => s >= 8 ? '#27ae60' : s >= 6 ? '#f39c12' : '#e74c3c'
  const impactColor = (i) => i === 'positive' ? '#27ae60' : i === 'negative' ? '#e74c3c' : '#f39c12'
  const impactLabel = (i) => i === 'positive' ? '📈 บวก' : i === 'negative' ? '📉 ลบ' : '➡️ กลางๆ'

  return (
    <div style={{ marginTop: '8px' }}>
      {/* AI Portfolio Analysis */}
      <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }} className="dash-ai-header">
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>
              🤖 AI วิเคราะห์พอร์ต
            </h3>
            <p style={{ fontSize: '12px', color: '#555' }}>Claude วิเคราะห์ risk, concentration และแนะนำ rebalancing</p>
            <p style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>⚠️ ไม่ใช่คำแนะนำการลงทุน — ใช้เพื่อการศึกษาและบันทึกส่วนตัวเท่านั้น</p>
          </div>
          <button onClick={analyze} disabled={loading || !holdings.length} style={{
            padding: '8px 18px', background: loading ? '#2a2a2a' : '#6c5ce7',
            border: 'none', borderRadius: '8px', color: loading ? '#555' : '#fff',
            fontSize: '13px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500,
            whiteSpace: 'nowrap'
          }}>
            {loading ? '⏳ กำลังวิเคราะห์...' : '✨ วิเคราะห์พอร์ต'}
          </button>
        </div>

        {error && <p style={{ color: '#e74c3c', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

        {!analysis && !loading && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#444' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>🧠</p>
            <p style={{ fontSize: '13px' }}>กด "วิเคราะห์พอร์ต" เพื่อให้ Claude ช่วยวิเคราะห์</p>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
            <p style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</p>
            <p style={{ fontSize: '13px' }}>Claude กำลังวิเคราะห์พอร์ตของคุณ...</p>
          </div>
        )}

        {analysis && (
          <div>
            {/* Score */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ background: '#0f0f0f', border: `1px solid ${scoreColor(analysis.score)}`, borderRadius: '10px', padding: '14px 18px', flex: '0 0 auto' }}>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>คะแนนพอร์ต</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: scoreColor(analysis.score) }}>{analysis.score}<span style={{ fontSize: '14px', color: '#555' }}>/10</span></div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{analysis.scoreReason}</div>
              </div>
              <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '14px 18px', flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px' }}>สรุปภาพรวม</div>
                <p style={{ fontSize: '13px', color: '#ccc', lineHeight: 1.7 }}>{analysis.summary}</p>
              </div>
            </div>

            {/* Strengths & Risks */}
            <div className="dash-ai-grid">
              <div style={{ background: '#0f1f0f', border: '1px solid #1a3a1a', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#27ae60', marginBottom: '10px' }}>✅ จุดแข็ง</div>
                {analysis.strengths?.map((s, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#aaa', marginBottom: '6px', paddingLeft: '8px', borderLeft: '2px solid #27ae60' }}>{s}</div>
                ))}
              </div>
              <div style={{ background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#e74c3c', marginBottom: '10px' }}>⚠️ ความเสี่ยง</div>
                {analysis.risks?.map((r, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#aaa', marginBottom: '6px', paddingLeft: '8px', borderLeft: '2px solid #e74c3c' }}>{r}</div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            {analysis.recommendations?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#a29bfe', marginBottom: '10px' }}>💡 คำแนะนำรายหุ้น</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analysis.recommendations.map((r, i) => {
                    const typeColor = r.type === 'hold' ? '#27ae60' : r.type === 'reduce' ? '#e74c3c' : '#f39c12'
                    const typeLabel = r.type === 'hold' ? '✋ Hold' : r.type === 'reduce' ? '📉 Reduce' : '⚖️ Rebalance'
                    return (
                      <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ flexShrink: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{r.ticker}</span>
                          <span style={{ display: 'block', fontSize: '11px', color: typeColor, marginTop: '2px' }}>{typeLabel}</span>
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', color: '#fff', marginBottom: '3px' }}>{r.action}</p>
                          <p style={{ fontSize: '12px', color: '#666' }}>{r.reason}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Rebalance suggestion */}
            {analysis.rebalanceSuggestion && (
              <div style={{ background: '#1a1a2e', border: '1px solid #2d2d5e', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#a29bfe', marginBottom: '8px' }}>🔄 แนะนำ Rebalance</div>
                <p style={{ fontSize: '13px', color: '#bbb', lineHeight: 1.7 }}>{analysis.rebalanceSuggestion}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI News Summary */}
      <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }} className="dash-ai-header">
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>
              📰 AI สรุปข่าวกระทบพอร์ต
            </h3>
            <p style={{ fontSize: '12px', color: '#555' }}>Claude วิเคราะห์ข่าวล่าสุดและผลกระทบต่อ holdings</p>
          </div>
          <button onClick={summarizeNews} disabled={loadingNews || !inSectorNews.length} style={{
            padding: '8px 18px', background: loadingNews ? '#2a2a2a' : '#00b894',
            border: 'none', borderRadius: '8px', color: loadingNews ? '#555' : '#fff',
            fontSize: '13px', cursor: loadingNews ? 'not-allowed' : 'pointer', fontWeight: 500,
            whiteSpace: 'nowrap'
          }}>
            {loadingNews ? '⏳ กำลังสรุป...' : '📋 สรุปข่าว'}
          </button>
        </div>

        {!newsSummary && !loadingNews && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#444' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>📰</p>
            <p style={{ fontSize: '13px' }}>กด "สรุปข่าว" เพื่อให้ Claude วิเคราะห์ข่าวที่กระทบพอร์ต</p>
          </div>
        )}

        {loadingNews && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
            <p style={{ fontSize: '13px' }}>Claude กำลังอ่านข่าวและวิเคราะห์ผลกระทบ...</p>
          </div>
        )}

        {newsSummary && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: impactColor(newsSummary.impact) }}>
                {impactLabel(newsSummary.impact)}
              </span>
              <span style={{ fontSize: '12px', color: '#555' }}>ผลกระทบต่อพอร์ต</span>
            </div>
            <p style={{ fontSize: '13px', color: '#ccc', lineHeight: 1.7, marginBottom: '14px' }}>{newsSummary.summary}</p>
            {newsSummary.highlights?.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                {newsSummary.highlights.map((h, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#aaa', padding: '6px 0 6px 12px', borderLeft: '2px solid #a29bfe', marginBottom: '6px' }}>{h}</div>
                ))}
              </div>
            )}
            {newsSummary.watchOut && (
              <div style={{ background: '#1f1a0f', border: '1px solid #3a2a0a', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '12px', color: '#f39c12', fontWeight: 600 }}>⚠️ ควรระวัง: </span>
                <span style={{ fontSize: '13px', color: '#bbb' }}>{newsSummary.watchOut}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}