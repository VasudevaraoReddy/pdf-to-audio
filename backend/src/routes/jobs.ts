import { Router } from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import { createJob, getJob, listJobs, type Job } from '../jobs/store';
import { processJob } from '../jobs/processor';
import { requireAuth } from '../auth/middleware';

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 20);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    if (ok) cb(null, true);
    else cb(new Error('Only PDF files are accepted.'));
  },
});

export const jobsRouter = Router();

// Everything below requires a valid token.
jobsRouter.use(requireAuth);

// Shape a job for the client (omit internal fields like audioPath/ownerId).
function publicJob(job: Job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    fileName: job.fileName,
    sizeBytes: job.sizeBytes,
    pages: job.pages,
    pageRange: job.pageRange,
    stylePrompt: job.stylePrompt,
    languages: job.languages,
    segments: job.segments,
    totalSegments: job.segments.length,
    createdAt: job.createdAt,
    error: job.error,
  };
}

// POST /api/jobs — upload a PDF, start processing, return the job id.
jobsRouter.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded (field "file").' });
  }
  const job = createJob(req.file.originalname, req.userId!, req.file.size);
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : undefined;
  const pageRange = typeof req.body?.pageRange === 'string' ? req.body.pageRange : undefined;
  void processJob(job.id, req.file.buffer, prompt, pageRange);
  res.status(202).json({ jobId: job.id });
});

// GET /api/jobs — the current user's history, newest first.
jobsRouter.get('/', (req, res) => {
  res.json(listJobs(req.userId!).map(publicJob));
});

// GET /api/jobs/:id — poll status/progress (owner only).
jobsRouter.get('/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (job.ownerId !== req.userId) return res.status(403).json({ error: 'Forbidden.' });
  res.json(publicJob(job));
});

// GET /api/jobs/:id/audio — stream/download the finished MP3 (owner only).
jobsRouter.get('/:id/audio', async (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (job.ownerId !== req.userId) return res.status(403).json({ error: 'Forbidden.' });
  if (job.status !== 'done' || !job.audioPath) {
    return res.status(409).json({ error: `Audio not ready (status: ${job.status}).` });
  }
  try {
    await fs.access(job.audioPath);
  } catch {
    return res.status(410).json({ error: 'Audio file is no longer available.' });
  }
  const safeName = job.fileName.replace(/\.pdf$/i, '').replace(/[^\w.\- ]+/g, '_');
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.mp3"`);
  res.sendFile(job.audioPath);
});

// GET /api/jobs/:id/segments/:index/audio — one page's MP3 (owner only), for
// progressive playback. Streamed inline so <audio> can play it as it loads.
jobsRouter.get('/:id/segments/:index/audio', async (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (job.ownerId !== req.userId) return res.status(403).json({ error: 'Forbidden.' });

  const index = Number(req.params.index);
  const segment = job.segments[index];
  const audioPath = job.segmentPaths[index];
  if (!segment || segment.status !== 'ready' || !audioPath) {
    return res.status(409).json({ error: 'This page is not ready yet.' });
  }
  try {
    await fs.access(audioPath);
  } catch {
    return res.status(410).json({ error: 'Audio file is no longer available.' });
  }
  res.setHeader('Content-Type', 'audio/mpeg');
  res.sendFile(audioPath);
});
