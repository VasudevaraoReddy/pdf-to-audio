import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

export type JobStatus =
  | 'queued'
  | 'extracting'
  | 'synthesizing'
  | 'concatenating'
  | 'done'
  | 'error';

export type SegmentStatus = 'pending' | 'ready' | 'error';

export interface Segment {
  page: number; // 1-based PDF page number this audio corresponds to
  status: SegmentStatus;
}

export interface Job {
  id: string;
  ownerId: string;
  status: JobStatus;
  progress: number; // 0..100
  fileName: string;
  sizeBytes: number;
  pages?: number;
  stylePrompt?: string; // Gemini-TTS narration style instruction
  pageRange?: string; // selected pages, e.g. "2-5"; undefined = whole document
  languages: string[]; // human-readable, e.g. ["English", "Telugu"]
  segments: Segment[]; // one per spoken page, for progressive playback
  segmentPaths: string[]; // internal: path to each page's MP3 (index-aligned)
  audioPath?: string; // the final full MP3 (set when all pages are done)
  error?: string;
  createdAt: number;
}

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');
const DB_FILE = path.join(STORAGE_DIR, 'jobs.json');

const jobs = new Map<string, Job>();

function persist(): void {
  try {
    mkdirSync(STORAGE_DIR, { recursive: true });
    writeFileSync(DB_FILE, JSON.stringify([...jobs.values()], null, 2));
  } catch (err) {
    console.error('[store] failed to persist jobs:', err);
  }
}

function load(): void {
  if (!existsSync(DB_FILE)) return;
  try {
    const raw = JSON.parse(readFileSync(DB_FILE, 'utf8')) as Job[];
    for (const job of raw) {
      // Jobs that were mid-flight when the server stopped can't resume.
      if (job.status !== 'done' && job.status !== 'error') {
        job.status = 'error';
        job.error = 'Interrupted by a server restart.';
      }
      job.languages = job.languages ?? [];
      job.sizeBytes = job.sizeBytes ?? 0;
      job.segments = job.segments ?? [];
      job.segmentPaths = job.segmentPaths ?? [];
      jobs.set(job.id, job);
    }
  } catch (err) {
    console.error('[store] failed to load jobs:', err);
  }
}

load();

export function createJob(fileName: string, ownerId: string, sizeBytes: number): Job {
  const job: Job = {
    id: randomUUID(),
    ownerId,
    status: 'queued',
    progress: 0,
    fileName,
    sizeBytes,
    languages: [],
    segments: [],
    segmentPaths: [],
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  persist();
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Job>): void {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
  persist();
}

/** A user's jobs, newest first — used to render their history list. */
export function listJobs(ownerId: string): Job[] {
  return [...jobs.values()]
    .filter((j) => j.ownerId === ownerId)
    .sort((a, b) => b.createdAt - a.createdAt);
}
