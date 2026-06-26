import { ThemeConfig } from '../../../../types';

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  config: ThemeConfig; // Re-use existing type for compatibility
  extendedConfig: {
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      success: string;
      bgBody: string;
      bgCard: string;
      bgNav: string;
      textNav: string;
      textPrimary: string;
      textSecondary: string;
      border: string;
    };
    darkColors: {
      bgBody: string;
      bgCard: string;
      bgNav: string;
      textNav: string;
      textPrimary: string;
      textSecondary: string;
      border: string;
    };
    layout: {
      borderRadius: string;
      fontFamily: string;
      navBlur: boolean;
      cardShadow: string;
    };
  };
}

// --- THEME: DEFAULT ---
export const THEME_DEFAULT: ThemeDefinition = {
  id: 'theme-default',
  name: 'VonCMS Default',
  description: 'The standard clean and modern theme.',
  version: '1.25',
  author: 'VonCMS Team',
  config: {
    name: 'VonCMS Default',
    primaryColor: '#0ea5ff',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '0.5rem',
    customCss: '',
  },
  extendedConfig: {
    colors: {
      primary: '#0ea5ff',
      secondary: '#64748b',
      accent: '#0ea5ff',
      success: '#10b981',
      bgBody: '#e2e8f0',
      bgCard: '#ffffff',
      bgNav: '#0f172a',
      textNav: '#ffffff',
      textPrimary: '#334155',
      textSecondary: '#64748b',
      border: '#cbd5e1',
    },
    darkColors: {
      bgBody: '#000000',
      bgCard: '#020617',
      bgNav: '#020617',
      textNav: '#ffffff',
      textPrimary: '#e2e8f0',
      textSecondary: '#94a3b8',
      border: '#1e293b',
    },
    layout: {
      borderRadius: '0.5rem',
      fontFamily: 'Inter, sans-serif',
      navBlur: false,
      cardShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    },
  },
};

// --- THEME: VON PRISM ---
export const THEME_PRISM: ThemeDefinition = {
  id: 'theme-prism',
  name: 'Von Prism',
  description: 'Futuristic, vibrant, techy, colorful accents.',
  version: '1.25',
  author: 'VonCMS Team',
  config: {
    name: 'Von Prism',
    primaryColor: '#4F97FF',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '1rem',
    customCss: '',
  },
  extendedConfig: {
    colors: {
      primary: '#4F97FF',
      secondary: '#FF6EC7',
      accent: 'linear-gradient(90deg, #FF6EC7, #4F97FF, #FFDD57)',
      success: '#10b981',
      bgBody: '#101021',
      bgCard: '#1B1B2F',
      bgNav: 'rgba(16, 16, 33, 0.8)',
      textNav: '#F0F0F0',
      textPrimary: '#F0F0F0',
      textSecondary: '#A0A0B0',
      border: 'rgba(79, 151, 255, 0.3)',
    },
    darkColors: {
      bgBody: '#101021',
      bgCard: '#1B1B2F',
      bgNav: 'rgba(16, 16, 33, 0.8)',
      textNav: '#F0F0F0',
      textPrimary: '#F0F0F0',
      textSecondary: '#A0A0B0',
      border: 'rgba(79, 151, 255, 0.3)',
    },
    layout: {
      borderRadius: '1rem',
      fontFamily: 'Inter, sans-serif',
      navBlur: true,
      cardShadow: '0 0 20px rgba(79, 151, 255, 0.15)',
    },
  },
};

export const THEME_TECHPRESS: ThemeDefinition = {
  id: 'theme-techpress',
  name: 'Von TechPress',
  description: 'Professional tech news portal with breaking news ticker.',
  version: '1.25',
  author: 'VonCMS Team',
  config: {
    name: 'Von TechPress',
    primaryColor: '#0066cc',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '0.25rem',
    customCss: '',
  },
  extendedConfig: {
    colors: {
      primary: '#0066cc',
      secondary: '#2d3748',
      accent: '#d97706',
      success: '#059669',
      bgBody: '#ffffff',
      bgCard: '#f8f9fa',
      bgNav: '#ffffff',
      textNav: '#1a202c',
      textPrimary: '#1a202c',
      textSecondary: '#718096',
      border: '#e2e8f0',
    },
    darkColors: {
      bgBody: '#0f1419',
      bgCard: '#1a1f2e',
      bgNav: '#0f1419',
      textNav: '#e4e7eb',
      textPrimary: '#e4e7eb',
      textSecondary: '#9ca3af',
      border: '#2d3748',
    },
    layout: {
      borderRadius: '0.25rem',
      fontFamily: 'Inter, sans-serif',
      navBlur: true,
      cardShadow: 'none',
    },
  },
};

