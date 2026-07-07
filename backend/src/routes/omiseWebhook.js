import express from 'express'
import pool from '../db/index.js'
import { isOmiseConfigured } from '../lib/omiseClient.js'
import { handleOmiseWebhookEvent } from '../lib/omiseSubscription.js'
import { serverError } from '../lib/httpErrors.js'

const router = express.Router()

router.post('/', async (req, res) => {
  if (!isOmiseConfigured()) {
    return res.status(503).json({ error: 'Omise webhook not configured' })
  }

  try {
    const result = await handleOmiseWebhookEvent(pool, req.body)
    res.json({ received: true, ...result })
  } catch (err) {
    serverError(res, err, 'Omise webhook handler error:')
  }
})

export default router
