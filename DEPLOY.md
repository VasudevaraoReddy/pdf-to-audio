# Deploy for FREE (no billing, no credit card)

- **Frontend** → **Firebase Hosting** (free Spark plan, project `pdf-to-audio-5a246`)
- **Backend** → **Render** free web service (Docker; no card required)

The frontend calls the Render backend directly (different domains), so you set
the backend URL into the frontend build via `VITE_API_BASE`.

> Limitations of the free tier (all expected):
> - Render free service **sleeps after ~15 min idle** → first request cold-starts (~30–60s).
> - Backend storage is **ephemeral** → history/MP3s reset on redeploy or sleep.
> - **Google Gemini-TTS needs billing**, so the free deploy runs with `TTS_FAKE=1`
>   (produces *silent* clips so the app works end-to-end). For real audio: enable
>   billing for Google TTS, or switch to a free engine like edge-tts.

---

## 1. Backend → Render (free)
1. Push this repo to GitHub (already done: `VasudevaraoReddy/pdf-to-audio`).
2. Go to https://dashboard.render.com → **New → Blueprint** → connect the repo.
   Render reads [render.yaml](render.yaml) and creates the `pdf-to-audio-api`
   web service (Docker, free plan). Click **Apply**.
   - Or **New → Web Service** → pick the repo → Render auto-detects the Docker
     setup; set Root Directory to `backend`, plan **Free**.
3. Wait for the build/deploy. Copy the service URL, e.g.
   `https://pdf-to-audio-api.onrender.com`.
4. Sanity check: open `https://<your-render-url>/api/health` → should return
   `{"ok":true,...}`.

## 2. Frontend → Firebase Hosting (free)
```bash
# install CLI + log in (no billing needed for Hosting)
npm install -g firebase-tools
firebase login

# point the build at your Render backend, then build
cd frontend
echo "VITE_API_BASE=https://pdf-to-audio-api.onrender.com" > .env.production   # use YOUR render url
npm install
npm run build
cd ..

# deploy the static site (uses firebase.json + .firebaserc → pdf-to-audio-5a246)
firebase deploy --only hosting
```
Your app goes live at **https://pdf-to-audio-5a246.web.app**.

## 3. Verify
- Open the Hosting URL, register, upload a PDF, watch it stream page-by-page.
- With `TTS_FAKE=1` the audio plays but is **silent** — that confirms the full
  pipeline works for free. Swap in real TTS when you're ready.

---

## Redeploying
- Backend: push to GitHub → Render auto-redeploys (or click Manual Deploy).
- Frontend: `npm run build` then `firebase deploy --only hosting`.

## Getting real audio later (still possible, your choice)
- **Cheapest quality:** enable billing on a Google project and use Gemini-TTS —
  the standard free tier covers ~1M chars/month (billing required even within it).
- **Stay 100% free:** switch the backend TTS to a free engine (Microsoft
  **edge-tts** has good Telugu/Tamil/Hindi/English neural voices, no key/card).
  Ask and I'll wire it in — it only changes `backend/src/services/tts.ts`.
