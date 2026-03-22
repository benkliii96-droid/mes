import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.tsx';
import Login from './pages/Login.tsx';
import Chat from './pages/Chat.tsx';
import Calendar from './pages/Calendar.tsx';
import Settings from './pages/Settings.tsx';
import ScreenShare from './pages/ScreenShare.tsx';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Загрузка...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/chat" element={
        <ProtectedRoute>
          <Chat />
        </ProtectedRoute>
      } />
      <Route path="/calendar" element={
        <ProtectedRoute>
          <Calendar />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/screen-share" element={
        <ProtectedRoute>
          <ScreenShare />
        </ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
