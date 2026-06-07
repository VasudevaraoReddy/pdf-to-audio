import ProgressBar from './ProgressBar';
import StreamingPlayer from './StreamingPlayer';
import type { JobState } from '../api';

/**
 * Renders a single conversion: a progress bar while it's still converting, the
 * streaming player once at least one page is ready, and any error message.
 * Used by both the upload view (live job) and the detail view (selected job).
 */
export default function ConversionView({
  job,
  onReset,
}: {
  job: JobState;
  onReset: () => void;
}) {
  const busy = job.status !== 'done' && job.status !== 'error';
  const hasReady = !!job.segments?.some((s) => s.status === 'ready');

  return (
    <>
      {busy && (
        <ProgressBar
          status={job.status}
          progress={job.progress}
          fileName={job.fileName}
          languages={job.languages}
        />
      )}
      {hasReady && <StreamingPlayer job={job} onReset={onReset} />}
      {job.status === 'error' && (
        <p className="error">⚠️ {job.error || 'Conversion failed.'}</p>
      )}
    </>
  );
}
