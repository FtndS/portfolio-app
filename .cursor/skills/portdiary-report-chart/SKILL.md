---
name: portdiary-report-chart
description: Fixes PortDiary Report and Overview charts, merged portfolio history, TWR performance %, FX conversion, benchmarks, and PDF print export. Use when the user mentions report graph, ทุกพอร์ตรวม, time series, -100% chart, flat line, S&P compare, or PDF export.
---

# PortDiary report & chart fix

## When to use
- Report page graph wrong while KPIs/table look correct
- Scope `all` (ทุกพอร์ตรวม) shows insane % or cliff to -100%
- Overview chart flat then vertical jump
- PDF/print text truncated or unreadable

## Files
- `src/lib/reportScope.js` — merge, forward-fill, `attachPerformancePct`
- `src/components/PortfolioReport.jsx` — scope loading, all-ports merge
- `src/components/report/ReportLineChart.jsx` — display, compare mode
- `src/components/charts/PortfolioChart.jsx` — Overview
- `backend/src/lib/portfolioHistory.js` — per-port history, `priceOnDate`, TWR

## Diagnosis checklist
```
- [ ] Is scope single-port or merged all?
- [ ] Display currency THB vs USD — is convertAmount used everywhere?
- [ ] Merged: forward-fill per port before sum?
- [ ] Merged: cash flows FX-adjusted in attachPerformancePct?
- [ ] Sparse dates: port A weekly, port B daily — gap day drops a port?
- [ ] priceOnDate filling future prices into past?
- [ ] KPI uses holdings; chart uses history — separate code paths
```

## Fix patterns

### Merged portfolios
```javascript
mergePortfolioHistoriesWithPerformance(
  portfolios.map((p, i) => ({
    batch: normalizeHistoryResponse(histRes[i]),
    portfolioCurrency: inferPortfolioCurrency(p, allHoldings),
  })),
  { displayCurrency, usdThb: fxRate, transactions: allTx }
)
```
Forward-fill inside `mergePortfolioHistories` — each port contributes last known value on gap dates.

### TWR cash flow
```javascript
const converted = convertAmount(sh * price + fee, tx.currency, displayCurrency, usdThb)
```

### PDF print
Edit `src/dashboard.css` `@media print`:
- `@page` A4 margin
- `.dash-report-donut-legend-label` — no ellipsis; `white-space: normal`
- 2-column chart grid on print; `break-inside: avoid` on cards/rows

## Verify
1. `npm run build` (frontend)
2. Manual: Report → ทุกพอร์ตรวม → THB and USD toggle → % near KPI total return
3. Toggle S&P compare — line near reasonable range, not ±thousands
4. Print preview — sector names fully visible

## Do not
- Sum `total_value` across ports without FX
- Recompute TWR on merged data without FX-adjusted transactions
- Use naive `totalBuyCost/totalBuyShares` for display %
