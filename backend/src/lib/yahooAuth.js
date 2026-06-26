const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const SESSION_TTL_MS = 30 * 60 * 1000

let session = null

function parseCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie().map((c) => c.split(';')[0])
  }
  const raw = response.headers.get('set-cookie')
  if (!raw) return []
  return raw.split(/,(?=\s*[^;]+=)/).map((c) => c.split(';')[0].trim())
}

async function refreshSession() {
  const cookieRes = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
  })

  const cookie = parseCookies(cookieRes).join('; ')
  if (!cookie) {
    throw new Error('Yahoo cookie unavailable')
  }

  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': USER_AGENT, Cookie: cookie },
    signal: AbortSignal.timeout(8000),
  })

  if (!crumbRes.ok) {
    throw new Error(`Yahoo crumb request failed: ${crumbRes.status}`)
  }

  const crumb = (await crumbRes.text()).trim()
  if (!crumb || crumb.toLowerCase().includes('unauthorized')) {
    throw new Error('Yahoo crumb invalid')
  }

  session = { cookie, crumb, expiresAt: Date.now() + SESSION_TTL_MS }
  return session
}

async function getSession() {
  if (session && session.expiresAt > Date.now()) {
    return session
  }
  return refreshSession()
}

export function clearYahooSession() {
  session = null
}

export async function yahooGet(url, { retryOnAuth = true } = {}) {
  const attempt = async () => {
    const { cookie, crumb } = await getSession()
    const target = new URL(url)
    target.searchParams.set('crumb', crumb)

    const response = await fetch(target, {
      headers: {
        'User-Agent': USER_AGENT,
        Cookie: cookie,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })

    return response
  }

  let response = await attempt()
  if (retryOnAuth && (response.status === 401 || response.status === 403)) {
    clearYahooSession()
    response = await attempt()
  }

  return response
}
