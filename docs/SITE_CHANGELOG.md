# SITE_CHANGELOG — portdiary.com

Changes to the live site that affect SEO and indexing (domain, redirects, canonical, sitemap).

## 2026-10-16 — Use apex `https://portdiary.com` as the only home page URL

**Problem (Search Console):** `https://portdiary.com/` showed "Duplicate, Google chose different canonical than user".
Google picked `https://www.portdiary.com/` because www returned 200 with the same content, even though both pages declared the apex as canonical.

**Before (curl):**

| URL | Result |
|---|---|
| https://portdiary.com/ | 200 |
| https://www.portdiary.com/ | 200 (duplicate, no redirect) |
| https://portdiary.com/index.html | 200 (duplicate) |
| http://portdiary.com/ | 301 → https://portdiary.com/ |
| http://www.portdiary.com/ | 301 → https://www.portdiary.com/ |

**Changes (`nginx.conf`):**
- New 443 server for `www.portdiary.com` → `301 https://portdiary.com$request_uri` (the existing Let's Encrypt cert already covers www).
- The main 443 server answers only `portdiary.com`.
- Port 80 (apex + www) → `https://portdiary.com$request_uri` in one hop.
- `/index.html` → `301 /`. The SPA fallback runs inside the frontend container, so this can't loop.
- `sitemap.xml` and internal links already used the apex only. No change needed.

**After (curl):** _pending deploy_

| URL | Expected | Actual |
|---|---|---|
| https://www.portdiary.com/ | 301 → https://portdiary.com/ | |
| http://www.portdiary.com/ | 301 → https://portdiary.com/ | |
| https://portdiary.com/index.html | 301 → https://portdiary.com/ | |
| https://portdiary.com/ | 200 | |

**Follow-up:**
- Search Console: URL Inspection `https://portdiary.com/` → Test Live URL → Request Indexing. Re-check Google-selected canonical in 1–3 weeks.
- Tell Geomnix to update the portdiary client notes before locking the baseline.
