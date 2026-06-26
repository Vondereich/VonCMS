import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { Theme, ThemeMode } from './types';
import { lightTheme } from './light';
import { darkTheme } from './dark';

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
  setPrimaryColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
  initialMode?: ThemeMode;
  customPrimaryColor?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialMode = 'light',
  customPrimaryColor,
}) => {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [customPrimary, setCustomPrimary] = useState<string | undefined>(customPrimaryColor);

  // Derive current theme from mode
  const baseTheme = mode === 'light' ? lightTheme : darkTheme;

  // Apply custom overrides
  const theme: Theme = useMemo(
    () => ({
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: customPrimary || baseTheme.colors.primary,
      },
    }),
    [baseTheme, customPrimary]
  );

  // Effect to update CSS variables for Tailwind/Global usage
  useEffect(() => {
    const root = document.documentElement;

    // Set CSS variables
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-bg', theme.colors.background);
    root.style.setProperty('--color-surface', theme.colors.surface);
    root.style.setProperty('--color-text', theme.colors.text);
    root.style.setProperty('--color-border', theme.colors.border);

    // Handle Tailwind 'dark' class
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme, mode]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setPrimaryColor = useCallback((color: string) => {
    setCustomPrimary(color);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleMode, setMode, setPrimaryColor }}>
      {children}
    </ThemeContext.Provider>
  );
};
