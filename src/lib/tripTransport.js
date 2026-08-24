/** UI helpers for trip transport stops (keep in sync with backend bookingLinks). */

export function isDrivingPlace(place) {
  if (!place || place.type !== 'transport') return false
  const text = `${place.name || ''} ${place.notes || ''}`
  if (/grab|taxi|bolt|แท็กซี่/i.test(text)) return false
  if (/โหมด:\s*บิน|เครื่องบิน|เที่ยวบิน|flight|โหมด:\s*รถไฟ|รถไฟ|train|โหมด:\s*เรือ|ferry|boat/i.test(text)) {
    return false
  }
  return /โหมด:\s*รถ|ขับรถ|ระยะทาง|จุดพักรถ|ปั๊ม|ptt/i.test(text)
}

export function showPlacePhoto(place) {
  if (!place?.photo_url) return false
  if (place.type === 'transport') return false
  if (isDrivingPlace(place)) return false
  return true
}

export function showPlaceBooking(place) {
  if (!place) return false
  if (isDrivingPlace(place)) return false
  return true
}
