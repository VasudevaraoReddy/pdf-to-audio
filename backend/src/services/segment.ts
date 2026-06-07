/**
 * Splits raw PDF text into chunks that are:
 *   (a) language-homogeneous (one dominant script per chunk), and
 *   (b) under Google Cloud TTS's 5000-byte-per-request limit.
 *
 * Language is detected by Unicode script range, which is reliable for the
 * scripts we care about (Telugu, Tamil, Devanagari) and defaults Latin to
 * English.
 */

export type Lang = 'te' | 'ta' | 'hi' | 'en';

export interface Chunk {
  text: string;
  lang: Lang;
  languageCode: string; // BCP-47, e.g. "te-IN"
}

// Google limit is 5000 bytes of UTF-8; stay well under to be safe.
const MAX_BYTES = 4000;

const LANG_CODE: Record<Lang, string> = {
  te: 'te-IN',
  ta: 'ta-IN',
  hi: 'hi-IN',
  en: 'en-IN',
};

export const LANG_NAME: Record<Lang, string> = {
  te: 'Telugu',
  ta: 'Tamil',
  hi: 'Hindi',
  en: 'English',
};

function scriptOf(ch: string): Lang | null {
  const c = ch.codePointAt(0);
  if (c === undefined) return null;
  if (c >= 0x0c00 && c <= 0x0c7f) return 'te'; // Telugu
  if (c >= 0x0b80 && c <= 0x0bff) return 'ta'; // Tamil
  if (c >= 0x0900 && c <= 0x097f) return 'hi'; // Devanagari (Hindi)
  if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) return 'en'; // Latin
  return null; // digits, punctuation, whitespace, symbols → no opinion
}

function byteLen(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

/** Pick the dominant language of a string by counting script-bearing chars. */
function dominantLang(s: string): Lang {
  const counts: Record<Lang, number> = { te: 0, ta: 0, hi: 0, en: 0 };
  for (const ch of s) {
    const l = scriptOf(ch);
    if (l) counts[l]++;
  }
  let best: Lang = 'en';
  let max = -1;
  (Object.keys(counts) as Lang[]).forEach((l) => {
    if (counts[l] > max) {
      max = counts[l];
      best = l;
    }
  });
  return best;
}

/**
 * Split text into runs of the same script. Neutral characters (spaces,
 * punctuation, digits) attach to the current run so words/sentences stay intact.
 */
function splitByScript(text: string): { text: string; lang: Lang }[] {
  const runs: { text: string; lang: Lang }[] = [];
  let current = '';
  let currentLang: Lang | null = null;

  for (const ch of text) {
    const l = scriptOf(ch);
    if (l === null) {
      current += ch; // neutral → keep with current run
      continue;
    }
    if (currentLang === null) {
      currentLang = l;
      current += ch;
    } else if (l === currentLang) {
      current += ch;
    } else {
      runs.push({ text: current, lang: currentLang });
      current = ch;
      currentLang = l;
    }
  }
  if (current.trim()) {
    runs.push({ text: current, lang: currentLang ?? dominantLang(current) });
  }
  return runs;
}

/** Greedily pack pieces of one language into <= MAX_BYTES chunks. */
function packByBytes(text: string, lang: Lang, out: Chunk[]): void {
  if (byteLen(text) <= MAX_BYTES) {
    if (text.trim()) out.push({ text, lang, languageCode: LANG_CODE[lang] });
    return;
  }
  // Split into sentence-ish pieces, then words, never exceeding the byte cap.
  const pieces = text.split(/(?<=[.!?।॥…\n])\s+/);
  let buf = '';
  const flush = () => {
    if (buf.trim()) out.push({ text: buf, lang, languageCode: LANG_CODE[lang] });
    buf = '';
  };
  for (const piece of pieces) {
    if (byteLen(piece) > MAX_BYTES) {
      flush();
      // Hard-split an over-long piece by words.
      let wbuf = '';
      for (const word of piece.split(/(\s+)/)) {
        if (byteLen(wbuf + word) > MAX_BYTES) {
          if (wbuf.trim()) out.push({ text: wbuf, lang, languageCode: LANG_CODE[lang] });
          wbuf = word;
        } else {
          wbuf += word;
        }
      }
      if (wbuf.trim()) out.push({ text: wbuf, lang, languageCode: LANG_CODE[lang] });
      continue;
    }
    if (byteLen(buf + piece) > MAX_BYTES) {
      flush();
      buf = piece;
    } else {
      buf += (buf ? ' ' : '') + piece;
    }
  }
  flush();
}

export function segment(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  const paragraphs = text.split(/\n\s*\n/); // blank-line separated paragraphs

  for (const para of paragraphs) {
    if (!para.trim()) continue;
    // Merge adjacent same-script runs so we don't over-fragment a paragraph.
    const runs = splitByScript(para);
    const merged: { text: string; lang: Lang }[] = [];
    for (const run of runs) {
      const last = merged[merged.length - 1];
      if (last && last.lang === run.lang) last.text += run.text;
      else merged.push({ ...run });
    }
    for (const run of merged) {
      packByBytes(run.text.trim(), run.lang, chunks);
    }
  }
  return chunks;
}

/** Total character count across all chunks (for the cost guard). */
export function charCount(chunks: Chunk[]): number {
  return chunks.reduce((n, c) => n + c.text.length, 0);
}

/** Human-readable list of distinct languages found, in a stable order. */
export function detectedLanguages(chunks: Chunk[]): string[] {
  const found = new Set<Lang>(chunks.map((c) => c.lang));
  const order: Lang[] = ['en', 'te', 'ta', 'hi'];
  return order.filter((l) => found.has(l)).map((l) => LANG_NAME[l]);
}
