import type { CorporateHomeSectionId, CorporateProConfig } from '../config';
import { SERVICE_ICONS } from '../sections/ServiceIcon';
import { ImagePickerField, InputField, SelectField, TextAreaField } from './Fields';

export type ContentTab = CorporateHomeSectionId | 'footer';
type TextKey = {
  [K in keyof CorporateProConfig]: NonNullable<CorporateProConfig[K]> extends string ? K : never;
}[keyof CorporateProConfig] &
  string;
interface FieldDefinition {
  key: TextKey;
  label: string;
  kind?: 'text' | 'textarea' | 'image';
  placeholder?: string;
}

const FIELDS: Record<ContentTab, FieldDefinition[]> = {
  hero: [
    { key: 'heroEyebrow', label: 'Eyebrow', placeholder: 'CORPORATE SOLUTIONS' },
    { key: 'heroTitle', label: 'Headline', placeholder: 'Elevate Your Business to Next Level' },
    { key: 'heroText', label: 'Introduction', kind: 'textarea' },
    { key: 'heroImage', label: 'Featured image', kind: 'image' },
    { key: 'heroPrimaryText', label: 'Primary button text', placeholder: 'Get a Quote' },
    { key: 'heroPrimaryLink', label: 'Primary button link', placeholder: '/contact or page:ID' },
    { key: 'heroSecondaryText', label: 'Secondary button text', placeholder: 'Learn More' },
    { key: 'heroSecondaryLink', label: 'Secondary button link', placeholder: '/about or page:ID' },
  ],
  services: [
    { key: 'servicesTitle', label: 'Section title', placeholder: 'Our Premium Services' },
    { key: 'servicesSubtitle', label: 'Introduction', kind: 'textarea' },
  ],
  about: [
    {
      key: 'aboutTitle',
      label: 'Headline',
      placeholder: 'Leading the Way in Corporate Excellence',
    },
    { key: 'aboutSubtitle', label: 'Description', kind: 'textarea' },
    { key: 'aboutImage', label: 'Showcase image', kind: 'image' },
    { key: 'aboutStat1Number', label: 'Statistic 1 value', placeholder: '500+' },
    { key: 'aboutStat1Label', label: 'Statistic 1 label', placeholder: 'Clients Served' },
    { key: 'aboutStat2Number', label: 'Statistic 2 value', placeholder: '98%' },
    { key: 'aboutStat2Label', label: 'Statistic 2 label', placeholder: 'Satisfaction Rate' },
  ],
  posts: [
    { key: 'postsTitle', label: 'Section title', placeholder: 'Latest Insights' },
    {
      key: 'postsSubtitle',
      label: 'Introduction',
      kind: 'textarea',
      placeholder: 'News and updates from our experts.',
    },
    {
      key: 'newsLink',
      label: 'View All Articles link (optional)',
      placeholder: '/?category=News or https://...',
    },
  ],
  cta: [
    { key: 'ctaTitle', label: 'Headline', placeholder: 'Ready to Transform Your Business?' },
    { key: 'ctaSubtitle', label: 'Introduction', kind: 'textarea' },
    { key: 'ctaButtonText', label: 'Button text', placeholder: 'Start Your Project Today' },
    { key: 'ctaButtonLink', label: 'Button link', placeholder: '/contact or page:ID' },
  ],
  footer: [
    { key: 'footerAbout', label: 'About text', kind: 'textarea' },
    { key: 'contactEmail', label: 'Contact email', placeholder: 'support@example.com' },
    { key: 'contactPhone', label: 'Contact phone' },
    { key: 'contactAddress', label: 'Office address' },
  ],
};

const DESCRIPTIONS: Record<ContentTab, string> = {
  hero: 'Your main introduction, image and two navigation buttons.',
  services: 'Edit the three service items. Choose an icon from the built-in set.',
  about:
    'Introduce your organisation and display two key statistics. With no description, the existing About page is used when available.',
  posts:
    'Articles come from the existing public listing and keep its category filtering, ads and Load More pagination.',
  cta: 'A short closing message and a link to your next step.',
  footer:
    'Footer copy and contact details. Site logo, menu and newsletter remain managed in their existing settings.',
};

interface ContentPanelProps {
  tab: ContentTab;
  value: CorporateProConfig;
  onChange: (value: CorporateProConfig) => void;
}

const ContentPanel = ({ tab, value, onChange }: ContentPanelProps) => {
  const updateText = (key: TextKey, text: string) => onChange({ ...value, [key]: text });
  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {DESCRIPTIONS[tab]} Blank fields retain the theme's existing fallback.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS[tab].map((field) => {
          const Component =
            field.kind === 'textarea'
              ? TextAreaField
              : field.kind === 'image'
                ? ImagePickerField
                : InputField;
          return (
            <div key={field.key} className={field.kind ? 'sm:col-span-2' : ''}>
              <Component
                label={field.label}
                value={value[field.key]}
                onChange={(text) => updateText(field.key, text)}
                placeholder={field.placeholder}
              />
            </div>
          );
        })}
      </div>
      {tab === 'services' &&
        ([1, 2, 3] as const).map((number) => (
          <fieldset
            key={number}
            className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-admin-border sm:p-5"
          >
            <legend className="px-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Service {number}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label={`Service ${number} title`}
                value={value[`service${number}Title`]}
                onChange={(text) => updateText(`service${number}Title`, text)}
              />
              <SelectField
                label={`Service ${number} icon`}
                value={value[`service${number}Icon`]}
                options={Object.keys(SERVICE_ICONS)}
                onChange={(text) => updateText(`service${number}Icon`, text)}
              />
            </div>
            <TextAreaField
              label={`Service ${number} description`}
              value={value[`service${number}Desc`]}
              onChange={(text) => updateText(`service${number}Desc`, text)}
            />
            <InputField
              label={`Service ${number} link`}
              value={value[`service${number}Link`]}
              onChange={(text) => updateText(`service${number}Link`, text)}
              placeholder="/services or page:ID"
            />
          </fieldset>
        ))}
    </div>
  );
};

export default ContentPanel;
