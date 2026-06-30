import { convertAmount } from '../../lib/currency'

export default function Treemap({holdings,prices,displayCurrency,fxRate,heatmapMode='today'}){
  const getVal=h=>{
    const p=prices[h.ticker]||Number(h.avg_cost)
    const v=Number(h.shares)*p
    return convertAmount(v,h.currency||'USD',displayCurrency,fxRate)
  }
  const getChg=h=>{
    if(heatmapMode==='invested'){
      const cur=prices[h.ticker]||Number(h.avg_cost)
      const cost=Number(h.avg_cost)
      return cost>0?((cur-cost)/cost)*100:0
    }
    return prices[`${h.ticker}_chg`]||0
  }
  const rawTotal=holdings.reduce((s,h)=>s+getVal(h),0)
  if(!holdings.length||rawTotal===0) return null
  const W=660,H=260
  const getColor=chg=>{
    if(chg<=-3)return'#c0392b';if(chg<=-1)return'#e74c3c';if(chg<0)return'#f1948a'
    if(chg===0)return'#2a2a2a';if(chg<1)return'#a9dfbf';if(chg<3)return'#27ae60';return'#1e8449'
  }
  const MIN_PCT=0.03
  const sorted=[...holdings].sort((a,b)=>getVal(b)-getVal(a))
  const rawPcts=sorted.map(h=>getVal(h)/rawTotal)
  const needsBoost=rawPcts.map(p=>p<MIN_PCT)
  const boostTotal=needsBoost.reduce((s,b,i)=>b?s+(MIN_PCT-rawPcts[i]):s,0)
  const bigCount=needsBoost.filter(b=>!b).length
  const adjPcts=rawPcts.map((p,i)=>needsBoost[i]?MIN_PCT:p-boostTotal/bigCount)
  const items=sorted.map((h,i)=>({...h,adjPct:adjPcts[i],chg:getChg(h)}))

  const rects=[]
  let remaining=[...items]
  let rx=0,ry=0,rw=W,rh=H
  while(remaining.length>0){
    const isH=rw>=rh
    const areaTotal=remaining.reduce((s,i)=>s+i.adjPct,0)
    const rowSize=isH?rh:rw
    let best=Infinity,cut=0,run=0
    for(let i=0;i<remaining.length;i++){
      run+=remaining[i].adjPct
      const len=(run/areaTotal)*(isH?rw:rh)
      let maxR=0,rt=0
      for(let j=0;j<=i;j++){rt+=remaining[j].adjPct;const l=(remaining[j].adjPct/run)*rowSize;const ratio=Math.max(l/len,len/l);if(ratio>maxR)maxR=ratio}
      if(maxR<best){best=maxR;cut=i+1}else break
    }
    const row=remaining.slice(0,cut);remaining=remaining.slice(cut)
    const rowSum=row.reduce((s,i)=>s+i.adjPct,0)
    const rowLen=(rowSum/areaTotal)*(isH?rw:rh)
    let pos=isH?ry:rx
    row.forEach(item=>{
      const len=(item.adjPct/rowSum)*rowSize
      if(isH){rects.push({...item,x:rx,y:pos,w:rowLen,h:len});pos+=len}
      else{rects.push({...item,x:pos,y:ry,w:len,h:rowLen});pos+=len}
    })
    if(isH){rx+=rowLen;rw-=rowLen}else{ry+=rowLen;rh-=rowLen}
  }
  return(
    <div style={{marginBottom:'16px'}}>
      <p className="dash-card-sub" style={{ marginBottom: '8px' }}>
        ขนาด = มูลค่า · สี = {heatmapMode==='today'?'% เปลี่ยนแปลงวันนี้':'% จากราคาทุนเฉลี่ย'}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',borderRadius:'10px',display:'block'}}>
        {rects.map((r,i)=>(
          <g key={i}>
            <rect x={r.x+1} y={r.y+1} width={r.w-2} height={r.h-2} rx={5} fill={getColor(r.chg)}/>
            {r.w>35&&r.h>22&&<>
              <text x={r.x+r.w/2} y={r.y+r.h/2-(r.h>50?8:0)} textAnchor="middle" fontSize={Math.min(r.w/6,r.h/3,16)} fontWeight="600" fill="#fff" fontFamily="sans-serif" dominantBaseline="middle">{r.ticker}</text>
              {r.h>50&&<text x={r.x+r.w/2} y={r.y+r.h/2+14} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.7)" fontFamily="sans-serif">{r.chg>=0?'+':''}{r.chg.toFixed(2)}%</text>}
            </>}
          </g>
        ))}
      </svg>
    </div>
  )
}