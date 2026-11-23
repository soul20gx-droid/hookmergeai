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
INITIAL_LICENSE_KEY=hookmergenotfreeatall
STORAGE_DIR=./storage
MAX_UPLOAD_MB=200
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

If `LICENSE_SECRET`, `ADMIN_SECRET` or `ENCRYPTION_KEY` are missing, the server generates them once and stores them in `data/.secrets.json` (git-ignored) so local development still works. Set them explicitly in production.

### First login

1. Open `/verify`.
2. Enter `hookmergenotfreeatall` (the seeded `INITIAL_LICENSE_KEY`).
3. Open `/app/config`, choose a provider, paste your key, pick a model, **Test connection**, then **Save**.

> The seeded key is created on first database boot and never reactivated if you revoke it. Change `INITIAL_LICENSE_KEY` before deploying, or delete the database to reseed.

### Admin console

Open `/admin` and sign in with `ADMIN_SECRET` (from `.env.local`, or the generated value printed in the server log / stored in `data/.secrets.json`).

Admin can generate batches of keys, set expiry and generation limits, revoke/reactivate/delete licenses, search issued keys, inspect usage and configure defaults.

---

## The workflow

1. **Niche** — free text, long-tail encouraged.
2. **Reference** — upload MP4/MOV/WEBM/M4V, paste a YouTube link, or paste a transcript.
3. **AI brain** — provider, model, key (stored encrypted or session-only).
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
    ai-config.ts             Encrypted/session key resolution per request
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
- API keys: AES-256-GCM encrypted at rest, or kept in an encrypted HttpOnly cookie for the session-only option. Never returned to the browser — only a masked preview.
- Rate limits on license verification (8/min/IP), admin login (6/min/IP), generation and uploads.
- Upload validation: extension allow-list, MIME sanity check, size cap, path traversal guard.
- Deliberately generic error copy for unauthenticated requests so keys cannot be enumerated.
- YouTube: public metadata and public caption tracks only. No protected media downloading or restriction bypass.

---

## Notes & limits

- **AI credentials are required.** Without a working provider key, generation stops with a clear error. This is intentional — there is no fake mode.
- **Transcription needs ffmpeg.** Without ffmpeg, uploads rely on a pasted transcript. NVIDIA NIM and OpenRouter are text-only providers, so uploads also need a transcript there (or OpenAI/Groq/Gemini for audio).
- **YouTube captions** can be unavailable (no captions, age/login restriction, or server-side YouTube blocking). The UI then asks for a transcript.
- **Storage is local** (`./storage`) and the database is a local SQLite file. Deploy on a host with a persistent disk. Swapping to Postgres/S3 means replacing `src/lib/db.ts` and `src/lib/storage.ts`.
- Billing is not integrated: licenses are issued by the operator through `/admin`, as described on the landing page.
- Generated scripts are drafts. Review before publishing and respect the platforms you publish to.
