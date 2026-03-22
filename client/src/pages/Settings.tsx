import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme, MALE_COLORS, FEMALE_COLORS } from '../context/ThemeContext.tsx';
import Navigation from '../components/Navigation.tsx';
import './Settings.css';

interface ThemeOption {
  id: string;
  name: string;
  primary: string;
  secondary: string;
}

const THEME_OPTIONS: Record<string, ThemeOption> = {
  cherry: { id: 'cherry', name: 'Вишнёвая', primary: '#B22234', secondary: '#800020' },
  kstyle: { id: 'kstyle', name: 'Корейская волна', primary: '#F7CAC9', secondary: '#DEB0B0' },
  pomegranate: { id: 'pomegranate', name: 'Гранатовая', primary: '#9B2C1D', secondary: '#C04000' },
  emerald: { id: 'emerald', name: 'Изумрудная', primary: '#2E8B57', secondary: '#50C878' },
  turquoise: { id: 'turquoise', name: 'Бирюзовая', primary: '#40E0D0', secondary: '#00CED1' },
  steelblue: { id: 'steelblue', name: 'Синяя сталь', primary: '#4682B4', secondary: '#2C3E50' },
  whitesilk: { id: 'whitesilk', name: 'Белое золото', primary: '#CFB53B', secondary: '#FFF8E7' },
  blackminimal: { id: 'blackminimal', name: 'Чёрный минимализм', primary: '#000000', secondary: '#333333' }
};

export default function Settings() {
  const { user, logout, refreshUser } = useAuth();
  const { themeMode, themeColor, setThemeMode, setThemeColor } = useTheme();
  
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [calendarNotifications, setCalendarNotifications] = useState(
    user?.calendarNotificationsEnabled ?? true
  );
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isMale = user?.id === 1;
  const availableColors = isMale ? MALE_COLORS : FEMALE_COLORS;

  const handleSaveNickname = async () => {
    if (!nickname.trim() || nickname === user?.nickname) return;
    
    setSaving(true);
    try {
      await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nickname: nickname.trim() })
      });
      await refreshUser();
    } catch (error) {
      console.error('Save nickname error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNotifications = async () => {
    const newValue = !calendarNotifications;
    setCalendarNotifications(newValue);
    
    try {
      await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ calendarNotificationsEnabled: newValue })
      });
    } catch (error) {
      console.error('Toggle notifications error:', error);
      setCalendarNotifications(!newValue);
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', 'image');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        // Save avatar URL to user
        await fetch('/api/user', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ avatarUrl: data.url })
        });
        await refreshUser();
      }
    } catch (error) {
      console.error('Upload avatar error:', error);
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ avatarUrl: null })
      });
      setAvatarPreview(null);
      await refreshUser();
    } catch (error) {
      console.error('Delete avatar error:', error);
    }
  };

  const handleLogout = async () => {
    if (confirm('Выйти из аккаунта?')) {
      await logout();
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>Настройки</h1>
      </header>

      <div className="settings-content">
        {/* Avatar Section */}
        <section className="settings-section">
          <h2>Аватар</h2>
          <div className="avatar-section">
            <div 
              className="avatar-preview"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarPreview || user?.avatarUrl ? (
                <img 
                  src={avatarPreview || user?.avatarUrl || ''} 
                  alt="Аватар" 
                />
              ) : (
                <span className="avatar-initials">
                  {user?.nickname?.charAt(0) || '?'}
                </span>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handleAvatarSelect}
            />
            <div className="avatar-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => avatarInputRef.current?.click()}
              >
                Изменить
              </button>
              {(user?.avatarUrl || avatarPreview) && (
                <button 
                  className="btn btn-secondary"
                  onClick={handleDeleteAvatar}
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Nickname Section */}
        <section className="settings-section">
          <h2>Имя</h2>
          <div className="nickname-section">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Ваше имя"
              maxLength={30}
            />
            <button 
              className="btn btn-primary"
              onClick={handleSaveNickname}
              disabled={saving || nickname === user?.nickname}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </section>

        {/* Theme Section */}
        <section className="settings-section">
          <h2>Оформление</h2>
          
          <div className="theme-option">
            <label>Режим</label>
            <div className="theme-modes">
              <button
                className={themeMode === 'light' ? 'active' : ''}
                onClick={() => setThemeMode('light')}
              >
                ☀ Светлый
              </button>
              <button
                className={themeMode === 'dark' ? 'active' : ''}
                onClick={() => setThemeMode('dark')}
              >
                🌙 Тёмный
              </button>
              <button
                className={themeMode === 'system' ? 'active' : ''}
                onClick={() => setThemeMode('system')}
              >
                ⚙ Системный
              </button>
            </div>
          </div>

          <div className="theme-option">
            <label>Цветовая схема</label>
            <div className="color-schemes">
              {availableColors.map(colorId => (
                <button
                  key={colorId}
                  className={`color-scheme ${themeColor === colorId ? 'active' : ''}`}
                  onClick={() => setThemeColor(colorId as any)}
                  style={{
                    background: `linear-gradient(135deg, ${THEME_OPTIONS[colorId].primary} 0%, ${THEME_OPTIONS[colorId].secondary} 100%)`
                  }}
                  title={THEME_OPTIONS[colorId].name}
                >
                  {themeColor === colorId && <span>✓</span>}
                </button>
              ))}
            </div>
            <p className="color-scheme-name">
              {THEME_OPTIONS[themeColor]?.name || 'По умолчанию'}
            </p>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="settings-section">
          <h2>Уведомления</h2>
          <div className="notification-option">
            <label>
              <input
                type="checkbox"
                checked={calendarNotifications}
                onChange={handleToggleNotifications}
              />
              Получать напоминания о событиях календаря
            </label>
          </div>
        </section>

        {/* Logout */}
        <section className="settings-section">
          <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
            Выйти из аккаунта
          </button>
        </section>
      </div>

      <Navigation />
    </div>
  );
}
