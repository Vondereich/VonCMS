import { ArrowUp, ArrowDown } from 'lucide-react';
import {
  CORPORATE_HOME_SECTIONS,
  moveCorporateSection,
  normalizeCorporateSectionOrder,
} from '../config';
import type { CorporateProConfig } from '../config';

interface LayoutPanelProps {
  value: CorporateProConfig;
  onChange: (value: CorporateProConfig) => void;
}

const LayoutPanel = ({ value, onChange }: LayoutPanelProps) => {
  const order = normalizeCorporateSectionOrder(value.sectionOrder);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5 dark:border-admin-border">
        <div>
          <label
            htmlFor="corporate-accent"
            className="text-sm font-semibold text-slate-900 dark:text-white"
          >
            Accent color
          </label>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Buttons and links in Corporate Pro only.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="corporate-accent"
            name="corporate-accent"
            type="color"
            value={value.primaryColor || '#2563eb'}
            onChange={(event) => onChange({ ...value, primaryColor: event.target.value })}
            className="h-10 w-14 cursor-pointer rounded border-0 p-0"
          />
          <span className="font-mono text-sm uppercase text-slate-600 dark:text-slate-400">
            {value.primaryColor || '#2563eb'}
          </span>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Homepage sections</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Choose what appears, then move sections into the order you want. Hidden sections keep
          their content.
        </p>
      </div>
      <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-admin-border dark:border-admin-border">
        {order.map((id, index) => {
          const section = CORPORATE_HOME_SECTIONS.find((item) => item.id === id)!;
          const enabled = value[section.visibilityKey] !== false;
          return (
            <li key={id} className="flex items-center gap-3 p-3 sm:p-4">
              <span className="w-5 shrink-0 text-center text-xs tabular-nums text-slate-400">
                {index + 1}
              </span>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  id={`corporate-section-${id}`}
                  name={`corporate-section-${id}`}
                  aria-label={`Show ${section.label}`}
                  checked={enabled}
                  onChange={(event) =>
                    onChange({ ...value, [section.visibilityKey]: event.target.checked })
                  }
                  className="h-4 w-4 shrink-0 accent-blue-600"
                />
                {section.label}
              </label>
              <div className="flex shrink-0 gap-1">
                {([-1, 1] as const).map((direction) => {
                  const Icon = direction === -1 ? ArrowUp : ArrowDown;
                  return (
                    <button
                      key={direction}
                      type="button"
                      disabled={index + direction < 0 || index + direction >= order.length}
                      onClick={() =>
                        onChange({
                          ...value,
                          sectionOrder: moveCorporateSection(order, id, direction),
                        })
                      }
                      aria-label={`Move ${section.label} ${direction === -1 ? 'up' : 'down'}`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-300 dark:hover:bg-admin-hover"
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Header and footer stay in place. Category pages always show articles, even when Latest Posts
        is hidden on the homepage.
      </p>
    </div>
  );
};

export default LayoutPanel;
