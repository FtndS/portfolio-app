# Deploy to VPS (GitHub Actions)

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

Repository → **Settings** → **Secrets and variables** → **Actions**

| Secret | Value |
|--------|--------|
| `VPS_HOST` | VPS IP or domain |
| `VPS_USER` | `root` |
| `VPS_PORT` | `22` (optional) |
| `VPS_SSH_KEY` | Full private key including `-----BEGIN` / `-----END` lines |

**Important:** Use the **private** key that matches the **public** key in `authorized_keys`. Do not paste the server's host key or a public key into `VPS_SSH_KEY`.

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
./scripts/deploy-vps.sh
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Missing VPS_SSH_KEY` | Add secret in GitHub Settings |
| `BEGIN.*PRIVATE KEY` validation failed | Paste full private key, not `.pub` |
| `unable to authenticate` | Public key not in VPS `authorized_keys`, or key pair mismatch |
| `~/portfolio-app not found` | Clone repo on VPS: `git clone https://github.com/FtndS/portfolio-app.git ~/portfolio-app` |
| `.env not found` | Create `~/portfolio-app/.env` from `.env.example` |
