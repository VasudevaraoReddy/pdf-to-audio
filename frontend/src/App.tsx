import { useAuth } from './auth/AuthContext';
import AuthPage from './components/AuthPage';
import Workspace from './components/Workspace';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="splash">Loading…</div>;
  }
  if (!user) {
    return <AuthPage />;
  }
  return <Workspace />;
}
