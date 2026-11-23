# HookMerge AI

Turn any reference video into an original, high-retention short-form script.

HookMerge AI analyses *why* a reference video holds attention — hook shape, pacing, curiosity gaps, retention moves, payoff — then writes a brand-new script for your niche using your own AI provider key.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS (custom midnight/lavender/neon design system) |
| Database | SQLite via Node's built-in `node:sqlite` (no native build step) |
| Auth | Server-side license keys (SHA-256 + pepper) → hashed session tokens in HttpOnly cookies |
| Admin | Separate `ADMIN_SECRET` password + separate admin session cookie |
| AI | Fetch-based provider adapters: OpenAI-compatible (NVIDIA NIM, OpenAI, OpenRouter, Groq, custom) + Google Gemini |
| Video | Local object storage + ffmpeg/ffprobe audio extraction → Whisper-compatible or Gemini transcription |
| YouTube | Public oEmbed metadata + public caption tracks; transcript paste fallback |

No mock AI. Every generation is a real provider call with the user's key. If a key or transcript is missing you get a clear, actionable error instead of fake output.

---

## Quick start

Requirements: **Node 20.11+** (Node 22/24 recommended for stable `node:sqlite`) and **ffmpeg** on `PATH` for automatic video transcription.

```bash
npm install
cp .env.example .env.local     # then fill in the values below
npm run dev                    # http://localhost:3000
```

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`.env.local` (see `.env.example`):

```ini
DATABASE_URL=file:./data/hookmerge.db
LICENSE_SECRET=<32-byte hex>
ADMIN_SECRET=<your admin password>
ENCRYPTION_KEY=<32-byte hex>
INITIAL_LICENSE_KEY=<unique-one-time-owner-license>
STORAGE_DIR=./storage
MAX_UPLOAD_MB=200
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

If `LICENSE_SECRET`, `ADMIN_SECRET` or `ENCRYPTION_KEY` are missing, the server generates them once and stores them in `data/.secrets.json` (git-ignored) so local development still works. Set them explicitly in production.

### First login

1. Open `/verify`.
2. Enter the private one-time owner license you set in `INITIAL_LICENSE_KEY`. Do not use a shared/public default.
3. Open `/app/config`, choose a provider, paste your key, pick a model, **Test connection**, then **Save**.

> The seeded key is created only when you explicitly set `INITIAL_LICENSE_KEY`. Use a random, private value, log in once, create individual invitation keys in `/admin`, then remove `INITIAL_LICENSE_KEY` from the production environment. Never publish a real invite key in README or source control.

### Admin console

Open `/admin` and sign in with the private `ADMIN_SECRET`. Admin can generate unique invite/license keys, set expiry and generation limits, revoke/reactivate/delete licenses, search issued keys, inspect usage and configure defaults. Issue one license per person; anyone who possesses a license key can access that license account and its data.


---

## The workflow

1. **Niche** — free text, long-tail encouraged.
2. **Reference** — upload MP4/MOV/WEBM/M4V, paste a YouTube link, or paste a transcript.
3. **AI brain** — provider, model, key (stored encrypted separately for each license).
4. **Mode + length** — Fast / Balanced / Premium and 15–90 seconds.
5. **Generate** — the job manager streams real stage updates: processing reference → extracting transcript → analysing storytelling → understanding niche → generating script → finalizing.
6. **Results** — hook, full script, structure, the 15-signal analysis, generation details, and working actions: copy, download TXT, edit/save, regenerate, improve hook, more engaging, shorten, expand, new version. Every action creates a new saved version.

---

## Architecture

```
src/
  app/
    page.tsx                 Landing (hero, workflow, features, providers, access, FAQ)
    verify/                  License gate
    terms|privacy|contact/   Public pages
    admin/                   Operator console (client, separate auth)
    app/                     Licensed workspace (server layout guard + sidebar)
      page.tsx               Creation dashboard (Studio)
      scripts/               Library + results workspace
      config|account|settings
    api/
      license/               verify · session/logout
      config/                get/save/remove AI config · test connection
      upload/ files/[id]     Video upload, authenticated streaming (Range) and delete
      youtube/metadata/      Public metadata + caption availability
      jobs/ jobs/[id]        Create/poll/cancel generation jobs
      scripts/ …/actions     Library, edit, delete, rewrite actions
      admin/                 session · licenses · stats · settings
      health                 DB + ffmpeg status
  lib/
    db.ts                    Schema, seeding, settings
    license.ts auth.ts       License lifecycle + server sessions
    providers/               registry + OpenAI-compatible and Gemini adapters
    ai-config.ts             Per-license encrypted key resolution per request
    pipeline.ts              Job runner + rewrite actions
    prompts.ts               Analysis, strategy, script and revision prompts
    youtube.ts transcribe.ts storage.ts
  components/                Studio, results, library, config, account, sidebar, admin
