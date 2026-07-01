---
name: portdiary-holding-sync
description: Maintains PortDiary holdings avg_cost and shares from transactions using average-cost method, ORDER BY date, rebuild migrations, and sell validation. Use when editing holdingSync, transactions, avg_cost, partial sell, rebuild holdings, or PnL mismatch.
---

# PortDiary holding sync

## When to use
- `avg_cost` wrong after partial SELL
- Holdings table cost ≠ Report PnL
- New transaction route changes
- Migration after changing cost logic

## Core logic (`computeHoldingFromTxRows`)
```javascript
// BUY
const nextShares = netShares + sh
avgCost = (netShares * avgCost + sh * price + fee) / nextShares
// SELL
netShares -= sh
if (netShares <= EPS) { netShares = 0; avgCost = 0 }
// else avgCost unchanged
```

## SQL order (required)
```sql
SELECT type, shares, price, fee FROM transactions
WHERE user_id = $1 AND portfolio_id = $2 AND ticker = $3
ORDER BY date ASC, created_at ASC, id ASC
```

## Files
| File | Role |
|------|------|
| `backend/src/lib/holdingSync.js` | Sync holding row from txs |
| `backend/src/lib/transactionValidation.js` | `validateSellQuantity`, ordered fetch |
| `backend/src/routes/transactions.js` | POST/PUT triggers sync |
| `src/lib/pnl.js` | Frontend PnL — must match avg-cost rules |
| `backend/src/db/migrate.js` | `after()` → `rebuildHoldingsFromTransactions` |

## After logic changes
Add migration with `sql: 'SELECT 1'` and:
```javascript
async after() {
  await rebuildHoldingsFromTransactions(pool)
}
```

## Tests
Add cases to `backend/tests/holdingSync.test.js`:
- Partial sell keeps avg
- Full sell + rebuy resets avg
- Buy after partial sell weights correctly
- Fee included in avg

Run: `cd backend && npm test`

## Manual verify
1. Holding with BUY → partial SELL → BUY again: `avg_cost` matches spreadsheet
2. Report KPI cost column aligns with `shares * avg_cost`
