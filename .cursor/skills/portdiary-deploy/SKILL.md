---
name: portdiary-deploy
description: Pre-deploy checklist for PortDiary — build, backend tests, git backup tag, push main, smoke checks. Use when the user says deploy, push to main, release, or before public beta.
---

# PortDiary deploy checklist

## Before push
```
- [ ] git status — only intended files staged (no .env, no accidental assets)
- [ ] npm run build (repo root)
- [ ] cd backend && npm test
- [ ] If holdingSync changed: migration rebuild included?
- [ ] If chart merge changed: sanity-check ทุกพอร์ตรวม scope
```

## Backup tag (before risky changes)
```powershell
git tag -a v0-pre-<topic> -m "Backup before <topic>"
git branch backup/pre-<topic>
git push origin backup/pre-<topic>
git push origin v0-pre-<topic>
```
Use different names for branch vs tag (same name breaks push).

## Commit & push
```powershell
git add <files>
git commit -m "fix: short description"
git push origin main
```

## Post-deploy smoke
1. Hard refresh https://portdiary.com
2. Report → active port → KPIs load
3. Report → ทุกพอร์ตรวม → graph % reasonable
4. Add/edit transaction on SET ticker → currency THB, `-BK` suffix
5. Holdings avg_cost sane after sell scenario (if touched)

## Rollback
```powershell
git checkout v0-pre-<topic>
# or reset main only if user explicitly requests
```

## Do not
- Force push main without user request
- Commit `public/logo-icon-1024.png` unless user asks
- Skip backend tests when touching `holdingSync` or `portfolioHistory`
