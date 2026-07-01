# PortDiary — Cursor AI setup

คู่มือใช้งาน **Rules** และ **Skills** ใน repo นี้ เพื่อให้ Agent ใน Cursor ช่วยแก้ PortDiary ได้แม่นขึ้นและลด regression

---

## สิ่งที่ติดตั้งใน repo นี้

```
.cursor/
├── README.md                 ← คู่มือนี้
├── rules/                    ← กฎอัตโนมัติ (Agent อ่านตาม context)
│   ├── portdiary-core.mdc
│   ├── portdiary-fx.mdc
│   ├── portdiary-charts.mdc
│   ├── portdiary-thai-tickers.mdc
│   ├── portdiary-holdings.mdc
│   └── portdiary-ai.mdc
└── skills/                   ← workflow เฉพาะทาง (Agent โหลดเมื่อเกี่ยวข้อง)
    ├── portdiary-report-chart/SKILL.md
    ├── portdiary-holding-sync/SKILL.md
    ├── portdiary-deploy/SKILL.md
    └── portdiary-ai/SKILL.md
```

---

## Rules vs Skills ต่างกันยังไง

| | **Rules** | **Skills** |
|---|-----------|------------|
| **ทำอะไร** | บอก “ห้ามทำ / ต้องทำ” สั้นๆ ตลอดหรือตามไฟล์ | ขั้นตอนแก้ปัญหา + checklist ละเอียด |
| **เมื่อไหร่โหลด** | เปิดไฟล์ที่ตรง `globs` หรือ `alwaysApply: true` | เมื่อคำถามตรง `description` หรือคุณสั่งชื่อ skill |
| **แก้ที่ไหน** | `.cursor/rules/*.mdc` | `.cursor/skills/*/SKILL.md` |

---

## วิธีใช้งานใน Cursor (ละเอียด)

### 1) เปิด Agent Chat ปกติ

1. เปิดโปรเจกต์ `portfolio-app` ใน Cursor
2. เปิดแชท Agent (`Ctrl+L` / `Cmd+L` หรือแท็บ Agent)
3. พิมพ์งานเป็นภาษาไทยหรืออังกฤษได้ — **Rules จะทำงานเอง** เมื่อ:
   - `portdiary-core` ทุกครั้งที่คุยใน repo นี้
   - rule อื่นเมื่อคุณเปิดไฟล์ที่เกี่ยวข้อง (เช่น แก้ `reportScope.js` → rule FX + charts โหลด)

**ตัวอย่าง prompt ธรรมดา (ไม่ต้องอ้าง skill):**
```
กราฟ Report ตอนเลือกทุกพอร์ตรวมยังดิ่งลง -100% ช่วยแก้
```
Agent ควรได้ context จาก rules เรื่อง merge + FX อัตโนมัติ

---

### 2) สั่งให้ใช้ Skill โดยตรง (แนะนำเมื่องานซับซ้อน)

พิมพ์ชื่อหรือหัวข้อ skill ในประโยค:

| งาน | ตัวอย่าง prompt |
|-----|----------------|
| กราฟ / Report | `ใช้ skill portdiary-report-chart ตรวจ merge history และ TWR ของทุกพอร์ตรวม` |
| ทุนเฉลี่ย / SELL | `ใช้ portdiary-holding-sync แก้ avg_cost หลังขายบางส่วนและเพิ่ม test` |
| Deploy | `ใช้ portdiary-deploy checklist แล้ว push main` |
| AI / Copilot | `ใช้ portdiary-ai เพิ่ม preset Copilot หรือแก้ analyze JSON` |

หรือใส่ `@` แล้วเลือกไฟล์ skill:
```
@.cursor/skills/portdiary-report-chart/SKILL.md กราฟ flat ช่วงต้นปี
```

---

### 3) ดู / เปิด Rules ใน Cursor Settings

1. `Cursor Settings` → **Rules** (หรือ **Project Rules**)
2. ควรเห็น rule จาก `.cursor/rules/` เช่น `portdiary-core`, `portdiary-fx`
3. ตรวจว่า **ไม่ปิด** project rules สำหรับ workspace นี้

ถ้า rule ไม่ขึ้น: reload window (`Ctrl+Shift+P` → `Developer: Reload Window`)

---

### 4) แก้ไฟล์ให้ rule ทำงาน

| ถ้าคุณแก้ไฟล์… | Rule ที่ควรช่วย |
|----------------|------------------|
| `src/lib/reportScope.js` | fx, charts |
| `PortfolioReport.jsx` | fx, charts |
| `holdingSync.js` | holdings |
| `TransactionModal.jsx` | thai-tickers |
| `portfolioHistory.js` | fx, charts |
| `ai.js`, `AIPanel.jsx` | portdiary-ai |

เปิดไฟล์นั้นใน editor แล้วคุยใน Agent — rule จะ attach ตาม glob

---

### 5) Workflow แนะนำตามสถานการณ์

#### แก้กราฟ Report / Overview
```
1. เปิด src/lib/reportScope.js
2. Prompt: "ใช้ portdiary-report-chart — ทุกพอร์ตรวม % ไม่ตรง KPI"
3. ให้ agent รัน npm run build
4. ทดสอบ: Report → ทุกพอร์ตรวม → สลับ THB/USD
```

#### แก้ transaction / ทุนเฉลี่ย
```
1. เปิด backend/src/lib/holdingSync.js
2. Prompt: "ใช้ portdiary-holding-sync ตรวจ ORDER BY และ avg_cost"
3. cd backend && npm test
4. เพิ่ม migration rebuild ถ้า logic เปลี่ยน
```

