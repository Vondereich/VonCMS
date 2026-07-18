import React from 'react';
import { PluginDefinition, PluginLocation, CustomPluginDefinition } from '../../../../types';
import { sanitizeHtml } from '../../../../utils/security';
import { isSystemPluginActive } from '../../../../utils/pluginRuntime';
import { normalizeSiteUrl } from '../../../../utils/siteUtils';

// Import individual plugins from their subfolders
import { PromoBarPlugin } from './built-in/promo-bar/index';
import { FloatingGiftPlugin } from './built-in/gift-widget/index';

/**
 * VP PLUGIN REGISTRY
 * This file acts as the "index.php" for plugins.
 * It registers all available system plugins.
 */
import { VonSEOPlugin } from './built-in/von-seo/index';
import { VonAnalyticsPlugin } from './built-in/von-analytics/index';
import { AISummaryPlugin } from './built-in/ai-summary/index';
import { RelatedPostsPlugin } from './built-in/related-posts/index';

/**
 * VP PLUGIN REGISTRY
 * This file acts as the "index.php" for plugins.
 * It registers all available system plugins.
 */

export const AVAILABLE_PLUGINS: PluginDefinition[] = [
  PromoBarPlugin,
  FloatingGiftPlugin,
  VonSEOPlugin,
  VonAnalyticsPlugin,
  AISummaryPlugin,
  RelatedPostsPlugin,
];

const sanitizeCustomPluginHtml = (htmlContent: string): string => {
  const sanitized = sanitizeHtml(htmlContent, {
    ADD_ATTR: ['style', 'class', 'id', 'target', 'width', 'height', 'href', 'alt'],
    ADD_TAGS: ['style', 'span', 'a', 'img', 'div'],
    ALLOW_DATA_ATTR: true,
    FORCE_BODY: true,
  });

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return sanitized;
  }

  const doc = new DOMParser().parseFromString(sanitized, 'text/html');
  doc.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    anchor.setAttribute('href', normalizeSiteUrl(href || ''));
  });

  return doc.body.innerHTML;
};

export const PluginSlot: React.FC<{
  location: PluginLocation;
  activePlugins: string[];
  customPlugins?: CustomPluginDefinition[];
  pluginConfig?: Record<string, any>;
  className?: string;
}> = ({ location, activePlugins, customPlugins = [], pluginConfig = {}, className }) => {
  const safeActivePlugins = Array.isArray(activePlugins) ? activePlugins : [];
  const safeCustomPlugins = Array.isArray(customPlugins) ? customPlugins : [];
  const safePluginConfig =
    pluginConfig && typeof pluginConfig === 'object' && !Array.isArray(pluginConfig)
      ? pluginConfig
      : {};

  // 1. Load System Plugins - Filter by activePlugins AND pluginStatus
  const systemPlugins = AVAILABLE_PLUGINS.filter((p) => {
    return isSystemPluginActive(
      { activePlugins: safeActivePlugins, pluginConfig: safePluginConfig },
      p.id
    );
  });

  // 2. Load User Custom HTML Plugins
  const userPlugins = safeCustomPlugins.filter(
    (p) => p && p.enabled === true && p.location === location
  );

  if (systemPlugins.length === 0 && userPlugins.length === 0) return null;

  return (
    <div className={`vp-plugin-slot slot-${location} ${className || ''}`}>
      {/* Render System Plugins */}
      {systemPlugins.map((plugin) => (
        <React.Fragment key={plugin.id}>
          {plugin.render(location, safePluginConfig[plugin.id] || {})}
        </React.Fragment>
      ))}

      {/* Render Custom Plugins */}
      {userPlugins.map((plugin) => (
        <div key={plugin.id} className="custom-plugin-wrapper relative">
          {plugin.cssContent && <style>{plugin.cssContent}</style>}
          <div
            dangerouslySetInnerHTML={{
              __html: sanitizeCustomPluginHtml(plugin.htmlContent),
            }}
          />
        </div>
      ))}
    </div>
  );
};
