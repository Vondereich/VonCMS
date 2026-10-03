import PublicNavigationLink from '../../shared/components/PublicNavigationLink';
import type { CorporateSectionProps } from './types';

const CallToActionSection = ({ settings, posts, pages, onNavigate }: CorporateSectionProps) => (
  <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
    <div className="absolute inset-0 bg-(--corporate-accent)/20 mix-blend-overlay"></div>
    <div className="max-w-4xl mx-auto px-5 text-center relative z-10">
      <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
        {settings.theme?.corporatePro?.ctaTitle || 'Ready to Transform Your Business?'}
      </h2>
      <p className="text-xl text-slate-300 mb-10 font-light">
        {settings.theme?.corporatePro?.ctaSubtitle ||
          'Join hundreds of successful companies that trust us with their corporate strategy.'}
      </p>
      <PublicNavigationLink
        nav={{
          id: 'corporate-footer-cta',
          label: settings.theme?.corporatePro?.ctaButtonText || 'Start Your Project Today',
          url: settings.theme?.corporatePro?.ctaButtonLink || '',
          type: 'internal',
        }}
        settings={settings}
        posts={posts}
        pages={pages}
        onNavigate={() => onNavigate(settings.theme?.corporatePro?.ctaButtonLink)}
        className="px-10 py-5 bg-(--corporate-accent) hover:bg-(--corporate-accent-hover) text-(--corporate-on-accent) font-bold rounded-lg shadow-xl shadow-(color:--corporate-accent)/30 transition-all hover:scale-105"
      >
        {settings.theme?.corporatePro?.ctaButtonText || 'Start Your Project Today'}
      </PublicNavigationLink>
    </div>
  </section>
);

export default CallToActionSection;
