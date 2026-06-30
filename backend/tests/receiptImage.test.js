import { describe, it, expect } from 'vitest'
import { parseReceiptBase64, MAX_RECEIPT_BYTES } from '../src/lib/receiptImage.js'

describe('receiptImage', () => {
  it('parses valid png data url', () => {
    const png = Buffer.from('fake-png').toString('base64')
    const r = parseReceiptBase64(`data:image/png;base64,${png}`)
    expect(r.buffer).toBeInstanceOf(Buffer)
    expect(r.contentType).toBe('image/png')
  })

  it('rejects invalid format', () => {
    expect(parseReceiptBase64('not-data-url').error).toBeTruthy()
  })

  it('rejects oversized payload', () => {
    const big = Buffer.alloc(MAX_RECEIPT_BYTES + 1).toString('base64')
    expect(parseReceiptBase64(`data:image/jpeg;base64,${big}`).error).toContain('ใหญ่เกิน')
  })
})
