export async function validateHoldingId(db, userId, portfolioId, holdingId) {
  if (holdingId == null || holdingId === '') {
    return { holdingId: null, currency: null }
  }

  const id = Number(holdingId)
  if (!Number.isInteger(id) || id <= 0) {
    return { error: 'holding_id ไม่ถูกต้อง' }
  }

  const result = await db.query(
    'SELECT id, currency FROM holdings WHERE id = $1 AND user_id = $2 AND portfolio_id = $3',
    [id, userId, portfolioId]
  )
  if (!result.rows.length) {
    return { error: 'ไม่พบ holding ในพอร์ตนี้' }
  }

  return {
    holdingId: id,
    currency: result.rows[0].currency,
  }
}
