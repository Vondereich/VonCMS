import { Theme } from './types';

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    primary: '#0ea5e9', // Sky 500
    secondary: '#94a3b8', // Slate 400
    background: '#020617', // Slate 950
    surface: '#0f172a', // Slate 900
    text: '#f1f5f9', // Slate 100
    textSecondary: '#94a3b8', // Slate 400
    border: '#1e293b', // Slate 800
    error: '#ef4444', // Red 500
    success: '#22c55e', // Green 500
    warning: '#f59e0b', // Amber 500
    info: '#3b82f6', // Blue 500
  },
  borderRadius: '0.5rem',
  fontFamily: 'Inter, sans-serif',
};
