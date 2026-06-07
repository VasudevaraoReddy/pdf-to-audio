import path from 'path';
import { updateJob, getJob, type Segment } from './store';
import { extractPages, parsePageSpec } from '../services/pdf';
import { segment, charCount, detectedLanguages, type Chunk } from '../services/segment';
import { synthesize, DEFAULT_PROMPT } from '../services/tts';
import { concat, concatFiles } from '../services/audio';

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');
const MAX_CHARS = Number(process.env.MAX_CHARS || 0);
const CONCURRENCY = Math.max(1, Number(process.env.TTS_CONCURRENCY || 5));

interface PageWork {
  segIndex: number; // index into job.segments / segmentPaths
  page: number; // 1-based PDF page number
  chunks: Chunk[];
  buffers: (Buffer | undefined)[];
  remaining: number;
  failed: boolean;
}

/** Run `worker` over items with at most `concurrency` in flight; items start in order. */
async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

/**
 * Runs the full pipeline for a job in the background, producing one audio file
 * per page so playback can start before the whole PDF is done. Never throws —
 * failures are recorded on the job.
 */
export async function processJob(
  jobId: string,
  buffer: Buffer,
  prompt?: string,
  pageRange?: string
): Promise<void> {
  const stylePrompt = (prompt || '').trim() || DEFAULT_PROMPT;
  try {
    updateJob(jobId, { status: 'extracting', progress: 5, stylePrompt });
    const pages = await extractPages(buffer);
    const total = pages.length;

    // Resolve which pages to convert (default: all).
    const selected = parsePageSpec(pageRange || '', total);
    if (selected.length === 0) {
      throw new Error(`No valid pages selected for a ${total}-page document.`);
    }
    const isSubset = selected.length < total;
    updateJob(jobId, {
      pages: total,
      pageRange: isSubset ? (pageRange || '').trim() : undefined,
    });

    // Build one PageWork per selected, spoken (non-empty) page, in page order.
    const works: PageWork[] = [];
    const segments: Segment[] = [];
    const allChunks: Chunk[] = [];
    for (const page of selected) {
      const text = pages[page - 1];
      const chunks = segment(text);
      if (chunks.length === 0) continue; // skip blank/image-only pages
      const segIndex = segments.length;
      segments.push({ page, status: 'pending' });
      works.push({
        segIndex,
        page,
        chunks,
        buffers: new Array(chunks.length).fill(undefined),
        remaining: chunks.length,
        failed: false,
      });
      allChunks.push(...chunks);
    }

    if (segments.length === 0) {
      throw new Error(
        isSubset
          ? 'The selected page(s) contain no extractable text.'
          : 'No readable text after segmentation.'
      );
    }
    if (MAX_CHARS > 0 && charCount(allChunks) > MAX_CHARS) {
      throw new Error(
        `Document is too long (${charCount(allChunks)} chars > limit ${MAX_CHARS}). Increase MAX_CHARS to allow it.`
      );
    }

    updateJob(jobId, {
      status: 'synthesizing',
      progress: 10,
      languages: detectedLanguages(allChunks),
      segments,
      segmentPaths: new Array(segments.length).fill(''),
    });

    // Flatten to (page, chunkIndex) tasks, ordered by page so early pages finish first.
    const tasks: { pw: PageWork; ci: number }[] = [];
    for (const pw of works) for (let ci = 0; ci < pw.chunks.length; ci++) tasks.push({ pw, ci });

    const totalChunks = tasks.length;
    let doneChunks = 0;

    const finalizePage = async (pw: PageWork) => {
      const audioPath = await concat(pw.buffers.filter(Boolean) as Buffer[], STORAGE_DIR);
      const job = getJob(jobId);
      if (!job) return;
      job.segments[pw.segIndex].status = 'ready';
      job.segmentPaths[pw.segIndex] = audioPath;
      updateJob(jobId, { segments: job.segments, segmentPaths: job.segmentPaths });
    };

    await runPool(tasks, CONCURRENCY, async ({ pw, ci }) => {
      if (pw.failed) return; // a sibling chunk already failed this page
      try {
        pw.buffers[ci] = await synthesize(pw.chunks[ci], stylePrompt);
        doneChunks += 1;
        pw.remaining -= 1;
        updateJob(jobId, { progress: 10 + Math.round((doneChunks / totalChunks) * 85) });
        if (pw.remaining === 0) await finalizePage(pw);
      } catch {
        // Mark the page failed but keep the pool running for other pages.
        pw.failed = true;
        const job = getJob(jobId);
        if (job) {
          job.segments[pw.segIndex].status = 'error';
          updateJob(jobId, { segments: job.segments });
        }
      }
    });

    const job = getJob(jobId);
    const ready = job ? job.segments.filter((s) => s.status === 'ready') : [];
    if (job && ready.length === job.segments.length) {
      updateJob(jobId, { status: 'concatenating', progress: 97 });
      const audioPath = await concatFiles(job.segmentPaths.filter(Boolean), STORAGE_DIR);
      updateJob(jobId, { status: 'done', progress: 100, audioPath });
    } else {
      const failed = job ? job.segments.filter((s) => s.status === 'error').map((s) => s.page) : [];
      updateJob(jobId, {
        status: 'error',
        error: `Some pages failed to convert (page${failed.length > 1 ? 's' : ''} ${failed.join(', ')}). Ready pages are still playable.`,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    updateJob(jobId, { status: 'error', error: message });
  }
}
