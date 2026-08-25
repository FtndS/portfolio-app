/**
 * Phase B — rule-based trip cost estimates (THB).
 * Not live partner prices. User-entered place.budget always wins.
 */

import { inferForeignCurrency } from './tripFx.js'

/** Mid-tier THB ranges by destination currency band. */
const BANDS = {
  JPY: {
    hotel: [2800, 6500],
    restaurant: [450, 1400],
    attraction: [0, 900],
    transport: [200, 800],
    airport: [0, 0],
    other: [200, 800],
    flightRegional: [5500, 14000],
    flightLong: [18000, 38000],
    flightDomestic: [2500, 7000],
  },
  KRW: {
    hotel: [2200, 5200],
    restaurant: [350, 1100],
    attraction: [0, 800],
    transport: [150, 700],
    airport: [0, 0],
    other: [200, 700],
    flightRegional: [4500, 12000],
    flightLong: [18000, 38000],
    flightDomestic: [2000, 5500],
  },
  EUR: {
    hotel: [4500, 11000],
    restaurant: [800, 2500],
    attraction: [200, 1500],
    transport: [300, 1200],
    airport: [0, 0],
    other: [300, 1200],
    flightRegional: [12000, 28000],
    flightLong: [22000, 48000],
    flightDomestic: [3000, 9000],
  },
  GBP: {
    hotel: [5000, 12000],
    restaurant: [900, 2800],
    attraction: [300, 1800],
    transport: [350, 1400],
    airport: [0, 0],
    other: [350, 1400],
    flightRegional: [14000, 30000],
    flightLong: [22000, 48000],
    flightDomestic: [3500, 10000],
  },
  USD: {
    hotel: [4500, 12000],
    restaurant: [700, 2200],
    attraction: [200, 1600],
    transport: [300, 1200],
    airport: [0, 0],
    other: [300, 1200],
    flightRegional: [15000, 35000],
    flightLong: [22000, 50000],
    flightDomestic: [3500, 12000],
  },
  SGD: {
    hotel: [3500, 9000],
    restaurant: [500, 1800],
    attraction: [100, 1200],
    transport: [200, 900],
    airport: [0, 0],
    other: [250, 900],
    flightRegional: [3500, 9000],
    flightLong: [18000, 40000],
    flightDomestic: [0, 0],
  },
  THB: {
    hotel: [1200, 3500],
    restaurant: [200, 800],
    attraction: [0, 500],
    transport: [80, 400],
    airport: [0, 0],
    other: [100, 500],
    flightRegional: [2500, 8000],
    flightLong: [15000, 35000],
    flightDomestic: [1200, 4500],
  },
  DEFAULT: {
    hotel: [2500, 7000],
    restaurant: [400, 1500],
    attraction: [100, 1000],
    transport: [150, 800],
    airport: [0, 0],
    other: [200, 800],
    flightRegional: [5000, 15000],
    flightLong: [18000, 42000],
    flightDomestic: [2000, 6000],
  },
}

const ASIA = new Set(['THB', 'JPY', 'KRW', 'SGD', 'MYR', 'CNY', 'HKD', 'TWD', 'VND', 'IDR', 'PHP'])
const LONGHAUL = new Set(['USD', 'EUR', 'GBP', 'AUD'])

function bandForDestination(destination = '', origin = '') {
  const code = inferForeignCurrency(`${destination} ${origin}`)
  if (BANDS[code]) return { code, rates: BANDS[code] }
  // Domestic Thailand trips
  if (!destination || /thailand|กรุงเทพ|เชียงใหม่|ภูเก็ต|ไทย/i.test(destination)) {
    return { code: 'THB', rates: BANDS.THB }
  }
  return { code: 'DEFAULT', rates: BANDS.DEFAULT }
}

function mid([low, high]) {
  return Math.round((Number(low) + Number(high)) / 2)
}

