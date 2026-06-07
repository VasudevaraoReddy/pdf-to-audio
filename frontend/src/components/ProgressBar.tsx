import type { JobStatus } from '../api';
import LanguageBadges from './LanguageBadges';
import { statusColor } from '../util/status';

const LABELS: Record<JobStatus, string> = {
  queued: 'Queued…',
  extracting: 'Extracting text from PDF…',
  synthesizing: 'Generating speech…',
  concatenating: 'Stitching audio…',
  done: 'Done',
  error: 'Error',
};

export default function ProgressBar({
  status,
  progress,
  fileName,
  languages,
}: {
  status: JobStatus;
  progress: number;
  fileName: string;
  languages: string[];
}) {
  return (
    <div className="progress">
      <div className="progress-head">
        <span className="file">{fileName}</span>
        <span className="pct">{progress}%</span>
      </div>
      <div className="bar">
        <div
          className="fill"
          style={{ width: `${progress}%`, background: statusColor(status) }}
        />
      </div>
      <p className="status-label" style={{ color: statusColor(status) }}>
        {LABELS[status]}
      </p>
      <LanguageBadges languages={languages} />
    </div>
  );
}