#### Deploy ก่อน beta
```
1. Prompt: "ใช้ portdiary-deploy — build, test, commit, push main"
2. ถ้างานเสี่ยง: ขอ backup tag ก่อน (skill มีคำสั่ง)
3. Hard refresh production หลัง deploy
```

#### แก้หน้า AI (Copilot / วิเคราะห์ / ข่าว)
```
1. เปิด backend/src/routes/ai.js หรือ AIPanel.jsx
2. Prompt: "ใช้ portdiary-ai — [preset / quota / JSON analyze]"
3. cd backend && npm test -- aiAnalyzeContext aiQuota aiPlan
4. ทดสอบ Free vs Pro ใน UI (quota hint + custom Copilot)
```

#### Review ก่อน merge (ไม่ใช่ skill แต่ใช้ร่วมได้)
```
รัน bugbot review กับ branch changes
```
หรือใน Cursor สั่ง agent ให้ review diff ตาม rules

---

### 6) Subagent ในตัว Cursor (เสริม Skills)

Agent หลักสามารถส่งงานย่อยได้ เช่น:
- **explore** — ไล่ codebase ก่อน refactor ใหญ่
- **shell** — รัน git, npm test, deploy
- **bugbot** — review diff

**ตัวอย่าง:**
```
ใช้ explore หา everywhere ที่ merge portfolio history แล้วแก้ตาม portdiary-report-chart skill
```

---

## รายละเอียดแต่ละ Rule

### `portdiary-core` (ทุก session)
- โครงสร้าง repo, path สำคัญ
- หลักการ: KPI จาก holdings, กราฟจาก history + TWR

### `portdiary-fx`
- `convertAmount` บังคับเมื่อรวมสกุลเงิน
- `inferPortfolioCurrency` เมื่อ DB เก่า
- สัญญาณ regression: % หลักพัน, KPI ถูกแต่กราฟพัง

### `portdiary-charts`
- forward-fill ตอน merge
- TWR formula และ cash flow
- PDF print ใน `dashboard.css`

### `portdiary-thai-tickers`
- `-BK`, SET, THB บน transaction form
- อย่า reset market ตอนพิมพ์ ticker

### `portdiary-holdings`
- average-cost ถูกต้อง vs lifetime-buy average ผิด
- `ORDER BY date, created_at, id`

### `portdiary-ai`
- 4 AI features + 2 plans (Free/Pro)
- Copilot = text, Analyze/News = JSON
- ห้ามแต่งตัวเลข / ต้องมี disclaimer

---

## รายละเอียดแต่ละ Skill

### `portdiary-report-chart`
Checklist วินิจฉัยกราฟ, ไฟล์ที่ต้องแตะ, วิธี verify หลังแก้, PDF

### `portdiary-holding-sync`
`computeHoldingFromTxRows`, migration rebuild, tests

### `portdiary-deploy`
build, test, tag backup, push, smoke test หลัง deploy

### `portdiary-ai`
แผน Free/Pro, checklist เพิ่ม preset/endpoint, ทดสอบ quota + JSON parse

**หมายเหตุ:** Skill นี้ช่วย **developer ใน Cursor** เท่านั้น — ผู้ใช้แอปไม่เห็นไฟล์นี้ แต่ได้ประโยชน์ทางอ้อมเมื่อคุณแก้ `ai.js` ถูกต้อง

---

## การปรับแต่ง / เพิ่มเอง

### เพิ่ม Rule ใหม่
1. สร้าง `.cursor/rules/my-rule.mdc`
2. frontmatter: `description`, `globs` หรือ `alwaysApply: true`
3. เนื้อหาไม่เกิน ~50 บรรทัด, หนึ่งเรื่องต่อไฟล์

### เพิ่ม Skill ใหม่
1. สร้าง `.cursor/skills/my-skill/SKILL.md`
2. frontmatter: `name`, `description` (third person + trigger words)
3. ใส่ checklist + paths + verify steps

อ้างอิง: Cursor docs เรื่อง [Rules](https://docs.cursor.com/context/rules) และ Agent Skills

---

## FAQ

**Q: Agent ไม่เห็น skill?**  
A: ใส่ `@.cursor/skills/.../SKILL.md` ในข้อความ หรือพิมพ์ชื่อ skill ชัดๆ

**Q: Rule ไม่ทำงาน?**  
A: เปิดไฟล์ที่ตรง glob หรือ reload window; ดู Settings → Rules

**Q: ต่างจาก Claude sub-agent?**  
A: Cursor ไม่มี UI สร้าง sub-agent เอง — ใช้ **Rules + Skills + subagent ในตัว** แทน

**Q: แชร์กับทีม?**  
A: commit `.cursor/` ขึ้น git — ทุกคนที่ clone repo ได้ rules/skills เดียวกัน

---

## Quick reference ( copy-paste )

```
# กราฟรวมพอร์ต
ใช้ portdiary-report-chart แก้ทุกพอร์ตรวม graph ให้ % ใกล้ KPI

# ทุนหลังขาย
ใช้ portdiary-holding-sync ตรวจ avg_cost และเพิ่ม test

# Deploy
ใช้ portdiary-deploy build test แล้ว push main

# Backup ก่อนแก้ใหญ่
สร้าง backup tag ตาม portdiary-deploy ก่อนเริ่มแก้ P0

# หน้า AI
ใช้ portdiary-ai แก้ Copilot preset หรือ analyze JSON schema
```
