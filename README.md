# PDF → Audio (multi-language text-to-speech)

Upload a PDF and get back an MP3 of it read aloud. Supports **English, Telugu,
Tamil, Hindi**, and **mixed-language** documents — one consistent multilingual
**Gemini-TTS** voice narrates the whole document, with a per-upload style prompt.

- **Frontend:** React + Vite + TypeScript (`frontend/`)
- **Backend:** Node + Express + TypeScript (`backend/`)
- **TTS:** Google Cloud **Gemini-TTS** (prompt-steerable voices, via REST)
- **PDF text:** `pdf-parse` (text-based PDFs only — no OCR)
- **Audio stitching:** ffmpeg (bundled via `ffmpeg-static`)

## How it works
1. Upload PDF (+ optional narration-style prompt, + optional **page selection**:
   blank = all, or `2`, `1-5`, `1,3,5-7`) → backend extracts text **per page**.
2. Each page's text is split into chunks under Gemini-TTS's 4000-byte limit;
   each chunk's language is detected by Unicode script (Telugu / Tamil /
   Devanagari / Latin) to set the right `languageCode`.
3. Chunks are synthesized **in parallel** (pool of `TTS_CONCURRENCY`, default 5,
   with retry/backoff) via the Gemini-TTS REST API using a single multilingual
   voice (default `Vindemiatrix`) + your style prompt — so the narrator stays
   consistent across languages. Earlier pages finish first.
4. As **each page** completes, its chunks are stitched into a per-page MP3 and
   marked ready; a final full MP3 is concatenated at the end for download.
5. The frontend streams: it **starts playing page 1 the moment it's ready** and
   auto-advances through pages as they finish — you listen while the rest converts.

### Testing without Google (no billing / Vertex AI needed)
Set `TTS_FAKE=1` in `backend/.env` to emit short silent clips instead of calling
Google. The whole flow (per-page streaming, progress, download) works so you can
try the UI before your cloud project is set up.

## Prerequisites
- Node 18+ (tested on v23).
- A Google Cloud service-account key with the **Text-to-Speech** and **Vertex AI**
  APIs enabled (see below).

### Google Cloud setup (one time)
1. Create/select a project at https://console.cloud.google.com and enable billing.
2. Enable **both** APIs:
   - **Cloud Text-to-Speech API** (`texttospeech.googleapis.com`)
   - **Vertex AI API** (`aiplatform.googleapis.com`) — required because the
     Gemini-TTS models (`gemini-3.1-flash-tts-preview`, etc.) are served through
     Vertex AI. Without it you'll get a `403 … aiplatform.googleapis.com … is disabled`.
3. Create a service account → create a JSON key → download it.
4. Note the absolute path to that JSON file for the next step.

> The voice/model/style are configurable via `TTS_MODEL`, `TTS_VOICE`,
> `TTS_PROMPT`, `TTS_SPEAKING_RATE`, `TTS_PITCH` in `.env`. Users can also set the
> narration style per upload in the UI.

## Setup & run
```bash
# Backend
cd backend
npm install
cp .env.example .env
#   edit .env: set GOOGLE_APPLICATION_CREDENTIALS to your key's absolute path
npm run dev          # http://localhost:4000

# Frontend (in a second terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173
```
Open http://localhost:5173 and upload a PDF.

## Configuration (`backend/.env`)
| Variable | Meaning |
| --- | --- |
| `PORT` | API port (default 4000) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Absolute path to the GCP key JSON |
| `MAX_UPLOAD_MB` | Max PDF upload size (default 20) |
| `MAX_CHARS` | Cost guard: max characters per job, 0 = unlimited |
| `JWT_SECRET` | Secret used to sign login tokens (set a long random string) |

## Features
- **Accounts**: email + password sign-up / login (passwords bcrypt-hashed, JWT
  tokens). Each user only sees and downloads **their own** conversions.
- **Sidebar** listing your files with metadata: name, upload date/time, size
  (auto KB/MB/GB), page count, detected languages, and status.
- **Detected languages** shown as badges (e.g. "English", "Telugu").
- **History**: every conversion is saved (`backend/storage/jobs.json` + the MP3
  on disk), so you can re-play and **download any past file multiple times**.
  History survives a server restart.

## API endpoints
| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | – | Create account → `{ token, user }` |
| `POST` | `/api/auth/login` | – | Log in → `{ token, user }` |
| `GET` | `/api/auth/me` | ✓ | Current user |
| `POST` | `/api/jobs` | ✓ | Upload a PDF; returns `{ jobId }` |
| `GET` | `/api/jobs` | ✓ | Your history (newest first) |
| `GET` | `/api/jobs/:id` | ✓ | Status, progress, languages, size, pages, per-page segments |
| `GET` | `/api/jobs/:id/segments/:i/audio` | ✓* | One page's MP3 (progressive playback) |
| `GET` | `/api/jobs/:id/audio` | ✓* | Stream / download the full MP3 |

Authenticated requests send `Authorization: Bearer <token>`. *The audio route
also accepts `?token=` so `<audio>` tags and download links (which can't set
headers) still authorize.

## Notes
- Image-only / scanned PDFs report a friendly "no extractable text" error
  (OCR is out of scope; could be added with Tesseract later).
- Jobs are persisted to `backend/storage/jobs.json` and audio to
  `backend/storage/*.mp3` — fine for a single-instance prototype. Use a database
  + object storage to scale or share across instances.
- For higher-quality voices, swap the Standard voice names in
  `backend/src/services/tts.ts` for Wavenet/Neural2 equivalents.
