import { PluginDefinition, PluginLocation } from '../../../../../../types';

export const VonAnalyticsPlugin: PluginDefinition = {
  id: 'vp_analytics',
  name: 'VonAnalytics',
  description: 'Privacy-focused visitor tracking dashboard.',
  version: '1.25',
  author: 'VonCMS Team',
  render: (_location: PluginLocation, _props?: any) => {
    // Analytics runs via scripts (headless), so it renders nothing in slots
    return null;
  },
};
