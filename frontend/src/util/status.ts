import type { JobStatus } from '../api';

/** Color for a job status — used by table pills, the sidebar dot, progress. */
export function statusColor(status: JobStatus): string {
  switch (status) {
    case 'done':
      return '#22c55e'; // green
    case 'error':
      return '#ef4444'; // red
    default:
      return '#eab308'; // amber (queued/extracting/synthesizing/concatenating)
  }
}

/** Short human label for a status. */
export function statusLabel(status: JobStatus): string {
  switch (status) {
    case 'done':
      return 'Done';
    case 'error':
      return 'Failed';
    case 'queued':
      return 'Queued';
    case 'extracting':
      return 'Extracting';
    case 'synthesizing':
      return 'Converting';
    case 'concatenating':
      return 'Finishing';
    default:
      return status;
  }
}

/** Distinct color per language for badges. */
export function languageColor(language: string): string {
  switch (language) {
    case 'Telugu':
      return '#f59e0b'; // amber
    case 'Tamil':
      return '#ec4899'; // pink
    case 'Hindi':
      return '#14b8a6'; // teal
    case 'English':
      return '#6366f1'; // indigo
    default:
      return '#94a3b8'; // slate
  }
}
