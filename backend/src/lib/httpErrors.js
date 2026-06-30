const DEFAULT_MSG = 'เกิดข้อผิดพลาด กรุณาลองใหม่'

export function serverError(res, err, label) {
  if (label) console.error(label, err)
  else console.error(err)
  const error =
    process.env.NODE_ENV === 'production'
      ? DEFAULT_MSG
      : err?.message || DEFAULT_MSG
  return res.status(500).json({ error })
}
