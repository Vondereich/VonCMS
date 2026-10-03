import PublicNavigationLink from '../../shared/components/PublicNavigationLink';
import type { CorporateSectionProps } from './types';

const HeroSection = ({
  settings,
  posts,
  pages,
  onNavigate,
  isFirst = true,
}: CorporateSectionProps & { isFirst?: boolean }) => (
  <section
    className={`relative pb-20 lg:pb-32 overflow-hidden bg-slate-50 dark:bg-neutral-900 ${isFirst ? 'pt-32 lg:pt-48' : 'pt-20 lg:pt-32'}`}
  >
    {/* Background Pattern */}
    <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
      <div className="absolute right-0 top-0 w-1/2 h-full bg-(--corporate-accent) transform skew-x-12 translate-x-32"></div>
    </div>

    {settings.theme?.corporatePro?.heroImage && (
      <img
        src={settings.theme.corporatePro.heroImage}
        className="absolute inset-0 w-full h-full object-cover opacity-10 dark:opacity-20 mix-blend-overlay pointer-events-none"
        alt="Hero Background"
      />
    )}
    <div className="max-w-7xl mx-auto px-5 relative z-10">
      <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
        <div className="lg:w-1/2 animate-slide-up">
          <span className="inline-block px-4 py-1.5 rounded-full bg-(--corporate-accent-soft) dark:bg-(--corporate-accent-strong)/30 text-(--corporate-link) dark:text-(--corporate-accent-light) text-sm font-bold tracking-wide mb-6">
            {settings.theme?.corporatePro?.heroEyebrow || 'CORPORATE SOLUTIONS'}
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white leading-tight mb-8">
            {settings.theme?.corporatePro?.heroTitle || (
              <>
                Elevate Your Business to <span className="text-(--corporate-link)">Next Level</span>
              </>
            )}
          </h1>
          <p className="text-xl text-slate-600 dark:text-neutral-300 mb-10 leading-relaxed max-w-2xl">
            {settings.theme?.corporatePro?.heroText ||
              'We provide cutting-edge solutions to help your business grow. Professional, reliable, and scalable strategies for modern enterprises.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-5 pt-4">
            <PublicNavigationLink
              nav={{
                id: 'corporate-hero-primary',
                label: settings.theme?.corporatePro?.heroPrimaryText || 'Get a Quote',
                url: settings.theme?.corporatePro?.heroPrimaryLink || '',
                type: 'internal',
              }}
              settings={settings}
              posts={posts}
              pages={pages}
              onNavigate={() => onNavigate(settings.theme?.corporatePro?.heroPrimaryLink)}
              className="px-8 py-4 bg-(--corporate-accent) hover:bg-(--corporate-accent-hover) text-(--corporate-on-accent) font-bold rounded-lg shadow-lg shadow-(color:--corporate-accent)/30 transition-all hover:scale-105"
            >
              {settings.theme?.corporatePro?.heroPrimaryText || 'Get a Quote'}
            </PublicNavigationLink>
            <PublicNavigationLink
              nav={{
                id: 'corporate-hero-secondary',
                label: settings.theme?.corporatePro?.heroSecondaryText || 'Learn More',
                url: settings.theme?.corporatePro?.heroSecondaryLink || '',
                type: 'internal',
              }}
              settings={settings}
              posts={posts}
              pages={pages}
              onNavigate={() => onNavigate(settings.theme?.corporatePro?.heroSecondaryLink)}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-slate-700 dark:text-white font-bold rounded-lg backdrop-blur-md border border-slate-200 dark:border-white/20 transition-all hover:scale-105"
            >
              {settings.theme?.corporatePro?.heroSecondaryText || 'Learn More'}
            </PublicNavigationLink>
          </div>
        </div>

        {/* Hero Featured Image */}
        <div className="lg:w-1/2 relative hidden lg:block animate-slide-in-right">
          <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border-8 border-white dark:border-neutral-800 rotate-2 hover:rotate-0 transition-transform duration-500">
            <img
              src={
                settings.theme?.corporatePro?.heroImage ||
                'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=1000'
              }
              className="w-full h-[500px] object-cover"
              alt="Hero Featured"
            />
          </div>
          {/* Decorative Elements */}
          <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-(--corporate-accent) rounded-2xl -z-10 opacity-20 animate-pulse"></div>
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-(--corporate-accent-light) rounded-full -z-10 opacity-20"></div>
        </div>
      </div>
    </div>
  </section>
);

export default HeroSection;
