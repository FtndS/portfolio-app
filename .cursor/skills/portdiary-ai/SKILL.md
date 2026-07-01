---
name: portdiary-ai
description: Develops and debugs PortDiary AI features — Copilot presets, portfolio analyze JSON, news summary, ticker journal, Free/Pro quotas, and Claude prompts. Use when editing AIPanel, ai.js, aiPlan, aiQuota, aiAnalyzeContext, aiCopilotContext, or when the user mentions Copilot, วิเคราะห์พอร์ต, สรุปข่าว, AI quota, or Pro AI limits.
---

# PortDiary AI (developer workflow)

## Scope
Phase-1 dev tooling only. End-user AI runs via `backend/src/routes/ai.js` + Anthropic API — not via this skill file at runtime.

## Architecture map

```
AIPanel.jsx / AIDrawer.jsx
  → api.post('/ai/copilot' | '/analyze' | '/news-summary')
  → GET /ai/quota

backend/src/routes/ai.js
  → getPlanConfigForUser (aiPlan.js)
  → requireAiQuota / reserveAiQuota (aiQuota.js)
  → buildCopilotContext | buildAnalyzePayload
  → callClaude → parseClaudeJson (analyze + news only)
```

## Plans (2)

| | Free | Pro |
|---|------|-----|
| analyze/week | 1 | 8 |
| copilot/week | 2 | 6 |
| news-summary/week | 1 | 4 |
| ticker-journal/week | 2 | 6 |
| Custom Copilot question | no | yes |

Privileged: `admin` or `AI_OWNER_EMAIL` → unlimited quota, Pro config.

## Change checklist

### Add Copilot preset
```
- [ ] COPILOT_PRESETS in aiCopilotContext.js
- [ ] COPILOT_PRESETS array in AIPanel.jsx (id, label, icon)
- [ ] resolveCopilotQuestion handles preset id
- [ ] Prompt stays non-advisory Thai
```

### Change Analyze output
```
- [ ] JSON schema in ai.js userMessage
- [ ] AIPanel.jsx render fields for new keys
- [ ] parseClaudeJson still works (no markdown wrapper)
- [ ] maxStringLen / maxRecommendations from planConfig
```

### Change context / numbers
```
- [ ] buildAnalyzePayload — displayCurrency + fxRate on value/cost
- [ ] summarizeTransactions — currency on tx rows if summing values
- [ ] dataScope returned to client for transparency
- [ ] Free vs Pro caps in aiPlan.js
```

### New AI endpoint
```
- [ ] AI_FEATURES constant in aiQuota.js
- [ ] weeklyLimit in AI_PLANS free + pro
- [ ] FEATURE_ROWS in subscriptionCatalog.js
- [ ] requireAiQuota middleware
- [ ] aiLimiter on router (already global)
```

## Response types

| Endpoint | Format | Parser |
|----------|--------|--------|
| copilot | plain text | none |
| analyze | JSON | parseClaudeJson |
| news-summary | JSON | parseClaudeJson |
| ticker-journal | plain text | none |

## Tests
```bash
cd backend && npm test -- aiAnalyzeContext aiQuota aiPlan
```

## Verify manually
1. Free user: preset chips work; custom question blocked (403 `COPILOT_CUSTOM_PRO_ONLY`)
2. Pro user: custom Copilot question works
3. Quota UI hints match `GET /ai/quota`
4. Analyze returns all JSON keys; no crash on truncated JSON
5. Values in AI text roughly match Overview for same display currency

## Common bugs
| Symptom | Likely cause |
|---------|----------------|
| AI $ vs ฿ wrong | context not using displayCurrency/fxRate |
| Analyze 500 | JSON parse fail — tighten prompt or increase maxTokens |
| Quota mismatch UI | AIPanel formatQuotaHint vs backend feature keys |
| Pro can't ask | plan not `pro` or expired `planExpiresAt` |

## Phase 2 (not this skill's default scope)
- Deeper FX in transaction summaries
- Multi-portfolio context
- Richer news body (not just titles)

When starting Phase 2, extend this skill — do not duplicate prompts into Cursor rules.
