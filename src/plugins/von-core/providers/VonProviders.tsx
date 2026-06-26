import React, { createContext, useContext } from 'react';
import { SiteSettings } from '../../../types';
import { ThemeProvider, useTheme as useNewTheme } from '../features/themes/ThemeContext';
import { isSystemPluginActive } from '../../../utils/pluginRuntime';

// Default Settings (Fallback) removed

// --- THEME CONTEXT (Re-export from new system) ---
export const useTheme = useNewTheme;

// --- PLUGIN CONTEXT ---
interface PluginContextType {
  activePlugins: string[];
  pluginConfig: Record<string, any>;
}

const PluginContext = createContext<PluginContextType>({
  activePlugins: [],
  pluginConfig: {},
});

export const usePlugin = () => useContext(PluginContext);

import { AnalyticsInjector } from '../../../components/AnalyticsInjector';

// --- MAIN PROVIDER ---
export const VonProviders: React.FC<{ settings: SiteSettings; children: React.ReactNode }> = ({
  settings,
  children,
}) => {
  const analyticsPluginActive = isSystemPluginActive(settings, 'vp_analytics');

  return (
    <ThemeProvider initialThemeId={settings.activeThemeId}>
      <PluginContext.Provider
        value={{
          activePlugins: settings.activePlugins || [],
          pluginConfig: settings.pluginConfig || {},
        }}
      >
        {analyticsPluginActive && <AnalyticsInjector analytics={settings.analytics} />}
        {children}
      </PluginContext.Provider>
    </ThemeProvider>
  );
};
