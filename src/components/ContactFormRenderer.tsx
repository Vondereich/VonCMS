import React, { useState, useEffect } from 'react';
import { Loader2, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';
import { sanitizeHtml } from '../utils/security';
import { ContactForm } from '../types';

interface ContactFormRendererProps {
  id: string; // Form ID from shortcode
  className?: string;
}

const ContactFormRenderer: React.FC<ContactFormRendererProps> = ({ id, className }) => {
  const [form, setForm] = useState<ContactForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewState, setViewState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState(''); // Anti-spam honeypot

  // Load form data
  useEffect(() => {
    const fetchForm = async () => {
      try {
        const res = await vonFetch(`${API.getContactForm}?id=${id}`);
        const data = await res.json();
        if (data.success) {
          setForm(data.form);
        } else {
          setForm(null);
        }
      } catch (err) {
        setForm(null);
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [id]);

  // Parse Template and Render
  const renderFormFields = (template: string) => {
    // Regex to match tags like: [text* your-name "Default Value"] or [submit "Label"]
    // Groups: 1=type, 2=asterisk(required), 3=name (optional), 4=value/label (optional)
    const regex = /\[([a-z]+)(\*)?(?:\s+([a-zA-Z0-9-_]+))?(?:\s+"([^"]*)")?\]/g;

    let lastIndex = 0;
    const elements = [];
    let match;

    // Reset regex just in case
    regex.lastIndex = 0;

    while ((match = regex.exec(template)) !== null) {
      // Push text before the match
      if (match.index > lastIndex) {
        const text = template.substring(lastIndex, match.index);
        // Render text as labels
        if (text.trim()) {
          elements.push(
            <div
              key={`label-${lastIndex}`}
              className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mt-4 mb-1.5 transition-colors"
              // nosemgrep: react-dangerouslysetinnerhtml -- contact form template text is sanitized via sanitizeHtml before rendering.
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(text.replace(/\n/g, '<br/>')) }}
            />
          );
        }
      }

      const [, type, requiredStr, name, defaultValue] = match;
      const isRequired = !!requiredStr;

      // Render Input based on type
      elements.push(renderInput(type, name || type, isRequired, defaultValue));

      lastIndex = regex.lastIndex;
    }

    // Push remaining text
    if (lastIndex < template.length) {
      const text = template.substring(lastIndex);
      if (text.trim()) {
        elements.push(
          <span
            key={`text-last`}
            className="block text-slate-500 dark:text-neutral-400 text-sm mt-2"
            // nosemgrep: react-dangerouslysetinnerhtml -- contact form template text is sanitized via sanitizeHtml before rendering.
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(text.replace(/\n/g, '<br/>')) }}
          />
        );
      }
    }

    return elements;
  };

  const renderInput = (
    type: string,
    name: string,
    required: boolean,
    defaultValue: string = ''
  ) => {
    const baseClasses = 'w-full px-4 py-2.5 rounded-xl transition-all duration-200 outline-none';
    const themeClasses =
      'bg-white/50 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700 text-slate-800 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 dark:focus:border-neutral-400 backdrop-blur-sm';
    const key = `field-${name}-${type}`;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [name]: e.target.value }));
    };

    switch (type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
      case 'date':
      case 'number':
        return (
          <input
            aria-label={defaultValue || name}
            key={key}
            type={type}
            name={name}
            required={required}
            className={`${baseClasses} ${themeClasses}`}
            placeholder={defaultValue}
            onChange={handleChange}
            value={formData[name] || ''}
          />
        );

      case 'textarea':
        return (
          <textarea
            aria-label="Text Content"
            key={key}
            name={name}
            required={required}
            className={`${baseClasses} ${themeClasses} min-h-[140px] resize-y`}
            placeholder={defaultValue}
            onChange={handleChange}
            value={formData[name] || ''}
          />
        );

      case 'submit':
        return (
          <div key={key} className="pt-6">
            <button
              type="submit"
              disabled={viewState === 'submitting'}
              className={`group relative overflow-hidden w-full sm:w-auto px-8 py-3 rounded-xl font-semibold text-white shadow-xl shadow-slate-500/25 transition-all duration-300 hover:shadow-slate-500/40 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed`}
            >
              <div
                className="absolute inset-0 transition-all group-hover:scale-105"
                style={{ backgroundColor: 'var(--color-primary, #0ea5e9)' }}
              />
              <div className="relative flex items-center justify-center gap-2">
                {viewState === 'submitting' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>{defaultValue || 'Send Message'}</span>
                    <Send className="w-4 h-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-0.5" />
                  </>
                )}
              </div>
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    setViewState('submitting');
    setMessage('');

    try {
      const payload = {
        formId: form.id,
        data: formData,
        hp_field: honeypot, // Honeypot for spam protection
      };

      const res = await vonFetch(API.submitContact, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (result.success) {
        setViewState('success');
        setMessage(form.messages.success);
        setFormData({}); // Clear form on success
      } else {
        setViewState('error');
        setMessage(result.message || form.messages.error);
      }
    } catch (error) {
      setViewState('error');
      setMessage(form.messages.error);
    }
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 text-current animate-spin" />
        <p className="text-slate-500 dark:text-neutral-400 font-medium">Loading form...</p>
      </div>
    );

  if (!form) {
    return (
      <div className="relative overflow-hidden p-6 border border-red-200/50 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20 backdrop-blur-xl rounded-2xl">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
          <div>
            <h3 className="font-bold text-red-800 dark:text-red-300">Form Error</h3>
            <p className="text-sm text-red-700/80 dark:text-red-400/80 mt-1">
              The requested contact form (ID: <span className="font-mono">{id}</span>) could not be
              loaded. Please check the ID or contact support.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className || ''}`}>
      {/* Background Accent */}
      <div className="absolute -top-12 -right-12 w-64 h-64 bg-slate-500/5 dark:bg-neutral-400/5 blur-3xl rounded-full pointer-events-none" />

      <form
        onSubmit={handleSubmit}
        className="relative bg-white/40 dark:bg-neutral-900/40 backdrop-blur-2xl border border-slate-200/50 dark:border-neutral-800/50 p-6 md:p-8 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none"
      >
        {/* Honeypot field - hidden from humans, visible to bots */}
        <input
          aria-label="Hp Field"
          type="text"
          name="hp_field"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        {renderFormFields(form.template)}

        {/* Status Messages */}
        {message && (
          <div
            className={`mt-8 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
              viewState === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30'
                : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/30'
            }`}
          >
            {viewState === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <p className="text-sm font-medium leading-relaxed">{message}</p>
          </div>
        )}
      </form>
    </div>
  );
};

export default ContactFormRenderer;
