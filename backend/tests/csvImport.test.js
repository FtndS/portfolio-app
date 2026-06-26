import { describe, it, expect } from 'vitest'
import { parseTransactionCsv } from '../src/lib/csvImport.js'

const HEADER = 'date,ticker,type,shares,price,currency,note\n'

describe('parseTransactionCsv', () => {
  it('parses valid BUY row', () => {
    const csv = `${HEADER}2024-01-15,AAPL,BUY,10,150.5,USD,test buy`
    const result = parseTransactionCsv(csv, { defaultCurrency: 'USD' })
    expect(result.validCount).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(result.validRows[0]).toMatchObject({
      ticker: 'AAPL',
      type: 'BUY',
      shares: 10,
      price: 150.5,
      currency: 'USD',
      note: 'test buy',
    })
  })

  it('reports row errors for invalid type', () => {
    const csv = `${HEADER}2024-01-15,AAPL,HOLD,10,150.5,USD,`
    const result = parseTransactionCsv(csv, { defaultCurrency: 'USD' })
    expect(result.validCount).toBe(0)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('supports Thai SET ticker suffix', () => {
    const csv = `${HEADER}2024-06-01,PTT.BK,BUY,100,35,THB,`
    const result = parseTransactionCsv(csv, { defaultCurrency: 'THB' })
    expect(result.validCount).toBe(1)
    expect(result.validRows[0].ticker).toBe('PTT-BK')
  })

  it('parses optional fee column', () => {
    const csv = 'date,ticker,type,shares,price,fee,currency,note\n2024-01-15,AAPL,BUY,10,150.5,1.25,USD,'
    const result = parseTransactionCsv(csv, { defaultCurrency: 'USD' })
    expect(result.validCount).toBe(1)
    expect(result.validRows[0].fee).toBe(1.25)
  })

  it('defaults fee to 0 when column missing', () => {
    const csv = `${HEADER}2024-01-15,AAPL,BUY,10,150.5,USD,`
    const result = parseTransactionCsv(csv, { defaultCurrency: 'USD' })
    expect(result.validRows[0].fee).toBe(0)
  })
})
