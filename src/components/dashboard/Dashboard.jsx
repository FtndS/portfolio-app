import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import PortfolioReport from '../PortfolioReport'
import OnboardingModal, { isOnboardingDone, markOnboardingDone } from '../OnboardingModal'
import NewsCard from '../news/NewsCard'
import DonutChart from '../charts/DonutChart'
import Treemap from '../charts/Treemap'
import SectorAreaChart from '../charts/SectorAreaChart'
import PortfolioChart from '../charts/PortfolioChart'
import AIPanel from './AIPanel'
import HoldingModal from '../modals/HoldingModal'
import JournalModal from '../modals/JournalModal'
import TransactionModal from '../modals/TransactionModal'
import ImportCsvModal from '../modals/ImportCsvModal'
import PortfolioManageModal from '../modals/PortfolioManageModal'
import SettingsModal from '../modals/SettingsModal'
import Modal from '../ui/Modal'
import Field from '../ui/Field'
import { btnPrimary, btnGhost, inp } from '../../lib/styles'
import { symFor, JOURNAL_TAGS as journalTags } from '../../lib/constants'

export default function Dashboard({user,onLogout,onUserUpdate}){
  const [portfolios,setPortfolios]=useState([])
  const [activePortfolioId,setActivePortfolioId]=useState(null)
  const [portfolioHistory,setPortfolioHistory]=useState([])
  const [heatmapMode,setHeatmapMode]=useState('today')
  const [newPortName,setNewPortName]=useState('')
  const [holdings,setHoldings]=useState([])
  const [journal,setJournal]=useState([])
  const [transactions,setTransactions]=useState([])
  const [prices,setPrices]=useState({})
  const [tab,setTab]=useState('overview')
  const [modal,setModal]=useState(null)
  const [editH,setEditH]=useState(null)
  const [editJ,setEditJ]=useState(null)
  const [editT,setEditT]=useState(null)
  const [loadingP,setLoadingP]=useState(false)
  const [displayCurrency,setDisplayCurrency]=useState('USD')
  const [journalFilter,setJournalFilter]=useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [inSectorNews, setInSectorNews] = useState([])
  const [outSectorNews, setOutSectorNews] = useState([])
  const [tickerNews, setTickerNews] = useState([])
  const [selectedTicker, setSelectedTicker] = useState(null)
  const [loadingNews, setLoadingNews] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [dataReady, setDataReady] = useState(false)

  const fxRate=prices['USDTHB=X']||35
  const pid=activePortfolioId

  const fetchPortfolios=useCallback(async()=>{
    const p=await api.get('/portfolios')
    const list=Array.isArray(p)?p:[]
    setPortfolios(list)
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
    const [h,j,t]=await Promise.all([
      api.get('/holdings',params),api.get('/journal',params),api.get('/transactions',params)
    ])
    const hl=Array.isArray(h)?h:[]
    setHoldings(hl);setJournal(Array.isArray(j)?j:[]);setTransactions(Array.isArray(t)?t:[])
    setDataReady(true)
    return hl
  },[activePortfolioId])

  const fetchHistory=useCallback(async(portfolioId)=>{
    if(!portfolioId) return
    const h=await api.get(`/portfolios/${portfolioId}/history`,{days:90})
    setPortfolioHistory(Array.isArray(h)?h:[])
  },[])

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

  const fetchPrices=useCallback(async(hl,portfolioId)=>{
    if(!hl?.length) return
    const portCur=portfolios.find(p=>Number(p.id)===Number(portfolioId))?.currency||'USD'
    setLoadingP(true)
    try{
      const params=new URLSearchParams()
      params.set('tickers',hl.map(h=>h.ticker).join(','))
      params.set('markets',hl.map(h=>h.market||'').join(','))
      params.set('currencies',hl.map(h=>h.currency||'').join(','))
      params.set('portfolio_currencies',hl.map(()=>portCur).join(','))
      const r=await fetch(`/api/prices?${params}`)
      const p=await r.json()
      setPrices(p)
      if(portfolioId) await recordSnapshot(portfolioId,hl,p)
    }catch(e){}
    setLoadingP(false)
  },[recordSnapshot, portfolios])

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

  const handleOpenTickerNews = async (ticker) => {
    setSelectedTicker(ticker)
    setLoadingNews(true)
    setTickerNews([])
    try {
      const res = await api.fetch(`/news/ticker/${ticker}`)
      if (res.ok) {
        const data = await res.json()
        setTickerNews(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Ticker news error:', e)
    }
    setLoadingNews(false)
  }

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
      fetchHistory(activePortfolioId)
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

  const convertToDisplay=(amount,currency)=>{
    if(displayCurrency==='THB') return currency==='THB'?amount:amount*fxRate
    return currency==='THB'?amount/fxRate:amount
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

  const allInvested=portfolios.reduce((s,p)=>s+convertToDisplay(Number(p.total_invested||0),p.currency||'USD'),0)
  const activePort=portfolios.find(p=>p.id===activePortfolioId)

  const sym=symFor(displayCurrency)
  const fmt=n=>sym+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
  const aBtn=(label,onClick,color)=><button onClick={onClick} style={{padding:'4px 10px',fontSize:'12px',border:`1px solid ${color}`,borderRadius:'6px',background:'transparent',color,cursor:'pointer',marginLeft:'6px'}}>{label}</button>

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
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#a29bfe', marginBottom: '14px', borderBottom: '1px solid #2a2a2a', paddingBottom: '6px' }}>
          🔥 Real-Time News (เฉพาะกลุ่ม Sector ที่ถือ)
        </h3>
        {!inSectorNews.length ? <p style={{ color: '#444', fontSize: '13px' }}>กำลังอัปเดตข่าวสารจากระบบ...</p>
        : inSectorNews.map((article, idx) => <NewsCard key={idx} article={article} />)}
      </div>
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#666', marginBottom: '14px', borderBottom: '1px solid #2a2a2a', paddingBottom: '6px' }}>
          🌐 Market Insights (ข่าวน่าสนใจเกี่ยวกับหุ้นอื่นๆ)
        </h3>
        {!outSectorNews.length ? <p style={{ color: '#444', fontSize: '13px' }}>ไม่มีข้อมูลข่าวสารธุรกิจในขณะนี้</p>
        : outSectorNews.map((article, idx) => <NewsCard key={idx} article={article} />)}
      </div>
    </div>
  )

  return(
    <div style={{minHeight:'100vh',background:'#0a0a0a',color:'#fff',fontFamily:'system-ui,sans-serif'}}>
      <div className="dash-inner">

        {/* Header */}
        <div className="dash-header">
          <div>
            <h1 style={{fontSize:'17px',fontWeight:600,marginBottom:'2px'}}>📓 Port Diary</h1>
            <p style={{color:'#444',fontSize:'13px'}}>สวัสดี, {user.name}</p>
          </div>
          <div className="dash-header-actions">
            <div className="dash-portfolio-select">
              <select value={activePortfolioId||''} onChange={e=>setActivePortfolioId(Number(e.target.value))}
                style={{padding:'7px 12px',background:'#141414',border:'none',color:'#fff',fontSize:'13px',cursor:'pointer',flex:1,minWidth:'140px'}}>
                {portfolios.map(p=><option key={p.id} value={p.id}>{p.name}{p.is_default?' ★':''}</option>)}
              </select>
              <button onClick={()=>setModal('managePort')} style={{padding:'7px 12px',border:'none',borderLeft:'1px solid #2a2a2a',background:'transparent',color:'#888',cursor:'pointer',fontSize:'14px',lineHeight:1}} title="จัดการพอร์ต">⚙️</button>
              <button onClick={()=>setModal('newPort')} style={{padding:'7px 12px',border:'none',borderLeft:'1px solid #2a2a2a',background:'#2d2a5e',color:'#a29bfe',cursor:'pointer',fontSize:'16px',lineHeight:1}} title="สร้างพอร์ตใหม่">+</button>
            </div>
            <div className="dash-currency-toggle" style={{display:'flex',background:'#141414',border:'1px solid #2a2a2a',borderRadius:'8px',overflow:'hidden'}}>
              {['USD','THB'].map(c=><button key={c} onClick={()=>setDisplayCurrency(c)} style={{padding:'7px 16px',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:500,background:displayCurrency===c?'#6c5ce7':'transparent',color:displayCurrency===c?'#fff':'#555'}}>{c==='USD'?'$ USD':'฿ THB'}</button>)}
            </div>
            <button onClick={()=>setModal('settings')} style={{...btnGhost,width:'auto',padding:'7px 14px',fontSize:'13px'}}>ตั้งค่า</button>
            <button onClick={onLogout} style={{...btnGhost,width:'auto',padding:'7px 14px',fontSize:'13px'}}>ออก</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="dash-tabs">
          {[
            ['overview','Overview'],
            ['report','Report'],
            ['holdings','Holdings'],
            ['transactions','Transactions'],
            ['journal','Journal'],
            ['news','News']
          ].map(([k,l])=>(
            <button key={k} onClick={() => { setTab(k); setSearchQuery(''); }} style={{padding:'7px 18px',borderRadius:'8px',border:'1px solid #2a2a2a',background:tab===k?'#6c5ce7':'transparent',color:tab===k?'#fff':'#555',cursor:'pointer',fontSize:'13px',fontWeight:tab===k?500:400}}>{l}</button>
          ))}
        </div>

        {/* Overview */}
        {tab==='overview'&&<>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'12px',marginBottom:'20px'}}>
            {[
              ['มูลค่าพอร์ตรวม',fmt(totVal),`${holdings.length} holdings · ${activePort?.name||''}`,null],
              ['เงินลงทุนทั้งหมด (ทุกพอร์ต)',fmt(allInvested),`${portfolios.length} พอร์ต · ไม่รวม P&L`,'#a29bfe'],
              ['กำไร/ขาดทุน (พอร์ตนี้)',fmt(totPnL),`${totPct>=0?'+':''}${totPct.toFixed(2)}% จากทุน`,totPnL>=0?'#27ae60':'#e74c3c'],
              ['USD/THB',loadingP?'กำลังโหลด...':`$1 = ฿${fxRate.toFixed(2)}`,'Real-time','#74b9ff']
            ].map(([label,val,sub,color],i)=>(
              <div key={i} style={{background:'#141414',border:'1px solid #2a2a2a',borderRadius:'10px',padding:'16px 18px'}}>
                <div style={{color:'#555',fontSize:'12px',marginBottom:'6px'}}>{label}</div>
                <div style={{color:color||'#fff',fontSize:'20px',fontWeight:500}}>{val}</div>
                <div style={{color:'#444',fontSize:'12px',marginTop:'3px'}}>{sub}</div>
              </div>
            ))}
          </div>
          {holdings.length>0&&<>
            <PortfolioChart history={portfolioHistory} displayCurrency={displayCurrency}/>
            <SectorAreaChart holdings={holdings} prices={prices} displayCurrency={displayCurrency} fxRate={fxRate}/>
            <DonutChart holdings={holdings} prices={prices} displayCurrency={displayCurrency} fxRate={fxRate}/>
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'8px',gap:'6px'}}>
              <span style={{fontSize:'12px',color:'#555',alignSelf:'center'}}>Heatmap:</span>
              {[['today','% วันนี้'],['invested','% จากทุน']].map(([k,l])=>(
                <button key={k} onClick={()=>setHeatmapMode(k)} style={{padding:'5px 12px',fontSize:'12px',borderRadius:'6px',border:`1px solid ${heatmapMode===k?'#6c5ce7':'#2a2a2a'}`,background:heatmapMode===k?'#2d2a5e':'transparent',color:heatmapMode===k?'#a29bfe':'#555',cursor:'pointer'}}>{l}</button>
              ))}
            </div>
            <Treemap holdings={holdings} prices={prices} displayCurrency={displayCurrency} fxRate={fxRate} heatmapMode={heatmapMode}/>
            <AIPanel holdings={holdings} prices={prices} displayCurrency={displayCurrency} fxRate={fxRate} inSectorNews={inSectorNews} />
            {renderNewsGrid()}
          </>}
          {holdings.length===0&&<div style={{textAlign:'center',padding:'60px',color:'#444'}}>
            <p style={{fontSize:'36px',marginBottom:'12px'}}>📊</p>
            <p style={{fontSize:'14px',marginBottom:'20px'}}>เริ่มบันทึก Transaction แรกเพื่อสร้าง portfolio</p>
            <button onClick={()=>{setTab('transactions');setModal('tx')}} style={{...btnPrimary,width:'auto',padding:'10px 24px'}}>+ บันทึก Transaction แรก</button>
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
            totPnL={totPnL}
            totPct={totPct}
          />
        )}

        {/* Holdings */}
        {tab==='holdings'&&<>
          <div className="dash-toolbar">
            <div className="dash-toolbar-left">
              <p style={{color:'#444',fontSize:'13px',whiteSpace:'nowrap'}}>{filteredHoldings.length} / {holdings.length} holdings</p>
              <input type="text" className="dash-search" placeholder="🔍 ค้นหา Ticker หรือชื่อหุ้นในพอร์ต..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
            </div>
            <button onClick={()=>setModal('h')} style={{...btnPrimary,width:'auto',padding:'7px 16px',fontSize:'13px'}}>+ เพิ่ม Holding ตรงๆ</button>
          </div>
          <div className="dash-table-wrap">
            <table className="dash-table dash-table--holdings">
              <thead><tr style={{borderBottom:'1px solid #2a2a2a'}}>
                {['Ticker','ชื่อ','Shares','สกุลเงิน','Avg Cost','ราคาปัจจุบัน',`มูลค่า (${displayCurrency})`,`กำไร/ขาดทุน (${displayCurrency})`,''].map((h,i)=>(
                  <th key={i} style={{padding:'11px 13px',textAlign:'left',color:'#444',fontWeight:400,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredHoldings.length===0?<tr><td colSpan={9} style={{padding:'28px',textAlign:'center',color:'#333'}}>ไม่พบรายการ holdings</td></tr>
                :filteredHoldings.map(h=>{
                  const cur=prices[h.ticker]||Number(h.avg_cost)
                  const val=getVal(h),cost=getCost(h),pnl=val-cost,pct=cost>0?(pnl/cost)*100:0
                  const os=symFor(h.currency||'USD')
                  return(<tr key={h.id} style={{borderBottom:'1px solid #1a1a1a'}}>
                    <td data-label="Ticker" style={{padding:'11px 13px',fontWeight:600, color: '#6c5ce7', cursor: 'pointer', textDecoration: 'underline'}} onClick={() => handleOpenTickerNews(h.ticker)}>{h.ticker}</td>
                    <td data-label="ชื่อ" style={{padding:'11px 13px',color:'#666'}}>{h.name||'—'}</td>
                    <td data-label="Shares" style={{padding:'11px 13px'}}>{Number(h.shares).toLocaleString('en-US',{maximumFractionDigits:4})}</td>
                    <td data-label="สกุลเงิน" style={{padding:'11px 13px'}}><span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'999px',background:h.currency==='USD'?'#1a2a4a':'#1a3a2a',color:h.currency==='USD'?'#74b9ff':'#55efc4'}}>{h.currency}</span></td>
                    <td data-label="Avg Cost" style={{padding:'11px 13px',color:'#666'}}>{os}{Number(h.avg_cost).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                    <td data-label="ราคาปัจจุบัน" style={{padding:'11px 13px'}}>{os}{Number(cur).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                    <td data-label={`มูลค่า (${displayCurrency})`} style={{padding:'11px 13px'}}>{fmt(val)}</td>
                    <td data-label={`กำไร/ขาดทุน (${displayCurrency})`} style={{padding:'11px 13px',color:pnl>=0?'#27ae60':'#e74c3c'}}>{fmt(pnl)}<span style={{fontSize:'11px',marginLeft:'4px'}}>({pct>=0?'+':''}{pct.toFixed(2)}%)</span></td>
                    <td data-label="" style={{padding:'11px 13px',whiteSpace:'nowrap'}}>
                      {aBtn('แก้ไข',()=>{setEditH(h);setModal('eh')},'#a29bfe')}
                      {aBtn('ลบ',()=>delH(h.id),'#e74c3c')}
                    </td>
                  </tr>)
                })}
              </tbody>
            </table>
          </div>
        </>}

        {/* Transactions */}
        {tab==='transactions'&&<>
          <div className="dash-toolbar">
            <div className="dash-toolbar-left">
              <p style={{color:'#444',fontSize:'13px',whiteSpace:'nowrap'}}>{filteredTransactions.length} / {transactions.length} transactions</p>
              <input type="text" className="dash-search" placeholder="🔍 ค้นหาด้วยชื่อย่อ Ticker หรือข้อความ..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
            </div>
            <div className="dash-toolbar-actions">
              <button onClick={()=>setModal('import')} style={{...btnGhost,width:'auto',padding:'7px 16px',fontSize:'13px',borderColor:'#6c5ce7',color:'#a29bfe'}}>📥 Import CSV</button>
              <button onClick={()=>setModal('tx')} style={{...btnPrimary,width:'auto',padding:'7px 16px',fontSize:'13px'}}>+ บันทึก Transaction</button>
            </div>
          </div>
          <div className="dash-table-wrap">
            <table className="dash-table dash-table--transactions">
              <thead><tr style={{borderBottom:'1px solid #2a2a2a'}}>
                {['วันที่','Ticker','ประเภท','Shares','ราคา/หุ้น','มูลค่ารวม','หมายเหตุ',''].map((h,i)=>(
                  <th key={i} style={{padding:'11px 13px',textAlign:'left',color:'#444',fontWeight:400}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredTransactions.length===0?<tr><td colSpan={8} style={{padding:'28px',textAlign:'center',color:'#333'}}>ไม่พบรายการ transactions</td></tr>
                :filteredTransactions.map(t=>(
                  <tr key={t.id} style={{borderBottom:'1px solid #1a1a1a'}}>
                    <td data-label="วันที่" style={{padding:'11px 13px',color:'#555'}}>{t.date?.split('T')[0]||t.date}</td>
                    <td data-label="Ticker" style={{padding:'11px 13px',fontWeight:600}}>{t.ticker}</td>
                    <td data-label="ประเภท" style={{padding:'11px 13px'}}><span style={{fontSize:'11px',padding:'2px 9px',borderRadius:'999px',background:t.type==='BUY'?'#1a3a2a':'#3a1a1a',color:t.type==='BUY'?'#55efc4':'#ff7675'}}>{t.type}</span></td>
                    <td data-label="Shares" style={{padding:'11px 13px'}}>{Number(t.shares).toLocaleString('en-US',{maximumFractionDigits:4})}</td>
                    <td data-label="ราคา/หุ้น" style={{padding:'11px 13px'}}>{Number(t.price).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                    <td data-label="มูลค่ารวม" style={{padding:'11px 13px',fontWeight:500}}>{Number(t.total).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                    <td data-label="หมายเหตุ" style={{padding:'11px 13px',color:'#555'}}>{t.note||'—'}</td>
                    <td data-label="" style={{padding:'11px 13px',whiteSpace:'nowrap'}}>
                      {aBtn('แก้ไข',()=>{setEditT(t);setModal('et')},'#a29bfe')}
                      {aBtn('ลบ',()=>delT(t.id),'#e74c3c')}
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
              <p style={{color:'#444',fontSize:'13px'}}>{filteredJournal.length} entries</p>
              <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                <button onClick={()=>setJournalFilter('')} style={{padding:'4px 10px',fontSize:'12px',borderRadius:'999px',border:'1px solid #2a2a2a',background:journalFilter===''?'#6c5ce7':'transparent',color:journalFilter===''?'#fff':'#555',cursor:'pointer'}}>ทั้งหมด</button>
                {journalTags.map(tag=>(
                  <button key={tag} onClick={()=>setJournalFilter(journalFilter===tag?'':tag)} style={{padding:'4px 10px',fontSize:'12px',borderRadius:'999px',border:`1px solid ${journalFilter===tag?'#6c5ce7':'#2a2a2a'}`,background:journalFilter===tag?'#2d2a5e':'transparent',color:journalFilter===tag?'#a29bfe':'#555',cursor:'pointer'}}>{tag}</button>
                ))}
              </div>
            </div>
            <button onClick={()=>setModal('j')} style={{...btnPrimary,width:'auto',padding:'7px 16px',fontSize:'13px'}}>+ เขียน Journal</button>
          </div>
          {filteredJournal.length===0?<p style={{color:'#333',fontSize:'13px',textAlign:'center',padding:'40px'}}>ไม่มี entry {journalFilter?`ใน tag "${journalFilter}"`:''}</p>
          :filteredJournal.map(j=>(
            <div key={j.id} style={{background:'#141414',border:'1px solid #2a2a2a',borderRadius:'10px',padding:'16px',marginBottom:'10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:'12px',color:'#444'}}>{j.date?.split('T')[0]||j.date}</span>
                  {j.tag&&<span style={{fontSize:'11px',background:'#2d2d5e',color:'#a29bfe',padding:'2px 9px',borderRadius:'999px'}}>{j.tag}</span>}
                  {j.tickers&&j.tickers.split(',').map(t=><span key={t} style={{fontSize:'11px',background:'#1e1e1e',color:'#555',padding:'2px 7px',borderRadius:'5px'}}>{t.trim()}</span>)}
                </div>
                <div style={{flexShrink:0}}>
                  {aBtn('แก้ไข',()=>{setEditJ(j);setModal('ej')},'#a29bfe')}
                  {aBtn('ลบ',()=>delJ(j.id),'#e74c3c')}
                </div>
              </div>
              {j.title&&<p style={{fontWeight:600,marginBottom:'6px',fontSize:'14px'}}>{j.title}</p>}
              <p style={{fontSize:'13px',color:'#bbb',lineHeight:1.8,whiteSpace:'pre-wrap'}}>{j.content}</p>
            </div>
          ))}
        </>}

        {/* News Tab Section */}
        {tab==='news' && renderNewsGrid()}

      </div>

      {showOnboarding && (
        <OnboardingModal
          user={user}
          activePort={activePort}
          onClose={() => setShowOnboarding(false)}
          onRename={() => fetchPortfolios()}
          onAddTransaction={() => { setTab('transactions'); setModal('tx') }}
          onImportCsv={() => { setTab('transactions'); setModal('import') }}
          onSetTab={setTab}
        />
      )}

      {modal==='h'&&<HoldingModal portfolioId={activePortfolioId} onClose={()=>setModal(null)} onSave={()=>fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}/>}
      {modal==='eh'&&editH&&<HoldingModal portfolioId={activePortfolioId} holding={editH} onClose={()=>{setModal(null);setEditH(null)}} onSave={()=>fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}/>}
      {modal==='j'&&<JournalModal portfolioId={activePortfolioId} onClose={()=>setModal(null)} onSave={()=>fetchAll(activePortfolioId)}/>}
      {modal==='ej'&&editJ&&<JournalModal portfolioId={activePortfolioId} entry={editJ} onClose={()=>{setModal(null);setEditJ(null)}} onSave={()=>fetchAll(activePortfolioId)}/>}
      {modal==='import'&&(
        <ImportCsvModal
          portfolioId={activePortfolioId}
          onClose={()=>setModal(null)}
          onSave={()=>fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}
        />
      )}
      {modal==='tx'&&<TransactionModal portfolioId={activePortfolioId} holdings={holdings} onClose={()=>setModal(null)} onSave={()=>fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}/>}
      {modal==='et'&&editT&&<TransactionModal portfolioId={activePortfolioId} transaction={editT} holdings={holdings} onClose={()=>{setModal(null);setEditT(null)}} onSave={()=>fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}/>}
      {modal==='newPort'&&(
        <Modal title="สร้างพอร์ตใหม่" onClose={()=>setModal(null)}>
          <Field label="ชื่อพอร์ต"><input style={inp()} placeholder="เช่น US Growth, หุ้นไทย" value={newPortName} onChange={e=>setNewPortName(e.target.value)}/></Field>
          <button onClick={createPortfolio} style={{...btnPrimary,marginTop:'8px'}}>สร้างพอร์ต</button>
        </Modal>
      )}
      {modal==='settings'&&(
        <SettingsModal
          user={user}
          onClose={()=>setModal(null)}
          onUserUpdate={onUserUpdate}
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

      {/* Modal ดูข่าวสารรายหุ้นเจาะจง */}
      {selectedTicker && (
        <Modal title={`ข่าวสารล่าสุดของหุ้น ${selectedTicker}`} onClose={() => setSelectedTicker(null)}>
          {loadingNews ? <p style={{ color: '#888', fontSize: '13px' }}>กำลังดึงข้อมูลข่าวสารแบบเรียลไทม์...</p>
          : tickerNews.length === 0 ? <p style={{ color: '#444', fontSize: '13px' }}>ไม่พบข้อมูลข่าวสารของหุ้นตัวนี้ในปัจจุบัน</p>
          : tickerNews.map((article, idx) => <NewsCard key={idx} article={article} />)}
        </Modal>
      )}
    </div>
  )
}