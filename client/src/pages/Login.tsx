import { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import './Login.css';

const USERS = [
  { id: 1, nickname: 'Он', defaultAvatar: 'О' },
  { id: 2, nickname: 'Она', defaultAvatar: 'О' }
];

export default function Login() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedUser) {
      setError('Выберите пользователя');
      return;
    }

    if (!password) {
      setError('Введите пароль');
      return;
    }

    setLoading(true);
    try {
      await login(password, selectedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Наш приватный чат</h1>
        
        <form onSubmit={handleSubmit}>
          <div className="user-selection">
            <p className="label">Выберите аккаунт</p>
            <div className="user-avatars">
              {USERS.map(user => (
                <button
                  key={user.id}
                  type="button"
                  className={`user-avatar ${selectedUser === user.id ? 'selected' : ''}`}
                  onClick={() => setSelectedUser(user.id)}
                >
                  <span className="avatar-initials">{user.defaultAvatar}</span>
                  <span className="avatar-name">{user.nickname}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <button 
            type="submit" 
            className="btn btn-primary login-btn"
            disabled={loading}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
