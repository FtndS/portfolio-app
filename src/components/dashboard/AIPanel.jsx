import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'

function formatAiError(message) {
  if (!message) return 'เกิดข้อผิดพลาด กรุณาลองใหม่'
  if (/gateway time-out|timed out|timeout/i.test(message)) {
    return 'ใช้เวลานานเกินไป — ลองใหม่อีกครั้งในอีกสักครู่'
  }
  return message
}

const COPILOT_PRESETS = [
  { id: 'portfolio_summary', label: 'สรุปภาพรวมพอร์ต', icon: '📊' },
  { id: 'sector_risk', label: 'Sector ไหนเสี่ยงเกิน', icon: '⚖️' },
  { id: 'trading_review', label: 'ทบทวนการซื้อขาย', icon: '🔄' },
  { id: 'weekly_focus', label: 'โฟกัสสัปดาห์นี้', icon: '🎯' },
]

function formatQuotaHint(quota, key) {
  if (!quota) return null
  if (quota.isOwner) return 'โควต้าไม่จำกัด'
  const limitKeyMap = { analyze: 'analyze', newsSummary: 'newsSummary', copilot: 'copilot' }
  const limitKey = limitKeyMap[key] || key
  const slot = quota[key]
  const limit = quota.limits?.[limitKey]
  if (!slot) return null
  const planNote = quota.plan === 'pro' ? ' · แผน Pro' : ''
  if (slot.allowed && limit != null && slot.remaining != null) {
    return `เหลือ ${slot.remaining}/${limit} ครั้งสัปดาห์นี้${planNote}`
  }
  if (slot.allowed) return `ใช้ได้ ${limit ?? 1} ครั้งต่อสัปดาห์${planNote}`
  if (!slot.nextAvailableAt) return `ใช้ครบโควต้าสัปดาห์นี้แล้ว${planNote}`
  const when = new Date(slot.nextAvailableAt).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return `ใช้ได้อีกครั้งหลัง ${when}${planNote}`
}

