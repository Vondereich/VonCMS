import { SiteSettings } from '../types';

type PluginRuntimeSettings = Pick<SiteSettings, 'activePlugins' | 'pluginConfig'>;

export function isSystemPluginActive(
  settings: PluginRuntimeSettings | null | undefined,
  pluginId: string
): boolean {
  if (!settings?.activePlugins?.includes(pluginId)) return false;

  const status = settings.pluginConfig?.['pluginStatus']?.[pluginId];
  return status ? status === 'active' : true;
}
