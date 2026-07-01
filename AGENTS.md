# PortDiary — Agent context

This repo includes Cursor **Rules** and **Skills** under `.cursor/`.

**Start here:** [.cursor/README.md](.cursor/README.md) (Thai usage guide)

## Quick prompts

| Task | Prompt |
|------|--------|
| Report chart / merge | `ใช้ portdiary-report-chart …` |
| avg_cost / transactions | `ใช้ portdiary-holding-sync …` |
| AI / Copilot / วิเคราะห์พอร์ต | `ใช้ portdiary-ai …` |
| Deploy | `ใช้ portdiary-deploy …` |

## Rules (auto)
- `portdiary-core` — always on
- `portdiary-fx`, `portdiary-charts`, `portdiary-thai-tickers`, `portdiary-holdings`, `portdiary-ai` — when matching files are open
