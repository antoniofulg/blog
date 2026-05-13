# VPS Setup Checklist

Work through this top-to-bottom. Check each box as done.

---

## Fill these in before running anything

| Placeholder | Where used | Your value |
|---|---|---|
| `YOUR_VPS_IP` | Phases 2, 3 | |
| `your-domain.com` | Phases 5, 9 | |
| `STRONG_PG_PASSWORD` | Phase 6 `docker-compose.yml` + `.env` — **must match in both** | |
| `BETTER_AUTH_SECRET` | Phase 6 `.env` — run `openssl rand -base64 32` | |
| `your@email.com` | Phase 6 `.env` | |
| `your-github-username` | Phase 7, Quick ref | |

> `POSTGRES_PASSWORD` in `docker-compose.yml` and the password inside `DATABASE_URL` in `.env` must be identical.

---

## Phase 1 — Local prep (before touching the VPS)

- [ ] Domain `A` record pointing to VPS IP (propagation can take minutes)
- [ ] Generate deploy SSH key pair on your local machine:
  ```sh
  ssh-keygen -t ed25519 -C "deploy@blog" -f ~/.ssh/blog_deploy
  ```
- [ ] Note: `~/.ssh/blog_deploy` = private key (goes to GitHub Secret), `~/.ssh/blog_deploy.pub` = public key (goes to VPS)

---

## Phase 2 — First login as root

- [ ] Find the SSH port your provider uses (check your provider dashboard or welcome email):
  ```sh
  ssh -p PORT root@YOUR_VPS_IP
  # Common ports: 22, 2222, 22022
  ```
- [ ] Once connected, confirm the port:
  ```sh
  sshd -T | grep ^port
  # Note this value — use it everywhere below
  ```
- [ ] Run updates:
  ```sh
  apt update && apt upgrade -y
  ```
- [ ] Create deploy user:
  ```sh
  useradd -m -s /bin/bash deploy
  usermod -aG sudo deploy
  ```
- [ ] **Set deploy user password now** (needed for sudo later):
  ```sh
  passwd deploy
  # New password: (choose a strong password, save it)
  # Retype new password:
  ```
- [ ] Add SSH public key to deploy user:
  ```sh
  su - deploy
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  nano ~/.ssh/authorized_keys   # paste contents of ~/.ssh/blog_deploy.pub
  chmod 600 ~/.ssh/authorized_keys
  exit
  ```
- [ ] Verify permissions are correct (run as root):
  ```sh
  stat /home/deploy/.ssh              # must show 0700, owner deploy
  stat /home/deploy/.ssh/authorized_keys  # must show 0600, owner deploy
  cat /home/deploy/.ssh/authorized_keys   # must show your public key
  ```
  If owner is wrong: `chown deploy:deploy /home/deploy/.ssh/authorized_keys`
  If permissions are wrong: `chmod 600 /home/deploy/.ssh/authorized_keys`
- [ ] Validate sshd config has no errors:
  ```sh
  sshd -t   # no output = good
  ```
- [ ] **⚠️ Keep this root session open. Open a NEW terminal and verify deploy login works:**
  ```sh
  ssh -i ~/.ssh/blog_deploy -p PORT deploy@YOUR_VPS_IP
  # Must succeed before continuing
  ```
- [ ] Only after deploy login confirmed — harden SSH (`/etc/ssh/sshd_config`):
  ```
  PermitRootLogin no
  PasswordAuthentication no
  ```
  ```sh
  sshd -t                  # validate — no output = good
  systemctl restart sshd
  ```
- [ ] **Verify deploy login still works after restart** (new terminal again):
  ```sh
  ssh -i ~/.ssh/blog_deploy -p PORT deploy@YOUR_VPS_IP
  # If this fails — you still have root open to fix it
  ```
- [ ] Close root session only after deploy login is confirmed working

---

## Phase 3 — Firewall

_Run as deploy user (with sudo) — it will ask for the deploy user password you set in Phase 2_

- [ ] Allow ports (replace PORT with your actual SSH port):
  ```sh
  sudo ufw allow PORT/tcp
  sudo ufw allow 80
  sudo ufw allow 443
  sudo ufw enable
  ```
- [ ] Verify:
  ```sh
  sudo ufw status
  ```
  Expected output:
  ```
  Status: active

  To                         Action      From
  --                         ------      ----
  22022/tcp                  ALLOW       Anywhere
  80                         ALLOW       Anywhere
  443                        ALLOW       Anywhere
  22022/tcp (v6)             ALLOW       Anywhere (v6)
  80 (v6)                    ALLOW       Anywhere (v6)
  443 (v6)                   ALLOW       Anywhere (v6)
  ```

---

## Phase 4 — Docker

- [ ] Install Docker:
  ```sh
  sudo apt install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt update
  sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  ```
- [ ] Add deploy user to docker group:
  ```sh
  sudo usermod -aG docker deploy
  ```
- [ ] **Re-login** (group change requires new session):
  ```sh
  exit
  ssh -i ~/.ssh/blog_deploy deploy@YOUR_VPS_IP
  ```
