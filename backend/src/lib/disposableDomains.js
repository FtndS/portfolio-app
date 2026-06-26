const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'sharklasers.com',
  'grr.la',
  'tempmail.com',
  'temp-mail.org',
  'throwaway.email',
  'yopmail.com',
  'trashmail.com',
  '10minutemail.com',
  'fakeinbox.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  'tempail.com',
  'emailondeck.com',
])

export function isDisposableEmail(email) {
  const domain = email.trim().toLowerCase().split('@')[1]
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false
}
