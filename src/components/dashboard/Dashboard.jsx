import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../../lib/api'
import PortfolioReport from '../PortfolioReport'
import OnboardingModal, { isOnboardingDone, markOnboardingDone } from '../OnboardingModal'
import NewsCard from '../news/NewsCard'
import DonutChart from '../charts/DonutChart'
import Treemap from '../charts/Treemap'
import SectorAreaChart from '../charts/SectorAreaChart'
import PortfolioChart from '../charts/PortfolioChart'
import AIPanel from './AIPanel'
import AIDrawer from './AIDrawer'
import HoldingModal from '../modals/HoldingModal'
import JournalModal from '../modals/JournalModal'
import TransactionModal from '../modals/TransactionModal'
import DividendModal from '../modals/DividendModal'
import ImportCsvModal from '../modals/ImportCsvModal'
import PortfolioManageModal from '../modals/PortfolioManageModal'
import SettingsModal from '../modals/SettingsModal'
import SupportModal from '../modals/SupportModal'
import TickerStoryModal from '../modals/TickerStoryModal'
import Modal from '../ui/Modal'
import Field from '../ui/Field'
import { btnPrimary, btnGhost, inp } from '../../lib/styles'
import { symFor, JOURNAL_TAGS as journalTags, CHART_RANGE_DAYS } from '../../lib/constants'
import { MASKED, fmtPct, fmtDate, isoDate, fmtShares } from '../../lib/format'
import { usePrivacy } from '../../lib/privacy'
import { journalDraftFromTransaction, isJournalPromptEnabled } from '../../lib/workflow'
import { computePortfolioPnL, sumDividends, computeTotalReturn } from '../../lib/pnl'
import WorkflowGuide from './WorkflowGuide'
import DashboardSidebar, { tabLabel } from './DashboardSidebar'
import ThemeToggle from '../ThemeToggle'

