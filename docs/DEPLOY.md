# Deploy to VPS (GitHub Actions)

## Daily workflow (auto)

```
PC: แก้โค้ด → commit → push main
         ↓
GitHub Actions: SSH เข้า VPS → git pull → docker compose rebuild
```

**บน Windows (แนะนำ):**

```powershell
.\scripts\push-deploy.ps1 "fix: คำอธิบายการเปลี่ยนแปลง"
```

**หรือด้วยมือ:**

```bash
git add .
git commit -m "your message"
git push origin main
```

หลัง push ดูสถานะที่ [Actions → Deploy to VPS](https://github.com/FtndS/portfolio-app/actions/workflows/deploy.yml) — ประมาณ 3–5 นาที แล้วเว็บ [portdiary.com](https://portdiary.com) จะอัปเดต (hard refresh ถ้า CSS ค้าง)

**ครั้งแรกเท่านั้น:** ตั้ง GitHub Secrets + deploy key บน VPS (ด้านล่าง) แล้วรัน workflow **Verify VPS SSH** ให้ผ่าน

---

## Why deploy was failing

Deploy jobs failed at **SSH** because GitHub Secrets were missing or the SSH key was misconfigured. The workflow now validates secrets and uses native SSH (`webfactory/ssh-agent`) instead of `appleboy/ssh-action`.

## One-time setup

### 1. Generate deploy key (on your computer)

```bash
chmod +x scripts/setup-github-deploy-key.sh
./scripts/setup-github-deploy-key.sh
```

### 2. Add public key on VPS

```bash
ssh root@YOUR_VPS_IP

mkdir -p ~/.ssh && chmod 700 ~/.ssh
# Paste the public key line from the script output:
echo 'ssh-ed25519 AAAA... github-actions-portfolio-app' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Test from your computer:

```bash
ssh -i ~/.ssh/portfolio-app-deploy root@YOUR_VPS_IP 'echo OK'
```

### 3. Add GitHub Secrets

Open: **https://github.com/FtndS/portfolio-app/settings/secrets/actions**

Use **either** option (not both required):

**Option A — Repository secrets (recommended):** tab **Secrets** → **Repository secrets** → **New repository secret**

**Option B — Environment secrets:** tab **Secrets** → **Environments** → **Production** → add secrets there. Workflows use `environment: Production`.

| Secret | Value |
|--------|--------|
| `VPS_HOST` | VPS IP or domain |
| `VPS_USER` | `root` |
| `VPS_PORT` | `22` (optional) |
| `VPS_SSH_KEY` | Full private key including `-----BEGIN` / `-----END` lines |

**Windows:** run `powershell -File scripts/setup-github-deploy-key.ps1`

**Common mistakes (why it "didn't work" before):**
- Secret added under **Variables** instead of **Secrets**
- Secret added to **Environment** but workflow had no `environment:` (use **Production** or move to Repository secrets)
- Wrong repo or fork
- Pasted `.pub` (public) key instead of private key
- Private key missing `BEGIN`/`END` lines (broken copy-paste)
- Public key never added to VPS `~/.ssh/authorized_keys`

### 4. Verify SSH

GitHub → **Actions** → **Verify VPS SSH** → **Run workflow**

Must show: `SSH OK — connected as root on ...`

### 5. Deploy

Push to `main` or run **Deploy to VPS** manually.

## Manual deploy (fallback)

```bash
ssh root@YOUR_VPS_IP
cd ~/portfolio-app
git pull origin main
chmod +x scripts/deploy-vps.sh   # once, if Permission denied
./scripts/deploy-vps.sh
# or: bash scripts/deploy-vps.sh
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Missing VPS_SSH_KEY` | Add secret in GitHub Settings |
| `BEGIN.*PRIVATE KEY` validation failed | Paste full private key, not `.pub` |
| `unable to authenticate` | Public key not in VPS `authorized_keys`, or key pair mismatch |
| `Connection timed out` / port unreachable | Intermittent GitHub runner → VPS routing; workflow retries 4× with 45s TCP timeout (`scripts/github-ssh-retry.sh`). If still failing, deploy manually or use a self-hosted runner on the VPS |
| `No such container: *_portfolio-backend` | Stale Docker Compose state — run `docker compose rm -sf backend; docker rm -f portfolio-backend; ./scripts/deploy-vps.sh` |
| `.env not found` | Create `~/portfolio-app/.env` from `.env.example` |

## Reset database (wipe all users/data)

Postgres runs **inside Docker on the VPS** — not on your Windows PC. Do **not** run `reset-db.ps1` locally unless Docker is installed.

**On VPS (recommended):**

```bash
ssh root@YOUR_VPS_IP
cd ~/portfolio-app
git pull origin main
chmod +x scripts/reset-db.sh
./scripts/reset-db.sh
# type: yes
```

**From Windows (SSH to VPS):**

```powershell
.\scripts\reset-db-remote.ps1 -VpsHost YOUR_VPS_IP
# optional: -SshKey "$env:USERPROFILE\.ssh\portfolio-app-deploy"
```

After reset, deploy latest code first if needed (`git pull` + `docker compose up -d --build`), then restart applies fresh migrations. Only OTP-verified registrations can log in.
