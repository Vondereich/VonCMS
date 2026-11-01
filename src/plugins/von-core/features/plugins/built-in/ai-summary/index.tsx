import { PluginDefinition } from '../../../../../../types';
import { AISummaryComponent } from './AISummaryComponent';
import { AISummaryConfig } from './types';

export const AISummaryPlugin: PluginDefinition<AISummaryConfig> = {
  id: 'vp_ai_summary',
  name: 'AI Summary',
  version: '1.28',
  author: 'VonCMS Team',
  description: 'Auto-extract article summaries without API - Fast & Free!',

  render: (_location, config) => {
    if (_location !== 'post_after') return null;

    const summaryConfig: AISummaryConfig = config || {
      enabled: true,
      maxBullets: 5,
      extractMethod: 'hybrid',
      showLabel: true,
      labelText: 'AI Summary',
      position: 'top',
    };
    if (!summaryConfig.enabled) return null;

    // Get post content from global context if available
    // This will be injected by the theme when rendering
    const postContent = window.__current_post_content || '';

    if (!postContent) return null;

    return <AISummaryComponent config={summaryConfig} content={postContent} />;
  },
};
