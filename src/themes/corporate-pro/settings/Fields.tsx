import { useId } from 'react';
import { Image } from 'lucide-react';
import SafeImage from '../../../components/SafeImage';

interface FieldProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const fieldClass =
  'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-hidden focus:ring-2 focus:ring-blue-500 dark:border-admin-border dark:bg-admin-panel dark:text-white';
const labelClass = 'mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300';

export const InputField = ({ label, value, onChange, placeholder }: FieldProps) => {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-label={label}
        type="text"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={fieldClass}
      />
    </div>
  );
};

export const TextAreaField = ({ label, value, onChange, placeholder }: FieldProps) => {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        aria-label={label}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className={`${fieldClass} resize-y`}
      />
    </div>
  );
};

export const ImagePickerField = ({ label, value, onChange }: FieldProps) => {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="flex items-start gap-3">
        <input
          id={id}
          name={id}
          aria-label={label}
          type="text"
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder="/uploads/... or https://..."
          className={fieldClass}
        />
        <div className="h-11 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-admin-border dark:bg-admin-hover">
          <SafeImage
            src={value}
            alt={`${label} preview`}
            className="h-full w-full object-cover"
            fallback={
              <div className="flex h-full items-center justify-center text-slate-400">
                <Image size={20} />
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
};

export const SelectField = ({
  label,
  value,
  onChange,
  options,
}: FieldProps & { options: string[] }) => {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        name={id}
        aria-label={label}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      >
        <option value="">Theme default</option>
        {value && !options.includes(value) && <option value={value}>{value} (saved value)</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};
