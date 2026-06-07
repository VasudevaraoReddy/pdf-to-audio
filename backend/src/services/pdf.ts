// pdf-parse ships without type declarations; require keeps it simple.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

const NO_TEXT_ERROR =
  'No extractable text found. This looks like a scanned/image-only PDF, which is not supported (OCR is out of scope).';

// Mirror of pdf-parse's default page renderer, so per-page text matches the
// library's normal extraction.
function renderPage(pageData: any): Promise<string> {
  return pageData
    .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
    .then((tc: any) => {
      let lastY: number | undefined;
      let text = '';
      for (const item of tc.items) {
        if (lastY === item.transform[5] || lastY === undefined) text += item.str;
        else text += '\n' + item.str;
        lastY = item.transform[5];
      }
      return text;
    });
}

/**
 * Parse a user page selection into a sorted list of 1-based page numbers.
 * Accepts a single page ("2"), a range ("2-5"), or a comma list ("1,3,5-7").
 * Empty/blank → all pages. Out-of-range numbers are dropped; reversed ranges
 * are normalized. Throws on clearly invalid tokens.
 */
export function parsePageSpec(spec: string, maxPage: number): number[] {
  const s = (spec || '').trim();
  if (!s) return Array.from({ length: maxPage }, (_, i) => i + 1);

  const set = new Set<number>();
  for (const raw of s.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const range = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      let a = parseInt(range[1], 10);
      let b = parseInt(range[2], 10);
      if (a > b) [a, b] = [b, a];
      for (let n = a; n <= b; n++) if (n >= 1 && n <= maxPage) set.add(n);
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n >= 1 && n <= maxPage) set.add(n);
    } else {
      throw new Error(`Invalid page selection "${part}". Use e.g. 2, 1-5, or 1,3,5.`);
    }
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Extract text per page (in page order). pdf-parse calls `pagerender` once per
 * page; we capture each page's text so the pipeline can produce per-page audio.
 * Throws the friendly error only if *every* page is empty (scanned PDF).
 */
export async function extractPages(buffer: Buffer): Promise<string[]> {
  const pages: string[] = [];
  await pdfParse(buffer, {
    pagerender: (pageData: any) =>
      renderPage(pageData).then((t) => {
        pages.push(t);
        return t;
      }),
  });
  if (pages.every((p) => !p.trim())) {
    throw new Error(NO_TEXT_ERROR);
  }
  return pages;
}
