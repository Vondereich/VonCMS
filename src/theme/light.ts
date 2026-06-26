import { Theme } from './types';

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    primary: '#0ea5e9', // Sky 500
    secondary: '#64748b', // Slate 500
    background: '#f8fafc', // Slate 50
    surface: '#ffffff', // White
    text: '#0f172a', // Slate 900
    textSecondary: '#64748b', // Slate 500
    border: '#e2e8f0', // Slate 200
    error: '#ef4444', // Red 500
    success: '#22c55e', // Green 500
    warning: '#f59e0b', // Amber 500
    info: '#3b82f6', // Blue 500
  },
  borderRadius: '0.5rem',
  fontFamily: 'Inter, sans-serif',
};
