import { describe, it, expect } from 'vitest'
import {
  parseAttachmentsInput,
  parseImageBase64,
  MAX_ATTACHMENTS_PER_TICKET,
  MAX_ATTACHMENT_BYTES,
} from '../src/lib/ticketAttachments.js'

describe('ticketAttachments', () => {
  it('parses up to three images', () => {
    const png = Buffer.from('fake').toString('base64')
    const dataUrl = `data:image/png;base64,${png}`
    const r = parseAttachmentsInput({ attachmentsBase64: [dataUrl, dataUrl] })
    expect(r.attachments).toHaveLength(2)
  })

  it('rejects more than max attachments', () => {
    const png = Buffer.from('fake').toString('base64')
    const dataUrl = `data:image/png;base64,${png}`
    const r = parseAttachmentsInput({
      attachmentsBase64: [dataUrl, dataUrl, dataUrl, dataUrl],
    })
    expect(r.error).toContain(String(MAX_ATTACHMENTS_PER_TICKET))
  })

  it('merges legacy receiptBase64', () => {
    const png = Buffer.from('legacy').toString('base64')
    const r = parseAttachmentsInput({ receiptBase64: `data:image/png;base64,${png}` })
    expect(r.attachments).toHaveLength(1)
  })

  it('rejects oversized image', () => {
    const big = Buffer.alloc(MAX_ATTACHMENT_BYTES + 1).toString('base64')
    const r = parseImageBase64(`data:image/jpeg;base64,${big}`)
    expect(r.error).toContain('ใหญ่เกิน')
  })
})
