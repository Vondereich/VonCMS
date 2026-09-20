import React from 'react';
import { Check } from 'lucide-react';

import type { AdminPaletteId } from '../../../../../types';
import {
  ADMIN_PALETTES,
  DEFAULT_ADMIN_PALETTE,
  normalizeAdminPalette,
} from '../../../../../utils/adminPalette';

interface AdminPalettePickerProps {
  value?: AdminPaletteId;
  onChange: (value: AdminPaletteId) => void;
}

export const AdminPalettePicker: React.FC<AdminPalettePickerProps> = ({ value, onChange }) => {
  const selectedPalette = normalizeAdminPalette(value || DEFAULT_ADMIN_PALETTE);

  return (
    <fieldset className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-admin-border dark:bg-admin-canvas">
      <legend className="px-1 text-sm font-bold text-slate-800 dark:text-slate-200">
        Administration Color Palette
      </legend>
      <p className="mb-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
        Choose a preset for the admin interface in light mode. Dark mode keeps the Charcoal palette.
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        {ADMIN_PALETTES.map((palette) => {
          const selected = palette.id === selectedPalette;

          return (
            <label key={palette.id} className="relative block cursor-pointer">
              <input
                type="radio"
                name="admin-color-palette"
                value={palette.id}
                checked={selected}
                onChange={() => onChange(palette.id)}
                className="peer sr-only"
              />
              <span
                className={`block rounded-lg border bg-white p-3 text-left transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 dark:bg-admin-panel ${
                  selected
                    ? 'border-blue-600 ring-2 ring-blue-600/15 dark:border-blue-500'
                    : 'border-slate-200 hover:border-slate-400 dark:border-admin-border-strong dark:hover:border-slate-500'
                }`}
              >
                <span className="mb-3 flex overflow-hidden rounded-md border border-black/10">
                  {palette.swatches.map((color) => (
                    <span
                      key={color}
                      className="h-7 flex-1"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {palette.label}
                  </span>
                  {selected && (
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"
                      aria-hidden="true"
                    >
                      <Check size={13} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {palette.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