- [ ] Verify: `docker run hello-world` exits without error
- [ ] Clean up:
  ```sh
  docker rm $(docker ps -aq)
  docker rmi hello-world
  ```

---

## Phase 5 — Caddy (reverse proxy + HTTPS)

- [ ] Install Caddy:
  ```sh
  sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
    sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
    sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt update && sudo apt install -y caddy
  ```
- [ ] Configure `/etc/caddy/Caddyfile`:
  ```sh
  sudo nano /etc/caddy/Caddyfile
  ```
  Content:
  ```
  your-domain.com {
      reverse_proxy localhost:3000
  }
  ```
- [ ] Reload Caddy:
  ```sh
  sudo systemctl reload caddy
  sudo systemctl status caddy   # should be active (running)
  ```

---

## Phase 6 — Project directory + env

- [ ] Create project dir:
  ```sh
  sudo mkdir -p /home/deploy/blog
  sudo chown deploy:deploy /home/deploy/blog
  cd /home/deploy/blog
  ```
- [ ] Create `docker-compose.yml` (copy from `docker-compose.prod.yml` in repo — paste contents):
  ```sh
  nano docker-compose.yml
  ```
  > Key: change `POSTGRES_PASSWORD` to a strong value. Match it in DATABASE_URL below.
- [ ] Create `.env`:
  ```sh
  nano .env
  ```
  Contents (fill in real values):
  ```
  DATABASE_URL=postgres://blog:STRONG_PG_PASSWORD@db:5432/blog
  POSTGRES_DB=blog
  POSTGRES_USER=blog
  POSTGRES_PASSWORD=STRONG_PG_PASSWORD
  BETTER_AUTH_SECRET=<run: openssl rand -base64 32>
  ADMIN_EMAIL=your@email.com
  ADMIN_PASSWORD=strongpassword
  ```
  > `POSTGRES_PASSWORD` and the password in `DATABASE_URL` must be identical.
  ```sh
  chmod 600 .env
  ```
- [ ] Verify `.env` has no placeholder values left

---

## Phase 7 — First manual start (bootstrap)

- [ ] Set GHCR vars and pull image:
  ```sh
  export GHCR_OWNER=your-github-username
  export GHCR_REPO=blog
  docker compose pull
  ```
  > If image not yet built: push to main first so CI/CD builds it, then come back here.
- [ ] Start stack:
  ```sh
  docker compose up -d
  ```
- [ ] Verify both containers running:
  ```sh
  docker compose ps
  # db: healthy, app: running
  ```
- [ ] Check app logs:
  ```sh
  docker compose logs -f app
  ```
- [ ] Hit the domain: `curl -I https://your-domain.com` → `HTTP/2 200`

---

## Phase 8 — GitHub Secrets

Go to: `github.com/YOUR_USER/blog` → Settings → Secrets and variables → Actions

- [ ] `VPS_HOST` — VPS IP address
- [ ] `VPS_USER` — `deploy`
- [ ] `VPS_SSH_KEY` — contents of `~/.ssh/blog_deploy` (private key, full PEM including header/footer lines)
- [ ] `VPS_PORT` — the port you found in Phase 2 (e.g. `22`, `2222`, `22022`)
- [ ] `VPS_DEPLOY_PATH` — `/home/deploy/blog`
- [ ] `DEPLOY_DOMAIN` — your domain (e.g. `antoniofulg.tech`) — used for smoke test after deploy

---

## Phase 9 — End-to-end CD test

- [ ] Merge a PR (or push a trivial commit) to `main`
- [ ] Watch Actions tab:
  - [ ] `ci.yml` → all jobs green (test / lint / check / build-js / docker-build)
  - [ ] `cd.yml` → triggered automatically after ci.yml passes
    - [ ] `build-push` job: image pushed to GHCR
    - [ ] `deploy` job: SSH to VPS, `db:migrate` ran, container restarted, smoke test passed
    - [ ] `changelog` job: CHANGELOG.md updated
  > If smoke test fails, deploy auto-rolls back to previous image
- [ ] Visit `https://your-domain.com` — live with new changes

---

## Done ✓

Site live at `https://your-domain.com` with automatic deploys on every merge to `main`.

---

## Quick reference (ongoing)

```sh
# View logs
docker compose -f /home/deploy/blog/docker-compose.yml logs -f app

# Restart app
docker compose -f /home/deploy/blog/docker-compose.yml restart app

# Manual rollback to a previous SHA
docker pull ghcr.io/antoniofulg/blog:OLD_SHA
docker tag ghcr.io/antoniofulg/blog:OLD_SHA ghcr.io/antoniofulg/blog:latest
docker push ghcr.io/antoniofulg/blog:latest
# Then SSH in and run:
# docker compose -f /home/deploy/blog/docker-compose.yml pull && \
# docker compose -f /home/deploy/blog/docker-compose.yml up -d --no-deps app

# Smoke test site manually
curl -I https://antoniofulg.tech
```
