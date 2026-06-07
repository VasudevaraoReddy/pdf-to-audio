import ConversionView from './ConversionView';
import type { JobState } from '../api';

export default function DetailView({
  job,
  onBack,
}: {
  job: JobState;
  onBack: () => void;
}) {
  return (
    <div className="detail">
      <button className="back-bar" onClick={onBack}>
        ← Back to history
      </button>
      <ConversionView job={job} onReset={onBack} />
    </div>
  );
}
