import React from 'react';
import { AISummaryConfig } from './types';
import { extractSummary } from './extractors';

interface AISummaryComponentProps {
  config: AISummaryConfig;
  content: string;
}

export const AISummaryComponent: React.FC<AISummaryComponentProps> = ({ config, content }) => {
  // Extract summary points
  const summaryPoints = extractSummary(content, config.extractMethod, config.maxBullets);

  // Don't render if no points extracted
  if (summaryPoints.length === 0) return null;

  return (
    <section className="ai-summary my-10 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-6 py-6 text-slate-800 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-slate-100">
      {config.showLabel && (
        <div className="mb-5 flex items-center gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-700/80">
          <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {config.labelText}
          </h3>
        </div>
      )}

      <ul className="space-y-4">
        {summaryPoints.map((point, index) => (
          <li key={index} className="flex items-start gap-4">
            <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />
            <p className="flex-1 text-[15px] leading-7 text-slate-700 dark:text-slate-200">
              {point.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};
