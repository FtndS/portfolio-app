import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  buildQuoteFromFlightLeg,
  fetchSerpFlightQuotes,
  iataFromEndpoint,
  pickBestFlightOffers,
  _clearSerpFlightCache,
} from '../src/lib/serpFlights.js'

describe('serpFlights', () => {
  beforeEach(() => _clearSerpFlightCache())
  afterEach(() => {
    delete process.env.SERPAPI_API_KEY
  })

  it('extracts IATA from leg fields', () => {
    expect(iataFromEndpoint('BKK')).toBe('BKK')
    expect(iataFromEndpoint({ code: 'NRT', label: 'Narita' })).toBe('NRT')
    expect(iataFromEndpoint('Suvarnabhumi (BKK)')).toBe('BKK')
  })

  it('builds quote params from flight_leg', () => {
    const q = buildQuoteFromFlightLeg(
      {
        origin: 'BKK',
        destination: 'NRT',
        departDate: '2025-11-01',
        tripType: 'oneway',
        passengers: 2,
        cabin: 'economy',
      },
      {}
    )
    expect(q.error).toBeUndefined()
    expect(q.origin).toBe('BKK')
    expect(q.destination).toBe('NRT')
    expect(q.outboundDate).toBe('2025-11-01')
    expect(q.adults).toBe(2)
    expect(q.returnDate).toBeNull()
  })

  it('rejects incomplete leg', () => {
    const q = buildQuoteFromFlightLeg({ origin: 'Bangkok', destination: 'Tokyo' }, {})
    expect(q.error).toBeTruthy()
  })

  it('accepts Date objects for trip start_date', () => {
    const q = buildQuoteFromFlightLeg(
      { origin: 'BKK', destination: 'NRT', tripType: 'oneway' },
      { start_date: new Date('2025-11-01T00:00:00.000Z') }
    )
    expect(q.error).toBeUndefined()
    expect(q.outboundDate).toBe('2025-11-01')
  })

  it('picks cheapest offer from SerpAPI-shaped payload', () => {
    const picked = pickBestFlightOffers(
      {
        best_flights: [
          { price: 22000, total_duration: 400, flights: [{ airline: 'TG', flight_number: '676' }] },
        ],
        other_flights: [
          { price: 18500, total_duration: 520, flights: [{ airline: 'JL', flight_number: '32' }] },
        ],
        price_insights: { lowest_price: 18000 },
      },
      'THB'
    )
    expect(picked.lowest.price).toBe(18000)
    expect(picked.offers[0].price).toBe(18500)
  })

  it('returns not-configured without API key', async () => {
    delete process.env.SERPAPI_API_KEY
    const r = await fetchSerpFlightQuotes({
      origin: 'BKK',
      destination: 'NRT',
      outboundDate: '2025-11-01',
    })
    expect(r.code).toBe('SERPAPI_NOT_CONFIGURED')
  })

  it('fetches and caches SerpAPI response via fetchImpl', async () => {
    process.env.SERPAPI_API_KEY = 'test-key'
    let calls = 0
    const fetchImpl = async () => {
      calls += 1
      return {
        ok: true,
        json: async () => ({
          best_flights: [
            {
              price: 19900,
              total_duration: 380,
              flights: [
                {
                  airline: 'TG',
                  flight_number: '676',
                  departure_airport: { time: '2025-11-01 08:00' },
                },
              ],
            },
          ],
        }),
      }
    }
    const params = {
      origin: 'BKK',
      destination: 'NRT',
      outboundDate: '2025-11-01',
      currency: 'THB',
    }
    const a = await fetchSerpFlightQuotes(params, { fetchImpl })
    const b = await fetchSerpFlightQuotes(params, { fetchImpl })
    expect(a.lowest.price).toBe(19900)
    expect(a.cached).toBe(false)
    expect(b.cached).toBe(true)
    expect(calls).toBe(1)
  })
})
