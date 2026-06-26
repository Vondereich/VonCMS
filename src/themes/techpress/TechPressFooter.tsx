import React from 'react';
import { Rss } from 'lucide-react';
import { SiteSettings } from '../../types';
import VonNewsletter from '../../components/VonNewsletter';
import { getBasePathPrefix, normalizeSiteUrl } from '../../utils/siteUtils';

interface TechPressFooterProps {
  settings: SiteSettings;
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
    border: string;
    surface: string;
  };
}

const TechPressFooter: React.FC<TechPressFooterProps> = ({ settings, colors }) => {
  const rssPath = `${getBasePathPrefix()}/rss`;
  return (
    <footer
      className="mt-16 border-t"
      style={{ background: colors.surface, borderColor: colors.border }}
    >
      <div className="max-w-7xl mx-auto px-5 py-12 space-y-12">
        {/* Newsletter Widget */}
        {settings.newsletter?.enabled &&
          (settings.newsletter?.position === 'footer' ||
            settings.newsletter?.position === 'both') && (
            <VonNewsletter
              settings={settings.newsletter}
              variant="footer"
              accentColor={colors.primary}
            />
          )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="font-bold text-lg mb-2" style={{ color: colors.text }}>
              {settings.siteName}
            </h3>
            {settings.siteTagline && (
              <p
                className="text-sm font-medium mb-4 opacity-80"
                style={{ color: colors.textSecondary }}
              >
                {settings.siteTagline}
              </p>
            )}
            <p className="text-sm leading-relaxed max-w-md" style={{ color: colors.textSecondary }}>
              {settings.siteDescription}
            </p>
          </div>
          <div className="col-span-1">
            <h4
              className="font-bold text-sm uppercase tracking-wider mb-4"
              style={{ color: colors.text }}
            >
              Useful Links
            </h4>
            <ul className="space-y-2">
              {settings.theme?.techpress?.footerLinks &&
              settings.theme.techpress.footerLinks.length > 0 ? (
                settings.theme.techpress.footerLinks.map((link, idx) => (
                  <li key={idx}>
                    <a
                      href={normalizeSiteUrl(link.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline transition-colors"
                      style={{ color: colors.textSecondary }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))
              ) : (
                <>
                  <li>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-sm hover:underline cursor-pointer"
                      style={{ color: colors.textSecondary }}
                    >
                      Home
                    </a>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        <div
          className="text-center text-sm pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4"
          style={{ color: colors.textSecondary, borderColor: colors.border }}
        >
          <p>
            {settings.footerCopyright ||
              `Powered by VonCMS @ ${new Date().getFullYear()}. All rights reserved.`}
          </p>
          <div className="flex items-center gap-4">
            <a
              href={rssPath}
              className="opacity-70 hover:opacity-100 transition-opacity flex items-center gap-1.5"
              style={{ color: colors.textSecondary }}
              title="RSS Feed"
            >
              <Rss size={14} />
              <span>RSS</span>
            </a>
            <p className="opacity-70">Designed for performance.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default TechPressFooter;
