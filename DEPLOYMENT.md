# HookMerge AI — free production deployment

## Recommended architecture

Use one Ubuntu ARM64 virtual machine, Docker Compose, SQLite on a persistent Docker volume, FFmpeg in the app container, and Caddy for automatic HTTPS. This matches the app's current requirements: a persistent Node.js process, `node:sqlite`, local upload storage, and FFmpeg. Static hosting/serverless functions are not a drop-in fit.

## 1. Create the free VM

1. Create an Oracle Cloud Free Tier account: https://www.oracle.com/cloud/free/
2. In your home region, create an Ubuntu 24.04 ARM64 VM using an Always Free eligible Ampere A1 shape.
3. Use up to 2 OCPUs and 12 GB RAM (the current Always Free A1 allowance; check the console's Always Free label before creating resources).
4. Give it a public IPv4 address and at least the default boot volume.
5. In the VM's subnet security list / network security group, allow inbound TCP 22 (SSH), 80 (HTTP) and 443 (HTTPS). Do not expose port 3000 publicly.
6. Save the private SSH key safely and connect to the VM.

Oracle's free capacity is not guaranteed in every region. If you see an out-of-host-capacity error, retry later or another availability domain in your home region. Oracle also documents idle-instance reclamation conditions, so an Always Free VM is not an uptime guarantee.

## 2. Create a free hostname

1. Create a DuckDNS account at https://www.duckdns.org/.
2. Create a subdomain, for example `hookmerge-demo.duckdns.org`.
3. Point its IPv4 record at the VM's public IP.
4. If the VM public IP changes, update the DuckDNS record. Keep the DuckDNS token private.

A domain is needed so Caddy can automatically request and renew a trusted HTTPS certificate. Caddy needs inbound ports 80 and 443 to be reachable.

## 3. Install Docker

SSH into Ubuntu and run:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Log out and SSH back in so the Docker group change takes effect. Then check:

```bash
docker --version
docker compose version
```

Configure the Ubuntu firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

The Oracle network security list / NSG must also allow those ports.

## 4. Put the updated project on the VM

Push the updated HookMerge AI project files to your GitHub repository, then on the VM:

```bash
git clone https://github.com/soul20gx-droid/hookmergeai.git
cd hookmergeai
```

If the repository is private, use SSH deploy keys or GitHub's supported authentication flow. Do not put a personal access token directly into a clone URL or shell history.

## 5. Create production secrets

Create the production `.env` file on the VM only:

```bash
cp .env.example .env
nano .env
```

Generate three separate random secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

Use the first for `LICENSE_SECRET`, the second for `ENCRYPTION_KEY`, and the third for `ADMIN_SECRET`. Each must be at least 32 characters. Do not reuse them.

Set these values in `.env`:

```dotenv
DATABASE_URL=file:/app/data/hookmerge.db
LICENSE_SECRET=PASTE_FIRST_RANDOM_SECRET
ADMIN_SECRET=PASTE_THIRD_RANDOM_SECRET
ENCRYPTION_KEY=PASTE_SECOND_RANDOM_SECRET
INITIAL_LICENSE_KEY=PASTE_A_SEPARATE_RANDOM_INVITE_KEY
STORAGE_DIR=/app/storage
MAX_UPLOAD_MB=200
NEXT_PUBLIC_APP_URL=https://hookmerge-demo.duckdns.org
DOMAIN=hookmerge-demo.duckdns.org
```

Generate the one-time owner license separately, for example with `openssl rand -hex 20`. Keep it private. Do not use the example value or put it in GitHub. Leave any shared server-side AI provider key unset; this deployment requires each license holder to provide their own AI key.

Protect the file:

```bash
chmod 600 .env
```

## 6. Build and start

```bash
docker compose up -d --build
```

Check status and logs:

```bash
docker compose ps
docker compose logs -f app
```

Caddy will request HTTPS after the hostname resolves to the VM and ports 80/443 are reachable. Open:

`https://hookmerge-demo.duckdns.org`

Then check:

`https://hookmerge-demo.duckdns.org/api/health`

The response should report `ok: true`, `database: "ok"`, and `ffmpeg: true`.

## 7. Create individual invitations

1. Open `/verify` and sign in with the private one-time owner license.
2. Open `/admin` and sign in with `ADMIN_SECRET`.
3. Generate one unique license key per invited person. Set expiry and generation limits if appropriate.
4. Send each license key privately to its owner. Do not put keys in public chat, README files, source code or screenshots.
5. After the owner license has been used and the individual invites are created, remove `INITIAL_LICENSE_KEY` from `.env` and restart:

```bash
nano .env
docker compose up -d
```

Do not delete the database volume; it contains the licenses you issued.

## 8. Backups

Back up both persistent volumes. A simple maintenance backup (run from the project directory) is:

```bash
mkdir -p backups
backup_name="hookmerge-$(date +%Y%m%d-%H%M%S).tar.gz"
docker run --rm \
  -v hookmergeai_hookmerge_data:/data:ro \
  -v hookmergeai_hookmerge_storage:/storage:ro \
  -v "$PWD/backups:/backup" \
  alpine sh -c "tar -czf /backup/$backup_name -C / data storage"
```

Check the actual volume names with `docker volume ls`; Compose may prefix them with the project directory name. Store backups somewhere other than the VM as well. Preserve the exact `LICENSE_SECRET` and `ENCRYPTION_KEY` separately. Without the same encryption key, saved provider keys cannot be decrypted; without the same license secret, license keys will no longer verify.

## 9. Updates

After pushing a reviewed update to GitHub:

```bash
cd hookmergeai
git pull --ff-only origin main
docker compose up -d --build
```

Before updates, make a backup of the database and storage volumes.

## Important free-tier caveats

- Oracle Always Free capacity can be unavailable in a selected region; provisioning is not guaranteed.
- Oracle's free A1 limits and idle-instance policies can change. Verify current Always Free eligibility in the Oracle console before creating the VM.
- This is a single-VM deployment, not high availability. A VM outage, account issue or provider policy change can take the website offline.
- Users pay their own AI provider for model and transcription usage. The VM, domain and hosting target are free-tier services; the AI providers themselves may charge users.