export default function Dashboard({user,onLogout,onUserUpdate,onOpenAdmin}){
  const [portfolios,setPortfolios]=useState([])
  const [activePortfolioId,setActivePortfolioId]=useState(null)
  const [portfolioHistory,setPortfolioHistory]=useState([])
  const [heatmapMode,setHeatmapMode]=useState('today')
  const [chartRange, setChartRange] = useState('3m')
  const [benchmarkMode, setBenchmarkMode] = useState('auto')
  const [benchmarkData, setBenchmarkData] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [newPortName,setNewPortName]=useState('')
  const [holdings,setHoldings]=useState([])
  const [allHoldings,setAllHoldings]=useState([])
  const [journal,setJournal]=useState([])
  const [transactions,setTransactions]=useState([])
  const [dividends,setDividends]=useState([])
  const [prices,setPrices]=useState({})
  const [tab,setTab]=useState('overview')
  const [modal,setModal]=useState(null)
  const [editH,setEditH]=useState(null)
  const [editJ,setEditJ]=useState(null)
  const [editT,setEditT]=useState(null)
  const [editDiv,setEditDiv]=useState(null)
  const [journalDraft,setJournalDraft]=useState(null)
  const [loadingP,setLoadingP]=useState(false)
  const [displayCurrency,setDisplayCurrency]=useState('USD')
  const { hideValues, toggleHideValues } = usePrivacy()
  const [journalFilter,setJournalFilter]=useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [inSectorNews, setInSectorNews] = useState([])
  const [outSectorNews, setOutSectorNews] = useState([])
  const [selectedTicker, setSelectedTicker] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  const fxRate=prices['USDTHB=X']||35
  const pid=activePortfolioId

  const fetchPortfolios=useCallback(async()=>{
    const p=await api.get('/portfolios')
    const list=Array.isArray(p)?p:[]
    setPortfolios(list)
    if(list.length){
      const batches=await Promise.all(list.map((port)=>(
        api.get('/holdings',{portfolio_id:port.id}).then((h)=>(
          (Array.isArray(h)?h:[]).map((x)=>({...x,portfolio_id:port.id}))
        ))
      )))
      setAllHoldings(batches.flat())
    }else setAllHoldings([])
    if(list.length&&!activePortfolioId){
      const def=list.find(x=>x.is_default)||list[0]
      setActivePortfolioId(Number(def.id))
    }
    return list
  },[activePortfolioId])

  const fetchAll=useCallback(async(portfolioId)=>{
    const id=portfolioId||activePortfolioId
    if(!id) return []
    const params={portfolio_id:id}
    const [h,j,t,d]=await Promise.all([
      api.get('/holdings',params),api.get('/journal',params),api.get('/transactions',params),api.get('/dividends',params)
    ])
    const hl=Array.isArray(h)?h:[]
    setHoldings(hl);setJournal(Array.isArray(j)?j:[]);setTransactions(Array.isArray(t)?t:[]);setDividends(Array.isArray(d)?d:[])
    setAllHoldings(prev=>{
      const others=prev.filter(x=>Number(x.portfolio_id)!==Number(id))
      return [...others,...hl.map(x=>({...x,portfolio_id:Number(id)}))]
    })
    setDataReady(true)
    return hl
  },[activePortfolioId])

  const fetchHistory=useCallback(async(portfolioId, range = chartRange)=>{
    if(!portfolioId) return
    setLoadingHistory(true)
    try {
      const days = CHART_RANGE_DAYS[range] ?? 90
      const r = await api.get(`/portfolios/${portfolioId}/history`, { days, benchmark: benchmarkMode })
      if (Array.isArray(r)) {
        setPortfolioHistory(r)
        setBenchmarkData(null)
      } else {
        setPortfolioHistory(Array.isArray(r.history) ? r.history : [])
        setBenchmarkData(r.benchmark || null)
      }
    } catch (e) {
      console.error('History fetch error:', e)
    }
    setLoadingHistory(false)
  },[chartRange, benchmarkMode])

  const recordSnapshot=useCallback(async(portfolioId,hl,pricesMap)=>{
    if(!portfolioId||!hl?.length) return
    const getVal=h=>{
      const p=pricesMap[h.ticker]||Number(h.avg_cost)
      return Number(h.shares)*p
    }
    const getCost=h=>Number(h.shares)*Number(h.avg_cost)
    const totalValue=hl.reduce((s,h)=>s+getVal(h),0)
    const totalCost=hl.reduce((s,h)=>s+getCost(h),0)
    const sectorMap={}
    hl.forEach(h=>{
      const s=h.sector||'Other'
      sectorMap[s]=(sectorMap[s]||0)+getVal(h)
    })
    const sectorData=Object.entries(sectorMap).map(([sector,value])=>({
      sector,pct:totalValue>0?(value/totalValue)*100:0
    }))
    await api.post(`/portfolios/${portfolioId}/snapshot`,{total_value:totalValue,total_cost:totalCost,sector_data:sectorData})
    fetchHistory(portfolioId)
  },[fetchHistory])

  const fetchPricesForHoldings=useCallback(async(hl,portList,portfolioIdForSnapshot)=>{
    if(!hl?.length) return
    setLoadingP(true)
    try{
      const params=new URLSearchParams()
      params.set('tickers',hl.map(h=>h.ticker).join(','))
      params.set('markets',hl.map(h=>h.market||'').join(','))
      params.set('currencies',hl.map(h=>h.currency||'').join(','))
      params.set('portfolio_currencies',hl.map(h=>{
        const port=portList.find(x=>Number(x.id)===Number(h.portfolio_id))
        return port?.currency||'USD'
      }).join(','))
      const r=await fetch(`/api/prices?${params}`)
      const p=await r.json()
      setPrices(prev=>({...prev,...p}))
      if(portfolioIdForSnapshot){
        const snapHl=hl.filter(h=>Number(h.portfolio_id)===Number(portfolioIdForSnapshot))
        if(snapHl.length) await recordSnapshot(portfolioIdForSnapshot,snapHl,p)
      }
    }catch(e){}
    setLoadingP(false)
  },[recordSnapshot])

  const fetchPrices=useCallback(async(hl,portfolioId)=>{
    if(!hl?.length) return
    const tagged=hl.map(h=>({...h,portfolio_id:h.portfolio_id||portfolioId}))
    await fetchPricesForHoldings(tagged,portfolios,portfolioId)
  },[fetchPricesForHoldings, portfolios])

  useEffect(()=>{
    if(!allHoldings.length||!portfolios.length) return
    fetchPricesForHoldings(allHoldings,portfolios,null)
  },[allHoldings.length, portfolios.length])

  const loadClientNews = useCallback(async (hl) => {
    if (!hl?.length) return
    try {
      const sectors = hl.map(h => h.sector || '').filter(Boolean).join(',')
      const tickers = hl.map(h => h.ticker).join(',')
      const res = await api.fetch(`/news/dashboard`,{sectors,tickers})
      if (!res.ok) return
      const data = await res.json()
      setInSectorNews(data.inSectorNews || [])
      setOutSectorNews(data.outSectorNews || [])
    } catch (e) {
      console.error('News fetch error:', e)
    }
  }, [])

  const handleOpenTickerStory = (ticker) => setSelectedTicker(ticker)

  const createPortfolio=async()=>{
    if(!newPortName.trim()) return
    const r=await api.post('/portfolios',{name:newPortName.trim()})
    if(r.id){
      setNewPortName('')
      setModal(null)
      await fetchPortfolios()
      setActivePortfolioId(Number(r.id))
    }
  }

  const handlePortfolioDeleted=async(deletedId)=>{
    const list=await fetchPortfolios()
    const def=list.find(x=>x.is_default)||list[0]
    if(def) setActivePortfolioId(Number(def.id))
    else if(list.length) setActivePortfolioId(Number(list[0].id))
    if(def||list[0]) fetchAll(Number((def||list[0]).id))
  }

  useEffect(()=>{ fetchPortfolios() },[])

  useEffect(()=>{
    if(!activePortfolioId) return
    fetchAll(activePortfolioId).then(hl=>{
      fetchPrices(hl,activePortfolioId)
      loadClientNews(hl)
    })
    const priceInterval=setInterval(()=>{
      if(holdings.length>0) fetchPrices(holdings,activePortfolioId)
    },5*60*1000)
    const newsInterval=setInterval(()=>{
      if(holdings.length>0) loadClientNews(holdings)
    },15*60*1000)
    return()=>{clearInterval(priceInterval);clearInterval(newsInterval)}
  },[activePortfolioId])

  useEffect(() => {
    if (!activePortfolioId) return
    fetchHistory(activePortfolioId, chartRange)
  }, [activePortfolioId, chartRange, benchmarkMode, fetchHistory])

  useEffect(() => {
    if (!user?.id || !dataReady || !activePortfolioId) return
    if (holdings.length > 0 || transactions.length > 0) {
      markOnboardingDone(user.id)
      setShowOnboarding(false)
      return
    }
    if (!isOnboardingDone(user.id)) setShowOnboarding(true)
  }, [user, dataReady, activePortfolioId, holdings.length, transactions.length])

  const delH=async id=>{if(!confirm('ลบ holding นี้?'))return;await api.delete(`/holdings/${id}`);fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}
  const delJ=async id=>{if(!confirm('ลบ journal entry?'))return;await api.delete(`/journal/${id}`);fetchAll(activePortfolioId)}
  const delT=async id=>{if(!confirm('ลบ transaction นี้?'))return;await api.delete(`/transactions/${id}`);fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}
  const delDiv=async id=>{if(!confirm('ลบรายการปันผลนี้?'))return;await api.delete(`/dividends/${id}`);fetchAll(activePortfolioId)}

  const handleTxSaved=async(tx,{isNew})=>{
    const hl=await fetchAll(activePortfolioId)
    await fetchPrices(hl,activePortfolioId)
    if(isNew&&tx?.id&&isJournalPromptEnabled(user?.id)){
      setJournalDraft(journalDraftFromTransaction(tx))
      setModal('j')
    }
  }

  const convertToDisplay=(amount,currency)=>{
    if(displayCurrency==='THB') return currency==='THB'?amount:amount*fxRate
    return currency==='THB'?amount/fxRate:amount
  }

  const portfolioInvested=(p)=>{
    if(p.invested_thb!=null||p.invested_usd!=null){
      return convertToDisplay(Number(p.invested_usd||0),'USD')
        +convertToDisplay(Number(p.invested_thb||0),'THB')
    }
    return convertToDisplay(Number(p.total_invested||0),p.currency||'USD')
  }

  const getVal=useCallback(h=>{
    const p=prices[h.ticker]||Number(h.avg_cost),v=Number(h.shares)*p
    return convertToDisplay(v,h.currency||'USD')
  },[prices,displayCurrency,fxRate])

  const getCost=useCallback(h=>{
    const v=Number(h.shares)*Number(h.avg_cost)
    return convertToDisplay(v,h.currency||'USD')
  },[displayCurrency,fxRate])

  const totVal=holdings.reduce((s,h)=>s+getVal(h),0)
  const totCost=holdings.reduce((s,h)=>s+getCost(h),0)
  const totPnL=totVal-totCost
  const totPct=totCost>0?(totPnL/totCost)*100:0

  const sym=symFor(displayCurrency)
  const fmt=n=>sym+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})

  const { realized, unrealized, total: totalPnL, hasRealized } = computePortfolioPnL({
    transactions,
    holdings,
    prices,
    convert: convertToDisplay,
  })

  const yearStart=`${new Date().getFullYear()}-01-01`
  const sumDivList=(list)=>sumDividends(list, convertToDisplay)
  const dividendYtd=sumDivList(dividends.filter(d=>isoDate(d.pay_date)>=yearStart))
  const dividendAll=sumDivList(dividends)
  const divYieldPct=totCost>0&&dividendYtd>0?(dividendYtd/totCost)*100:0

  const { totalReturn, hasDividends } = computeTotalReturn(totalPnL, dividendAll)
  const returnPct=totCost>0?(totalReturn/totCost)*100:0

  const pnlKpiLabel=hasDividends?'ผลตอบแทนรวม':'กำไร/ขาดทุน (พอร์ตนี้)'
  const pnlKpiVal=hideValues
    ? fmtPct(hasDividends?returnPct:totPct)
    : fmt(hasDividends?totalReturn:totalPnL)
  const pnlKpiTone=(hasDividends?totalReturn:totalPnL)>=0?'gain':'loss'
  const pnlKpiSub=hideValues
    ? 'จากทุน'
    : hasDividends
      ? `${hasRealized?`ราคา: ขายแล้ว ${fmt(realized)} · ถืออยู่ ${fmt(unrealized)}`:`จากราคา ${fmt(totalPnL)}`} · ปันผล ${fmt(dividendAll)}`
      : hasRealized
        ? `ขายแล้ว ${fmt(realized)} · ถืออยู่ ${fmt(unrealized)}`
        : `${totPct >= 0 ? '+' : ''}${totPct.toFixed(2)}% จากทุน`

  const allInvested=portfolios.reduce((s,p)=>s+portfolioInvested(p),0)
  const allPortValue=allHoldings.reduce((s,h)=>{
    const p=prices[h.ticker]||Number(h.avg_cost)
    return s+convertToDisplay(Number(h.shares)*p,h.currency||'USD')
  },0)
  const activePort=portfolios.find(p=>p.id===activePortfolioId)

  const firstTxDate = useMemo(() => {
    if (!transactions.length) return null
    let min = null
    for (const t of transactions) {
      const d = isoDate(t.date)
      if (d && (!min || d < min)) min = d
    }
    return min
  }, [transactions])

  const fmtMoney=(n)=>hideValues?MASKED:fmt(n)
  const fmtTx=(t,n)=>{
    if(hideValues) return MASKED
    return fmt(convertToDisplay(Number(n), t.currency||'USD'))
  }
  const ccyChip=(ccy='USD')=>{
    const c=ccy||'USD'
    const tone=c==='USD'?'usd':c==='THB'?'thb':'other'
    return <span className={`dash-currency-chip dash-currency-chip--${tone}`}>{symFor(c)} {c}</span>
  }
  const fmtDiv=(d)=>hideValues?MASKED:fmt(convertToDisplay(Number(d.amount), d.currency||'THB'))

  const aBtn = (label, onClick, variant = 'accent') => (
    <button
      type="button"
      onClick={onClick}
      className={`dash-action-btn${variant === 'danger' ? ' dash-action-btn--danger' : ''}`}
    >
      {label}
    </button>
  )

  const kpiTone = (tone) => {
    if (tone === 'gain') return 'dash-kpi-value--gain'
    if (tone === 'loss') return 'dash-kpi-value--loss'
    if (tone === 'accent') return 'dash-kpi-value--accent'
    if (tone === 'info') return 'dash-kpi-value--info'
    return ''
  }

  const filteredJournal=journalFilter?journal.filter(j=>j.tag===journalFilter):journal

  const filteredHoldings = holdings.filter(h => 
    h.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (h.name && h.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredTransactions = transactions.filter(t =>
    t.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.note && t.note.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const renderNewsGrid = () => (
    <div className="dash-news-grid">
      <div>
        <h3 className="dash-section-title">
          🔥 Real-Time News (เฉพาะกลุ่ม Sector ที่ถือ)
        </h3>
        {!inSectorNews.length ? <p className="dash-text-faint" style={{ fontSize: '13px' }}>กำลังอัปเดตข่าวสารจากระบบ...</p>
        : inSectorNews.map((article, idx) => <NewsCard key={idx} article={article} />)}
      </div>
      <div>
        <h3 className="dash-section-title dash-section-title--muted">
          🌐 Market Insights (ข่าวน่าสนใจเกี่ยวกับหุ้นอื่นๆ)
        </h3>
        {!outSectorNews.length ? <p className="dash-text-faint" style={{ fontSize: '13px' }}>ไม่มีข้อมูลข่าวสารธุรกิจในขณะนี้</p>
        : outSectorNews.map((article, idx) => <NewsCard key={idx} article={article} />)}
      </div>
    </div>
  )

  const selectTab = (k) => {
    setTab(k)
    setSearchQuery('')
    setSidebarOpen(false)
  }

  const openAddTransaction = () => {
    setTab('transactions')
    setModal('tx')
    setSidebarOpen(false)
  }

  return(
    <div className="dash-shell">
      {sidebarOpen && (
        <button
          type="button"
          className="dash-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="ปิดเมนู"
        />
      )}

      <DashboardSidebar
        user={user}
        portfolios={portfolios}
        activePortfolioId={activePortfolioId}
        onPortfolioChange={setActivePortfolioId}
        tab={tab}
        onTabChange={selectTab}
        onManagePort={() => { setModal('managePort'); setSidebarOpen(false) }}
        onNewPort={() => { setModal('newPort'); setSidebarOpen(false) }}
        onAddTransaction={openAddTransaction}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="dash-main">
        <header className="dash-topbar">
          <div className="dash-topbar-left">
            <button
              type="button"
              className="dash-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="เปิดเมนู"
            >
              ☰
            </button>
            <h2 className="dash-topbar-title">{tabLabel(tab)}</h2>
          </div>
          <div className="dash-topbar-actions">
            <div className="dash-segment dash-currency-toggle">
              {['USD', 'THB'].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`dash-segment-btn${displayCurrency === c ? ' dash-segment-btn--active' : ''}`}
                  onClick={() => setDisplayCurrency(c)}
                >
                  {c === 'USD' ? '$ USD' : '฿ THB'}
                </button>
              ))}
            </div>
            <ThemeToggle />
            <div className="dash-header-util" role="group" aria-label="เมนูบัญชี">
              <button
                type="button"
                className={`dash-util-btn dash-util-btn--ai${aiOpen ? ' dash-util-btn--active' : ''}`}
                onClick={() => setAiOpen((v) => !v)}
                title="เปิด AI Copilot"
                aria-label="AI"
                aria-expanded={aiOpen}
              >
                🤖 AI
              </button>
              <button
                type="button"
                className={`dash-util-btn${hideValues ? ' dash-util-btn--active' : ''}`}
                onClick={toggleHideValues}
                title={hideValues ? 'แสดงมูลค่าเงินทั้งหมด' : 'ซ่อนมูลค่าเงิน — แสดงแค่ %'}
                aria-label={hideValues ? 'แสดงมูลค่า' : 'ซ่อนมูลค่า'}
                aria-pressed={hideValues}
              >
                {hideValues ? 'แสดงมูลค่า' : 'ซ่อนมูลค่า'}
              </button>
              <button type="button" className="dash-util-btn dash-util-btn--help" onClick={() => setModal('support')} title="ช่วยเหลือ / แจ้งปัญหา" aria-label="ช่วยเหลือ">ช่วยเหลือ</button>
              <button type="button" className="dash-util-btn" onClick={() => setModal('settings')} title="ตั้งค่าบัญชี" aria-label="ตั้งค่าบัญชี">ตั้งค่า</button>
              {onOpenAdmin && (
                <button type="button" className="dash-util-btn dash-util-btn--admin" onClick={onOpenAdmin} title="Admin" aria-label="Admin">Admin</button>
              )}
              <button type="button" className="dash-util-btn dash-util-btn--logout" onClick={onLogout} title="ออกจากระบบ" aria-label="ออกจากระบบ">ออก</button>
            </div>
          </div>
        </header>

        <div className="dash-inner">
        {/* Overview */}
        {tab==='overview'&&<>
          <WorkflowGuide
            activeTab={tab}
            compact
            onGoTab={selectTab}
            onAddTransaction={openAddTransaction}
          />
          <div className="dash-kpi-grid">
            {[
              ['มูลค่าพอร์ตนี้', hideValues ? fmtPct(totPct) : fmt(totVal), `${holdings.length} holdings · ${activePort?.name||''}`, hideValues ? 'gain' : ''],
              [portfolios.length>1?'มูลค่ารวมทุกพอร์ต':'ทุนรวม (พอร์ตนี้)', hideValues ? MASKED : fmt(portfolios.length>1?allPortValue:totCost), portfolios.length>1?(hideValues?`${portfolios.length} พอร์ต`:`ทุนรวม ${fmt(allInvested)} · ${portfolios.length} พอร์ต`):'ราคาซื้อเฉลี่ย · ไม่รวมกำไร', hideValues?'':'accent'],
              [pnlKpiLabel, pnlKpiVal, pnlKpiSub, pnlKpiTone],
              dividends.length>0
                ? ['ปันผลรับปีนี้', hideValues ? MASKED : fmt(dividendYtd), hideValues ? `สะสม ${MASKED}` : `สะสม ${fmt(dividendAll)}${hasDividends&&!hideValues?` · รวม ~${returnPct.toFixed(2)}% ของทุน`:divYieldPct>0?` · yield ปีนี้ ~${divYieldPct.toFixed(2)}%`:''}`, 'gain']
                : ['USD/THB', hideValues ? MASKED : (loadingP ? 'กำลังโหลด...' : `$1 = ฿${fxRate.toFixed(2)}`), hideValues ? 'ซ่อนอยู่' : 'Real-time', hideValues ? '' : 'info'],
            ].map(([label,val,sub,tone],i)=>(
              <div key={i} className="dash-kpi-card">
                <div className="dash-kpi-label">{label}</div>
                <div className={`dash-kpi-value ${kpiTone(tone)}`}>{val}</div>
                <div className="dash-kpi-sub">{sub}</div>
              </div>
            ))}
          </div>
          {holdings.length>0&&<>
            <div className="dash-overview-charts">
              <PortfolioChart
                history={portfolioHistory}
                benchmark={benchmarkData}
                displayCurrency={displayCurrency}
                chartRange={chartRange}
                onChartRangeChange={setChartRange}
                benchmarkMode={benchmarkMode}
                onBenchmarkModeChange={setBenchmarkMode}
                loading={loadingHistory}
                firstTxDate={firstTxDate}
              />
              <DonutChart holdings={holdings} prices={prices} displayCurrency={displayCurrency} fxRate={fxRate}/>
            </div>
            <SectorAreaChart holdings={holdings} prices={prices} displayCurrency={displayCurrency} fxRate={fxRate}/>
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'8px',gap:'6px'}}>
              <span className="dash-text-muted" style={{fontSize:'12px',alignSelf:'center'}}>Heatmap:</span>
              {[['today','% วันนี้'],['invested','% จากทุน']].map(([k,l])=>(
                <button key={k} type="button" className={`dash-chart-segment-btn${heatmapMode===k?' dash-chart-segment-btn--active':''}`} onClick={()=>setHeatmapMode(k)}>{l}</button>
              ))}
            </div>
            <Treemap holdings={holdings} prices={prices} displayCurrency={displayCurrency} fxRate={fxRate} heatmapMode={heatmapMode}/>
            {renderNewsGrid()}
          </>}
          {holdings.length===0&&<div className="dash-empty-state">
            <p style={{fontSize:'36px',marginBottom:'12px'}}>📊</p>
            <p style={{fontSize:'14px',marginBottom:'20px'}}>เริ่มบันทึก Transaction แรกเพื่อสร้าง portfolio</p>
            <button type="button" onClick={openAddTransaction} style={{...btnPrimary,width:'auto',padding:'10px 24px'}}>+ บันทึก Transaction แรก</button>
          </div>}
        </>}

        {/* Report */}
        {tab==='report'&&(
          <PortfolioReport
            user={user}
            activePort={activePort}
            portfolios={portfolios}
            holdings={holdings}
            transactions={transactions}
            dividends={dividends}
            prices={prices}
            displayCurrency={displayCurrency}
            fxRate={fxRate}
            loadingP={loadingP}
            fmt={fmt}
            getVal={getVal}
            getCost={getCost}
            convertToDisplay={convertToDisplay}
            totVal={totVal}
            totCost={totCost}
            portfolioHistory={portfolioHistory}
          />
        )}

        {/* Holdings */}
        {tab==='holdings'&&<>
          <p className="dash-holdings-hint">
            กดที่ <strong>Ticker</strong> เพื่อดู Investment Thesis และ timeline ของหุ้น — ส่วนใหญ่ไม่ต้องใช้แท็บนี้ ยอดหุ้นอัปเดตจาก <button type="button" className="dash-link" onClick={()=>selectTab('transactions')}>Transactions</button> อัตโนมัติ
          </p>
          <div className="dash-toolbar">
            <div className="dash-toolbar-left">
              <p className="dash-text-muted" style={{fontSize:'13px',whiteSpace:'nowrap'}}>{filteredHoldings.length} / {holdings.length} holdings</p>
              <input type="text" className="dash-search" placeholder="ค้นหา Ticker หรือชื่อหุ้นในพอร์ต..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
            </div>
            <button onClick={()=>setModal('h')} style={{...btnPrimary,width:'auto',padding:'7px 16px',fontSize:'13px'}}>+ เพิ่ม Holding ตรงๆ</button>
          </div>
          <div className="dash-table-wrap">
            <table className="dash-table dash-table--holdings">
              <thead><tr style={{borderBottom:'1px solid var(--border)'}}>
                {['Ticker','ชื่อ','Shares','สกุลเงิน','Avg Cost','ราคาปัจจุบัน',`มูลค่า (${displayCurrency})`,`กำไร/ขาดทุน (${displayCurrency})`,''].map((h,i)=>(
                  <th key={i} className="dash-text-muted" style={{padding:'11px 13px',textAlign:'left',fontWeight:400,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredHoldings.length===0?<tr><td colSpan={9} className="dash-text-faint" style={{padding:'28px',textAlign:'center'}}>ไม่พบรายการ holdings</td></tr>
                :filteredHoldings.map(h=>{
                  const cur=prices[h.ticker]||Number(h.avg_cost)
                  const val=getVal(h),cost=getCost(h),pnl=val-cost,pct=cost>0?(pnl/cost)*100:0
                  const os=symFor(h.currency||'USD')
                  return(<tr key={h.id} style={{borderBottom:'1px solid var(--border-subtle)'}}>
                    <td data-label="Ticker" className="dash-text-accent" style={{padding:'11px 13px',fontWeight:600,cursor:'pointer',textDecoration:'underline'}} onClick={() => handleOpenTickerStory(h.ticker)} title="ดู Thesis & Timeline">{h.ticker}</td>
                    <td data-label="ชื่อ" className="dash-text-muted" style={{padding:'11px 13px'}}>{h.name||'—'}</td>
                    <td data-label="Shares" style={{padding:'11px 13px'}}>{fmtShares(h.shares)}</td>
                    <td data-label="สกุลเงิน" style={{padding:'11px 13px'}}><span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'999px',background:h.currency==='USD'?'#1a2a4a':'#1a3a2a',color:h.currency==='USD'?'#74b9ff':'#55efc4'}}>{h.currency}</span></td>
                    <td data-label="Avg Cost" className="dash-text-muted" style={{padding:'11px 13px'}}>{hideValues?MASKED:`${os}${Number(h.avg_cost).toLocaleString('en-US',{minimumFractionDigits:2})}`}</td>
                    <td data-label="ราคาปัจจุบัน" style={{padding:'11px 13px'}}>{hideValues?MASKED:`${os}${Number(cur).toLocaleString('en-US',{minimumFractionDigits:2})}`}</td>
                    <td data-label={`มูลค่า (${displayCurrency})`} style={{padding:'11px 13px'}}>{fmtMoney(val)}</td>
                    <td data-label={`กำไร/ขาดทุน (${displayCurrency})`} className={pnl>=0?'dash-text-gain':'dash-text-loss'} style={{padding:'11px 13px'}}>
                      {hideValues ? fmtPct(pct) : <>{fmt(pnl)}<span style={{fontSize:'11px',marginLeft:'4px'}}>({pct>=0?'+':''}{pct.toFixed(2)}%)</span></>}
                    </td>
                    <td data-label="" style={{padding:'11px 13px',whiteSpace:'nowrap'}}>
                      {aBtn('แก้ไข',()=>{setEditH(h);setModal('eh')})}
                      {aBtn('ลบ',()=>delH(h.id),'danger')}
                    </td>
                  </tr>)
                })}
              </tbody>
            </table>
          </div>
        </>}

        {/* Transactions */}
        {tab==='transactions'&&<>
          <WorkflowGuide
            activeTab={tab}
            onGoTab={selectTab}
            onAddTransaction={() => { setModal('tx'); setSidebarOpen(false) }}
          />
          <div className="dash-toolbar">
            <div className="dash-toolbar-left">
              <p className="dash-text-muted" style={{fontSize:'13px',whiteSpace:'nowrap'}}>{filteredTransactions.length} / {transactions.length} transactions</p>
              <input type="text" className="dash-search" placeholder="ค้นหา Ticker หรือข้อความ..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
            </div>
            <div className="dash-toolbar-actions">
              <div className="dash-segment dash-currency-toggle dash-currency-toggle--toolbar" title="สกุลเงินแสดงผล">
                {['USD', 'THB'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`dash-segment-btn${displayCurrency === c ? ' dash-segment-btn--active' : ''}`}
                    onClick={() => setDisplayCurrency(c)}
                  >
                    {c === 'USD' ? '$ USD' : '฿ THB'}
                  </button>
                ))}
              </div>
              <button type="button" onClick={()=>setModal('import')} style={{...btnGhost,width:'auto',padding:'7px 16px',fontSize:'13px',borderColor:'var(--accent)',color:'var(--accent-text)'}}>Import CSV</button>
              <button onClick={()=>setModal('tx')} style={{...btnPrimary,width:'auto',padding:'7px 16px',fontSize:'13px'}}>+ บันทึก Transaction</button>
            </div>
          </div>
          <div className="dash-table-wrap">
            <table className="dash-table dash-table--transactions">
              <thead><tr style={{borderBottom:'1px solid var(--border)'}}>
                {['วันที่','Ticker','ประเภท','สกุลเงิน','Shares',`ราคา/หุ้น (${displayCurrency})`,`มูลค่ารวม (${displayCurrency})`,`ค่าธรรมเนียม (${displayCurrency})`,'หมายเหตุ',''].map((h,i)=>(
                  <th key={i} className="dash-text-muted" style={{padding:'11px 13px',textAlign:'left',fontWeight:400}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredTransactions.length===0?<tr><td colSpan={10} className="dash-text-faint" style={{padding:'28px',textAlign:'center'}}>ไม่พบรายการ transactions</td></tr>
                :filteredTransactions.map(t=>(
                  <tr key={t.id} style={{borderBottom:'1px solid var(--border-subtle)'}}>
                    <td data-label="วันที่" className="dash-text-muted" style={{padding:'11px 13px'}}>{fmtDate(t.date)}</td>
                    <td data-label="Ticker" className="dash-text-accent" style={{padding:'11px 13px',fontWeight:600,cursor:'pointer',textDecoration:'underline'}} onClick={() => handleOpenTickerStory(t.ticker)} title="ดู Thesis & Timeline">{t.ticker}</td>
                    <td data-label="ประเภท" style={{padding:'11px 13px'}}><span style={{fontSize:'11px',padding:'2px 9px',borderRadius:'999px',background:t.type==='BUY'?'#1a3a2a':'#3a1a1a',color:t.type==='BUY'?'#55efc4':'#ff7675'}}>{t.type}</span></td>
                    <td data-label="สกุลเงิน" style={{padding:'11px 13px'}}>{ccyChip(t.currency)}</td>
                    <td data-label="Shares" style={{padding:'11px 13px'}}>{fmtShares(t.shares)}</td>
                    <td data-label="ราคา/หุ้น" style={{padding:'11px 13px'}}>{fmtTx(t,t.price)}</td>
                    <td data-label="มูลค่ารวม" style={{padding:'11px 13px',fontWeight:500}}>{fmtTx(t,t.total)}</td>
                    <td data-label="ค่าธรรมเนียม" className="dash-text-muted" style={{padding:'11px 13px'}}>
                      {Number(t.fee) > 0 ? fmtTx(t, t.fee) : '—'}
                    </td>
                    <td data-label="หมายเหตุ" className="dash-text-muted" style={{padding:'11px 13px'}}>{t.note||'—'}</td>
                    <td data-label="" style={{padding:'11px 13px',whiteSpace:'nowrap'}}>
                      {aBtn('แก้ไข',()=>{setEditT(t);setModal('et')})}
                      {aBtn('ลบ',()=>delT(t.id),'danger')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* Dividends */}
        {tab==='dividends'&&<>
          <div className="dash-kpi-grid" style={{marginBottom:'16px'}}>
            {[
              ['ปันผลรับปีนี้', hideValues ? MASKED : fmt(dividendYtd), `ปี ${new Date().getFullYear()}`, 'gain'],
              ['ปันผลสะสมทั้งหมด', hideValues ? MASKED : fmt(dividendAll), hideValues ? `${dividends.length} รายการ` : (hasDividends ? `รวมกับกำไรจากราคา ~${returnPct.toFixed(2)}% ของทุน` : `${dividends.length} รายการ`), hasDividends?'gain':'accent'],
              ['Yield จากทุน (ปีนี้)', hideValues ? MASKED : (divYieldPct>0?`${divYieldPct.toFixed(2)}%`:'—'), totCost>0?'ประมาณจากทุนพอร์ตนี้':'ยังไม่มีทุน', divYieldPct>0?'gain':''],
            ].map(([label,val,sub,tone],i)=>(
              <div key={i} className="dash-kpi-card">
                <div className="dash-kpi-label">{label}</div>
                <div className={`dash-kpi-value ${kpiTone(tone)}`}>{val}</div>
                <div className="dash-kpi-sub">{sub}</div>
              </div>
            ))}
          </div>
          <div className="dash-toolbar">
            <p className="dash-text-muted" style={{fontSize:'13px'}}>{dividends.length} รายการปันผล</p>
            <button type="button" onClick={()=>setModal('div')} style={{...btnPrimary,width:'auto',padding:'7px 16px',fontSize:'13px'}}>+ บันทึกเงินปันผล</button>
          </div>
          <div className="dash-table-wrap">
            <table className="dash-table dash-table--dividends">
              <thead><tr style={{borderBottom:'1px solid var(--border)'}}>
                {['วันที่รับ','Ticker','สกุลเงิน','จำนวนเงิน','หุ้น ณ วันจ่าย','หมายเหตุ',''].map((h,i)=>(
                  <th key={i} className="dash-text-muted" style={{padding:'11px 13px',textAlign:'left',fontWeight:400}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {dividends.length===0?<tr><td colSpan={7} className="dash-text-faint" style={{padding:'40px',textAlign:'center'}}>
                  ยังไม่มีรายการปันผล — กด &quot;+ บันทึกเงินปันผล&quot; เพื่อเริ่มติดตามรายได้จากหุ้นปันผล
                </td></tr>
                :dividends.map(d=>(
                  <tr key={d.id} style={{borderBottom:'1px solid var(--border-subtle)'}}>
                    <td data-label="วันที่รับ" className="dash-text-muted" style={{padding:'11px 13px'}}>{fmtDate(d.pay_date)}</td>
                    <td data-label="Ticker" className="dash-text-accent" style={{padding:'11px 13px',fontWeight:600,cursor:'pointer',textDecoration:'underline'}} onClick={() => handleOpenTickerStory(d.ticker)} title="ดู Thesis & Timeline">{d.ticker}</td>
                    <td data-label="สกุลเงิน" style={{padding:'11px 13px'}}>{ccyChip(d.currency)}</td>
                    <td data-label="จำนวนเงิน" className="dash-text-gain" style={{padding:'11px 13px',fontWeight:500}}>{fmtDiv(d)}</td>
                    <td data-label="หุ้น ณ วันจ่าย" style={{padding:'11px 13px'}}>{d.shares_held ? fmtShares(d.shares_held) : '—'}</td>
                    <td data-label="หมายเหตุ" className="dash-text-muted" style={{padding:'11px 13px'}}>{d.note||'—'}</td>
                    <td data-label="" style={{padding:'11px 13px',whiteSpace:'nowrap'}}>
                      {aBtn('แก้ไข',()=>{setEditDiv(d);setModal('ediv')})}
                      {aBtn('ลบ',()=>delDiv(d.id),'danger')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* Journal */}
        {tab==='journal'&&<>
          <div className="dash-toolbar">
            <div className="dash-toolbar-left">
              <p className="dash-text-muted" style={{fontSize:'13px'}}>{filteredJournal.length} entries</p>
              <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                <button type="button" onClick={()=>setJournalFilter('')} className={`dash-chart-segment-btn${journalFilter===''?' dash-chart-segment-btn--active':''}`} style={{borderRadius:'999px'}}>ทั้งหมด</button>
                {journalTags.map(tag=>(
                  <button key={tag} type="button" onClick={()=>setJournalFilter(journalFilter===tag?'':tag)} className={`dash-chart-segment-btn${journalFilter===tag?' dash-chart-segment-btn--active':''}`} style={{borderRadius:'999px'}}>{tag}</button>
                ))}
              </div>
            </div>
            <button onClick={()=>{setJournalDraft(null);setModal('j')}} style={{...btnPrimary,width:'auto',padding:'7px 16px',fontSize:'13px'}}>+ เขียน Journal</button>
          </div>
          {filteredJournal.length===0?<p className="dash-text-faint" style={{fontSize:'13px',textAlign:'center',padding:'40px'}}>ไม่มี entry {journalFilter?`ใน tag "${journalFilter}"`:''}</p>
          :filteredJournal.map(j=>(
            <div key={j.id} className="dash-journal-card">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                <div className="dash-journal-meta">
                  <span className="dash-text-faint" style={{fontSize:'12px'}}>{fmtDate(j.date)}</span>
                  {j.tag&&<span className="dash-tag">{j.tag}</span>}
                  {j.tickers&&j.tickers.split(',').map(t=>(
                    <button key={t} type="button" className="dash-ticker-chip dash-ticker-chip--link" onClick={()=>handleOpenTickerStory(t.trim())}>{t.trim()}</button>
                  ))}
                </div>
                <div style={{flexShrink:0}}>
                  {aBtn('แก้ไข',()=>{setEditJ(j);setModal('ej')})}
                  {aBtn('ลบ',()=>delJ(j.id),'danger')}
                </div>
              </div>
              {j.title&&<p style={{fontWeight:600,marginBottom:'6px',fontSize:'15px'}}>{j.title}</p>}
              <p style={{fontSize:'14px',color:'var(--text-secondary)',lineHeight:1.8,whiteSpace:'pre-wrap'}}>{j.content}</p>
            </div>
          ))}
        </>}

        {/* News Tab Section */}
        {tab==='news' && renderNewsGrid()}

        </div>

        <AIDrawer open={aiOpen} onClose={() => setAiOpen(false)}>
          <AIPanel
            variant="drawer"
            holdings={holdings}
            prices={prices}
            displayCurrency={displayCurrency}
            fxRate={fxRate}
            inSectorNews={inSectorNews}
            transactions={transactions}
            journal={journal}
          />
        </AIDrawer>

        {holdings.length > 0 && !aiOpen && (
          <button
            type="button"
            className="dash-ai-fab"
            onClick={() => setAiOpen(true)}
            aria-label="เปิด AI"
            title="เปิด AI Copilot"
          >
            🤖
          </button>
        )}
      </div>

      {showOnboarding && (
        <OnboardingModal
          user={user}
          activePort={activePort}
          onClose={() => setShowOnboarding(false)}
          onRename={() => fetchPortfolios()}
          onAddTransaction={openAddTransaction}
          onImportCsv={() => { selectTab('transactions'); setModal('import') }}
          onSetTab={selectTab}
        />
      )}

      {modal==='h'&&<HoldingModal portfolioId={activePortfolioId} onClose={()=>setModal(null)} onSave={()=>fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}/>}
      {modal==='eh'&&editH&&<HoldingModal portfolioId={activePortfolioId} holding={editH} onClose={()=>{setModal(null);setEditH(null)}} onSave={()=>fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}/>}
      {modal==='j'&&(
        <JournalModal
          portfolioId={activePortfolioId}
          userId={user?.id}
          initial={journalDraft}
          fromTransaction={!!journalDraft}
          onClose={()=>{setModal(null);setJournalDraft(null)}}
          onSave={()=>{setJournalDraft(null);fetchAll(activePortfolioId)}}
        />
      )}
      {modal==='ej'&&editJ&&<JournalModal portfolioId={activePortfolioId} entry={editJ} onClose={()=>{setModal(null);setEditJ(null)}} onSave={()=>fetchAll(activePortfolioId)}/>}
      {modal==='import'&&(
        <ImportCsvModal
          portfolioId={activePortfolioId}
          onClose={()=>setModal(null)}
          onSave={()=>fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}
        />
      )}
      {modal==='tx'&&<TransactionModal portfolioId={activePortfolioId} holdings={holdings} onClose={()=>setModal(null)} onSave={handleTxSaved}/>}
      {modal==='et'&&editT&&<TransactionModal portfolioId={activePortfolioId} transaction={editT} holdings={holdings} onClose={()=>{setModal(null);setEditT(null)}} onSave={async()=>{await fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}}/>}
      {modal==='div'&&<DividendModal portfolioId={activePortfolioId} holdings={holdings} onClose={()=>setModal(null)} onSave={()=>fetchAll(activePortfolioId)}/>}
      {modal==='ediv'&&editDiv&&<DividendModal portfolioId={activePortfolioId} dividend={editDiv} holdings={holdings} onClose={()=>{setModal(null);setEditDiv(null)}} onSave={()=>fetchAll(activePortfolioId)}/>}
      {modal==='newPort'&&(
        <Modal title="สร้างพอร์ตใหม่" onClose={()=>setModal(null)}>
          <Field label="ชื่อพอร์ต"><input style={inp()} placeholder="เช่น US Growth, หุ้นไทย" value={newPortName} onChange={e=>setNewPortName(e.target.value)}/></Field>
          <button onClick={createPortfolio} style={{...btnPrimary,marginTop:'8px'}}>สร้างพอร์ต</button>
        </Modal>
      )}
      {modal==='support'&&(
        <SupportModal onClose={()=>setModal(null)} />
      )}
      {modal==='settings'&&(
        <SettingsModal
          user={user}
          onClose={()=>setModal(null)}
          onUserUpdate={onUserUpdate}
          onLogout={onLogout}
          onOpenSupport={()=>setModal('support')}
        />
      )}
      {modal==='managePort'&&activePort&&(
        <PortfolioManageModal
          portfolio={activePort}
          portfolios={portfolios}
          onClose={()=>setModal(null)}
          onUpdated={()=>{fetchPortfolios();fetchHistory(activePortfolioId)}}
          onDeleted={handlePortfolioDeleted}
        />
      )}

      {selectedTicker && (
        <TickerStoryModal
          ticker={selectedTicker}
          portfolioId={activePortfolioId}
          holding={holdings.find((h) => h.ticker === selectedTicker) || allHoldings.find((h) => h.ticker === selectedTicker)}
          transactions={transactions}
          journal={journal}
          dividends={dividends}
          fmtTx={fmtTx}
          onClose={() => setSelectedTicker(null)}
        />
      )}
    </div>
  )
}