// --- THEME: PORTFOLIO ---
export const THEME_PORTFOLIO: ThemeDefinition = {
  id: 'theme-portfolio',
  name: 'Von Portfolio',
  description: 'Stunning single-page portfolio showcase for creatives.',
  version: '1.25',
  author: 'VonCMS Team',
  config: {
    name: 'Von Portfolio',
    primaryColor: '#8B5CF6',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '1rem',
    customCss: '',
  },
  extendedConfig: {
    colors: {
      primary: '#8B5CF6',
      secondary: '#EC4899',
      accent: '#8B5CF6',
      success: '#10b981',
      bgBody: '#fafafa',
      bgCard: '#ffffff',
      bgNav: '#fafafa',
      textNav: '#1a1a1a',
      textPrimary: '#1a1a1a',
      textSecondary: '#525252',
      border: 'rgba(0,0,0,0.08)',
    },
    darkColors: {
      bgBody: '#0f0f0f',
      bgCard: '#1a1a1a',
      bgNav: '#0f0f0f',
      textNav: '#ffffff',
      textPrimary: '#ffffff',
      textSecondary: '#a3a3a3',
      border: 'rgba(255,255,255,0.1)',
    },
    layout: {
      borderRadius: '1rem',
      fontFamily: 'Inter, sans-serif',
      navBlur: true,
      cardShadow: '0 20px 40px rgba(0,0,0,0.1)',
    },
  },
};

// --- THEME: DIGEST ---
export const THEME_DIGEST: ThemeDefinition = {
  id: 'theme-digest',
  name: 'Von Digest',
  description: 'Modern magazine theme with category filtering and hero section.',
  version: '1.25',
  author: 'VonCMS Team',
  config: {
    name: 'Von Digest',
    primaryColor: '#00D1D1',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '0.75rem',
    customCss: '',
  },
  extendedConfig: {
    colors: {
      primary: '#00D1D1',
      secondary: '#6366f1',
      accent: '#00D1D1',
      success: '#10b981',
      bgBody: '#f8fafc',
      bgCard: '#ffffff',
      bgNav: '#ffffff',
      textNav: '#1e293b',
      textPrimary: '#1e293b',
      textSecondary: '#64748b',
      border: '#e2e8f0',
    },
    darkColors: {
      bgBody: '#0f172a',
      bgCard: '#1e293b',
      bgNav: '#0f172a',
      textNav: '#f1f5f9',
      textPrimary: '#f1f5f9',
      textSecondary: '#94a3b8',
      border: '#334155',
    },
    layout: {
      borderRadius: '0.75rem',
      fontFamily: 'Inter, sans-serif',
      navBlur: true,
      cardShadow: '0 4px 20px rgba(0,0,0,0.08)',
    },
  },
};

// --- THEME: CORPORATE PRO ---
export const THEME_CORPORATE_PRO: ThemeDefinition = {
  id: 'theme-corporate-pro',
  name: 'Corporate Pro',
  description: 'Professional business theme with hero, services, and CTA sections.',
  version: '1.25',
  author: 'VonCMS Team',
  config: {
    name: 'Corporate Pro',
    primaryColor: '#2563eb',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '0.75rem',
    customCss: '',
  },
  extendedConfig: {
    colors: {
      primary: '#2563eb',
      secondary: '#475569',
      accent: '#2563eb',
      success: '#10b981',
      bgBody: '#f8fafc',
      bgCard: '#ffffff',
      bgNav: '#ffffff',
      textNav: '#0f172a',
      textPrimary: '#0f172a',
      textSecondary: '#64748b',
      border: '#e2e8f0',
    },
    darkColors: {
      bgBody: '#020617',
      bgCard: '#0f172a',
      bgNav: '#0f172a',
      textNav: '#f1f5f9',
      textPrimary: '#f1f5f9',
      textSecondary: '#94a3b8',
      border: '#1e293b',
    },
    layout: {
      borderRadius: '0.75rem',
      fontFamily: 'Inter, sans-serif',
      navBlur: true,
      cardShadow: '0 10px 40px rgba(0,0,0,0.1)',
    },
  },
};

export const THEMES: Record<string, ThemeDefinition> = {
  'theme-default': THEME_DEFAULT,
  'theme-prism': THEME_PRISM,
  'theme-techpress': THEME_TECHPRESS,
  'theme-portfolio': THEME_PORTFOLIO,
  'theme-digest': THEME_DIGEST,
  'theme-corporate-pro': THEME_CORPORATE_PRO,
};
