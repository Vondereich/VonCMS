import { SiteSettings } from '../types';

type PluginRuntimeSettings = Pick<SiteSettings, 'activePlugins' | 'pluginConfig'>;

export function isSystemPluginActive(
  settings: PluginRuntimeSettings | null | undefined,
  pluginId: string
): boolean {
  const activePlugins = Array.isArray(settings?.activePlugins) ? settings.activePlugins : [];
  if (!activePlugins.includes(pluginId)) return false;

  const pluginConfig =
    settings?.pluginConfig &&
    typeof settings.pluginConfig === 'object' &&
    !Array.isArray(settings.pluginConfig)
      ? settings.pluginConfig
      : {};
  const status = pluginConfig['pluginStatus']?.[pluginId];
  return status ? status === 'active' : true;
}
