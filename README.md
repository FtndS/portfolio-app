# PortDiary

บันทึกพอร์ตการลงทุนแบบมีระบบ — transaction, thesis, journal, กราฟ, รายงาน PDF และ AI Copilot

**Production:** [portdiary.com](https://portdiary.com)

---

## ทำอะไรได้บ้าง

| หมวด | รายละเอียด |
|------|------------|
| **ซื้อ/ขาย** | บันทึก BUY/SELL, import CSV, คำนวณ avg cost / shares อัตโนมัติ |
| **หลายพอร์ต** | แยกพอร์ต US / ไทย SET / HK / CN ในบัญชีเดียว สลับ USD/THB |
| **Thesis & Timeline** | เหตุผลถือหุ้น, เงื่อนไขเปลี่ยนใจ, timeline รวม tx + journal + ปันผล |
| **Journal** | บันทึกความคิด tag ได้ เชื่อม ticker |
| **ปันผล** | ติดตาม dividend yield และผลตอบแทนรวม |
| **กราฟ** | มูลค่าย้อนหลัง (TWR), เทียบ S&P 500 / SET, donut, sector, heatmap |
| **รายงาน** | สรุปภาพรวม พิมพ์/บันทึก PDF, เลือก scope พอร์ตเดียวหรือทุกพอร์ตรวม |
| **ข่าว** | RSS จาก Yahoo + Google News (รวมข่าวไทย/การเงิน) แยกตาม sector/ticker |
| **AI** | Copilot, วิเคราะห์พอร์ต, สรุปข่าว, สรุป journal ต่อหุ้น (Free/Pro quota) |
| **ความเป็นส่วนตัว** | ซ่อนมูลค่าเงิน (แสดงแค่ %), export ข้อมูล, ลบบัญชี |

ราคาหุ้นอ้างอิง **Yahoo Finance** — อัปเดตอัตโนมัติทุก ~5 นาที

---

## Tech stack

| Layer | เทคโนโลยี |
|-------|-----------|
| Frontend | React 19, Vite 8, vanilla CSS |
| Backend | Node.js, Express 5, PostgreSQL 16 |
| Auth | JWT, OTP ผ่าน SMTP |
| AI | Anthropic Claude API |
| Deploy | Docker Compose, nginx, GitHub Actions → VPS |

---

## โครงสร้างโปรเจกต์

```
portfolio-app/
├── src/                 # React SPA
│   ├── components/      # Dashboard, Report, Charts, Modals, AI
│   └── lib/             # FX, ticker, PnL, format
├── backend/
│   ├── src/routes/      # REST API
│   ├── src/lib/         # holding sync, portfolio history, AI context
│   └── tests/           # Vitest (71 tests)
├── public/              # Static assets, privacy page
├── nginx.conf           # Reverse proxy (API + SPA)
├── docker-compose.yml
├── docs/DEPLOY.md       # คู่มือ deploy VPS
└── .cursor/             # Cursor rules & skills (สำหรับ dev)
```

---

## เริ่มต้น (Local dev)

### สิ่งที่ต้องมี

- Node.js 22+
- PostgreSQL 16 (หรือใช้ Docker เฉพาะ DB)
- SMTP สำหรับ OTP สมัครสมาชิก (หรือทดสอบ flow อื่นก่อน)

### 1. Clone และติดตั้ง

```bash
git clone https://github.com/FtndS/portfolio-app.git
cd portfolio-app

npm ci
cd backend && npm ci && cd ..
```

### 2. ตั้งค่า environment

```bash
cp .env.example .env
# แก้ DB_*, JWT_SECRET, SMTP_*, ANTHROPIC_API_KEY (ถ้าใช้ AI)
```

สร้าง JWT secret:

```bash
./scripts/generate-jwt-secret.sh   # Linux/macOS
# หรือ powershell -File scripts/generate-jwt-secret.ps1
```

### 3. รัน

```bash
# Terminal 1 — backend (port 3001, รัน migration อัตโนมัติ)
cd backend && npm run dev

# Terminal 2 — frontend (port 5173, proxy /api → backend)
npm run dev
```

เปิด `http://localhost:5173`

### รันด้วย Docker (production-like)

```bash
docker compose up -d --build
```

ต้องมี `.env` และ SSL cert บน VPS สำหรับ nginx (ดู [docs/DEPLOY.md](docs/DEPLOY.md))

---

## Environment variables

| ตัวแปร | จำเป็น | คำอธิบาย |
|--------|--------|----------|
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | ✅ | PostgreSQL |
| `JWT_SECRET` | ✅ | Secret สำหรับ session token |
| `APP_URL` | ✅ | URL หลัก (reset password, email links) |
| `CORS_ORIGINS` | prod | Origin ที่อนุญาต |
| `SMTP_*` | สมัครสมาชิก | ส่ง OTP / reset password |
| `ANTHROPIC_API_KEY` | AI | Copilot, วิเคราะห์พอร์ต, สรุปข่าว |
| `ADMIN_EMAIL` | bootstrap | บัญชี admin ตอน migrate |
| `AI_OWNER_EMAIL` | optional | โควต้า AI ไม่จำกัด (ดู backend) |
| `PRO_*` | optional | ราคา/QR แผน Pro (manual payment) |

รายละเอียดครบใน [`.env.example`](.env.example)

---

## Database

- Migration รันอัตโนมัติเมื่อ backend start (`backend/src/db/migrate.js`)
- Holdings คำนวณจาก transactions (average cost) — หลังแก้ logic อาจต้อง rebuild holdings

รีเซ็ตข้อมูลทั้งหมด (ถาวร):

```bash
./scripts/reset-db.sh          # Linux/macOS/VPS
.\scripts\reset-db.ps1         # Windows
```

---

## Tests

```bash
cd backend && npm test       # 71 tests (Vitest)
```

ก่อน deploy แนะนำ:

```bash
npm run build                # frontend build
cd backend && npm test
```

---

## Deploy

Push ไป `main` → GitHub Actions deploy ไป VPS อัตโนมัติ

```bash
git push origin main
```

คู่มือเต็ม: [docs/DEPLOY.md](docs/DEPLOY.md) (secrets, SSH key, smoke check)

---

## AI plans (สรุป)

| Feature | Free / สัปดาห์ | Pro / สัปดาห์ |
|---------|----------------|---------------|
| วิเคราะห์พอร์ต | 1 | 8 |
| Copilot | 2 | 6 |
| สรุปข่าว | 1 | 4 |
| สรุป journal ต่อหุ้น | 2 | 6 |

Pro: ถาม Copilot เองได้ · Free: ใช้ preset คำถาม

---

## ตลาดที่รองรับ

- **US** — NYSE, NASDAQ
- **ไทย SET** — suffix `-BK` (เช่น `SCB-BK`)
- **HK / CN** — ตาม ticker mapping ใน `src/lib/ticker.js`

อย่ารวมยอด THB + USD โดยตรง — ใช้ `convertAmount` / display currency

---

## ความเป็นส่วนตัว

- Export ข้อมูล JSON จาก Settings
- ลบบัญชีถาวรจาก Settings
- นโยบาย: [public/privacy.html](public/privacy.html)

---

## สำหรับนักพัฒนา (Cursor)

Repo มี Rules และ Skills ใน `.cursor/` — ดู [AGENTS.md](AGENTS.md) และ [.cursor/README.md](.cursor/README.md)

---

## Disclaimer

PortDiary เป็นเครื่องมือบันทึกและทบทวนการลงทุนส่วนตัว **ไม่ใช่คำแนะนำการลงทุน** ราคาและมูลค่าอ้างอิงจากแหล่งภายนอก อาจล่าช้าหรือคลาดเคลื่อน

---

## License

Private project — all rights reserved unless stated otherwise.