function isFlightPlace(place) {
  if (place?.flight_leg) return true
  if (place?.type !== 'transport') return false
  const text = `${place.name || ''} ${place.notes || ''}`
  return /โหมด:\s*บิน|เครื่องบิน|เที่ยวบิน|flight/i.test(text)
}

function flightRange(place, rates, destCode) {
  const leg = place?.flight_leg
  const origin = String(leg?.origin || '').toUpperCase()
  const dest = String(leg?.destination || '').toUpperCase()
  const sameCountry =
    (origin.startsWith('BKK') || origin === 'DMK' || origin === 'HKT' || origin === 'CNX') &&
    (dest.startsWith('BKK') || dest === 'DMK' || dest === 'HKT' || dest === 'CNX')

  if (sameCountry || (destCode === 'THB' && !leg)) {
    return rates.flightDomestic
  }

  // Rough: Asia↔Asia regional, else long-haul from TH
  const destCcy = inferForeignCurrency(`${leg?.destinationLabel || ''} ${dest}`)
  if (ASIA.has(destCcy) || ASIA.has(destCode)) {
    if (LONGHAUL.has(destCcy)) return rates.flightLong
    return rates.flightRegional
  }
  if (LONGHAUL.has(destCcy) || LONGHAUL.has(destCode)) return rates.flightLong
  return rates.flightRegional
}

/**
 * @returns {{
 *   amount: number,
 *   low: number,
 *   high: number,
 *   source: 'budget' | 'estimate' | 'none',
 *   label: string,
 * }}
 */
export function estimatePlaceCost(place, { destination = '', origin = '' } = {}) {
  const budget = Number(place?.budget)
  if (Number.isFinite(budget) && budget > 0) {
    return {
      amount: budget,
      low: budget,
      high: budget,
      source: 'budget',
      label: 'จากงบในแผน',
    }
  }

  const { code, rates } = bandForDestination(destination, origin)
  let range = rates.other

  if (isFlightPlace(place)) {
    range = flightRange(place, rates, code)
  } else if (place?.type === 'hotel') {
    range = rates.hotel
  } else if (place?.type === 'restaurant') {
    range = rates.restaurant
  } else if (place?.type === 'attraction') {
    range = rates.attraction
  } else if (place?.type === 'transport') {
    range = rates.transport
  } else if (place?.type === 'airport') {
    range = rates.airport
  }

  const [low, high] = range
  if (!high && !low) {
    return { amount: 0, low: 0, high: 0, source: 'none', label: '' }
  }

  return {
    amount: mid(range),
    low,
    high,
    source: 'estimate',
    label: 'ประมาณ',
  }
}

export function sumTripCostEstimates(places, ctx = {}) {
  let total = 0
  let budgeted = 0
  let estimated = 0
  let skipped = 0

  for (const place of places || []) {
    const e = estimatePlaceCost(place, ctx)
    if (e.source === 'none' || e.amount <= 0) {
      skipped += 1
      continue
    }
    total += e.amount
    if (e.source === 'budget') budgeted += 1
    else estimated += 1
  }

  return {
    total,
    budgeted,
    estimated,
    skipped,
    pricedCount: budgeted + estimated,
    placeCount: (places || []).length,
  }
}

/**
 * @param {object} estimate
 * @param {(amount: number) => string} formatMoney - formats a single amount (may include dual currency)
 * @param {(low: number, high: number) => string} [formatRange] - formats a range with currencies grouped
 */
export function formatEstimateRange(estimate, formatMoney, formatRange = null) {
  if (!estimate || estimate.source === 'none' || estimate.amount <= 0) return null
  if (estimate.source === 'budget') {
    return formatMoney(estimate.amount)
  }
  if (estimate.low === estimate.high) return formatMoney(estimate.amount)
  if (typeof formatRange === 'function') return formatRange(estimate.low, estimate.high)
  return `${formatMoney(estimate.low)} – ${formatMoney(estimate.high)}`
}
