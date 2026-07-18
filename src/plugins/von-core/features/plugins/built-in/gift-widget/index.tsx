import { PluginDefinition, PluginLocation } from '../../../../../../types';
import { Gift } from 'lucide-react';
import { normalizeSiteUrl } from '../../../../../../utils/siteUtils';

const positionClasses: Record<string, string> = {
  'bottom-left': 'bottom-6 left-6',
  'bottom-right': 'bottom-6 right-6',
  'top-left': 'top-24 left-6',
  'top-right': 'top-24 right-6',
};

export const FloatingGiftPlugin: PluginDefinition = {
  id: 'vp_gift_widget',
  name: 'Holiday Gift Widget',
  description: 'Adds a floating gift icon at the bottom right corner.',
  version: '1.25',
  author: 'VonCMS Team',
  render: (location: PluginLocation, props?: any) => {
    if (location !== 'footer_bottom') return null;

    const targetUrl = props?.targetUrl || '#';
    const tooltipText = props?.tooltipText || 'Claim Gift';
    const buttonColor = props?.buttonColor || '#ef4444';
    const position = positionClasses[props?.position] ? props.position : 'bottom-left';
    const iconLabel = props?.iconLabel || '';
    const targetBlank = props?.targetBlank !== false && props?.targetBlank !== 'false';

    return (
      <div
        className={`fixed ${positionClasses[position]} z-50 animate-bounce cursor-pointer group`}
        title={tooltipText}
        onClick={() => {
          const safeTargetUrl = normalizeSiteUrl(targetUrl);
          if (safeTargetUrl === '#') return;
          if (targetBlank) {
            window.open(safeTargetUrl, '_blank', 'noopener,noreferrer');
          } else {
            window.location.href = safeTargetUrl;
          }
        }}
      >
        <div
          className="text-white p-3 rounded-full shadow-lg transition-transform hover:scale-105 relative flex items-center gap-2"
          style={{ backgroundColor: buttonColor }}
        >
          <Gift size={24} />
          {iconLabel && <span className="pr-1 text-sm font-bold">{iconLabel}</span>}
          {/* Tooltip on hover */}
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {tooltipText}
          </div>
        </div>
      </div>
    );
  },
};
