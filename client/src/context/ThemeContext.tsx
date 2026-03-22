import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

type ThemeMode = 'light' | 'dark' | 'system';
type ThemeColor = 
  | 'default' 
  | 'cherry' 
  | 'kstyle' 
  | 'pomegranate' 
  | 'emerald' 
  | 'turquoise' 
  | 'steelblue' 
  | 'whitesilk'
  | 'blackminimal';

interface ThemeContextType {
  themeMode: ThemeMode;
  themeColor: ThemeColor;
  effectiveTheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
  setThemeColor: (color: ThemeColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_COLORS: Record<ThemeColor, { primary: string; secondary: string }> = {
  default: { primary: '#B22234', secondary: '#800020' },
  cherry: { primary: '#B22234', secondary: '#800020' },
  kstyle: { primary: '#F7CAC9', secondary: '#DEB0B0' },
  pomegranate: { primary: '#9B2C1D', secondary: '#C04000' },
  emerald: { primary: '#2E8B57', secondary: '#50C878' },
  turquoise: { primary: '#40E0D0', secondary: '#00CED1' },
  steelblue: { primary: '#4682B4', secondary: '#2C3E50' },
  whitesilk: { primary: '#CFB53B', secondary: '#FFF8E7' },
  blackminimal: { primary: '#000000', secondary: '#333333' }
};

const MALE_COLORS: ThemeColor[] = ['emerald', 'turquoise', 'steelblue', 'whitesilk', 'blackminimal'];
const FEMALE_COLORS: ThemeColor[] = ['cherry', 'kstyle', 'pomegranate'];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [themeColor, setThemeColorState] = useState<ThemeColor>('default');

  // Get effective theme based on mode and system preference
  const getEffectiveTheme = (): 'light' | 'dark' => {
    if (themeMode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return themeMode as 'light' | 'dark';
  };

  const effectiveTheme = getEffectiveTheme();

  // Apply theme to CSS variables
  useEffect(() => {
    const colors = THEME_COLORS[themeColor];
    const root = document.documentElement;
    
    // Apply base theme
    root.setAttribute('data-theme', effectiveTheme);
    
    // Apply color scheme
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-secondary', colors.secondary);
    
    // Adjust colors for dark mode
    if (effectiveTheme === 'dark') {
      root.style.setProperty('--bg-primary', '#1a1a1a');
      root.style.setProperty('--bg-secondary', '#2d2d2d');
      root.style.setProperty('--bg-tertiary', '#3d3d3d');
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--text-secondary', '#b0b0b0');
      root.style.setProperty('--border-color', '#404040');
    } else {
      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f5f5f5');
      root.style.setProperty('--bg-tertiary', '#e8e8e8');
      root.style.setProperty('--text-primary', '#1a1a1a');
      root.style.setProperty('--text-secondary', '#666666');
      root.style.setProperty('--border-color', '#e0e0e0');
    }
  }, [effectiveTheme, themeColor]);

  // Load user preferences
  useEffect(() => {
    if (user) {
      setThemeModeState(user.themeMode as ThemeMode);
      // Default color based on user gender
      if (user.themeColor === 'default') {
        const defaultColor = user.id === 1 ? 'emerald' : 'cherry';
        setThemeColorState(defaultColor);
      } else {
        setThemeColorState(user.themeColor as ThemeColor);
      }
    }
  }, [user]);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    if (user) {
      await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ themeMode: mode })
      });
    }
  };

  const setThemeColor = async (color: ThemeColor) => {
    setThemeColorState(color);
    if (user) {
      await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ themeColor: color })
      });
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      themeMode, 
      themeColor, 
      effectiveTheme,
      setThemeMode, 
      setThemeColor 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export { MALE_COLORS, FEMALE_COLORS };
