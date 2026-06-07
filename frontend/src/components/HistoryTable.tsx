import type { JobState } from '../api';
import { formatBytes, formatDate } from '../util/format';
import { statusColor, statusLabel } from '../util/status';
import { languageColor } from '../util/status';

export default function HistoryTable({
  jobs,
  onOpen,
}: {
  jobs: JobState[];
  onOpen: (job: JobState) => void;
}) {
  if (jobs.length === 0) {
    return (
      <div className="history-empty">
        <p>No conversions yet.</p>
        <p className="muted">Start one from “New Conversion”.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <h2 className="view-title">History</h2>
      <table className="history-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Uploaded</th>
            <th>Size</th>
            <th>Pages</th>
            <th>Languages</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="row" onClick={() => onOpen(job)} tabIndex={0}>
              <td className="cell-file" title={job.fileName}>
                {job.fileName}
              </td>
              <td className="cell-muted">{formatDate(job.createdAt)}</td>
              <td className="cell-muted">{formatBytes(job.sizeBytes)}</td>
              <td className="cell-muted">
                {job.pageRange ? `${job.pageRange} of ${job.pages ?? '?'}` : (job.pages ?? '—')}
              </td>
              <td>
                <div className="cell-langs">
                  {job.languages.map((l) => {
                    const c = languageColor(l);
                    return (
                      <span
                        key={l}
                        className="lang-badge sm"
                        style={{ color: c, borderColor: c, background: `${c}22` }}
                      >
                        {l}
                      </span>
                    );
                  })}
                </div>
              </td>
              <td>
                <span
                  className="status-pill"
                  style={{
                    color: statusColor(job.status),
                    borderColor: statusColor(job.status),
                    background: `${statusColor(job.status)}1f`,
                  }}
                >
                  <span className="pill-dot" style={{ background: statusColor(job.status) }} />
                  {statusLabel(job.status)}
                  {job.status !== 'done' && job.status !== 'error' ? ` ${job.progress}%` : ''}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
