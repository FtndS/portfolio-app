# Security#1 — Pentest findings & fix plan (deferred)

**Status:** Paused — resume when ready  
**Tagged:** `Security#1`  
**Date:** 2026-07-02  
**Scope:** White-box code review (auth, API, uploads, rate limits, frontend token storage)

---

## Summary

No Critical issues found. Core controls are solid: parameterized SQL, ownership scoping (`user_id`), bcrypt, OTP HMAC + timing-safe compare, token versioning, rate limits, JWT secret enforcement in production.

---

## Findings (priority order)

| # | Issue | Severity | Phase |
|---|--------|----------|-------|
| 1 | JWT in `localStorage`, 30d expiry — XSS steals long-lived token | Medium | 3 |
| 2 | CSP disabled (`helmet` `contentSecurityPolicy: false`) | Medium | 2 |
| 3 | User enumeration on `/register/send-otp` (409 vs generic) | Medium | 2 |
| 4 | In-memory caches unbounded (`priceCache`, news RSS cache) | Low | 1 |
| 5 | News ticker symbol validation weak (`/news/ticker/:symbol`) | Low | 1 |
| 6 | No max password length in `validatePassword` | Low | 1 |
| 7 | OTP pepper uses `JWT_SECRET` — rotation breaks pending OTPs | Low | 1 |

**Key files:** `backend/src/index.js`, `backend/src/lib/otp.js`, `backend/src/lib/validate.js`, `backend/src/routes/news.js`, `backend/src/routes/auth.js`, `src/lib/api.js`, `src/App.jsx`

---

## Fix plan (when resuming)

### Phase 1 — Quick wins (~1–2 days)
- [ ] **#6** Cap password 8–128 in `validate.js` + frontend + tests
- [ ] **#5** `validateTickerSymbol` regex `^[A-Za-z0-9.\-]{1,20}$` in `news.js`
- [ ] **#4** LRU cache helper; cap `priceCache` (~500) and news cache (~50)
- [ ] **#7** Add `OTP_SECRET` env; decouple from `JWT_SECRET`

### Phase 2 — Hardening (~2–4 days)
- [ ] **#2** CSP via nginx (start Report-Only → enforce)
- [ ] **#3** Generic response on register send-otp for existing emails

### Phase 3 — Structural (~1–2 weeks)
- [ ] **#1** httpOnly cookie + short access token + refresh token + revoke on logout

---

## Resume prompt

```
ใช้ Security#1 — ทำเฟส 1 ตาม .cursor/memos/Security-1.md
```

Or: `กลับมาแก้ Security#1 เฟส 2` / `ทำ Security#1 ข้อ 1 (cookie auth)`

---

## Pre-deploy checklist (per phase)

**Phase 1:** `npm test` backend; set `OTP_SECRET` on server; smoke register/login/prices/news  
**Phase 2:** CSP report-only clean; register duplicate-email UX  
**Phase 3:** No token in localStorage; login/logout/refresh all browsers; SameSite cookies
