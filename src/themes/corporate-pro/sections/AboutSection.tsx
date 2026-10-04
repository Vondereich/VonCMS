import type { Page, SiteSettings } from '../../../types';
import { htmlToPlainText } from '../../../utils/security';
import { truncateText } from '../../../utils/textUtils';

const AboutSection = ({ settings, pages }: { settings: SiteSettings; pages: Page[] }) => {
  // Try to find an "About" page, otherwise show static
  const aboutPage = pages?.find((p) => p.title?.toLowerCase().includes('about'));
  const aboutExcerpt = truncateText(htmlToPlainText(aboutPage?.content), 300);

  return (
    <section className="py-20 bg-slate-50 dark:bg-neutral-900 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 flex flex-col md:flex-row items-center gap-16">
        <div className="md:w-1/2 relative">
          <div className="aspect-square bg-(--corporate-accent) rounded-2xl absolute -top-4 -left-4 w-full h-full opacity-10"></div>
          <img
            src={
              settings.theme?.corporatePro?.aboutImage ||
              'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1000'
            }
            alt="About Us"
            loading="lazy"
            className="rounded-2xl shadow-2xl relative z-10 w-full object-cover aspect-4/3"
          />
        </div>
        <div className="md:w-1/2">
          <span className="text-(--corporate-link) font-bold tracking-wider uppercase text-sm mb-2 block">
            Who We Are
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">
            {settings.theme?.corporatePro?.aboutTitle || 'Leading the Way in Corporate Excellence'}
          </h2>
          <div className="text-slate-600 dark:text-neutral-300 space-y-4 mb-8 text-lg font-light">
            {settings.theme?.corporatePro?.aboutSubtitle ? (
              <p>{settings.theme.corporatePro.aboutSubtitle}</p>
            ) : aboutExcerpt ? (
              <p>{aboutExcerpt}</p>
            ) : (
              <p>
                With over a decade of experience, we help businesses navigate the complex landscape
                of modern commerce. Our team of dedicated professionals is committed to delivering
                results that exceed expectations.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col">
              <span className="text-4xl font-bold text-(--corporate-link)">
                {settings.theme?.corporatePro?.aboutStat1Number || '500+'}
              </span>
              <span className="text-slate-600 dark:text-neutral-400 font-medium">
                {settings.theme?.corporatePro?.aboutStat1Label || 'Clients Served'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-4xl font-bold text-(--corporate-link)">
                {settings.theme?.corporatePro?.aboutStat2Number || '98%'}
              </span>
              <span className="text-slate-600 dark:text-neutral-400 font-medium">
                {settings.theme?.corporatePro?.aboutStat2Label || 'Satisfaction Rate'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
