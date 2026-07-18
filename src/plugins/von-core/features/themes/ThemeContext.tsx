import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeDefinition, THEMES, THEME_DEFAULT } from './themeRegistry';
import { ThemeEngine } from './ThemeEngine';

interface ThemeContextType {
  activeTheme: ThemeDefinition;
  setTheme: (themeId: string) => void;
  availableThemes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode; initialThemeId?: string }> = ({
  children,
  initialThemeId,
}) => {
  // INSTANT LOAD: Use passed ID or read localStorage synchronously
  const getInitialTheme = (): ThemeDefinition => {
    // 1. Prefer server settings passed from App (fastest)
    if (initialThemeId && THEMES[initialThemeId]) {
      return THEMES[initialThemeId];
    }

    // 2. Fallback to localStorage (offline/cache)
    if (typeof window !== 'undefined') {
      const savedThemeId = localStorage.getItem('von_active_theme_id');
      if (savedThemeId && THEMES[savedThemeId]) {
        return THEMES[savedThemeId];
      }
    }

    // 3. Default
    return THEME_DEFAULT;
  };

  const [activeTheme, setActiveTheme] = useState<ThemeDefinition>(getInitialTheme);

  // Keep ThemeProvider aligned with settings hydration after install/first load.
  useEffect(() => {
    if (initialThemeId && THEMES[initialThemeId] && activeTheme.id !== initialThemeId) {
      setActiveTheme(THEMES[initialThemeId]);
    }
  }, [initialThemeId, activeTheme.id]);

  // Apply theme whenever it changes
  useEffect(() => {
    ThemeEngine.applyTheme(activeTheme);
    localStorage.setItem('von_active_theme_id', activeTheme.id);
  }, [activeTheme]);

  const setTheme = (themeId: string) => {
    if (THEMES[themeId]) {
      setActiveTheme(THEMES[themeId]);
    } else {
      console.warn(`Theme ${themeId} not found.`);
    }
  };

  const availableThemes = Object.values(THEMES);

  return (
    <ThemeContext.Provider value={{ activeTheme, setTheme, availableThemes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
