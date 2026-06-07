import { useEffect, useRef, useState } from 'react';
import { audioUrl, segmentAudioUrl, type JobState } from '../api';
import LanguageBadges from './LanguageBadges';
import { formatBytes, formatDate } from '../util/format';

export default function StreamingPlayer({
  job,
  onReset,
}: {
  job: JobState;
  onReset: () => void;
}) {
  const segments = job.segments ?? [];
  const audioRef = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState<number>(() => {
    const fr = segments.findIndex((s) => s.status === 'ready');
    return fr >= 0 ? fr : 0;
  });

  const current = segments[index];
  const readyCount = segments.filter((s) => s.status === 'ready').length;
  const done = job.status === 'done';
  const downloadName = job.fileName.replace(/\.pdf$/i, '') + '.mp3';

  // Load & play the current page once it's ready. When auto-advance lands on a
  // not-yet-ready page, this re-runs as soon as the poll flips it to "ready".
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (current?.status === 'ready') {
      audio.src = segmentAudioUrl(job.id, index);
      audio.play().catch(() => {
        /* autoplay may be blocked; the controls let the user press play */
      });
    }
  }, [index, current?.status, job.id]);

  const onEnded = () => {
    if (index + 1 < segments.length) setIndex(index + 1);
  };

  const waitingForNext = current && current.status !== 'ready';

  return (
    <div className="player">
      <p className="player-title">🔊 {job.fileName}</p>

      <div className="meta-grid">
        <div>
          <span className="meta-k">Uploaded</span>
          <span className="meta-v">{formatDate(job.createdAt)}</span>
        </div>
        <div>
          <span className="meta-k">Size</span>
          <span className="meta-v">{formatBytes(job.sizeBytes)}</span>
        </div>
        <div>
          <span className="meta-k">Pages</span>
          <span className="meta-v">
            {job.pageRange ? `${job.pageRange} of ${job.pages ?? '?'}` : (job.pages ?? '—')}
          </span>
        </div>
      </div>

      <LanguageBadges languages={job.languages} />
      {job.stylePrompt && (
        <p className="style-line">
          <span className="meta-k">Style</span> {job.stylePrompt}
        </p>
      )}

      <div className="now-playing">
        {current ? (
          waitingForNext ? (
            <>Preparing page {current.page}…</>
          ) : (
            <>
              ▶ Playing page {current.page}{' '}
              <span className="np-count">
                · {readyCount}/{segments.length} pages ready
              </span>
            </>
          )
        ) : (
          <>Preparing audio…</>
        )}
      </div>

      <audio ref={audioRef} controls onEnded={onEnded} style={{ width: '100%' }} />

      <div className="page-strip">
        {segments.map((s, i) => (
          <button
            key={i}
            className={`page-chip ${s.status}${i === index ? ' active' : ''}`}
            disabled={s.status !== 'ready'}
            onClick={() => setIndex(i)}
            title={`Page ${s.page} — ${s.status}`}
          >
            {s.status === 'ready' ? '' : s.status === 'error' ? '⚠ ' : '… '}
            {s.page}
          </button>
        ))}
      </div>

      <div className="player-actions">
        <a
          className={`btn primary${done ? '' : ' disabled'}`}
          href={done ? audioUrl(job.id) : undefined}
          download={done ? downloadName : undefined}
          aria-disabled={!done}
          onClick={(e) => {
            if (!done) e.preventDefault();
          }}
          title={done ? 'Download the full MP3' : 'Available when all pages finish'}
        >
          {done ? 'Download full MP3' : 'Preparing full MP3…'}
        </a>
        <button className="btn" onClick={onReset}>
          Convert another
        </button>
      </div>
    </div>
  );
}