```

**Provider adapters**: add a provider by appending to `src/lib/providers/registry.ts`. `kind: "openai"` reuses the OpenAI-compatible adapter; `kind: "gemini"` uses the Gemini adapter. The UI, validation and pipeline pick it up automatically.

**Job model**: generation runs asynchronously after `POST /api/jobs` returns a job ID. The browser polls `/api/jobs/:id` for real stage/progress values. Jobs marked `cancelled` are cancelled mid-flight via an `AbortController`; stale/orphaned jobs are marked failed instead of hanging forever. Completed jobs leave a real script record.

---

## Security model

- License keys are normalised, peppered and hashed before storage; only a 6-character prefix is kept for display.
- Verification returns an HttpOnly `hm_session` cookie backed by a hashed token in SQLite, 7-day expiry.
- Every protected route re-loads the license, re-checks revocation/expiry, and scopes all queries by `license_id`.
- Admin auth is completely separate (`hm_admin`, 12 hours) and every admin route calls `requireAdmin()`.
- API keys: AES-256-GCM encrypted at rest in `ai_configs`, keyed by `license_id`. Keys are never returned to the browser — only a masked preview. Each license has its own provider configuration. There is no session-only or shared server-key mode in this invite-only build.
- Rate limits on license verification (8/min/IP), admin login (6/min/IP), generation and uploads.
- Upload validation: extension allow-list, MIME sanity check, size cap, path traversal guard.
- Deliberately generic error copy for unauthenticated requests so keys cannot be enumerated.
- YouTube: public metadata and public caption tracks only. No protected media downloading or restriction bypass.

---

## Notes & limits

- **AI credentials are required per license.** Each invited user must supply their own provider key. HookMerge does not use an operator-owned fallback key, so your account does not pay for user generations.
- **Transcription needs ffmpeg.** Without ffmpeg, uploads rely on a pasted transcript. NVIDIA NIM and OpenRouter are text-only providers, so uploads also need a transcript there (or OpenAI/Groq/Gemini for audio).
- **YouTube captions** can be unavailable (no captions, age/login restriction, or server-side YouTube blocking). The UI then asks for a transcript.
- **Storage is local** (`./storage`) and the database is a local SQLite file. Deploy on a host with a persistent disk. Swapping to Postgres/S3 means replacing `src/lib/db.ts` and `src/lib/storage.ts`.
- Billing is not integrated: licenses are issued by the operator through `/admin`, as described on the landing page.
- Generated scripts are drafts. Review before publishing and respect the platforms you publish to.


## Production deployment (Docker + persistent VM)

This app needs a persistent Node.js process, SQLite files, local upload storage and FFmpeg. Do not deploy this repository unchanged to static hosting or edge/serverless platforms.

1. Create a private GitHub repository and keep `.env`, `.env.production`, database files, uploads and backups out of Git.
2. Provision an Ubuntu 24.04 ARM64 VM with at least 2 GB RAM (Oracle Cloud Always Free Ampere A1 is the preferred zero-monthly-cost target when capacity is available).
3. Install Docker Engine and the Docker Compose plugin.
4. Point a domain or free dynamic-DNS hostname to the VM public IP and allow inbound TCP 80/443 and SSH in both the cloud security list and Ubuntu firewall.
5. Copy `.env.example` to `.env` on the VM. Generate unique random 32-byte hex values for `LICENSE_SECRET` and `ENCRYPTION_KEY`, and a long unique `ADMIN_SECRET`; set `DOMAIN` and `NEXT_PUBLIC_APP_URL` to your HTTPS hostname. Do not configure a shared AI provider key. Set a unique random `INITIAL_LICENSE_KEY` only for the first owner login.
6. Run `docker compose up -d --build`. Caddy obtains and renews the HTTPS certificate automatically when DNS and ports are correct.
7. Open `/verify` and log in with the private one-time owner license. Open `/admin`, create a separate invite key for each user, and securely send each key privately.
8. Remove `INITIAL_LICENSE_KEY` from `.env` and restart with `docker compose up -d` after the owner has logged in and created invites. The existing database retains issued licenses.
9. Back up the `hookmerge_data` and `hookmerge_storage` Docker volumes regularly. Keep the encryption key and license secret backed up separately; losing them can make stored API keys or license verification unusable.

### Required production environment variables

`LICENSE_SECRET`, `ADMIN_SECRET`, and `ENCRYPTION_KEY` must be explicitly set in production. The app refuses to silently generate production secrets. `INITIAL_LICENSE_KEY` is optional and should be removed after initial owner setup. The server does not use an operator-owned AI key; every license must save its own provider key.

### Invitation and account isolation

The license key is the user's account identity in this version. Issue one unique license per invited person. A person with a license key can access the scripts and AI configuration attached to that license, so never reuse or publicly post keys. The admin console can revoke a key immediately.

### Backups and recovery

Use a scheduled backup of both persistent volumes and store encrypted copies off the VM. Restore the database, uploads and the exact same `LICENSE_SECRET` and `ENCRYPTION_KEY` together. Do not publish backup archives.
