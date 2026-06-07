import { spawn } from 'child_process';
import { GoogleAuth } from 'google-auth-library';
import ffmpegPath from 'ffmpeg-static';
import type { Chunk } from './segment';

/**
 * Gemini-TTS synthesis via the Cloud Text-to-Speech REST API.
 *
 * We call REST directly (rather than the typed @google-cloud/text-to-speech
 * client) because the installed SDK doesn't yet expose the Gemini-TTS fields
 * `voice.modelName` and `input.prompt`. Auth reuses the same service-account
 * credentials (GOOGLE_APPLICATION_CREDENTIALS) via google-auth-library.
 */

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

const MODEL = process.env.TTS_MODEL || 'gemini-3.1-flash-tts-preview';
const VOICE = process.env.TTS_VOICE || 'Vindemiatrix';
const SPEAKING_RATE = Number(process.env.TTS_SPEAKING_RATE || 1);
const PITCH = Number(process.env.TTS_PITCH || 0);

export const DEFAULT_PROMPT =
  process.env.TTS_PROMPT ||
  'Read this aloud clearly at a natural, calm pace, like narrating a book to a listener.';

const auth = new GoogleAuth({
  scopes: 'https://www.googleapis.com/auth/cloud-platform',
});

async function getToken(): Promise<string> {
  const token = await auth.getAccessToken();
  if (!token) throw new Error('Could not obtain a Google access token (check GOOGLE_APPLICATION_CREDENTIALS).');
  return token;
}

/**
 * Synthesize one chunk to an MP3 buffer using a single multilingual Gemini
 * voice. The per-chunk languageCode (from segmentation) still drives correct
 * pronunciation, while the same voice + style prompt keep one consistent
 * narrator across languages.
 */
// ---- Fake mode (TTS_FAKE=1): return short silent MP3s, no Google calls. ----
// Lets you exercise the full pipeline / streaming UI without billing or the
// Vertex AI API enabled.
let fakeClip: Buffer | null = null;
async function fakeAudio(): Promise<Buffer> {
  await new Promise((r) => setTimeout(r, 400)); // simulate model latency
  if (fakeClip) return fakeClip;
  fakeClip = await new Promise<Buffer>((resolve, reject) => {
    const args = [
      '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
      '-t', '0.8', '-c:a', 'libmp3lame', '-b:a', '64k', '-f', 'mp3', 'pipe:1',
    ];
    const proc = spawn(ffmpegPath as string, args);
    const out: Buffer[] = [];
    proc.stdout.on('data', (d) => out.push(d));
    proc.on('error', reject);
    proc.on('close', (code) =>
      code === 0 ? resolve(Buffer.concat(out)) : reject(new Error('fake ffmpeg failed'))
    );
  });
  return fakeClip;
}

export async function synthesize(chunk: Chunk, prompt: string): Promise<Buffer> {
  if (process.env.TTS_FAKE === '1') return fakeAudio();

  const body = {
    input: { text: chunk.text, prompt: prompt || DEFAULT_PROMPT },
    voice: {
      languageCode: chunk.languageCode,
      name: VOICE,
      modelName: MODEL,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: SPEAKING_RATE,
      pitch: PITCH,
    },
  };

  const payload = JSON.stringify(body);
  const MAX_TRIES = 3;
  let lastErr = '';

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const token = await getToken();
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: payload,
    });

    if (res.ok) {
      const data = (await res.json()) as { audioContent?: string };
      if (!data.audioContent) throw new Error('Gemini-TTS returned no audio content.');
      return Buffer.from(data.audioContent, 'base64');
    }

    const detail = await res.text().catch(() => '');
    lastErr = `Gemini-TTS request failed (${res.status}): ${detail.slice(0, 300)}`;

    // Retry only transient failures (rate limit / server errors).
    const transient = res.status === 429 || res.status >= 500;
    if (!transient || attempt === MAX_TRIES) {
      throw new Error(lastErr);
    }
    // Exponential backoff: ~0.5s, 1.5s, 3.5s.
    await new Promise((r) => setTimeout(r, 500 * (2 ** attempt - 1)));
  }

  throw new Error(lastErr || 'Gemini-TTS request failed.');
}
