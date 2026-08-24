/** Bounded LRU cache backed by Map insertion order — evicts oldest entry past maxSize. */
export function createLruCache(maxSize) {
  const map = new Map()
  return {
    get(key) {
      if (!map.has(key)) return undefined
      const value = map.get(key)
      map.delete(key)
      map.set(key, value)
      return value
    },
    set(key, value) {
      if (map.has(key)) map.delete(key)
      map.set(key, value)
      while (map.size > maxSize) {
        map.delete(map.keys().next().value)
      }
    },
    get size() {
      return map.size
    },
  }
}
