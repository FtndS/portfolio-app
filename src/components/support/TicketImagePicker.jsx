import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { btnPrimary, btnGhost } from '../../lib/styles'
import {
  MAX_TICKET_ATTACHMENTS,
  TICKET_IMAGE_ACCEPT,
  fileToDataUrl,
  validateTicketImageFile,
  formatTicketAttachmentLimitMb,
} from '../../lib/ticketAttachments'

export default function TicketImagePicker({ files, onChange, err, setErr }) {
  const onPick = (e) => {
    setErr?.('')
    const picked = [...(e.target.files || [])]
    e.target.value = ''
    if (!picked.length) return

    const next = [...files]
    for (const file of picked) {
      if (next.length >= MAX_TICKET_ATTACHMENTS) {
        setErr?.(`แนบรูปได้สูงสุด ${MAX_TICKET_ATTACHMENTS} ไฟล์`)
        break
      }
      const validationErr = validateTicketImageFile(file)
      if (validationErr) {
        setErr?.(validationErr)
        continue
      }
      next.push({
        file,
        preview: URL.createObjectURL(file),
      })
    }
    onChange(next)
  }

  const removeAt = (index) => {
    setErr?.('')
    onChange(files.filter((_, i) => i !== index))
  }

  useEffect(() => () => {
    files.forEach((item) => {
      if (item.preview) URL.revokeObjectURL(item.preview)
    })
  }, [files])

  return (
    <div className="dash-sub-receipt">
      <label className="dash-text-muted" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
        แนบรูป (ไม่บังคับ) — สูงสุด {MAX_TICKET_ATTACHMENTS} ไฟล์, ไฟล์ละ {formatTicketAttachmentLimitMb()} MB
      </label>
      <input
        type="file"
        accept={TICKET_IMAGE_ACCEPT}
        multiple
        onChange={onPick}
        className="dash-sub-file"
        disabled={files.length >= MAX_TICKET_ATTACHMENTS}
      />
      {files.length > 0 && (
        <div className="dash-ticket-attachments">
          {files.map((item, index) => (
            <div key={item.preview} className="dash-ticket-attachment-item">
              <img src={item.preview} alt={`แนบ ${index + 1}`} className="dash-sub-receipt-preview" />
              <button type="button" className="dash-ticket-attachment-remove" onClick={() => removeAt(index)}>
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}
      {err && <p className="dash-text-loss" style={{ fontSize: '13px', marginTop: '10px' }}>{err}</p>}
    </div>
  )
}

export async function buildAttachmentsPayload(files) {
  if (!files?.length) return []
  const out = []
  for (const item of files) {
    out.push(await fileToDataUrl(item.file))
  }
  return out
}
