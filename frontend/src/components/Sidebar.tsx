export type View = 'upload' | 'history' | 'detail';

interface Props {
  email: string;
  view: View;
  converting: boolean;
  onNavigate: (view: View) => void;
  onLogout: () => void;
}

export default function Sidebar({ email, view, converting, onNavigate, onLogout }: Props) {
  return (
    <aside className="sidebar">
      <div className="sb-brand">PDF → Audio</div>

      <nav className="sb-nav">
        <button
          className={`nav-link${view === 'upload' ? ' active' : ''}`}
          onClick={() => onNavigate('upload')}
        >
          <span className="nav-icon">＋</span> New Conversion
        </button>
        <button
          className={`nav-link${view === 'history' || view === 'detail' ? ' active' : ''}`}
          onClick={() => onNavigate('history')}
        >
          <span className="nav-icon">≣</span> History
        </button>
      </nav>

      {converting && (
        <div className="sb-converting">
          <span className="sb-spinner" /> Converting…
        </div>
      )}

      <div className="sb-user">
        <span className="sb-email" title={email}>
          {email}
        </span>
        <button className="btn small" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
