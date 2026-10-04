import { ChevronRight } from 'lucide-react';
import PublicNavigationLink from '../../shared/components/PublicNavigationLink';
import ServiceIcon from './ServiceIcon';
import type { CorporateSectionProps } from './types';

const ServicesSection = ({ settings, posts, pages, onNavigate }: CorporateSectionProps) => (
  <section className="py-20 bg-white dark:bg-neutral-950">
    <div className="max-w-7xl mx-auto px-5">
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
          {settings.theme?.corporatePro?.servicesTitle || 'Our Premium Services'}
        </h2>
        <p className="text-slate-600 dark:text-neutral-400">
          {settings.theme?.corporatePro?.servicesSubtitle ||
            'Comprehensive layouts and features designed for your success.'}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {[
          {
            title: settings.theme?.corporatePro?.service1Title || 'Strategic Planning',
            icon: settings.theme?.corporatePro?.service1Icon || 'Target',
            desc:
              settings.theme?.corporatePro?.service1Desc ||
              'Expert guidance to define your business roadmap and achieve long-term goals.',
            link: settings.theme?.corporatePro?.service1Link || '',
          },
          {
            title: settings.theme?.corporatePro?.service2Title || 'Digital Transformation',
            icon: settings.theme?.corporatePro?.service2Icon || 'Cpu',
            desc:
              settings.theme?.corporatePro?.service2Desc ||
              'Modernize your operations with cutting-edge technology solutions.',
            link: settings.theme?.corporatePro?.service2Link || '',
          },
          {
            title: settings.theme?.corporatePro?.service3Title || 'Market Analysis',
            icon: settings.theme?.corporatePro?.service3Icon || 'BarChart',
            desc:
              settings.theme?.corporatePro?.service3Desc ||
              'In-depth insights into market trends to keep you ahead of the competition.',
            link: settings.theme?.corporatePro?.service3Link || '',
          },
        ].map((service, idx) => (
          <div
            key={idx}
            className="p-8 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 hover:shadow-xl transition-all hover:-translate-y-1 group"
          >
            <div className="w-14 h-14 bg-white dark:bg-neutral-800 rounded-xl shadow-xs border border-slate-100 dark:border-neutral-700 flex items-center justify-center mb-6 text-(--corporate-link) group-hover:bg-(--corporate-accent) group-hover:text-(--corporate-on-accent) transition-colors">
              <ServiceIcon name={service.icon} size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
              {service.title}
            </h3>
            <p className="text-slate-600 dark:text-neutral-400 leading-relaxed">{service.desc}</p>
            <PublicNavigationLink
              nav={{
                id: `corporate-service-${idx + 1}`,
                label: service.title,
                url: service.link,
                type: 'internal',
              }}
              settings={settings}
              posts={posts}
              pages={pages}
              onNavigate={() => onNavigate(service.link)}
              className="inline-flex items-center gap-2 text-(--corporate-link) font-bold mt-6 hover:gap-3 transition-all"
            >
              Learn More <ChevronRight size={16} />
            </PublicNavigationLink>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ServicesSection;
