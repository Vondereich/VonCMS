import { PluginDefinition, PluginLocation } from '../../../../../../types';

export const VonSEOPlugin: PluginDefinition = {
  id: 'vp_von_seo',
  name: 'VonSEO',
  description: 'Advanced SEO system for modern websites. Includes Schema.org, OpenGraph, and more.',
  version: '1.25',
  author: 'VonCMS Team',
  render: (_location: PluginLocation, _props?: any) => {
    // VonSEO is headless (logic handled in App/System), so it renders nothing in slots
    return null;
  },
};
