import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar, { type View } from './Sidebar';
import Uploader from './Uploader';
import ConversionView from './ConversionView';
import DetailView from './DetailView';
import HistoryTable from './HistoryTable';
import { getJob, listJobs, uploadPdf, type JobState } from '../api';
import { useAuth } from '../auth/AuthContext';

const isBusy = (j: JobState | null) =>
  !!j && j.status !== 'done' && j.status !== 'error';

export default function Workspace() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>('upload');
  const [startNew, setStartNew] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<JobState | null>(null);
  const [detailJob, setDetailJob] = useState<JobState | null>(null);
  const [history, setHistory] = useState<JobState[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await listJobs());
    } catch {
      /* best-effort */
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  // Poll the active job until it finishes; keep detail in sync if it's the same.
  useEffect(() => {
    if (!activeId) return;
    let stopped = false;
    let timer: number;
    const tick = async () => {
      try {
        const s = await getJob(activeId);
        if (stopped) return;
        setActiveJob(s);
        setDetailJob((d) => (d && d.id === s.id ? s : d));
        if (s.status === 'done' || s.status === 'error') {
          void refreshHistory();
          return;
        }
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : 'Lost connection to server.');
        return;
      }
      if (!stopped) timer = window.setTimeout(tick, 1000);
    };
    timer = window.setTimeout(tick, 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [activeId, refreshHistory]);

  const handleFile = async (file: File, prompt: string, pageRange: string) => {
    setError(null);
    try {
      const id = await uploadPdf(file, prompt, pageRange);
      setActiveJob({
        id,
        status: 'queued',
        progress: 0,
        fileName: file.name,
        sizeBytes: file.size,
        pageRange: pageRange || undefined,
        languages: [],
        createdAt: Date.now(),
      });
      setActiveId(id);
      setStartNew(false);
      setView('upload');
      void refreshHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    }
  };

  const goNew = () => {
    setError(null);
    setStartNew(true);
    setView('upload');
  };

  const goHistory = () => {
    setError(null);
    setView('history');
    void refreshHistory();
  };

  const openDetail = async (job: JobState) => {
    setError(null);
    setDetailJob(job);
    setView('detail');
    try {
      const fresh = await getJob(job.id);
      setDetailJob(fresh);
      if (isBusy(fresh)) setActiveId(fresh.id); // poll → detail updates live
    } catch {
      /* keep the row data we already have */
    }
  };

  return (
    <div className="layout">
      <Sidebar
        email={user?.email || ''}
        view={view}
        converting={isBusy(activeJob)}
        onNavigate={(v) => (v === 'upload' ? goNew() : goHistory())}
        onLogout={logout}
      />

      <main className="content">
        {view === 'upload' &&
          (startNew || !activeJob ? (
            <Uploader disabled={false} onFile={handleFile} />
          ) : (
            <ConversionView job={activeJob} onReset={goNew} />
          ))}

        {view === 'history' && <HistoryTable jobs={history} onOpen={openDetail} />}

        {view === 'detail' && detailJob && (
          <DetailView job={detailJob} onBack={goHistory} />
        )}

        {error && <p className="error">⚠️ {error}</p>}
      </main>
    </div>
  );
}
