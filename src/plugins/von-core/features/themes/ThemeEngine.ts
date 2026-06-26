import { ThemeDefinition } from './themeRegistry';

export const ThemeEngine = {
  /**
   * Generates the CSS variables string for a given theme.
   */
  generateThemeVariables: (theme: ThemeDefinition): string => {
    const { colors, darkColors, layout } = theme.extendedConfig;

    return `
            :root {
                /* Light Mode Colors */
                --color-primary: ${colors.primary};
                --color-secondary: ${colors.secondary};
                --color-accent: ${colors.accent};
                --color-success: ${colors.success};
                
                --bg-body: ${colors.bgBody};
                --bg-card: ${colors.bgCard};
                --bg-nav: ${colors.bgNav};
                
                --text-nav: ${colors.textNav};
                --text-primary: ${colors.textPrimary};
                --text-secondary: ${colors.textSecondary};
                
                --border-color: ${colors.border};

                /* Layout */
                --border-radius: ${layout.borderRadius};
                --font-family: ${layout.fontFamily};
                --nav-blur: ${layout.navBlur ? '10px' : '0px'};
                --card-shadow: ${layout.cardShadow};
            }

            .dark {
                /* Dark Mode Colors Override */
                --bg-body: ${darkColors.bgBody};
                --bg-card: ${darkColors.bgCard};
                --bg-nav: ${darkColors.bgNav};
                
                --text-nav: ${darkColors.textNav};
                --text-primary: ${darkColors.textPrimary};
                --text-secondary: ${darkColors.textSecondary};
                
                --border-color: ${darkColors.border};
            }
        `;
  },

  /**
   * Injects the theme styles into the document head.
   * Removes previous theme styles if they exist.
   */
  applyTheme: (theme: ThemeDefinition) => {
    const styleId = 'von-theme-styles';
    let styleEl = document.getElementById(styleId);

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const cssVariables = ThemeEngine.generateThemeVariables(theme);

    // Add any custom CSS specific to the theme (e.g. specific class overrides)
    let customOverrides = '';
    if (theme.id === 'theme-prism') {
      customOverrides = `
                /* Prism Specific Overrides */
                .von-nav {
                    backdrop-filter: blur(var(--nav-blur));
                    border-bottom: 1px solid var(--border-color);
                }
                .von-card {
                    background: linear-gradient(145deg, var(--bg-card), rgba(255,255,255,0.5));
                    border: 1px solid var(--border-color);
                }
                .dark .von-card {
                    background: linear-gradient(145deg, var(--bg-card), rgba(0,0,0,0.2));
                }
                body {
                    background-image: radial-gradient(circle at 50% 0%, var(--color-primary) 0%, transparent 25%),
                                      radial-gradient(circle at 100% 0%, var(--color-secondary) 0%, transparent 25%);
                    background-attachment: fixed;
                }
            `;
    }

    styleEl.textContent = cssVariables + '\n' + customOverrides;

    // Update body font
    document.body.style.fontFamily = theme.extendedConfig.layout.fontFamily;
  },
};
