export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  info: string;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  borderRadius: string;
  fontFamily: string;
}

export type ThemeMode = 'light' | 'dark';
