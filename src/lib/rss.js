export async function clientFetchRSS(tickerSymbol = null) {
  try {
    const url = tickerSymbol
      ? `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${tickerSymbol.replace('.', '-')}`
      : 'https://finance.yahoo.com/news/rssindex'

    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
    const data = await res.json()
    const xmlText = data.contents

    if (!xmlText) return []

    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
    const items = xmlDoc.getElementsByTagName('item')
    const result = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const title = item.getElementsByTagName('title')[0]?.textContent || ''
      const link = item.getElementsByTagName('link')[0]?.textContent || ''
      const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || ''
      const source = item.getElementsByTagName('source')[0]?.textContent || 'Yahoo Finance'

      if (title && link) {
        result.push({
          title,
          url: link.trim(),
          publishedAt: pubDate,
          source: { name: source },
        })
      }
    }
    return result
  } catch (e) {
    console.error('Client RSS Error:', e)
    return []
  }
}