export default function AIPanel({
  holdings,
  prices,
  displayCurrency,
  fxRate,
  inSectorNews,
  transactions = [],
  journal = [],
  variant = 'inline',
}) {
  const [analysis, setAnalysis] = useState(null)
  const [newsSummary, setNewsSummary] = useState(null)
  const [copilotAnswer, setCopilotAnswer] = useState(null)
  const [copilotPreset, setCopilotPreset] = useState('portfolio_summary')
  const [copilotQuestion, setCopilotQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingNews, setLoadingNews] = useState(false)
  const [loadingCopilot, setLoadingCopilot] = useState(false)
  const [error, setError] = useState('')
  const [newsError, setNewsError] = useState('')
  const [copilotError, setCopilotError] = useState('')
  const [quota, setQuota] = useState(null)

  const loadQuota = useCallback(async () => {
    const q = await api.get('/ai/quota')
    if (!q?.error) setQuota(q)
  }, [])

  useEffect(() => {
    loadQuota()
  }, [loadQuota])

  const analyze = async () => {
    if (!holdings.length || quota?.analyze?.allowed === false) return
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/ai/analyze', {
        holdings,
        prices,
        displayCurrency,
        fxRate,
        transactions,
        journal,
      })
      if (res.error) {
        setError(formatAiError(res.error))
        if (res.code === 'AI_QUOTA_EXCEEDED') await loadQuota()
      } else {
        setAnalysis(res)
        await loadQuota()
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
    setLoading(false)
  }

  const askCopilot = async (presetId, customQuestion) => {
    if (!holdings.length || quota?.copilot?.allowed === false) return
    const preset = presetId || copilotPreset
    const question = customQuestion !== undefined ? customQuestion : copilotQuestion
    setLoadingCopilot(true)
    setCopilotError('')
    setCopilotPreset(preset)
    try {
      const body = {
        holdings,
        prices,
        displayCurrency,
        fxRate,
        transactions,
        journal,
        inSectorNews,
        preset: question?.trim() ? undefined : preset,
        question: question?.trim() || undefined,
      }
      const res = await api.post('/ai/copilot', body)
      if (res.error) {
        setCopilotError(formatAiError(res.error))
        if (res.code === 'AI_QUOTA_EXCEEDED') await loadQuota()
      } else {
        setCopilotAnswer(res)
        await loadQuota()
      }
    } catch {
      setCopilotError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
    setLoadingCopilot(false)
  }

  const summarizeNews = async () => {
    if (!inSectorNews.length || quota?.newsSummary?.allowed === false) return
    setLoadingNews(true)
    setNewsError('')
    try {
      const res = await api.post('/ai/news-summary', { holdings, news: inSectorNews })
      if (res.error) {
        setNewsError(formatAiError(res.error))
        if (res.code === 'AI_QUOTA_EXCEEDED') await loadQuota()
      } else {
        setNewsSummary(res)
        await loadQuota()
      }
    } catch {
      setNewsError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
    setLoadingNews(false)
  }

  const analyzeHint = formatQuotaHint(quota, 'analyze')
  const newsHint = formatQuotaHint(quota, 'newsSummary')
  const copilotHint = formatQuotaHint(quota, 'copilot')
  const analyzeBlocked = quota?.analyze?.allowed === false
  const newsBlocked = quota?.newsSummary?.allowed === false
  const copilotBlocked = quota?.copilot?.allowed === false
  const copilotPro = quota?.plan === 'pro' || quota?.isOwner

  const txCount = transactions.length
  const journalCount = journal.length

  const topicLabel = (t) => ({
    sector: 'หมวดธุรกิจ',
    concentration: 'การกระจุกตัว',
    currency: 'สกุลเงิน/ตลาด',
    trading: 'การซื้อขาย',
    journal: 'บันทึก',
  }[t] || 'ทั่วไป')

  const emptyState = (icon, text) => (
    <div className="dash-empty-state" style={{ padding: '24px' }}>
      <p style={{ fontSize: '32px', marginBottom: '8px' }}>{icon}</p>
      <p style={{ fontSize: '13px' }}>{text}</p>
    </div>
  )

  const insightBlock = (title, tone, children) => (
    <div className={`dash-inset dash-inset--${tone}`} style={{ padding: '14px', marginBottom: '12px' }}>
      <div className={`dash-text-${tone === 'accent' ? 'accent' : tone}`} style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{title}</div>
      {children}
    </div>
  )

  return (
    <div className={variant === 'drawer' ? 'dash-ai-panel dash-ai-panel--drawer' : ''} style={{ marginTop: variant === 'drawer' ? 0 : '8px' }}>
      <div className="dash-card">
        <div className="dash-ai-header">
          <div>
            <h3 className="dash-card-title">💬 Copilot</h3>
            <p className="dash-card-sub" style={{ marginBottom: '4px' }}>
              ถามคำถามสั้นๆ จากข้อมูลพอร์ต — สรุปภาพรวม ทบทวน sector หรือพฤติกรรมซื้อขาย
            </p>
            {copilotHint && (
              <p className="dash-text-faint" style={{ fontSize: '11px', margin: '0 0 4px' }}>{copilotHint}</p>
            )}
            {!copilotPro && (
              <p className="dash-text-faint" style={{ fontSize: '11px', margin: '0 0 4px' }}>
                Free: ใช้ปุ่มคำถามแนะนำ · Pro: ถามเองได้
              </p>
            )}
            <p className="dash-text-faint" style={{ fontSize: '11px', margin: 0 }}>⚠️ ไม่ใช่คำแนะนำการลงทุน — ใช้เพื่อทบทวนส่วนตัวเท่านั้น</p>
          </div>
        </div>

        <div className="dash-copilot-chips" style={{ marginBottom: '12px' }}>
          {COPILOT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`dash-copilot-chip${copilotPreset === p.id && !copilotQuestion.trim() ? ' dash-copilot-chip--active' : ''}`}
              disabled={loadingCopilot || !holdings.length || copilotBlocked}
              onClick={() => {
                setCopilotQuestion('')
                askCopilot(p.id, '')
              }}
            >
              <span aria-hidden>{p.icon}</span> {p.label}
            </button>
          ))}
        </div>

        {copilotPro && (
          <div className="dash-copilot-custom" style={{ marginBottom: '12px' }}>
            <textarea
              className="dash-copilot-input"
              rows={2}
              placeholder="ถามเองได้ (Pro) เช่น หุ้นไหนควรทบทวนก่อน"
              value={copilotQuestion}
              onChange={(e) => setCopilotQuestion(e.target.value)}
              disabled={loadingCopilot || copilotBlocked}
              maxLength={240}
            />
            <button
              type="button"
              className="dash-ai-btn dash-ai-btn--copilot"
              disabled={loadingCopilot || !holdings.length || copilotBlocked || !copilotQuestion.trim()}
              onClick={() => askCopilot(undefined, copilotQuestion)}
            >
              {loadingCopilot ? '⏳ กำลังตอบ...' : 'ถาม Copilot'}
            </button>
          </div>
        )}

        {copilotError && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '12px' }}>{copilotError}</p>}
        {!copilotAnswer && !loadingCopilot && emptyState('💬', copilotBlocked ? (copilotHint || 'ใช้ครบโควต้าสัปดาห์นี้แล้ว') : 'เลือกคำถามด้านบน หรือพิมพ์คำถามเอง (Pro)')}
        {loadingCopilot && emptyState('⏳', 'Copilot กำลังอ่านพอร์ตและตอบ...')}

        {copilotAnswer && (
          <div className="dash-inset dash-inset--accent" style={{ padding: '14px' }}>
            {copilotAnswer.dataScope && (
              <p className="dash-text-faint" style={{ fontSize: '11px', marginBottom: '10px' }}>
                จากหุ้น {copilotAnswer.dataScope.holdingsShown}/{copilotAnswer.dataScope.holdingsTotal} ตัว
                · transaction {copilotAnswer.dataScope.transactionsIncluded}/{copilotAnswer.dataScope.transactionsTotal}
                {copilotAnswer.dataScope.internetNewsIncluded ? ` · ข่าว ${copilotAnswer.dataScope.internetNewsIncluded} รายการ` : ''}
              </p>
            )}
            <p className="dash-text-secondary" style={{ fontSize: '13px', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>
              {copilotAnswer.answer}
            </p>
            {Array.isArray(copilotAnswer.newsUsed) && copilotAnswer.newsUsed.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div className="dash-text-muted" style={{ fontSize: '12px', marginBottom: '6px' }}>หลักฐานข่าวที่ใช้</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {copilotAnswer.newsUsed.slice(0, 5).map((n, i) => (
                    <a
                      key={`${n.url}-${i}`}
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dash-text-accent"
                      style={{ fontSize: '12px', textDecoration: 'underline' }}
                    >
                      {i + 1}. {n.title} · {n.source || 'Unknown'}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-ai-header">
          <div>
            <h3 className="dash-card-title">🤖 AI วิเคราะห์พอร์ต</h3>
            <p className="dash-card-sub" style={{ marginBottom: '4px' }}>
              สรุปข้อเท็จจริงจาก holdings, transaction ({txCount}), journal ({journalCount}) และตั้งประเด็นให้คุณทบทวนเอง
            </p>
            {analyzeHint && (
              <p className="dash-text-faint" style={{ fontSize: '11px', margin: '0 0 4px' }}>{analyzeHint}</p>
            )}
            {quota?.plan === 'pro' && (
              <p className="dash-text-gain" style={{ fontSize: '11px', margin: '0 0 4px' }}>⭐ แผน Pro — โควต้าและข้อมูลวิเคราะห์มากขึ้น</p>
            )}
            <p className="dash-text-faint" style={{ fontSize: '11px', margin: 0 }}>⚠️ ไม่ใช่คำแนะนำการลงทุน — ใช้เพื่อการศึกษาและบันทึกส่วนตัวเท่านั้น</p>
          </div>
          <button
            type="button"
            onClick={analyze}
            disabled={loading || !holdings.length || analyzeBlocked}
            className="dash-ai-btn dash-ai-btn--primary"
            title={analyzeBlocked ? analyzeHint : undefined}
          >
            {loading ? '⏳ กำลังวิเคราะห์...' : analyzeBlocked ? 'ใช้ครบโควต้าแล้ว' : '✨ วิเคราะห์พอร์ต'}
          </button>
        </div>

        {error && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
        {!analysis && !loading && emptyState('🧠', analyzeBlocked ? (analyzeHint || 'ใช้ครบโควต้าสัปดาห์นี้แล้ว') : 'กด "วิเคราะห์พอร์ต" เพื่อให้ Claude สรุปพอร์ต + ประวัติซื้อขาย + journal และตั้งประเด็นให้ทบทวน')}
        {loading && emptyState('⏳', 'Claude กำลังอ่าน holdings, transactions และ journal...')}

        {analysis && (
          <div>
            {analysis.dataScope && (
              <p className="dash-text-faint" style={{ fontSize: '11px', marginBottom: '12px' }}>
                วิเคราะห์จาก transaction {analysis.dataScope.transactionsIncluded}/{analysis.dataScope.transactionsTotal} รายการ
                · journal {analysis.dataScope.journalIncluded}/{analysis.dataScope.journalTotal} รายการ
              </p>
            )}

            <div className="dash-inset dash-inset--warn" style={{ padding: '10px 14px', marginBottom: '12px' }}>
              <p className="dash-text-secondary" style={{ fontSize: '12px', margin: 0 }}>
                ⚠️ ไม่ใช่คำแนะนำการลงทุน — เป็นการสรุปข้อมูลที่คุณบันทึกไว้และตั้งคำถามให้ทบทวนเอง การตัดสินใจซื้อขายเป็นของคุณ
              </p>
            </div>

            <div className="dash-inset" style={{ padding: '14px 18px', marginBottom: '12px' }}>
              <div className="dash-text-muted" style={{ fontSize: '11px', marginBottom: '6px' }}>สรุปข้อเท็จจริงของพอร์ต</div>
              <p className="dash-text-secondary" style={{ fontSize: '13px', lineHeight: 1.7, margin: 0 }}>{analysis.summary}</p>
            </div>

            {(analysis.composition?.sector || analysis.composition?.currency || analysis.composition?.concentration) && (
              insightBlock('🧩 การกระจายของพอร์ต', 'accent', (
                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                  {[
                    ['หมวดธุรกิจ', analysis.composition.sector],
                    ['สกุลเงิน/ตลาด', analysis.composition.currency],
                    ['การกระจุกตัว', analysis.composition.concentration],
                  ].filter(([, v]) => v).map(([label, v]) => (
                    <li key={label} className="dash-text-secondary" style={{ fontSize: '13px', lineHeight: 1.7, marginBottom: '4px' }}>
                      <span className="dash-text-muted">{label}: </span>{v}
                    </li>
                  ))}
                </ul>
              ))
            )}

            {analysis.tradingPattern && (
              insightBlock('📊 พฤติกรรมซื้อขาย', 'warn', (
                <>
                  <p className="dash-text-secondary" style={{ fontSize: '13px', lineHeight: 1.7, margin: '0 0 8px' }}>{analysis.tradingPattern.summary}</p>
                  {analysis.tradingPattern.realizedNote && (
                    <p className="dash-text-secondary" style={{ fontSize: '13px', lineHeight: 1.7, margin: '0 0 8px' }}>{analysis.tradingPattern.realizedNote}</p>
                  )}
                  {analysis.tradingPattern.frequencyWarning && (
                    <p className="dash-text-loss" style={{ fontSize: '12px', margin: 0 }}>⚠️ {analysis.tradingPattern.frequencyWarning}</p>
                  )}
                </>
              ))
            )}

            {analysis.journalInsights && (
              insightBlock('📓 จาก Journal', 'accent', (
                <>
                  <p className="dash-text-secondary" style={{ fontSize: '13px', lineHeight: 1.7, margin: '0 0 8px' }}>{analysis.journalInsights.summary}</p>
                  {analysis.journalInsights.thesisAlignment && (
                    <p className="dash-text-secondary" style={{ fontSize: '13px', lineHeight: 1.7, margin: '0 0 8px' }}>{analysis.journalInsights.thesisAlignment}</p>
                  )}
                  {analysis.journalInsights.gaps?.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      {analysis.journalInsights.gaps.map((g, i) => (
                        <li key={i} className="dash-text-muted" style={{ fontSize: '12px', marginBottom: '4px' }}>{g}</li>
                      ))}
                    </ul>
                  )}
                </>
              ))
            )}

            {(analysis.observations?.length > 0 || analysis.riskNotes?.length > 0) && (
              <div className="dash-ai-grid">
                <div className="dash-inset dash-inset--accent" style={{ padding: '14px' }}>
                  <div className="dash-text-accent" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>🔎 ข้อสังเกตจากข้อมูล</div>
                  {analysis.observations?.map((s, i) => (
                    <div key={i} className="dash-text-secondary" style={{ fontSize: '13px', marginBottom: '6px', paddingLeft: '8px', borderLeft: '2px solid var(--accent-text)' }}>{s}</div>
                  ))}
                </div>
                <div className="dash-inset dash-inset--warn" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: 'var(--warn)' }}>⚠️ จุดที่พอร์ตอาจผันผวนตามปัจจัยเดียว</div>
                  {analysis.riskNotes?.map((r, i) => (
                    <div key={i} className="dash-text-secondary" style={{ fontSize: '13px', marginBottom: '6px', paddingLeft: '8px', borderLeft: '2px solid var(--warn)' }}>{r}</div>
                  ))}
                </div>
              </div>
            )}

            {analysis.reviewPoints?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div className="dash-text-accent" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>🤔 ประเด็นที่ควรทบทวน</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analysis.reviewPoints.map((p, i) => (
                    <div key={i} className="dash-inset" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px' }}>
                      <div style={{ flexShrink: 0, minWidth: '72px' }}>
                        {p.ticker && <span style={{ display: 'block', fontWeight: 700, fontSize: '13px' }}>{p.ticker}</span>}
                        <span className="dash-text-muted" style={{ display: 'block', fontSize: '11px', marginTop: p.ticker ? '2px' : 0 }}>{topicLabel(p.topic)}</span>
                      </div>
                      <div>
                        {p.observation && <p style={{ fontSize: '13px', marginBottom: '3px' }}>{p.observation}</p>}
                        {p.question && <p className="dash-text-muted" style={{ fontSize: '12px', margin: 0 }}>→ {p.question}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.reviewSteps?.length > 0 && (
              <div className="dash-inset" style={{ padding: '14px' }}>
                <div className="dash-text-muted" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>📋 ขั้นตอนทบทวนบันทึกของคุณ</div>
                <ol style={{ margin: 0, paddingLeft: '20px' }}>
                  {analysis.reviewSteps.map((step, i) => (
                    <li key={i} className="dash-text-secondary" style={{ fontSize: '13px', lineHeight: 1.65, marginBottom: '6px' }}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="dash-card" style={{ marginBottom: 0 }}>
        <div className="dash-ai-header">
          <div>
            <h3 className="dash-card-title">📰 AI สรุปข่าวหุ้นในพอร์ต</h3>
            <p className="dash-card-sub" style={{ marginBottom: '4px' }}>Claude สรุปว่าข่าวล่าสุดพูดถึงอะไร และเกี่ยวกับหุ้นตัวไหนในพอร์ต</p>
            {newsHint && (
              <p className="dash-text-faint" style={{ fontSize: '11px', margin: '0 0 4px' }}>{newsHint}</p>
            )}
            <p className="dash-text-faint" style={{ fontSize: '11px', margin: 0 }}>⚠️ ไม่ใช่คำแนะนำการลงทุน — สรุปเนื้อข่าวเท่านั้น ควรอ่านต้นข่าวประกอบ</p>
          </div>
          <button
            type="button"
            onClick={summarizeNews}
            disabled={loadingNews || !inSectorNews.length || newsBlocked}
            className="dash-ai-btn dash-ai-btn--news"
            title={newsBlocked ? newsHint : undefined}
          >
            {loadingNews ? '⏳ กำลังสรุป...' : newsBlocked ? 'ใช้ครบโควต้าแล้ว' : '📋 สรุปข่าว'}
          </button>
        </div>

        {newsError && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '12px' }}>{newsError}</p>}
        {!newsSummary && !loadingNews && emptyState('📰', newsBlocked ? (newsHint || 'ใช้ครบโควต้าสัปดาห์นี้แล้ว') : 'กด "สรุปข่าว" เพื่อให้ Claude สรุปข่าวที่พูดถึงหุ้นในพอร์ต')}
        {loadingNews && emptyState('⏳', 'Claude กำลังอ่านและสรุปข่าว...')}

        {newsSummary && (
          <div>
            {newsSummary.summary && (
              <p className="dash-text-secondary" style={{ fontSize: '13px', lineHeight: 1.7, marginBottom: '14px' }}>{newsSummary.summary}</p>
            )}
            {newsSummary.mentionedTickers?.length > 0 && (
              <p className="dash-text-muted" style={{ fontSize: '12px', marginBottom: '12px' }}>
                หุ้นในพอร์ตที่ข่าวพูดถึง: <strong>{newsSummary.mentionedTickers.join(', ')}</strong>
              </p>
            )}
            {newsSummary.newsItems?.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                {newsSummary.newsItems.map((n) => (
                  <div key={n.id} style={{ padding: '6px 0 6px 12px', borderLeft: '2px solid var(--accent-text)', marginBottom: '8px' }}>
                    {n.gist && <p className="dash-text-secondary" style={{ fontSize: '13px', margin: '0 0 3px' }}>{n.gist}</p>}
                    <p className="dash-text-muted" style={{ fontSize: '11px', margin: 0 }}>
                      {n.tickers?.length > 0 && <strong>{n.tickers.join(', ')} · </strong>}
                      {n.url
                        ? <a href={n.url} target="_blank" rel="noopener noreferrer" className="dash-text-accent">{n.title}</a>
                        : n.title}
                      {n.source && ` · ${n.source}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {newsSummary.readMore?.length > 0 && (
              <div className="dash-inset" style={{ padding: '12px' }}>
                <div className="dash-text-muted" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>🔍 ประเด็นที่อาจอยากอ่านเพิ่ม</div>
                {newsSummary.readMore.map((q, i) => (
                  <div key={i} className="dash-text-secondary" style={{ fontSize: '13px', marginBottom: '4px' }}>• {q}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
